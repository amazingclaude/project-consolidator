import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ResponsiveGridLayout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import {
  Plus,
  RotateCcw,
  ChevronDown,
  Search,
  FileType,
  ListChecks,
  AlertTriangle,
  CalendarRange,
} from 'lucide-react';

import { useProjects, useProject } from '../api/projects';
import { useLayoutStore } from '../stores/layoutStore';
import type { LayoutItem } from '../stores/layoutStore';
import PageHeader from '../components/layout/PageHeader';
import { LoadingState } from '../components/ui/LoadingState';
import { formatDate } from '../lib/formatters';

import { WidgetWrapper } from '../widgets/WidgetWrapper';
import { WidgetCatalog } from '../widgets/WidgetCatalog';
import { CostOverviewWidget } from '../widgets/CostOverviewWidget';
import { ScheduleOverviewWidget } from '../widgets/ScheduleOverviewWidget';
import { GanttWidget } from '../widgets/GanttWidget';
import { DeviationTableWidget } from '../widgets/DeviationTableWidget';
import { IntegrityWidget } from '../widgets/IntegrityWidget';
import { TimeMetricsWidget } from '../widgets/TimeMetricsWidget';
import { MilestoneTrackerWidget } from '../widgets/MilestoneTrackerWidget';
import { CpiSpiWidget } from '../widgets/CpiSpiWidget';
import { ResourceWidget } from '../widgets/ResourceWidget';

/* ------------------------------------------------------------------ */
/* Widget registry: maps widget IDs to their component + display name  */
/* ------------------------------------------------------------------ */

interface WidgetDef {
  title: string;
  render: (projectId: number) => React.ReactNode;
}

const WIDGET_MAP: Record<string, WidgetDef> = {
  'cost-overview': {
    title: 'Cost Overview',
    render: (id) => <CostOverviewWidget projectId={id} />,
  },
  'schedule-overview': {
    title: 'Schedule Overview',
    render: (id) => <ScheduleOverviewWidget projectId={id} />,
  },
  gantt: {
    title: 'Interactive Gantt',
    render: (id) => <GanttWidget projectId={id} />,
  },
  'deviation-table': {
    title: 'Deviation Table',
    render: (id) => <DeviationTableWidget projectId={id} />,
  },
  integrity: {
    title: 'Data Integrity',
    render: (id) => <IntegrityWidget projectId={id} />,
  },
  'time-metrics': {
    title: 'Time Metrics',
    render: (id) => <TimeMetricsWidget projectId={id} />,
  },
  'milestone-tracker': {
    title: 'Milestone Tracker',
    render: (id) => <MilestoneTrackerWidget projectId={id} />,
  },
  'cpi-spi': {
    title: 'CPI/SPI Gauges',
    render: (id) => <CpiSpiWidget projectId={id} />,
  },
  resource: {
    title: 'Resource Summary',
    render: (id) => <ResourceWidget projectId={id} />,
  },
};

/* ------------------------------------------------------------------ */
/* Project Selector                                                    */
/* ------------------------------------------------------------------ */

interface ProjectSelectorProps {
  onSelect: (id: number) => void;
}

