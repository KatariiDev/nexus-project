/**
 * Lớp truy cập dữ liệu Supabase cho Nexus Project.
 *
 * - Định nghĩa kiểu dòng DB (snake_case) và hàm map sang kiểu của app (camelCase).
 * - Tải toàn bộ dữ liệu của một workspace sau khi đăng nhập.
 * - `persistAction`: ghi mỗi thao tác của người dùng xuống Supabase trước,
 *   rồi trả về action đã làm giàu (id/log) để reducer cập nhật state cục bộ.
 *   Nếu ghi DB thất bại, action không được áp dụng và UI báo lỗi.
 */

// Barrel re-export de import ngoai khong doi (chi AppContext + appTypes import tu day).
export { bootstrapWorkspace, fetchMyMemberships, loadWorkspaceData } from './db/load';
export type { WorkspaceBundle } from './db/load';
export {
  getProjectDocumentUrl,
  PROJECT_DOC_ACCEPT,
  PROJECT_DOC_MAX_BYTES,
  uploadProjectDocumentFile,
} from './db/documents';
export type { PersistContext } from './db/persist-helpers';
export { persistAction } from './db/persist';
export { fetchIsSuperAdmin, setSuperAdmin } from './db/superAdmin';
