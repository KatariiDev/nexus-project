import { useEffect, useState } from 'react';
import { Pencil, Save, Trash2 } from 'lucide-react';
import { projectById, taskById, useApp, useCurrentUser, userById } from '../../store/AppContext';
import type { Task, User } from '../../types';
import { Button } from '../../components/ui/button';
import { ConfirmDialog } from '../../components/ui/feedback';
import { toast } from '../../components/ui/toast';
import { dueLabel } from '../../lib/format';
import { newId } from '../../lib/utils';
import { canManageTaskForProject } from '../../lib/roles';
import { DrawerDeclineBanner, DrawerHeader, DrawerStatusRow } from './TaskDrawerHeader';
import {
  DrawerAttachmentsSection, DrawerChecklistSection, DrawerCommentsSection, DrawerDependenciesSection,
  DrawerDescriptionSection, DrawerHistorySection, DrawerInfoSection, DrawerLabelsSection,
} from './TaskDrawerSections';

export function TaskDetailDrawer({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const { state } = useApp();
  const task = taskById(state.tasks, taskId);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  if (!task) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-[520px] max-w-[95vw] flex-col border-l bg-card shadow-lift animate-slide-in-right">
        <TaskDrawerBody key={task.id} task={task} onClose={onClose} />
      </aside>
    </div>
  );
}

