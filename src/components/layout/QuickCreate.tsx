import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, useCurrentUser } from '../../store/AppContext';
import { useUI } from './UIContext';
import { Dialog, DialogHeader, DialogBody, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input, Textarea, Select, Field } from '../ui/input';
import { Tabs } from '../ui/tabs';
import { toast } from '../ui/toast';
import { genId } from '../../lib/utils';
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
  const f = useForm({ name: '', code: '', description: '', status: 'planning' as string, priority: 'medium' as string, managerId: state.currentUserId, startDate: '', endDate: '' });

  const submit = () => {
    const errs: Record<string, string> = {};
    if (!f.values.name.trim()) errs.name = 'Vui lòng nhập tên dự án';
    if (!f.values.code.trim()) errs.code = 'Vui lòng nhập mã dự án';
    if (Object.keys(errs).length) { f.setErrors(errs); return; }
    dispatch({
      type: 'PROJECT_ADD',
      project: {
        id: genId('p'), code: f.values.code.trim().toUpperCase(), name: f.values.name.trim(),
        description: f.values.description.trim(), status: f.values.status as ProjectStatus,
        priority: f.values.priority as Priority, startDate: f.values.startDate || toISODate(new Date()),
        endDate: f.values.endDate || toISODate(new Date()),
        managerId: f.values.managerId, memberIds: [f.values.managerId],
        color: '#4F46E5', createdAt: toISODate(new Date()), updatedAt: toISODate(new Date()),
      },
    });
    toast('Tạo dự án thành công', f.values.name.trim());
    f.reset(); onDone();
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
      <DialogFooter><Button variant="outline" onClick={onDone}>Hủy</Button><Button onClick={submit}>Tạo dự án</Button></DialogFooter>
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
    const count = state.tasks.filter((t) => t.projectId === project.id).length + 1;
    dispatch({
      type: 'TASK_ADD',
      task: {
        id: genId('t'), code: `${project.code}-${String(count).padStart(2, '0')}`,
        title: f.values.title.trim(), description: '', projectId: project.id,
        status: f.values.status as TaskStatus, priority: f.values.priority as Priority,
        assigneeIds: [f.values.assigneeId], creatorId: me.id, watcherIds: [],
        dueDate: f.values.dueDate ? new Date(f.values.dueDate).toISOString() : undefined,
        labelIds: [], createdAt: toISODate(new Date()), updatedAt: toISODate(new Date()),
      },
    });
    toast('Tạo nhiệm vụ thành công', f.values.title.trim());
    f.reset(); onDone();
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
  const f = useForm({ name: '', email: '', role: 'member' as string });

  const submit = () => {
    const errs: Record<string, string> = {};
    if (!f.values.name.trim()) errs.name = 'Vui lòng nhập họ tên';
    if (!/^\S+@\S+\.\S+$/.test(f.values.email)) errs.email = 'Email không hợp lệ';
    if (Object.keys(errs).length) { f.setErrors(errs); return; }
    dispatch({ type: 'USER_ADD', name: f.values.name.trim(), email: f.values.email.trim(), role: f.values.role as WorkspaceRole });
    toast('Đã gửi lời mời', `Lời mời đã được gửi đến ${f.values.email.trim()}`);
    f.reset(); onDone();
  };

  return (
    <div className="flex flex-col gap-4">
      <Field label="Họ tên" error={f.errors.name}><Input value={f.values.name} onChange={(e) => f.set('name', e.target.value)} placeholder="VD: Nguyễn Văn A" /></Field>
      <Field label="Email" error={f.errors.email}><Input value={f.values.email} onChange={(e) => f.set('email', e.target.value)} placeholder="email@congty.vn" /></Field>
      <Field label="Vai trò"><Select value={f.values.role} onChange={(e) => f.set('role', e.target.value)}>{WORKSPACE_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>)}</Select></Field>
      <DialogFooter><Button variant="outline" onClick={onDone}>Hủy</Button><Button onClick={submit}>Gửi lời mời</Button></DialogFooter>
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
    f.reset(); onDone(); navigate('/documents');
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
  const close = () => setQuickCreateOpen(false);

  return (
    <Dialog open={quickCreateOpen} onClose={close} wide>
      <DialogHeader title="Tạo mới nhanh" desc="Tạo dự án, nhiệm vụ, mời thành viên hoặc tài liệu mới." onClose={close} />
      <DialogBody>
        <Tabs
          value={quickCreateTab}
          onChange={setQuickCreateTab}
          tabs={[
            { value: 'task', label: 'Nhiệm vụ' },
            { value: 'project', label: 'Dự án' },
            { value: 'member', label: 'Thành viên' },
            { value: 'document', label: 'Tài liệu' },
          ]}
          className="mb-5"
        />
        {quickCreateTab === 'task' && <TaskQuickForm onDone={close} />}
        {quickCreateTab === 'project' && <ProjectQuickForm onDone={close} />}
        {quickCreateTab === 'member' && <MemberQuickForm onDone={close} />}
        {quickCreateTab === 'document' && <DocQuickForm onDone={close} />}
      </DialogBody>
    </Dialog>
  );
}
