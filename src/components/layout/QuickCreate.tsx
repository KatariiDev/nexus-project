import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, useCurrentUser } from '../../store/AppContext';
import { assignableRoles, canDirectProjectAction, canManageMembers, canRequestProjects } from '../../lib/roles';
import { useUI } from './UIContext';
import { Dialog, DialogHeader, DialogBody, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input, Textarea, Select, Field } from '../ui/input';
import { Checkbox } from '../ui/controls';
import { Avatar } from '../ui/avatar';
import { Tabs } from '../ui/tabs';
import { toast } from '../ui/toast';
import { newId } from '../../lib/utils';
import { nextTaskCode } from '../../features/tasks/helpers';
import { toISODate } from '../../lib/format';
import { PRIORITIES, PROJECT_STATUSES, TASK_STATUSES, WORKSPACE_ROLES, type Priority, type ProjectStatus, type TaskStatus, type WorkspaceRole } from '../../types';

function useForm<T extends Record<string, string>>(initial: T) {
  const [values, setValues] = useState<T>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const set = (k: keyof T, v: string) => {
    setValues((s) => ({ ...s, [k]: v }));
    setErrors((s) => ({ ...s, [k]: undefined }));
  };
  const reset = () => { setValues(initial); setErrors({}); };
  return { values, errors, set, reset, setErrors };
}

