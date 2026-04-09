import { Loader2 } from 'lucide-react';
import { useProjectDeviations } from '../api/projects';
import { DataTable } from '../components/ui/DataTable';
import type { Column } from '../components/ui/DataTable';
import { SeverityBadge } from '../components/ui/SeverityBadge';
import type { DeviationItem } from '../api/types';

interface DeviationTableWidgetProps {
  projectId: number;
}

const deviationColumns: Column<DeviationItem>[] = [
  {
    key: 'severity',
    label: 'Severity',
    render: (value) => <SeverityBadge severity={value as string} />,
    className: 'w-24',
  },
  {
    key: 'deviation_type',
    label: 'Type',
    render: (value) => (
      <span className="whitespace-nowrap text-xs font-medium text-gray-700">
        {String(value).replace(/_/g, ' ')}
      </span>
    ),
  },
  {
    key: 'metric_name',
    label: 'Metric',
    render: (value) => (
      <span className="text-xs text-gray-600">
        {String(value).replace(/_/g, ' ')}
      </span>
    ),
  },
  {
    key: 'variance',
    label: 'Variance',
    render: (value, row) => {
      const numVal = value as number | null;
      if (numVal === null) return <span className="text-gray-400">-</span>;
      const pct = row.variance_percent;
      return (
        <span className="text-xs font-mono">
          {numVal.toFixed(1)}
          {pct !== null && pct !== undefined && (
            <span className="ml-1 text-gray-400">
              ({(pct as number) >= 0 ? '+' : ''}{(pct as number).toFixed(1)}%)
            </span>
          )}
        </span>
      );
    },
  },
  {
    key: 'description',
    label: 'Description',
    render: (value) => (
      <span className="line-clamp-2 text-xs text-gray-600">
        {String(value)}
      </span>
    ),
  },
];

export function DeviationTableWidget({ projectId }: DeviationTableWidgetProps) {
  const { data, isLoading, error } = useProjectDeviations(projectId);

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
        Failed to load deviations
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        No deviations detected
      </div>
    );
  }

  return (
    <DataTable<DeviationItem>
      columns={deviationColumns}
      data={data}
      keyField="id"
      searchable
      searchFields={['description', 'deviation_type', 'metric_name', 'severity']}
      emptyMessage="No deviations found."
    />
  );
}

export type { DeviationTableWidgetProps };
