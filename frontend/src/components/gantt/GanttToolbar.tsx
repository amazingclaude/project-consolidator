import { ViewMode } from 'gantt-task-react';
import {
  Eye,
  EyeOff,
  AlertTriangle,
  Flag,
  Search,
  RotateCcw,
} from 'lucide-react';

export interface GanttToolbarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  showBaseline: boolean;
  onBaselineToggle: () => void;
  isEdited: boolean;
  onReset: () => void;
  filterCritical: boolean;
  onFilterCriticalToggle: () => void;
  filterMilestones: boolean;
  onFilterMilestonesToggle: () => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
}

interface ViewModeOption {
  label: string;
  mode: ViewMode;
}

const VIEW_MODES: ViewModeOption[] = [
  { label: 'Day', mode: ViewMode.Day },
  { label: 'Week', mode: ViewMode.Week },
  { label: 'Month', mode: ViewMode.Month },
  { label: 'Year', mode: ViewMode.Year },
];

export function GanttToolbar({
  viewMode,
  onViewModeChange,
  showBaseline,
  onBaselineToggle,
  isEdited,
  onReset,
  filterCritical,
  onFilterCriticalToggle,
  filterMilestones,
  onFilterMilestonesToggle,
  searchTerm,
  onSearchChange,
}: GanttToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-2.5 shadow-sm">
      {/* View mode button group */}
      <div className="flex items-center gap-0.5">
        <span className="mr-1.5 text-xs font-medium text-gray-500">View:</span>
        <div className="inline-flex rounded-md border border-gray-200 bg-gray-50">
          {VIEW_MODES.map(({ label, mode }) => (
            <button
              key={label}
              type="button"
              onClick={() => onViewModeChange(mode)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors first:rounded-l-md last:rounded-r-md ${
                viewMode === mode
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Separator */}
      <div className="h-6 w-px bg-gray-200" />

      {/* Toggle buttons */}
      <div className="flex items-center gap-1.5">
        <ToggleButton
          active={showBaseline}
          onClick={onBaselineToggle}
          icon={showBaseline ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          label="Baseline"
        />
        <ToggleButton
          active={filterCritical}
          onClick={onFilterCriticalToggle}
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
          label="Critical Only"
          activeColor="red"
        />
        <ToggleButton
          active={filterMilestones}
          onClick={onFilterMilestonesToggle}
          icon={<Flag className="h-3.5 w-3.5" />}
          label="Milestones"
          activeColor="purple"
        />
      </div>

      {/* Separator */}
      <div className="h-6 w-px bg-gray-200" />

      {/* Search input */}
      <div className="relative flex-1 min-w-[180px] max-w-[280px]">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search tasks..."
          className="w-full rounded-md border border-gray-200 bg-gray-50 py-1.5 pl-8 pr-3 text-xs text-gray-700 placeholder-gray-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <span className="text-xs font-bold">&times;</span>
          </button>
        )}
      </div>

      {/* Reset button */}
      {isEdited && (
        <>
          <div className="h-6 w-px bg-gray-200" />
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Changes
          </button>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Internal toggle button component                                    */
/* ------------------------------------------------------------------ */

interface ToggleButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  activeColor?: 'blue' | 'red' | 'purple';
}

const ACTIVE_STYLES: Record<string, string> = {
  blue: 'bg-blue-600 text-white hover:bg-blue-700',
  red: 'bg-red-600 text-white hover:bg-red-700',
  purple: 'bg-purple-600 text-white hover:bg-purple-700',
};

function ToggleButton({
  active,
  onClick,
  icon,
  label,
  activeColor = 'blue',
}: ToggleButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? ACTIVE_STYLES[activeColor]
          : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
