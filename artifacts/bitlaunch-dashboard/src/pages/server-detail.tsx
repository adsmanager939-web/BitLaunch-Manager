import { useParams, Link, useLocation } from 'wouter';
import { useState } from 'react';
import {
  useGetBitlaunchServer,
  getGetBitlaunchServerQueryKey,
  useCreateBitlaunchSnapshot,
  useRebootBitlaunchServer,
  useDestroyBitlaunchServer,
  getListBitlaunchServersQueryKey
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Server,
  MapPin,
  Cpu,
  Layers,
  Fingerprint,
  Calendar,
  DollarSign,
  Network,
  AlertTriangle,
  RefreshCw,
  Camera,
  Trash2,
  Power
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/status-badge';
import { formatCostPerHour, formatDate, fallback } from '@/lib/format';
import { useToast } from '@/hooks/use-toast';

function CreateSnapshotDialog({ serverId }: { serverId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [snapshotName, setSnapshotName] = useState(`golden-image-v1`);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const createSnapshot = useCreateBitlaunchSnapshot({
    mutation: {
      onSuccess: (data) => {
        setIsOpen(false);
        toast({
          title: "Snapshot Created",
          description: `Snapshot is now pending. ID: ${data.id}`,
        });
        setLocation(`/images?poll=${data.id}`);
      },
      onError: (err) => {
        toast({
          title: "Failed to create snapshot",
          description: err.data?.error || err.message || "An unknown error occurred",
          variant: "destructive"
        });
      }
    }
  });

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid="button-create-snapshot">
          <Camera className="mr-1.5 h-4 w-4" />
          Create Snapshot
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Golden Image</DialogTitle>
          <DialogDescription>
            Capture the current state of this server as a reusable snapshot.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="snapshot-name">Snapshot Name</Label>
            <Input
              id="snapshot-name"
              value={snapshotName}
              onChange={(e) => setSnapshotName(e.target.value)}
              placeholder="e.g. golden-image-v1"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button 
            onClick={() => createSnapshot.mutate({ id: serverId, data: { name: snapshotName } })}
            disabled={!snapshotName.trim() || createSnapshot.isPending}
            data-testid="button-submit-snapshot"
          >
            {createSnapshot.isPending ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ServerDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id ?? '';
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: server, isLoading, isError, refetch, isFetching } = useGetBitlaunchServer(id, {
    query: { enabled: !!id, queryKey: getGetBitlaunchServerQueryKey(id) },
  });

  const rebootServer = useRebootBitlaunchServer({
    mutation: {
      onSuccess: () => {
        toast({ title: 'Reboot initiated', description: 'Server is rebooting.' });
        refetch();
      },
      onError: (err) => {
        toast({ title: 'Failed to reboot', description: err.data?.error || err.message || 'Unknown error occurred', variant: 'destructive' });
      },
    },
  });

  const destroyServer = useDestroyBitlaunchServer({
    mutation: {
      onSuccess: () => {
        toast({ title: 'Server destroyed', description: 'The server has been permanently deleted.' });
        queryClient.invalidateQueries({ queryKey: getListBitlaunchServersQueryKey() });
        setLocation('/servers');
      },
      onError: (err) => {
        toast({ title: 'Failed to destroy', description: err.data?.error || err.message || 'Unknown error occurred', variant: 'destructive' });
      },
    },
  });

  return (
    <div className="pb-16">
      <div className="px-6 md:px-8 pt-8 pb-2">
        <Link
          href="/servers"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          data-testid="link-back-servers"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to servers
        </Link>
      </div>

      <PageHeader
        eyebrow={`Instance / ${id || 'unknown'}`}
        title={isLoading ? 'Loading server…' : fallback(server?.name, 'Unnamed Server')}
        description="Full instance record as reported by the BitLaunch API."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => rebootServer.mutate({ id })}
              disabled={rebootServer.isPending || !server}
              data-testid="button-reboot-server"
            >
              <Power className="mr-1.5 h-4 w-4" />
              Reboot
            </Button>
            {server && <CreateSnapshotDialog serverId={id} />}
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              data-testid="button-refresh-server"
            >
              <RefreshCw className={isFetching ? 'animate-spin' : ''} />
              Refresh
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={!server} data-testid="button-destroy-server">
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  Destroy
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently destroy the server <strong className="text-foreground">{fallback(server?.name)}</strong>. 
                    All data on this server will be lost. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => destroyServer.mutate({ id })}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={destroyServer.isPending}
                  >
                    {destroyServer.isPending ? 'Destroying...' : 'Yes, destroy server'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        }
      />

      <div className="px-6 md:px-8 pt-6 space-y-5 max-w-4xl">
        {isError && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="flex items-center gap-3 py-4">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Failed to load server</p>
                <p className="text-xs text-muted-foreground">
                  Server "{id}" could not be retrieved from the API.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-retry-server">
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : !isError && server ? (
          <>
            <Card className="grid-scan-bg overflow-hidden">
              <CardContent className="p-6 flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/15 border border-primary/30">
                    <Server className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <div className="font-display text-xl font-bold text-foreground" data-testid="text-server-name">
                      {fallback(server.name, 'Unnamed Server')}
                    </div>
                    <div className="font-mono-num text-xs text-muted-foreground" data-testid="text-server-id">
                      id: {fallback(server.id)}
                    </div>
                  </div>
                </div>
                <StatusBadge status={server.status} />
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DetailField icon={Network} label="IP Address" value={fallback(server.ip)} mono testId="ip" />
              <DetailField icon={MapPin} label="Region" value={fallback(server.region)} testId="region" />
              <DetailField icon={Cpu} label="Size" value={fallback(server.size)} testId="size" />
              <DetailField icon={Layers} label="Image" value={fallback(server.image)} testId="image" />
              <DetailField
                icon={DollarSign}
                label="Cost per Hour"
                value={formatCostPerHour(server.costPerHour)}
                mono
                testId="cost"
              />
              <DetailField icon={Calendar} label="Created At" value={formatDate(server.createdAt)} testId="created" />
              <DetailField icon={Fingerprint} label="Server ID" value={fallback(server.id)} mono testId="full-id" />
              <DetailField icon={Server} label="Status" value={fallback(server.status)} testId="status-raw" />
            </div>
          </>
        ) : !isError ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No server data available.
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function DetailField({
  icon: Icon,
  label,
  value,
  mono,
  testId,
}: {
  icon: typeof Server;
  label: string;
  value: string;
  mono?: boolean;
  testId: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono-num mb-0.5">
            {label}
          </div>
          <div
            className={`text-sm text-foreground truncate ${mono ? 'font-mono-num' : ''}`}
            data-testid={`text-detail-${testId}`}
          >
            {value}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
