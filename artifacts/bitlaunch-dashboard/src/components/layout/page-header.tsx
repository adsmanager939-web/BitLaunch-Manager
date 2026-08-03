import { ReactNode } from 'react';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 px-6 md:px-8 pt-8 pb-6 border-b border-border">
      <div className="space-y-1.5">
        {eyebrow && (
          <div className="font-mono-num text-[11px] uppercase tracking-[0.2em] text-primary/80">
            {eyebrow}
          </div>
        )}
        <h1 className="font-display text-2xl md:text-[28px] font-bold tracking-tight text-foreground">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground max-w-2xl">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
