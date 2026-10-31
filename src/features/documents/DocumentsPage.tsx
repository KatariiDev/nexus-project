import { useMemo, useRef, useState } from 'react';
import {
  Download, File as FileIcon, FileImage, FileSpreadsheet, FileText, FileVideo,
  Loader2, Pencil, Plus, Search, Trash2, Upload,
} from 'lucide-react';
import { useApp, userById } from '../../store/AppContext';
import { EmptyState, ConfirmDialog } from '../../components/ui/feedback';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input, Textarea, Field } from '../../components/ui/input';
import { Dialog, DialogHeader, DialogBody, DialogFooter } from '../../components/ui/dialog';
import { Avatar } from '../../components/ui/avatar';
import { toast } from '../../components/ui/toast';
import { timeAgo, fmtDate } from '../../lib/format';
import {
  PROJECT_DOC_ACCEPT, PROJECT_DOC_MAX_BYTES,
  getProjectDocumentUrl, uploadProjectDocumentFile,
} from '../../lib/db';
import type { Document } from '../../types';
import { cn } from '../../lib/utils';

interface FormState {
  mode: 'create' | 'edit';
  doc?: Document;
}

function previewOf(content: string, len = 140): string {
  const oneLine = content.replace(/\s+/g, ' ').trim();
  return oneLine.length > len ? `${oneLine.slice(0, len)}…` : oneLine;
}

