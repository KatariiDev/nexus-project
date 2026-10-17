# Nexus Project

Nền tảng quản lý dự án chuyên nghiệp cho doanh nghiệp, đội nhóm và cá nhân — quản lý dự án, công việc, nhân sự, tiến độ, tài liệu và hiệu suất trên một hệ thống thống nhất.

**Tech stack:** React 19 · TypeScript · Vite · Tailwind CSS · React Router · Recharts · dnd-kit · React Hook Form + Zod · Supabase (PostgreSQL + Auth + Storage)

## Tính năng

- **Tổng quan (Dashboard):** lời chào, KPI, biểu đồ tiến độ 14 ngày, phân bổ trạng thái, dự án gần đây, nhiệm vụ sắp đến hạn, hoạt động nhóm, workload thành viên.
- **Dự án:** CRUD, lưu trữ/xóa (có xác nhận), Grid/List view, lọc theo trạng thái/ưu tiên/quản lý, tìm kiếm, sắp xếp, phân trang, theo dõi ngân sách, tiến độ tự động.
- **Nhiệm vụ:** Kanban kéo thả (dnd-kit), Table view (sắp xếp, lọc, chọn nhiều + thao tác hàng loạt), Công việc của tôi (nhóm Quá hạn/Hôm nay/Sắp đến hạn/Hoàn thành), Task Detail Drawer (mô tả, checklist, phụ thuộc, bình luận, đính kèm, lịch sử).
- **Lịch:** xem Tháng/Tuần/Ngày, lọc theo dự án/trạng thái, tạo nhanh nhiệm vụ từ ô ngày.
- **Timeline (Gantt):** scale Ngày/Tuần/Tháng, thanh tiến độ, tô nổi bật quá hạn, đường phụ thuộc.
- **Nhóm & Nhân sự:** danh sách, workload, mời thành viên, phân quyền (Owner/Admin/Manager/Member/Viewer).
- **Thông báo:** theo sự kiện (giao việc, sắp đến hạn, quá hạn, nhắc tên...), đánh dấu đã đọc.
- **Báo cáo:** KPI + biểu đồ từ dữ liệu thật, lọc theo thời gian/dự án/thành viên, xuất CSV.
- **Tài liệu:** CRUD, liên kết dự án.
- **Tìm kiếm toàn cục:** `Ctrl/Cmd + K` tìm dự án/nhiệm vụ/thành viên/tài liệu.
- **Tạo nhanh:** nút "Tạo mới" cho dự án/nhiệm vụ/thành viên/tài liệu.
- **Giao diện:** Light/Dark mode, sidebar thu gọn, responsive, tiếng Việt.

## Chạy ứng dụng

Yêu cầu: Node.js 18+.

```bash
npm install
npm run dev      # chạy dev tại http://localhost:5173
npm run build    # build production
npm run preview  # xem bản build
```

### Cấu hình Supabase & Xác thực Nội bộ

Ứng dụng sử dụng Supabase (PostgreSQL + Auth + Storage) kết hợp xác thực nội bộ qua Discord Server Gatekeeper:

1. **Khởi tạo Database & Chạy Migrations**:
   Dùng project Supabase đã tạo (hoặc tạo project mới), chạy migration theo thứ tự trong thư mục `supabase/migrations/` (qua Supabase CLI `supabase db push` hoặc dán vào SQL Editor):
   - `20261011000000_init.sql` (Khởi tạo toàn bộ bảng schema, trigger và index)
   - `20261011000001_rls.sql` (Chính sách bảo mật RLS và Storage bucket `attachments`)
   - `20261015000000_bootstrap.sql` (Hàm RPC `bootstrap_workspace` tự khởi tạo không gian làm việc cho tài khoản mới)

