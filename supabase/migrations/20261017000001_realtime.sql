-- ============================================================================
-- Nexus Project — Bật Supabase Realtime cho các bảng của app
-- App đăng ký postgres_changes để tự đồng bộ dữ liệu (không cần tải lại trang).
-- Mặc định các bảng mới KHÔNG nằm trong publication supabase_realtime,
-- nên phải add từng bảng một cách tường minh.
-- ============================================================================

alter publication supabase_realtime add table public.workspaces;
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.workspace_members;
alter publication supabase_realtime add table public.projects;
alter publication supabase_realtime add table public.project_members;
alter publication supabase_realtime add table public.project_requests;
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.task_assignees;
alter publication supabase_realtime add table public.task_watchers;
alter publication supabase_realtime add table public.task_labels;
alter publication supabase_realtime add table public.task_comments;
alter publication supabase_realtime add table public.task_checklists;
alter publication supabase_realtime add table public.task_dependencies;
alter publication supabase_realtime add table public.task_attachments;
alter publication supabase_realtime add table public.labels;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.activity_logs;
alter publication supabase_realtime add table public.documents;
