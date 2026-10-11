import { useEffect, useState } from 'react';
import { Dialog, DialogHeader, DialogBody, DialogFooter } from '../../components/ui/dialog';
import { Field, Input, Textarea, Select } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Checkbox } from '../../components/ui/controls';
import { Avatar } from '../../components/ui/avatar';
import { toast } from '../../components/ui/toast';
import { useApp } from '../../store/AppContext';
import { genId, cn } from '../../lib/utils';
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
  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<Errors>({});

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
            managerId: '',
            memberIds: [],
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
    if (!form.managerId) e.managerId = 'Vui lòng chọn người quản lý';
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
      id: initial?.id ?? genId('p'),
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
    } else {
      dispatch({ type: 'PROJECT_ADD', project });
      toast('Đã tạo dự án', `${project.code} · ${project.name}`);
    }
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} wide>
      <DialogHeader
        title={initial ? 'Chỉnh sửa dự án' : 'Tạo dự án mới'}
        desc={initial ? `Cập nhật thông tin cho ${initial.code}` : 'Điền thông tin để bắt đầu một dự án mới'}
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
            <Select value={form.status} onChange={(e) => set('status', e.target.value as ProjectStatus)}>
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

        <Field label="Người quản lý *" error={errors.managerId}>
          <Select value={form.managerId} onChange={(e) => set('managerId', e.target.value)}>
            <option value="">Chọn người quản lý</option>
            {state.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} · {u.title}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Thành viên">
          <div className="max-h-44 overflow-y-auto rounded-md border border-input p-2">
            {state.users.map((u) => (
              <label key={u.id} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent">
                <Checkbox checked={form.memberIds.includes(u.id)} onChange={() => toggleMember(u.id)} />
                <Avatar name={u.name} size="xs" />
                <span className="text-sm">
                  <span className="font-medium">{u.name}</span>
                  <span className="text-muted-foreground"> · {u.title}</span>
                </span>
              </label>
            ))}
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
