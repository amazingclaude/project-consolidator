import { useState, useMemo, useCallback, type ReactNode } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Search } from 'lucide-react';

interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (value: unknown, row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField: string;
  onRowClick?: (row: T) => void;
  className?: string;
  maxRows?: number;
  emptyMessage?: string;
  searchable?: boolean;
  searchFields?: string[];
}

type SortDirection = 'asc' | 'desc';

interface SortState {
  key: string;
  direction: SortDirection;
}

function getNestedValue(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (current !== null && current !== undefined && typeof current === 'object') {
      return (current as Record<string, unknown>)[segment];
    }
    return undefined;
  }, obj);
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  keyField,
  onRowClick,
  className = '',
  maxRows,
  emptyMessage = 'No data available.',
  searchable = false,
  searchFields,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState | null>(null);
  const [search, setSearch] = useState('');

  const handleSort = useCallback(
    (key: string) => {
      setSort((prev) => {
        if (prev?.key === key) {
          return prev.direction === 'asc'
            ? { key, direction: 'desc' }
            : null;
        }
        return { key, direction: 'asc' };
      });
    },
    [],
  );

  const filteredData = useMemo(() => {
    if (!searchable || !search.trim()) return data;

    const term = search.toLowerCase();
    const fields =
      searchFields && searchFields.length > 0
        ? searchFields
        : columns.map((c) => c.key);

    return data.filter((row) =>
      fields.some((field) => {
        const val = getNestedValue(row, field);
        return val !== null && val !== undefined && String(val).toLowerCase().includes(term);
      }),
    );
  }, [data, search, searchable, searchFields, columns]);

  const sortedData = useMemo(() => {
    if (!sort) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aVal = getNestedValue(a, sort.key);
      const bVal = getNestedValue(b, sort.key);

      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      let comparison: number;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else {
        comparison = String(aVal).localeCompare(String(bVal));
      }

      return sort.direction === 'asc' ? comparison : -comparison;
    });
  }, [filteredData, sort]);

  const displayData = maxRows ? sortedData.slice(0, maxRows) : sortedData;

  const renderSortIcon = (columnKey: string) => {
    if (sort?.key !== columnKey) {
      return <ArrowUpDown className="h-3.5 w-3.5 text-gray-400" />;
    }
    return sort.direction === 'asc' ? (
      <ArrowUp className="h-3.5 w-3.5 text-primary" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 text-primary" />
    );
  };

  return (
    <div className={`w-full ${className}`}>
      {searchable && (
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted ${
                    col.sortable !== false
                      ? 'cursor-pointer select-none hover:text-gray-700'
                      : ''
                  } ${col.className ?? ''}`}
                  onClick={
                    col.sortable !== false
                      ? () => handleSort(col.key)
                      : undefined
                  }
                >
                  <span className="inline-flex items-center gap-1.5">
                    {col.label}
                    {col.sortable !== false && renderSortIcon(col.key)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {displayData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-sm text-muted"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              displayData.map((row) => (
                <tr
                  key={String(getNestedValue(row, keyField))}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`bg-white transition-colors ${
                    onRowClick
                      ? 'cursor-pointer hover:bg-gray-50'
                      : 'hover:bg-gray-50/50'
                  }`}
                >
                  {columns.map((col) => {
                    const cellValue = getNestedValue(row, col.key);
                    return (
                      <td
                        key={col.key}
                        className={`px-4 py-3 text-gray-700 ${col.className ?? ''}`}
                      >
                        {col.render
                          ? col.render(cellValue, row)
                          : cellValue !== null && cellValue !== undefined
                            ? String(cellValue)
                            : ''}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export type { Column, DataTableProps };
