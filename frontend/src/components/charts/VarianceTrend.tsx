import { useMemo } from 'react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Brush,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { COLORS } from '../../lib/colors';

/* Custom tick for angled X-axis labels (Recharts XAxis tick does not accept `angle` directly). */
function AngledXAxisTick(props: { x?: number; y?: number; payload?: { value: string } }) {
  const { x = 0, y = 0, payload } = props;
  if (!payload) return null;
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={12}
        textAnchor="end"
        fill="#6b7280"
        fontSize={11}
        transform="rotate(-30)"
      >
        {payload.value}
      </text>
    </g>
  );
}

interface VarianceTrendDataPoint {
  task_name: string;
  task_index: number;
  cost_variance: number | null;
  schedule_variance: number | null;
}

interface VarianceTrendProps {
  data: VarianceTrendDataPoint[];
}

interface CumulativePoint {
  task_name: string;
  task_index: number;
  cumCostVariance: number | null;
  cumScheduleVariance: number | null;
}

function formatCurrency(value: number): string {
  const sign = value >= 0 ? '' : '-';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function formatDays(value: number): string {
  const sign = value >= 0 ? '' : '-';
  return `${sign}${Math.abs(value).toFixed(1)}d`;
}

function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
}

interface TrendTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string; dataKey: string }>;
  label?: string;
}

function TrendTooltip({ active, payload, label }: TrendTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const scheduleEntry = payload.find((p) => p.dataKey === 'cumScheduleVariance');
  const costEntry = payload.find((p) => p.dataKey === 'cumCostVariance');

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-md text-sm">
      <p className="font-semibold text-gray-900 mb-1">{label ? truncate(label, 40) : ''}</p>
      {scheduleEntry && scheduleEntry.value !== null && (
        <p className="text-gray-600">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full mr-1.5"
            style={{ backgroundColor: COLORS.blue }}
          />
          Schedule Variance:{' '}
          <span className="font-medium text-gray-900">
            {formatDays(scheduleEntry.value)}
          </span>
        </p>
      )}
      {costEntry && costEntry.value !== null && (
        <p className="text-gray-600">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full mr-1.5"
            style={{ backgroundColor: COLORS.red }}
          />
          Cost Variance:{' '}
          <span className="font-medium text-gray-900">
            {formatCurrency(costEntry.value)}
          </span>
        </p>
      )}
    </div>
  );
}

export function VarianceTrend({ data }: VarianceTrendProps) {
  const cumulative: CumulativePoint[] = useMemo(() => {
    let cumCost = 0;
    let cumSchedule = 0;
    let hasCost = false;
    let hasSchedule = false;

    return data.map((point) => {
      if (point.cost_variance !== null) {
        cumCost += point.cost_variance;
        hasCost = true;
      }
      if (point.schedule_variance !== null) {
        cumSchedule += point.schedule_variance;
        hasSchedule = true;
      }

      return {
        task_name: point.task_name,
        task_index: point.task_index,
        cumCostVariance: hasCost ? cumCost : null,
        cumScheduleVariance: hasSchedule ? cumSchedule : null,
      };
    });
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        No variance trend data available.
      </div>
    );
  }

  return (
    <div className="w-full h-[420px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={cumulative}
          margin={{ top: 10, right: 60, bottom: 40, left: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

          <XAxis
            dataKey="task_name"
            tick={<AngledXAxisTick />}
            height={60}
            interval="preserveStartEnd"
          />

          <YAxis
            yAxisId="left"
            tickFormatter={formatDays}
            tick={{ fontSize: 12, fill: COLORS.blue }}
            label={{
              value: 'Schedule Variance (days)',
              angle: -90,
              position: 'insideLeft',
              offset: -40,
              style: { fontSize: 12, fill: COLORS.blue },
            }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickFormatter={formatCurrency}
            tick={{ fontSize: 12, fill: COLORS.red }}
            label={{
              value: 'Cost Variance ($)',
              angle: 90,
              position: 'insideRight',
              offset: -40,
              style: { fontSize: 12, fill: COLORS.red },
            }}
          />

          <ReferenceLine
            yAxisId="left"
            y={0}
            stroke={COLORS.grey}
            strokeDasharray="6 4"
            strokeWidth={1}
          />

          <Tooltip content={<TrendTooltip />} />
          <Legend
            verticalAlign="top"
            height={36}
            wrapperStyle={{ fontSize: 12 }}
          />

          <Brush
            dataKey="task_name"
            height={24}
            stroke="#94a3b8"
            fill="#f8fafc"
            travellerWidth={8}
          />

          <Line
            yAxisId="left"
            type="monotone"
            dataKey="cumScheduleVariance"
            name="Cumulative Schedule Variance (days)"
            stroke={COLORS.blue}
            strokeWidth={2}
            dot={{ r: 3, fill: COLORS.blue }}
            activeDot={{ r: 5 }}
            connectNulls
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="cumCostVariance"
            name="Cumulative Cost Variance ($)"
            stroke={COLORS.red}
            strokeWidth={2}
            dot={{ r: 3, fill: COLORS.red }}
            activeDot={{ r: 5 }}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export type { VarianceTrendProps, VarianceTrendDataPoint };
