import { useMemo } from 'react';
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from 'recharts';
import { COLORS } from '../../lib/colors';

interface CpiGaugeProps {
  value: number | null;
  title: string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_MAP = {
  sm: { height: 140, fontSize: 18, titleSize: 11 },
  md: { height: 200, fontSize: 26, titleSize: 13 },
  lg: { height: 260, fontSize: 34, titleSize: 15 },
};

function getGaugeColor(value: number): string {
  if (value < 0.8) return COLORS.red;
  if (value < 1.0) return COLORS.orange;
  return COLORS.green;
}

export function CpiGauge({ value, title, size = 'md' }: CpiGaugeProps) {
  const dimensions = SIZE_MAP[size];
  const isNull = value === null;
  const displayValue = isNull ? 0 : Math.min(Math.max(value, 0), 2);
  const percentage = (displayValue / 2) * 100;
  const color = isNull ? COLORS.grey : getGaugeColor(displayValue);

  const chartData = useMemo(
    () => [{ name: 'value', value: percentage, fill: color }],
    [percentage, color]
  );

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: dimensions.height, height: dimensions.height * 0.65 }}>
        <ResponsiveContainer width="100%" height={dimensions.height}>
          <RadialBarChart
            cx="50%"
            cy="100%"
            innerRadius="60%"
            outerRadius="90%"
            barSize={size === 'sm' ? 10 : size === 'md' ? 14 : 18}
            data={chartData}
            startAngle={180}
            endAngle={0}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
            <RadialBar
              background={{ fill: '#f1f5f9' }}
              dataKey="value"
              angleAxisId={0}
              cornerRadius={6}
            />
          </RadialBarChart>
        </ResponsiveContainer>

        {/* Center value text */}
        <div
          className="absolute inset-0 flex items-end justify-center"
          style={{ paddingBottom: size === 'sm' ? 2 : size === 'md' ? 6 : 10 }}
        >
          <span
            className="font-bold"
            style={{
              fontSize: dimensions.fontSize,
              color: isNull ? COLORS.grey : color,
            }}
          >
            {isNull ? 'N/A' : displayValue.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Scale labels */}
      <div
        className="flex justify-between text-gray-400 -mt-1"
        style={{
          width: dimensions.height * 0.8,
          fontSize: dimensions.titleSize - 2,
        }}
      >
        <span>0</span>
        <span>1.0</span>
        <span>2.0</span>
      </div>

      {/* Title */}
      <p
        className="text-center text-gray-600 font-medium mt-1"
        style={{ fontSize: dimensions.titleSize }}
      >
        {title}
      </p>
    </div>
  );
}

export type { CpiGaugeProps };
