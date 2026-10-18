-- ============================================================================
-- NEXUS PROJECT — MIGRATION 02: AUTH SYNC & SHARED WORKSPACE BOOTSTRAP
-- ============================================================================
-- Mục đích:
--   1. Tự động đồng bộ tài khoản từ auth.users sang public.profiles cho cả
--      Discord OAuth lẫn Email/Password.
--   2. BẢO VỆ TUYỆT ĐỐI tên hiển thị trong Server Ban Công Nghệ (BCN) và Avatar:
--      Khi auth.users cập nhật token lúc đăng nhập lại, trigger KHÔNG BAO GIỜ
--      ghi đè lại tên/avatar đã được app đồng bộ từ Discord Guild Member API.
--   3. Tự động Backfill toàn bộ tài khoản đã tồn tại sẵn trong auth.users.
--   4. Hàm RPC bootstrap_workspace: Gom toàn bộ thành viên (cả Discord & Email)
--      vào CHUNG 1 Workspace duy nhất. Người khởi tạo đầu tiên nhận quyền 'admin'
--      (toàn quyền cao nhất), các thành viên đăng nhập sau tự động vào chung
--      workspace với quyền 'member'.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TRIGGER ĐỒNG BỘ AUTH.USERS -> PUBLIC.PROFILES
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email    text;
  v_name     text;
  v_username text;
  v_avatar   text;
