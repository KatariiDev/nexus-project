import { useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { projectById, useApp, useCurrentUser } from '../../store/AppContext';
import type { Task } from '../../types';
import { PRIORITIES, TASK_STATUSES } from '../../types';
import { Button } from '../../components/ui/button';
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '../../components/ui/dialog';
import { Field, Input, Select, Textarea } from '../../components/ui/input';
import { Checkbox } from '../../components/ui/controls';
import { Avatar } from '../../components/ui/avatar';
import { toast } from '../../components/ui/toast';
import { newId } from '../../lib/utils';
import { visibleProjects } from '../../lib/roles';
import { dateInputToISO, isoToDateInput, nextTaskCode } from './helpers';

const formSchema = z.object({
  title: z.string().min(3, 'Tiêu đề phải có ít nhất 3 ký tự'),
  description: z.string().default(''),
  projectId: z.string().min(1, 'Vui lòng chọn dự án'),
  assigneeIds: z.array(z.string()).default([]),
  status: z.enum(['todo', 'in_progress', 'in_review', 'done']).default('todo'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  startDate: z.string().default(''),
  dueDate: z.string().default(''),
  labelIds: z.array(z.string()).default([]),
  estimateHours: z
    .string()
    .default('')
    .refine((v) => v === '' || (!Number.isNaN(Number(v)) && Number(v) >= 0), 'Giờ ước tính phải là số lớn hơn hoặc bằng 0'),
});

type FormValues = z.input<typeof formSchema>;

export function TaskForm({ open, onClose, initial, defaultProjectId }: {
  open: boolean;
  onClose: () => void;
  initial?: Task;
  defaultProjectId?: string;
}) {
  const { state, dispatch } = useApp();
  const me = useCurrentUser();

  // Chỉ chọn dự án mình đã tham gia (Admin thấy tất cả).
  const visibleProjectsList = useMemo(() => visibleProjects(state.projects, me), [state.projects, me]);

  const getDefaults = (): FormValues => ({
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    projectId: initial?.projectId ?? defaultProjectId ?? visibleProjectsList[0]?.id ?? '',
    assigneeIds: initial?.assigneeIds ?? [],
    status: initial?.status ?? 'todo',
    priority: initial?.priority ?? 'medium',
    startDate: isoToDateInput(initial?.startDate),
    dueDate: isoToDateInput(initial?.dueDate),
    labelIds: initial?.labelIds ?? [],
    estimateHours: initial?.estimateHours !== undefined ? String(initial.estimateHours) : '',
  });

  const { register, control, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: getDefaults(),
  });

  useEffect(() => {
    if (open) reset(getDefaults());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onSubmit = (data: FormValues) => {
    const project = projectById(state.projects, data.projectId);
    if (!project) {
      toast('Không tìm thấy dự án', 'Vui lòng chọn lại dự án', 'error');
      return;
    }
    const now = new Date().toISOString();
    const title = data.title.trim();
    const description = data.description ?? '';
    const assigneeIds = data.assigneeIds ?? [];
    const status = data.status ?? 'todo';
    const priority = data.priority ?? 'medium';
    const labelIds = data.labelIds ?? [];
    const estimateHours = !data.estimateHours ? undefined : Number(data.estimateHours);
    if (initial) {
      dispatch({
        type: 'TASK_UPDATE',
        task: {
          ...initial,
          title,
          description,
          projectId: data.projectId,
          assigneeIds,
          status,
          priority,
          startDate: dateInputToISO(data.startDate ?? ''),
          dueDate: dateInputToISO(data.dueDate ?? ''),
          labelIds,
          estimateHours,
        },
      });
      toast('Đã cập nhật nhiệm vụ', title);
    } else {
      const task: Task = {
        id: newId(),
        code: nextTaskCode(project.code, state.tasks),
        title,
        description,
        projectId: data.projectId,
        status,
        priority,
        assigneeIds,
        creatorId: me.id,
        watcherIds: [],
        startDate: dateInputToISO(data.startDate ?? ''),
        dueDate: dateInputToISO(data.dueDate ?? ''),
        labelIds,
        estimateHours,
        createdAt: now,
        updatedAt: now,
      };
      dispatch({ type: 'TASK_ADD', task });
      toast('Đã tạo nhiệm vụ', `${task.code} · ${task.title}`);
    }
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} wide>
      <DialogHeader title={initial ? 'Chỉnh sửa nhiệm vụ' : 'Tạo nhiệm vụ mới'} desc={initial?.code} onClose={onClose} />
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogBody className="flex flex-col gap-4">
          <Field label="Tiêu đề" error={errors.title?.message}>
            <Input {...register('title')} placeholder="Nhập tiêu đề nhiệm vụ..." autoFocus />
          </Field>

          <Field label="Mô tả">
            <Textarea {...register('description')} rows={3} placeholder="Mô tả chi tiết công việc..." />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Dự án" error={errors.projectId?.message}>
              <Select {...register('projectId')}>
                <option value="">— Chọn dự án —</option>
                {visibleProjectsList.map((p) => (
                  <option key={p.id} value={p.id}>{p.code} · {p.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Giờ ước tính" error={errors.estimateHours?.message}>
              <Input {...register('estimateHours')} type="number" min={0} step={0.5} placeholder="0" />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Trạng thái">
              <Select {...register('status')}>
                {TASK_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Ưu tiên">
              <Select {...register('priority')}>
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Ngày bắt đầu">
              <Input {...register('startDate')} type="date" />
            </Field>
            <Field label="Deadline">
              <Input {...register('dueDate')} type="date" />
            </Field>
          </div>

          <Field label="Người thực hiện">
            <Controller
              name="assigneeIds"
              control={control}
              render={({ field }) => (
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {state.users.map((u) => {
                    const value = field.value ?? [];
                    return (
                      <label key={u.id} className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-2.5 py-2 hover:bg-accent">
                        <Checkbox
                          checked={value.includes(u.id)}
                          onChange={() => field.onChange(value.includes(u.id) ? value.filter((x) => x !== u.id) : [...value, u.id])}
                        />
                        <Avatar name={u.name} avatarUrl={u.avatarUrl} size="xs" />
                        <span className="truncate text-sm">{u.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            />
          </Field>

          <Field label="Nhãn">
            <Controller
              name="labelIds"
              control={control}
              render={({ field }) => (
                <div className="flex flex-wrap gap-2">
                  {state.labels.map((l) => {
                    const value = field.value ?? [];
                    const active = value.includes(l.id);
                    return (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => field.onChange(active ? value.filter((x) => x !== l.id) : [...value, l.id])}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${active ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:bg-accent'}`}
                      >
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: l.color }} />
                        {l.name}
                      </button>
                    );
                  })}
                </div>
              )}
            />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Hủy</Button>
          <Button type="submit">{initial ? 'Lưu thay đổi' : 'Tạo nhiệm vụ'}</Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
