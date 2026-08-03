import { Link, useLocation } from 'wouter';
import { ReactNode } from 'react';
import {
  Gauge,
  Server,
  Disc3,
  HardDrive,
  Terminal,
  Radio,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: Gauge, testId: 'dashboard' },
  { href: '/servers', label: 'Servers', icon: Server, testId: 'servers' },
  { href: '/images', label: 'Images', icon: Disc3, testId: 'images' },
  { href: '/volumes', label: 'Volumes', icon: HardDrive, testId: 'volumes' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  const isActive = (href: string) => {
    if (href === '/') return location === '/';
    return location === href || location.startsWith(href + '/');
  };

  return (
    <div className="min-h-[100dvh] w-full flex bg-background">
      {/* Sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-sidebar-border">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 border border-primary/30">
            <Terminal className="h-4 w-4 text-primary" strokeWidth={2.25} />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-display font-bold text-[15px] tracking-tight text-sidebar-foreground">
              BitLaunch
            </span>
            <span className="text-[10px] font-mono-num uppercase tracking-[0.18em] text-muted-foreground">
              ops console
            </span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                data-testid={`link-nav-${item.testId}`}
                className={cn(
                  'group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover-elevate',
                  active
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/70',
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-full bg-primary" />
                )}
                <Icon className={cn('h-4 w-4', active && 'text-primary')} strokeWidth={2} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-5 py-4 border-t border-sidebar-border">
          <div className="flex items-center gap-2 text-[11px] font-mono-num text-muted-foreground">
            <Radio className="h-3 w-3 text-[hsl(152,65%,55%)]" />
            <span>API link nominal</span>
          </div>
        </div>
      </aside>

      {/* Mobile top nav */}
      <div className="md:hidden fixed top-0 inset-x-0 z-30 flex items-center justify-between h-14 px-4 border-b border-sidebar-border bg-sidebar/95 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 border border-primary/30">
            <Terminal className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="font-display font-bold text-sm text-sidebar-foreground">BitLaunch</span>
        </div>
        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                data-testid={`link-nav-mobile-${item.testId}`}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-md hover-elevate',
                  active ? 'text-primary bg-sidebar-accent' : 'text-sidebar-foreground/60',
                )}
              >
                <Icon className="h-4 w-4" />
              </Link>
            );
          })}
        </nav>
      </div>

      <main className="flex-1 min-w-0 pt-14 md:pt-0">{children}</main>
    </div>
  );
}
