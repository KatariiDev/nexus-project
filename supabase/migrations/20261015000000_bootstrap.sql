-- ============================================================================
-- Nexus Project — Bootstrap cho tài khoản mới
-- Hàm RPC `bootstrap_workspace`: tạo profile + workspace + quyền owner
-- cho user vừa đăng ký (security definer để vượt qua chicken-and-egg của RLS).
-- App gọi hàm này ngay sau lần đăng nhập đầu tiên nếu user chưa có workspace.
-- ============================================================================

create or replace function public.bootstrap_workspace(ws_name text default 'Workspace của tôi')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  ws_id uuid;
  u_email text;
  u_name text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select email into u_email from auth.users where id = auth.uid();
  u_name := coalesce(nullif(split_part(coalesce(u_email, ''), '@', 1), ''), 'Thành viên');

  insert into public.profiles (id, name, email)
  values (auth.uid(), u_name, coalesce(u_email, ''))
  on conflict (id) do update set email = excluded.email;

  insert into public.workspaces (name, created_by)
  values (coalesce(nullif(ws_name, ''), 'Workspace của tôi'), auth.uid())
  returning id into ws_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (ws_id, auth.uid(), 'owner')
  on conflict do nothing;

  -- Nhãn mặc định cho workspace mới
  insert into public.labels (workspace_id, name, color)
  values
    (ws_id, 'bug', '#EF4444'),
    (ws_id, 'feature', '#4F46E5'),
    (ws_id, 'design', '#A855F7'),
    (ws_id, 'docs', '#16A34A'),
    (ws_id, 'backend', '#0284C7'),
    (ws_id, 'frontend', '#0891B2'),
    (ws_id, 'khẩn cấp', '#F97316')
  on conflict do nothing;

  return ws_id;
end;
$$;
