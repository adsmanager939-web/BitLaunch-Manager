import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  LogOut,
  CheckCircle2,
  AlertCircle,
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
  phase: SessionPhase;
  steps: string[];
  error: string | null;
}

const END_PHASE_ORDER: SessionPhase[] = ['ending_wg', 'ending_destroy', 'done'];

const PHASE_LABELS: Record<SessionPhase, string> = {
  provisioning: 'Provisioning',
  wg_setup: 'Configuring VPN',
  ready: 'Session ready',
  ending_wg: 'Revoking VPN access',
  ending_destroy: 'Destroying server',
  done: 'Session ended',
  error: 'Error',
};

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

export function EndSessionDialog({
  serverId,
  serverName,
  onEnded,
}: {
  serverId: string;
  serverName: string | null | undefined;
  onEnded?: () => void;
}) {
  const { toast } = useToast();

  // Dialog open state
  const [isOpen, setIsOpen] = useState(false);

  // Auth state — checked on dialog open
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sessionKey, setSessionKey] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isEnding, setIsEnding] = useState(false);

  const { data: status } = useQuery({
    queryKey: ['session-end', sessionId],
    queryFn: () => fetchSessionStatus(sessionId!),
    enabled: !!sessionId,
    refetchInterval: (query) => {
      const phase = query.state.data?.phase;
      return phase && isTerminal(phase) ? false : 2_000;
    },
  });

  // Call onEnded callback once teardown completes — in useEffect to avoid
  // triggering a side effect during render.
  useEffect(() => {
    if (status?.phase === 'done' && onEnded) {
      onEnded();
    }
  }, [status?.phase, onEnded]);

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

  const handleEnd = async () => {
    setIsEnding(true);
    try {
      const res = await fetch(`/api/sessions/${serverId}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json();
        if (res.status === 401) {
          setIsAuthenticated(false);
          setAuthChecked(false);
        }
        throw new Error((data as { error?: string }).error ?? `End session failed: ${res.status}`);
      }
      const data: { sessionId: string } = await res.json();
      setSessionId(data.sessionId);
    } catch (err) {
      toast({
        title: 'Failed to end session',
        description: String(err),
        variant: 'destructive',
      });
    } finally {
      setIsEnding(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => {
      setSessionId(null);
      setIsEnding(false);
    }, 300);
  };

  const currentPhaseIdx = status
    ? END_PHASE_ORDER.indexOf(status.phase)
    : -1;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (open ? handleOpen() : handleClose())}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          onClick={handleOpen}
          data-testid="button-end-session"
        >
          <LogOut className="mr-1.5 h-4 w-4" />
          End Session
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>End User Session</DialogTitle>
          <DialogDescription>
            Revokes VPN access then permanently destroys{' '}
            <strong className="text-foreground">{serverName ?? serverId}</strong>
            . This cannot be undone.
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
                <Label htmlFor="end-session-key">Session key</Label>
                <Input
                  id="end-session-key"
                  type="password"
                  value={sessionKey}
                  onChange={(e) => setSessionKey(e.target.value)}
                  placeholder="Enter your SESSION_SECRET"
                  required
                  autoFocus
                  data-testid="input-end-session-key"
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
                data-testid="button-submit-end-session-key"
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

        {/* ── Confirmation (after auth, before end) ────────────────────── */}
        {authChecked && isAuthenticated && !sessionId && (
          <div className="py-4">
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleEnd}
                disabled={isEnding}
                data-testid="button-confirm-end-session"
              >
                {isEnding ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    Starting…
                  </>
                ) : (
                  <>
                    <LogOut className="mr-1.5 h-4 w-4" />
                    End &amp; Destroy
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* ── Progress ─────────────────────────────────────────────────── */}
        {sessionId && (
          <div className="py-4 space-y-5">
            <div className="space-y-0.5">
              {END_PHASE_ORDER.map((phase, idx) => {
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

            {status?.phase === 'error' && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
                <p className="text-sm text-destructive font-medium">
                  {status.error ?? 'An unexpected error occurred.'}
                </p>
              </div>
            )}

            {status?.phase === 'done' && (
              <div className="rounded-md border border-green-500/30 bg-green-500/5 p-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                <p className="text-sm font-medium text-foreground">
                  Session ended — server destroyed.
                </p>
              </div>
            )}

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
                {status?.phase === 'done' ? 'Done' : 'Close'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
