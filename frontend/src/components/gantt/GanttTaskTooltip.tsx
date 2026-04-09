import type { Task } from 'gantt-task-react';
import type { TaskItem } from '../../api/types';

export interface GanttTaskTooltipProps {
  task: Task;
  originalTask?: TaskItem;
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return '--';
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateStr(dateStr: string | null | undefined): string {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '--';
  return formatDate(d);
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '--';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function hasBaselineVariance(original: TaskItem): boolean {
  if (!original.baseline_start || !original.start) return false;
  if (!original.baseline_finish || !original.finish) return false;
  return (
    original.baseline_start !== original.start ||
    original.baseline_finish !== original.finish
  );
}

export function GanttTaskTooltip({ task, originalTask }: GanttTaskTooltipProps) {
  const progress = Math.round(task.progress ?? 0);

  return (
    <div className="min-w-[260px] max-w-[360px] rounded-lg bg-white shadow-lg border border-gray-200 p-4 text-sm">
      {/* Task name */}
      <div className="mb-3 border-b border-gray-100 pb-2">
        <h4 className="font-semibold text-gray-900 leading-tight">{task.name}</h4>
        {originalTask?.wbs && (
          <span className="mt-0.5 block text-xs text-gray-400">
            WBS: {originalTask.wbs}
          </span>
        )}
      </div>

      {/* Date range */}
      <div className="space-y-1.5">
        <Row label="Start" value={formatDate(task.start)} />
        <Row label="End" value={formatDate(task.end)} />
        <Row label="Progress" value={`${progress}%`} />

        {/* Baseline dates if they differ */}
        {originalTask && hasBaselineVariance(originalTask) && (
          <>
            <div className="my-2 border-t border-dashed border-gray-200" />
            <Row
              label="Baseline Start"
              value={formatDateStr(originalTask.baseline_start)}
              muted
            />
            <Row
              label="Baseline End"
              value={formatDateStr(originalTask.baseline_finish)}
              muted
            />
          </>
        )}

        {/* Cost info */}
        {originalTask && originalTask.cost != null && (
          <>
            <div className="my-2 border-t border-dashed border-gray-200" />
            <Row label="Cost" value={formatCurrency(originalTask.cost)} />
            {originalTask.baseline_cost != null && (
              <Row
                label="Baseline Cost"
                value={formatCurrency(originalTask.baseline_cost)}
                muted
              />
            )}
            {originalTask.actual_cost != null && (
              <Row
                label="Actual Cost"
                value={formatCurrency(originalTask.actual_cost)}
              />
            )}
          </>
        )}

        {/* Resources */}
        {originalTask?.resource_names && (
          <>
            <div className="my-2 border-t border-dashed border-gray-200" />
            <Row label="Resources" value={originalTask.resource_names} />
          </>
        )}

        {/* Duration */}
        {originalTask?.duration_hours != null && (
          <Row
            label="Duration"
            value={`${originalTask.duration_hours.toFixed(1)}h`}
          />
        )}

        {/* Critical / Milestone badges */}
        {originalTask && (originalTask.critical || originalTask.milestone) && (
          <div className="mt-2 flex gap-1.5">
            {originalTask.critical && (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                Critical
              </span>
            )}
            {originalTask.milestone && (
              <span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
                Milestone
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface RowProps {
  label: string;
  value: string;
  muted?: boolean;
}

function Row({ label, value, muted }: RowProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={`text-xs ${muted ? 'text-gray-400' : 'text-gray-500'}`}>
        {label}
      </span>
      <span
        className={`text-xs font-medium ${muted ? 'text-gray-400 italic' : 'text-gray-800'}`}
      >
        {value}
      </span>
    </div>
  );
}

export type { RowProps };
