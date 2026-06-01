import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  Film,
  Image as ImageIcon,
  Info,
  MousePointerClick,
  Pause,
  Play,
  Plus,
  Settings2,
  Trash2,
  Upload,
  X
} from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { Button } from './components/Button';
import { MotionCard } from './components/MotionCard';
import { MOTION_PRESETS } from './constants';
import { EasingMode, ExportFormat, ExportSettings, MotionConfig, MotionKeyframe } from './types';
import { getKeyframeDuration, renderFrame } from './services/motionService';

const DEFAULT_KEYFRAMES: MotionKeyframe[] = [
  { id: 'kf-1', x: 0.35, y: 0.45, zoom: 1.1, delay: 0.5, easing: 'ease-in-out' },
  { id: 'kf-2', x: 0.65, y: 0.55, zoom: 1.45, delay: 0.5, easing: 'smoothstep' }
];

const MIME_BY_FORMAT: Record<ExportFormat, string[]> = {
  webm: ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'],
  mp4: ['video/mp4;codecs=avc1.42E01E', 'video/mp4']
};

const EASING_OPTIONS: EasingMode[] = ['linear', 'ease-in', 'ease-out', 'ease-in-out', 'smoothstep'];

const getMediaSize = (media: HTMLImageElement | HTMLVideoElement) => ({
  width: media instanceof HTMLVideoElement ? media.videoWidth : media.naturalWidth,
  height: media instanceof HTMLVideoElement ? media.videoHeight : media.naturalHeight
});

const getSupportedMime = (format: ExportFormat) =>
  MIME_BY_FORMAT[format].find((mimeType) => MediaRecorder.isTypeSupported(mimeType));

const waitForVideoSeek = (video: HTMLVideoElement, time: number) =>
  new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error('Video seek timed out'));
    }, 3000);

    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('error', handleError);
    };

    const handleSeeked = () => {
      cleanup();
      resolve();
    };

    const handleError = () => {
      cleanup();
      reject(new Error('Video seek failed'));
    };

    video.addEventListener('seeked', handleSeeked, { once: true });
    video.addEventListener('error', handleError, { once: true });
    video.currentTime = time;
  });

