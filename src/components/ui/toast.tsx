import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { genId } from '../../lib/utils';

interface ToastItem {
  id: string;
  title: string;
  desc?: string;
  tone: 'success' | 'error' | 'info';
}

let pushFn: (t: Omit<ToastItem, 'id'>) => void = () => {};

export function toast(title: string, desc?: string, tone: ToastItem['tone'] = 'success') {
  pushFn({ title, desc, tone });
}

const icons = {
  success: <CheckCircle2 className="h-5 w-5 text-success" />,
  error: <AlertCircle className="h-5 w-5 text-destructive" />,
  info: <Info className="h-5 w-5 text-primary" />,
};

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    pushFn = (t) => {
      const item = { ...t, id: genId('toast') };
      setItems((s) => [...s.slice(-3), item]);
      setTimeout(() => setItems((s) => s.filter((x) => x.id !== item.id)), 4000);
    };
    return () => {
      pushFn = () => {};
    };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex w-[360px] flex-col gap-2">
      {items.map((t) => (
        <div key={t.id} className={cn('flex items-start gap-3 rounded-lg border bg-card p-4 shadow-lift animate-slide-up')}>
          {icons[t.tone]}
          <div className="flex-1">
            <p className="text-sm font-semibold">{t.title}</p>
            {t.desc && <p className="mt-0.5 text-sm text-muted-foreground">{t.desc}</p>}
          </div>
          <button onClick={() => setItems((s) => s.filter((x) => x.id !== t.id))} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
