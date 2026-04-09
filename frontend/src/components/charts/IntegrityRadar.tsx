import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { COLORS } from '../../lib/colors';

interface IntegrityRadarData {
  overall_score: number;
  baseline_coverage: number;
  cost_completeness: number;
  resource_coverage: number;
  progress_tracking: number;
}

interface IntegrityRadarProps {
  data: IntegrityRadarData;
}

interface RadarDataPoint {
  dimension: string;
  value: number;
  label: string;
}

function toRadarData(data: IntegrityRadarData): RadarDataPoint[] {
  return [
    {
      dimension: 'Overall Score',
      value: data.overall_score * 100,
      label: `${(data.overall_score * 100).toFixed(0)}%`,
    },
    {
      dimension: 'Baseline Coverage',
      value: data.baseline_coverage * 100,
      label: `${(data.baseline_coverage * 100).toFixed(0)}%`,
    },
    {
      dimension: 'Cost Completeness',
      value: data.cost_completeness * 100,
      label: `${(data.cost_completeness * 100).toFixed(0)}%`,
    },
    {
      dimension: 'Resource Coverage',
      value: data.resource_coverage * 100,
      label: `${(data.resource_coverage * 100).toFixed(0)}%`,
    },
    {
      dimension: 'Progress Tracking',
      value: data.progress_tracking * 100,
      label: `${(data.progress_tracking * 100).toFixed(0)}%`,
    },
  ];
}

interface RadarTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: RadarDataPoint }>;
}

function RadarTooltip({ active, payload }: RadarTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-md text-sm">
      <p className="font-semibold text-gray-900">{point.dimension}</p>
      <p className="text-gray-600">
        Score: <span className="font-medium text-gray-900">{point.value.toFixed(0)}%</span>
      </p>
    </div>
  );
}

interface CustomTickProps {
  x?: number | string;
  y?: number | string;
  payload?: { value: string; index: number };
  radarData?: RadarDataPoint[];
}

function CustomTick({ x, y, payload, radarData }: CustomTickProps) {
  if (x === undefined || y === undefined || !payload || !radarData) return null;
  const numX = Number(x);
  const numY = Number(y);

  const point = radarData.find((d) => d.dimension === payload.value);
  const pct = point ? point.label : '';

  return (
    <g transform={`translate(${numX},${numY})`}>
      <text
        textAnchor="middle"
        fill="#374151"
        fontSize={12}
        fontWeight={600}
        dy={-6}
      >
        {payload.value}
      </text>
      <text
        textAnchor="middle"
        fill="#6b7280"
        fontSize={11}
        dy={8}
      >
        {pct}
      </text>
    </g>
  );
}

export function IntegrityRadar({ data }: IntegrityRadarProps) {
  const radarData = toRadarData(data);

  return (
    <div className="w-full h-[380px]">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart
          cx="50%"
          cy="50%"
          outerRadius="70%"
          data={radarData}
        >
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis
            dataKey="dimension"
            tick={(props: any) => (
              <CustomTick {...props} radarData={radarData} />
            )}
          />
          <PolarRadiusAxis
            domain={[0, 100]}
            tickCount={5}
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            axisLine={false}
            tickFormatter={(value: number) => `${value}%`}
          />

          <Tooltip content={<RadarTooltip />} />

          <Radar
            name="Data Integrity"
            dataKey="value"
            stroke={COLORS.blue}
            fill={COLORS.blue}
            fillOpacity={0.2}
            strokeWidth={2}
            dot={{
              r: 4,
              fill: COLORS.blue,
              stroke: '#ffffff',
              strokeWidth: 2,
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

export type { IntegrityRadarProps, IntegrityRadarData };
