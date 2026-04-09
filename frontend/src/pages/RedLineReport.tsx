import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  AlertOctagon,
  ShieldAlert,
} from 'lucide-react';

import { useProjects } from '../api/projects';
import { useDeviations, useDeviationSummary } from '../api/deviations';
import type { DeviationItem } from '../api/types';
import PageHeader from '../components/layout/PageHeader';
import { MetricCard } from '../components/ui/MetricCard';
import { DataTable } from '../components/ui/DataTable';
import type { Column } from '../components/ui/DataTable';
import { SeverityBadge } from '../components/ui/SeverityBadge';
import { FilterBar } from '../components/ui/FilterBar';
import { LoadingState } from '../components/ui/LoadingState';
import { ErrorState } from '../components/ui/ErrorState';
import { DeviationPie } from '../components/charts/DeviationPie';
import { DeviationTimeline } from '../components/charts/DeviationTimeline';
import { SeverityHeatmap } from '../components/charts/SeverityHeatmap';
import type { HeatmapRow } from '../components/charts/SeverityHeatmap';
import { CostVarianceBar } from '../components/charts/CostVarianceBar';
import { formatVariance } from '../lib/formatters';
import { useFilterStore } from '../stores/filterStore';
import { useChatStore } from '../stores/chatStore';

const DEVIATION_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'schedule_slippage', label: 'Schedule Slippage' },
  { value: 'cost_overrun', label: 'Cost Overrun' },
  { value: 'milestone_slippage', label: 'Milestone Slippage' },
  { value: 'duration_overrun', label: 'Duration Overrun' },
  { value: 'cpi_critical', label: 'CPI Critical' },
  { value: 'spi_critical', label: 'SPI Critical' },
];

const SEVERITY_OPTIONS = [
  { value: '', label: 'All Severities' },
  { value: 'critical', label: 'Critical' },
  { value: 'warning', label: 'Warning' },
];

type VisualizationTab = 'timeline' | 'heatmap' | 'distribution' | 'by-project';

