
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

export interface MotionConfig {
  presetId: string;
  duration: number;
  travelTime: number;
  delayTime: number;
  playbackSpeed: number;
}
