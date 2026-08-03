import { useListBitlaunchVolumes } from '@workspace/api-client-react';
import { useState, useMemo } from 'react';
import { HardDrive, AlertTriangle, RefreshCw, Search, Link2, Unlink, MapPin, Calendar } from 'lucide-react';
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
import { fallback, formatSize, formatDate } from '@/lib/format';

export default function Volumes() {
  const { data: volumes, isLoading, isError, refetch, isFetching } = useListBitlaunchVolumes();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!volumes) return [];
    const q = query.trim().toLowerCase();
    if (!q) return volumes;
    return volumes.filter((v) =>
      [v.name, v.region, v.status, v.attachedTo]
        .filter(Boolean)
        .some((f) => f!.toLowerCase().includes(q)),
    );
  }, [volumes, query]);

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="Block Storage"
        title="Volumes"
        description="Detachable block storage volumes and their current server attachments."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            data-testid="button-refresh-volumes"
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
                <p className="text-sm font-medium text-foreground">Failed to load volumes</p>
                <p className="text-xs text-muted-foreground">Could not reach the BitLaunch volumes endpoint.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-retry-volumes">
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {!isError && (
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, region, attachment…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-volumes"
            />
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : !isError && volumes && volumes.length === 0 ? (
          <Card>
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <HardDrive />
                </EmptyMedia>
                <EmptyTitle>No volumes provisioned</EmptyTitle>
                <EmptyDescription>
                  You don't have any block storage volumes yet. Volumes attached to your servers will appear here
                  with size and region details.
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
                <EmptyDescription>No volumes match "{query}". Try a different search term.</EmptyDescription>
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
                    <TableHead className="font-mono-num text-[11px] uppercase tracking-wider">Size</TableHead>
                    <TableHead className="font-mono-num text-[11px] uppercase tracking-wider">Region</TableHead>
                    <TableHead className="font-mono-num text-[11px] uppercase tracking-wider">Attached To</TableHead>
                    <TableHead className="font-mono-num text-[11px] uppercase tracking-wider text-right">
                      Created
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((volume, idx) => (
                    <TableRow key={volume.id ?? idx} data-testid={`row-volume-${volume.id ?? idx}`}>
                      <TableCell className="font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          <HardDrive className="h-3.5 w-3.5 text-[hsl(271,55%,72%)] shrink-0" />
                          {fallback(volume.name)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={volume.status} />
                      </TableCell>
                      <TableCell className="font-mono-num text-sm">{formatSize(volume.sizeGb)}</TableCell>
                      <TableCell className="text-sm">{fallback(volume.region)}</TableCell>
                      <TableCell className="text-sm">
                        {volume.attachedTo ? (
                          <span className="inline-flex items-center gap-1.5 text-foreground">
                            <Link2 className="h-3 w-3 text-[hsl(152,65%,55%)]" />
                            {volume.attachedTo}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                            <Unlink className="h-3 w-3" />
                            unattached
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {formatDate(volume.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {filtered.map((volume, idx) => (
                <Card key={volume.id ?? idx} data-testid={`card-volume-mobile-${volume.id ?? idx}`}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-medium text-foreground">
                        <HardDrive className="h-4 w-4 text-[hsl(271,55%,72%)]" />
                        {fallback(volume.name)}
                      </div>
                      <StatusBadge status={volume.status} />
                    </div>
                    <div className="grid grid-cols-2 gap-y-1.5 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3 w-3" /> {fallback(volume.region)}
                      </div>
                      <div className="font-mono-num">{formatSize(volume.sizeGb)}</div>
                      <div className="flex items-center gap-1.5 col-span-2">
                        {volume.attachedTo ? (
                          <>
                            <Link2 className="h-3 w-3 text-[hsl(152,65%,55%)]" />
                            <span className="text-foreground">{volume.attachedTo}</span>
                          </>
                        ) : (
                          <>
                            <Unlink className="h-3 w-3" /> unattached
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 col-span-2">
                        <Calendar className="h-3 w-3" /> {formatDate(volume.createdAt)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="text-xs text-muted-foreground font-mono-num">
              {filtered.length} of {volumes?.length ?? 0} volumes shown
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
