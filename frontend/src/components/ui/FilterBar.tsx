interface FilterOption {
  value: string;
  label: string;
}

interface FilterConfig {
  key: string;
  label: string;
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
}

interface FilterBarProps {
  filters: FilterConfig[];
  className?: string;
}

export function FilterBar({ filters, className = '' }: FilterBarProps) {
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {filters.map((filter) => (
        <div key={filter.key} className="flex items-center gap-1.5">
          <label
            htmlFor={`filter-${filter.key}`}
            className="text-xs font-medium text-muted whitespace-nowrap"
          >
            {filter.label}
          </label>
          <select
            id={`filter-${filter.key}`}
            value={filter.value}
            onChange={(e) => filter.onChange(e.target.value)}
            className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-700 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {filter.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}

export type { FilterOption, FilterConfig, FilterBarProps };
