import { useMemo, useCallback } from 'react';

interface HeatmapRow {
  project_name: string;
  project_id: number;
  type_counts: Record<string, number>;
}

interface SeverityHeatmapProps {
  data: HeatmapRow[];
  onCellClick?: (projectId: number, type: string) => void;
}

const DEVIATION_TYPES = [
  'schedule_slippage',
  'cost_overrun',
  'milestone_slippage',
  'duration_overrun',
];

const DEVIATION_TYPE_LABELS: Record<string, string> = {
  schedule_slippage: 'Schedule Slippage',
  cost_overrun: 'Cost Overrun',
  milestone_slippage: 'Milestone Slippage',
  duration_overrun: 'Duration Overrun',
};

function getCellColor(count: number): string {
  if (count === 0) return '#ffffff';
  if (count <= 2) return '#fee2e2';
  if (count <= 5) return '#fca5a5';
  if (count <= 10) return '#ef4444';
  return '#991b1b';
}

function getCellTextColor(count: number): string {
  if (count <= 5) return '#1f2937';
  return '#ffffff';
}

export function SeverityHeatmap({ data, onCellClick }: SeverityHeatmapProps) {
  const allTypes = useMemo(() => {
    const typeSet = new Set<string>();
    data.forEach((row) => {
      Object.keys(row.type_counts).forEach((t) => typeSet.add(t));
    });
    return DEVIATION_TYPES.filter((t) => typeSet.has(t)).concat(
      Array.from(typeSet).filter((t) => !DEVIATION_TYPES.includes(t))
    );
  }, [data]);

  const displayTypes = allTypes.length > 0 ? allTypes : DEVIATION_TYPES;

  const handleClick = useCallback(
    (projectId: number, type: string) => {
      onCellClick?.(projectId, type);
    },
    [onCellClick]
  );

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        No severity data available.
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="min-w-full border-collapse">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-gray-50 border border-gray-200 px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[180px]">
              Project
            </th>
            {displayTypes.map((type) => (
              <th
                key={type}
                className="bg-gray-50 border border-gray-200 px-4 py-2.5 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[130px]"
              >
                {DEVIATION_TYPE_LABELS[type] ??
                  type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.project_id} className="group">
              <td className="sticky left-0 z-10 bg-white group-hover:bg-gray-50 border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-900 whitespace-nowrap">
                {row.project_name}
              </td>
              {displayTypes.map((type) => {
                const count = row.type_counts[type] ?? 0;
                const bgColor = getCellColor(count);
                const textColor = getCellTextColor(count);
                return (
                  <td
                    key={type}
                    className={`border border-gray-200 px-4 py-2.5 text-center text-sm font-semibold transition-opacity ${
                      onCellClick
                        ? 'cursor-pointer hover:opacity-80'
                        : ''
                    }`}
                    style={{ backgroundColor: bgColor, color: textColor }}
                    onClick={() => handleClick(row.project_id, type)}
                    role={onCellClick ? 'button' : undefined}
                    tabIndex={onCellClick ? 0 : undefined}
                    onKeyDown={(e) => {
                      if (onCellClick && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        handleClick(row.project_id, type);
                      }
                    }}
                  >
                    {count}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 px-1 text-xs text-gray-500">
        <span className="font-medium">Intensity:</span>
        <div className="flex items-center gap-1">
          <span
            className="inline-block w-5 h-3.5 border border-gray-200 rounded-sm"
            style={{ backgroundColor: getCellColor(0) }}
          />
          <span>0</span>
        </div>
        <div className="flex items-center gap-1">
          <span
            className="inline-block w-5 h-3.5 border border-gray-200 rounded-sm"
            style={{ backgroundColor: getCellColor(1) }}
          />
          <span>1-2</span>
        </div>
        <div className="flex items-center gap-1">
          <span
            className="inline-block w-5 h-3.5 border border-gray-200 rounded-sm"
            style={{ backgroundColor: getCellColor(4) }}
          />
          <span>3-5</span>
        </div>
        <div className="flex items-center gap-1">
          <span
            className="inline-block w-5 h-3.5 border border-gray-200 rounded-sm"
            style={{ backgroundColor: getCellColor(8) }}
          />
          <span>6-10</span>
        </div>
        <div className="flex items-center gap-1">
          <span
            className="inline-block w-5 h-3.5 border border-gray-200 rounded-sm"
            style={{ backgroundColor: getCellColor(11) }}
          />
          <span>10+</span>
        </div>
      </div>
    </div>
  );
}

export type { SeverityHeatmapProps, HeatmapRow };
