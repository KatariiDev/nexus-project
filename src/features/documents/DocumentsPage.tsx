import { useMemo, useState } from 'react';
import { FileText, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useApp, userById, projectById } from '../../store/AppContext';
import { PageHeader, EmptyState, ConfirmDialog } from '../../components/ui/feedback';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input, Textarea, Select, Field } from '../../components/ui/input';
import { Dialog, DialogHeader, DialogBody, DialogFooter } from '../../components/ui/dialog';
import { Badge } from '../../components/ui/badge';
import { Avatar } from '../../components/ui/avatar';
import { toast } from '../../components/ui/toast';
import { timeAgo, fmtDate } from '../../lib/format';
import type { Document } from '../../types';

interface FormState {
  mode: 'create' | 'edit';
  doc?: Document;
}

function previewOf(content: string, len = 140): string {
  const oneLine = content.replace(/\s+/g, ' ').trim();
  return oneLine.length > len ? `${oneLine.slice(0, len)}…` : oneLine;
}

export function DocumentsPage() {
  const { state, dispatch } = useApp();
  const [query, setQuery] = useState('');
  const [viewId, setViewId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState('');

  const docs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.documents
      .filter(
        (d) =>
          !q ||
          d.title.toLowerCase().includes(q) ||
          d.content.toLowerCase().includes(q),
      )
      .slice()
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [state.documents, query]);

  const viewing = viewId ? state.documents.find((d) => d.id === viewId) : undefined;
  const deleting = deleteId ? state.documents.find((d) => d.id === deleteId) : undefined;

  function openCreate() {
    setTitle('');
    setProjectId('');
    setContent('');
    setError('');
    setForm({ mode: 'create' });
  }

  function openEdit(doc: Document) {
    setTitle(doc.title);
    setProjectId(doc.projectId ?? '');
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
      dispatch({ type: 'DOC_ADD', title: t, content, projectId: projectId || undefined });
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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Tài liệu"
        desc="Ghi chú, tài liệu dự án và kiến thức dùng chung của nhóm."
        actions={
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4" />
            Tạo tài liệu
          </Button>
        }
      />

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm kiếm tài liệu theo tiêu đề, nội dung…"
          className="pl-9"
        />
      </div>

      {docs.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title={query ? 'Không tìm thấy tài liệu' : 'Chưa có tài liệu nào'}
          desc={query ? 'Hãy thử từ khóa khác.' : 'Tạo tài liệu đầu tiên để lưu trữ kiến thức của nhóm.'}
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
            const project = d.projectId ? projectById(state.projects, d.projectId) : undefined;
            return (
              <Card
                key={d.id}
                className="card-hover cursor-pointer"
                onClick={() => setViewId(d.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setViewId(d.id)}
              >
                <CardContent className="flex h-full flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="flex items-center gap-1">
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
                    {project && (
                      <Badge tone="primary" className="mt-2">
                        {project.name}
                      </Badge>
                    )}
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{previewOf(d.content) || 'Chưa có nội dung.'}</p>
                  </div>
                  <div className="mt-auto flex items-center gap-2 pt-1">
                    <Avatar name={author?.name ?? '?'} size="xs" />
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

      {/* Detail dialog */}
      <Dialog open={!!viewing} onClose={() => setViewId(null)} wide>
        {viewing && (
          <>
            <DialogHeader
              title={viewing.title}
              desc={`Cập nhật ${timeAgo(viewing.updatedAt)} · Tạo ngày ${fmtDate(viewing.createdAt)}`}
              onClose={() => setViewId(null)}
            />
            <DialogBody className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                {viewing.projectId && projectById(state.projects, viewing.projectId) && (
                  <Badge tone="primary">{projectById(state.projects, viewing.projectId)?.name}</Badge>
                )}
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Avatar name={userById(state.users, viewing.authorId)?.name ?? '?'} size="xs" />
                  {userById(state.users, viewing.authorId)?.name ?? 'Không rõ'}
                </span>
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
          desc={form?.mode === 'create' ? 'Tạo ghi chú hoặc tài liệu dùng chung cho nhóm.' : 'Cập nhật tiêu đề, nội dung tài liệu.'}
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
          <Field label="Dự án liên quan">
            <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} disabled={form?.mode === 'edit'}>
              <option value="">Không chọn dự án</option>
              {state.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
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
        desc={`Tài liệu "${deleting?.title ?? ''}" sẽ bị xóa vĩnh viễn. Hành động này không thể hoàn tác.`}
        confirmLabel="Xóa"
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
