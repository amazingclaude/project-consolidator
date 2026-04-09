import { Eye, EyeOff, Info } from 'lucide-react';

export interface BaselineOverlayProps {
  visible: boolean;
  onToggle: () => void;
  baselineCount: number;
  totalTasks: number;
}

export function BaselineOverlay({
  visible,
  onToggle,
  baselineCount,
  totalTasks,
}: BaselineOverlayProps) {
  const coverage =
    totalTasks > 0 ? Math.round((baselineCount / totalTasks) * 100) : 0;

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border px-4 py-2.5 text-sm transition-colors ${
        visible
          ? 'border-blue-200 bg-blue-50'
          : 'border-gray-200 bg-gray-50'
      }`}
    >
      {/* Toggle button */}
      <button
        type="button"
        onClick={onToggle}
        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
          visible
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-100'
        }`}
      >
        {visible ? (
          <EyeOff className="h-3.5 w-3.5" />
        ) : (
          <Eye className="h-3.5 w-3.5" />
        )}
        {visible ? 'Hide Baseline' : 'Show Baseline'}
      </button>

      {/* Info text */}
      {visible && (
        <div className="flex items-center gap-2 text-gray-600">
          <Info className="h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
          <span>
            Showing baseline overlay ({baselineCount} of {totalTasks} tasks have
            baseline data)
          </span>
        </div>
      )}

      {/* Coverage badge */}
      <div
        className={`ml-auto flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
          coverage >= 80
            ? 'bg-green-100 text-green-700'
            : coverage >= 50
              ? 'bg-yellow-100 text-yellow-700'
              : 'bg-red-100 text-red-700'
        }`}
      >
        <span>{coverage}%</span>
        <span className="font-normal text-gray-500">coverage</span>
      </div>
    </div>
  );
}
