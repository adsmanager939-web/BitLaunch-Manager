import { useListBitlaunchImages } from '@workspace/api-client-react';
import { useState, useMemo } from 'react';
import { Disc3, AlertTriangle, RefreshCw, Search, Boxes } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/status-badge';
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from '@/components/ui/empty';
import { fallback, formatSize } from '@/lib/format';

export default function Images() {
  const { data: images, isLoading, isError, refetch, isFetching } = useListBitlaunchImages();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!images) return [];
    const q = query.trim().toLowerCase();
    if (!q) return images;
    return images.filter((img) =>
      [img.name, img.distribution, img.type, img.status]
        .filter(Boolean)
        .some((f) => f!.toLowerCase().includes(q)),
    );
  }, [images, query]);

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="Boot Sources"
        title="Images & Snapshots"
        description="Distribution images, custom snapshots, and templates available for provisioning."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            data-testid="button-refresh-images"
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
                <p className="text-sm font-medium text-foreground">Failed to load images</p>
                <p className="text-xs text-muted-foreground">Could not reach the BitLaunch images endpoint.</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-retry-images">
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {!isError && (
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, distribution, type…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-images"
            />
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full rounded-lg" />
            ))}
          </div>
        ) : !isError && images && images.length === 0 ? (
          <Card>
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Disc3 />
                </EmptyMedia>
                <EmptyTitle>No images available</EmptyTitle>
                <EmptyDescription>
                  No distribution images or snapshots were found on this account. Snapshots you capture from
                  servers will show up here.
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
                <EmptyDescription>No images match "{query}". Try a different search term.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </Card>
        ) : !isError ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((image, idx) => (
                <Card key={image.id ?? idx} className="hover-elevate" data-testid={`card-image-${image.id ?? idx}`}>
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/12 border border-accent/25">
                          <Disc3 className="h-4 w-4 text-accent" />
                        </div>
                        <div className="min-w-0">
                          <div
                            className="text-sm font-semibold text-foreground truncate"
                            data-testid={`text-image-name-${image.id ?? idx}`}
                          >
                            {fallback(image.name)}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {fallback(image.distribution, 'unknown distro')}
                          </div>
                        </div>
                      </div>
                      <StatusBadge status={image.status} />
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-border">
                      <Badge variant="outline" className="gap-1.5 font-mono-num text-[10px] uppercase">
                        <Boxes className="h-3 w-3" />
                        {fallback(image.type, 'image')}
                      </Badge>
                      <div className="font-mono-num text-sm text-foreground" data-testid={`text-image-size-${image.id ?? idx}`}>
                        {formatSize(image.sizeGb)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="text-xs text-muted-foreground font-mono-num">
              {filtered.length} of {images?.length ?? 0} images shown
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