begin
  v_email := lower(trim(coalesce(
    new.email,
    new.raw_user_meta_data->>'email',
    ''
  )));

  v_name := coalesce(
    nullif(trim(new.raw_user_meta_data->'custom_claims'->>'global_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    nullif(split_part(v_email, '@', 1), ''),
    'Thành viên'
  );

  v_username := coalesce(
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    nullif(trim(new.raw_user_meta_data->>'user_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'preferred_username'), ''),
    nullif(split_part(v_email, '@', 1), '')
  );

  v_avatar := coalesce(
    nullif(trim(new.raw_user_meta_data->>'avatar_url'), ''),
    nullif(trim(new.raw_user_meta_data->>'picture'), '')
  );

  insert into public.profiles (id, name, email, username, title, avatar_url)
  values (
    new.id,
    v_name,
    v_email,
    v_username,
    coalesce(nullif(trim(new.raw_user_meta_data->>'title'), ''), 'Thành viên'),
    v_avatar
  )
  on conflict (id) do update set
    -- Giữ nguyên tên đã được đồng bộ từ Server BCN (chỉ điền nếu đang rỗng)
    name       = coalesce(nullif(trim(public.profiles.name), ''), excluded.name),
    email      = coalesce(nullif(excluded.email, ''), public.profiles.email),
    username   = coalesce(nullif(trim(public.profiles.username), ''), excluded.username),
    avatar_url = coalesce(nullif(trim(public.profiles.avatar_url), ''), excluded.avatar_url),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 2. BACKFILL TÀI KHOẢN HIỆN CÓ TRONG AUTH.USERS SANG PUBLIC.PROFILES
-- ----------------------------------------------------------------------------
insert into public.profiles (id, name, email, username, title, avatar_url)
select
  u.id,
  coalesce(
    nullif(trim(u.raw_user_meta_data->'custom_claims'->>'global_name'), ''),
    nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(u.raw_user_meta_data->>'name'), ''),
    nullif(split_part(lower(trim(coalesce(u.email, ''))), '@', 1), ''),
    'Thành viên'
  ) as name,
  lower(trim(coalesce(u.email, u.raw_user_meta_data->>'email', ''))) as email,
  coalesce(
    nullif(trim(u.raw_user_meta_data->>'name'), ''),
    nullif(trim(u.raw_user_meta_data->>'user_name'), ''),
    nullif(split_part(lower(trim(coalesce(u.email, ''))), '@', 1), '')
  ) as username,
  coalesce(nullif(trim(u.raw_user_meta_data->>'title'), ''), 'Thành viên') as title,
  coalesce(
    nullif(trim(u.raw_user_meta_data->>'avatar_url'), ''),
    nullif(trim(u.raw_user_meta_data->>'picture'), '')
  ) as avatar_url
from auth.users u
on conflict (id) do update set
  email      = coalesce(nullif(excluded.email, ''), public.profiles.email),
  username   = coalesce(nullif(trim(public.profiles.username), ''), excluded.username),
  avatar_url = coalesce(nullif(trim(public.profiles.avatar_url), ''), excluded.avatar_url);

-- ----------------------------------------------------------------------------
-- 3. RPC BOOTSTRAP WORKSPACE CHUNG (HỢP NHẤT TEAM DISCORD & EMAIL)
-- ----------------------------------------------------------------------------
create or replace function public.bootstrap_workspace(ws_name text default 'Ban Công Nghệ')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user     uuid := auth.uid();
  v_ws       uuid;
  v_email    text;
  v_name     text;
  v_username text;
  v_avatar   text;
begin
  if v_user is null then
    raise exception 'Chưa đăng nhập';
  end if;

  -- Đảm bảo user đã có dòng trong public.profiles
  select
    lower(trim(coalesce(u.email, u.raw_user_meta_data->>'email', ''))),
    coalesce(
      nullif(trim(u.raw_user_meta_data->'custom_claims'->>'global_name'), ''),
      nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
      nullif(trim(u.raw_user_meta_data->>'name'), ''),
      nullif(split_part(lower(trim(coalesce(u.email, ''))), '@', 1), ''),
      'Thành viên'
    ),
    coalesce(
      nullif(trim(u.raw_user_meta_data->>'name'), ''),
      nullif(trim(u.raw_user_meta_data->>'user_name'), ''),
      nullif(split_part(lower(trim(coalesce(u.email, ''))), '@', 1), '')
    ),
    coalesce(
      nullif(trim(u.raw_user_meta_data->>'avatar_url'), ''),
      nullif(trim(u.raw_user_meta_data->>'picture'), '')
    )
  into v_email, v_name, v_username, v_avatar
  from auth.users u
  where u.id = v_user;

  insert into public.profiles (id, name, email, username, title, avatar_url)
  values (
    v_user,
    coalesce(v_name, 'Thành viên'),
    coalesce(v_email, ''),
    v_username,
    'Thành viên',
    v_avatar
  )
  on conflict (id) do nothing;

  -- 1. Nếu user đã thuộc một workspace rồi -> trả về ngay workspace đó
  select wm.workspace_id
    into v_ws
    from public.workspace_members wm
   where wm.user_id = v_user
   order by wm.created_at asc
   limit 1;

  if v_ws is not null then
    return v_ws;
  end if;

  -- 2. Kiểm tra xem hệ thống đã có Workspace chung nào chưa
  select w.id
    into v_ws
    from public.workspaces w
   order by w.created_at asc
   limit 1;

  if v_ws is not null then
    -- Đã có Workspace chung -> Tự động thêm thành viên mới vào chung Workspace
    -- với vai trò 'member' để cả team (Discord & Email) làm việc chung 1 nơi!
    insert into public.workspace_members (workspace_id, user_id, role)
    values (v_ws, v_user, 'member')
    on conflict (workspace_id, user_id) do nothing;

    return v_ws;
  end if;

  -- 3. Nếu chưa có bất kỳ Workspace nào (người đầu tiên đăng nhập sau khi dựng DB):
  --    Tạo Workspace chung và cấp quyền cao nhất 'admin' cho người khởi tạo.
  insert into public.workspaces (name, timezone, created_by)
  values (
    coalesce(nullif(trim(ws_name), ''), 'Ban Công Nghệ'),
    'Asia/Ho_Chi_Minh',
    v_user
  )
  returning id into v_ws;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_ws, v_user, 'admin');

  -- Khởi tạo bộ nhãn (labels) mặc định cho Workspace
  insert into public.labels (workspace_id, name, color) values
    (v_ws, 'Frontend',  '#3B82F6'),
    (v_ws, 'Backend',   '#10B981'),
    (v_ws, 'Design',    '#EC4899'),
    (v_ws, 'Bug',       '#EF4444'),
    (v_ws, 'Khẩn cấp',  '#F59E0B'),
    (v_ws, 'Tài liệu',  '#8B5CF6'),
    (v_ws, 'Bảo mật',   '#DC2626'),
    (v_ws, 'DevOps',    '#06B6D4')
  on conflict do nothing;

  return v_ws;
end;
$$;

grant execute on function public.bootstrap_workspace(text) to authenticated;

