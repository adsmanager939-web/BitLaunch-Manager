import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { getListBitlaunchServersQueryKey } from '@workspace/api-client-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Zap,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Loader2,
  ChevronRight,
  KeyRound,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type SessionPhase =
  | 'provisioning'
  | 'wg_setup'
  | 'ready'
  | 'ending_wg'
  | 'ending_destroy'
  | 'done'
  | 'error';

interface SessionStatus {
  sessionId: string;
  serverId: string | null;
  userId: string;
  phase: SessionPhase;
  steps: string[];
  serverIp: string | null;
  wgConfig: string | null;
  error: string | null;
  startedAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PHASE_ORDER: SessionPhase[] = ['provisioning', 'wg_setup', 'ready'];

const PHASE_LABELS: Record<SessionPhase, string> = {
  provisioning: 'Provisioning server',
  wg_setup: 'Configuring VPN',
  ready: 'Session ready',
  ending_wg: 'Revoking VPN access',
  ending_destroy: 'Destroying server',
  done: 'Session ended',
  error: 'Error',
};

function phaseIndex(phase: SessionPhase): number {
  return PHASE_ORDER.indexOf(phase);
}

function isTerminal(phase: SessionPhase): boolean {
  return phase === 'ready' || phase === 'done' || phase === 'error';
}

// All session fetches include credentials so the session cookie is sent.
const SESSION_FETCH_OPTS: RequestInit = { credentials: 'include' };

async function checkSessionAuth(): Promise<boolean> {
  const res = await fetch('/api/sessions/auth/status', SESSION_FETCH_OPTS);
  if (!res.ok) return false;
  const data: { authenticated: boolean } = await res.json();
  return data.authenticated;
}

async function loginSession(key: string): Promise<void> {
  const res = await fetch('/api/sessions/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key }),
    credentials: 'include',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? 'Authentication failed');
  }
}

async function fetchSessionStatus(sessionId: string): Promise<SessionStatus> {
  const res = await fetch(`/api/sessions/${sessionId}/status`, SESSION_FETCH_OPTS);
  if (!res.ok) throw new Error(`Status fetch failed: ${res.status}`);
  return res.json();
}

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={copy}
      className="h-7 px-2 text-xs"
    >
      {copied ? (
        <Check className="h-3 w-3 mr-1 text-green-500" />
      ) : (
        <Copy className="h-3 w-3 mr-1" />
      )}
      {copied ? 'Copied' : 'Copy'}
    </Button>
  );
}

// ── Progress step list ────────────────────────────────────────────────────────

