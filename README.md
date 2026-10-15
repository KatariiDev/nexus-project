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

### Cấu hình Supabase (bắt buộc)

App đọc/ghi dữ liệu thật trên Supabase — không còn chế độ demo.

1. Dùng project Supabase đã tạo (hoặc tạo project mới), lấy **Project URL** và **anon key** (Project Settings → API).
2. Chạy migration theo thứ tự (thư mục `supabase/migrations/`, hoặc dán vào SQL Editor):
   - `20261011000000_init.sql` (schema)
   - `20261011000001_rls.sql` (Row Level Security + Storage bucket)
   - `20261015000000_bootstrap.sql` (hàm `bootstrap_workspace` tạo workspace cho tài khoản mới)
3. Tạo file `.env` từ `.env.example` và điền:
   ```
   VITE_SUPABASE_URL=https://xxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
4. Trong Authentication → Providers: bật **Email** provider và **tắt "Confirm email"** để đăng ký xong đăng nhập ngay.
5. Chạy `npm run dev` — đăng ký tài khoản đầu tiên, app sẽ tự tạo workspace + nhãn mặc định cho bạn.

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