function ProjectSelector({ onSelect }: ProjectSelectorProps) {
  const { data: projects, isLoading } = useProjects();
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!projects) return [];
    if (!search.trim()) return projects;
    const term = search.toLowerCase();
    return projects.filter((p) => p.name.toLowerCase().includes(term));
  }, [projects, search]);

  if (isLoading) {
    return <LoadingState message="Loading projects..." />;
  }

  if (!projects || projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <ListChecks className="h-12 w-12 text-gray-300" />
        <h2 className="mt-4 text-lg font-semibold text-gray-700">No Projects Found</h2>
        <p className="mt-1 text-sm text-gray-500">
          Ingest project files to get started with deep-dive analysis.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl py-12">
      <div className="text-center">
        <h2 className="text-xl font-bold text-gray-900">Select a Project</h2>
        <p className="mt-1 text-sm text-gray-500">
          Choose a project to view detailed analysis and metrics
        </p>
      </div>

      <div className="relative mt-6">
        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder="Search projects..."
            className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-10 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Dropdown list */}
        {isOpen && (
          <div className="absolute z-20 mt-2 max-h-80 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
            {filtered.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-400">
                No matching projects
              </div>
            ) : (
              filtered.map((project) => (
                <button
                  key={project.id}
                  onClick={() => {
                    onSelect(project.id);
                    setIsOpen(false);
                  }}
                  className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-blue-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {project.name}
                    </p>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-500">
                      <span className="inline-flex items-center gap-1">
                        <FileType className="h-3 w-3" />
                        {project.file_format}
                      </span>
                      <span>{project.task_count} tasks</span>
                      {project.deviation_count > 0 && (
                        <span className="text-orange-600">
                          {project.deviation_count} deviations
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Project Info Bar                                                     */
/* ------------------------------------------------------------------ */

interface ProjectInfoBarProps {
  projectId: number;
}

function ProjectInfoBar({ projectId }: ProjectInfoBarProps) {
  const { data: project, isLoading } = useProject(projectId);

  if (isLoading || !project) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-5 py-3 shadow-sm">
        <div className="h-5 w-40 animate-pulse rounded bg-gray-200" />
        <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-gray-200 bg-white px-5 py-3 shadow-sm">
      {/* Project name */}
      <h2 className="text-lg font-bold text-gray-900">{project.name}</h2>

      {/* File format badge */}
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
        <FileType className="h-3 w-3" />
        {project.file_format}
      </span>

      {/* Stats */}
      <span className="inline-flex items-center gap-1 text-xs text-gray-500">
        <ListChecks className="h-3.5 w-3.5" />
        {project.task_count} tasks
      </span>

      <span className="inline-flex items-center gap-1 text-xs text-gray-500">
        <AlertTriangle className="h-3.5 w-3.5" />
        {project.deviation_count} deviations
      </span>

      {(project.start || project.finish) && (
        <span className="inline-flex items-center gap-1 text-xs text-gray-500">
          <CalendarRange className="h-3.5 w-3.5" />
          {formatDate(project.start)} &mdash; {formatDate(project.finish)}
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main Page Component                                                 */
/* ------------------------------------------------------------------ */

function ProjectDeepDive() {
  const { projectId: paramId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [catalogOpen, setCatalogOpen] = useState(false);

  // Measure container width for ResponsiveGridLayout
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1200);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Parse numeric project ID from URL params
  const projectId = paramId ? Number(paramId) : null;

  // Layout store
  const getLayout = useLayoutStore((s) => s.getLayout);
  const getActiveWidgets = useLayoutStore((s) => s.getActiveWidgets);
  const saveLayout = useLayoutStore((s) => s.saveLayout);
  const addWidget = useLayoutStore((s) => s.addWidget);
  const removeWidget = useLayoutStore((s) => s.removeWidget);
  const resetLayout = useLayoutStore((s) => s.resetLayout);

  // Derive current layout and active widgets using project ID as key
  const projectKey = projectId !== null ? String(projectId) : '';
  const currentLayout = projectKey ? getLayout(projectKey) : [];
  const activeWidgets = projectKey ? getActiveWidgets(projectKey) : [];

  // Handle layout change from react-grid-layout
  const handleLayoutChange = useCallback(
    (layout: LayoutItem[]) => {
      if (!projectKey) return;
      saveLayout(projectKey, layout);
    },
    [projectKey, saveLayout],
  );

  // Handle add widget from catalog
  const handleAddWidget = useCallback(
    (widgetId: string) => {
      if (!projectKey) return;
      addWidget(projectKey, widgetId);
    },
    [projectKey, addWidget],
  );

  // Handle remove widget
  const handleRemoveWidget = useCallback(
    (widgetId: string) => {
      if (!projectKey) return;
      removeWidget(projectKey, widgetId);
    },
    [projectKey, removeWidget],
  );

  // Handle reset layout
  const handleResetLayout = useCallback(() => {
    if (!projectKey) return;
    resetLayout(projectKey);
  }, [projectKey, resetLayout]);

  // Handle project selection
  const handleSelectProject = useCallback(
    (id: number) => {
      navigate(`/project/${id}`);
    },
    [navigate],
  );

  // Convert LayoutItem[] to the format react-grid-layout expects
  const gridLayouts = useMemo(() => {
    // Filter layout to only include items for active widgets
    const filteredLayout = currentLayout.filter((item) =>
      activeWidgets.includes(item.i),
    );
    return {
      lg: filteredLayout,
      md: filteredLayout.map((item) => ({
        ...item,
        w: Math.min(item.w, 8),
      })),
      sm: filteredLayout.map((item) => ({
        ...item,
        w: Math.min(item.w, 4),
        x: 0,
      })),
    };
  }, [currentLayout, activeWidgets]);

  // No project selected — show selector
  if (projectId === null || isNaN(projectId)) {
    return (
      <div className="p-6">
        <PageHeader
          title="Project Deep Dive"
          subtitle="Select a project for detailed analysis"
        />
        <ProjectSelector onSelect={handleSelectProject} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <PageHeader
        title="Project Deep Dive"
        subtitle="Configurable widget dashboard for detailed project analysis"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCatalogOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 active:bg-blue-800"
            >
              <Plus className="h-4 w-4" />
              Add Widget
            </button>
            <button
              onClick={handleResetLayout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-600 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-800"
            >
              <RotateCcw className="h-4 w-4" />
              Reset Layout
            </button>
          </div>
        }
      />

      {/* Project Info Bar */}
      <ProjectInfoBar projectId={projectId} />

      {/* Widget Grid */}
      {activeWidgets.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-16 text-center">
          <Plus className="h-10 w-10 text-gray-300" />
          <h3 className="mt-3 text-sm font-semibold text-gray-600">
            No widgets added
          </h3>
          <p className="mt-1 text-xs text-gray-400">
            Click &quot;Add Widget&quot; to build your dashboard
          </p>
          <button
            onClick={() => setCatalogOpen(true)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Add Widget
          </button>
        </div>
      ) : (
        <div ref={containerRef}>
        <ResponsiveGridLayout
          className="layout"
          width={containerWidth}
          layouts={gridLayouts}
          breakpoints={{ lg: 1200, md: 996, sm: 768 }}
          cols={{ lg: 12, md: 8, sm: 4 }}
          rowHeight={100}
          dragConfig={{ enabled: true, handle: '.drag-handle' }}
          resizeConfig={{ enabled: true }}
          onLayoutChange={(layout: readonly LayoutItem[]) => handleLayoutChange([...layout])}
          margin={[16, 16] as readonly [number, number]}
          containerPadding={[0, 0] as readonly [number, number]}
        >
          {activeWidgets.map((widgetId) => {
            const widgetDef = WIDGET_MAP[widgetId];
            if (!widgetDef) return null;

            return (
              <div key={widgetId}>
                <WidgetWrapper
                  id={widgetId}
                  title={widgetDef.title}
                  onRemove={() => handleRemoveWidget(widgetId)}
                >
                  {widgetDef.render(projectId)}
                </WidgetWrapper>
              </div>
            );
          })}
        </ResponsiveGridLayout>
        </div>
      )}

      {/* Widget Catalog Modal */}
      <WidgetCatalog
        isOpen={catalogOpen}
        onClose={() => setCatalogOpen(false)}
        onAddWidget={(widgetId) => {
          handleAddWidget(widgetId);
          setCatalogOpen(false);
        }}
        activeWidgets={activeWidgets}
      />
    </div>
  );
}

export default ProjectDeepDive;
