import type { Task } from '../types';
import type { Action } from './appTypes';

/** Sau 12h kể từ lúc giao mà không phản hồi thì mặc định task được thực hiện. */
const AUTO_ACCEPT_MS = 12 * 60 * 60 * 1000;

/** Task đang chờ phản hồi đã quá 12h kể từ lúc giao. */
function findAutoAcceptTasks(tasks: Task[], now = Date.now()): Task[] {
  return tasks.filter(
    (t) =>
      t.status === 'todo' &&
      t.assignedAt &&
      !t.declinedBy &&
      t.assigneeIds.length > 0 &&
      now - new Date(t.assignedAt).getTime() > AUTO_ACCEPT_MS,
  );
}

/**
 * Chạy kiểm tra tự động nhận. Lũy đẳng: task đã sang 'in_progress' thì lần
 * sau không khớp nữa. Dừng ở lỗi đầu tiên để không spam toast.
 */
export async function runAutoAcceptCheck(
  tasks: Task[],
  dispatch: (a: Action) => Promise<boolean>,
): Promise<void> {
  const overdue = findAutoAcceptTasks(tasks);
  for (const t of overdue) {
    const ok = await dispatch({ type: 'TASK_AUTO_ACCEPT', id: t.id });
    if (!ok) break;
  }
}