function TaskDrawerBody({ task, onClose }: { task: Task; onClose: () => void }) {
  const { state, dispatch } = useApp();
  const me = useCurrentUser();
  const project = projectById(state.projects, task.projectId);

  // Chỉ Leader của dự án + Admin được sửa/xóa nhiệm vụ. Thành viên chỉ xem,
  // ngoại trừ đổi trạng thái nhiệm vụ được giao cho mình và bình luận/checklist.
  const canManage = !!project && canManageTaskForProject(project, me);
  const isAssignee = task.assigneeIds.includes(me.id);
  const canChangeStatus = canManage || isAssignee;
  // Drawer mở ra ở dạng chỉ xem cho mọi người (kể cả Leader/Admin); bấm
  // "Chỉnh sửa" ở footer mới sang dạng sửa. Thành viên không có nút này.
  const [editing, setEditing] = useState(false);
  const canEdit = canManage && editing;
  // Giao nhiệm vụ chỉ cho thành viên trong dự án đó.
  const projectMemberUsers = project
    ? state.users.filter((u) => u.id === project.managerId || project.memberIds.includes(u.id))
    : [];
  const assignedUsers = task.assigneeIds
    .map((id) => userById(state.users, id))
    .filter((u): u is User => Boolean(u));
  const watchedUsers = task.watcherIds
    .map((id) => userById(state.users, id))
    .filter((u): u is User => Boolean(u));

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [checklistTitle, setChecklistTitle] = useState('');
  const [commentBody, setCommentBody] = useState('');
  const [depValue, setDepValue] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null);

  const update = (patch: Partial<Task>) => dispatch({ type: 'TASK_UPDATE', task: { ...task, ...patch } });
  const toggleId = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const checklists = state.checklists.filter((c) => c.taskId === task.id);
  const doneChecklists = checklists.filter((c) => c.done).length;
  const comments = state.comments
    .filter((c) => c.taskId === task.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const deps = state.dependencies.filter((d) => d.taskId === task.id);
  const attachments = state.attachments.filter((a) => a.taskId === task.id);
  const logs = state.activityLogs.filter((l) => l.entityId === task.id).slice(0, 20);
  const depCandidates = state.tasks.filter(
    (t) => t.projectId === task.projectId && t.id !== task.id && !deps.some((d) => d.dependsOnId === t.id),
  );
  const due = dueLabel(task.dueDate, task.status);
  const creatorName = userById(state.users, task.creatorId)?.name ?? '—';
  const declinerName = task.declinedBy ? userById(state.users, task.declinedBy)?.name ?? '—' : null;

  const saveTitle = async () => {
    const t = title.trim();
    if (t && t !== task.title) {
      const ok = await update({ title: t });
      if (ok) toast('Đã cập nhật tiêu đề');
    } else {
      setTitle(task.title);
    }
  };

  const saveDescription = async () => {
    if (description !== task.description) {
      const ok = await update({ description });
      if (ok) toast('Đã lưu mô tả');
    }
  };

  // Nút "Cập nhật" ở footer: lưu một lần các trường còn giữ nháp (tiêu đề + mô tả),
  // gộp chung vào 1 lần cập nhật để không ghi đè lẫn nhau.
  const hasPendingEdits =
    (title.trim() !== '' && title.trim() !== task.title) || description !== task.description;

  const saveAll = async () => {
    const t = title.trim();
    const patch: Partial<Task> = {};
    if (!t) {
      setTitle(task.title);
    } else if (t !== task.title) {
      patch.title = t;
    }
    if (description !== task.description) {
      patch.description = description;
    }
    if (Object.keys(patch).length === 0) return;
    const ok = await update(patch);
    if (ok) {
      toast('Đã cập nhật nhiệm vụ');
      // Lưu xong thì về lại dạng chỉ xem.
      setEditing(false);
    }
  };

  const addChecklist = () => {
    const v = checklistTitle.trim();
    if (!v) return;
    dispatch({ type: 'CHECKLIST_ADD', id: newId(), taskId: task.id, title: v });
    setChecklistTitle('');
  };

  const submitComment = async () => {
    const body = commentBody.trim();
    if (!body) return;
    const ok = await dispatch({ type: 'COMMENT_ADD', id: newId(), taskId: task.id, body });
    if (ok) {
      setCommentBody('');
      toast('Đã gửi bình luận');
    }
  };

  const addDependency = async (dependsOnId: string) => {
    if (!dependsOnId) return;
    const ok = await dispatch({ type: 'DEPENDENCY_ADD', id: newId(), taskId: task.id, dependsOnId });
    if (ok) {
      const name = taskById(state.tasks, dependsOnId)?.title ?? '';
      toast('Đã thêm nhiệm vụ phụ thuộc', name);
      setDepValue('');
    }
  };

  const deleteTask = async () => {
    const ok = await dispatch({ type: 'TASK_DELETE', id: task.id });
    if (ok) toast('Đã xóa nhiệm vụ', task.title);
    setConfirmDelete(false);
    onClose();
  };

  return (
    <>
      <DrawerHeader task={task} canEdit={canEdit} title={title} onTitleChange={setTitle} onTitleBlur={saveTitle} onClose={onClose} />
      <DrawerStatusRow task={task} canChangeStatus={canChangeStatus} canManage={canManage} canEdit={canEdit} editing={editing} due={due} onUpdate={update} />
      {task.declinedBy && <DrawerDeclineBanner task={task} declinerName={declinerName} />}
      <div className="flex-1 overflow-y-auto">
        <DrawerInfoSection task={task} project={project} creatorName={creatorName} canEdit={canEdit} projectMemberUsers={projectMemberUsers} assignedUsers={assignedUsers} watchedUsers={watchedUsers} users={state.users} onUpdate={update} onToggleId={toggleId} />
        <DrawerLabelsSection labels={state.labels} labelIds={task.labelIds} canEdit={canEdit} onToggleLabel={(id) => update({ labelIds: toggleId(task.labelIds, id) })} />
        <DrawerDescriptionSection description={description} savedDescription={task.description} canEdit={canEdit} onDescriptionChange={setDescription} onSave={saveDescription} />
        <DrawerChecklistSection checklists={checklists} doneCount={doneChecklists} title={checklistTitle} onTitleChange={setChecklistTitle} onAdd={addChecklist} onToggle={(id) => dispatch({ type: 'CHECKLIST_TOGGLE', id })} onDelete={(id) => dispatch({ type: 'CHECKLIST_DELETE', id })} />
        <DrawerDependenciesSection deps={deps} tasks={state.tasks} canEdit={canEdit} candidates={depCandidates} value={depValue} onAdd={addDependency} onDelete={(id) => dispatch({ type: 'DEPENDENCY_DELETE', id })} />
        <DrawerCommentsSection comments={comments} users={state.users} meId={me.id} body={commentBody} onBodyChange={setCommentBody} onSubmit={submitComment} onDeleteRequest={setCommentToDelete} />
        <DrawerAttachmentsSection attachments={attachments} />
        <DrawerHistorySection logs={logs} users={state.users} />
      </div>
      {/* Footer — Leader/Admin mở ra ở dạng chỉ xem, bấm "Chỉnh sửa" mới hiện Xóa / Cập nhật */}
      {canManage && (
        <div className="flex gap-2 border-t p-4">
          {!editing ? (
            <Button className="flex-1" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" />Chỉnh sửa
            </Button>
          ) : (
            <>
              <Button variant="destructive" className="flex-1" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-4 w-4" />Xóa nhiệm vụ
              </Button>
              <Button
                className="flex-1"
                disabled={!hasPendingEdits}
                // Chặn blur của ô tiêu đề để không lưu trùng 2 lần (blur lưu 1 lần, bấm nút lưu 1 lần nữa).
                onMouseDown={(e) => e.preventDefault()}
                onClick={saveAll}
              >
                <Save className="h-4 w-4" />Cập nhật
              </Button>
            </>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Xóa nhiệm vụ"
        desc={`Bạn chắc chắn muốn xóa nhiệm vụ "${task.title}"? Checklist, bình luận và dữ liệu liên quan cũng sẽ bị xóa. Hành động này không thể hoàn tác.`}
        confirmLabel="Xóa nhiệm vụ"
        onConfirm={deleteTask}
        onCancel={() => setConfirmDelete(false)}
      />
      <ConfirmDialog
        open={commentToDelete !== null}
        title="Xóa bình luận"
        desc="Bạn chắc chắn muốn xóa bình luận này?"
        onConfirm={() => { if (commentToDelete) dispatch({ type: 'COMMENT_DELETE', id: commentToDelete }); setCommentToDelete(null); }}
        onCancel={() => setCommentToDelete(null)}
      />
    </>
  );
}
