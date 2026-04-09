import { Loader2 } from 'lucide-react';
import { useCostMetrics, useScheduleMetrics } from '../api/projects';
import { CpiGauge } from '../components/charts/CpiGauge';

interface CpiSpiWidgetProps {
  projectId: number;
}

export function CpiSpiWidget({ projectId }: CpiSpiWidgetProps) {
  const {
    data: costData,
    isLoading: costLoading,
    error: costError,
  } = useCostMetrics(projectId);

  const {
    data: scheduleData,
    isLoading: scheduleLoading,
    error: scheduleError,
  } = useScheduleMetrics(projectId);

  const isLoading = costLoading || scheduleLoading;

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if ((costError && scheduleError) || (!costData && !scheduleData)) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        Failed to load performance indices
      </div>
    );
  }

  const cpi = costData?.cpi ?? null;
  const spi = scheduleData?.spi ?? null;

  return (
    <div className="flex h-full flex-col items-center justify-center">
      <div className="flex items-center justify-center gap-8">
        <CpiGauge value={cpi} title="CPI" size="md" />
        <CpiGauge value={spi} title="SPI" size="md" />
      </div>

      {/* Interpretation text */}
      <div className="mt-4 flex items-center gap-6 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${
              cpi !== null && cpi >= 1.0
                ? 'bg-green-500'
                : cpi !== null && cpi >= 0.8
                  ? 'bg-orange-500'
                  : 'bg-red-500'
            }`}
          />
          <span>
            CPI: {cpi !== null ? (cpi >= 1.0 ? 'Under budget' : 'Over budget') : 'N/A'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${
              spi !== null && spi >= 1.0
                ? 'bg-green-500'
                : spi !== null && spi >= 0.8
                  ? 'bg-orange-500'
                  : 'bg-red-500'
            }`}
          />
          <span>
            SPI: {spi !== null ? (spi >= 1.0 ? 'On schedule' : 'Behind schedule') : 'N/A'}
          </span>
        </div>
      </div>
    </div>
  );
}

export type { CpiSpiWidgetProps };
