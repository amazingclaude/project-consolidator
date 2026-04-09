import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wallet,
  DollarSign,
  TrendingDown,
  Gauge,
} from 'lucide-react';

import { useProjects } from '../api/projects';
import { usePortfolioHealth } from '../api/portfolio';
import { fetchApi } from '../api/client';
import type { ProjectSummary, CostMetrics } from '../api/types';
import PageHeader from '../components/layout/PageHeader';
import { MetricCard } from '../components/ui/MetricCard';
import { DataTable } from '../components/ui/DataTable';
import type { Column } from '../components/ui/DataTable';
import { LoadingState } from '../components/ui/LoadingState';
import { ErrorState } from '../components/ui/ErrorState';
import { BudgetActualBar } from '../components/charts/BudgetActualBar';
import { CostVarianceBar } from '../components/charts/CostVarianceBar';
import { CpiGauge } from '../components/charts/CpiGauge';
import { EacWaterfall } from '../components/charts/EacWaterfall';
import { formatCurrency, formatIndex, formatPct } from '../lib/formatters';
import { useChatStore } from '../stores/chatStore';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface ProjectCostEntry {
  project: ProjectSummary;
  metrics: CostMetrics;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function cpiZone(
  cpi: number | null,
  warningThreshold: number,
  criticalThreshold: number
): 'good' | 'warning' | 'critical' | 'none' {
  if (cpi === null) return 'none';
  if (cpi >= warningThreshold) return 'good';
  if (cpi >= criticalThreshold) return 'warning';
  return 'critical';
}

function cpiZoneColor(zone: 'good' | 'warning' | 'critical' | 'none'): string {
  switch (zone) {
    case 'good':
      return 'text-green-600';
    case 'warning':
      return 'text-amber-600';
    case 'critical':
      return 'text-red-600';
    default:
      return 'text-gray-400';
  }
}

/* ------------------------------------------------------------------ */
/* Main Component                                                      */
/* ------------------------------------------------------------------ */

function CostAnalysis() {
  const navigate = useNavigate();
  const setContext = useChatStore((s) => s.setContext);

  // Threshold sliders
  const [cpiWarning, setCpiWarning] = useState(0.9);
  const [cpiCritical, setCpiCritical] = useState(0.8);

  // Cost data loaded via useEffect
  const [costEntries, setCostEntries] = useState<ProjectCostEntry[]>([]);
  const [costLoading, setCostLoading] = useState(false);
  const [costError, setCostError] = useState<string | null>(null);

  // Data fetches
  const {
    data: projects,
    isLoading: projectsLoading,
    error: projectsError,
    refetch: refetchProjects,
  } = useProjects();

  const {
    isLoading: healthLoading,
    error: healthError,
    refetch: refetchHealth,
  } = usePortfolioHealth();

  // Set chat context on mount
  useEffect(() => {
    setContext({ page: 'cost' });
  }, [setContext]);

  // Fetch cost metrics for all projects once projects are loaded
  useEffect(() => {
    if (!projects || projects.length === 0) {
      setCostEntries([]);
      return;
    }

    let cancelled = false;
    setCostLoading(true);
    setCostError(null);

    async function fetchAllCosts() {
      const results: ProjectCostEntry[] = [];

      const promises = projects!.map(async (project) => {
        try {
          const metrics = await fetchApi<CostMetrics>(
            `/api/projects/${project.id}/cost-metrics`
          );
          return { project, metrics };
        } catch {
          // Skip projects that fail to fetch cost metrics
          return null;
        }
      });

      const settled = await Promise.all(promises);
      for (const result of settled) {
        if (result !== null) {
          results.push(result);
        }
      }

      if (!cancelled) {
        setCostEntries(results);
        setCostLoading(false);
      }
    }

    fetchAllCosts().catch((err) => {
      if (!cancelled) {
        setCostError(
          err instanceof Error ? err.message : 'Failed to load cost metrics'
        );
        setCostLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [projects]);

  /* ---------------------------------------------------------------- */
  /* Computed values                                                    */
  /* ---------------------------------------------------------------- */

  const totalBudget = useMemo(
    () => costEntries.reduce((sum, e) => sum + e.metrics.budget_at_completion, 0),
    [costEntries]
  );

  const totalActual = useMemo(
    () => costEntries.reduce((sum, e) => sum + e.metrics.actual_cost, 0),
    [costEntries]
  );

  const totalVariance = useMemo(
    () =>
      costEntries.reduce(
        (sum, e) => sum + (e.metrics.cost_variance ?? 0),
        0
      ),
    [costEntries]
  );

  const averageCpi = useMemo(() => {
    const validEntries = costEntries.filter((e) => e.metrics.cpi !== null);
    if (validEntries.length === 0) return null;
    return (
      validEntries.reduce((sum, e) => sum + (e.metrics.cpi ?? 0), 0) /
      validEntries.length
    );
  }, [costEntries]);

  const budgetActualData = useMemo(
    () =>
      costEntries.map((e) => ({
        name: e.project.name,
        budget: e.metrics.budget_at_completion,
        actual: e.metrics.actual_cost,
        id: e.project.id,
      })),
    [costEntries]
  );

  const costVarianceData = useMemo(
    () =>
      costEntries
        .filter((e) => e.metrics.cost_variance !== null)
        .map((e) => ({
          name: e.project.name,
          variance: e.metrics.cost_variance!,
          id: e.project.id,
        })),
    [costEntries]
  );

  const gaugeProjects = useMemo(
    () => costEntries.filter((e) => e.metrics.cpi !== null),
    [costEntries]
  );

  const eacData = useMemo(
    () =>
      costEntries
        .filter((e) => e.metrics.eac !== null)
        .map((e) => ({
          name: e.project.name,
          budget: e.metrics.budget_at_completion,
          eac: e.metrics.eac!,
          cpi: e.metrics.cpi,
        })),
    [costEntries]
  );

  // Threshold zone counts
  const zoneCounts = useMemo(() => {
    let good = 0;
    let warning = 0;
    let critical = 0;
    for (const e of costEntries) {
      const zone = cpiZone(e.metrics.cpi, cpiWarning, cpiCritical);
      if (zone === 'good') good++;
      else if (zone === 'warning') warning++;
      else if (zone === 'critical') critical++;
    }
    return { good, warning, critical };
  }, [costEntries, cpiWarning, cpiCritical]);

  // Table columns (depend on threshold values for color coding)
  const costTableColumns: Column<ProjectCostEntry>[] = useMemo(
    () => [
      {
        key: 'project.name',
        label: 'Project',
        render: (_value, row) => (
          <span className="font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer">
            {row.project.name}
          </span>
        ),
      },
      {
        key: 'metrics.budget_at_completion',
        label: 'Budget',
        render: (_value, row) => formatCurrency(row.metrics.budget_at_completion),
      },
      {
        key: 'metrics.actual_cost',
        label: 'Actual',
        render: (_value, row) => formatCurrency(row.metrics.actual_cost),
      },
      {
        key: 'metrics.cost_variance',
        label: 'Variance',
        render: (_value, row) => {
          const cv = row.metrics.cost_variance;
          if (cv === null) return <span className="text-gray-400">-</span>;
          return (
            <span className={cv >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
              {formatCurrency(cv)}
            </span>
          );
        },
      },
      {
        key: 'metrics.cost_variance_percent',
        label: 'Variance %',
        render: (_value, row) => {
          const cvp = row.metrics.cost_variance_percent;
          if (cvp === null) return <span className="text-gray-400">-</span>;
          return (
            <span className={cvp >= 0 ? 'text-green-600' : 'text-red-600'}>
              {formatPct(cvp)}
            </span>
          );
        },
      },
      {
        key: 'metrics.cpi',
        label: 'CPI',
        render: (_value, row) => {
          const zone = cpiZone(row.metrics.cpi, cpiWarning, cpiCritical);
          return (
            <span className={`font-semibold ${cpiZoneColor(zone)}`}>
              {formatIndex(row.metrics.cpi)}
            </span>
          );
        },
      },
      {
        key: 'metrics.eac',
        label: 'EAC',
        render: (_value, row) => formatCurrency(row.metrics.eac),
      },
      {
        key: 'metrics.vac',
        label: 'VAC',
        render: (_value, row) => {
          const vac = row.metrics.vac;
          if (vac === null) return <span className="text-gray-400">-</span>;
          return (
            <span className={vac >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
              {formatCurrency(vac)}
            </span>
          );
        },
      },
    ],
    [cpiWarning, cpiCritical]
  );

  const handleBarClick = useCallback(
    (id: number) => {
      navigate(`/project/${id}`);
    },
    [navigate]
  );

  const handleRowClick = useCallback(
    (row: ProjectCostEntry) => {
      navigate(`/project/${row.project.id}`);
    },
    [navigate]
  );

  /* ---------------------------------------------------------------- */
  /* Render: Loading / Error States                                    */
  /* ---------------------------------------------------------------- */

  if (projectsLoading || healthLoading) {
    return (
      <div className="p-6">
        <PageHeader
          title="Cost Analysis"
          subtitle="Budget performance and earned value metrics"
        />
        <LoadingState message="Loading projects..." />
      </div>
    );
  }

  if (projectsError || healthError) {
    return (
      <div className="p-6">
        <PageHeader
          title="Cost Analysis"
          subtitle="Budget performance and earned value metrics"
        />
        <ErrorState
          message={
            (projectsError || healthError) instanceof Error
              ? (projectsError || healthError)!.message
              : 'Failed to load portfolio data'
          }
          onRetry={() => {
            refetchProjects();
            refetchHealth();
          }}
        />
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /* Render: Main Content                                              */
  /* ---------------------------------------------------------------- */

  return (
    <div className="p-6 space-y-8">
      <PageHeader
        title="Cost Analysis"
        subtitle="Budget performance and earned value metrics"
      />

      {/* Cost metrics loading state */}
      {costLoading && <LoadingState message="Loading cost metrics for all projects..." />}

      {costError && (
        <ErrorState
          message={costError}
          onRetry={() => {
            // Trigger re-fetch by resetting
            setCostEntries([]);
            setCostError(null);
          }}
        />
      )}

      {!costLoading && !costError && (
        <>
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Total Budget"
              value={formatCurrency(totalBudget)}
              icon={<Wallet className="h-5 w-5" />}
            />
            <MetricCard
              label="Total Actual Cost"
              value={formatCurrency(totalActual)}
              icon={<DollarSign className="h-5 w-5" />}
            />
            <MetricCard
              label="Total Cost Variance"
              value={formatCurrency(totalVariance)}
              delta={
                totalBudget > 0
                  ? `${totalVariance >= 0 ? '+' : ''}${((totalVariance / totalBudget) * 100).toFixed(1)}%`
                  : undefined
              }
              deltaPositive={totalVariance >= 0}
              icon={<TrendingDown className="h-5 w-5" />}
            />
            <MetricCard
              label="Average CPI"
              value={averageCpi !== null ? formatIndex(averageCpi) : 'N/A'}
              icon={<Gauge className="h-5 w-5" />}
              className={
                averageCpi !== null && averageCpi < 0.9
                  ? 'border-red-200 bg-red-50/30'
                  : ''
              }
            />
          </div>

          {/* CPI Threshold Settings */}
          <section>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                CPI Threshold Settings
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Adjust thresholds to classify project CPI performance zones
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                {/* Warning Threshold */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="cpi-warning"
                      className="text-sm font-medium text-gray-700"
                    >
                      Warning Threshold
                    </label>
                    <span className="rounded-md bg-amber-50 px-2.5 py-1 text-sm font-bold text-amber-700">
                      {cpiWarning.toFixed(2)}
                    </span>
                  </div>
                  <input
                    id="cpi-warning"
                    type="range"
                    min="0.5"
                    max="1.5"
                    step="0.05"
                    value={cpiWarning}
                    onChange={(e) => setCpiWarning(Number(e.target.value))}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer bg-amber-200 accent-amber-500"
                  />
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>0.50</span>
                    <span>1.00</span>
                    <span>1.50</span>
                  </div>
                </div>

                {/* Critical Threshold */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="cpi-critical"
                      className="text-sm font-medium text-gray-700"
                    >
                      Critical Threshold
                    </label>
                    <span className="rounded-md bg-red-50 px-2.5 py-1 text-sm font-bold text-red-700">
                      {cpiCritical.toFixed(2)}
                    </span>
                  </div>
                  <input
                    id="cpi-critical"
                    type="range"
                    min="0.3"
                    max="1.2"
                    step="0.05"
                    value={cpiCritical}
                    onChange={(e) => setCpiCritical(Number(e.target.value))}
                    className="w-full h-2 rounded-full appearance-none cursor-pointer bg-red-200 accent-red-500"
                  />
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>0.30</span>
                    <span>0.75</span>
                    <span>1.20</span>
                  </div>
                </div>
              </div>

              {/* Zone indicator */}
              <div className="mt-6 flex items-center gap-4 rounded-lg bg-gray-50 px-4 py-3">
                <span className="text-sm font-medium text-gray-600">
                  Project distribution:
                </span>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-green-500" />
                    <span className="text-sm text-gray-700">
                      <span className="font-bold text-green-700">
                        {zoneCounts.good}
                      </span>{' '}
                      healthy
                    </span>
                    <span className="text-xs text-gray-400">
                      (CPI &ge; {cpiWarning.toFixed(2)})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-amber-500" />
                    <span className="text-sm text-gray-700">
                      <span className="font-bold text-amber-700">
                        {zoneCounts.warning}
                      </span>{' '}
                      warning
                    </span>
                    <span className="text-xs text-gray-400">
                      ({cpiCritical.toFixed(2)} &le; CPI &lt; {cpiWarning.toFixed(2)})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-red-500" />
                    <span className="text-sm text-gray-700">
                      <span className="font-bold text-red-700">
                        {zoneCounts.critical}
                      </span>{' '}
                      critical
                    </span>
                    <span className="text-xs text-gray-400">
                      (CPI &lt; {cpiCritical.toFixed(2)})
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Budget vs Actual Bar Chart */}
          {budgetActualData.length > 0 && (
            <section>
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Budget vs Actual Cost
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Comparison of planned budget against actual expenditure per project
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <BudgetActualBar
                  data={budgetActualData}
                  onBarClick={handleBarClick}
                />
              </div>
            </section>
          )}

          {/* Cost Variance Chart */}
          {costVarianceData.length > 0 && (
            <section>
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Cost Variance by Project
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Green indicates under budget, red indicates over budget
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <CostVarianceBar
                  data={costVarianceData}
                  onBarClick={handleBarClick}
                />
              </div>
            </section>
          )}

          {/* CPI Gauges */}
          {gaugeProjects.length > 0 && (
            <section>
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  CPI Performance Gauges
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Individual CPI gauges for each project with cost performance data
                </p>
              </div>
              <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
                {gaugeProjects.map((entry) => (
                  <div
                    key={entry.project.id}
                    className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                  >
                    <CpiGauge
                      value={entry.metrics.cpi}
                      title={entry.project.name}
                      size="md"
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* EAC Waterfall */}
          {eacData.length > 0 && (
            <section>
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  EAC Comparison
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Budget at Completion (BAC) vs Estimate at Completion (EAC)
                </p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <EacWaterfall data={eacData} />
              </div>
            </section>
          )}

          {/* Detailed Cost Table */}
          <section>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Detailed Cost Breakdown
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Complete cost data for all projects — click a row to drill down
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <DataTable<ProjectCostEntry>
                columns={costTableColumns}
                data={costEntries}
                keyField="project.id"
                onRowClick={handleRowClick}
                searchable
                searchFields={['project.name']}
                emptyMessage="No cost data available. Ingest project files to get started."
              />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default CostAnalysis;
