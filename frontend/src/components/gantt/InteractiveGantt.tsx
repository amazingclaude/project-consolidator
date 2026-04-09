import { useState, useMemo, useCallback, useRef } from 'react';
import { Gantt, ViewMode } from 'gantt-task-react';
import type { Task } from 'gantt-task-react';
import 'gantt-task-react/dist/index.css';

import type { TaskItem } from '../../api/types';
import { COLORS } from '../../lib/colors';
import { GanttToolbar } from './GanttToolbar';
import { GanttTaskTooltip } from './GanttTaskTooltip';
import { BaselineOverlay } from './BaselineOverlay';

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */

export interface InteractiveGanttProps {
  tasks: TaskItem[];
  showBaseline?: boolean;
  onTaskClick?: (taskUid: number) => void;
  height?: number;
  className?: string;
  /** When provided, the Gantt uses this view mode instead of its own internal state. */
  viewMode?: ViewMode;
  /** When provided, filters to critical-path tasks only. */
  filterCritical?: boolean;
  /** When provided, filters to milestone tasks only. */
  filterMilestones?: boolean;
  /** When provided, filters tasks whose name includes this string. */
  searchTerm?: string;
  /** Called when the user drags a task date or progress bar (what-if edit). */
  onTaskChange?: () => void;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/**
 * Safely parse an ISO date string. Returns null when the input is
 * missing or unparseable.
 */
function safeDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Return a bar color based on task status.
 *   - Critical path  -> red
 *   - 100 % complete -> green
 *   - In progress    -> blue
 *   - Not started    -> grey
 */
function taskColor(item: TaskItem): string {
  if (item.critical) return COLORS.red;
  const pct = item.percent_complete ?? 0;
  if (pct >= 100) return COLORS.green;
  if (pct > 0) return COLORS.blue;
  return COLORS.grey;
}

/**
 * Darken a hex colour by an amount (0-1). Used for progress bar fill
 * which should be slightly darker than the background.
 */
function darken(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, ((num >> 16) & 0xff) - Math.round(255 * amount));
  const g = Math.max(0, ((num >> 8) & 0xff) - Math.round(255 * amount));
  const b = Math.max(0, (num & 0xff) - Math.round(255 * amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/**
 * Convert a TaskItem to a gantt-task-react Task.
 *
 * Note: gantt-task-react progress is 0..100 (not 0..1).
 */
function toGanttTask(item: TaskItem): Task | null {
  const start = safeDate(item.start);
  const end = safeDate(item.finish);
  if (!start || !end) return null;

  // Ensure end is strictly after start (gantt-task-react requirement)
  const safeEnd =
    end.getTime() <= start.getTime()
      ? new Date(start.getTime() + 3600000) // +1 hour fallback
      : end;

  const isMilestone = item.milestone === true;
  const color = taskColor(item);
  const progress = item.percent_complete ?? 0; // 0..100

  return {
    id: String(item.task_uid),
    name: item.name,
    start,
    end: safeEnd,
    progress,
    type: isMilestone ? 'milestone' : 'task',
    isDisabled: false,
    styles: {
      backgroundColor: color,
      backgroundSelectedColor: darken(color, 0.1),
      progressColor: darken(color, 0.15),
      progressSelectedColor: darken(color, 0.2),
    },
  };
}

/**
 * Build a "ghost" task representing the baseline schedule.
 * These are rendered as project-type bars with low opacity styling.
 */
function toBaselineGhost(item: TaskItem): Task | null {
  const bStart = safeDate(item.baseline_start);
  const bEnd = safeDate(item.baseline_finish);
  if (!bStart || !bEnd) return null;

  const safeEnd =
    bEnd.getTime() <= bStart.getTime()
      ? new Date(bStart.getTime() + 3600000)
      : bEnd;

  return {
    id: `baseline-${item.task_uid}`,
    name: `${item.name} (baseline)`,
    start: bStart,
    end: safeEnd,
    progress: item.percent_complete ?? 0,
    type: 'project',
    isDisabled: true,
    styles: {
      backgroundColor: 'rgba(220, 38, 38, 0.18)',
      backgroundSelectedColor: 'rgba(220, 38, 38, 0.25)',
      progressColor: 'rgba(220, 38, 38, 0.30)',
      progressSelectedColor: 'rgba(220, 38, 38, 0.35)',
    },
  };
}

/** Format a date for the task list columns. */
function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  });
}

