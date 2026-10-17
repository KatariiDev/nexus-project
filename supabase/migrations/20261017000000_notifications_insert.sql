-- Cho phép thành viên tạo thông báo cho thành viên khác trong cùng workspace.
--
-- Bối cảnh: policy p_notif_all (20261011000001_rls.sql) đặt
--   with check (user_id = auth.uid())
-- nên mọi lệnh INSERT thông báo cho NGƯỜI KHÁC đều bị RLS chặn
-- (lỗi 42501). Các luồng sau vì thế không gửi được thông báo:
--   - giao nhiệm vụ cho người khác (notifyAssignees)
--   - yêu cầu / kết quả duyệt nhiệm vụ (notifyReview)
--   - Owner gửi yêu cầu tạo/tạm dừng/xóa dự án -> báo cho Admin
--   - Admin duyệt/từ chối yêu cầu -> báo cho người yêu cầu
-- Policy mới cho phép: thành viên được tạo thông báo cho bất kỳ
-- thành viên nào cùng workspace với mình.

create policy p_notif_insert_ws_member on public.notifications for insert to authenticated
  with check (
    exists (
      select 1
      from public.workspace_members m1
      join public.workspace_members m2 on m2.workspace_id = m1.workspace_id
      where m1.user_id = auth.uid()
        and m2.user_id = notifications.user_id
    )
  );
