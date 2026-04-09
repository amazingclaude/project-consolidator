// Application color palette and semantic color mappings.

export const COLORS = {
  blue: '#3B82F6',
  red: '#EF4444',
  green: '#22C55E',
  orange: '#F97316',
  grey: '#6B7280',
  lightBlue: '#60A5FA',
  purple: '#A855F7',
  teal: '#14B8A6',
  pink: '#EC4899',
  indigo: '#6366F1',
} as const;

export const SEVERITY_COLORS = {
  critical: COLORS.red,
  warning: COLORS.orange,
} as const;

export const STATUS_COLORS = {
  completed: COLORS.green,
  inProgress: COLORS.blue,
  notStarted: COLORS.grey,
} as const;

export const CHART_PALETTE = [
  COLORS.blue,
  COLORS.red,
  COLORS.green,
  COLORS.orange,
  COLORS.purple,
  COLORS.teal,
  COLORS.pink,
  COLORS.indigo,
  COLORS.lightBlue,
  COLORS.grey,
] as const;

export const CPI_ZONES = {
  good: COLORS.green,
  warning: COLORS.orange,
  critical: COLORS.red,
} as const;
