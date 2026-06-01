
import React from 'react';
import {
  Activity,
  ArrowDown,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Film,
  ImagePlay,
  LucideIcon,
  Maximize,
  MousePointerClick,
  MoveDown,
  MoveLeft,
  MoveRight,
  MoveUp,
  Repeat,
  Spline,
  Tornado,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { MotionPreset } from '../types';

interface MotionCardProps {
  preset: MotionPreset;
  isSelected: boolean;
  onClick: () => void;
}

export const MotionCard: React.FC<MotionCardProps> = ({ preset, isSelected, onClick }) => {
  const icons: Record<string, LucideIcon> = {
    Activity,
    ArrowDown,
    ArrowDownRight,
    ArrowLeft,
    ArrowRight,
    ArrowUp,
    ArrowUpRight,
    Film,
    ImagePlay,
    Maximize,
    MousePointerClick,
    MoveDown,
    MoveLeft,
    MoveRight,
    MoveUp,
    Repeat,
    Spline,
    Tornado,
    ZoomIn,
    ZoomOut
  };
  const Icon = icons[preset.icon] || Film;

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center p-3 rounded-xl border transition-all duration-200 text-left group
        ${isSelected 
          ? 'bg-indigo-600/10 border-indigo-500/50 shadow-md shadow-indigo-900/10' 
          : 'bg-[#18181b] border-[#27272a] hover:border-[#3f3f46] hover:bg-[#202024]'
        }`}
    >
      <div className={`p-2 rounded-lg mr-3 transition-colors ${isSelected ? 'bg-indigo-600 text-white' : 'bg-[#27272a] text-gray-400 group-hover:text-gray-200'}`}>
        <Icon size={20} />
      </div>
      <div>
        <h3 className={`text-sm font-medium ${isSelected ? 'text-indigo-400' : 'text-gray-200'}`}>{preset.label}</h3>
        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{preset.description}</p>
      </div>
    </button>
  );
};
