import { useState, useEffect, useMemo, useCallback } from 'react';
import { ViewMode } from 'gantt-task-react';
import {
  CalendarDays,
  TrendingUp,
  Flag,
  AlertTriangle,
  ChevronDown,
} from 'lucide-react';

import { useProjects, useProjectTasks, useScheduleMetrics } from '../api/projects';
import type { ProjectSummary, TaskItem, SlippedMilestone } from '../api/types';
import PageHeader from '../components/layout/PageHeader';
import { MetricCard } from '../components/ui/MetricCard';
import { DataTable } from '../components/ui/DataTable';
import type { Column } from '../components/ui/DataTable';
import { LoadingState } from '../components/ui/LoadingState';
import { ErrorState } from '../components/ui/ErrorState';
import { InteractiveGantt } from '../components/gantt/InteractiveGantt';
import { GanttToolbar } from '../components/gantt/GanttToolbar';
import { CostVarianceBar } from '../components/charts/CostVarianceBar';
import { formatDays, formatIndex, formatDate } from '../lib/formatters';
import { useChatStore } from '../stores/chatStore';

/* ------------------------------------------------------------------ */
/* Columns for the portfolio summary table                             */
/* ------------------------------------------------------------------ */

const portfolioColumns: Column<ProjectSummary>[] = [
  {
    key: 'name',
    label: 'Project',
    render: (_value, row) => (
      <span className="font-medium text-blue-600 hover:text-blue-800 hover:underline">
        {row.name}
      </span>
    ),
  },
  {
    key: 'start',
    label: 'Start',
    render: (value) => formatDate(value as string | null),
  },
  {
    key: 'finish',
    label: 'Finish',
    render: (value) => formatDate(value as string | null),
  },
  {
    key: 'task_count',
    label: 'Tasks',
  },
  {
    key: 'deviation_count',
    label: 'Deviations',
    render: (value) => {
      const count = value as number;
      if (count === 0) return <span className="text-gray-400">0</span>;
      return (
        <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
          {count}
        </span>
      );
    },
  },
];

/* ------------------------------------------------------------------ */
/* Columns for slipped milestones                                      */
/* ------------------------------------------------------------------ */

const slippedMilestoneColumns: Column<SlippedMilestone>[] = [
  {
    key: 'name',
    label: 'Milestone Name',
    render: (value) => (
      <span className="font-medium text-gray-900">{value as string}</span>
    ),
  },
  {
    key: 'baseline_finish',
    label: 'Baseline Finish',
    render: (value) => formatDate(value as string | null),
  },
  {
    key: 'current_finish',
    label: 'Current Finish',
    render: (value) => formatDate(value as string | null),
  },
  {
    key: 'slip_days',
    label: 'Slip (days)',
    render: (value) => {
      const days = value as number;
      return (
        <span className={`font-semibold ${days > 0 ? 'text-red-600' : 'text-green-600'}`}>
          {days > 0 ? `+${days}` : days}
        </span>
      );
    },
  },
];

/* ------------------------------------------------------------------ */
/* Helper to compute per-task schedule variance data for the bar chart */
/* ------------------------------------------------------------------ */

interface TaskVariancePoint {
  name: string;
  variance: number;
}

function computeTaskVariances(tasks: TaskItem[]): TaskVariancePoint[] {
  const points: TaskVariancePoint[] = [];
  for (const t of tasks) {
    if (t.baseline_finish && t.finish) {
      const baselineEnd = new Date(t.baseline_finish).getTime();
      const currentEnd = new Date(t.finish).getTime();
      const diffDays = (baselineEnd - currentEnd) / (1000 * 60 * 60 * 24);
      points.push({ name: t.name, variance: Math.round(diffDays * 10) / 10 });
    }
  }
  return points.sort((a, b) => a.variance - b.variance);
}

/* ------------------------------------------------------------------ */
/* Project Selector Dropdown                                           */
/* ------------------------------------------------------------------ */

interface ProjectSelectorProps {
  projects: ProjectSummary[];
  selectedId: number | null;
  onChange: (id: number | null) => void;
}

