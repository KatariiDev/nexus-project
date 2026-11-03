import { useMemo, useState } from 'react';
import { CheckCircle2, XCircle, Inbox, ClipboardList, ShieldCheck } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { PageHeader, EmptyState } from '../../components/ui/feedback';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Field, Textarea } from '../../components/ui/input';
import { Dialog, DialogHeader, DialogBody, DialogFooter } from '../../components/ui/dialog';
import { Tabs } from '../../components/ui/tabs';
import { Avatar } from '../../components/ui/avatar';
import { toast } from '../../components/ui/toast';
import { fmtDate, fmtDateTime, timeAgo } from '../../lib/format';
import type { ProjectRequest, ProjectRequestStatus } from '../../types';
import { priorityLabel, projectRequestTypeLabel, projectStatusLabel } from '../../types';
import { requestName, userName, wsName } from './adminHelpers';

const statusTone: Record<ProjectRequestStatus, 'warning' | 'success' | 'muted'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'muted',
};

const statusLabel: Record<ProjectRequestStatus, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Đã từ chối',
};

export function ApprovalsPage() {
  const { state, dispatch } = useApp();
  const [tab, setTab] = useState<'pending' | 'done'>('pending');
  const [rejectTarget, setRejectTarget] = useState<ProjectRequest | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  // Yêu cầu đang xem chi tiết (bấm vào box) — xem xong mới Duyệt/Từ chối.
  const [selected, setSelected] = useState<ProjectRequest | null>(null);

  // Đơn xin tham gia dự án (`join_project`) do Leader duyệt trong tab Hoạt động,
  // không hiện ở trang Phê duyệt của Admin.
  const pending = useMemo(
    () => state.projectRequests.filter((r) => r.status === 'pending' && r.type !== 'join_project')
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [state.projectRequests],
  );
  const done = useMemo(
    () => state.projectRequests.filter((r) => r.status !== 'pending' && r.type !== 'join_project')
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [state.projectRequests],
  );

  // Dự án + nhiệm vụ của yêu cầu đang xem chi tiết (dùng cho dialog chi tiết).
  const selProject = selected?.projectId
    ? state.projects.find((x) => x.id === selected.projectId)
    : undefined;
  const selTasks = selProject ? state.tasks.filter((t) => t.projectId === selProject.id) : [];
  const selMemberNames = (selected?.payload?.memberIds ?? [])
    .map((id) => userName(state, id))
    .filter((n) => n !== '—');

  const approve = (r: ProjectRequest) => {
    setBusy(true);
    void dispatch({ type: 'PROJECT_REQUEST_REVIEW', id: r.id, approve: true })
      .then((ok) => {
        if (ok) toast('Đã duyệt yêu cầu', requestName(r, state));
      })
      .finally(() => setBusy(false));
  };

  const reject = () => {
    if (!rejectTarget) return;
    setBusy(true);
    void dispatch({ type: 'PROJECT_REQUEST_REVIEW', id: rejectTarget.id, approve: false, note: note.trim() || undefined })
      .then((ok) => {
        if (!ok) return;
        toast('Đã từ chối yêu cầu', requestName(rejectTarget, state));
        setRejectTarget(null);
        setNote('');
      })
      .finally(() => setBusy(false));
  };

  const renderCard = (r: ProjectRequest) => {
    const p = r.projectId ? state.projects.find((x) => x.id === r.projectId) : undefined;
    return (
      <Card key={r.id} className="cursor-pointer transition-shadow hover:shadow-lift" onClick={() => setSelected(r)}>
        <CardContent className="flex flex-col gap-3 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="primary">{projectRequestTypeLabel(r.type)}</Badge>
            <Badge tone={statusTone[r.status]}>{statusLabel[r.status]}</Badge>
            {wsName(state, r.workspaceId) && <Badge tone="info">{wsName(state, r.workspaceId)}</Badge>}
            <span className="ml-auto text-xs text-muted-foreground">{timeAgo(r.createdAt)}</span>
          </div>
          <p className="text-lg font-semibold">{requestName(r, state)}</p>
          {r.type === 'create_project' && r.payload?.description ? (
            <p className="text-sm text-muted-foreground">{String(r.payload.description)}</p>
          ) : null}
          {p && (
            <p className="text-sm text-muted-foreground">
              Mã dự án: <span className="font-mono">{p.code}</span>
            </p>
          )}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Avatar
              name={userName(state, r.requestedBy)}
              avatarUrl={state.users.find((u) => u.id === r.requestedBy)?.avatarUrl}
              size="sm"
            />
            <span>Người yêu cầu: <b className="text-foreground">{userName(state, r.requestedBy)}</b></span>
          </div>
          {r.status !== 'pending' && (
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p>
                {r.status === 'approved' ? 'Đã duyệt' : 'Đã từ chối'} bởi{' '}
                <b>{userName(state, r.reviewedBy)}</b>
                {r.reviewedAt ? ` · ${timeAgo(r.reviewedAt)}` : ''}
              </p>
              {r.reviewNote ? <p className="mt-1 text-muted-foreground">Lý do: {r.reviewNote}</p> : null}
            </div>
          )}
          {r.status === 'pending' && (
            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
              <Button size="sm" onClick={() => approve(r)} disabled={busy}>
                <CheckCircle2 className="h-4 w-4" /> Duyệt
              </Button>
              <Button size="sm" variant="outline" onClick={() => setRejectTarget(r)} disabled={busy}>
                <XCircle className="h-4 w-4" /> Từ chối
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Phê duyệt yêu cầu"
        desc={`${pending.length} yêu cầu đang chờ xử lý`}
      />
      <Tabs
        tabs={[
          { value: 'pending', label: `Chờ duyệt (${pending.length})`, icon: <Inbox className="h-4 w-4" /> },
          { value: 'done', label: `Đã xử lý (${done.length})`, icon: <ClipboardList className="h-4 w-4" /> },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'pending' && pending.length === 0 && (
        <EmptyState icon={<ShieldCheck className="h-6 w-6" />} title="Không có yêu cầu chờ duyệt" desc="Mọi yêu cầu đã được xử lý." />
      )}
      {tab === 'done' && done.length === 0 && (
        <EmptyState icon={<ClipboardList className="h-6 w-6" />} title="Chưa có yêu cầu nào được xử lý" />
      )}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {(tab === 'pending' ? pending : done).map(renderCard)}
      </div>

      <Dialog open={!!rejectTarget} onClose={() => setRejectTarget(null)}>
        <DialogHeader title="Từ chối yêu cầu" desc="Nhập lý do để người yêu cầu hiểu rõ (không bắt buộc)." />
        <DialogBody>
          <Field label="Lý do từ chối">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="VD: Dự án trùng với dự án X đang chạy..." rows={3} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => setRejectTarget(null)}>Hủy</Button>
          <Button variant="destructive" onClick={reject} disabled={busy}>
            {busy ? 'Đang xử lý...' : 'Xác nhận từ chối'}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Dialog xem chi tiết yêu cầu trước khi phê duyệt */}
      <Dialog open={!!selected} onClose={() => setSelected(null)} wide>
        {selected && (
          <>
            <DialogHeader
              title={requestName(selected, state)}
              desc={`${projectRequestTypeLabel(selected.type)} · ${statusLabel[selected.status]}`}
              onClose={() => setSelected(null)}
            />
            <DialogBody>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Người yêu cầu</dt>
                  <dd className="mt-1 flex items-center gap-2 text-sm font-medium">
                    <Avatar
                      name={userName(state, selected.requestedBy)}
                      avatarUrl={state.users.find((u) => u.id === selected.requestedBy)?.avatarUrl}
                      size="sm"
                    />
                    {userName(state, selected.requestedBy)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Thời gian gửi</dt>
                  <dd className="mt-1 text-sm font-medium">{fmtDateTime(selected.createdAt)}</dd>
                </div>
                {wsName(state, selected.workspaceId) && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Workspace</dt>
                    <dd className="mt-1 text-sm font-medium">{wsName(state, selected.workspaceId)}</dd>
                  </div>
                )}
                {selected.type === 'create_project' && (
                  <>
                    {selected.payload.code && (
                      <div>
                        <dt className="text-xs text-muted-foreground">Mã dự án</dt>
                        <dd className="mt-1 font-mono text-sm font-medium">{selected.payload.code}</dd>
                      </div>
                    )}
                    {selected.payload.priority && (
                      <div>
                        <dt className="text-xs text-muted-foreground">Mức ưu tiên</dt>
                        <dd className="mt-1 text-sm font-medium">{priorityLabel(selected.payload.priority)}</dd>
                      </div>
                    )}
                    <div>
                      <dt className="text-xs text-muted-foreground">Ngân sách</dt>
                      <dd className="mt-1 text-sm font-medium">
                        {selected.payload.budget != null
                          ? `${Number(selected.payload.budget).toLocaleString('vi-VN')} coin`
                          : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Ngày bắt đầu</dt>
                      <dd className="mt-1 text-sm font-medium">{fmtDate(selected.payload.startDate)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Ngày kết thúc</dt>
                      <dd className="mt-1 text-sm font-medium">{fmtDate(selected.payload.endDate)}</dd>
                    </div>
                    {selected.payload.managerId && (
                      <div>
                        <dt className="text-xs text-muted-foreground">Chủ dự án</dt>
                        <dd className="mt-1 text-sm font-medium">{userName(state, selected.payload.managerId)}</dd>
                      </div>
                    )}
                    <div className="sm:col-span-2">
                      <dt className="text-xs text-muted-foreground">Thành viên ({selMemberNames.length})</dt>
                      <dd className="mt-1 text-sm font-medium">
                        {selMemberNames.length > 0 ? selMemberNames.join(', ') : '—'}
                      </dd>
                    </div>
                    {selected.payload.description && (
                      <div className="sm:col-span-2">
                        <dt className="text-xs text-muted-foreground">Mô tả</dt>
                        <dd className="mt-1 whitespace-pre-wrap text-sm">{selected.payload.description}</dd>
                      </div>
                    )}
                  </>
                )}
                {selected.type !== 'create_project' && selProject && (
                  <>
                    <div>
                      <dt className="text-xs text-muted-foreground">Mã dự án</dt>
                      <dd className="mt-1 font-mono text-sm font-medium">{selProject.code}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Trạng thái hiện tại</dt>
                      <dd className="mt-1 text-sm font-medium">{projectStatusLabel(selProject.status)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Chủ dự án</dt>
                      <dd className="mt-1 text-sm font-medium">{userName(state, selProject.managerId)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Thành viên</dt>
                      <dd className="mt-1 text-sm font-medium">{selProject.memberIds.length} người</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Nhiệm vụ</dt>
                      <dd className="mt-1 text-sm font-medium">
                        {selTasks.length} nhiệm vụ ({selTasks.filter((t) => t.status === 'done').length} hoàn thành)
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Ngân sách</dt>
                      <dd className="mt-1 text-sm font-medium">
                        {selProject.budget != null
                          ? `${Number(selProject.budget).toLocaleString('vi-VN')} coin`
                          : '—'}
                      </dd>
                    </div>
                  </>
                )}
              </dl>
              {selected.status !== 'pending' && (
                <div className="mt-4 rounded-lg bg-muted p-3 text-sm">
                  <p>
                    {selected.status === 'approved' ? 'Đã duyệt' : 'Đã từ chối'} bởi{' '}
                    <b>{userName(state, selected.reviewedBy)}</b>
                    {selected.reviewedAt ? ` · ${timeAgo(selected.reviewedAt)}` : ''}
                  </p>
                  {selected.reviewNote ? <p className="mt-1 text-muted-foreground">Lý do: {selected.reviewNote}</p> : null}
                </div>
              )}
            </DialogBody>
            <DialogFooter>
              {selected.status === 'pending' ? (
                <>
                  <Button variant="outline" onClick={() => setSelected(null)}>Đóng</Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const r = selected;
                      setSelected(null);
                      setRejectTarget(r);
                    }}
                  >
                    <XCircle className="h-4 w-4" /> Từ chối
                  </Button>
                  <Button
                    onClick={() => {
                      approve(selected);
                      setSelected(null);
                    }}
                    disabled={busy}
                  >
                    <CheckCircle2 className="h-4 w-4" /> Duyệt
                  </Button>
                </>
              ) : (
                <Button variant="outline" onClick={() => setSelected(null)}>Đóng</Button>
              )}
            </DialogFooter>
          </>
        )}
      </Dialog>
    </div>
  );
}
