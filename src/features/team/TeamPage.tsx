import { useMemo, useState } from 'react';
import { Briefcase, ListTodo, Mail, UserPlus, Users, ShieldCheck } from 'lucide-react';
import { useApp, useCurrentUser } from '../../store/AppContext';
import { useUI } from '../../components/layout/UIContext';
import { EmptyState, PageHeader } from '../../components/ui/feedback';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Avatar } from '../../components/ui/avatar';
import { Select } from '../../components/ui/input';
import { Switch } from '../../components/ui/controls';
import { Progress } from '../../components/ui/progress';
import { Card, CardContent } from '../../components/ui/card';
import { toast } from '../../components/ui/toast';
import { WORKSPACE_ROLES, roleLabel } from '../../types';
import type { User, WorkspaceRole } from '../../types';
import { assignableRoles, canManageMembers } from '../../lib/roles';
import { getSupabase } from '../../lib/supabase';
import { setSuperAdmin } from '../../lib/db';
import { cn } from '../../lib/utils';

type RoleTone = 'purple' | 'primary' | 'info' | 'muted';

const roleTone: Record<WorkspaceRole, RoleTone> = {
  admin: 'primary',
  leader: 'info',
  member: 'muted',
};

function RoleBadge({ role }: { role: WorkspaceRole }) {
  return <Badge tone={roleTone[role]}>{roleLabel(role)}</Badge>;
}

export function TeamPage() {
  const { state, dispatch, refresh } = useApp();
  const { setQuickCreateTab, setQuickCreateOpen } = useUI();
  const me = useCurrentUser();

  const stats = useMemo(() => {
    const map = new Map<string, { projects: number; activeTasks: number }>();
    for (const u of state.users) {
      const projects = state.projects.filter((p) => p.memberIds.includes(u.id) || p.managerId === u.id).length;
      const activeTasks = state.tasks.filter((t) => t.assigneeIds.includes(u.id) && t.status !== 'done').length;
      map.set(u.id, { projects, activeTasks });
    }
    return map;
  }, [state.users, state.projects, state.tasks]);

  const handleRoleChange = (user: User, role: WorkspaceRole) => {
    dispatch({ type: 'USER_UPDATE_ROLE', id: user.id, role });
    toast('Đã cập nhật vai trò', `${user.name} → ${roleLabel(role)}`);
  };

  const [superBusy, setSuperBusy] = useState<string | null>(null);
  /** Cấp/gỡ quyền Admin tổng — chỉ Admin tổng mới thấy và thao tác được. */
  const handleSuperAdminToggle = async (user: User, makeAdmin: boolean) => {
    setSuperBusy(user.id);
    try {
      await setSuperAdmin(getSupabase(), user.id, makeAdmin);
      await refresh();
      toast(
        makeAdmin ? 'Đã cấp quyền Admin tổng' : 'Đã gỡ quyền Admin tổng',
        user.name,
      );
    } catch (e) {
      toast('Không thể phân quyền', e instanceof Error ? e.message : 'Đã xảy ra lỗi.', 'error');
    } finally {
      setSuperBusy(null);
    }
  };

  const inviteMember = () => {
    setQuickCreateTab('member');
    setQuickCreateOpen(true);
  };
  const canInvite = canManageMembers(me.role);
  const allowedRoles = assignableRoles(me.role);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Nhóm & Nhân sự"
        desc={`${state.users.length} thành viên trong workspace`}
        actions={
          canInvite ? (
            <Button onClick={inviteMember}>
              <UserPlus className="h-4 w-4" />
              Mời thành viên
            </Button>
          ) : undefined
        }
      />

      {state.users.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="Chưa có thành viên"
          desc="Mời thành viên đầu tiên vào workspace để bắt đầu cộng tác."
          action={
            canInvite ? (
              <Button onClick={inviteMember}>
                <UserPlus className="h-4 w-4" /> Mời thành viên
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {state.users.map((u) => {
            const s = stats.get(u.id) ?? { projects: 0, activeTasks: 0 };
            const isSelf = u.id === me.id;
            return (
              <Card key={u.id} className="transition-shadow hover:shadow-lift">
                <CardContent className="flex flex-col gap-4 p-5">
                  <div className="flex items-start gap-3">
                    <Avatar name={u.name} avatarUrl={u.avatarUrl} size="lg" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        {u.name}
                        {isSelf && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(bạn)</span>}
                      </p>
                      <p className="truncate text-xs font-mono text-muted-foreground">
                        {(() => {
                          const un = isSelf ? me.username || u.username : u.username;
                          if (!un) return u.title || 'Thành viên';
                          return un.startsWith('@') ? un : `@${un}`;
                        })()}
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                        <Mail className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{u.email}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <RoleBadge role={u.role} />
                    {u.isSuperAdmin && (
                      <Badge tone="primary">
                        <ShieldCheck className="mr-1 h-3 w-3" /> Admin tổng
                      </Badge>
                    )}
                    {u.status === 'invited' && <Badge tone="warning">Đã mời</Badge>}
                  </div>

                  <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/50 p-3">
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-semibold leading-none">{s.projects}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Dự án</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <ListTodo className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-semibold leading-none">{s.activeTasks}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Nhiệm vụ đang làm</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Khối lượng công việc</span>
                      <span className="font-semibold">{u.workload ?? 0}%</span>
                    </div>
                    <Progress value={u.workload ?? 0} />
                  </div>

                  {me.isSuperAdmin ? (
                    <div className="flex items-center gap-2 border-t pt-3">
                      <ShieldCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1 text-xs text-muted-foreground">Quyền Admin tổng</span>
                      <Switch
                        checked={Boolean(u.isSuperAdmin)}
                        onChange={(v) => handleSuperAdminToggle(u, v)}
                        className={cn(
                          superBusy === u.id || isSelf ? 'pointer-events-none opacity-50' : undefined,
                        )}
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 border-t pt-3">
                      <span className="text-xs text-muted-foreground">Vai trò:</span>
                      <Select
                        value={u.role}
                        disabled={isSelf || !canInvite}
                        title={isSelf ? 'Bạn không thể tự thay đổi vai trò của chính mình' : canInvite ? 'Đổi vai trò' : 'Chỉ Admin mới được đổi vai trò'}
                        onChange={(e) => handleRoleChange(u, e.target.value as WorkspaceRole)}
                        className="h-8 text-xs"
                        aria-label={`Vai trò của ${u.name}`}
                      >
                        {WORKSPACE_ROLES.filter((r) => allowedRoles.includes(r.value) || r.value === u.role).map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
