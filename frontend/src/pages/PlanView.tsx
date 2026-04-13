import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Filter,
  X,
  ChevronDown,
  Layers,
} from 'lucide-react';

import { usePlanView } from '../api/portfolio';
import type { PlanViewItem } from '../api/types';
import PageHeader from '../components/layout/PageHeader';
import { LoadingState } from '../components/ui/LoadingState';
import { ErrorState } from '../components/ui/ErrorState';
import {
  formatCurrency,
  formatIndex,
  formatPct,
  formatDays,
  formatHours,
  formatDate,
  formatVariance,
} from '../lib/formatters';
import { useChatStore } from '../stores/chatStore';

// ---------------------------------------------------------------------------
// Column definitions grouped by category
// ---------------------------------------------------------------------------

interface ColumnDef {
  key: string;
  label: string;
  group: string;
  render: (row: PlanViewItem) => React.ReactNode;
  sortValue: (row: PlanViewItem) => number | string | null;
  className?: string;
}

function healthBadge(status: string) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    'on-track': { bg: 'bg-green-50', text: 'text-green-700', label: 'On Track' },
    watch: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Watch' },
    'at-risk': { bg: 'bg-orange-50', text: 'text-orange-700', label: 'At Risk' },
    critical: { bg: 'bg-red-50', text: 'text-red-700', label: 'Critical' },
    'insufficient-data': { bg: 'bg-gray-50', text: 'text-gray-500', label: 'No Data' },
  };
  const m = map[status] ?? map['insufficient-data'];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${m.bg} ${m.text}`}>
      {m.label}
    </span>
  );
}

function indexCell(val: number | null) {
  if (val === null) return <span className="text-gray-400">-</span>;
  const color = val >= 1.0 ? 'text-green-600' : val >= 0.9 ? 'text-amber-600' : 'text-red-600';
  return <span className={`font-semibold ${color}`}>{formatIndex(val)}</span>;
}

function varianceCell(val: number | null, invert = false) {
  if (val === null) return <span className="text-gray-400">-</span>;
  const positive = invert ? val < 0 : val >= 0;
  const color = positive ? 'text-green-600' : 'text-red-600';
  return <span className={color}>{formatVariance(val)}</span>;
}

const ALL_COLUMNS: ColumnDef[] = [
  // ---- General ----
  {
    key: 'name',
    label: 'Plan Name',
    group: 'General',
    render: (r) => (
      <span className="font-medium text-blue-600 hover:text-blue-800 hover:underline whitespace-nowrap">
        {r.name}
      </span>
    ),
    sortValue: (r) => r.name,
  },
  {
    key: 'health_status',
    label: 'Health',
    group: 'General',
    render: (r) => healthBadge(r.health_status),
    sortValue: (r) => {
      const order: Record<string, number> = { critical: 0, 'at-risk': 1, watch: 2, 'on-track': 3, 'insufficient-data': 4 };
      return order[r.health_status] ?? 5;
    },
  },
  {
    key: 'percent_complete',
    label: 'Stage Gate Completion',
    group: 'General',
    render: (r) => (
      <div className="flex items-center gap-2">
        <div className="h-2 w-16 rounded-full bg-gray-200">
          <div
            className="h-2 rounded-full bg-blue-500"
            style={{ width: `${Math.min(r.percent_complete, 100)}%` }}
          />
        </div>
        <span className="text-xs text-gray-600">{r.percent_complete.toFixed(1)}%</span>
      </div>
    ),
    sortValue: (r) => r.percent_complete,
  },
  {
    key: 'task_count',
    label: 'Tasks',
    group: 'General',
    render: (r) => r.task_count,
    sortValue: (r) => r.task_count,
  },
  {
    key: 'resource_count',
    label: 'Resources',
    group: 'General',
    render: (r) => r.resource_count,
    sortValue: (r) => r.resource_count,
  },
  {
    key: 'deviation_count',
    label: 'Gate Deviations',
    group: 'General',
    render: (r) => r.deviation_count,
    sortValue: (r) => r.deviation_count,
  },
  {
    key: 'critical_issues',
    label: 'Critical Gate Issues',
    group: 'General',
    render: (r) =>
      r.critical_issues > 0 ? (
        <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
          {r.critical_issues}
        </span>
      ) : (
        <span className="text-gray-400">0</span>
      ),
    sortValue: (r) => r.critical_issues,
  },

  // ---- Cost ----
  {
    key: 'budget',
    label: 'Budget (BAC)',
    group: 'Cost',
    render: (r) => formatCurrency(r.budget),
    sortValue: (r) => r.budget,
  },
  {
    key: 'actual_cost',
    label: 'EAC',
    group: 'Cost',
    render: (r) => formatCurrency(r.eac ?? r.actual_cost),
    sortValue: (r) => r.eac ?? r.actual_cost,
  },
  {
    key: 'cost_variance',
    label: 'Variance',
    group: 'Cost',
    render: (r) => (r.cost_variance !== null ? formatCurrency(r.cost_variance) : '-'),
    sortValue: (r) => r.cost_variance,
  },
  {
    key: 'cost_variance_percent',
    label: 'CV %',
    group: 'Cost',
    render: (r) => varianceCell(r.cost_variance_percent),
    sortValue: (r) => r.cost_variance_percent,
  },
  {
    key: 'eac',
    label: 'Forecast Cost',
    group: 'Cost',
    render: (r) => (r.eac !== null ? formatCurrency(r.eac) : '-'),
    sortValue: (r) => r.eac,
  },
  {
    key: 'vac',
    label: 'VAC',
    group: 'Cost',
    render: (r) => (r.vac !== null ? formatCurrency(r.vac) : '-'),
    sortValue: (r) => r.vac,
  },

  // ---- Earned Value ----
  {
    key: 'cpi',
    label: 'CPI',
    group: 'Earned Value',
    render: (r) => indexCell(r.cpi),
    sortValue: (r) => r.cpi,
  },
  {
    key: 'spi',
    label: 'SPI',
    group: 'Earned Value',
    render: (r) => indexCell(r.spi),
    sortValue: (r) => r.spi,
  },
  {
    key: 'pv',
    label: 'PV',
    group: 'Earned Value',
    render: (r) => (r.pv !== null ? formatCurrency(r.pv) : '-'),
    sortValue: (r) => r.pv,
  },
  {
    key: 'ev',
    label: 'EV',
    group: 'Earned Value',
    render: (r) => (r.ev !== null ? formatCurrency(r.ev) : '-'),
    sortValue: (r) => r.ev,
  },
  {
    key: 'ac',
    label: 'AC',
    group: 'Earned Value',
    render: (r) => (r.ac !== null ? formatCurrency(r.ac) : '-'),
    sortValue: (r) => r.ac,
  },
  {
    key: 'cv',
    label: 'CV (EV-AC)',
    group: 'Earned Value',
    render: (r) => (r.cv !== null ? formatCurrency(r.cv) : '-'),
    sortValue: (r) => r.cv,
  },
  {
    key: 'sv',
    label: 'SV (EV-PV)',
    group: 'Earned Value',
    render: (r) => (r.sv !== null ? formatCurrency(r.sv) : '-'),
    sortValue: (r) => r.sv,
  },
  {
    key: 'tcpi',
    label: 'TCPI',
    group: 'Earned Value',
    render: (r) => indexCell(r.tcpi),
    sortValue: (r) => r.tcpi,
  },

  // ---- Schedule ----
  {
    key: 'start',
    label: 'Start',
    group: 'Schedule',
    render: (r) => formatDate(r.start),
    sortValue: (r) => r.start,
  },
  {
    key: 'finish',
    label: 'Finish',
    group: 'Schedule',
    render: (r) => formatDate(r.finish),
    sortValue: (r) => r.finish,
  },
  {
    key: 'baseline_start',
    label: 'Baseline Start',
    group: 'Schedule',
    render: (r) => formatDate(r.baseline_start),
    sortValue: (r) => r.baseline_start,
  },
  {
    key: 'baseline_finish',
    label: 'Baseline Finish',
    group: 'Schedule',
    render: (r) => formatDate(r.baseline_finish),
    sortValue: (r) => r.baseline_finish,
  },
  {
    key: 'schedule_variance_days',
    label: 'Schedule Variance',
    group: 'Schedule',
    render: (r) =>
      r.schedule_variance_days !== null ? (
        <span className={r.schedule_variance_days < 0 ? 'text-red-600' : 'text-green-600'}>
          {formatDays(r.schedule_variance_days)}
        </span>
      ) : (
        '-'
      ),
    sortValue: (r) => r.schedule_variance_days,
  },
  {
    key: 'slipped_milestones',
    label: 'Slipped Milestones',
    group: 'Schedule',
    render: (r) =>
      r.slipped_milestones > 0 ? (
        <span className="text-red-600 font-medium">
          {r.slipped_milestones}/{r.total_milestones}
        </span>
      ) : (
        <span className="text-gray-500">{r.total_milestones > 0 ? `0/${r.total_milestones}` : '-'}</span>
      ),
    sortValue: (r) => r.slipped_milestones,
  },
  {
    key: 'critical_tasks_behind',
    label: 'Critical Behind',
    group: 'Schedule',
    render: (r) =>
      r.critical_tasks_behind > 0 ? (
        <span className="text-red-600 font-medium">{r.critical_tasks_behind}</span>
      ) : (
        <span className="text-gray-400">0</span>
      ),
    sortValue: (r) => r.critical_tasks_behind,
  },

  // ---- Time ----
  {
    key: 'total_planned_hours',
    label: 'Planned Hours',
    group: 'Time',
    render: (r) => formatHours(r.total_planned_hours),
    sortValue: (r) => r.total_planned_hours,
  },
  {
    key: 'total_actual_hours',
    label: 'Actual Hours',
    group: 'Time',
    render: (r) => formatHours(r.total_actual_hours),
    sortValue: (r) => r.total_actual_hours,
  },
  {
    key: 'total_remaining_hours',
    label: 'Remaining Hours',
    group: 'Time',
    render: (r) => formatHours(r.total_remaining_hours),
    sortValue: (r) => r.total_remaining_hours,
  },
  {
    key: 'duration_variance_hours',
    label: 'Duration Variance',
    group: 'Time',
    render: (r) => (
      <span className={r.duration_variance_hours < 0 ? 'text-red-600' : 'text-green-600'}>
        {formatHours(r.duration_variance_hours)}
      </span>
    ),
    sortValue: (r) => r.duration_variance_hours,
  },
  {
    key: 'tasks_with_overrun',
    label: 'Overrun Tasks',
    group: 'Time',
    render: (r) =>
      r.tasks_with_overrun > 0 ? (
        <span className="text-red-600 font-medium">{r.tasks_with_overrun}</span>
      ) : (
        <span className="text-gray-400">0</span>
      ),
    sortValue: (r) => r.tasks_with_overrun,
  },
  {
    key: 'critical_path_length_hours',
    label: 'Critical Path',
    group: 'Time',
    render: (r) => formatHours(r.critical_path_length_hours),
    sortValue: (r) => r.critical_path_length_hours,
  },

  // ---- Integrity ----
  {
    key: 'integrity_score',
    label: 'Integrity Score',
    group: 'Integrity',
    render: (r) => (
      <div className="flex items-center gap-2">
        <div className="h-2 w-12 rounded-full bg-gray-200">
          <div
            className={`h-2 rounded-full ${
              r.integrity_score >= 0.7 ? 'bg-green-500' : r.integrity_score >= 0.5 ? 'bg-amber-500' : 'bg-red-500'
            }`}
            style={{ width: `${r.integrity_score * 100}%` }}
          />
        </div>
        <span className="text-xs">{formatPct(r.integrity_score)}</span>
      </div>
    ),
    sortValue: (r) => r.integrity_score,
  },
  {
    key: 'baseline_coverage',
    label: 'Baseline Coverage',
    group: 'Integrity',
    render: (r) => formatPct(r.baseline_coverage),
    sortValue: (r) => r.baseline_coverage,
  },
];

const COLUMN_GROUPS = ['All', 'General', 'Cost', 'Earned Value', 'Schedule', 'Time', 'Integrity'];

// ---------------------------------------------------------------------------
// Filter definitions
// ---------------------------------------------------------------------------

function cpiInRange(row: PlanViewItem, range: string): boolean {
  if (range === 'all') return true;
  if (row.cpi === null) return range === 'critical';
  if (range === 'good') return row.cpi >= 1.0;
  if (range === 'warning') return row.cpi >= 0.9 && row.cpi < 1.0;
  return row.cpi < 0.9;
}

function spiInRange(row: PlanViewItem, range: string): boolean {
  if (range === 'all') return true;
  if (row.spi === null) return range === 'critical';
  if (range === 'good') return row.spi >= 1.0;
  if (range === 'warning') return row.spi >= 0.9 && row.spi < 1.0;
  return row.spi < 0.9;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function PlanView() {
  const navigate = useNavigate();
  const setContext = useChatStore((s) => s.setContext);
  const { data, isLoading, error, refetch } = usePlanView();

  useEffect(() => {
    setContext({ page: 'plan-view' });
  }, [setContext]);

  // Column group selector
  const [activeGroup, setActiveGroup] = useState('Cost');
  // Search
  const [search, setSearch] = useState('');
  // Sorting
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  // Filters
  const [healthFilter, setHealthFilter] = useState('all');
  const [cpiFilter, setCpiFilter] = useState('all');
  const [spiFilter, setSpiFilter] = useState('all');
  const [costOverrunFilter, setCostOverrunFilter] = useState('all');
  const [scheduleSlipFilter, setScheduleSlipFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  // Visible columns based on group
  const visibleColumns = useMemo(() => {
    if (activeGroup === 'All') return ALL_COLUMNS;
    // Always show name column, plus the selected group
    return ALL_COLUMNS.filter((c) => c.key === 'name' || c.group === activeGroup);
  }, [activeGroup]);

  // Active filter count
  const activeFilterCount = [healthFilter, cpiFilter, spiFilter, costOverrunFilter, scheduleSlipFilter].filter(
    (f) => f !== 'all'
  ).length;

  // Filter + search + sort pipeline
  const processedData = useMemo(() => {
    if (!data) return [];

    let rows = [...data];

    // Filters
    if (healthFilter !== 'all') {
      rows = rows.filter((r) => r.health_status === healthFilter);
    }
    if (cpiFilter !== 'all') {
      rows = rows.filter((r) => cpiInRange(r, cpiFilter));
    }
    if (spiFilter !== 'all') {
      rows = rows.filter((r) => spiInRange(r, spiFilter));
    }
    if (costOverrunFilter !== 'all') {
      if (costOverrunFilter === 'overrun') {
        rows = rows.filter((r) => r.cost_variance !== null && r.cost_variance < 0);
      } else if (costOverrunFilter === 'on-budget') {
        rows = rows.filter((r) => r.cost_variance === null || r.cost_variance >= 0);
      }
    }
    if (scheduleSlipFilter !== 'all') {
      if (scheduleSlipFilter === 'slipped') {
        rows = rows.filter((r) => r.schedule_variance_days !== null && r.schedule_variance_days < -1);
      } else if (scheduleSlipFilter === 'on-time') {
        rows = rows.filter((r) => r.schedule_variance_days === null || r.schedule_variance_days >= -1);
      }
    }

    // Search
    if (search.trim()) {
      const term = search.toLowerCase();
      rows = rows.filter((r) => r.name.toLowerCase().includes(term));
    }

    // Sort
    if (sortKey) {
      const col = ALL_COLUMNS.find((c) => c.key === sortKey);
      if (col) {
        rows.sort((a, b) => {
          const aVal = col.sortValue(a);
          const bVal = col.sortValue(b);
          if (aVal === bVal) return 0;
          if (aVal === null || aVal === undefined) return 1;
          if (bVal === null || bVal === undefined) return -1;
          let cmp: number;
          if (typeof aVal === 'number' && typeof bVal === 'number') {
            cmp = aVal - bVal;
          } else {
            cmp = String(aVal).localeCompare(String(bVal));
          }
          return sortDir === 'asc' ? cmp : -cmp;
        });
      }
    }

    return rows;
  }, [data, healthFilter, cpiFilter, spiFilter, costOverrunFilter, scheduleSlipFilter, search, sortKey, sortDir]);

  const handleSort = useCallback(
    (key: string) => {
      if (sortKey === key) {
        if (sortDir === 'asc') {
          setSortDir('desc');
        } else {
          setSortKey(null);
          setSortDir('asc');
        }
      } else {
        setSortKey(key);
        setSortDir('asc');
      }
    },
    [sortKey, sortDir]
  );

  const clearFilters = useCallback(() => {
    setHealthFilter('all');
    setCpiFilter('all');
    setSpiFilter('all');
    setCostOverrunFilter('all');
    setScheduleSlipFilter('all');
  }, []);

  if (isLoading) {
    return (
      <div className="p-6">
        <PageHeader title="Plan View" subtitle="Executive plan view focused on health, BAC, EAC, variance and deviations" />
        <LoadingState message="Loading plan data..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <PageHeader title="Plan View" subtitle="Executive plan view focused on health, BAC, EAC, variance and deviations" />
        <ErrorState
          message={error instanceof Error ? error.message : 'Failed to load plan data'}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Plan View"
        subtitle={`Executive plan view focused on health, BAC, EAC, variance and deviations - ${data?.length ?? 0} plans loaded`}
      />

      {/* Toolbar: Column groups + Search + Filter toggle */}
      <div className="flex flex-col gap-3">
        {/* Column group tabs */}
        <div className="flex items-center gap-1 overflow-x-auto">
          <Layers size={16} className="text-muted mr-1 flex-shrink-0" />
          {COLUMN_GROUPS.map((g) => (
            <button
              key={g}
              onClick={() => setActiveGroup(g)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                activeGroup === g
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {g}
            </button>
          ))}
        </div>

        {/* Search + Filter bar */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search plans..."
              className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              showFilters || activeFilterCount > 0
                ? 'border-blue-300 bg-blue-50 text-blue-700'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Filter size={14} />
            Filters
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center justify-center rounded-full bg-blue-600 text-white text-[10px] font-bold h-4 w-4">
                {activeFilterCount}
              </span>
            )}
            <ChevronDown size={14} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>

          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <X size={12} />
              Clear
            </button>
          )}

          <span className="ml-auto text-xs text-muted">
            {processedData.length} of {data?.length ?? 0} plans
          </span>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {/* Health Status */}
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Health Status</label>
                <select
                  value={healthFilter}
                  onChange={(e) => setHealthFilter(e.target.value)}
                  className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-700 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="all">All Statuses</option>
                  <option value="on-track">On Track</option>
                  <option value="watch">Watch</option>
                  <option value="at-risk">At Risk</option>
                  <option value="critical">Critical</option>
                  <option value="insufficient-data">No Data</option>
                </select>
              </div>

              {/* CPI Range */}
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">CPI Range</label>
                <select
                  value={cpiFilter}
                  onChange={(e) => setCpiFilter(e.target.value)}
                  className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-700 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="all">All CPI</option>
                  <option value="good">Good (≥ 1.0)</option>
                  <option value="warning">Warning (0.9 – 1.0)</option>
                  <option value="critical">Critical (&lt; 0.9)</option>
                </select>
              </div>

              {/* SPI Range */}
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">SPI Range</label>
                <select
                  value={spiFilter}
                  onChange={(e) => setSpiFilter(e.target.value)}
                  className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-700 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="all">All SPI</option>
                  <option value="good">Good (≥ 1.0)</option>
                  <option value="warning">Warning (0.9 – 1.0)</option>
                  <option value="critical">Critical (&lt; 0.9)</option>
                </select>
              </div>

              {/* Cost Overrun */}
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Cost Status</label>
                <select
                  value={costOverrunFilter}
                  onChange={(e) => setCostOverrunFilter(e.target.value)}
                  className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-700 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="all">All</option>
                  <option value="on-budget">On Budget</option>
                  <option value="overrun">Cost Overrun</option>
                </select>
              </div>

              {/* Schedule Slip */}
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Schedule Status</label>
                <select
                  value={scheduleSlipFilter}
                  onChange={(e) => setScheduleSlipFilter(e.target.value)}
                  className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-700 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="all">All</option>
                  <option value="on-time">On Time</option>
                  <option value="slipped">Schedule Slipped</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Data Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {visibleColumns.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className="cursor-pointer select-none whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted hover:text-gray-700"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {col.label}
                      {sortKey === col.key ? (
                        sortDir === 'asc' ? (
                          <ArrowUp className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5 text-primary" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 text-gray-400" />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {processedData.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length} className="px-4 py-12 text-center text-sm text-muted">
                    {data && data.length > 0
                      ? 'No plans match your current filters.'
                      : 'No plans found. Ingest project files to get started.'}
                  </td>
                </tr>
              ) : (
                processedData.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => navigate(`/project/${row.id}`)}
                    className="cursor-pointer bg-white transition-colors hover:bg-blue-50/50"
                  >
                    {visibleColumns.map((col) => (
                      <td key={col.key} className={`whitespace-nowrap px-4 py-3 text-gray-700 ${col.className ?? ''}`}>
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default PlanView;
