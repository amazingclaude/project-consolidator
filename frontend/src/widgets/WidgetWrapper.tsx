import { X, GripVertical } from 'lucide-react';

interface WidgetWrapperProps {
  id: string;
  title: string;
  onRemove: () => void;
  children: React.ReactNode;
  className?: string;
}

export function WidgetWrapper({
  id: _id,
  title,
  onRemove,
  children,
  className = '',
}: WidgetWrapperProps) {
  return (
    <div
      className={`flex h-full flex-col rounded-xl border border-gray-200 bg-white shadow-sm ${className}`}
    >
      {/* Title bar / drag handle */}
      <div className="drag-handle flex items-center justify-between border-b border-gray-100 px-4 py-2.5 cursor-grab active:cursor-grabbing select-none">
        <div className="flex items-center gap-2 min-w-0">
          <GripVertical className="h-4 w-4 flex-shrink-0 text-gray-400" />
          <h3 className="truncate text-sm font-semibold text-gray-800">
            {title}
          </h3>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="flex-shrink-0 rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          aria-label={`Remove ${title} widget`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto p-4">{children}</div>
    </div>
  );
}

export type { WidgetWrapperProps };
