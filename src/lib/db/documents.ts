import { getSupabase } from '../supabase';
import { newId } from '../utils';

/* ================= Tài liệu dự án: upload file (bucket project-documents) ================= */

/** Bucket private chứa tệp tài liệu của dự án (tạo bằng nexus-part1-db.sql). */
export const PROJECT_DOCS_BUCKET = 'project-documents';

/** Loại tệp cho phép kéo-thả vào tab Tài liệu của dự án. */
export const PROJECT_DOC_ACCEPT = [
  'image/*',
  'video/*',
  'application/pdf',
  '.doc', '.docx',
  '.xls', '.xlsx',
] as const;

/** Dung lượng tối đa cho một tệp tài liệu (20 MB). */
export const PROJECT_DOC_MAX_BYTES = 20 * 1024 * 1024;

function sanitizeFileName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120) || 'file';
}

interface UploadedProjectDoc {
  /** Đường dẫn trong bucket — lưu vào documents.file_url. */
  path: string;
  name: string;
  size: number;
  type: string;
}

/**
 * Upload một tệp lên bucket `project-documents` theo quy ước
 * `<workspace_id>/<project_id>/<doc_id>-<tên-file>`.
 * Cần chạy nexus-part1-db.sql (tạo bucket + policy) trước khi dùng.
 */
export async function uploadProjectDocumentFile(
  workspaceId: string,
  projectId: string,
  file: File,
): Promise<UploadedProjectDoc> {
  const docId = newId();
  const path = `${workspaceId}/${projectId}/${docId}-${sanitizeFileName(file.name)}`;
  const { error } = await getSupabase().storage
    .from(PROJECT_DOCS_BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) throw new Error(error.message || 'Không tải lên được tệp.');
  return { path, name: file.name, size: file.size, type: file.type };
}

/** Lấy link tải (signed URL, hiệu lực 1 giờ) cho một tệp tài liệu. */
export async function getProjectDocumentUrl(filePath: string): Promise<string> {
  const { data, error } = await getSupabase().storage
    .from(PROJECT_DOCS_BUCKET)
    .createSignedUrl(filePath, 3600);
  if (error || !data?.signedUrl) throw new Error(error?.message || 'Không lấy được link tải.');
  return data.signedUrl;
}

/* ================= Ghi thao tác xuống Supabase ================= */

