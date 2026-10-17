-- ============================================================================
-- Nexus Project — Bootstrap & Đồng bộ Profile cho tài khoản mới
-- 1. Hàm RPC `bootstrap_workspace`: tạo workspace + quyền owner cho user
--    vừa đăng nhập lần đầu nếu chưa thuộc workspace nào.
-- 2. Trigger `handle_new_user`: tự động đồng bộ auth.users sang public.profiles
--    (trích xuất tên Discord, avatar Discord hoặc email) ngay khi user đăng nhập/được tạo.
-- ============================================================================

-- Trigger tự động đồng bộ từ auth.users sang public.profiles
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'global_name',
      new.raw_user_meta_data->'custom_claims'->>'global_name',
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Thành viên'
    ),
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture', null)
  )
  on conflict (id) do update set
    name = case when public.profiles.name in ('Thành viên', '') or public.profiles.name is null then excluded.name else public.profiles.name end,
    email = excluded.email,
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update on auth.users
  for each row execute function public.handle_new_user();

-- Hàm khởi tạo workspace mặc định khi user mới đăng nhập mà chưa có workspace nào
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
  u_avatar text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select
    email,
    coalesce(
      raw_user_meta_data->>'full_name',
      raw_user_meta_data->>'name',
      raw_user_meta_data->>'global_name',
      raw_user_meta_data->'custom_claims'->>'global_name',
      nullif(split_part(coalesce(email, ''), '@', 1), ''),
      'Thành viên'
    ),
    coalesce(
      raw_user_meta_data->>'avatar_url',
      raw_user_meta_data->>'picture',
      null
    )
  into u_email, u_name, u_avatar
  from auth.users where id = auth.uid();

  insert into public.profiles (id, name, email, avatar_url)
  values (auth.uid(), u_name, coalesce(u_email, ''), u_avatar)
  on conflict (id) do update set
    name = case when public.profiles.name in ('Thành viên', '') or public.profiles.name is null then excluded.name else public.profiles.name end,
    email = excluded.email,
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url);

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
