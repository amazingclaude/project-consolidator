import { useState } from 'react';
import { Loader2, Calendar, CalendarDays, CalendarRange } from 'lucide-react';
import { ViewMode } from 'gantt-task-react';
import { useProjectTasks } from '../api/projects';
import { InteractiveGantt } from '../components/gantt/InteractiveGantt';

interface GanttWidgetProps {
  projectId: number;
}

const VIEW_MODE_OPTIONS: { label: string; mode: ViewMode; icon: React.ReactNode }[] = [
  { label: 'Day', mode: ViewMode.Day, icon: <Calendar className="h-3.5 w-3.5" /> },
  { label: 'Week', mode: ViewMode.Week, icon: <CalendarDays className="h-3.5 w-3.5" /> },
  { label: 'Month', mode: ViewMode.Month, icon: <CalendarRange className="h-3.5 w-3.5" /> },
];

export function GanttWidget({ projectId }: GanttWidgetProps) {
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Week);
  const { data: tasks, isLoading, error } = useProjectTasks(projectId, { summary: false });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !tasks) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        Failed to load tasks
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        No tasks available for Gantt chart
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-2">
      {/* Compact toolbar */}
      <div className="flex items-center gap-1">
        {VIEW_MODE_OPTIONS.map((opt) => (
          <button
            key={opt.mode}
            onClick={() => setViewMode(opt.mode)}
            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              viewMode === opt.mode
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
            }`}
          >
            {opt.icon}
            {opt.label}
          </button>
        ))}
      </div>

      {/* Gantt chart */}
      <div className="min-h-0 flex-1">
        <InteractiveGantt tasks={tasks} showBaseline />
      </div>
    </div>
  );
}

export type { GanttWidgetProps };
