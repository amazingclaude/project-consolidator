import type { Task } from 'gantt-task-react';
import type { TaskItem } from '../api/types.ts';
import { COLORS, STATUS_COLORS } from './colors.ts';

/**
 * Parse an ISO date string into a Date, falling back to the current date
 * if the string is null/undefined or invalid.
 */
function parseDate(dateStr: string | null | undefined): Date {
  if (!dateStr) return new Date();
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? new Date() : d;
}

/**
 * Determine bar colors based on whether a task is critical and its completion.
 */
function getTaskColors(task: TaskItem): {
  backgroundColor: string;
  backgroundSelectedColor: string;
  progressColor: string;
  progressSelectedColor: string;
} {
  const pct = task.percent_complete ?? 0;

  if (pct >= 100) {
    return {
      backgroundColor: STATUS_COLORS.completed,
      backgroundSelectedColor: '#16A34A',
      progressColor: STATUS_COLORS.completed,
      progressSelectedColor: '#16A34A',
    };
  }

  if (task.critical) {
    return {
      backgroundColor: '#FCA5A5',
      backgroundSelectedColor: '#F87171',
      progressColor: COLORS.red,
      progressSelectedColor: '#DC2626',
    };
  }

  return {
    backgroundColor: '#93C5FD',
    backgroundSelectedColor: '#60A5FA',
    progressColor: COLORS.blue,
    progressSelectedColor: '#2563EB',
  };
}

/**
 * Transform API TaskItem[] into gantt-task-react Task[] format.
 *
 * - Filters out summary tasks (summary === true)
 * - Maps TaskItem to gantt-task-react Task format
 * - Sets type='milestone' for milestone tasks, 'task' for others
 * - Sets progress from percent_complete (0-100 scale, matching gantt-task-react)
 * - Sets colors based on critical flag and completion status
 */
export function transformTasks(tasks: TaskItem[]): Task[] {
  return tasks
    .filter((t) => t.summary !== true)
    .map((t): Task => {
      const isMilestone = t.milestone === true;
      const start = parseDate(t.start);
      const end = parseDate(t.finish);

      // Ensure end is after start for non-milestone tasks
      const safeEnd = !isMilestone && end <= start
        ? new Date(start.getTime() + 24 * 60 * 60 * 1000)
        : end;

      const colors = getTaskColors(t);

      return {
        id: String(t.task_uid),
        name: t.name,
        start,
        end: safeEnd,
        progress: t.percent_complete ?? 0,
        type: isMilestone ? 'milestone' : 'task',
        isDisabled: true,
        styles: {
          backgroundColor: colors.backgroundColor,
          backgroundSelectedColor: colors.backgroundSelectedColor,
          progressColor: colors.progressColor,
          progressSelectedColor: colors.progressSelectedColor,
        },
        dependencies: [],
      };
    });
}

/**
 * Transform API TaskItem[] into both current schedule and baseline schedule
 * Task arrays for overlay rendering in the Gantt chart.
 *
 * Returns:
 *   - tasks: current schedule (using start/finish)
 *   - baselines: baseline schedule (using baseline_start/baseline_finish),
 *     only for tasks that have baseline dates
 */
export function transformTasksWithBaseline(tasks: TaskItem[]): {
  tasks: Task[];
  baselines: Task[];
} {
  const filtered = tasks.filter((t) => t.summary !== true);

  const currentTasks = filtered.map((t): Task => {
    const isMilestone = t.milestone === true;
    const start = parseDate(t.start);
    const end = parseDate(t.finish);
    const safeEnd = !isMilestone && end <= start
      ? new Date(start.getTime() + 24 * 60 * 60 * 1000)
      : end;
    const colors = getTaskColors(t);

    return {
      id: String(t.task_uid),
      name: t.name,
      start,
      end: safeEnd,
      progress: t.percent_complete ?? 0,
      type: isMilestone ? 'milestone' : 'task',
      isDisabled: true,
      styles: {
        backgroundColor: colors.backgroundColor,
        backgroundSelectedColor: colors.backgroundSelectedColor,
        progressColor: colors.progressColor,
        progressSelectedColor: colors.progressSelectedColor,
      },
      dependencies: [],
    };
  });

  const baselineTasks = filtered
    .filter((t) => t.baseline_start !== null && t.baseline_finish !== null)
    .map((t): Task => {
      const isMilestone = t.milestone === true;
      const start = parseDate(t.baseline_start);
      const end = parseDate(t.baseline_finish);
      const safeEnd = !isMilestone && end <= start
        ? new Date(start.getTime() + 24 * 60 * 60 * 1000)
        : end;

      return {
        id: `baseline-${t.task_uid}`,
        name: `${t.name} (Baseline)`,
        start,
        end: safeEnd,
        progress: 0,
        type: isMilestone ? 'milestone' : 'task',
        isDisabled: true,
        styles: {
          backgroundColor: '#D1D5DB',
          backgroundSelectedColor: '#9CA3AF',
          progressColor: '#D1D5DB',
          progressSelectedColor: '#9CA3AF',
        },
        dependencies: [],
      };
    });

  return { tasks: currentTasks, baselines: baselineTasks };
}
