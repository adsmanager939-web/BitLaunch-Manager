import { Card, CardContent } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { Link } from 'wouter';
import { TerminalSquare, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-background grid-scan-bg px-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-8 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-destructive/10 border border-destructive/30">
            <TerminalSquare className="h-7 w-7 text-destructive" />
          </div>
          <div>
            <div className="font-mono-num text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">
              error 404
            </div>
            <h1 className="font-display text-xl font-bold text-foreground">Route not found</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This path isn't wired into the console. Check the URL or head back to mission control.
            </p>
          </div>
          <Link
            href="/"
            data-testid="link-home-notfound"
            className={buttonVariants({ variant: 'outline', size: 'sm' }) + ' mx-auto'}
          >
            <ArrowLeft />
            Back to dashboard
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
