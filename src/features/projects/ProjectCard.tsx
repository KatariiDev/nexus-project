import { useNavigate } from 'react-router-dom';
import {
  Archive, ArchiveRestore, CalendarDays, MoreVertical, Pencil, Trash2, UserPlus, Users,
} from 'lucide-react';
import { projectProgress, useApp, userById } from '../../store/AppContext';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Badge, PriorityBadge, ProjectStatusBadge } from '../../components/ui/badge';
import { Dropdown, DropdownItem, DropdownSeparator } from '../../components/ui/dropdown';
import { Progress } from '../../components/ui/progress';
import { AvatarStack } from '../../components/ui/avatar';
import { dueLabel } from '../../lib/format';
import { cn } from '../../lib/utils';
import type { Project, User } from '../../types';
import { DUE_TONE_CLASS } from './helpers';

export function ProjectCard({
  project,
  onEdit,
  onToggleArchive,
  onDelete,
  canEdit,
  deleteMode,
  canJoin,
  joinRequested,
  onJoin,
}: {
  project: Project;
  onEdit: (p: Project) => void;
  onToggleArchive: (p: Project) => void;
  onDelete: (id: string) => void;
  canEdit: boolean;
  deleteMode: 'direct' | 'request' | 'none';
  canJoin: boolean;
  joinRequested: boolean;
  onJoin: () => void;
}) {
  const { state } = useApp();
  const navigate = useNavigate();
  const progress = projectProgress(state.tasks, project.id);
  const manager = userById(state.users, project.managerId);
  const members = project.memberIds
    .map((id) => userById(state.users, id))
    .filter((u): u is User => Boolean(u));
  const due = dueLabel(project.endDate, project.status === 'completed' ? 'done' : undefined);
  const archived = project.status === 'archived';

  return (
    <Card
      onClick={() => navigate(`/user/projects/${project.id}`)}
      className="cursor-pointer transition-shadow hover:shadow-lift"
    >
      <div className="h-1.5 rounded-t-lg" style={{ backgroundColor: project.color }} />
      <CardContent className="flex flex-col gap-3 p-5 pt-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold">{project.name}</h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge tone="muted">{project.code}</Badge>
              <ProjectStatusBadge status={project.status} />
              <PriorityBadge priority={project.priority} showDot />
            </div>
          </div>
          {(canEdit || deleteMode !== 'none') && (
            <div onClick={(e) => e.stopPropagation()}>
              <Dropdown
                align="right"
                trigger={
                  <Button variant="ghost" size="icon" aria-label="Tùy chọn dự án">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                }
              >
                {canEdit && (
                  <>
                    <DropdownItem icon={<Pencil className="h-4 w-4" />} label="Chỉnh sửa" onClick={() => onEdit(project)} />
                    <DropdownItem
                      icon={archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                      label={archived ? 'Kích hoạt' : 'Lưu trữ'}
                      desc={archived ? 'Đưa dự án hoạt động trở lại' : 'Tạm ẩn khỏi danh sách chính'}
                      onClick={() => onToggleArchive(project)}
                    />
                  </>
                )}
                {deleteMode !== 'none' && (
                  <>
                    <DropdownSeparator />
                    <DropdownItem icon={<Trash2 className="h-4 w-4" />} label={deleteMode === 'direct' ? 'Xóa dự án' : 'Yêu cầu xóa dự án'} danger onClick={() => onDelete(project.id)} />
                  </>
                )}
              </Dropdown>
            </div>
          )}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Tiến độ</span>
            <span className="font-semibold">{progress}%</span>
          </div>
          <Progress value={progress} />
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className={cn('inline-flex items-center gap-1.5', DUE_TONE_CLASS[due.tone])}>
            <CalendarDays className="h-4 w-4" />
            {due.text}
          </span>
          <AvatarStack users={members} max={4} />
        </div>

        <div className="flex items-center gap-2 border-t pt-3 text-xs text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          <span className="truncate">
            Chủ dự án: <span className="font-medium text-foreground">{manager?.name ?? '—'}</span>
          </span>
        </div>

        {canJoin && (
          <div onClick={(e) => e.stopPropagation()} className="pt-1">
            <Button size="sm" className="w-full" disabled={joinRequested} onClick={onJoin}>
              <UserPlus className="h-4 w-4" />
              {joinRequested ? 'Đã gửi yêu cầu tham gia' : 'Xin tham gia'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
