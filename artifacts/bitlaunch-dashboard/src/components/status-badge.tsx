import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status?: string | null;
  className?: string;
}

// Normalize arbitrary API status strings into a semantic tone.
function getTone(status: string | null | undefined): {
  tone: 'positive' | 'warning' | 'negative' | 'neutral' | 'info';
  label: string;
} {
  const s = (status ?? '').toLowerCase().trim();
  if (!s) return { tone: 'neutral', label: 'unknown' };

  if (['active', 'running', 'online', 'available', 'attached', 'ok', 'ready', 'ok', 'good'].includes(s)) {
    return { tone: 'positive', label: s };
  }
  if (['pending', 'building', 'creating', 'provisioning', 'installing', 'migrating', 'resizing'].includes(s)) {
    return { tone: 'warning', label: s };
  }
  if (['error', 'failed', 'suspended', 'stopped', 'offline', 'inactive', 'archived'].includes(s)) {
    return { tone: 'negative', label: s };
  }
  if (['snapshot', 'backup', 'unattached', 'detached', 'template'].includes(s)) {
    return { tone: 'info', label: s };
  }
  return { tone: 'neutral', label: s };
}

const toneStyles: Record<string, string> = {
  positive: 'bg-[hsl(152,60%,45%)]/12 text-[hsl(152,65%,62%)] border-[hsl(152,60%,45%)]/30',
  warning: 'bg-[hsl(38,92%,55%)]/12 text-[hsl(38,92%,65%)] border-[hsl(38,92%,55%)]/30',
  negative: 'bg-[hsl(357,75%,56%)]/12 text-[hsl(357,80%,68%)] border-[hsl(357,75%,56%)]/30',
  info: 'bg-[hsl(198,62%,52%)]/12 text-[hsl(198,70%,68%)] border-[hsl(198,62%,52%)]/30',
  neutral: 'bg-muted text-muted-foreground border-border',
};

const dotStyles: Record<string, string> = {
  positive: 'bg-[hsl(152,65%,55%)]',
  warning: 'bg-[hsl(38,92%,58%)]',
  negative: 'bg-[hsl(357,80%,60%)]',
  info: 'bg-[hsl(198,70%,58%)]',
  neutral: 'bg-muted-foreground',
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { tone, label } = getTone(status);
  const isPulsing = tone === 'positive' || tone === 'warning';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-mono-num font-medium uppercase tracking-wider',
        toneStyles[tone],
        className,
      )}
      data-testid={`status-badge-${label}`}
    >
      <span className="relative flex h-1.5 w-1.5">
        {isPulsing && (
          <span
            className={cn(
              'absolute inline-flex h-full w-full animate-ping rounded-full opacity-60',
              dotStyles[tone],
            )}
          />
        )}
        <span className={cn('relative inline-flex h-1.5 w-1.5 rounded-full', dotStyles[tone])} />
      </span>
      {label}
    </span>
  );
}
