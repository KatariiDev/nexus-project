import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Dialog, DialogHeader, DialogBody, DialogFooter } from '../../components/ui/dialog';
import { Field, Input, Textarea, Select } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Checkbox } from '../../components/ui/controls';
import { Avatar } from '../../components/ui/avatar';
import { toast } from '../../components/ui/toast';
import { useApp, useCurrentUser } from '../../store/AppContext';
import { canDirectProjectAction } from '../../lib/roles';
import { newId, cn } from '../../lib/utils';
import { addDaysISO, toISODate } from '../../lib/format';
import { PROJECT_STATUSES, PRIORITIES } from '../../types';
import type { Priority, Project, ProjectStatus } from '../../types';

const SWATCHES = ['#4F46E5', '#0284C7', '#16A34A', '#F59E0B', '#EF4444', '#A855F7'];

export interface ProjectFormProps {
  open: boolean;
  onClose: () => void;
  initial?: Project;
}

interface FormState {
  name: string;
  code: string;
  description: string;
  status: ProjectStatus;
  priority: Priority;
  managerId: string;
  memberIds: string[];
  startDate: string;
  endDate: string;
  budget: string;
  color: string;
}

type Errors = Partial<Record<keyof FormState, string>>;

function toInputDate(iso: string): string {
  return iso ? iso.slice(0, 10) : '';
}

