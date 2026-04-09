import { Loader2, Clock, Timer, Hourglass, TrendingUp } from 'lucide-react';
import { useTimeMetrics } from '../api/projects';
import { MetricCard } from '../components/ui/MetricCard';
import { formatHours } from '../lib/formatters';

interface TimeMetricsWidgetProps {
  projectId: number;
}

export function TimeMetricsWidget({ projectId }: TimeMetricsWidgetProps) {
  const { data, isLoading, error } = useTimeMetrics(projectId);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        Failed to load time metrics
      </div>
    );
  }

  const variancePositive = data.duration_variance_hours <= 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          label="Planned Hours"
          value={formatHours(data.total_planned_hours)}
          icon={<Clock className="h-4 w-4" />}
        />
        <MetricCard
          label="Actual Hours"
          value={formatHours(data.total_actual_hours)}
          icon={<Timer className="h-4 w-4" />}
        />
        <MetricCard
          label="Remaining"
          value={formatHours(data.total_remaining_hours)}
          icon={<Hourglass className="h-4 w-4" />}
        />
        <MetricCard
          label="Duration Variance"
          value={formatHours(data.duration_variance_hours)}
          delta={variancePositive ? 'Under' : 'Over'}
          deltaPositive={variancePositive}
          icon={<TrendingUp className="h-4 w-4" />}
        />
      </div>

      {/* Top 5 overrun tasks */}
      {data.tasks_with_overrun.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Top Overrun Tasks
          </h4>
          <div className="max-h-40 space-y-1 overflow-y-auto">
            {data.tasks_with_overrun.slice(0, 5).map((task) => (
              <div
                key={task.task_uid}
                className="flex items-center gap-3 rounded-lg bg-orange-50 px-3 py-2"
              >
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-gray-800">
                  {task.name}
                </span>
                <div className="flex flex-shrink-0 items-center gap-3 text-xs text-gray-500">
                  <span title="Baseline hours">
                    {task.baseline_hours !== null
                      ? formatHours(task.baseline_hours)
                      : '-'}
                  </span>
                  <span className="text-gray-300">/</span>
                  <span title="Actual hours">
                    {task.actual_hours !== null
                      ? formatHours(task.actual_hours)
                      : '-'}
                  </span>
                </div>
                <span className="flex-shrink-0 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-700">
                  +{formatHours(task.overrun_hours)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export type { TimeMetricsWidgetProps };