function formatDeviationType(raw: string): string {
  return raw
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function truncateText(text: string, maxLen: number): string {
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
}

function RedLineReport() {
  const navigate = useNavigate();
  const setContext = useChatStore((s) => s.setContext);

  const selectedProjectId = useFilterStore((s) => s.selectedProjectId);
  const severityFilter = useFilterStore((s) => s.severityFilter);
  const deviationTypeFilter = useFilterStore((s) => s.deviationTypeFilter);
  const setProjectId = useFilterStore((s) => s.setProjectId);
  const setSeverity = useFilterStore((s) => s.setSeverity);
  const setDeviationType = useFilterStore((s) => s.setDeviationType);

  const [activeTab, setActiveTab] = useState<VisualizationTab>('timeline');

  const {
    data: projects,
    isLoading: projectsLoading,
  } = useProjects();

  const apiFilters = useMemo(() => ({
    severity: severityFilter || undefined,
    project_id: selectedProjectId ?? undefined,
    type: deviationTypeFilter || undefined,
  }), [severityFilter, selectedProjectId, deviationTypeFilter]);

  const {
    data: deviations,
    isLoading: deviationsLoading,
    error: deviationsError,
    refetch: refetchDeviations,
  } = useDeviations(apiFilters);

  const {
    data: summary,
    isLoading: summaryLoading,
    error: summaryError,
    refetch: refetchSummary,
  } = useDeviationSummary();

  // Update chat context when filters change
  useEffect(() => {
    const filters: Record<string, string> = {};
    if (severityFilter) filters.severity = severityFilter;
    if (deviationTypeFilter) filters.type = deviationTypeFilter;
    if (selectedProjectId !== null) filters.project_id = String(selectedProjectId);
    setContext({ page: 'red-line-report', filters });
  }, [setContext, severityFilter, deviationTypeFilter, selectedProjectId]);

  // Build project filter options from loaded projects
  const projectFilterOptions = useMemo(() => {
    const opts = [{ value: '', label: 'All Projects' }];
    if (projects) {
      projects.forEach((p) => {
        opts.push({ value: String(p.id), label: p.name });
      });
    }
    return opts;
  }, [projects]);

  // Build heatmap data: group deviations by project_id, count by type
  const heatmapData: HeatmapRow[] = useMemo(() => {
    if (!deviations) return [];
    const projectMap = new Map<number, { project_name: string; type_counts: Record<string, number> }>();
    deviations.forEach((d) => {
      let entry = projectMap.get(d.project_id);
      if (!entry) {
        entry = { project_name: d.project_name, type_counts: {} };
        projectMap.set(d.project_id, entry);
      }
      entry.type_counts[d.deviation_type] = (entry.type_counts[d.deviation_type] ?? 0) + 1;
    });
    return Array.from(projectMap.entries()).map(([project_id, entry]) => ({
      project_id,
      project_name: entry.project_name,
      type_counts: entry.type_counts,
    }));
  }, [deviations]);

  // Build data for "Deviations by Project" horizontal bar chart
  const projectBarData = useMemo(() => {
    if (!summary?.by_project) return [];
    return Object.entries(summary.by_project).map(([name, count]) => ({
      name,
      variance: count,
    }));
  }, [summary]);

  // Severity pie data
  const severityPieData: Record<string, number> = useMemo(() => {
    if (!summary) return {} as Record<string, number>;
    return {
      critical: summary.critical,
      warning: summary.warning,
    };
  }, [summary]);

  // Table columns
  const deviationColumns: Column<DeviationItem>[] = useMemo(() => [
    {
      key: 'severity',
      label: 'Severity',
      render: (value) => <SeverityBadge severity={value as string} />,
      className: 'w-28',
    },
    {
      key: 'project_name',
      label: 'Project',
      render: (_value, row) => (
        <button
          type="button"
          className="font-medium text-blue-600 hover:text-blue-800 hover:underline text-left"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/project/${row.project_id}`);
          }}
        >
          {row.project_name}
        </button>
      ),
    },
    {
      key: 'deviation_type',
      label: 'Type',
      render: (value) => formatDeviationType(value as string),
    },
    {
      key: 'metric_name',
      label: 'Metric',
    },
    {
      key: 'baseline_value',
      label: 'Baseline',
      render: (value) => (value as string | null) ?? '-',
    },
    {
      key: 'actual_value',
      label: 'Actual',
      render: (value) => (value as string | null) ?? '-',
    },
    {
      key: 'variance',
      label: 'Variance',
      render: (value) => formatVariance(value as number | null),
    },
    {
      key: 'description',
      label: 'Description',
      render: (value) => (
        <span title={value as string}>
          {truncateText((value as string) ?? '', 80)}
        </span>
      ),
      sortable: false,
      className: 'max-w-xs',
    },
  ], [navigate]);

  const isLoading = projectsLoading || deviationsLoading || summaryLoading;
  const error = deviationsError || summaryError;

  if (isLoading) {
    return (
      <div className="p-6">
        <PageHeader
          title="Red Line Report"
          subtitle="Baseline deviations and anomaly tracking"
        />
        <LoadingState message="Loading deviation data..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <PageHeader
          title="Red Line Report"
          subtitle="Baseline deviations and anomaly tracking"
        />
        <ErrorState
          message={error instanceof Error ? error.message : 'Failed to load deviation data'}
          onRetry={() => {
            refetchDeviations();
            refetchSummary();
          }}
        />
      </div>
    );
  }

  const handleHeatmapCellClick = (projectId: number, type: string) => {
    setProjectId(projectId);
    setDeviationType(type);
  };

  const handleTypePieSliceClick = (key: string) => {
    setDeviationType(key);
  };

  const handleSeverityPieSliceClick = (key: string) => {
    setSeverity(key);
  };

  const tabs: { key: VisualizationTab; label: string }[] = [
    { key: 'timeline', label: 'Deviation Timeline' },
    { key: 'heatmap', label: 'Severity Heatmap' },
    { key: 'distribution', label: 'Distribution' },
    { key: 'by-project', label: 'By Project' },
  ];

  return (
    <div className="p-6 space-y-8">
      <PageHeader
        title="Red Line Report"
        subtitle="Baseline deviations and anomaly tracking"
      />

      {/* Filter Bar */}
      <FilterBar
        filters={[
          {
            key: 'severity',
            label: 'Severity',
            options: SEVERITY_OPTIONS,
            value: severityFilter,
            onChange: setSeverity,
          },
          {
            key: 'project',
            label: 'Project',
            options: projectFilterOptions,
            value: selectedProjectId !== null ? String(selectedProjectId) : '',
            onChange: (val) => setProjectId(val ? Number(val) : null),
          },
          {
            key: 'type',
            label: 'Type',
            options: DEVIATION_TYPE_OPTIONS,
            value: deviationTypeFilter,
            onChange: setDeviationType,
          },
        ]}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          label="Total Deviations"
          value={summary?.total ?? 0}
          icon={<ShieldAlert className="h-5 w-5" />}
        />
        <MetricCard
          label="Critical"
          value={summary?.critical ?? 0}
          icon={<AlertOctagon className="h-5 w-5" />}
          className="border-red-200 bg-red-50/30"
        />
        <MetricCard
          label="Warnings"
          value={summary?.warning ?? 0}
          icon={<AlertTriangle className="h-5 w-5" />}
          className="border-orange-200 bg-orange-50/30"
        />
      </div>

      {/* Visualization Tabs */}
      <section>
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-6" aria-label="Visualization tabs">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab 1: Deviation Timeline */}
        {activeTab === 'timeline' && (
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Deviation Timeline
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Scatter chart showing variance magnitude per deviation. Color by type, size by severity. Use the brush to zoom.
            </p>
            <DeviationTimeline
              deviations={deviations ?? []}
            />
          </div>
        )}

        {/* Tab 2: Severity Heatmap */}
        {activeTab === 'heatmap' && (
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Severity Heatmap
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Deviation counts grouped by project and type. Click a cell to filter to that combination.
            </p>
            <SeverityHeatmap
              data={heatmapData}
              onCellClick={handleHeatmapCellClick}
            />
          </div>
        )}

        {/* Tab 3: Distribution */}
        {activeTab === 'distribution' && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <DeviationPie
                data={summary?.by_type ?? {}}
                title="By Type"
                onSliceClick={handleTypePieSliceClick}
              />
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <DeviationPie
                data={severityPieData}
                title="By Severity"
                colorMap={{ critical: '#dc2626', warning: '#d97706' }}
                onSliceClick={handleSeverityPieSliceClick}
              />
            </div>
          </div>
        )}

        {/* Tab 4: Deviations by Project */}
        {activeTab === 'by-project' && (
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Deviations by Project
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Total deviation count per project shown as horizontal bars.
            </p>
            <CostVarianceBar data={projectBarData} />
          </div>
        )}
      </section>

      {/* Deviation Details Table */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Deviation Details
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Full list of detected deviations — click a project name to drill down
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <DataTable<DeviationItem>
            columns={deviationColumns}
            data={deviations ?? []}
            keyField="id"
            searchable
            searchFields={['project_name', 'description']}
            emptyMessage="No deviations match the current filters."
          />
        </div>
      </section>
    </div>
  );
}

export default RedLineReport;