2. **Cấu hình Biến môi trường (`.env`)**:
   Tạo file `.env` từ `.env.example` và điền:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
   VITE_DISCORD_GUILD_ID=1337249537072435281
   ```
   *(Ghi chú: Nếu chưa điền URL và Anon Key, ứng dụng sẽ tự động chuyển sang chế độ Xem trước / Preview nội bộ để trải nghiệm UI mà không gây gián đoạn công việc).*

3. **Cấu hình Discord OAuth & Server Gatekeeper**:
   - Truy cập **Discord Developer Portal** (`https://discord.com/developers/applications`), tạo Application mới.
   - Trong mục **OAuth2** → Redirects: Thêm URL callback của Supabase: `https://<your-project-ref>.supabase.co/auth/v1/callback`.
   - Lấy **Client ID** và **Client Secret**.
   - Trong **Supabase Dashboard** → **Authentication** → **Providers** → Chọn **Discord**:
     - Bật Discord provider.
     - Dán Client ID và Client Secret.
   - Hệ thống sẽ tự động kiểm tra danh sách server của user qua token OAuth (`identify email guilds`). Chỉ người dùng thuộc Server nội bộ có ID khớp `VITE_DISCORD_GUILD_ID` mới được cấp quyền truy cập. Người ngoài sẽ bị từ chối và đăng xuất tự động.

4. **Tạo tài khoản Dự phòng & Xác thực Email (Email + Mật khẩu)**:
   - Dùng khi Discord gặp sự cố hoặc cần cấp quyền truy cập bằng email công việc.
   - Trong **Supabase Dashboard** → **Authentication** → **Users**:
     - Bấm **Add user** (hoặc **Invite user**): Nhập Email và Mật khẩu cho nhân viên.
     - Nếu bật **Confirm email**: Supabase sẽ gửi thư chứa liên kết xác thực tới hòm thư của nhân viên. Nhân viên mở email bấm xác nhận để kích hoạt tài khoản trước khi đăng nhập.
   - Trong **Authentication** → **URL Configuration**:
     - Đặt **Site URL** trỏ về domain web của bạn (ví dụ: `http://localhost:5173` khi chạy dev, hoặc URL production).
     - Thêm vào **Redirect URLs** đường dẫn web để Supabase chuyển hướng người dùng sau khi xác thực email thành công.

5. **Khởi chạy ứng dụng**:
   ```bash
   npm run dev
   ```

## Cấu trúc project

```
src/
  components/ui/        # Button, Card, Badge, Dialog, Dropdown, Avatar...
  components/layout/    # Sidebar, Header, AppShell, SearchOverlay, QuickCreate
  features/             # dashboard, projects, tasks, calendar, timeline,
                        # team, documents, reports, notifications, settings, auth
  store/AppContext.tsx  # state toàn cục: session Supabase, tải dữ liệu workspace,
                        # dispatch bất đồng bộ (ghi DB trước, rồi cập nhật UI)
  lib/                  # utils, format ngày giờ (vi), supabase client
  lib/db.ts             # lớp truy cập dữ liệu: mapper, tải workspace, persist action
  types.ts              # data model
supabase/migrations/    # schema + RLS policies + bootstrap workspace
```

## Phân quyền

RLS cấu hình theo workspace/dự án/vai trò: Viewer chỉ đọc; Member tạo/sửa nhiệm vụ; Manager trở lên quản lý dự án; Admin/Owner quản trị workspace. Xem chi tiết trong `20261011000001_rls.sql`.

## Kiến trúc dữ liệu

```
Component --dispatch(action)--> AppContext --persistAction()--> Supabase
       <-- cập nhật UI sau khi ghi DB thành công <--
```

- Mọi thao tác (tạo/sửa/xóa dự án, nhiệm vụ, bình luận...) đều ghi xuống Supabase **trước** rồi mới cập nhật giao diện. Ghi thất bại → báo lỗi, giao diện giữ nguyên.
- Đăng nhập bằng Supabase Auth (email + mật khẩu). Tài khoản mới đăng ký được tự tạo workspace riêng qua RPC `bootstrap_workspace`.
- Thêm thành viên vào workspace bằng email của người **đã đăng ký** tài khoản Nexus.

## Roadmap

- [x] UI đầy đủ (CRUD, Kanban, Gantt, báo cáo, xuất CSV)
- [x] Schema Supabase + RLS + Storage
- [x] Lớp truy cập dữ liệu Supabase + Auth thật (thay store demo)
- [ ] Realtime notifications/subscriptions
- [ ] Xuất PDF báo cáo
