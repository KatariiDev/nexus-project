import { useEffect, useMemo, useState } from 'react';
import { Search, UserPlus } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { Button } from '../../components/ui/button';
import { Field, Input } from '../../components/ui/input';
import { Avatar } from '../../components/ui/avatar';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '../../components/ui/dialog';
import { toast } from '../../components/ui/toast';
import { formatCountdown } from '../../lib/format';
import type { Project } from '../../types';
import { useNow } from '../../lib/hooks';

/** Mời thành viên vào dự án: gửi lời mời, người được mời chấp nhận mới vào. */
export function InviteMembersDialog({ project, open, onClose }: { project: Project; open: boolean; onClose: () => void }) {
  const { state, dispatch } = useApp();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const now = useNow();

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected([]);
    }
  }, [open ]);

  // Lời mời đang chờ xử lý của dự án này.
  const pendingInvites = useMemo(
    () => state.projectRequests.filter((r) => r.type === 'invite_member' && r.projectId === project.id && r.status === 'pending'),
    [state.projectRequests, project.id],
  );
  const pendingInviteeIds = useMemo(() => new Set(pendingInvites.map((r) => r.payload.invitee_id)), [pendingInvites]);

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.users.filter((u) => {
      if (project.memberIds.includes(u.id) || u.id === project.managerId) return false;
      if (pendingInviteeIds.has(u.id)) return false;
      if (!q) return true;
      return `${u.name} ${u.email} ${u.title || ''}`.toLowerCase().includes(q);
    });
  }, [state.users, project, query, pendingInviteeIds]);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const sendInvites = () => {
    if (selected.length === 0) return;
    setBusy(true);
    void dispatch({ type: 'PROJECT_INVITE_MEMBER', projectId: project.id, inviteeIds: selected }).then((ok) => {
      setBusy(false);
      if (!ok) return;
      toast('Đã gửi lời mời', `${selected.length} người sẽ nhận thông báo mời vào dự án "${project.name}".`);
      setSelected([]);
      onClose();
    });
  };

  const cancelInvite = (id: string) => {
    setBusy(true);
    void dispatch({ type: 'PROJECT_INVITE_CANCEL', id }).then((ok) => {
      setBusy(false);
      if (ok) toast('Đã hủy lời mời', 'Lời mời đã được hủy.');
    });
  };

  return (
    <Dialog open={open} onClose={onClose} wide>
      <DialogHeader title="Mời thành viên" desc={`Người được mời sẽ nhận thông báo và chấp nhận mới vào dự án "${project.name}".`} onClose={onClose} />
      <DialogBody className="flex flex-col gap-4">
        <Field label="Tìm thành viên trong workspace">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm theo tên, email, chức danh..."
            />
          </div>
        </Field>
        <div className="max-h-56 overflow-y-auto rounded-md border border-input p-2">
          {candidates.length === 0 && (
            <p className="px-2 py-3 text-sm text-muted-foreground">
              {query ? 'Không tìm thấy thành viên nào.' : 'Mọi thành viên trong workspace đều đã ở trong dự án.'}
            </p>
          )}
          {candidates.map((u) => (
            <label key={u.id} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent">
              <input
                type="checkbox"
                checked={selected.includes(u.id)}
                onChange={() => toggle(u.id)}
                className="h-4 w-4 accent-primary"
              />
              <Avatar name={u.name} avatarUrl={u.avatarUrl} size="xs" />
              <span className="text-sm">
                <span className="font-medium">{u.name}</span>
                <span className="text-muted-foreground"> · {u.email}</span>
              </span>
            </label>
          ))}
        </div>
        {pendingInvites.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium">Đang chờ chấp nhận ({pendingInvites.length})</p>
            <div className="flex flex-col gap-1.5">
              {pendingInvites.map((r) => {
                const invitee = state.users.find((u) => u.id === r.payload.invitee_id);
                const inviter = state.users.find((u) => u.id === r.requestedBy);
                return (
                  <div key={r.id} className="flex items-center gap-3 rounded-md border border-border px-2.5 py-2">
                    <Avatar name={invitee?.name ?? 'Thành viên'} avatarUrl={invitee?.avatarUrl} size="xs" />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      <span className="font-medium">{invitee?.name ?? 'Thành viên'}</span>
                      <span className="text-muted-foreground">
                        {' '}· {inviter?.name ?? '—'} mời · {r.payload.expires_at ? formatCountdown(r.payload.expires_at, now) : '—'}
                      </span>
                    </span>
                    <Button variant="ghost" size="sm" disabled={busy} onClick={() => cancelInvite(r.id)}>
                      Hủy
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Hủy
        </Button>
        <Button disabled={selected.length === 0 || busy} onClick={sendInvites}>
          <UserPlus className="h-4 w-4" />
          Gửi lời mời{selected.length > 0 ? ` (${selected.length})` : ''}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
