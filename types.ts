
export interface MotionPreset {
  id: string;
  label: string;
  description: string;
  icon: string;
  params: {
    zoomStart: number;
    zoomEnd: number;
    panXStart: number;
    panXEnd: number;
    panYStart: number;
    panYEnd: number;
    path?: { x: number; y: number }[];
    pathLoop?: boolean;
  };
}

export type EasingMode = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'smoothstep';

export interface MotionKeyframe {
  id: string;
  x: number;
  y: number;
  zoom: number;
  delay: number;
  easing: EasingMode;
}

export interface MotionConfig {
  presetId: string;
  duration: number;
  travelTime: number;
  delayTime: number;
  playbackSpeed: number;
}

export type ExportFormat = 'webm' | 'mp4';

export interface ExportSettings {
  format: ExportFormat;
  fps: number;
  resolutionScale: number;
  quality: number;
  duration: number;
  transparent: boolean;
}
