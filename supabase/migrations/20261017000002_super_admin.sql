-- ============================================================================
-- Nexus Project — Tầng Admin tổng (super-admin)
--
-- Mô hình: Owner làm chủ workspace của mình; Admin tổng quản lý TẤT CẢ
-- các workspace/owner. Có thể có nhiều Admin tổng; Admin tổng nào cũng
-- có thể cấp/gỡ quyền Admin tổng cho người khác.
-- ============================================================================

-- 1. Cờ super-admin trên profiles
alter table public.profiles
  add column if not exists is_super_admin boolean not null default false;

-- 2. Helper kiểm tra super-admin (security definer để vượt RLS)
create or replace function public.is_super_admin(uid uuid default null)
returns boolean language sql security definer stable as $$
  select coalesce(
    (select p.is_super_admin from public.profiles p where p.id = coalesce(uid, auth.uid())),
    false
  );
$$;

-- 3. Super-admin được coi là thành viên của mọi workspace...
create or replace function public.is_ws_member(ws uuid)
returns boolean language sql security definer stable as $$
  select public.is_super_admin() or exists (
    select 1 from public.workspace_members
    where workspace_id = ws and user_id = auth.uid()
  );
$$;

-- ...và có quyền admin ở mọi workspace
create or replace function public.ws_role(ws uuid)
returns text language sql security definer stable as $$
  select case
    when public.is_super_admin() then 'admin'::text
    else (select role from public.workspace_members where workspace_id = ws and user_id = auth.uid())
  end;
$$;

-- 4. Super-admin được xóa workspace
drop policy if exists p_ws_delete on public.workspaces;
create policy p_ws_delete on public.workspaces for delete to authenticated
  using (public.is_super_admin() or public.ws_role(id) = 'owner');

-- 5. Cho phép gửi thông báo cho super-admin (dù khác workspace)
drop policy if exists p_notif_insert_ws_member on public.notifications;
create policy p_notif_insert_ws_member on public.notifications for insert to authenticated
  with check (
    public.is_super_admin(notifications.user_id)
    or exists (
      select 1
      from public.workspace_members m1
      join public.workspace_members m2 on m2.workspace_id = m1.workspace_id
      where m1.user_id = auth.uid()
        and m2.user_id = notifications.user_id
    )
  );

-- 6. RPC cấp/gỡ quyền Admin tổng — chỉ Admin tổng mới được gọi;
--    không cho tự gỡ quyền của chính mình (tránh khóa luôn hệ thống)
create or replace function public.set_super_admin(target_id uuid, make_admin boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super_admin() then
    raise exception 'Chỉ Admin tổng mới được phân quyền.';
  end if;
  if target_id = auth.uid() and not make_admin then
    raise exception 'Không thể tự gỡ quyền Admin tổng của chính mình.';
  end if;
  update public.profiles set is_super_admin = make_admin where id = target_id;
end;
$$;

-- 7. Chỉ định 2 tài khoản Admin tổng ban đầu
update public.profiles set is_super_admin = true
where id in (
  select id from auth.users where email in ('admin@gmail.com', 'tranthituongvan30@gmail.com')
);
