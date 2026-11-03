import { useApp } from '../../store/AppContext';
import type { ProjectRequest } from '../../types';

/** Tên workspace từ id — dùng khi Admin tổng xem dữ liệu nhiều workspace. */
export function wsName(state: ReturnType<typeof useApp>['state'], workspaceId?: string): string {
  if (!workspaceId) return '';
  return state.workspaces.find((w) => w.id === workspaceId)?.name ?? '';
}

export function requestName(r: ProjectRequest, state: ReturnType<typeof useApp>['state']): string {
  if (r.type === 'create_project') return String(r.payload?.name ?? 'Dự án mới');
  const p = state.projects.find((x) => x.id === r.projectId);
  return p ? p.name : '(dự án đã xóa)';
}

export function userName(state: ReturnType<typeof useApp>['state'], id?: string): string {
  return state.users.find((u) => u.id === id)?.name ?? '—';
}