/* ------------------------------------------------------------------ */
/* Custom task list header                                             */
/* ------------------------------------------------------------------ */

/**
 * The library passes { headerHeight, rowWidth, fontFamily, fontSize }
 * but we only use headerHeight for the row sizing.
 */
function TaskListHeaderDefault({
  headerHeight,
}: {
  headerHeight: number;
  rowWidth: string;
  fontFamily: string;
  fontSize: string;
}) {
  return (
    <div
      className="flex items-center border-b border-gray-200 bg-gray-50 text-xs font-semibold text-gray-600"
      style={{ height: headerHeight }}
    >
      <div className="flex-1 min-w-[200px] px-3">Name</div>
      <div className="w-[80px] px-2 text-center">Start</div>
      <div className="w-[80px] px-2 text-center">End</div>
      <div className="w-[60px] px-2 text-right">Prog.</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Custom task list table                                              */
/* ------------------------------------------------------------------ */

/**
 * The library passes { rowHeight, rowWidth, fontFamily, fontSize,
 * locale, tasks, selectedTaskId, setSelectedTask, onExpanderClick }.
 * We render one row per task.
 */
function TaskListTableDefault({
  tasks,
  rowHeight,
  selectedTaskId,
}: {
  rowHeight: number;
  rowWidth: string;
  fontFamily: string;
  fontSize: string;
  locale: string;
  tasks: Task[];
  selectedTaskId: string;
  setSelectedTask: (taskId: string) => void;
  onExpanderClick: (task: Task) => void;
}) {
  return (
    <>
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          rowHeight={rowHeight}
          isSelected={task.id === selectedTaskId}
        />
      ))}
    </>
  );
}

interface TaskRowProps {
  task: Task;
  rowHeight: number;
  isSelected: boolean;
}

