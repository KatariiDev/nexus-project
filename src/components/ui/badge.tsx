import React from 'react';
import { cn } from '../../lib/utils';
import type { Priority, ProjectStatus, TaskStatus } from '../../types';
import { priorityLabel, projectStatusLabel, taskStatusLabel } from '../../types';

type Tone = 'default' | 'primary' | 'success' | 'warning' | 'destructive' | 'muted' | 'info' | 'purple';

const tones: Record<Tone, string> = {
  default: 'bg-secondary text-secondary-foreground',
  primary: 'bg-primary/10 text-primary dark:bg-primary/20',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  destructive: 'bg-destructive/10 text-destructive',
  muted: 'bg-muted text-muted-foreground',
  info: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
};

export function Badge({ tone = 'default', className, ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

const taskStatusTone: Record<TaskStatus, Tone> = {
  todo: 'muted',
  in_progress: 'primary',
  in_review: 'warning',
  done: 'success',
};

const projectStatusTone: Record<ProjectStatus, Tone> = {
  planning: 'info',
  active: 'primary',
  paused: 'warning',
  completed: 'success',
  archived: 'muted',
};

const priorityTone: Record<Priority, Tone> = {
  low: 'muted',
  medium: 'info',
  high: 'warning',
  urgent: 'destructive',
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <Badge tone={taskStatusTone[status]}>{taskStatusLabel(status)}</Badge>;
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return <Badge tone={projectStatusTone[status]}>{projectStatusLabel(status)}</Badge>;
}

export function PriorityBadge({ priority, showDot }: { priority: Priority; showDot?: boolean }) {
  return (
    <Badge tone={priorityTone[priority]}>
      {showDot && <span className={cn('h-1.5 w-1.5 rounded-full', priority === 'low' ? 'bg-muted-foreground' : priority === 'medium' ? 'bg-sky-500' : priority === 'high' ? 'bg-warning' : 'bg-destructive')} />}
      {priorityLabel(priority)}
    </Badge>
  );
}