function formatFileSize(bytes?: number): string {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fileIcon(doc: Document) {
  const type = doc.fileType ?? '';
  const name = (doc.fileName ?? doc.title).toLowerCase();
  if (type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(name)) {
    return <FileImage className="h-5 w-5" />;
  }
  if (type.startsWith('video/') || /\.(mp4|webm|mov|avi|mkv)$/.test(name)) {
    return <FileVideo className="h-5 w-5" />;
  }
  if (/\.(xls|xlsx|csv)$/.test(name)) return <FileSpreadsheet className="h-5 w-5" />;
  if (type === 'application/pdf' || /\.pdf$/.test(name)) return <FileText className="h-5 w-5" />;
  return <FileIcon className="h-5 w-5" />;
}

/** Kiểm tra loại tệp được phép kéo-thả vào tab Tài liệu (ảnh, pdf, xlsx, docx, video). */
function isAllowedDocFile(file: File): boolean {
  if (file.type.startsWith('image/') || file.type.startsWith('video/')) return true;
  if (file.type === 'application/pdf') return true;
  return /\.(docx?|xlsx?|csv)$/i.test(file.name);
}

/**
 * Tab Tài liệu trong chi tiết một dự án (tab Tài liệu chính ngoài sidebar đã bỏ).
 * Gồm tài liệu chữ (tiêu đề + nội dung) và tệp đính kèm kéo-thả
 * (ảnh, pdf, xlsx, docx, video) lưu trong bucket `project-documents`.
 */
export function ProjectDocuments({ projectId }: { projectId: string }) {
  const { state, dispatch } = useApp();
  const [query, setQuery] = useState('');
  const [viewId, setViewId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState('');

  const docs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.documents
      .filter((d) => d.projectId === projectId)
      .filter(
        (d) =>
          !q ||
          d.title.toLowerCase().includes(q) ||
          d.content.toLowerCase().includes(q) ||
          (d.fileName ?? '').toLowerCase().includes(q),
      )
      .slice()
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [state.documents, projectId, query]);

  const viewing = viewId ? state.documents.find((d) => d.id === viewId) : undefined;
  const deleting = deleteId ? state.documents.find((d) => d.id === deleteId) : undefined;

  function openCreate() {
    setTitle('');
    setContent('');
    setError('');
    setForm({ mode: 'create' });
  }

  function openEdit(doc: Document) {
    setTitle(doc.title);
    setContent(doc.content);
    setError('');
    setForm({ mode: 'edit', doc });
  }

  function handleSave() {
    const t = title.trim();
    if (!t) {
      setError('Vui lòng nhập tiêu đề tài liệu.');
      return;
    }
    if (form?.mode === 'create') {
      dispatch({ type: 'DOC_ADD', title: t, content, projectId });
      toast('Đã tạo tài liệu', `Tài liệu "${t}" đã được tạo.`);
    } else if (form?.doc) {
      dispatch({ type: 'DOC_UPDATE', id: form.doc.id, title: t, content });
      toast('Đã cập nhật tài liệu', `Tài liệu "${t}" đã được lưu.`);
    }
    setForm(null);
  }

  function handleDelete() {
    if (!deleting) return;
    dispatch({ type: 'DOC_DELETE', id: deleting.id });
    toast('Đã xóa tài liệu', `Tài liệu "${deleting.title}" đã bị xóa.`);
    if (viewId === deleting.id) setViewId(null);
    setDeleteId(null);
  }

  async function downloadFile(doc: Document) {
    if (!doc.fileUrl) return;
    try {
      const url = await getProjectDocumentUrl(doc.fileUrl);
      window.open(url, '_blank', 'noopener');
    } catch (e) {
      toast('Không tải được tệp', e instanceof Error ? e.message : 'Đã xảy ra lỗi.', 'error');
    }
  }

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    setUploading(true);
    let done = 0;
    for (const file of list) {
      if (!isAllowedDocFile(file)) {
        toast('Loại tệp không hỗ trợ', `"${file.name}" — chỉ nhận ảnh, pdf, xlsx, docx, video.`, 'error');
        continue;
      }
      if (file.size > PROJECT_DOC_MAX_BYTES) {
        toast('Tệp quá lớn', `"${file.name}" vượt quá 20 MB.`, 'error');
        continue;
      }
      try {
        const uploaded = await uploadProjectDocumentFile(state.workspace.id, projectId, file);
        await dispatch({
          type: 'DOC_ADD',
          title: file.name,
          content: '',
          projectId,
          fileUrl: uploaded.path,
          fileName: uploaded.name,
          fileSize: uploaded.size,
          fileType: uploaded.type,
        });
        done += 1;
      } catch (e) {
        toast('Không tải lên được', e instanceof Error ? e.message : `"${file.name}" lỗi.`, 'error');
      }
    }
    setUploading(false);
    if (done > 0) toast('Đã tải lên tài liệu', `${done} tệp đã được thêm vào dự án.`);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Vùng kéo-thả tệp */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void uploadFiles(e.dataTransfer.files);
        }}
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors',
          dragOver ? 'border-primary bg-primary/5' : 'border-input bg-card',
        )}
      >
        <Upload className="h-6 w-6 text-muted-foreground" />
        <p className="text-sm font-medium">Kéo-thả tệp vào đây để tải lên</p>
        <p className="text-xs text-muted-foreground">Ảnh, PDF, Word (.doc/.docx), Excel (.xls/.xlsx), video — tối đa 20 MB/tệp</p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={PROJECT_DOC_ACCEPT.join(',')}
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void uploadFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <Button size="sm" variant="outline" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Đang tải lên...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" /> Chọn tệp từ máy
            </>
          )}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm kiếm tài liệu theo tiêu đề, nội dung…"
            className="pl-9"
          />
        </div>
        <Button onClick={openCreate} size="sm" className="ml-auto">
          <Plus className="h-4 w-4" />
          Tạo tài liệu chữ
        </Button>
      </div>

      {docs.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title={query ? 'Không tìm thấy tài liệu' : 'Chưa có tài liệu nào'}
          desc={query ? 'Hãy thử từ khóa khác.' : 'Kéo-thả tệp vào khung phía trên hoặc tạo tài liệu chữ đầu tiên cho dự án.'}
          action={
            !query ? (
              <Button onClick={openCreate} size="sm">
                <Plus className="h-4 w-4" />
                Tạo tài liệu
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {docs.map((d) => {
            const author = userById(state.users, d.authorId);
            const isFile = Boolean(d.fileUrl);
            return (
              <Card
                key={d.id}
                className="card-hover cursor-pointer"
                onClick={() => (isFile ? void downloadFile(d) : setViewId(d.id))}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (isFile) void downloadFile(d);
                    else setViewId(d.id);
                  }
                }}
              >
                <CardContent className="flex h-full flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      {isFile ? fileIcon(d) : <FileText className="h-5 w-5" />}
                    </div>
                    <div className="flex items-center gap-1">
                      {isFile ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label="Tải xuống"
                          onClick={(e) => {
                            e.stopPropagation();
                            void downloadFile(d);
                          }}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label="Sửa tài liệu"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(d);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        aria-label="Xóa tài liệu"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteId(d.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <h3 className="line-clamp-2 font-semibold leading-snug">{d.title}</h3>
                    {isFile ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {formatFileSize(d.fileSize)}
                        {d.fileType ? ` · ${d.fileType.split('/').pop()}` : ''}
                      </p>
                    ) : (
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{previewOf(d.content) || 'Chưa có nội dung.'}</p>
                    )}
                  </div>
                  <div className="mt-auto flex items-center gap-2 pt-1">
                    <Avatar name={author?.name ?? '?'} avatarUrl={author?.avatarUrl} size="xs" />
                    <p className="truncate text-xs text-muted-foreground">
                      {author?.name ?? 'Không rõ'} · {timeAgo(d.updatedAt)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail dialog (chỉ cho tài liệu chữ) */}
      <Dialog open={!!viewing && !viewing.fileUrl} onClose={() => setViewId(null)} wide>
        {viewing && !viewing.fileUrl && (
          <>
            <DialogHeader
              title={viewing.title}
              desc={`Cập nhật ${timeAgo(viewing.updatedAt)} · Tạo ngày ${fmtDate(viewing.createdAt)}`}
              onClose={() => setViewId(null)}
            />
            <DialogBody className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                {(() => {
                  const viewingAuthor = userById(state.users, viewing.authorId);
                  return (
                    <span className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Avatar name={viewingAuthor?.name ?? '?'} avatarUrl={viewingAuthor?.avatarUrl} size="xs" />
                      {viewingAuthor?.name ?? 'Không rõ'}
                    </span>
                  );
                })()}
              </div>
              <div className="whitespace-pre-line rounded-lg border bg-muted/40 p-4 text-sm leading-relaxed">
                {viewing.content || 'Chưa có nội dung.'}
              </div>
            </DialogBody>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteId(viewing.id);
                }}
              >
                <Trash2 className="h-4 w-4" />
                Xóa
              </Button>
              <Button
                onClick={() => {
                  setViewId(null);
                  openEdit(viewing);
                }}
              >
                <Pencil className="h-4 w-4" />
                Sửa
              </Button>
            </DialogFooter>
          </>
        )}
      </Dialog>

      {/* Create / Edit form dialog */}
      <Dialog open={!!form} onClose={() => setForm(null)} wide>
        <DialogHeader
          title={form?.mode === 'create' ? 'Tạo tài liệu mới' : 'Sửa tài liệu'}
          desc={form?.mode === 'create' ? 'Tạo ghi chú hoặc tài liệu dùng chung cho dự án này.' : 'Cập nhật tiêu đề, nội dung tài liệu.'}
          onClose={() => setForm(null)}
        />
        <DialogBody className="flex flex-col gap-4">
          <Field label="Tiêu đề" error={error}>
            <Input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (error) setError('');
              }}
              placeholder="Nhập tiêu đề tài liệu…"
              autoFocus
            />
          </Field>
          <Field label="Nội dung">
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Viết nội dung tài liệu…" rows={10} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => setForm(null)}>
            Hủy
          </Button>
          <Button onClick={handleSave}>{form?.mode === 'create' ? 'Tạo tài liệu' : 'Lưu thay đổi'}</Button>
        </DialogFooter>
      </Dialog>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleting}
        title="Xóa tài liệu?"
        desc={`Tài liệu "${deleting?.title ?? ''}" sẽ bị xóa vĩnh viễn${deleting?.fileUrl ? ' (kèm tệp đính kèm)' : ''}. Hành động này không thể hoàn tác.`}
        confirmLabel="Xóa"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