function App() {
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);
  const [mediaElement, setMediaElement] = useState<HTMLImageElement | HTMLVideoElement | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);
  const [pathMode, setPathMode] = useState<'add' | 'move'>('add');
  const [keyframes, setKeyframes] = useState<MotionKeyframe[]>(DEFAULT_KEYFRAMES);
  const [selectedKeyframeId, setSelectedKeyframeId] = useState(DEFAULT_KEYFRAMES[0].id);
  const [config, setConfig] = useState<MotionConfig>({
    presetId: MOTION_PRESETS[0].id,
    duration: 5,
    travelTime: 1.5,
    delayTime: 0.5,
    playbackSpeed: 1
  });
  const [exportSettings, setExportSettings] = useState<ExportSettings>({
    format: 'webm',
    fps: 30,
    resolutionScale: 1,
    quality: 0.8,
    duration: 5,
    transparent: false
  });
  const [canvasSize, setCanvasSize] = useState({ width: 640, height: 360 });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const isCustomFocus = config.presetId === 'custom-focus';
  const isCustomPath = config.presetId === 'custom-path';
  const selectedKeyframe = keyframes.find((keyframe) => keyframe.id === selectedKeyframeId) ?? keyframes[0];
  const keyframeDuration = useMemo(() => getKeyframeDuration(keyframes, config.travelTime), [keyframes, config.travelTime]);
  const totalDuration = isCustomPath ? keyframeDuration : exportSettings.duration / config.playbackSpeed;

  const activePreset = useMemo(() => {
    const basePreset = MOTION_PRESETS.find((preset) => preset.id === config.presetId) ?? MOTION_PRESETS[0];

    if (isCustomFocus && focusPoint) {
      return {
        ...basePreset,
        params: {
          ...basePreset.params,
          zoomStart: 1,
          zoomEnd: 1.5,
          panXStart: 0.5,
          panXEnd: focusPoint.x,
          panYStart: 0.5,
          panYEnd: focusPoint.y
        }
      };
    }

    return basePreset;
  }, [config.presetId, focusPoint, isCustomFocus]);

  const updateExportSettings = (partial: Partial<ExportSettings>) => {
    setExportSettings((current) => ({ ...current, ...partial }));
  };

  const updateSelectedKeyframe = (partial: Partial<MotionKeyframe>) => {
    if (!selectedKeyframe) return;
    setKeyframes((current) =>
      current.map((keyframe) => (keyframe.id === selectedKeyframe.id ? { ...keyframe, ...partial } : keyframe))
    );
  };

  const addKeyframe = (x = 0.5, y = 0.5) => {
    const newKeyframe: MotionKeyframe = {
      id: `kf-${Date.now()}`,
      x,
      y,
      zoom: selectedKeyframe?.zoom ?? 1.2,
      delay: selectedKeyframe?.delay ?? 0.5,
      easing: selectedKeyframe?.easing ?? 'ease-in-out'
    };
    setKeyframes((current) => [...current, newKeyframe]);
    setSelectedKeyframeId(newKeyframe.id);
  };

  const deleteSelectedKeyframe = () => {
    if (keyframes.length <= 1 || !selectedKeyframe) return;
    setKeyframes((current) => {
      const next = current.filter((keyframe) => keyframe.id !== selectedKeyframe.id);
      setSelectedKeyframeId(next[0].id);
      return next;
    });
  };

  const syncCanvasSize = useCallback(() => {
    if (!containerRef.current || !mediaElement) return;
    const { width: mediaW, height: mediaH } = getMediaSize(mediaElement);
    if (!mediaW || !mediaH) return;

    const bounds = containerRef.current.getBoundingClientRect();
    const availableWidth = Math.max(240, bounds.width - 48);
    const availableHeight = Math.max(180, bounds.height - 48);
    const ratio = mediaW / mediaH;
    let width = availableWidth;
    let height = width / ratio;

    if (height > availableHeight) {
      height = availableHeight;
      width = height * ratio;
    }

    setCanvasSize({ width: Math.floor(width), height: Math.floor(height) });
  }, [mediaElement]);

  const drawPreviewFrame = useCallback(
    (timeProgress: number) => {
      if (!canvasRef.current || !mediaElement) return;
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      canvasRef.current.width = Math.max(1, Math.floor(canvasSize.width * dpr));
      canvasRef.current.height = Math.max(1, Math.floor(canvasSize.height * dpr));
      canvasRef.current.style.width = `${canvasSize.width}px`;
      canvasRef.current.style.height = `${canvasSize.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      renderFrame(
        ctx,
        mediaElement,
        timeProgress,
        activePreset,
        canvasSize.width,
        canvasSize.height,
        config.travelTime,
        config.delayTime,
        totalDuration,
        { keyframes: isCustomPath ? keyframes : undefined, transparent: false }
      );

      if ((isCustomFocus || isCustomPath) && !isPlaying) {
        ctx.save();
        const points = isCustomPath ? keyframes : focusPoint ? [{ id: 'focus', ...focusPoint }] : [];
        points.forEach((point, index) => {
          const markerX = point.x * canvasSize.width;
          const markerY = point.y * canvasSize.height;
          const selected = 'id' in point && point.id === selectedKeyframeId;
          ctx.strokeStyle = selected ? '#a5b4fc' : 'rgba(255,255,255,0.9)';
          ctx.fillStyle = selected ? '#4f46e5' : 'rgba(9,9,11,0.8)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(markerX, markerY, selected ? 9 : 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          if (isCustomPath) {
            ctx.fillStyle = '#ffffff';
            ctx.font = '10px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(index + 1), markerX, markerY);
          }
        });
        ctx.restore();
      }
    },
    [
      activePreset,
      canvasSize.height,
      canvasSize.width,
      config.delayTime,
      config.travelTime,
      focusPoint,
      isCustomFocus,
      isCustomPath,
      isPlaying,
      keyframes,
      mediaElement,
      selectedKeyframeId,
      totalDuration
    ]
  );

  const animate = useCallback(
    (time: number) => {
      if (!mediaElement) return;
      if (!isPlaying && !isCustomFocus && !isCustomPath) return;

      if (!startTimeRef.current) startTimeRef.current = time;
      const elapsed = (time - startTimeRef.current) / 1000;
      const nextProgress = isPlaying ? (elapsed % totalDuration) / totalDuration : 0;
      setProgress(nextProgress);
      drawPreviewFrame(nextProgress);
      requestRef.current = requestAnimationFrame((nextTime) => animate(nextTime));
    },
    [drawPreviewFrame, isCustomFocus, isCustomPath, isPlaying, mediaElement, totalDuration]
  );

  useEffect(() => {
    syncCanvasSize();
    const observer = new ResizeObserver(syncCanvasSize);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [syncCanvasSize]);

  useEffect(() => {
    if (!mediaElement) return;
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      startTimeRef.current = null;
    };
  }, [animate, mediaElement]);

  useEffect(() => {
    if (mediaElement instanceof HTMLVideoElement) {
      mediaElement.playbackRate = config.playbackSpeed;
      if (isPlaying && !isRecording) {
        mediaElement.play().catch(() => toast.error('Video playback was blocked by the browser'));
      } else {
        mediaElement.pause();
      }
    }
  }, [config.playbackSpeed, isPlaying, isRecording, mediaElement]);

  useEffect(() => {
    if (!selectedMedia) {
      setMediaElement(null);
      return;
    }

    let canceled = false;

    if (mediaType === 'video') {
      const video = document.createElement('video');
      video.src = selectedMedia;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';
      video.onloadedmetadata = () => {
        if (canceled) return;
        setMediaElement(video);
        setIsPlaying(true);
      };
      video.onerror = () => toast.error('Failed to load video');
    } else {
      const image = new Image();
      image.src = selectedMedia;
      image.onload = () => {
        if (canceled) return;
        setMediaElement(image);
        setIsPlaying(true);
      };
      image.onerror = () => toast.error('Failed to load image');
    }

    return () => {
      canceled = true;
    };
  }, [selectedMedia, mediaType]);

  useEffect(() => {
    if (selectedMedia && (isCustomFocus || isCustomPath)) {
      setIsPlaying(false);
    }
  }, [isCustomFocus, isCustomPath, selectedMedia]);

  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    []
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
      if (event.code === 'Space' && selectedMedia && !isRecording) {
        event.preventDefault();
        setIsPlaying((current) => !current);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRecording, selectedMedia]);

  const handleFile = (file: File) => {
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');

    if (!isVideo && !isImage) {
      toast.error('Please choose an image or video file');
      return;
    }

    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setSelectedMedia(url);
    setMediaType(isVideo ? 'video' : 'image');
    setFocusPoint(null);
    setProgress(0);
    toast.success(`${isVideo ? 'Video' : 'Image'} loaded`);
  };

  const clearMedia = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setSelectedMedia(null);
    setMediaElement(null);
    setMediaType(null);
    setFocusPoint(null);
    setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !mediaElement) return;
    if (!isCustomFocus && !isCustomPath) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;

    if (isCustomFocus) {
      setFocusPoint({ x, y });
    } else if (pathMode === 'move' && selectedKeyframe) {
      updateSelectedKeyframe({ x, y });
    } else {
      addKeyframe(x, y);
    }

    setIsPlaying(false);
  };

  const handlePresetSelect = (presetId: string) => {
    setConfig((current) => ({ ...current, presetId }));
    setProgress(0);
  };

  const renderExportFrame = async (
    exportCtx: CanvasRenderingContext2D,
    frameProgress: number,
    width: number,
    height: number
  ) => {
    if (!mediaElement) return;

    if (mediaElement instanceof HTMLVideoElement && Number.isFinite(mediaElement.duration) && mediaElement.duration > 0) {
      const sourceTime = Math.min(mediaElement.duration - 0.05, (frameProgress * totalDuration) % mediaElement.duration);
      await waitForVideoSeek(mediaElement, Math.max(0, sourceTime));
    }

    renderFrame(
      exportCtx,
      mediaElement,
      frameProgress,
      activePreset,
      width,
      height,
      config.travelTime,
      config.delayTime,
      totalDuration,
      { keyframes: isCustomPath ? keyframes : undefined, transparent: exportSettings.transparent }
    );
  };

  const handleExport = async () => {
    if (!mediaElement) return;

    if (exportSettings.transparent && exportSettings.format === 'mp4') {
      toast.error('Transparent export needs WebM in current browsers');
      return;
    }

    const mimeType = getSupportedMime(exportSettings.format);
    if (!mimeType) {
      toast.error(`${exportSettings.format.toUpperCase()} export is not supported in this browser`);
      return;
    }

    const { width: sourceW, height: sourceH } = getMediaSize(mediaElement);
    const width = Math.max(2, Math.round(sourceW * exportSettings.resolutionScale));
    const height = Math.max(2, Math.round(sourceH * exportSettings.resolutionScale));
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = width;
    exportCanvas.height = height;
    const exportCtx = exportCanvas.getContext('2d', { alpha: exportSettings.transparent }) as CanvasRenderingContext2D | null;

    if (!exportCtx) {
      toast.error('Failed to initialize export renderer');
      return;
    }

    setIsRecording(true);
    setIsPlaying(false);
    toast.loading('Rendering video...', { id: 'export-toast' });

    const stream = exportCanvas.captureStream(exportSettings.fps);
    const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack & { requestFrame?: () => void };
    const chunks: Blob[] = [];
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: Math.round(1_000_000 + exportSettings.quality * 11_000_000)
    });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    const stopped = new Promise<void>((resolve) => {
      mediaRecorder.onstop = () => resolve();
    });

    try {
      mediaRecorder.start();
      const frames = Math.max(1, Math.round(totalDuration * exportSettings.fps));

      if (mediaElement instanceof HTMLVideoElement) mediaElement.pause();

      for (let frame = 0; frame <= frames; frame += 1) {
        const frameProgress = frame / frames;
        await renderExportFrame(exportCtx, frameProgress, width, height);
        track.requestFrame?.();
        toast.loading(`Rendering video... ${Math.round(frameProgress * 100)}%`, { id: 'export-toast' });
        await new Promise((resolve) => window.setTimeout(resolve, 1000 / exportSettings.fps));
      }

      mediaRecorder.stop();
      await stopped;

      const extension = exportSettings.format;
      const blob = new Blob(chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `motioncraft-${Date.now()}.${extension}`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success('Export complete', { id: 'export-toast' });
    } catch (error) {
      console.error(error);
      if (mediaRecorder.state !== 'inactive') mediaRecorder.stop();
      toast.error('Export failed. Try WebM, lower FPS, or a smaller resolution.', { id: 'export-toast' });
    } finally {
      setIsRecording(false);
      setIsPlaying(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f11] text-gray-100">
      <Toaster theme="dark" position="bottom-right" />
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[#27272a] bg-[#131316] px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20">
            <Film className="h-4 w-4 text-white" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-none tracking-tight">MotionCraft</h1>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Camera motion editor</p>
          </div>
        </div>
        <Button
          variant="primary"
          className="border-0 bg-white px-3 py-1.5 text-sm text-black shadow-lg shadow-white/5 hover:bg-gray-200"
          onClick={handleExport}
          isLoading={isRecording}
          disabled={!selectedMedia || isRecording}
          icon={<Download size={14} />}
          aria-label={`Export ${exportSettings.format.toUpperCase()}`}
        >
          {isRecording ? 'Rendering' : `Export ${exportSettings.format.toUpperCase()}`}
        </Button>
      </header>

      <div className="flex min-h-[calc(100vh-3.5rem)] flex-col lg:flex-row">
        <aside className="w-full border-b border-[#27272a] bg-[#131316] lg:w-80 lg:shrink-0 lg:border-b-0 lg:border-r">
          <div className="max-h-[50vh] space-y-6 overflow-y-auto p-4 lg:max-h-none lg:p-6">
            <section>
              <span className="mb-3 block text-xs font-semibold uppercase tracking-wider text-gray-500">Source Asset</span>
              {!selectedMedia ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault();
                    setIsDragging(false);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    setIsDragging(false);
                    const file = event.dataTransfer.files?.[0];
                    if (file) handleFile(file);
                  }}
                  className={`flex h-44 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-all ${
                    isDragging ? 'border-indigo-500 bg-indigo-500/10' : 'border-[#27272a] hover:border-indigo-500/50 hover:bg-[#18181b]'
                  }`}
                  aria-label="Upload image or video"
                >
                  <Upload className="mb-3 h-7 w-7 text-gray-400" aria-hidden="true" />
                  <span className="text-sm font-medium text-gray-400">{isDragging ? 'Drop media here' : 'Click or drag to upload'}</span>
                  <span className="mt-1 text-xs text-gray-600">Image or video</span>
                </button>
              ) : (
                <div className="group relative overflow-hidden rounded-lg border border-[#27272a] bg-black">
                  {mediaType === 'video' ? (
                    <video src={selectedMedia} className="h-44 w-full object-contain" autoPlay loop muted playsInline />
                  ) : (
                    <img src={selectedMedia} alt="Selected source" className="h-44 w-full object-contain" />
                  )}
                  <button
                    type="button"
                    onClick={clearMedia}
                    className="absolute right-2 top-2 rounded-md bg-black/70 p-1.5 text-white opacity-100 transition hover:bg-red-500/80 lg:opacity-0 lg:group-hover:opacity-100"
                    aria-label="Clear selected media"
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>
              )}
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*,video/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
            </section>

            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Motion Style</h2>
              <div className="grid grid-cols-1 gap-2">
                {MOTION_PRESETS.map((preset) => (
                  <MotionCard
                    key={preset.id}
                    preset={preset}
                    isSelected={config.presetId === preset.id}
                    onClick={() => handlePresetSelect(preset.id)}
                  />
                ))}
              </div>
            </section>
          </div>
        </aside>

        <main className="flex min-h-[520px] min-w-0 flex-1 flex-col bg-[#09090b]">
          <div ref={containerRef} className="relative flex flex-1 items-center justify-center overflow-hidden p-4 lg:p-6">
            {selectedMedia ? (
              <div className="relative flex items-center justify-center overflow-hidden rounded-sm border border-[#27272a] bg-black shadow-2xl shadow-black/50">
                <canvas
                  ref={canvasRef}
                  onClick={handleCanvasClick}
                  className={isCustomFocus || isCustomPath ? 'block cursor-crosshair' : 'block cursor-default'}
                  aria-label="Motion preview canvas"
                />
                {isRecording && (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/50 backdrop-blur-sm">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
                    <span className="font-medium tracking-wide text-white">Rendering Video</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center opacity-70">
                <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full border border-[#27272a] bg-[#18181b] shadow-inner">
                  <ImageIcon className="h-10 w-10 text-gray-600" aria-hidden="true" />
                </div>
                <h2 className="mb-2 text-2xl font-light text-gray-300">Motion Studio</h2>
                <p className="mx-auto max-w-sm text-gray-500">Upload media to start designing a camera move.</p>
              </div>
            )}
          </div>

          <div className="flex h-16 shrink-0 items-center gap-4 border-t border-[#27272a] bg-[#131316] px-4 lg:px-6">
            <button
              type="button"
              onClick={() => setIsPlaying((current) => !current)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-black transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!selectedMedia || isRecording}
              aria-label={isPlaying ? 'Pause preview' : 'Play preview'}
            >
              {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
            </button>
            <span className="w-12 text-right font-mono text-xs text-gray-400">{(progress * totalDuration).toFixed(1)}s</span>
            <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-[#27272a]">
              <div className="absolute left-0 top-0 h-full rounded-full bg-indigo-500" style={{ width: `${progress * 100}%` }} />
            </div>
            <span className="w-12 font-mono text-xs text-gray-400">{totalDuration.toFixed(1)}s</span>
          </div>
        </main>

        <aside className="w-full border-t border-[#27272a] bg-[#131316] lg:w-96 lg:shrink-0 lg:border-l lg:border-t-0">
          <div className="flex items-center gap-2 border-b border-[#27272a] p-4 lg:p-6">
            <Settings2 size={18} aria-hidden="true" />
            <h2 className="font-semibold text-gray-200">Configuration</h2>
          </div>

          <div className="max-h-[70vh] space-y-7 overflow-y-auto p-4 lg:max-h-none lg:p-6">
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-400">{isCustomPath ? 'Path Duration' : 'Duration'}</h3>
                <span className="rounded bg-indigo-400/10 px-2 py-0.5 font-mono text-xs text-indigo-400">{totalDuration.toFixed(1)}s</span>
              </div>
              <input
                type="range"
                min="2"
                max="20"
                step="0.5"
                value={isCustomPath ? Math.min(20, keyframeDuration) : exportSettings.duration}
                onChange={(event) => updateExportSettings({ duration: Number(event.target.value) })}
                disabled={isCustomPath}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-[#27272a] accent-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Export duration"
              />
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-400">Transition Time</h3>
                <span className="rounded bg-indigo-400/10 px-2 py-0.5 font-mono text-xs text-indigo-400">{config.travelTime.toFixed(1)}s</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="4"
                step="0.1"
                value={config.travelTime}
                onChange={(event) => setConfig((current) => ({ ...current, travelTime: Number(event.target.value) }))}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-[#27272a] accent-indigo-500"
                aria-label="Transition time"
              />
            </section>

            {!isCustomPath && (
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-400">Effect Speed</h3>
                  <span className="rounded bg-indigo-400/10 px-2 py-0.5 font-mono text-xs text-indigo-400">
                    {config.playbackSpeed.toFixed(1)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="3"
                  step="0.1"
                  value={config.playbackSpeed}
                  onChange={(event) => setConfig((current) => ({ ...current, playbackSpeed: Number(event.target.value) }))}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-[#27272a] accent-indigo-500"
                  aria-label="Effect speed"
                />
              </section>
            )}

            {isCustomPath && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-300">Keyframes</h3>
                  <div className="flex gap-2">
                    <Button variant={pathMode === 'add' ? 'primary' : 'secondary'} className="px-2 py-1 text-xs" onClick={() => setPathMode('add')}>
                      Add
                    </Button>
                    <Button variant={pathMode === 'move' ? 'primary' : 'secondary'} className="px-2 py-1 text-xs" onClick={() => setPathMode('move')}>
                      Move
                    </Button>
                    <Button variant="secondary" className="px-2 py-1 text-xs" onClick={() => addKeyframe()} icon={<Plus size={12} />}>
                      Point
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  {keyframes.map((keyframe, index) => (
                    <button
                      type="button"
                      key={keyframe.id}
                      onClick={() => setSelectedKeyframeId(keyframe.id)}
                      className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left transition ${
                        selectedKeyframeId === keyframe.id
                          ? 'border-indigo-500/60 bg-indigo-500/10'
                          : 'border-[#27272a] bg-[#18181b] hover:border-[#3f3f46]'
                      }`}
                      aria-pressed={selectedKeyframeId === keyframe.id}
                    >
                      <span className="text-sm text-gray-200">Keyframe {index + 1}</span>
                      <span className="font-mono text-xs text-gray-500">
                        {(keyframe.x * 100).toFixed(0)} / {(keyframe.y * 100).toFixed(0)}
                      </span>
                    </button>
                  ))}
                </div>

                {selectedKeyframe && (
                  <div className="space-y-4 rounded-lg border border-[#27272a] bg-[#18181b] p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-300">Selected Keyframe</span>
                      <button
                        type="button"
                        onClick={deleteSelectedKeyframe}
                        disabled={keyframes.length <= 1}
                        className="rounded-md p-1.5 text-gray-400 hover:bg-red-500/10 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label="Delete selected keyframe"
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    </div>

                    <label className="block text-xs font-medium text-gray-500">
                      X Position
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={selectedKeyframe.x}
                        onChange={(event) => updateSelectedKeyframe({ x: Number(event.target.value) })}
                        className="mt-2 h-1.5 w-full appearance-none rounded-lg bg-[#27272a] accent-indigo-500"
                      />
                    </label>
                    <label className="block text-xs font-medium text-gray-500">
                      Y Position
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.01"
                        value={selectedKeyframe.y}
                        onChange={(event) => updateSelectedKeyframe({ y: Number(event.target.value) })}
                        className="mt-2 h-1.5 w-full appearance-none rounded-lg bg-[#27272a] accent-indigo-500"
                      />
                    </label>
                    <label className="block text-xs font-medium text-gray-500">
                      Zoom {selectedKeyframe.zoom.toFixed(2)}x
                      <input
                        type="range"
                        min="1"
                        max="4"
                        step="0.05"
                        value={selectedKeyframe.zoom}
                        onChange={(event) => updateSelectedKeyframe({ zoom: Number(event.target.value) })}
                        className="mt-2 h-1.5 w-full appearance-none rounded-lg bg-[#27272a] accent-indigo-500"
                      />
                    </label>
                    <label className="block text-xs font-medium text-gray-500">
                      Hold Delay {selectedKeyframe.delay.toFixed(1)}s
                      <input
                        type="range"
                        min="0"
                        max="4"
                        step="0.1"
                        value={selectedKeyframe.delay}
                        onChange={(event) => updateSelectedKeyframe({ delay: Number(event.target.value) })}
                        className="mt-2 h-1.5 w-full appearance-none rounded-lg bg-[#27272a] accent-indigo-500"
                      />
                    </label>
                    <label className="block text-xs font-medium text-gray-500">
                      Easing
                      <select
                        value={selectedKeyframe.easing}
                        onChange={(event) => updateSelectedKeyframe({ easing: event.target.value as EasingMode })}
                        className="mt-2 w-full rounded-md border border-[#27272a] bg-[#09090b] px-3 py-2 text-sm text-gray-200"
                      >
                        {EASING_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
              </section>
            )}

            {isCustomFocus && (
              <div className="rounded-lg border border-indigo-500/10 bg-indigo-500/5 p-4">
                <div className="flex items-start gap-3">
                  <MousePointerClick className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" aria-hidden="true" />
                  <p className="text-xs leading-relaxed text-gray-400">{focusPoint ? 'Focus point selected.' : 'Click the preview to set the focus point.'}</p>
                </div>
              </div>
            )}

            <section className="space-y-4">
              <h3 className="text-sm font-medium text-gray-300">Export Settings</h3>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-medium text-gray-500">
                  Format
                  <select
                    value={exportSettings.format}
                    onChange={(event) => updateExportSettings({ format: event.target.value as ExportFormat })}
                    className="mt-2 w-full rounded-md border border-[#27272a] bg-[#09090b] px-3 py-2 text-sm text-gray-200"
                  >
                    <option value="webm">WebM</option>
                    <option value="mp4">MP4</option>
                  </select>
                </label>
                <label className="text-xs font-medium text-gray-500">
                  FPS
                  <select
                    value={exportSettings.fps}
                    onChange={(event) => updateExportSettings({ fps: Number(event.target.value) })}
                    className="mt-2 w-full rounded-md border border-[#27272a] bg-[#09090b] px-3 py-2 text-sm text-gray-200"
                  >
                    <option value={24}>24</option>
                    <option value={30}>30</option>
                    <option value={60}>60</option>
                  </select>
                </label>
              </div>
              <label className="block text-xs font-medium text-gray-500">
                Resolution {Math.round(exportSettings.resolutionScale * 100)}%
                <input
                  type="range"
                  min="0.25"
                  max="1"
                  step="0.25"
                  value={exportSettings.resolutionScale}
                  onChange={(event) => updateExportSettings({ resolutionScale: Number(event.target.value) })}
                  className="mt-2 h-1.5 w-full appearance-none rounded-lg bg-[#27272a] accent-indigo-500"
                />
              </label>
              <label className="block text-xs font-medium text-gray-500">
                Quality {Math.round(exportSettings.quality * 100)}%
                <input
                  type="range"
                  min="0.2"
                  max="1"
                  step="0.05"
                  value={exportSettings.quality}
                  onChange={(event) => updateExportSettings({ quality: Number(event.target.value) })}
                  className="mt-2 h-1.5 w-full appearance-none rounded-lg bg-[#27272a] accent-indigo-500"
                />
              </label>
              <label className="flex items-center gap-3 rounded-lg border border-[#27272a] bg-[#18181b] p-3 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={exportSettings.transparent}
                  onChange={(event) => updateExportSettings({ transparent: event.target.checked })}
                  className="h-4 w-4 accent-indigo-500"
                />
                Transparent background
              </label>
              <div className="rounded-lg border border-indigo-500/10 bg-indigo-500/5 p-4">
                <div className="flex items-start gap-3">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" aria-hidden="true" />
                  <p className="text-[11px] leading-relaxed text-gray-400">
                    MP4 export appears only when the browser supports MP4 recording. WebM is the most reliable browser format.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default App;
