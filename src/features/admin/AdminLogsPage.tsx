import { useMemo, useState } from 'react';
import { useApp } from '../../store/AppContext';
import { PageHeader } from '../../components/ui/feedback';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Avatar } from '../../components/ui/avatar';
import { timeAgo } from '../../lib/format';
import { MAX_ACTIVITY_LOGS } from '../../types';
import { userName } from './adminHelpers';

export function AdminLogsPage() {
  const { state } = useApp();
  const [q, setQ] = useState('');
  const logs = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return state.activityLogs.filter((l) => {
      if (!kw) return true;
      const actor = userName(state, l.actorId).toLowerCase();
      return (
        l.action.toLowerCase().includes(kw) ||
        (l.entityName ?? '').toLowerCase().includes(kw) ||
        actor.includes(kw)
      );
    }).slice(0, MAX_ACTIVITY_LOGS);
  }, [state.activityLogs, state.users, q]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Nhật ký hoạt động" desc={`Toàn bộ thao tác trong workspace (${MAX_ACTIVITY_LOGS} bản ghi gần nhất)`} />
      <div className="max-w-sm">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo người, hành động, tên..." />
      </div>
      <Card>
        <CardContent className="p-0">
          <ul className="divide-y">
            {logs.map((l) => (
              <li key={l.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                <Avatar
                  name={userName(state, l.actorId)}
                  avatarUrl={state.users.find((u) => u.id === l.actorId)?.avatarUrl}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate">
                    <b>{userName(state, l.actorId)}</b> {l.action}{' '}
                    <span className="text-muted-foreground">({l.entityType})</span>{' '}
                    <b className="truncate">{l.entityName}</b>
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(l.createdAt)}</span>
              </li>
            ))}
            {logs.length === 0 && (
              <li className="px-5 py-8 text-center text-sm text-muted-foreground">Không có bản ghi nào.</li>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
