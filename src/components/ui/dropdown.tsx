import React, { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/utils';

export function Dropdown({ trigger, children, align = 'right', className }: {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const kf = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', fn);
    document.addEventListener('keydown', kf);
    return () => {
      document.removeEventListener('mousedown', fn);
      document.removeEventListener('keydown', kf);
    };
  }, [open ]);

  return (
    <div ref={ref} className={cn('relative inline-block', className)}>
      <div onClick={() => setOpen((o) => !o)} className="cursor-pointer">{trigger}</div>
      {open && (
        <div
          className={cn(
            'absolute z-50 mt-2 min-w-[200px] rounded-lg border bg-popover p-1.5 shadow-lift animate-fade-in',
            align === 'right' ? 'right-0' : 'left-0',
          )}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function DropdownItem({ icon, label, desc, danger, onClick }: {
  icon?: React.ReactNode; label: string; desc?: string; danger?: boolean; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors',
        danger ? 'text-destructive hover:bg-destructive/10' : 'hover:bg-accent',
      )}
    >
      {icon && <span className="text-muted-foreground">{icon}</span>}
      <span>
        <span className="block font-medium">{label}</span>
        {desc && <span className="block text-xs text-muted-foreground">{desc}</span>}
      </span>
    </button>
  );
}

export function DropdownSeparator() {
  return <div className="my-1.5 h-px bg-border" />;
}

export function DropdownLabel({ children }: { children: React.ReactNode }) {
  return <div className="px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</div>;
}
