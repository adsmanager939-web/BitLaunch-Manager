import { useGetBitlaunchSummary, useGetBitlaunchAccount } from '@workspace/api-client-react';
import { Link } from 'wouter';
import {
  Server,
  Disc3,
  HardDrive,
  Wallet,
  Mail,
  ShieldCheck,
  ArrowUpRight,
  AlertTriangle,
  RefreshCw,
  Terminal,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/status-badge';
import { formatCurrency, initials } from '@/lib/format';

export default function Dashboard() {
  const { data: summary, isLoading, isError, refetch, isFetching } = useGetBitlaunchSummary();
  const { data: account, isLoading: isAccountLoading } = useGetBitlaunchAccount();

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="Mission Control"
        title="Account Overview"
        description="Real-time snapshot of your BitLaunch infrastructure footprint."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            data-testid="button-refresh-summary"
          >
            <RefreshCw className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </Button>
        }
      />

      <div className="px-6 md:px-8 pt-8 space-y-8">
        {isError && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="flex items-center gap-3 py-4">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Failed to load account summary</p>
                <p className="text-xs text-muted-foreground">The BitLaunch API did not respond as expected.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-retry-summary">
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Account summary — hero card */}
        <div className="relative overflow-hidden rounded-xl border border-card-border bg-card grid-scan-bg">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.06] via-transparent to-accent/[0.05] pointer-events-none" />
          <div className="relative p-6 md:p-8">
            {isLoading ? (
              <div className="flex flex-col md:flex-row md:items-center gap-8">
                <Skeleton className="h-16 w-16 rounded-full" />
                <div className="space-y-3 flex-1">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-8 w-64" />
                </div>
                <Skeleton className="h-14 w-40" />
              </div>
            ) : (
              <div className="flex flex-col md:flex-row md:items-center gap-8">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/15 border border-primary/30 font-display text-xl font-bold text-primary">
                    {initials(summary?.account?.email)}
                  </div>
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span
                        className="text-sm text-foreground font-medium truncate"
                        data-testid="text-account-email"
                      >
                        {summary?.account?.email ?? 'No email on file'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <StatusBadge status={summary?.account?.status} />
                    </div>
                  </div>
                </div>

                <div className="hidden md:block w-px h-14 bg-border" />

                <div className="flex-1 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[hsl(152,60%,45%)]/12 border border-[hsl(152,60%,45%)]/25">
                    <Wallet className="h-5 w-5 text-[hsl(152,65%,58%)]" />
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wider font-mono-num text-muted-foreground">
                      Account Balance
                    </div>
                    <div
                      className="font-display text-3xl font-bold tabular-nums text-foreground"
                      data-testid="text-account-balance"
                    >
                      {formatCurrency(summary?.account?.balance, summary?.account?.currency)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Resource counts */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ResourceCard
            href="/servers"
            label="Servers"
            value={summary?.serverCount}
            icon={Server}
            tint="primary"
            isLoading={isLoading}
            testId="servers"
          />
          <ResourceCard
            href="/images"
            label="Images & Snapshots"
            value={summary?.imageCount}
            icon={Disc3}
            tint="accent"
            isLoading={isLoading}
            testId="images"
          />
          <ResourceCard
            href="/volumes"
            label="Block Volumes"
            value={summary?.volumeCount}
            icon={HardDrive}
            tint="violet"
            isLoading={isLoading}
            testId="volumes"
          />
        </div>

        {/* Quick status strip */}
        <Card>
          <CardContent className="py-5 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
            <div className="flex items-center gap-2 text-xs font-mono-num uppercase tracking-wider text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-[hsl(152,65%,55%)] animate-pulse" />
              System telemetry
            </div>
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <MetricStrip label="Currency" value={summary?.account?.currency ?? '—'} />
              <MetricStrip
                label="Total Resources"
                value={
                  isLoading
                    ? '—'
                    : String(
                        (summary?.serverCount ?? 0) +
                          (summary?.imageCount ?? 0) +
                          (summary?.volumeCount ?? 0),
                      )
                }
              />
              <MetricStrip label="Account Status" value={summary?.account?.status ?? 'unknown'} />
              <MetricStrip label="Sync" value={isFetching ? 'syncing…' : 'up to date'} />
            </div>
          </CardContent>
        </Card>

        {/* Account verification panel — direct account endpoint */}
        <Card className="bg-card/60">
          <CardContent className="py-5">
            <div className="flex items-center gap-2 mb-4">
              <Terminal className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-mono-num uppercase tracking-wider text-muted-foreground">
                account.verify — direct query
              </span>
            </div>
            {isAccountLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono-num text-sm">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">email</div>
                  <div className="text-foreground truncate" data-testid="text-verify-email">
                    {account?.email ?? 'null'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">balance</div>
                  <div className="text-foreground" data-testid="text-verify-balance">
                    {formatCurrency(account?.balance, account?.currency)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">currency</div>
                  <div className="text-foreground" data-testid="text-verify-currency">
                    {account?.currency ?? 'null'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">status</div>
                  <div className="text-foreground capitalize" data-testid="text-verify-status">
                    {account?.status ?? 'null'}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricStrip({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono-num">{label}</div>
      <div className="text-sm font-medium text-foreground capitalize truncate">{value}</div>
    </div>
  );
}

function ResourceCard({
  href,
  label,
  value,
  icon: Icon,
  tint,
  isLoading,
  testId,
}: {
  href: string;
  label: string;
  value: number | undefined;
  icon: typeof Server;
  tint: 'primary' | 'accent' | 'violet';
  isLoading: boolean;
  testId: string;
}) {
  const tintStyles = {
    primary: 'bg-primary/12 border-primary/25 text-primary',
    accent: 'bg-accent/12 border-accent/25 text-accent',
    violet: 'bg-[hsl(271,50%,62%)]/12 border-[hsl(271,50%,62%)]/25 text-[hsl(271,55%,72%)]',
  }[tint];

  return (
    <Link href={href} data-testid={`link-resource-${testId}`}>
      <Card className="hover-elevate active-elevate-2 cursor-pointer h-full transition-transform">
        <CardContent className="p-5 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wider font-mono-num text-muted-foreground mb-1.5">
              {label}
            </div>
            {isLoading ? (
              <Skeleton className="h-9 w-16" />
            ) : (
              <div className="font-display text-4xl font-bold tabular-nums text-foreground" data-testid={`text-count-${testId}`}>
                {value ?? 0}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${tintStyles}`}>
              <Icon className="h-5 w-5" />
            </div>
            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
