import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export function Dialog({ open, onClose, children, wide }: { open: boolean; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', fn);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', fn);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <div className={cn('relative w-full rounded-lg border bg-card shadow-lift animate-slide-up max-h-[90vh] overflow-y-auto', wide ? 'max-w-3xl' : 'max-w-lg')}>
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({ title, desc, onClose }: { title: string; desc?: string; onClose?: () => void }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b p-5 pb-4">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {desc && <p className="mt-1 text-sm text-muted-foreground">{desc}</p>}
      </div>
      {onClose && (
        <button onClick={onClose} className="rounded-md p-1.5 hover:bg-accent text-muted-foreground" aria-label="Đóng">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function DialogBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center justify-end gap-2 border-t p-5 pt-4', className)} {...props} />;
}