function TaskRow({ task, rowHeight, isSelected }: TaskRowProps) {
  const progress = Math.round(task.progress ?? 0);
  return (
    <div
      className={`flex items-center border-b border-gray-100 text-xs ${
        isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
      }`}
      style={{ height: rowHeight }}
    >
      <div className="flex-1 min-w-[200px] px-3 truncate text-gray-800">
        {task.type === 'milestone' && (
          <span className="mr-1 text-purple-500" title="Milestone">
            &#9670;
          </span>
        )}
        {task.name}
      </div>
      <div className="w-[80px] px-2 text-center text-gray-500">
        {fmtDate(task.start)}
      </div>
      <div className="w-[80px] px-2 text-center text-gray-500">
        {fmtDate(task.end)}
      </div>
      <div className="w-[60px] px-2 text-right tabular-nums text-gray-600 font-medium">
        {progress}%
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Custom tooltip wrapper                                              */
/* ------------------------------------------------------------------ */

/**
 * Factory that captures the TaskItem lookup map and returns a component
 * matching the gantt-task-react TooltipContent signature.
 */
function createTooltipComponent(taskItemMap: Map<string, TaskItem>) {
  return function TooltipContent({
    task,
  }: {
    task: Task;
    fontSize: string;
    fontFamily: string;
  }) {
    const original = taskItemMap.get(task.id);
    return <GanttTaskTooltip task={task} originalTask={original} />;
  };
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

export function InteractiveGantt({
  tasks: rawTasks,
  showBaseline: showBaselineProp = false,
  onTaskClick,
  height = 500,
  className = '',
  viewMode: viewModeProp,
  filterCritical: filterCriticalProp,
  filterMilestones: filterMilestonesProp,
  searchTerm: searchTermProp,
  onTaskChange,
}: InteractiveGanttProps) {
  /**
   * When the parent supplies toolbar-related props (viewMode, filterCritical,
   * filterMilestones, searchTerm) it is considered "externally controlled" and
   * the component will NOT render its own GanttToolbar. The parent is expected
   * to render its own toolbar and pass the state down.
   */
  const isExternallyControlled = viewModeProp !== undefined;

  /* ---- original data, immutable reference for reset ---- */
  const originalRef = useRef(rawTasks);
  // Update ref when props change identity
  if (rawTasks !== originalRef.current) {
    originalRef.current = rawTasks;
  }

  /* ---- internal state (used when NOT externally controlled) ---- */
  const [viewModeInternal, setViewMode] = useState<ViewMode>(ViewMode.Week);
  const [showBaselineInternal, setShowBaseline] = useState(showBaselineProp);
  const [isEdited, setIsEdited] = useState(false);
  const [filterCriticalInternal, setFilterCritical] = useState(false);
  const [filterMilestonesInternal, setFilterMilestones] = useState(false);
  const [searchTermInternal, setSearchTerm] = useState('');

  /* ---- resolved values: prefer prop, fall back to internal ---- */
  const viewMode = viewModeProp ?? viewModeInternal;
  const showBaseline = showBaselineProp ?? showBaselineInternal;
  const filterCritical = filterCriticalProp ?? filterCriticalInternal;
  const filterMilestones = filterMilestonesProp ?? filterMilestonesInternal;
  const searchTerm = searchTermProp ?? searchTermInternal;

  /**
   * localEdits stores user drag-edit overrides keyed by task id.
   * Only the dates / progress that the user explicitly changed are
   * stored here; everything else is read from the original props.
   */
  const [localEdits, setLocalEdits] = useState<
    Map<string, { start?: Date; end?: Date; progress?: number }>
  >(new Map());

  /* ---- derived: filtered source items ---- */
  const filteredItems = useMemo(() => {
    let items = rawTasks.filter((t) => t.summary !== true);

    if (filterCritical) {
      items = items.filter((t) => t.critical === true);
    }
    if (filterMilestones) {
      items = items.filter((t) => t.milestone === true);
    }
    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      items = items.filter((t) => t.name.toLowerCase().includes(lower));
    }

    return items;
  }, [rawTasks, filterCritical, filterMilestones, searchTerm]);

  /* ---- derived: gantt task array ---- */
  const ganttTasks = useMemo(() => {
    const result: Task[] = [];

    for (const item of filteredItems) {
      const gt = toGanttTask(item);
      if (!gt) continue;

      // Apply local edits if any
      const edit = localEdits.get(gt.id);
      if (edit) {
        if (edit.start) gt.start = edit.start;
        if (edit.end) gt.end = edit.end;
        if (edit.progress !== undefined) gt.progress = edit.progress;
      }

      result.push(gt);
    }

    // Append baseline ghosts after their real counterparts
    if (showBaseline) {
      const ghosts: Task[] = [];
      for (const item of filteredItems) {
        const ghost = toBaselineGhost(item);
        if (ghost) ghosts.push(ghost);
      }
      result.push(...ghosts);
    }

    return result;
  }, [filteredItems, localEdits, showBaseline]);

  /* ---- lookup map for tooltips ---- */
  const taskItemMap = useMemo(() => {
    const map = new Map<string, TaskItem>();
    for (const item of rawTasks) {
      map.set(String(item.task_uid), item);
    }
    return map;
  }, [rawTasks]);

  /* ---- baseline stats ---- */
  const baselineStats = useMemo(() => {
    const nonSummary = rawTasks.filter((t) => t.summary !== true);
    const withBaseline = nonSummary.filter(
      (t) => t.baseline_start != null && t.baseline_finish != null,
    );
    return { total: nonSummary.length, count: withBaseline.length };
  }, [rawTasks]);

  /* ---- column width per view mode ---- */
  const columnWidth = useMemo(() => {
    switch (viewMode) {
      case ViewMode.Day:
        return 65;
      case ViewMode.Week:
        return 250;
      case ViewMode.Month:
        return 300;
      case ViewMode.Year:
        return 350;
      default:
        return 250;
    }
  }, [viewMode]);

  /* ---- event handlers ---- */
  const handleDateChange = useCallback(
    (task: Task, _children: Task[]) => {
      setLocalEdits((prev) => {
        const next = new Map(prev);
        const existing = next.get(task.id) ?? {};
        next.set(task.id, { ...existing, start: task.start, end: task.end });
        return next;
      });
      setIsEdited(true);
      onTaskChange?.();
    },
    [onTaskChange],
  );

  const handleProgressChange = useCallback(
    (task: Task, _children: Task[]) => {
      setLocalEdits((prev) => {
        const next = new Map(prev);
        const existing = next.get(task.id) ?? {};
        next.set(task.id, { ...existing, progress: task.progress });
        return next;
      });
      setIsEdited(true);
      onTaskChange?.();
    },
    [onTaskChange],
  );

  const handleTaskClick = useCallback(
    (task: Task) => {
      if (onTaskClick) {
        const uid = Number(task.id);
        if (!isNaN(uid)) {
          onTaskClick(uid);
        }
      }
    },
    [onTaskClick],
  );

  const handleReset = useCallback(() => {
    setLocalEdits(new Map());
    setIsEdited(false);
  }, []);

  /* ---- tooltip component (stable reference via useMemo) ---- */
  const TooltipContent = useMemo(
    () => createTooltipComponent(taskItemMap),
    [taskItemMap],
  );

  /* ---- empty state: no tasks at all ---- */
  if (rawTasks.length === 0) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 p-12 ${className}`}
      >
        <p className="text-sm text-gray-500">
          No tasks to display. Upload a project file to get started.
        </p>
      </div>
    );
  }

  /* ---- empty state: filters exclude everything ---- */
  if (ganttTasks.length === 0) {
    return (
      <div className={`space-y-3 ${className}`}>
        {!isExternallyControlled && (
          <GanttToolbar
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            showBaseline={showBaseline}
            onBaselineToggle={() => setShowBaseline((v) => !v)}
            isEdited={isEdited}
            onReset={handleReset}
            filterCritical={filterCritical}
            onFilterCriticalToggle={() => setFilterCritical((v) => !v)}
            filterMilestones={filterMilestones}
            onFilterMilestonesToggle={() => setFilterMilestones((v) => !v)}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
          />
        )}
        <div className="flex items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 p-12">
          <p className="text-sm text-gray-500">
            No tasks match the current filters. Try adjusting your search or
            filter criteria.
          </p>
        </div>
      </div>
    );
  }

  /* ---- main render ---- */
  return (
    <div className={`space-y-3 ${className}`}>
      {/* Toolbar (only when self-managed, not externally controlled) */}
      {!isExternallyControlled && (
        <GanttToolbar
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          showBaseline={showBaseline}
          onBaselineToggle={() => setShowBaseline((v) => !v)}
          isEdited={isEdited}
          onReset={handleReset}
          filterCritical={filterCritical}
          onFilterCriticalToggle={() => setFilterCritical((v) => !v)}
          filterMilestones={filterMilestones}
          onFilterMilestonesToggle={() => setFilterMilestones((v) => !v)}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
        />
      )}

      {/* Baseline overlay info bar */}
      {showBaseline && (
        <BaselineOverlay
          visible={showBaseline}
          onToggle={() => setShowBaseline((v) => !v)}
          baselineCount={baselineStats.count}
          totalTasks={baselineStats.total}
        />
      )}

      {/* Gantt chart */}
      <div
        className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
        style={{ height }}
      >
        <Gantt
          tasks={ganttTasks}
          viewMode={viewMode}
          onDateChange={handleDateChange}
          onProgressChange={handleProgressChange}
          onClick={handleTaskClick}
          listCellWidth="420px"
          columnWidth={columnWidth}
          rowHeight={42}
          barCornerRadius={4}
          barFill={65}
          headerHeight={50}
          fontSize="12"
          todayColor="rgba(59, 130, 246, 0.06)"
          TaskListHeader={TaskListHeaderDefault}
          TaskListTable={TaskListTableDefault}
          TooltipContent={TooltipContent}
        />
      </div>
    </div>
  );
}
