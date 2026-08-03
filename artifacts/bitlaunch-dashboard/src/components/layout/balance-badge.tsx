import { Wallet } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { getGetBitlaunchAccountQueryOptions } from '@workspace/api-client-react';
import { cn } from '@/lib/utils';

/** BitLaunch suspends servers ~48 h after hitting $0 */
const LOW_BALANCE_USD = 10;
const CRITICAL_BALANCE_USD = 2;

/**
 * Shows the BitLaunch account balance in the sidebar footer.
 * Refreshes every 5 minutes. Turns amber below $10, red below $2.
 * Renders nothing until data arrives.
 */
export function BalanceBadge() {
  const { data: account } = useQuery({
    ...getGetBitlaunchAccountQueryOptions(),
    refetchInterval: 5 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
  });

  const balance = account?.balance;
  if (balance == null) return null;

  const isCritical = balance <= CRITICAL_BALANCE_USD;
  const isLow = balance <= LOW_BALANCE_USD;

  return (
    <div
      className={cn(
        'flex items-center gap-2 text-[11px] font-mono-num',
        isCritical
          ? 'text-destructive'
          : isLow
            ? 'text-[hsl(38,95%,60%)]'
            : 'text-muted-foreground',
      )}
      title={
        isLow
          ? `Balance $${balance.toFixed(2)} — top up to avoid server suspension`
          : `Balance $${balance.toFixed(2)}`
      }
    >
      <Wallet className="h-3 w-3 flex-shrink-0" />
      <span>${balance.toFixed(2)}</span>
      {isLow && (
        <span className="ml-auto uppercase tracking-[0.12em] text-[9px] font-semibold">
          {isCritical ? 'critical' : 'low'}
        </span>
      )}
    </div>
  );
}
