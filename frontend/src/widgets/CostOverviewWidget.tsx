import { Loader2, DollarSign, TrendingDown, Wallet, Activity } from 'lucide-react';
import { useCostMetrics } from '../api/projects';
import { MetricCard } from '../components/ui/MetricCard';
import { formatCurrency, formatIndex } from '../lib/formatters';

interface CostOverviewWidgetProps {
  projectId: number;
}

export function CostOverviewWidget({ projectId }: CostOverviewWidgetProps) {
  const { data, isLoading, error } = useCostMetrics(projectId);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        Failed to load cost metrics
      </div>
    );
  }

  const variance = data.cost_variance ?? 0;
  const variancePct = data.cost_variance_percent;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          label="Budget"
          value={formatCurrency(data.budget_at_completion)}
          icon={<Wallet className="h-4 w-4" />}
        />
        <MetricCard
          label="Actual Cost"
          value={formatCurrency(data.actual_cost)}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <MetricCard
          label="Cost Variance"
          value={formatCurrency(variance)}
          delta={
            variancePct !== null
              ? `${variancePct >= 0 ? '+' : ''}${variancePct.toFixed(1)}%`
              : undefined
          }
          deltaPositive={variance >= 0}
          icon={<TrendingDown className="h-4 w-4" />}
        />
        <MetricCard
          label="CPI"
          value={formatIndex(data.cpi)}
          delta={
            data.cpi !== null
              ? data.cpi >= 1.0
                ? 'On track'
                : 'Over budget'
              : undefined
          }
          deltaPositive={data.cpi !== null && data.cpi >= 1.0}
          icon={<Activity className="h-4 w-4" />}
        />
      </div>

      {/* Compact budget vs actual bar */}
      {data.budget_at_completion > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Budget Utilization</span>
            <span>
              {((data.actual_cost / data.budget_at_completion) * 100).toFixed(0)}%
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-full rounded-full transition-all ${
                data.actual_cost <= data.budget_at_completion
                  ? 'bg-blue-500'
                  : 'bg-red-500'
              }`}
              style={{
                width: `${Math.min(
                  (data.actual_cost / data.budget_at_completion) * 100,
                  100
                )}%`,
              }}
            />
          </div>
          {data.eac !== null && (
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>EAC: {formatCurrency(data.eac)}</span>
              {data.vac !== null && (
                <span>VAC: {formatCurrency(data.vac)}</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export type { CostOverviewWidgetProps };
