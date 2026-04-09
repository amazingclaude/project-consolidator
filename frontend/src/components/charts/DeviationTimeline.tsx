import { useMemo, useCallback } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Brush,
  ResponsiveContainer,
  ZAxis,
  Legend,
  Cell,
} from 'recharts';
import { CHART_PALETTE, SEVERITY_COLORS } from '../../lib/colors';

interface DeviationEntry {
  id: number;
  project_name: string;
  deviation_type: string;
  severity: string;
  variance: number | null;
  variance_percent: number | null;
  description: string;
}

interface DeviationTimelineProps {
  deviations: DeviationEntry[];
  onPointClick?: (id: number) => void;
}

function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
}

interface PlottablePoint {
  id: number;
  project_name: string;
  deviation_type: string;
  severity: string;
  variance: number;
  variance_percent: number;
  description: string;
  index: number;
  absVariance: number;
  bubbleSize: number;
}

interface TimelineTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: PlottablePoint }>;
}

function TimelineTooltip({ active, payload }: TimelineTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-md text-sm max-w-xs">
      <p className="font-semibold text-gray-900 mb-1">{point.project_name}</p>
      <div className="space-y-0.5">
        <p className="text-gray-600">
          Type:{' '}
          <span className="font-medium text-gray-900">
            {point.deviation_type.replace(/_/g, ' ')}
          </span>
        </p>
        <p className="text-gray-600">
          Severity:{' '}
          <span
            className="font-medium"
            style={{
              color:
                SEVERITY_COLORS[point.severity as keyof typeof SEVERITY_COLORS] ??
                '#6b7280',
            }}
          >
            {point.severity}
          </span>
        </p>
        <p className="text-gray-600">
          Variance:{' '}
          <span className="font-medium text-gray-900">
            {point.variance.toFixed(2)}
          </span>
        </p>
        {point.variance_percent !== 0 && (
          <p className="text-gray-600">
            Variance %:{' '}
            <span className="font-medium text-gray-900">
              {point.variance_percent.toFixed(1)}%
            </span>
          </p>
        )}
        <p className="text-gray-500 text-xs mt-1">
          {truncate(point.description, 120)}
        </p>
      </div>
    </div>
  );
}

export function DeviationTimeline({
  deviations,
  onPointClick,
}: DeviationTimelineProps) {
  const deviationTypes = useMemo(() => {
    const types = new Set<string>();
    deviations.forEach((d) => types.add(d.deviation_type));
    return Array.from(types);
  }, [deviations]);

  const typeColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    deviationTypes.forEach((type, i) => {
      map[type] = CHART_PALETTE[i % CHART_PALETTE.length];
    });
    return map;
  }, [deviationTypes]);

  const plotData: PlottablePoint[] = useMemo(
    () =>
      deviations.map((d, i) => ({
        ...d,
        index: i + 1,
        variance: d.variance ?? 0,
        variance_percent: d.variance_percent ?? 0,
        absVariance: Math.abs(d.variance ?? 0),
        bubbleSize: d.variance_percent !== null ? Math.max(Math.abs(d.variance_percent), 10) : 40,
      })),
    [deviations]
  );

  const groupedByType = useMemo(() => {
    const groups: Record<string, PlottablePoint[]> = {};
    deviationTypes.forEach((type) => {
      groups[type] = plotData.filter((p) => p.deviation_type === type);
    });
    return groups;
  }, [plotData, deviationTypes]);

  const handleClick = useCallback(
    (entry: PlottablePoint) => {
      onPointClick?.(entry.id);
    },
    [onPointClick]
  );

  if (deviations.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        No deviation data available.
      </div>
    );
  }

  return (
    <div className="w-full h-[460px]">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 20, right: 30, bottom: 40, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

          <XAxis
            type="number"
            dataKey="index"
            name="Deviation #"
            domain={['dataMin', 'dataMax']}
            tick={{ fontSize: 12, fill: '#6b7280' }}
            label={{
              value: 'Deviation Index',
              position: 'bottom',
              offset: 0,
              style: { fontSize: 12, fill: '#6b7280' },
            }}
          />
          <YAxis
            type="number"
            dataKey="absVariance"
            name="Absolute Variance"
            tick={{ fontSize: 12, fill: '#6b7280' }}
            label={{
              value: 'Absolute Variance',
              angle: -90,
              position: 'left',
              offset: 0,
              style: { fontSize: 12, fill: '#6b7280' },
            }}
          />
          <ZAxis
            type="number"
            dataKey="bubbleSize"
            range={[40, 400]}
            name="Variance %"
          />

          <Tooltip content={<TimelineTooltip />} cursor={false} />
          <Legend
            verticalAlign="top"
            height={36}
            wrapperStyle={{ fontSize: 12 }}
          />

          <Brush
            dataKey="index"
            height={24}
            stroke="#94a3b8"
            fill="#f8fafc"
            travellerWidth={8}
          />

          {deviationTypes.map((type) => (
            <Scatter
              key={type}
              name={type.replace(/_/g, ' ')}
              data={groupedByType[type]}
              onClick={handleClick}
              cursor={onPointClick ? 'pointer' : 'default'}
            >
              {groupedByType[type].map((entry) => (
                <Cell key={entry.id} fill={typeColorMap[type]} />
              ))}
            </Scatter>
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

export type { DeviationTimelineProps, DeviationEntry };
