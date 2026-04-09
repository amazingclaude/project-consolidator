import { useState, useMemo } from 'react';
import {
  X,
  DollarSign,
  Calendar,
  GanttChart,
  AlertTriangle,
  Shield,
  Clock,
  Flag,
  Gauge,
  Users,
  Check,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface WidgetRegistryEntry {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  category: string;
}

const WIDGET_REGISTRY: WidgetRegistryEntry[] = [
  {
    id: 'cost-overview',
    name: 'Cost Overview',
    description: 'Budget, actual cost, CPI, and variance metrics',
    icon: DollarSign,
    category: 'Cost',
  },
  {
    id: 'schedule-overview',
    name: 'Schedule Overview',
    description: 'SPI, milestones, and critical tasks',
    icon: Calendar,
    category: 'Schedule',
  },
  {
    id: 'gantt',
    name: 'Interactive Gantt',
    description: 'Drag-and-drop Gantt chart with baseline overlay',
    icon: GanttChart,
    category: 'Schedule',
  },
  {
    id: 'deviation-table',
    name: 'Deviation Table',
    description: 'List of all deviations with severity badges',
    icon: AlertTriangle,
    category: 'Deviations',
  },
  {
    id: 'integrity',
    name: 'Data Integrity',
    description: 'Radar chart showing data quality dimensions',
    icon: Shield,
    category: 'Quality',
  },
  {
    id: 'time-metrics',
    name: 'Time Metrics',
    description: 'Planned vs actual hours and overruns',
    icon: Clock,
    category: 'Time',
  },
  {
    id: 'milestone-tracker',
    name: 'Milestone Tracker',
    description: 'Milestone status and slippage tracking',
    icon: Flag,
    category: 'Schedule',
  },
  {
    id: 'cpi-spi',
    name: 'CPI/SPI Gauges',
    description: 'Dual gauge display of cost and schedule indices',
    icon: Gauge,
    category: 'Cost',
  },
  {
    id: 'resource',
    name: 'Resource Summary',
    description: 'Resource allocation overview',
    icon: Users,
    category: 'Resources',
  },
];

const CATEGORIES = ['All', 'Cost', 'Schedule', 'Deviations', 'Quality', 'Time', 'Resources'];

interface WidgetCatalogProps {
  isOpen: boolean;
  onClose: () => void;
  onAddWidget: (widgetId: string) => void;
  activeWidgets: string[];
}

export function WidgetCatalog({
  isOpen,
  onClose,
  onAddWidget,
  activeWidgets,
}: WidgetCatalogProps) {
  const [selectedCategory, setSelectedCategory] = useState('All');

  const filteredWidgets = useMemo(() => {
    if (selectedCategory === 'All') return WIDGET_REGISTRY;
    return WIDGET_REGISTRY.filter((w) => w.category === selectedCategory);
  }, [selectedCategory]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-3xl rounded-2xl border border-gray-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Add Widget</h2>
            <p className="mt-0.5 text-sm text-gray-500">
              Select a widget to add to your dashboard
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close widget catalog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Category filter tabs */}
        <div className="flex gap-1 overflow-x-auto border-b border-gray-100 px-6 py-3">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                selectedCategory === cat
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Widget grid */}
        <div className="max-h-[28rem] overflow-y-auto p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredWidgets.map((widget) => {
              const isAdded = activeWidgets.includes(widget.id);
              const Icon = widget.icon;

              return (
                <div
                  key={widget.id}
                  className={`relative flex flex-col rounded-xl border p-4 transition-all ${
                    isAdded
                      ? 'border-gray-200 bg-gray-50 opacity-70'
                      : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-md'
                  }`}
                >
                  <div className="mb-3 flex items-center gap-3">
                    <div
                      className={`rounded-lg p-2 ${
                        isAdded ? 'bg-gray-200 text-gray-500' : 'bg-blue-50 text-blue-600'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-semibold text-gray-900">
                        {widget.name}
                      </h3>
                      <span className="text-xs text-gray-400">{widget.category}</span>
                    </div>
                  </div>

                  <p className="mb-4 flex-1 text-xs leading-relaxed text-gray-500">
                    {widget.description}
                  </p>

                  {isAdded ? (
                    <span className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-green-50 px-3 py-2 text-xs font-medium text-green-700">
                      <Check className="h-3.5 w-3.5" />
                      Added
                    </span>
                  ) : (
                    <button
                      onClick={() => onAddWidget(widget.id)}
                      className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-700 active:bg-blue-800"
                    >
                      Add Widget
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export { WIDGET_REGISTRY };
export type { WidgetCatalogProps, WidgetRegistryEntry };
