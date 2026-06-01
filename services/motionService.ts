import { EasingMode, MotionKeyframe, MotionPreset } from '../types';

interface CameraFrame {
  x: number;
  y: number;
  zoom: number;
}

interface RenderOptions {
  keyframes?: MotionKeyframe[];
  transparent?: boolean;
  background?: string;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

const lerp = (start: number, end: number, t: number) => start * (1 - t) + end * t;

export const applyEasing = (mode: EasingMode, t: number) => {
  const safeT = clamp(t, 0, 1);

  switch (mode) {
    case 'ease-in':
      return safeT * safeT;
    case 'ease-out':
      return 1 - Math.pow(1 - safeT, 2);
    case 'ease-in-out':
      return safeT < 0.5 ? 2 * safeT * safeT : 1 - Math.pow(-2 * safeT + 2, 2) / 2;
    case 'smoothstep':
      return safeT * safeT * (3 - 2 * safeT);
    case 'linear':
    default:
      return safeT;
  }
};

export const getKeyframeDuration = (keyframes: MotionKeyframe[], travelTime: number) => {
  if (keyframes.length <= 1) return Math.max(1, keyframes[0]?.delay ?? 1);
  const holdTime = keyframes.reduce((total, keyframe) => total + keyframe.delay, 0);
  return holdTime + (keyframes.length - 1) * travelTime;
};

const getSplinePoint = (
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  t: number
) => {
  const v0x = (p2.x - p0.x) * 0.5;
  const v0y = (p2.y - p0.y) * 0.5;
  const v1x = (p3.x - p1.x) * 0.5;
  const v1y = (p3.y - p1.y) * 0.5;
  const t2 = t * t;
  const t3 = t * t2;

  return {
    x: (2 * p1.x - 2 * p2.x + v0x + v1x) * t3 + (-3 * p1.x + 3 * p2.x - 2 * v0x - v1x) * t2 + v0x * t + p1.x,
    y: (2 * p1.y - 2 * p2.y + v0y + v1y) * t3 + (-3 * p1.y + 3 * p2.y - 2 * v0y - v1y) * t2 + v0y * t + p1.y
  };
};

const getCameraFromKeyframes = (
  keyframes: MotionKeyframe[],
  progress: number,
  travelTime: number,
  totalDuration: number
): CameraFrame => {
  if (keyframes.length === 0) return { x: 0.5, y: 0.5, zoom: 1 };
  if (keyframes.length === 1) {
    const [keyframe] = keyframes;
    return { x: keyframe.x, y: keyframe.y, zoom: keyframe.zoom };
  }

  const elapsed = progress * totalDuration;
  let cursor = 0;

  for (let index = 0; index < keyframes.length; index += 1) {
    const current = keyframes[index];
    const next = keyframes[index + 1];

    if (elapsed <= cursor + current.delay) {
      return { x: current.x, y: current.y, zoom: current.zoom };
    }

    cursor += current.delay;

    if (next && elapsed <= cursor + travelTime) {
      const localProgress = (elapsed - cursor) / travelTime;
      const eased = applyEasing(next.easing, localProgress);
      return {
        x: lerp(current.x, next.x, eased),
        y: lerp(current.y, next.y, eased),
        zoom: lerp(current.zoom, next.zoom, eased)
      };
    }

    cursor += travelTime;
  }

  const last = keyframes[keyframes.length - 1];
  return { x: last.x, y: last.y, zoom: last.zoom };
};

const getCameraFromPreset = (
  preset: MotionPreset,
  progress: number,
  travelTime: number,
  delayTime: number,
  totalDuration: number
): CameraFrame => {
  const { params } = preset;
  let x = 0.5;
  let y = 0.5;
  const zoom = lerp(params.zoomStart, params.zoomEnd, progress);

  if (params.path && params.path.length > 0) {
    const points = params.path;
    const loop = params.pathLoop || false;

    if (points.length === 1) {
      x = points[0].x;
      y = points[0].y;
      return { x, y, zoom };
    }

    const segments = loop ? points.length : points.length - 1;
    const elapsed = progress * totalDuration;
    let cursor = 0;
    let index = 0;
    let localT = 0;

    for (let i = 0; i < points.length; i += 1) {
      if (elapsed < cursor + delayTime) {
        index = i;
        localT = 0;
        break;
      }

      cursor += delayTime;

      if (i < segments) {
        if (elapsed < cursor + travelTime) {
          index = i;
          localT = applyEasing('smoothstep', (elapsed - cursor) / travelTime);
          break;
        }
        cursor += travelTime;
      }

      if (i === points.length - 1) {
        index = loop ? points.length - 1 : points.length - 1;
        localT = loop ? 1 : 0;
      }
    }

    const getPoint = (i: number) => points[(i + points.length) % points.length];
    const p0 = loop ? getPoint(index - 1) : points[Math.max(0, index - 1)];
    const p1 = loop ? getPoint(index) : points[Math.min(index, points.length - 1)];
    const p2 = loop ? getPoint(index + 1) : points[Math.min(index + 1, points.length - 1)];
    const p3 = loop ? getPoint(index + 2) : points[Math.min(index + 2, points.length - 1)];
    const position = getSplinePoint(p0, p1, p2, p3, localT);

    return { x: position.x, y: position.y, zoom };
  }

  const minX = 1 / (2 * zoom);
  const maxX = 1 - minX;
  const minY = 1 / (2 * zoom);
  const maxY = 1 - minY;

  if (zoom <= 1) {
    return { x: 0.5, y: 0.5, zoom };
  }

  x = minX + lerp(params.panXStart, params.panXEnd, progress) * (maxX - minX);
  y = minY + lerp(params.panYStart, params.panYEnd, progress) * (maxY - minY);

  return { x, y, zoom };
};

export const renderFrame = (
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | HTMLVideoElement,
  progress: number,
  preset: MotionPreset,
  canvasW: number,
  canvasH: number,
  travelTime: number,
  delayTime: number,
  totalDuration: number,
  options: RenderOptions = {}
) => {
  const imgW = image instanceof HTMLVideoElement ? image.videoWidth : image.naturalWidth;
  const imgH = image instanceof HTMLVideoElement ? image.videoHeight : image.naturalHeight;

  if (!imgW || !imgH || !canvasW || !canvasH) return;

  if (options.transparent) {
    ctx.clearRect(0, 0, canvasW, canvasH);
  } else {
    ctx.fillStyle = options.background ?? '#09090b';
    ctx.fillRect(0, 0, canvasW, canvasH);
  }

  const camera = options.keyframes?.length
    ? getCameraFromKeyframes(options.keyframes, progress, travelTime, totalDuration)
    : getCameraFromPreset(preset, progress, travelTime, delayTime, totalDuration);

  const imgAR = imgW / imgH;
  const canvasAR = canvasW / canvasH;
  const coverScale = imgAR > canvasAR ? canvasH / imgH : canvasW / imgW;
  const effectiveScale = coverScale * Math.max(camera.zoom, 1);
  const srcCropW = canvasW / effectiveScale;
  const srcCropH = canvasH / effectiveScale;

  const maxSrcX = Math.max(0, imgW - srcCropW);
  const maxSrcY = Math.max(0, imgH - srcCropH);
  const srcX = clamp(camera.x * imgW - srcCropW / 2, 0, maxSrcX);
  const srcY = clamp(camera.y * imgH - srcCropH / 2, 0, maxSrcY);

  ctx.drawImage(image, srcX, srcY, srcCropW, srcCropH, 0, 0, canvasW, canvasH);
};
