import { Loader2, CheckCircle2, XCircle, Circle, ArrowRight } from 'lucide-react';
import { useScheduleMetrics, useProjectTasks } from '../api/projects';
import { formatDate } from '../lib/formatters';
import type { TaskItem } from '../api/types';

interface MilestoneTrackerWidgetProps {
  projectId: number;
}

type MilestoneStatus = 'on-time' | 'slipped' | 'not-started';

interface MilestoneDisplay {
  task_uid: number;
  name: string;
  baseline_finish: string | null;
  current_finish: string | null;
  status: MilestoneStatus;
  slip_days: number;
  percent_complete: number | null;
}

function getStatusIcon(status: MilestoneStatus) {
  switch (status) {
    case 'on-time':
      return <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-500" />;
    case 'slipped':
      return <XCircle className="h-4 w-4 flex-shrink-0 text-red-500" />;
    case 'not-started':
      return <Circle className="h-4 w-4 flex-shrink-0 text-gray-400" />;
  }
}

function getStatusLabel(status: MilestoneStatus): string {
  switch (status) {
    case 'on-time':
      return 'On Time';
    case 'slipped':
      return 'Slipped';
    case 'not-started':
      return 'Not Started';
  }
}

function getStatusBgClass(status: MilestoneStatus): string {
  switch (status) {
    case 'on-time':
      return 'bg-green-50';
    case 'slipped':
      return 'bg-red-50';
    case 'not-started':
      return 'bg-gray-50';
  }
}

export function MilestoneTrackerWidget({ projectId }: MilestoneTrackerWidgetProps) {
  const {
    data: scheduleData,
    isLoading: scheduleLoading,
    error: scheduleError,
  } = useScheduleMetrics(projectId);

  const {
    data: tasks,
    isLoading: tasksLoading,
    error: tasksError,
  } = useProjectTasks(projectId, { milestones: true });

  const isLoading = scheduleLoading || tasksLoading;

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (scheduleError || tasksError || !scheduleData) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        Failed to load milestone data
      </div>
    );
  }

  // Build slipped milestones lookup
  const slippedMap = new Map(
    scheduleData.slipped_milestones.map((ms) => [ms.task_uid, ms])
  );

  // Combine tasks with schedule data to build display list
  const milestones: MilestoneDisplay[] = (tasks ?? []).map((task: TaskItem) => {
    const slipped = slippedMap.get(task.task_uid);
    let status: MilestoneStatus;

    if (slipped) {
      status = 'slipped';
    } else if (
      task.actual_start === null &&
      (task.percent_complete === null || task.percent_complete === 0)
    ) {
      status = 'not-started';
    } else {
      status = 'on-time';
    }

    return {
      task_uid: task.task_uid,
      name: task.name,
      baseline_finish: task.baseline_finish,
      current_finish: task.finish,
      status,
      slip_days: slipped?.slip_days ?? 0,
      percent_complete: task.percent_complete,
    };
  });

  // Sort: slipped first, then not started, then on-time
  const sortOrder: Record<MilestoneStatus, number> = {
    slipped: 0,
    'not-started': 1,
    'on-time': 2,
  };
  milestones.sort((a, b) => sortOrder[a.status] - sortOrder[b.status]);

  if (milestones.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        No milestones found
      </div>
    );
  }

  // Summary counts
  const onTimeCount = milestones.filter((m) => m.status === 'on-time').length;
  const slippedCount = milestones.filter((m) => m.status === 'slipped').length;
  const notStartedCount = milestones.filter((m) => m.status === 'not-started').length;

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Summary bar */}
      <div className="flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          <span className="font-medium text-gray-700">{onTimeCount} On Time</span>
        </span>
        <span className="flex items-center gap-1.5">
          <XCircle className="h-3.5 w-3.5 text-red-500" />
          <span className="font-medium text-gray-700">{slippedCount} Slipped</span>
        </span>
        <span className="flex items-center gap-1.5">
          <Circle className="h-3.5 w-3.5 text-gray-400" />
          <span className="font-medium text-gray-700">{notStartedCount} Not Started</span>
        </span>
      </div>

      {/* Milestone list */}
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
        {milestones.map((ms) => (
          <div
            key={ms.task_uid}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${getStatusBgClass(ms.status)}`}
          >
            {getStatusIcon(ms.status)}

            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-gray-800">
                {ms.name}
              </p>
              <div className="mt-0.5 flex items-center gap-1 text-[10px] text-gray-500">
                {ms.baseline_finish && (
                  <>
                    <span>{formatDate(ms.baseline_finish)}</span>
                    {ms.current_finish && ms.current_finish !== ms.baseline_finish && (
                      <>
                        <ArrowRight className="h-2.5 w-2.5" />
                        <span>{formatDate(ms.current_finish)}</span>
                      </>
                    )}
                  </>
                )}
                {!ms.baseline_finish && ms.current_finish && (
                  <span>{formatDate(ms.current_finish)}</span>
                )}
              </div>
            </div>

            <div className="flex flex-shrink-0 items-center gap-2">
              {ms.status === 'slipped' && ms.slip_days > 0 && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                  +{ms.slip_days}d
                </span>
              )}
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  ms.status === 'on-time'
                    ? 'bg-green-100 text-green-700'
                    : ms.status === 'slipped'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-gray-100 text-gray-600'
                }`}
              >
                {getStatusLabel(ms.status)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export type { MilestoneTrackerWidgetProps };
