import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building,
  ListChecks,
  AlertTriangle,
  AlertOctagon,
  DollarSign,
  TrendingDown,
  Wallet,
} from 'lucide-react';

import { usePortfolioSummary, usePortfolioHealth } from '../api/portfolio';
import type { ProjectHealth } from '../api/types';
import PageHeader from '../components/layout/PageHeader';
import { MetricCard } from '../components/ui/MetricCard';
import { DataTable } from '../components/ui/DataTable';
import type { Column } from '../components/ui/DataTable';
import { LoadingState } from '../components/ui/LoadingState';
import { ErrorState } from '../components/ui/ErrorState';
import { CpiSpiScatter } from '../components/charts/CpiSpiScatter';
import { formatCurrency, formatIndex } from '../lib/formatters';
import { useChatStore } from '../stores/chatStore';

function cpiColor(cpi: number | null): string {
  if (cpi === null) return 'text-gray-400';
  if (cpi >= 1.0) return 'text-green-600';
  if (cpi >= 0.9) return 'text-amber-600';
  return 'text-red-600';
}

function spiColor(spi: number | null): string {
  if (spi === null) return 'text-gray-400';
  if (spi >= 1.0) return 'text-green-600';
  if (spi >= 0.9) return 'text-amber-600';
  return 'text-red-600';
}

const healthColumns: Column<ProjectHealth>[] = [
  {
    key: 'name',
    label: 'Project Name',
    render: (_value, row) => (
      <span className="font-medium text-blue-600 hover:text-blue-800 hover:underline">
        {row.name}
      </span>
    ),
  },
  {
    key: 'tasks',
    label: 'Tasks',
  },
  {
    key: 'budget',
    label: 'Budget',
    render: (value) => formatCurrency(value as number),
  },
  {
    key: 'actual_cost',
    label: 'Actual Cost',
    render: (value) => formatCurrency(value as number),
  },
  {
    key: 'cpi',
    label: 'CPI',
    render: (value) => (
      <span className={`font-semibold ${cpiColor(value as number | null)}`}>
        {formatIndex(value as number | null)}
      </span>
    ),
  },
  {
    key: 'spi',
    label: 'SPI',
    render: (value) => (
      <span className={`font-semibold ${spiColor(value as number | null)}`}>
        {formatIndex(value as number | null)}
      </span>
    ),
  },
  {
    key: 'critical_issues',
    label: 'Critical Issues',
    render: (value) => {
      const count = value as number;
      if (count === 0) {
        return <span className="text-gray-400">0</span>;
      }
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700">
          <AlertOctagon className="h-3 w-3" />
          {count}
        </span>
      );
    },
  },
];

function Overview() {
  const navigate = useNavigate();
  const setContext = useChatStore((s) => s.setContext);

  const {
    data: summary,
    isLoading: summaryLoading,
    error: summaryError,
    refetch: refetchSummary,
  } = usePortfolioSummary();

  const {
    data: healthData,
    isLoading: healthLoading,
    error: healthError,
    refetch: refetchHealth,
  } = usePortfolioHealth();

  useEffect(() => {
    setContext({ page: 'overview' });
  }, [setContext]);

  const isLoading = summaryLoading || healthLoading;
  const error = summaryError || healthError;

  const sortedHealth = useMemo(() => {
    if (!healthData) return [];
    return [...healthData].sort(
      (a, b) => b.critical_issues - a.critical_issues
    );
  }, [healthData]);

  const scatterData = useMemo(() => {
    if (!healthData) return [];
    return healthData
      .filter((p) => p.cpi !== null && p.spi !== null)
      .map((p) => ({
        id: p.id,
        name: p.name,
        cpi: p.cpi,
        spi: p.spi,
      }));
  }, [healthData]);

  const costVariance = useMemo(() => {
    if (!summary) return 0;
    return summary.total_baseline_cost - summary.total_actual_cost;
  }, [summary]);

  const costVariancePct = useMemo(() => {
    if (!summary || summary.total_baseline_cost === 0) return 0;
    return (costVariance / summary.total_baseline_cost) * 100;
  }, [summary, costVariance]);

  if (isLoading) {
    return (
      <div className="p-6">
        <PageHeader
          title="Portfolio Overview"
          subtitle="Executive summary of all projects"
        />
        <LoadingState message="Loading portfolio data..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <PageHeader
          title="Portfolio Overview"
          subtitle="Executive summary of all projects"
        />
        <ErrorState
          message={error instanceof Error ? error.message : 'Failed to load portfolio data'}
          onRetry={() => {
            refetchSummary();
            refetchHealth();
          }}
        />
      </div>
    );
  }

  const handlePointClick = (id: number) => {
    navigate(`/project/${id}`);
  };

  const handleRowClick = (row: ProjectHealth) => {
    navigate(`/project/${row.id}`);
  };

  return (
    <div className="p-6 space-y-8">
      <PageHeader
        title="Portfolio Overview"
        subtitle="Executive summary of all projects"
      />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Projects"
          value={summary?.total_projects ?? 0}
          icon={<Building className="h-5 w-5" />}
        />
        <MetricCard
          label="Total Tasks"
          value={summary?.total_tasks ?? 0}
          icon={<ListChecks className="h-5 w-5" />}
        />
        <MetricCard
          label="Total Deviations"
          value={summary?.total_deviations ?? 0}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
        <MetricCard
          label="Critical Issues"
          value={summary?.critical_deviations ?? 0}
          icon={<AlertOctagon className="h-5 w-5" />}
          className="border-red-200 bg-red-50/30"
        />
      </div>

      {/* Cost Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          label="Total Budget"
          value={formatCurrency(summary?.total_baseline_cost ?? 0)}
          icon={<Wallet className="h-5 w-5" />}
        />
        <MetricCard
          label="Total Actual Cost"
          value={formatCurrency(summary?.total_actual_cost ?? 0)}
          icon={<DollarSign className="h-5 w-5" />}
        />
        <MetricCard
          label="Cost Variance"
          value={formatCurrency(costVariance)}
          delta={`${costVariancePct >= 0 ? '+' : ''}${costVariancePct.toFixed(1)}%`}
          deltaPositive={costVariance >= 0}
          icon={<TrendingDown className="h-5 w-5" />}
        />
      </div>

      {/* CPI/SPI Performance Matrix */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Project Performance Matrix
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            CPI vs SPI scatter plot — click a point to view project details
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <CpiSpiScatter data={scatterData} onPointClick={handlePointClick} />
        </div>
      </section>

      {/* Project Health Table */}
      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Project Health Overview
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            All projects sorted by critical issues — click a row to drill down
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <DataTable<ProjectHealth>
            columns={healthColumns}
            data={sortedHealth}
            keyField="id"
            onRowClick={handleRowClick}
            searchable
            searchFields={['name']}
            emptyMessage="No projects found. Ingest project files to get started."
          />
        </div>
      </section>
    </div>
  );
}

export default Overview;
