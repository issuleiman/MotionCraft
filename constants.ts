
import { MotionPreset } from './types';

export const MOTION_PRESETS: MotionPreset[] = [
  {
    id: 'zoom-in',
    label: 'Slow Zoom In',
    description: 'Cinematic push into the center',
    icon: 'ZoomIn',
    params: { zoomStart: 1, zoomEnd: 1.5, panXStart: 0.5, panXEnd: 0.5, panYStart: 0.5, panYEnd: 0.5 }
  },
  {
    id: 'zoom-out',
    label: 'Slow Zoom Out',
    description: 'Reveals context by pulling back',
    icon: 'ZoomOut',
    params: { zoomStart: 1.5, zoomEnd: 1, panXStart: 0.5, panXEnd: 0.5, panYStart: 0.5, panYEnd: 0.5 }
  },
  {
    id: 'pan-left',
    label: 'Pan Left',
    description: 'Horizontal slide from right to left',
    icon: 'ArrowLeft',
    params: { zoomStart: 1.2, zoomEnd: 1.2, panXStart: 1.0, panXEnd: 0.0, panYStart: 0.5, panYEnd: 0.5 }
  },
  {
    id: 'pan-right',
    label: 'Pan Right',
    description: 'Horizontal slide from left to right',
    icon: 'ArrowRight',
    params: { zoomStart: 1.2, zoomEnd: 1.2, panXStart: 0.0, panXEnd: 1.0, panYStart: 0.5, panYEnd: 0.5 }
  },
  {
    id: 'pan-up',
    label: 'Pan Up',
    description: 'Vertical slide upwards',
    icon: 'ArrowUp',
    params: { zoomStart: 1.2, zoomEnd: 1.2, panXStart: 0.5, panXEnd: 0.5, panYStart: 1.0, panYEnd: 0.0 }
  },
  {
    id: 'pan-down',
    label: 'Pan Down',
    description: 'Vertical slide downwards',
    icon: 'ArrowDown',
    params: { zoomStart: 1.2, zoomEnd: 1.2, panXStart: 0.5, panXEnd: 0.5, panYStart: 0.0, panYEnd: 1.0 }
  },
  {
    id: 'ken-burns',
    label: 'Ken Burns',
    description: 'Classic documentary pan and zoom',
    icon: 'ImagePlay',
    params: { zoomStart: 1.0, zoomEnd: 1.4, panXStart: 0.3, panXEnd: 0.7, panYStart: 0.3, panYEnd: 0.7 }
  },
  {
    id: 'diagonal-down',
    label: 'Diagonal Down',
    description: 'Top-left to bottom-right slide',
    icon: 'ArrowDownRight',
    params: { zoomStart: 1.3, zoomEnd: 1.3, panXStart: 0.1, panXEnd: 0.9, panYStart: 0.1, panYEnd: 0.9 }
  },
  {
    id: 'diagonal-up',
    label: 'Diagonal Up',
    description: 'Bottom-left to top-right slide',
    icon: 'ArrowUpRight',
    params: { zoomStart: 1.3, zoomEnd: 1.3, panXStart: 0.1, panXEnd: 0.9, panYStart: 0.9, panYEnd: 0.1 }
  },
  {
    id: 'zoom-pan-left',
    label: 'Zoom & Pan Left',
    description: 'Push in while sliding left',
    icon: 'MoveLeft',
    params: { zoomStart: 1.0, zoomEnd: 1.5, panXStart: 0.5, panXEnd: 0.1, panYStart: 0.5, panYEnd: 0.5 }
  },
  {
    id: 'zoom-pan-right',
    label: 'Zoom & Pan Right',
    description: 'Push in while sliding right',
    icon: 'MoveRight',
    params: { zoomStart: 1.0, zoomEnd: 1.5, panXStart: 0.5, panXEnd: 0.9, panYStart: 0.5, panYEnd: 0.5 }
  },
  {
    id: 'orbit',
    label: 'Orbit',
    description: 'Circular camera movement',
    icon: 'Repeat',
    params: { zoomStart: 1.4, zoomEnd: 1.4, panXStart: 0.5, panXEnd: 0.5, panYStart: 0.5, panYEnd: 0.5, path: [{x: 0.3, y: 0.3}, {x: 0.7, y: 0.3}, {x: 0.7, y: 0.7}, {x: 0.3, y: 0.7}], pathLoop: true }
  },
  {
    id: 'spiral-in',
    label: 'Spiral In',
    description: 'Orbit while zooming in',
    icon: 'Tornado',
    params: { zoomStart: 1.0, zoomEnd: 2.0, panXStart: 0.5, panXEnd: 0.5, panYStart: 0.5, panYEnd: 0.5, path: [{x: 0.5, y: 0.5}, {x: 0.6, y: 0.5}, {x: 0.6, y: 0.6}, {x: 0.4, y: 0.6}, {x: 0.4, y: 0.4}, {x: 0.5, y: 0.5}], pathLoop: false }
  },
  {
    id: 'zigzag',
    label: 'Zigzag',
    description: 'Back and forth movement',
    icon: 'Activity',
    params: { zoomStart: 1.3, zoomEnd: 1.3, panXStart: 0.5, panXEnd: 0.5, panYStart: 0.5, panYEnd: 0.5, path: [{x: 0.2, y: 0.2}, {x: 0.8, y: 0.4}, {x: 0.2, y: 0.6}, {x: 0.8, y: 0.8}], pathLoop: false }
  },
  {
    id: 'pan-corners',
    label: 'Pan Corners',
    description: 'Visit all four corners',
    icon: 'Maximize',
    params: { zoomStart: 1.5, zoomEnd: 1.5, panXStart: 0.5, panXEnd: 0.5, panYStart: 0.5, panYEnd: 0.5, path: [{x: 0.2, y: 0.2}, {x: 0.8, y: 0.2}, {x: 0.8, y: 0.8}, {x: 0.2, y: 0.8}], pathLoop: true }
  },
  {
    id: 'zoom-pan-up',
    label: 'Zoom & Pan Up',
    description: 'Push in while sliding up',
    icon: 'MoveUp',
    params: { zoomStart: 1.0, zoomEnd: 1.5, panXStart: 0.5, panXEnd: 0.5, panYStart: 0.5, panYEnd: 0.1 }
  },
  {
    id: 'zoom-pan-down',
    label: 'Zoom & Pan Down',
    description: 'Push in while sliding down',
    icon: 'MoveDown',
    params: { zoomStart: 1.0, zoomEnd: 1.5, panXStart: 0.5, panXEnd: 0.5, panYStart: 0.5, panYEnd: 0.9 }
  },
  {
    id: 'custom-focus',
    label: 'Custom Focus Point',
    description: 'Zoom in to a specific point',
    icon: 'MousePointerClick',
    params: { zoomStart: 1.0, zoomEnd: 1.5, panXStart: 0.5, panXEnd: 0.5, panYStart: 0.5, panYEnd: 0.5 }
  },
  {
    id: 'custom-path',
    label: 'Custom Path',
    description: 'Build a multi-point keyframed camera move',
    icon: 'Spline',
    params: { zoomStart: 1.0, zoomEnd: 1.4, panXStart: 0.5, panXEnd: 0.5, panYStart: 0.5, panYEnd: 0.5 }
  }
];
