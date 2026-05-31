
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Upload, Download, Play, Pause, Settings2, Image as ImageIcon, X, Film, Info, MousePointerClick } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { Button } from './components/Button';
import { MotionCard } from './components/MotionCard';
import { MOTION_PRESETS } from './constants';
import { MotionConfig } from './types';
import { renderFrame } from './services/motionService';

const App: React.FC = () => {
  // State
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);
  const [mediaElement, setMediaElement] = useState<HTMLImageElement | HTMLVideoElement | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [progress, setProgress] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  
  // Single Focus Point
  const [focusPoint, setFocusPoint] = useState<{ x: number, y: number } | null>(null);
  
  // Configuration State
  const [config, setConfig] = useState<MotionConfig>({
    presetId: MOTION_PRESETS[0].id,
    duration: 5.0,   // Default for standard presets
    travelTime: 2.0, // Default 2s move time
    delayTime: 1.0,  // Default 1s stop time
    playbackSpeed: 1.0, // Default 1.0x playback speed
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Load Media Object
  useEffect(() => {
    if (selectedMedia) {
      if (mediaType === 'video') {
        const vid = document.createElement('video');
        vid.src = selectedMedia;
        vid.loop = true;
        vid.muted = true;
        vid.playsInline = true;
        vid.crossOrigin = "anonymous";
        vid.onloadedmetadata = () => {
          vid.play();
          setMediaElement(vid);
          setIsPlaying(true);
        };
        vid.onerror = () => toast.error("Failed to load video");
      } else {
        const img = new Image();
        img.src = selectedMedia;
        img.onload = () => {
          setMediaElement(img);
          setIsPlaying(true);
        };
        img.onerror = () => toast.error("Failed to load image");
      }
    } else {
      setMediaElement(null);
    }
  }, [selectedMedia, mediaType]);

  // Reset points when changing preset mode if switching away from custom modes
  useEffect(() => {
    const isCustomMode = ['custom-focus'].includes(config.presetId);
    
    // Auto-pause when switching to custom modes to allow editing
    if (isCustomMode && selectedMedia) {
        setIsPlaying(false);
    } else if (selectedMedia) {
        setIsPlaying(true);
    }
  }, [config.presetId, selectedMedia]);

  // Determine if we are in a multi-point editing mode
  const isSinglePointMode = config.presetId === 'custom-focus';

  // Calculate Total Duration Dynamically based on playback speed
  const totalDuration = useMemo(() => {
      // Modify duration by playback speed so motion is faster or slower
      return config.duration / config.playbackSpeed;
  }, [config.duration, config.playbackSpeed]);

  // Calculate dynamic preset based on config and custom points
  const getActivePreset = useCallback(() => {
    const basePreset = MOTION_PRESETS.find(p => p.id === config.presetId);
    if (!basePreset) return null;

    if (isSinglePointMode && focusPoint) {
        return {
            ...basePreset,
            params: {
                ...basePreset.params,
                zoomStart: 1.0,
                zoomEnd: 1.5,
                panXStart: 0.5,
                panXEnd: focusPoint.x,
                panYStart: 0.5,
                panYEnd: focusPoint.y,
            }
        };
    }

    return basePreset;
  }, [config.presetId, focusPoint, isSinglePointMode]);

  // Animation Loop for Preview
  const animate = useCallback(function animateFrame(time: number) {
    if (!isPlaying && !isSinglePointMode) {
        startTimeRef.current = null;
        return; 
    }

    if (!startTimeRef.current) startTimeRef.current = time;
    const elapsed = (time - startTimeRef.current) / 1000; // seconds
    
    // Loop
    const t = isPlaying ? (elapsed % totalDuration) / totalDuration : 0;
    setProgress(t);

    if (canvasRef.current && mediaElement) {
        const ctx = canvasRef.current.getContext('2d');
        const preset = getActivePreset();
        
        if (ctx && preset) {
            // Set canvas size based on IMAGE aspect ratio (Automatic)
            // Use the outer container to determine available space, subtracting padding (p-8 = 32px * 2 = 64px)
            const containerHeight = containerRef.current?.clientHeight || 600;
            const containerWidth = containerRef.current?.clientWidth || 400;
            
            const availableWidth = Math.max(100, containerWidth - 64);
            const availableHeight = Math.max(100, containerHeight - 64);
            
            let targetRatio = 16/9; // Default if no image
            let mediaW = 1920;
            let mediaH = 1080;
            if (mediaElement) {
                mediaW = mediaElement instanceof HTMLVideoElement ? mediaElement.videoWidth : mediaElement.naturalWidth;
                mediaH = mediaElement instanceof HTMLVideoElement ? mediaElement.videoHeight : mediaElement.naturalHeight;
                targetRatio = (mediaW && mediaH) ? (mediaW / mediaH) : (16/9);
            }

            // Calculate dimensions to fit container while maintaining target ratio EXACTLY
            let width = availableWidth;
            let height = availableHeight;
            
            if (width / height > targetRatio) {
                 // Container is wider than needed, restrict by height
                 width = height * targetRatio;
            } else {
                 // Container is taller than needed, restrict by width
                 height = width / targetRatio;
            }

            // Snap to exact pixels to prevent any sub-pixel distortion
            width = Math.floor(width);
            height = Math.floor(width / targetRatio);

            // High DPI scaling
            const dpr = window.devicePixelRatio || 1;
            canvasRef.current.width = Math.floor(width * dpr);
            canvasRef.current.height = Math.floor(height * dpr);
            canvasRef.current.style.width = `${width}px`;
            canvasRef.current.style.height = `${height}px`;
            ctx.scale(dpr, dpr);

            // RENDER LOGIC SWITCH
            const isEditMode = isSinglePointMode && !isPlaying;

            if (isEditMode) {
                // EDIT MODE: Render FULL Image (Contain)
                ctx.fillStyle = '#09090b';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(mediaElement, 0, 0, width, height);

                if (isSinglePointMode && focusPoint) {
                   const markerX = focusPoint.x * width;
                   const markerY = focusPoint.y * height;

                   ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
                   ctx.lineWidth = 2;
                   ctx.shadowColor = 'black';
                   ctx.shadowBlur = 4;
                   ctx.beginPath();
                   ctx.arc(markerX, markerY, 8, 0, Math.PI * 2);
                   ctx.moveTo(markerX - 12, markerY);
                   ctx.lineTo(markerX + 12, markerY);
                   ctx.moveTo(markerX, markerY - 12);
                   ctx.lineTo(markerX, markerY + 12);
                   ctx.stroke();
                   ctx.shadowBlur = 0;
                }
            } else {
                // PLAYBACK MODE: Use renderFrame
                // Pass dynamic timing parameters
                renderFrame(
                    ctx, 
                    mediaElement, 
                    t, 
                    preset, 
                    width, 
                    height,
                    config.travelTime,
                    config.delayTime,
                    totalDuration
                );
            }
        }
    }

    if (isPlaying || (!isPlaying && isSinglePointMode)) {
        // Use a functional update to avoid the dependency issue
        requestRef.current = requestAnimationFrame(animateFrame);
    }
  }, [mediaElement, isPlaying, getActivePreset, focusPoint, isSinglePointMode, totalDuration, config.travelTime, config.delayTime]);

  useEffect(() => {
    // Kickstart animation loop when needed
    if ((isPlaying || (!isPlaying && isSinglePointMode)) && mediaElement) {
        requestRef.current = requestAnimationFrame(animate);
    }
    return () => {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
        startTimeRef.current = null;
    };
  }, [isPlaying, animate, mediaElement, isSinglePointMode]);

  useEffect(() => {
    if (mediaElement instanceof HTMLVideoElement) {
      mediaElement.playbackRate = config.playbackSpeed;
      if (isPlaying || isRecording) {
        mediaElement.play().catch(e => console.error("Video play failed:", e));
      } else {
        mediaElement.pause();
      }
    }
  }, [isPlaying, isRecording, mediaElement, config.playbackSpeed]);

  // Handle window resize to keep canvas responsive even when paused
  useEffect(() => {
    const handleResize = () => {
      if (!isPlaying && !isSinglePointMode && mediaElement) {
        requestAnimationFrame(animate);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isPlaying, isSinglePointMode, mediaElement, animate]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (selectedMedia && !isRecording) {
          setIsPlaying(prev => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedMedia, isRecording]);

  // Handlers
  const handleFile = (file: File) => {
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    
    if (!isVideo && !isImage) {
      toast.error('Please drop a valid image or video file');
      return;
    }

    const url = URL.createObjectURL(file);
    setSelectedMedia(url);
    setMediaType(isVideo ? 'video' : 'image');
    setFocusPoint(null);
    toast.success(`${isVideo ? 'Video' : 'Image'} loaded successfully`);
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type.startsWith('image/') || file.type.startsWith('video/'))) {
      handleFile(file);
    } else {
      toast.error('Please drop a valid image or video file');
    }
  };

  const clearImage = () => {
    setSelectedMedia(null);
    setMediaElement(null);
    setMediaType(null);
    setFocusPoint(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !mediaElement) return;
    
    // Only allow clicking in custom modes
    if (!isSinglePointMode) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const width = rect.width;
    const height = rect.height;

    // Normalization (0-1)
    const normalizedX = x / width;
    const normalizedY = y / height;

    // Clamp to image bounds
    if (normalizedX >= 0 && normalizedX <= 1 && normalizedY >= 0 && normalizedY <= 1) {
        if (isSinglePointMode) {
            setFocusPoint({ x: normalizedX, y: normalizedY });
        }
    }
    setIsPlaying(false);
  };

  // Handle Preset Switching with Intelligent Defaults
  const handlePresetSelect = (presetId: string) => {
      // Reset to standard defaults for other presets (including custom-focus)
      setConfig(prev => ({ 
          ...prev, 
          presetId,
          duration: 5.0 // Reset standard duration
      }));
  };

  const handleExport = async () => {
    if (!canvasRef.current || !mediaElement) return;
    
    setIsRecording(true);
    setIsPlaying(false); // Stop preview loop
    if (requestRef.current) cancelAnimationFrame(requestRef.current);

    toast.loading('Rendering video...', { id: 'export-toast' });

    // Create an off-screen canvas that perfectly matches the native material size
    const nativeW = mediaElement instanceof HTMLVideoElement ? mediaElement.videoWidth : mediaElement.naturalWidth;
    const nativeH = mediaElement instanceof HTMLVideoElement ? mediaElement.videoHeight : mediaElement.naturalHeight;
    
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = nativeW;
    exportCanvas.height = nativeH;
    const exportCtx = exportCanvas.getContext('2d');
    
    if (!exportCtx) {
        toast.error("Failed to initialize export renderer", { id: 'export-toast' });
        setIsRecording(false);
        return;
    }

    const stream = exportCanvas.captureStream(60); // 60 FPS
    const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
    const chunks: Blob[] = [];

    mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `motioncraft-${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
        setIsRecording(false);
        setIsPlaying(true); // Resume preview
        toast.success('Export complete!', { id: 'export-toast' });
        
        // Ensure video is reset to its correct speed when done sharing
        if (mediaElement instanceof HTMLVideoElement) {
             mediaElement.playbackRate = config.playbackSpeed;
        }
    };

    mediaRecorder.start();

    // Render loop specifically for recording
    const fps = 60;
    const framesToRender = totalDuration * fps;
    const preset = getActivePreset();
    
    if (!preset) {
        setIsRecording(false);
        toast.dismiss('export-toast');
        return;
    }

    const recordLoop = async () => {
        if (mediaElement instanceof HTMLVideoElement) {
            mediaElement.currentTime = 0;
            mediaElement.playbackRate = config.playbackSpeed;
            mediaElement.play().catch(e => console.error("Video play failed:", e));
        }
        for (let i = 0; i <= framesToRender; i++) {
            const t = i / framesToRender;
            renderFrame(
                exportCtx, 
                mediaElement, 
                t, 
                preset, 
                nativeW, 
                nativeH, 
                config.travelTime, 
                config.delayTime, 
                totalDuration
            );
            await new Promise(r => setTimeout(r, 1000/fps));
        }
        if (mediaElement instanceof HTMLVideoElement) {
            mediaElement.pause();
        }
        mediaRecorder.stop();
    };

    recordLoop();
  };

  // UI Render
  return (
    <div className="flex flex-col h-screen w-full bg-[#0f0f11] overflow-hidden text-gray-100 font-sans">
      <Toaster theme="dark" position="bottom-right" />
      
      {/* Top Navigation Bar */}
      <header className="h-14 border-b border-[#27272a] bg-[#131316] flex items-center justify-between px-6 shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Film className="text-white w-4 h-4" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight leading-none">MotionCraft</h1>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-0.5">Professional Camera Motion</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
            <Button 
              variant="primary" 
              className="py-1.5 px-4 text-sm bg-white text-black hover:bg-gray-200 border-0 shadow-lg shadow-white/5"
              onClick={handleExport}
              isLoading={isRecording}
              disabled={!selectedMedia || isRecording}
              icon={<Download size={14} />}
            >
              {isRecording ? 'Rendering...' : 'Export MP4'}
            </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* 1. Left Sidebar: Assets & Presets */}
        <aside className="w-80 flex flex-col border-r border-[#27272a] bg-[#131316] shrink-0">
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="space-y-4">
               <label className="block">
               <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 block">Source Asset</span>
               {!selectedMedia ? (
                 <div 
                   onClick={() => fileInputRef.current?.click()}
                   onDragOver={handleDragOver}
                   onDragLeave={handleDragLeave}
                   onDrop={handleDrop}
                   className={`h-48 w-full border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all group ${isDragging ? 'border-indigo-500 bg-indigo-500/10' : 'border-[#27272a] hover:border-indigo-500/50 hover:bg-[#18181b]'}`}
                 >
                   <div className="w-12 h-12 rounded-full bg-[#18181b] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                     <Upload className={`w-6 h-6 ${isDragging ? 'text-indigo-400' : 'text-gray-400 group-hover:text-indigo-400'}`} />
                   </div>
                   <span className="text-sm text-gray-400 font-medium">{isDragging ? 'Drop media here' : 'Click or drag to upload'}</span>
                   <span className="text-xs text-gray-600 mt-1">Image or Video</span>
                 </div>
               ) : (
                 <div className="relative group rounded-xl overflow-hidden border border-[#27272a] bg-black">
                    {mediaType === 'video' ? (
                      <video src={selectedMedia} className="w-full h-48 object-contain" autoPlay loop muted playsInline />
                    ) : (
                      <img src={selectedMedia} alt="Input" className="w-full h-48 object-contain" />
                    )}
                    <button 
                      onClick={clearImage}
                      className="absolute top-2 right-2 p-1.5 bg-black/60 backdrop-blur-md rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80"
                    >
                      <X size={16} />
                    </button>
                    <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded text-[10px] text-gray-300">
                        {mediaElement ? `${mediaElement instanceof HTMLVideoElement ? mediaElement.videoWidth : mediaElement.naturalWidth} x ${mediaElement instanceof HTMLVideoElement ? mediaElement.videoHeight : mediaElement.naturalHeight}` : 'Loading...'}
                    </div>
                 </div>
               )}
               <input 
                 type="file" 
                 ref={fileInputRef} 
                 className="hidden" 
                 accept="image/*,video/*" 
                 onChange={handleImageUpload} 
               />
             </label>

             <div className="mt-8">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Motion Style</h3>
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
            </div>
          </div>
        </div>
      </aside>

        {/* 2. Main Area: Canvas Preview & Timeline */}
        <main className="flex-1 flex flex-col bg-[#09090b] relative min-w-0">
          
          {/* Instructions / Toasts (Moved to top center) */}
          {selectedMedia && isSinglePointMode && (
               <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 animate-in fade-in slide-in-from-top-4 w-full max-w-sm pointer-events-none">
                   
                   <div className="pointer-events-auto flex items-center gap-3 bg-[#18181b]/90 border border-[#27272a] text-white px-4 py-2 rounded-full shadow-2xl backdrop-blur-md">
                      <MousePointerClick size={16} className="text-indigo-400" />
                      <span className="text-xs font-medium min-w-[80px] text-center">
                          {focusPoint ? "Point selected" : "Click to set focus"}
                      </span>
                   </div>
               </div>
          )}

          {/* Canvas Area */}
          <div ref={containerRef} className="flex-1 flex items-center justify-center p-8 overflow-hidden relative">
            
            {selectedMedia ? (
               <div className="relative shadow-2xl shadow-black/50 border border-[#27272a] rounded-sm overflow-hidden bg-black group flex items-center justify-center">
                  <canvas 
                      ref={canvasRef}
                      onClick={handleCanvasClick}
                      className={`block ${isSinglePointMode ? 'cursor-crosshair' : 'cursor-default'}`}
                  />
                  {isRecording && (
                      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center flex-col gap-3 z-30">
                          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-white font-medium tracking-wide">Rendering Video...</span>
                      </div>
                  )}
               </div>
            ) : (
              <div className="text-center opacity-60">
                <div className="w-24 h-24 bg-[#18181b] rounded-full flex items-center justify-center mx-auto mb-6 border border-[#27272a] shadow-inner">
                  <ImageIcon className="text-gray-600 w-10 h-10" />
                </div>
                <h2 className="text-2xl font-light text-gray-300 mb-2">Motion Studio</h2>
                <p className="text-gray-500 max-w-sm mx-auto">Upload an image or video to start designing cinematic motion effects.</p>
              </div>
            )}
          </div>

          {/* Bottom Player Controls (Timeline) */}
          <div className="h-16 border-t border-[#27272a] bg-[#131316] flex items-center px-6 gap-6 shrink-0">
              <button 
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-white text-black hover:bg-gray-200 transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!selectedMedia || isRecording}
              >
                  {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
              </button>
              
              <div className="flex-1 flex items-center gap-4">
                  <span className="text-xs font-mono text-gray-400 w-12 text-right">
                      {(progress * totalDuration).toFixed(1)}s
                  </span>
                  
                  <div className="flex-1 h-2 bg-[#27272a] rounded-full relative overflow-hidden">
                      <div 
                          className="absolute top-0 left-0 h-full bg-indigo-500 rounded-full transition-all duration-75 ease-linear"
                          style={{ width: `${progress * 100}%` }}
                      />
                  </div>
                  
                  <span className="text-xs font-mono text-gray-400 w-12">
                      {totalDuration.toFixed(1)}s
                  </span>
              </div>
          </div>
        </main>

        {/* 3. Right Sidebar: Fine Tuning */}
        <aside className="w-80 bg-[#131316] border-l border-[#27272a] flex flex-col shrink-0">
        <div className="p-6 border-b border-[#27272a]">
          <h2 className="font-semibold text-gray-200 flex items-center gap-2">
            <Settings2 size={18} />
            Configuration
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
            {/* Duration Control for Standard Presets */}
            <section>
                 <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-400">Duration</h3>
                    <span className="text-xs font-mono text-indigo-400 bg-indigo-400/10 px-2 py-0.5 rounded">
                        {config.duration}s
                    </span>
                 </div>
                 <input 
                    type="range" 
                    min="2" 
                    max="10" 
                    step="0.5" 
                    value={config.duration}
                    onChange={(e) => setConfig(prev => ({ ...prev, duration: parseFloat(e.target.value) }))}
                    className="w-full accent-indigo-500 h-1.5 bg-[#27272a] rounded-lg appearance-none cursor-pointer"
                 />
                 <div className="flex justify-between mt-2 text-[10px] text-gray-600">
                    <span>Fast (2s)</span>
                    <span>Slow (10s)</span>
                 </div>
            </section>

            {/* Playback Speed Control */}
            <section>
                 <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-400">Effect Speed</h3>
                    <span className="text-xs font-mono text-indigo-400 bg-indigo-400/10 px-2 py-0.5 rounded">
                        {config.playbackSpeed.toFixed(1)}x
                    </span>
                 </div>
                 <input 
                    type="range" 
                    min="0.2" 
                    max="3.0" 
                    step="0.1" 
                    value={config.playbackSpeed}
                    onChange={(e) => setConfig(prev => ({ ...prev, playbackSpeed: parseFloat(e.target.value) }))}
                    className="w-full accent-indigo-500 h-1.5 bg-[#27272a] rounded-lg appearance-none cursor-pointer"
                 />
                 <div className="flex justify-between mt-2 text-[10px] text-gray-600">
                    <span>0.2x</span>
                    <span>3.0x</span>
                 </div>
            </section>

          <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-xl">
             <div className="flex items-start gap-3">
                <Info className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
                <p className="text-[11px] text-gray-400 leading-relaxed">
                    This tool renders motion natively. It scales to the exact original resolution and aspect ratio of your uploaded material.
                </p>
             </div>
          </div>
        </div>

        {/* Footer Actions (Removed as Export is now in Top Nav) */}
      </aside>

      </div>
    </div>
  );
};

export default App;
