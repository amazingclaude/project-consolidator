interface SeverityBadgeProps {
  severity: 'critical' | 'warning' | string;
}

const severityStyles: Record<string, string> = {
  critical: 'bg-red-100 text-danger',
  warning: 'bg-orange-100 text-warning',
};

const defaultStyle = 'bg-gray-100 text-muted';

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  const style = severityStyles[severity] ?? defaultStyle;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${style}`}
    >
      {severity}
    </span>
  );
}

export type { SeverityBadgeProps };
