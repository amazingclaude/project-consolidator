import {
  Loader2,
  CalendarClock,
  Activity,
  Flag,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { useScheduleMetrics } from '../api/projects';
import { MetricCard } from '../components/ui/MetricCard';
import { formatDays, formatIndex, formatDate } from '../lib/formatters';

interface ScheduleOverviewWidgetProps {
  projectId: number;
}

export function ScheduleOverviewWidget({ projectId }: ScheduleOverviewWidgetProps) {
  const { data, isLoading, error } = useScheduleMetrics(projectId);

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
        Failed to load schedule metrics
      </div>
    );
  }

  const svDays = data.schedule_variance_days;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          label="SV (Days)"
          value={svDays !== null ? formatDays(svDays) : '-'}
          delta={
            svDays !== null
              ? svDays >= 0
                ? 'Ahead'
                : 'Behind'
              : undefined
          }
          deltaPositive={svDays !== null && svDays >= 0}
          icon={<CalendarClock className="h-4 w-4" />}
        />
        <MetricCard
          label="SPI"
          value={formatIndex(data.spi)}
          delta={
            data.spi !== null
              ? data.spi >= 1.0
                ? 'On track'
                : 'Behind schedule'
              : undefined
          }
          deltaPositive={data.spi !== null && data.spi >= 1.0}
          icon={<Activity className="h-4 w-4" />}
        />
        <MetricCard
          label="Milestones On Track"
          value={`${data.milestones_on_track} / ${data.total_milestones}`}
          icon={<Flag className="h-4 w-4" />}
        />
        <MetricCard
          label="Critical Behind"
          value={data.critical_tasks_behind.length}
          icon={<AlertTriangle className="h-4 w-4" />}
          className={
            data.critical_tasks_behind.length > 0
              ? 'border-red-200 bg-red-50/30'
              : ''
          }
        />
      </div>

      {/* Slipped milestones list */}
      {data.slipped_milestones.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Slipped Milestones
          </h4>
          <div className="max-h-36 space-y-1 overflow-y-auto">
            {data.slipped_milestones.slice(0, 5).map((ms) => (
              <div
                key={ms.task_uid}
                className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs"
              >
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-red-500" />
                <span className="min-w-0 flex-1 truncate font-medium text-gray-800">
                  {ms.name}
                </span>
                <div className="flex flex-shrink-0 items-center gap-1 text-gray-500">
                  <span>{formatDate(ms.baseline_finish)}</span>
                  <ArrowRight className="h-3 w-3" />
                  <span>{formatDate(ms.current_finish)}</span>
                </div>
                <span className="flex-shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                  +{ms.slip_days}d
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export type { ScheduleOverviewWidgetProps };
