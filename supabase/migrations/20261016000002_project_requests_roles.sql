-- ============================================================================
-- Nexus Project — Phân cấp vai trò mới: Admin > Owner > Manager > Member > Viewer
-- - Chỉ Admin được duyệt / từ chối yêu cầu dự án.
-- - Chỉ Owner (và Admin) được gửi yêu cầu tạo/tạm dừng/xóa dự án.
-- ============================================================================

-- Chỉ Admin được duyệt / từ chối (trước đây cho cả Owner)
drop policy if exists p_preq_review on public.project_requests;
create policy p_preq_review on public.project_requests for update to authenticated
  using (public.ws_role(workspace_id) = 'admin')
  with check (public.ws_role(workspace_id) = 'admin');

-- Chỉ Owner/Admin được tạo yêu cầu (trước đây mọi thành viên đều được)
drop policy if exists p_preq_insert on public.project_requests;
create policy p_preq_insert on public.project_requests for insert to authenticated
  with check (
    requested_by = auth.uid()
    and status = 'pending'
    and public.is_ws_member(workspace_id)
    and public.ws_role(workspace_id) in ('owner', 'admin')
  );
