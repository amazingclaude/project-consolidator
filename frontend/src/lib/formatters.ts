/**
 * Format a number as US currency (no decimals).
 * Negative values display as "-$500".
 */
export function formatCurrency(val: number | null | undefined): string {
  if (val === null || val === undefined) return '-';
  const abs = Math.abs(val);
  const formatted = abs.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return val < 0 ? `-${formatted}` : formatted;
}

/**
 * Format a performance index value to 3 decimal places (e.g. CPI, SPI).
 */
export function formatIndex(val: number | null | undefined): string {
  if (val === null || val === undefined) return '-';
  return val.toFixed(3);
}

/**
 * Format a decimal ratio as a percentage with 1 decimal place.
 * Input 0.123 outputs "12.3%".
 */
export function formatPct(val: number | null | undefined): string {
  if (val === null || val === undefined) return '-';
  return `${(val * 100).toFixed(1)}%`;
}

/**
 * Format a number as days with 1 decimal place.
 */
export function formatDays(val: number | null | undefined): string {
  if (val === null || val === undefined) return '-';
  return `${val.toFixed(1)} days`;
}

/**
 * Format a number as hours (integer).
 */
export function formatHours(val: number | null | undefined): string {
  if (val === null || val === undefined) return '-';
  return `${Math.round(val)} hrs`;
}

/**
 * Format an ISO date string as "Jan 15, 2024".
 */
export function formatDate(val: string | null | undefined): string {
  if (!val) return '-';
  const date = new Date(val);
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format an ISO date string as "Jan 15, 2024 08:00".
 */
export function formatDateTime(val: string | null | undefined): string {
  if (!val) return '-';
  const date = new Date(val);
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Format a variance value with explicit sign.
 * Positive values get a "+" prefix, negative values keep their "-".
 */
export function formatVariance(val: number | null | undefined): string {
  if (val === null || val === undefined) return '-';
  const formatted = val.toFixed(1);
  return val > 0 ? `+${formatted}` : formatted;
}