export function ProjectForm({ open, onClose, initial }: ProjectFormProps) {
  const { state, dispatch } = useApp();
  const me = useCurrentUser();
  const canDirect = canDirectProjectAction(me.role, me.isSuperAdmin);
  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [memberQuery, setMemberQuery] = useState('');

  // Chỉ Chủ dự án + Admin được đổi trạng thái (khi sửa); khi tạo mới thì chỉ Admin
  // tạo trực tiếp mới chọn trạng thái, Member gửi yêu cầu luôn ở trạng thái "Lập kế hoạch".
  const canChangeStatus = initial ? canDirect || initial.managerId === me.id : canDirect;
  // Member gửi yêu cầu tạo dự án thì Chủ dự án mặc định là chính mình.
  const managerLocked = !initial && !canDirect;

  useEffect(() => {
    if (!open) return;
    const today = toISODate(new Date()).slice(0, 10);
    setForm(
      initial
        ? {
            name: initial.name,
            code: initial.code,
            description: initial.description,
            status: initial.status,
            priority: initial.priority,
            managerId: initial.managerId,
            memberIds: initial.memberIds,
            startDate: toInputDate(initial.startDate),
            endDate: toInputDate(initial.endDate),
            budget: initial.budget != null ? String(initial.budget) : '',
            color: initial.color,
          }
        : {
            name: '',
            code: '',
            description: '',
            status: 'planning',
            priority: 'medium',
            managerId: me.id,
            memberIds: [me.id],
            startDate: today,
            endDate: addDaysISO(new Date(), 30).slice(0, 10),
            budget: '',
            color: SWATCHES[0],
          },
    );
    setErrors({});
  }, [open, initial]);

  if (!open || !form) return null;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => (f ? { ...f, [key]: value } : f));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const toggleMember = (id: string) => {
    setForm((f) =>
      f ? { ...f, memberIds: f.memberIds.includes(id) ? f.memberIds.filter((m) => m !== id) : [...f.memberIds, id] } : f,
    );
  };

  const validate = (): boolean => {
    const e: Errors = {};
    if (!form.name.trim()) e.name = 'Vui lòng nhập tên dự án';
    if (!form.code.trim()) {
      e.code = 'Vui lòng nhập mã dự án';
    } else if (
      state.projects.some((p) => p.code.toLowerCase() === form.code.trim().toLowerCase() && p.id !== initial?.id)
    ) {
      e.code = 'Mã dự án đã tồn tại';
    }
    if (!form.managerId) e.managerId = 'Vui lòng chọn Chủ dự án';
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      e.endDate = 'Ngày kết thúc phải từ ngày bắt đầu trở đi';
    }
    if (form.budget.trim() !== '' && (Number.isNaN(Number(form.budget)) || Number(form.budget) < 0)) {
      e.budget = 'Ngân sách phải là số không âm';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    const project: Project = {
      id: initial?.id ?? newId(),
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      description: form.description.trim(),
      status: form.status,
      priority: form.priority,
      startDate: form.startDate ? `${form.startDate}T00:00:00` : '',
      endDate: form.endDate ? `${form.endDate}T23:59:59` : '',
      managerId: form.managerId,
      memberIds: Array.from(new Set([...form.memberIds, form.managerId])),
      budget: form.budget.trim() === '' ? undefined : Number(form.budget),
      budgetUsed: initial?.budgetUsed,
      color: form.color,
      createdAt: initial?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (initial) {
      dispatch({ type: 'PROJECT_UPDATE', project });
      toast('Đã cập nhật dự án', project.name);
    } else if (canDirect) {
      dispatch({ type: 'PROJECT_ADD', project });
      toast('Đã tạo dự án', `${project.code} · ${project.name}`);
    } else {
      // Member: gửi yêu cầu để Admin phê duyệt.
      dispatch({
        type: 'PROJECT_REQUEST_CREATE',
        request: {
          id: newId(),
          workspaceId: state.workspace.id,
          type: 'create_project',
          payload: {
            code: project.code,
            name: project.name,
            description: project.description,
            priority: project.priority,
            startDate: project.startDate,
            endDate: project.endDate,
            managerId: project.managerId,
            memberIds: project.memberIds,
            budget: project.budget,
            color: project.color,
          },
          status: 'pending',
          requestedBy: state.currentUserId,
          createdAt: new Date().toISOString(),
        },
      });
      toast('Đã gửi yêu cầu tạo dự án', 'Admin sẽ phê duyệt trong trang Quản trị.');
    }
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} wide>
      <DialogHeader
        title={initial ? 'Chỉnh sửa dự án' : canDirect ? 'Tạo dự án mới' : 'Yêu cầu tạo dự án'}
        desc={initial ? `Cập nhật thông tin cho ${initial.code}` : canDirect ? 'Điền thông tin để bắt đầu một dự án mới' : 'Yêu cầu của bạn sẽ được gửi đến Admin để phê duyệt'}
        onClose={onClose}
      />
      <DialogBody className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Tên dự án *" error={errors.name}>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ví dụ: Nền tảng thương mại điện tử" />
          </Field>
          <Field label="Mã dự án *" error={errors.code}>
            <Input value={form.code} onChange={(e) => set('code', e.target.value)} placeholder="Ví dụ: NEX-009" />
          </Field>
        </div>

        <Field label="Mô tả">
          <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Mục tiêu, phạm vi và ghi chú của dự án..." rows={3} />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Trạng thái">
            <Select
              value={form.status}
              onChange={(e) => set('status', e.target.value as ProjectStatus)}
              disabled={!canChangeStatus}
              title={canChangeStatus ? undefined : 'Chỉ Chủ dự án hoặc Admin mới được đổi trạng thái'}
            >
              {PROJECT_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Mức độ ưu tiên">
            <Select value={form.priority} onChange={(e) => set('priority', e.target.value as Priority)}>
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Ngân sách (VNĐ)" error={errors.budget}>
            <Input type="number" min={0} value={form.budget} onChange={(e) => set('budget', e.target.value)} placeholder="Để trống nếu không có" />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Ngày bắt đầu">
            <Input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
          </Field>
          <Field label="Ngày kết thúc" error={errors.endDate}>
            <Input type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} />
          </Field>
        </div>

        <Field label="Chủ dự án (Leader) *" error={errors.managerId}>
          <Select
            value={form.managerId}
            onChange={(e) => set('managerId', e.target.value)}
            disabled={managerLocked}
            title={managerLocked ? 'Bạn là Chủ dự án khi gửi yêu cầu tạo dự án' : undefined}
          >
            <option value="">Chọn Chủ dự án</option>
            {state.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} {u.id === me.id ? '(Bạn)' : ''} · {u.title || 'Thành viên'}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Thành viên">
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              value={memberQuery}
              onChange={(e) => setMemberQuery(e.target.value)}
              placeholder="Tìm thành viên theo tên, email, chức danh..."
            />
          </div>
          <div className="max-h-44 overflow-y-auto rounded-md border border-input p-2">
            {state.users
              .filter((u) => {
                const q = memberQuery.trim().toLowerCase();
                if (!q) return true;
                return `${u.name} ${u.email} ${u.title || ''}`.toLowerCase().includes(q);
              })
              .map((u) => (
                <label key={u.id} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent">
                  <Checkbox checked={form.memberIds.includes(u.id)} onChange={() => toggleMember(u.id)} />
                  <Avatar name={u.name} avatarUrl={u.avatarUrl} size="xs" />
                  <span className="text-sm">
                    <span className="font-medium">{u.name}</span>
                    <span className="text-muted-foreground"> · {u.title || 'Thành viên'}</span>
                  </span>
                </label>
              ))}
            {state.users.filter((u) => {
              const q = memberQuery.trim().toLowerCase();
              return q && `${u.name} ${u.email} ${u.title || ''}`.toLowerCase().includes(q);
            }).length === 0 && memberQuery.trim() !== '' && (
              <p className="px-2 py-3 text-sm text-muted-foreground">Không tìm thấy thành viên nào.</p>
            )}
          </div>
        </Field>

        <Field label="Màu đại diện">
          <div className="flex items-center gap-2.5">
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Chọn màu ${c}`}
                onClick={() => set('color', c)}
                className={cn(
                  'h-9 w-9 rounded-full transition-transform hover:scale-110',
                  form.color === c && 'ring-2 ring-ring ring-offset-2 ring-offset-card',
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </Field>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Hủy
        </Button>
        <Button onClick={handleSubmit}>{initial ? 'Lưu thay đổi' : 'Tạo dự án'}</Button>
      </DialogFooter>
    </Dialog>
  );
}
