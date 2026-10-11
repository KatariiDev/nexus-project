import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Briefcase, ListChecks, Users, FileText } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { useUI } from './UIContext';
import { cn } from '../../lib/utils';

export function SearchOverlay() {
  const { searchOpen, setSearchOpen, openTask } = useUI();
  const { state } = useApp();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) {
      setQ('');
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [searchOpen ]);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(!searchOpen);
      }
      if (e.key === 'Escape') setSearchOpen(false);
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [searchOpen, setSearchOpen]);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return null;
    const match = (s: string) => s.toLowerCase().includes(query);
    return {
      projects: state.projects.filter((p) => match(p.name) || match(p.code)).slice(0, 4),
      tasks: state.tasks.filter((t) => match(t.title) || match(t.code)).slice(0, 6),
      users: state.users.filter((u) => match(u.name) || match(u.email)).slice(0, 4),
      docs: state.documents.filter((x) => match(x.title)).slice(0, 4),
    };
  }, [q, state]);

  const go = (path: string) => {
    setSearchOpen(false);
    navigate(path);
  };

  if (!searchOpen) return null;

  const Group = ({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) => (
    <div className="px-2 py-1.5">
      <p className="flex items-center gap-1.5 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {icon} {label}
      </p>
      {children}
    </div>
  );

  const Item = ({ title, sub, onClick }: { title: string; sub?: string; onClick: () => void }) => (
    <button onClick={onClick} className="flex w-full flex-col rounded-md px-3 py-2 text-left hover:bg-accent">
      <span className="text-sm font-medium">{title}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[12vh] px-4">
      <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={() => setSearchOpen(false)} />
      <div className="relative w-full max-w-xl overflow-hidden rounded-lg border bg-card shadow-lift animate-slide-up">
        <div className="flex items-center gap-2 border-b px-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm dự án, nhiệm vụ, thành viên, tài liệu..."
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-semibold">ESC</kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto py-1">
          {!results && (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Nhập từ khóa để tìm kiếm trong workspace.
            </p>
          )}
          {results && (
            <>
              {results.projects.length > 0 && (
                <Group icon={<Briefcase className="h-3.5 w-3.5" />} label="Dự án">
                  {results.projects.map((p) => (
                    <Item key={p.id} title={p.name} sub={p.code} onClick={() => go(`/projects/${p.id}`)} />
                  ))}
                </Group>
              )}
              {results.tasks.length > 0 && (
                <Group icon={<ListChecks className="h-3.5 w-3.5" />} label="Nhiệm vụ">
                  {results.tasks.map((t) => (
                    <Item key={t.id} title={t.title} sub={t.code} onClick={() => { setSearchOpen(false); openTask(t.id); }} />
                  ))}
                </Group>
              )}
              {results.users.length > 0 && (
                <Group icon={<Users className="h-3.5 w-3.5" />} label="Thành viên">
                  {results.users.map((u) => (
                    <Item key={u.id} title={u.name} sub={u.email} onClick={() => go('/team')} />
                  ))}
                </Group>
              )}
              {results.docs.length > 0 && (
                <Group icon={<FileText className="h-3.5 w-3.5" />} label="Tài liệu">
                  {results.docs.map((x) => (
                    <Item key={x.id} title={x.title} onClick={() => go('/documents')} />
                  ))}
                </Group>
              )}
              {results.projects.length === 0 && results.tasks.length === 0 && results.users.length === 0 && results.docs.length === 0 && (
                <p className={cn('px-4 py-6 text-center text-sm text-muted-foreground')}>Không tìm thấy kết quả cho "{q}".</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
