import { useListBitlaunchServers } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { useState, useMemo } from 'react';
import { Server, AlertTriangle, RefreshCw, Search, ArrowUpRight, MapPin, Cpu, Layers } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/status-badge';
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from '@/components/ui/empty';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCostPerHour, fallback } from '@/lib/format';

export default function Servers() {
  const { data: servers, isLoading, isError, refetch, isFetching } = useListBitlaunchServers();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!servers) return [];
    const q = query.trim().toLowerCase();
    if (!q) return servers;
    return servers.filter((s) =>
      [s.name, s.id, s.ip, s.region, s.size, s.image, s.status]
        .filter(Boolean)
        .some((f) => f!.toLowerCase().includes(q)),
    );
  }, [servers, query]);

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="Compute"
        title="Servers"
        description="All provisioned compute instances across your regions."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            data-testid="button-refresh-servers"
          >
            <RefreshCw className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </Button>
        }
      />

      <div className="px-6 md:px-8 pt-6 space-y-5">
        {isError && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="flex items-center gap-3 py-4">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Failed to load servers</p>
                <p className="text-xs text-muted-foreground">Could not reach the BitLaunch servers endpoint.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-retry-servers">
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {!isError && (
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, IP, region, size…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-servers"
            />
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : !isError && servers && servers.length === 0 ? (
          <Card>
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Server />
                </EmptyMedia>
                <EmptyTitle>No servers deployed</EmptyTitle>
                <EmptyDescription>
                  You haven't provisioned any compute instances yet. Servers you create through BitLaunch will
                  appear here with live status, IP, and cost telemetry.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </Card>
        ) : !isError && filtered.length === 0 ? (
          <Card>
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Search />
                </EmptyMedia>
                <EmptyTitle>No matches</EmptyTitle>
                <EmptyDescription>No servers match "{query}". Try a different search term.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </Card>
        ) : !isError ? (
          <>
            {/* Desktop table */}
            <Card className="hidden md:block overflow-hidden p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-mono-num text-[11px] uppercase tracking-wider">Name</TableHead>
                    <TableHead className="font-mono-num text-[11px] uppercase tracking-wider">Status</TableHead>
                    <TableHead className="font-mono-num text-[11px] uppercase tracking-wider">IP Address</TableHead>
                    <TableHead className="font-mono-num text-[11px] uppercase tracking-wider">Region</TableHead>
                    <TableHead className="font-mono-num text-[11px] uppercase tracking-wider">Size</TableHead>
                    <TableHead className="font-mono-num text-[11px] uppercase tracking-wider">Image</TableHead>
                    <TableHead className="font-mono-num text-[11px] uppercase tracking-wider text-right">
                      Cost / hr
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((server, idx) => (
                    <TableRow
                      key={server.id ?? idx}
                      className="cursor-pointer"
                      data-testid={`row-server-${server.id ?? idx}`}
                    >
                      <TableCell className="p-0">
                        <Link
                          href={`/servers/${server.id ?? ''}`}
                          className="flex items-center gap-2 px-4 py-3.5 font-medium text-foreground hover-elevate"
                          data-testid={`link-server-${server.id ?? idx}`}
                        >
                          <Server className="h-3.5 w-3.5 text-primary shrink-0" />
                          {fallback(server.name)}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={server.status} />
                      </TableCell>
                      <TableCell className="font-mono-num text-sm text-muted-foreground">
                        {fallback(server.ip)}
                      </TableCell>
                      <TableCell className="text-sm">{fallback(server.region)}</TableCell>
                      <TableCell className="text-sm">{fallback(server.size)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fallback(server.image)}</TableCell>
                      <TableCell className="text-right font-mono-num text-sm text-foreground">
                        {formatCostPerHour(server.costPerHour)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {filtered.map((server, idx) => (
                <Link
                  key={server.id ?? idx}
                  href={`/servers/${server.id ?? ''}`}
                  data-testid={`link-server-mobile-${server.id ?? idx}`}
                >
                  <Card className="hover-elevate active-elevate-2">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-medium text-foreground">
                          <Server className="h-4 w-4 text-primary" />
                          {fallback(server.name)}
                        </div>
                        <StatusBadge status={server.status} />
                      </div>
                      <div className="grid grid-cols-2 gap-y-1.5 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3 w-3" /> {fallback(server.region)}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Cpu className="h-3 w-3" /> {fallback(server.size)}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Layers className="h-3 w-3" /> {fallback(server.image)}
                        </div>
                        <div className="font-mono-num text-foreground">{formatCostPerHour(server.costPerHour)}</div>
                      </div>
                      <div className="font-mono-num text-xs text-muted-foreground">{fallback(server.ip)}</div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>

            <div className="text-xs text-muted-foreground font-mono-num flex items-center gap-1.5">
              <ArrowUpRight className="h-3 w-3" />
              {filtered.length} of {servers?.length ?? 0} servers shown
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