function ProjectSelector({ projects, selectedId, onChange }: ProjectSelectorProps) {
  return (
    <div className="relative inline-block">
      <select
        value={selectedId ?? ''}
        onChange={(e) => {
          const val = e.target.value;
          onChange(val === '' ? null : Number(val));
        }}
        className="appearance-none rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-10 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:border-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        <option value="">All Projects (Portfolio)</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main Page Component                                                 */
/* ------------------------------------------------------------------ */

function ScheduleAnalysis() {
  const setContext = useChatStore((s) => s.setContext);

  // Local state
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Month);
  const [showBaseline, setShowBaseline] = useState(false);
  const [filterCritical, setFilterCritical] = useState(false);
  const [filterMilestones, setFilterMilestones] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isEdited, setIsEdited] = useState(false);

  // Data fetches
  const {
    data: projects,
    isLoading: projectsLoading,
    error: projectsError,
    refetch: refetchProjects,
  } = useProjects();

  const {
    data: scheduleMetrics,
    isLoading: scheduleLoading,
    error: scheduleError,
    refetch: refetchSchedule,
  } = useScheduleMetrics(selectedProjectId);

  const {
    data: tasks,
    isLoading: tasksLoading,
    error: tasksError,
    refetch: refetchTasks,
  } = useProjectTasks(selectedProjectId, { summary: false });

  // Update chat context on project change
  useEffect(() => {
    if (selectedProjectId !== null && projects) {
      const project = projects.find((p) => p.id === selectedProjectId);
      setContext({
        page: 'schedule',
        projectId: selectedProjectId,
        projectName: project?.name,
      });
    } else {
      setContext({ page: 'schedule' });
    }
  }, [selectedProjectId, projects, setContext]);

  // Reset Gantt toolbar state when project changes
  useEffect(() => {
    setShowBaseline(false);
    setFilterCritical(false);
    setFilterMilestones(false);
    setSearchTerm('');
    setIsEdited(false);
  }, [selectedProjectId]);

  // Computed values
  const taskVarianceData = useMemo(() => {
    if (!tasks) return [];
    return computeTaskVariances(tasks);
  }, [tasks]);

  const sortedSlippedMilestones = useMemo(() => {
    if (!scheduleMetrics?.slipped_milestones) return [];
    return [...scheduleMetrics.slipped_milestones].sort(
      (a, b) => b.slip_days - a.slip_days
    );
  }, [scheduleMetrics]);

  const handleGanttReset = useCallback(() => {
    setIsEdited(false);
  }, []);

  const handleProjectSelect = useCallback((id: number | null) => {
    setSelectedProjectId(id);
  }, []);

  const handlePortfolioRowClick = useCallback(
    (row: ProjectSummary) => {
      setSelectedProjectId(row.id);
    },
    []
  );

  /* ---------------------------------------------------------------- */
  /* Render: Global Loading                                            */
  /* ---------------------------------------------------------------- */

  if (projectsLoading) {
    return (
      <div className="p-6">
        <PageHeader title="Schedule Analysis" />
        <LoadingState message="Loading projects..." />
      </div>
    );
  }

  if (projectsError) {
    return (
      <div className="p-6">
        <PageHeader title="Schedule Analysis" />
        <ErrorState
          message={
            projectsError instanceof Error
              ? projectsError.message
              : 'Failed to load projects'
          }
          onRetry={refetchProjects}
        />
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /* Render: Portfolio Mode (no project selected)                      */
  /* ---------------------------------------------------------------- */

  if (selectedProjectId === null) {
    return (
      <div className="p-6 space-y-8">
        <PageHeader
          title="Schedule Analysis"
          actions={
            <ProjectSelector
              projects={projects ?? []}
              selectedId={selectedProjectId}
              onChange={handleProjectSelect}
            />
          }
        />

        {/* Portfolio-level summary */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Total Projects"
            value={projects?.length ?? 0}
            icon={<CalendarDays className="h-5 w-5" />}
          />
          <MetricCard
            label="Total Tasks"
            value={projects?.reduce((sum, p) => sum + p.task_count, 0) ?? 0}
            icon={<TrendingUp className="h-5 w-5" />}
          />
          <MetricCard
            label="Total Deviations"
            value={projects?.reduce((sum, p) => sum + p.deviation_count, 0) ?? 0}
            icon={<AlertTriangle className="h-5 w-5" />}
          />
          <MetricCard
            label="Select a Project"
            value="for details"
            icon={<Flag className="h-5 w-5" />}
          />
        </div>

        {/* Portfolio project table */}
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Portfolio Schedule Summary
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Click a row to view detailed schedule analysis for that project
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <DataTable<ProjectSummary>
              columns={portfolioColumns}
              data={projects ?? []}
              keyField="id"
              onRowClick={handlePortfolioRowClick}
              searchable
              searchFields={['name']}
              emptyMessage="No projects found. Ingest project files to get started."
            />
          </div>
        </section>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /* Render: Project Mode (specific project selected)                  */
  /* ---------------------------------------------------------------- */

  const selectedProject = projects?.find((p) => p.id === selectedProjectId);
  const isProjectLoading = scheduleLoading || tasksLoading;
  const projectError = scheduleError || tasksError;

  return (
    <div className="p-6 space-y-8">
      <PageHeader
        title="Schedule Analysis"
        actions={
          <ProjectSelector
            projects={projects ?? []}
            selectedId={selectedProjectId}
            onChange={handleProjectSelect}
          />
        }
      />

      {/* Project name banner */}
      {selectedProject && (
        <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-4 py-2.5 text-sm text-blue-800">
          <CalendarDays className="h-4 w-4" />
          <span className="font-semibold">{selectedProject.name}</span>
          <span className="text-blue-600">
            ({selectedProject.task_count} tasks)
          </span>
        </div>
      )}

      {isProjectLoading && (
        <LoadingState message="Loading schedule metrics..." />
      )}

      {projectError && (
        <ErrorState
          message={
            projectError instanceof Error
              ? projectError.message
              : 'Failed to load schedule data'
          }
          onRetry={() => {
            refetchSchedule();
            refetchTasks();
          }}
        />
      )}

      {!isProjectLoading && !projectError && scheduleMetrics && (
        <>
          {/* Schedule Metric Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Schedule Variance"
              value={formatDays(scheduleMetrics.schedule_variance_days)}
              icon={<CalendarDays className="h-5 w-5" />}
              className={
                scheduleMetrics.schedule_variance_days !== null &&
                scheduleMetrics.schedule_variance_days >= 0
                  ? 'border-green-200 bg-green-50/30'
                  : 'border-red-200 bg-red-50/30'
              }
            />
            <MetricCard
              label="SPI"
              value={formatIndex(scheduleMetrics.spi)}
              icon={<TrendingUp className="h-5 w-5" />}
            />
            <MetricCard
              label="Milestones On Track"
              value={`${scheduleMetrics.milestones_on_track} / ${scheduleMetrics.total_milestones}`}
              icon={<Flag className="h-5 w-5" />}
            />
            <MetricCard
              label="Critical Tasks Behind"
              value={scheduleMetrics.critical_tasks_behind.length}
              icon={<AlertTriangle className="h-5 w-5" />}
              className={
                scheduleMetrics.critical_tasks_behind.length > 0
                  ? 'border-red-200 bg-red-50/30'
                  : ''
              }
            />
          </div>

          {/* Interactive Gantt Chart */}
          {tasks && tasks.length > 0 && (
            <section>
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Interactive Gantt Chart
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Drag tasks to explore what-if scenarios. Toggle baseline overlay to compare.
                </p>
              </div>
              <div className="space-y-3">
                <GanttToolbar
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                  showBaseline={showBaseline}
                  onBaselineToggle={() => setShowBaseline((prev) => !prev)}
                  isEdited={isEdited}
                  onReset={handleGanttReset}
                  filterCritical={filterCritical}
                  onFilterCriticalToggle={() => setFilterCritical((prev) => !prev)}
                  filterMilestones={filterMilestones}
                  onFilterMilestonesToggle={() => setFilterMilestones((prev) => !prev)}
                  searchTerm={searchTerm}
                  onSearchChange={setSearchTerm}
                />
                <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                  <InteractiveGantt
                    tasks={tasks}
                    viewMode={viewMode}
                    showBaseline={showBaseline}
                    filterCritical={filterCritical}
                    filterMilestones={filterMilestones}
                    searchTerm={searchTerm}
                    onTaskChange={() => setIsEdited(true)}
                  />
                </div>
              </div>
            </section>
          )}

          {/* Slipped Milestones Table */}
          {sortedSlippedMilestones.length > 0 && (
            <section>
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Slipped Milestones
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Milestones that have slipped beyond their baseline finish date
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <DataTable<SlippedMilestone>
                  columns={slippedMilestoneColumns}
                  data={sortedSlippedMilestones}
                  keyField="task_uid"
                  emptyMessage="No slipped milestones."
                />
              </div>
            </section>
          )}

          {/* Task Schedule Variance Bar Chart */}
          {taskVarianceData.length > 0 && (
            <section>
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Task Schedule Variance
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Days ahead (green) or behind (red) baseline for each task
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <CostVarianceBar data={taskVarianceData} />
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

export default ScheduleAnalysis;