function ProjectQuickForm({ onDone }: { onDone: () => void }) {
  const { state, dispatch } = useApp();
  const me = useCurrentUser();
  const canDirect = canDirectProjectAction(me.role);
  const f = useForm({ name: '', code: '', description: '', status: 'planning' as string, priority: 'medium' as string, managerId: state.currentUserId, startDate: '', endDate: '' });
  // Thành viên được chọn (mặc định có chính mình; bỏ tick để gỡ, tick để thêm).
  const [memberIds, setMemberIds] = useState<string[]>([state.currentUserId]);
  const toggleMember = (id: string) =>
    setMemberIds((s) => (s.includes(id) ? s.filter((m) => m !== id) : [...s, id]));

  const submit = () => {
    const errs: Record<string, string> = {};
    if (!f.values.name.trim()) errs.name = 'Vui lòng nhập tên dự án';
    if (!f.values.code.trim()) errs.code = 'Vui lòng nhập mã dự án';
    if (Object.keys(errs).length) { f.setErrors(errs); return; }
    const payload = {
      code: f.values.code.trim().toUpperCase(),
      name: f.values.name.trim(),
      description: f.values.description.trim(),
      priority: f.values.priority as Priority,
      startDate: f.values.startDate || toISODate(new Date()),
      endDate: f.values.endDate || toISODate(new Date()),
      managerId: f.values.managerId,
      // Người quản lý luôn là thành viên; các thành viên khác do người dùng tick chọn.
      memberIds: Array.from(new Set([...memberIds, f.values.managerId])),
      color: '#4F46E5',
    };
    if (canDirect) {
      dispatch({
        type: 'PROJECT_ADD',
        project: {
          id: newId(), status: f.values.status as ProjectStatus,
          createdAt: toISODate(new Date()), updatedAt: toISODate(new Date()),
          ...payload,
        },
      });
      toast('Tạo dự án thành công', f.values.name.trim());
    } else {
      // Owner: gửi yêu cầu để Admin phê duyệt.
      dispatch({
        type: 'PROJECT_REQUEST_CREATE',
        request: {
          id: newId(),
          workspaceId: state.workspace.id,
          type: 'create_project',
          payload,
          status: 'pending',
          requestedBy: state.currentUserId,
          createdAt: new Date().toISOString(),
        },
      });
      toast('Đã gửi yêu cầu tạo dự án', 'Admin sẽ phê duyệt trong trang Quản trị.');
    }
    f.reset(); setMemberIds([state.currentUserId]); onDone();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Tên dự án" error={f.errors.name}><Input value={f.values.name} onChange={(e) => f.set('name', e.target.value)} placeholder="VD: Nền tảng CRM" /></Field>
        <Field label="Mã dự án" error={f.errors.code}><Input value={f.values.code} onChange={(e) => f.set('code', e.target.value)} placeholder="VD: NEX-006" /></Field>
      </div>
      <Field label="Mô tả"><Textarea value={f.values.description} onChange={(e) => f.set('description', e.target.value)} placeholder="Mô tả ngắn về dự án..." /></Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Trạng thái"><Select value={f.values.status} onChange={(e) => f.set('status', e.target.value)}>{PROJECT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</Select></Field>
        <Field label="Ưu tiên"><Select value={f.values.priority} onChange={(e) => f.set('priority', e.target.value)}>{PRIORITIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</Select></Field>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Field label="Quản lý"><Select value={f.values.managerId} onChange={(e) => f.set('managerId', e.target.value)}>{state.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></Field>
        <Field label="Bắt đầu"><Input type="date" value={f.values.startDate} onChange={(e) => f.set('startDate', e.target.value)} /></Field>
        <Field label="Kết thúc"><Input type="date" value={f.values.endDate} onChange={(e) => f.set('endDate', e.target.value)} /></Field>
      </div>
      <Field label="Thành viên">
        <div className="max-h-36 overflow-y-auto rounded-md border border-input p-2">
          {state.users.map((u) => (
            <label key={u.id} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent">
              <Checkbox checked={memberIds.includes(u.id)} onChange={() => toggleMember(u.id)} />
              <Avatar name={u.name} size="xs" />
              <span className="text-sm">
                <span className="font-medium">{u.name}</span>
                {u.id === state.currentUserId && <span className="text-muted-foreground"> (bạn)</span>}
              </span>
            </label>
          ))}
        </div>
      </Field>
      <DialogFooter><Button variant="outline" onClick={onDone}>Hủy</Button><Button onClick={submit}>{canDirect ? 'Tạo dự án' : 'Gửi yêu cầu'}</Button></DialogFooter>
    </div>
  );
}

function TaskQuickForm({ onDone }: { onDone: () => void }) {
  const { state, dispatch } = useApp();
  const me = useCurrentUser();
  const f = useForm({ title: '', projectId: state.projects[0]?.id ?? '', assigneeId: me.id, status: 'todo' as string, priority: 'medium' as string, dueDate: '' });

  const submit = () => {
    if (!f.values.title.trim()) { f.setErrors({ title: 'Vui lòng nhập tiêu đề nhiệm vụ' }); return; }
    const project = state.projects.find((p) => p.id === f.values.projectId);
    if (!project) return;
    const projectTasks = state.tasks.filter((t) => t.projectId === project.id);
    const code = nextTaskCode(project.code, projectTasks);
    void dispatch({
      type: 'TASK_ADD',
      task: {
        id: newId(), code,
        title: f.values.title.trim(), description: '', projectId: project.id,
        status: f.values.status as TaskStatus, priority: f.values.priority as Priority,
        assigneeIds: [f.values.assigneeId], creatorId: me.id, watcherIds: [],
        dueDate: f.values.dueDate ? new Date(f.values.dueDate).toISOString() : undefined,
        labelIds: [], createdAt: toISODate(new Date()), updatedAt: toISODate(new Date()),
      },
    }).then(() => {
      toast('Tạo nhiệm vụ thành công', f.values.title.trim());
      f.reset(); onDone();
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <Field label="Tiêu đề nhiệm vụ" error={f.errors.title}><Input value={f.values.title} onChange={(e) => f.set('title', e.target.value)} placeholder="VD: Thiết kế màn hình đăng nhập" /></Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Dự án"><Select value={f.values.projectId} onChange={(e) => f.set('projectId', e.target.value)}>{state.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
        <Field label="Người thực hiện"><Select value={f.values.assigneeId} onChange={(e) => f.set('assigneeId', e.target.value)}>{state.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></Field>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Field label="Trạng thái"><Select value={f.values.status} onChange={(e) => f.set('status', e.target.value)}>{TASK_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</Select></Field>
        <Field label="Ưu tiên"><Select value={f.values.priority} onChange={(e) => f.set('priority', e.target.value)}>{PRIORITIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</Select></Field>
        <Field label="Hạn hoàn thành"><Input type="date" value={f.values.dueDate} onChange={(e) => f.set('dueDate', e.target.value)} /></Field>
      </div>
      <DialogFooter><Button variant="outline" onClick={onDone}>Hủy</Button><Button onClick={submit}>Tạo nhiệm vụ</Button></DialogFooter>
    </div>
  );
}

function MemberQuickForm({ onDone }: { onDone: () => void }) {
  const { dispatch } = useApp();
  const me = useCurrentUser();
  const allowed = assignableRoles(me.role);
  const f = useForm({ email: '', role: allowed[0] ?? 'member' });

  const submit = () => {
    const errs: Record<string, string> = {};
    if (!/^\S+@\S+\.\S+$/.test(f.values.email)) errs.email = 'Email không hợp lệ';
    if (!allowed.includes(f.values.role as WorkspaceRole)) errs.role = 'Bạn không được phép gán vai trò này';
    if (Object.keys(errs).length) { f.setErrors(errs); return; }
    void dispatch({ type: 'USER_ADD', email: f.values.email.trim(), role: f.values.role as WorkspaceRole })
      .then(() => {
        toast('Đã thêm thành viên', f.values.email.trim());
        f.reset(); onDone();
      });
  };

  const roleMeta = (v: string) => WORKSPACE_ROLES.find((r) => r.value === v);

  return (
    <div className="flex flex-col gap-4">
      <Field label="Email" error={f.errors.email}><Input value={f.values.email} onChange={(e) => f.set('email', e.target.value)} placeholder="email@congty.vn" /></Field>
      <p className="-mt-2 text-xs text-muted-foreground">Người này phải đã đăng ký tài khoản Nexus trước.</p>
      <Field label="Vai trò" error={f.errors.role}>
        <Select value={f.values.role} onChange={(e) => f.set('role', e.target.value)}>
          {allowed.map((v) => {
            const m = roleMeta(v);
            return <option key={v} value={v}>{m?.label} — {m?.desc}</option>;
          })}
        </Select>
      </Field>
      <DialogFooter><Button variant="outline" onClick={onDone}>Hủy</Button><Button onClick={submit}>Thêm thành viên</Button></DialogFooter>
    </div>
  );
}

function DocQuickForm({ onDone }: { onDone: () => void }) {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const f = useForm({ title: '', content: '', projectId: '' });

  const submit = () => {
    if (!f.values.title.trim()) { f.setErrors({ title: 'Vui lòng nhập tiêu đề tài liệu' }); return; }
    dispatch({ type: 'DOC_ADD', title: f.values.title.trim(), content: f.values.content.trim(), projectId: f.values.projectId || undefined });
    toast('Tạo tài liệu thành công', f.values.title.trim());
    f.reset(); onDone(); navigate('/user/documents');
  };

  return (
    <div className="flex flex-col gap-4">
      <Field label="Tiêu đề" error={f.errors.title}><Input value={f.values.title} onChange={(e) => f.set('title', e.target.value)} placeholder="VD: Kế hoạch sprint 12" /></Field>
      <Field label="Dự án liên quan (tùy chọn)"><Select value={f.values.projectId} onChange={(e) => f.set('projectId', e.target.value)}><option value="">Không liên kết dự án</option>{state.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
      <Field label="Nội dung"><Textarea rows={5} value={f.values.content} onChange={(e) => f.set('content', e.target.value)} placeholder="Nội dung tài liệu..." /></Field>
      <DialogFooter><Button variant="outline" onClick={onDone}>Hủy</Button><Button onClick={submit}>Tạo tài liệu</Button></DialogFooter>
    </div>
  );
}

export function QuickCreate() {
  const { quickCreateOpen, setQuickCreateOpen, quickCreateTab, setQuickCreateTab } = useUI();
  const me = useCurrentUser();
  const close = () => setQuickCreateOpen(false);
  const showProject = canRequestProjects(me.role);
  const showMember = canManageMembers(me.role);

  return (
    <Dialog open={quickCreateOpen} onClose={close} wide>
      <DialogHeader title="Tạo mới nhanh" desc="Tạo dự án, nhiệm vụ, mời thành viên hoặc tài liệu mới." onClose={close} />
      <DialogBody>
        <Tabs
          value={quickCreateTab}
          onChange={setQuickCreateTab}
          tabs={[
            { value: 'task', label: 'Nhiệm vụ' },
            ...(showProject ? [{ value: 'project', label: 'Dự án' }] : []),
            ...(showMember ? [{ value: 'member', label: 'Thành viên' }] : []),
            { value: 'document', label: 'Tài liệu' },
          ]}
          className="mb-5"
        />
        {quickCreateTab === 'task' && <TaskQuickForm onDone={close} />}
        {quickCreateTab === 'project' && showProject && <ProjectQuickForm onDone={close} />}
        {quickCreateTab === 'member' && showMember && <MemberQuickForm onDone={close} />}
        {quickCreateTab === 'document' && <DocQuickForm onDone={close} />}
      </DialogBody>
    </Dialog>
  );
}