function StepRow({
  label,
  status,
}: {
  label: string;
  status: 'done' | 'active' | 'pending' | 'error';
}) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      {status === 'done' ? (
        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
      ) : status === 'active' ? (
        <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
      ) : status === 'error' ? (
        <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
      ) : (
        <div className="h-4 w-4 rounded-full border border-muted-foreground/30 shrink-0" />
      )}
      <span
        className={`text-sm ${
          status === 'done'
            ? 'text-foreground'
            : status === 'active'
              ? 'text-primary font-medium'
              : status === 'error'
                ? 'text-destructive'
                : 'text-muted-foreground'
        }`}
      >
        {label}
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function LaunchSessionDialog() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Dialog open state
  const [isOpen, setIsOpen] = useState(false);

  // Auth state — checked on dialog open
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sessionKey, setSessionKey] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);
  const [form, setForm] = useState({
    snapshotId: '',
    userId: '',
    serverName: 'session-server',
    region: 'nyc1',
    plan: 's-2vcpu-4gb',
    provider: 'digitalocean',
  });

  const { data: status } = useQuery({
    queryKey: ['session', sessionId],
    queryFn: () => fetchSessionStatus(sessionId!),
    enabled: !!sessionId,
    refetchInterval: (query) => {
      const phase = query.state.data?.phase;
      return phase && isTerminal(phase) ? false : 2_000;
    },
  });

  // Invalidate server list when the session reaches a terminal state.
  // On 'ready': the new server should appear in the list.
  // On 'error' with a non-null serverId: an orphaned server may exist and
  // needs to be visible so the user can navigate to it and use End Session.
  useEffect(() => {
    if (
      status?.phase === 'ready' ||
      (status?.phase === 'error' && status.serverId)
    ) {
      queryClient.invalidateQueries({ queryKey: getListBitlaunchServersQueryKey() });
    }
  }, [status?.phase, status?.serverId, queryClient]);

  const handleOpen = async () => {
    setIsOpen(true);
    if (!authChecked) {
      const ok = await checkSessionAuth().catch(() => false);
      setIsAuthenticated(ok);
      setAuthChecked(true);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthenticating(true);
    try {
      await loginSession(sessionKey);
      setIsAuthenticated(true);
      setSessionKey('');
    } catch (err) {
      toast({
        title: 'Authentication failed',
        description: String(err),
        variant: 'destructive',
      });
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLaunch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLaunching(true);
    try {
      const res = await fetch('/api/sessions/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json();
        // Re-check auth if we get a 401 (cookie expired mid-dialog)
        if (res.status === 401) {
          setIsAuthenticated(false);
          setAuthChecked(false);
        }
        throw new Error((data as { error?: string }).error ?? `Launch failed: ${res.status}`);
      }
      const data: { sessionId: string } = await res.json();
      setSessionId(data.sessionId);
    } catch (err) {
      toast({
        title: 'Failed to launch session',
        description: String(err),
        variant: 'destructive',
      });
    } finally {
      setIsLaunching(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => {
      setSessionId(null);
      setIsLaunching(false);
      setForm({
        snapshotId: '',
        userId: '',
        serverName: 'session-server',
        region: 'nyc1',
        plan: 's-2vcpu-4gb',
        provider: 'digitalocean',
      });
    }, 300);
  };

  const currentPhaseIdx = status ? phaseIndex(status.phase) : -1;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (open ? handleOpen() : handleClose())}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          onClick={handleOpen}
          data-testid="button-launch-session"
        >
          <Zap className="mr-1.5 h-4 w-4" />
          Launch Session
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Launch User Session</DialogTitle>
          <DialogDescription>
            Provisions a server from a snapshot. WireGuard VPN is configured
            automatically when{' '}
            <code className="font-mono-num">WG_SERVER_HOST</code> and{' '}
            <code className="font-mono-num">WG_SERVER_API_KEY</code> are set.
          </DialogDescription>
        </DialogHeader>

        {/* ── Auth gate ─────────────────────────────────────────────────── */}
        {!authChecked && (
          <div className="py-8 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {authChecked && !isAuthenticated && (
          <form onSubmit={handleLogin}>
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="session-key">Session key</Label>
                <Input
                  id="session-key"
                  type="password"
                  value={sessionKey}
                  onChange={(e) => setSessionKey(e.target.value)}
                  placeholder="Enter your SESSION_SECRET"
                  required
                  autoFocus
                  data-testid="input-session-key"
                />
                <p className="text-xs text-muted-foreground">
                  Enter the value of the{' '}
                  <code className="font-mono-num">SESSION_SECRET</code>{' '}
                  environment variable to unlock session operations.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isAuthenticating || !sessionKey.trim()}
                data-testid="button-submit-session-key"
              >
                {isAuthenticating ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <KeyRound className="mr-1.5 h-4 w-4" />
                )}
                Authenticate
              </Button>
            </DialogFooter>
          </form>
        )}

        {/* ── Form (before launch) ─────────────────────────────────────── */}
        {authChecked && isAuthenticated && !sessionId && (
          <form onSubmit={handleLaunch}>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="s-snapshot">Snapshot / Image ID</Label>
                  <Input
                    id="s-snapshot"
                    value={form.snapshotId}
                    onChange={(e) =>
                      setForm({ ...form, snapshotId: e.target.value })
                    }
                    placeholder="e.g. 12345"
                    required
                    data-testid="input-session-snapshot"
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="s-user">User ID</Label>
                  <Input
                    id="s-user"
                    value={form.userId}
                    onChange={(e) =>
                      setForm({ ...form, userId: e.target.value })
                    }
                    placeholder="e.g. user-42"
                    required
                    data-testid="input-session-user"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="s-name">Server Name</Label>
                  <Input
                    id="s-name"
                    value={form.serverName}
                    onChange={(e) =>
                      setForm({ ...form, serverName: e.target.value })
                    }
                    placeholder="session-server"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="s-region">Region</Label>
                  <Input
                    id="s-region"
                    value={form.region}
                    onChange={(e) =>
                      setForm({ ...form, region: e.target.value })
                    }
                    placeholder="nyc1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="s-plan">Plan</Label>
                  <Input
                    id="s-plan"
                    value={form.plan}
                    onChange={(e) =>
                      setForm({ ...form, plan: e.target.value })
                    }
                    placeholder="s-2vcpu-4gb"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="s-provider">Provider</Label>
                  <Input
                    id="s-provider"
                    value={form.provider}
                    onChange={(e) =>
                      setForm({ ...form, provider: e.target.value })
                    }
                    placeholder="digitalocean"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  isLaunching || !form.snapshotId.trim() || !form.userId.trim()
                }
                data-testid="button-submit-launch"
              >
                {isLaunching ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    Starting…
                  </>
                ) : (
                  <>
                    <Zap className="mr-1.5 h-4 w-4" />
                    Launch
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}

        {/* ── Progress (after launch) ──────────────────────────────────── */}
        {sessionId && (
          <div className="py-4 space-y-5">
            {/* Step list */}
            <div className="space-y-0.5">
              {PHASE_ORDER.map((phase, idx) => {
                let rowStatus: 'done' | 'active' | 'pending' | 'error' =
                  'pending';
                if (status?.phase === 'error' && idx === currentPhaseIdx)
                  rowStatus = 'error';
                else if (idx < currentPhaseIdx) rowStatus = 'done';
                else if (idx === currentPhaseIdx) rowStatus = 'active';
                return (
                  <StepRow
                    key={phase}
                    label={PHASE_LABELS[phase]}
                    status={rowStatus}
                  />
                );
              })}
            </div>

            {/* Error */}
            {status?.phase === 'error' && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
                <p className="text-sm text-destructive font-medium">
                  {status.error ?? 'An unexpected error occurred.'}
                </p>
              </div>
            )}

            {/* Ready — server info + WG config */}
            {status?.phase === 'ready' && (
              <div className="space-y-3">
                <div className="rounded-md border border-green-500/30 bg-green-500/5 p-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  <div className="text-sm">
                    <span className="font-medium text-foreground">
                      Session ready
                    </span>
                    {status.serverIp && (
                      <span className="text-muted-foreground ml-2 font-mono-num">
                        {status.serverIp}
                      </span>
                    )}
                    {status.serverId && (
                      <span className="text-muted-foreground ml-2 text-xs">
                        id: {status.serverId}
                      </span>
                    )}
                  </div>
                </div>

                {status.wgConfig && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        WireGuard Config
                      </p>
                      <CopyButton text={status.wgConfig} />
                    </div>
                    <pre className="text-xs bg-muted rounded-md p-3 overflow-x-auto font-mono leading-relaxed">
                      {status.wgConfig}
                    </pre>
                  </div>
                )}

                {!status.wgConfig && (
                  <p className="text-xs text-muted-foreground">
                    WireGuard not configured — set{' '}
                    <code className="font-mono-num">WG_SERVER_HOST</code> and{' '}
                    <code className="font-mono-num">WG_SERVER_API_KEY</code>{' '}
                    to enable VPN setup.
                  </p>
                )}
              </div>
            )}

            {/* Step log (collapsed detail) */}
            {status && status.steps.length > 0 && (
              <details className="group">
                <summary className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors">
                  <ChevronRight className="h-3 w-3 transition-transform group-open:rotate-90" />
                  Step log ({status.steps.length})
                </summary>
                <ul className="mt-2 space-y-0.5 font-mono-num text-xs text-muted-foreground pl-4">
                  {status.steps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ul>
              </details>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={!!status && !isTerminal(status.phase)}
              >
                {status?.phase === 'ready' ? 'Done' : 'Close'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
