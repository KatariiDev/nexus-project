-- ============================================================================
-- NEXUS PROJECT — MIGRATION 04: SUPABASE REALTIME PUBLICATION
-- ============================================================================
-- Mục đích:
--   Bật phát sự kiện thay đổi dữ liệu (INSERT / UPDATE / DELETE) qua kênh
--   supabase_realtime cho tất cả các bảng trong schema public.
--   Giúp UI của Admin, Owner và các thành viên tự động đồng bộ tức thì.
-- ============================================================================

do $$
declare
  t text;
  tables text[] := array[
    'profiles',
    'workspaces',
    'workspace_members',
    'projects',
    'project_members',
    'project_requests',
    'tasks',
    'task_assignees',
    'task_watchers',
    'task_comments',
    'task_checklists',
    'task_dependencies',
    'labels',
    'task_labels',
    'task_attachments',
    'notifications',
    'activity_logs',
    'documents'
  ];
begin
  foreach t in array tables loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

