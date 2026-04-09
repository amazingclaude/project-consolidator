interface HealthDotProps {
  score: number;
  label?: string;
  size?: 'sm' | 'md';
}

function getDotColor(score: number): string {
  if (score >= 0.9) return 'bg-success';
  if (score >= 0.7) return 'bg-warning';
  return 'bg-danger';
}

function getDotSize(size: 'sm' | 'md'): string {
  return size === 'sm' ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5';
}

export function HealthDot({ score, label, size = 'md' }: HealthDotProps) {
  const colorClass = getDotColor(score);
  const sizeClass = getDotSize(size);

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block rounded-full ${colorClass} ${sizeClass}`} />
      {label && (
        <span className="text-sm text-gray-700">{label}</span>
      )}
    </span>
  );
}

export type { HealthDotProps };
