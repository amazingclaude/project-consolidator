import { Loader2 } from 'lucide-react';
import { useIntegrityMetrics } from '../api/projects';
import { IntegrityRadar } from '../components/charts/IntegrityRadar';
import { HealthDot } from '../components/ui/HealthDot';
import { formatPct } from '../lib/formatters';

interface IntegrityWidgetProps {
  projectId: number;
}

const DIMENSIONS: { key: string; label: string }[] = [
  { key: 'overall_score', label: 'Overall Score' },
  { key: 'baseline_coverage', label: 'Baseline Coverage' },
  { key: 'cost_completeness', label: 'Cost Completeness' },
  { key: 'resource_coverage', label: 'Resource Coverage' },
  { key: 'progress_tracking', label: 'Progress Tracking' },
];

export function IntegrityWidget({ projectId }: IntegrityWidgetProps) {
  const { data, isLoading, error } = useIntegrityMetrics(projectId);

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
        Failed to load integrity metrics
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Radar chart */}
      <div className="min-h-0 flex-1">
        <IntegrityRadar
          data={{
            overall_score: data.overall_score,
            baseline_coverage: data.baseline_coverage,
            cost_completeness: data.cost_completeness,
            resource_coverage: data.resource_coverage,
            progress_tracking: data.progress_tracking,
          }}
        />
      </div>

      {/* Health dots for each dimension */}
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 border-t border-gray-100 pt-3">
        {DIMENSIONS.map((dim) => {
          const score = data[dim.key as keyof typeof data] as number;
          return (
            <div key={dim.key} className="flex items-center gap-2">
              <HealthDot score={score} size="sm" />
              <span className="text-xs text-gray-600">{dim.label}</span>
              <span className="text-xs font-medium text-gray-800">
                {formatPct(score)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export type { IntegrityWidgetProps };
