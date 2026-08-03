export function formatCurrency(value: number | null | undefined, currency?: string | null): string {
  if (value === null || value === undefined) return '—';
  const code = currency && currency.trim() ? currency.trim().toUpperCase() : 'USD';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${code}`;
  }
}

export function formatCostPerHour(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `$${value.toFixed(3)}/hr`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatSize(gb: number | null | undefined): string {
  if (gb === null || gb === undefined) return '—';
  if (gb >= 1000) return `${(gb / 1000).toFixed(1)} TB`;
  return `${gb} GB`;
}

export function fallback(value: string | null | undefined, placeholder = '—'): string {
  if (value === null || value === undefined || value.trim() === '') return placeholder;
  return value;
}

export function initials(text: string | null | undefined): string {
  if (!text) return '?';
  const parts = text.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length === 0) return text.slice(0, 2).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
