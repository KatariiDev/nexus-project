import type { ReactNode } from 'react';
import type { User } from '../../types';
import { Avatar } from '../../components/ui/avatar';
import { Checkbox } from '../../components/ui/controls';

export function Section({ icon, title, action, children }: { icon: ReactNode; title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-b p-4 last:border-0">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span className="text-muted-foreground">{icon}</span>
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

export function UserMultiSelect({ users, selected, onToggle }: { users: User[]; selected: string[]; onToggle: (id: string) => void }) {
  return (
    <div className="flex max-h-44 flex-col gap-0.5 overflow-y-auto">
      {users.map((u) => (
        <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent">
          <Checkbox checked={selected.includes(u.id)} onChange={() => onToggle(u.id)} />
          <Avatar name={u.name} avatarUrl={u.avatarUrl} size="xs" />
          <span className="text-sm">{u.name}</span>
          <span className="truncate text-xs text-muted-foreground">{u.title || 'Thành viên'}</span>
        </label>
      ))}
    </div>
  );
}
