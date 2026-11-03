import type { Action, AppState, RichAction } from '../../store/AppContext';
import type { ActivityLog, Document, Project, ProjectRequest, User } from '../../types';
import { DEFAULT_INVITE_EXPIRY_DAYS, DEFAULT_PROJECT_COLOR } from '../../types';
import type { DbProfile, Sb } from './mappers';
import { mapUser } from './mappers';
import { PROJECT_DOCS_BUCKET } from './documents';
import type { PersistContext } from './persist-helpers';
import {
  buildLog,
  freshRoleUserIds,
  insertLog,
  isConflict,
  notifyAssignees,
  notifyDeclined,
  notifyReview,
  requestTitle,
  syncJoin,
  throwDb,
  toProjectRow,
  toTaskRow,
} from './persist-helpers';
import { newId } from '../utils';

/**
 * Ghi một action xuống Supabase, trả về action đã làm giàu để reducer áp dụng.
 * Ném lỗi khi ghi thất bại — caller sẽ báo lỗi và KHÔNG cập nhật state cục bộ.
 */
export async function persistAction(
  sb: Sb,
  ctx: PersistContext,
  state: AppState,
  action: Action,
): Promise<RichAction> {
  switch (action.type) {
    case 'SET_THEME':
    case 'TOGGLE_SIDEBAR':
      return action;

    case 'PROJECT_ADD': {
      const { error } = await sb.from('projects').insert(toProjectRow(action.project, ctx.workspaceId));
      if (error) throwDb(error, 'Không tạo được dự án.');
      await syncJoin(sb, 'project_members', 'project_id', action.project.id, 'user_id', [], action.project.memberIds);
      const log = buildLog(ctx, 'đã tạo', 'project', action.project.id, action.project.name);
      await insertLog(sb, ctx, log);
      return { ...action, log };
    }

    case 'PROJECT_UPDATE': {
      const prev = state.projects.find((p) => p.id === action.project.id);
      const { error } = await sb.from('projects').update(toProjectRow(action.project, ctx.workspaceId)).eq('id', action.project.id);
      if (error) throwDb(error, 'Không cập nhật được dự án.');
      await syncJoin(sb, 'project_members', 'project_id', action.project.id, 'user_id', prev?.memberIds ?? [], action.project.memberIds);
      const log = buildLog(ctx, 'đã cập nhật', 'project', action.project.id, action.project.name);
      await insertLog(sb, ctx, log);
      return { ...action, log };
    }

    case 'PROJECT_DELETE': {
      const { error } = await sb.from('projects').delete().eq('id', action.id);
      if (error) throwDb(error, 'Không xóa được dự án.');
      return action;
    }

    case 'PROJECT_REQUEST_CREATE': {
      const r = action.request;
      const { error } = await sb.from('project_requests').insert({
        id: r.id,
        workspace_id: ctx.workspaceId,
        type: r.type,
        project_id: r.projectId ?? null,
        payload: r.payload as Record<string, unknown>,
        status: 'pending',
        requested_by: ctx.userId,
      });
      if (error) throwDb(error, 'Không gửi được yêu cầu.');
      const log = buildLog(ctx, 'đã gửi yêu cầu', 'project', r.projectId ?? r.id, requestTitle(r));
      await insertLog(sb, ctx, log);
      const adminIds = (await freshRoleUserIds(sb, ctx.workspaceId, ['admin'])).filter((id) => id !== ctx.userId);
      if (adminIds.length > 0) {
        const rows = adminIds.map((userId) => ({
          id: newId(),
          user_id: userId,
          kind: 'project',
          title: 'Yêu cầu mới cần phê duyệt',
          body: `${ctx.userName} đã gửi yêu cầu "${requestTitle(r)}".`,
          link: '/admin/approvals',
        }));
        const { error: nErr } = await sb.from('notifications').insert(rows);
        if (nErr) throw nErr;
      }
      return { ...action, log };
    }

    case 'PROJECT_INVITE_MEMBER': {
      const project = state.projects.find((p) => p.id === action.projectId);
      if (!project) throwDb(new Error('not found'), 'Không tìm thấy dự án.');
      const expiryDays = state.workspace.inviteExpiryDays ?? DEFAULT_INVITE_EXPIRY_DAYS;
      const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString();
      const now = new Date().toISOString();
      // Lọc bỏ người đã là thành viên hoặc đang có lời mời chờ xử lý.
      const pendingInviteeIds = new Set(
        state.projectRequests
          .filter((r) => r.type === 'invite_member' && r.projectId === project.id && r.status === 'pending')
          .map((r) => r.payload.invitee_id)
          .filter((id): id is string => typeof id === 'string'),
      );
      const inviteeIds = [...new Set(action.inviteeIds)].filter(
        (id) => !project.memberIds.includes(id) && id !== project.managerId && !pendingInviteeIds.has(id),
      );
      if (inviteeIds.length === 0) throw new Error('Không còn ai để mời (đã là thành viên hoặc đang chờ chấp nhận).');
      const requests: ProjectRequest[] = inviteeIds.map((inviteeId) => ({
        id: newId(),
        workspaceId: ctx.workspaceId,
        type: 'invite_member' as const,
        projectId: project.id,
        payload: { invitee_id: inviteeId, expires_at: expiresAt },
        status: 'pending' as const,
        requestedBy: ctx.userId,
        createdAt: now,
      }));
      const { error: rErr } = await sb.from('project_requests').insert(
        requests.map((r) => ({
          id: r.id,
          workspace_id: ctx.workspaceId,
          type: 'invite_member',
          project_id: project.id,
          payload: { invitee_id: r.payload.invitee_id, expires_at: expiresAt },
          status: 'pending',
          requested_by: ctx.userId,
        })),
      );
      if (rErr) throwDb(rErr, 'Không gửi được lời mời. Hãy kiểm tra đã chạy file SQL nexus-project-invites-db.sql chưa.');
      const { error: nErr } = await sb.from('notifications').insert(
        inviteeIds.map((inviteeId) => ({
          id: newId(),
          user_id: inviteeId,
          kind: 'invite',
          title: 'Bạn được mời vào dự án',
          body: `${ctx.userName} mời bạn vào dự án "${project.name}". Lời mời hết hạn sau ${expiryDays} ngày.`,
          link: `/user/projects/${project.id}`,
        })),
      );
      if (nErr) throwDb(nErr, 'Không gửi được thông báo mời. Hãy kiểm tra đã chạy file SQL nexus-project-invites-db.sql chưa.');
      return { ...action, requests };
    }

    case 'PROJECT_INVITE_CANCEL': {
      const req = state.projectRequests.find((x) => x.id === action.id);
      if (!req) throwDb(new Error('not found'), 'Không tìm thấy lời mời.');
      if (req.type !== 'invite_member') throw new Error('Đây không phải lời mời vào dự án.');
      if (req.status !== 'pending') throwDb(new Error('already reviewed'), 'Lời mời đã được xử lý trước đó.');
      const { error } = await sb.from('project_requests').delete().eq('id', action.id);
      if (error) throwDb(error, 'Không hủy được lời mời.');
      const proj = req.projectId ? state.projects.find((p) => p.id === req.projectId) : undefined;
      const invitee = state.users.find((u) => u.id === req.payload.invitee_id);
      const log = buildLog(ctx, `đã hủy lời mời ${invitee?.name ?? 'thành viên'} vào dự án`, 'project', proj?.id ?? req.id, proj?.name ?? '');
      await insertLog(sb, ctx, log);
      return { ...action, log };
    }

    case 'WORKSPACE_UPDATE_SETTINGS': {
      const { error } = await sb
        .from('workspaces')
        .update({ invite_expiry_days: action.inviteExpiryDays })
        .eq('id', ctx.workspaceId);
      if (error) throwDb(error, 'Không lưu được cấu hình. Hãy kiểm tra đã chạy file SQL nexus-project-invites-db.sql chưa.');
      return action;
    }

    case 'PROJECT_REQUEST_REVIEW': {
      const req = state.projectRequests.find((x) => x.id === action.id);
      if (!req) throwDb(new Error('not found'), 'Không tìm thấy yêu cầu.');
      if (req.status !== 'pending') throwDb(new Error('already reviewed'), 'Yêu cầu đã được xử lý trước đó.');
      const reqProject = req.projectId ? state.projects.find((x) => x.id === req.projectId) : undefined;
      const title = requestTitle(req, reqProject?.name);
      const now = new Date().toISOString();
      const status = action.approve ? 'approved' : 'rejected';

      // Yêu cầu tạo dự án: tạo dự án TRƯỚC khi đổi trạng thái đơn.
      // Trước đây đổi trạng thái trước nên tạo lỗi thì đơn kẹt ở "approved"
      // mà không có dự án, cũng không duyệt lại được (vd: ngân sách vượt
      // quá giới hạn cột numeric(14,2) của DB).
      let createdProject: Project | undefined;
      if (action.approve && req.type === 'create_project') {
        const p = req.payload as Partial<Project>;
        // Phòng đơn cũ gửi trước khi form có validate: ngân sách tối đa 10.000 coin.
        if (typeof p.budget === 'number' && p.budget > 10000) {
          throw new Error('Ngân sách tối đa 10.000 coin');
        }
        const project: Project = {
          id: newId(),
          code: String(p.code ?? ''),
          name: String(p.name ?? 'Dự án mới'),
          description: String(p.description ?? ''),
          status: 'planning',
          priority: (p.priority as Project['priority']) ?? 'medium',
          startDate: String(p.startDate ?? now.slice(0, 10)),
          endDate: String(p.endDate ?? now.slice(0, 10)),
          managerId: String(p.managerId || req.requestedBy || ctx.userId),
          memberIds: Array.from(
            new Set([
              ...(Array.isArray(p.memberIds) ? (p.memberIds as string[]) : []),
              String(p.managerId || req.requestedBy || ctx.userId),
              req.requestedBy,
            ]),
          ),
          budget: typeof p.budget === 'number' ? p.budget : undefined,
          color: String(p.color ?? DEFAULT_PROJECT_COLOR),
          createdAt: now,
          updatedAt: now,
        };
        const { error: cErr } = await sb.from('projects').insert(toProjectRow(project, ctx.workspaceId));
        if (cErr) {
          // Tạo lỗi: đơn vẫn ở "pending" để duyệt lại được, rồi mới báo lỗi.
          await sb.from('project_requests').update({ status: 'pending' }).eq('id', action.id);
          throwDb(cErr, 'Không tạo được dự án.');
        }
        await syncJoin(sb, 'project_members', 'project_id', project.id, 'user_id', [], project.memberIds);
        createdProject = project;
      }

      // Lời mời vào dự án: người được mời tự chấp nhận — họ không sửa được
      // bảng projects/project_members theo RLS nên gọi hàm security definer
      // accept_project_invite (chỉ chèn vào project_members). Làm TRƯỚC khi
      // đổi trạng thái đơn để lỗi thì đơn vẫn ở "pending", duyệt lại được.
      if (action.approve && req.type === 'invite_member') {
        const expiresAt = req.payload.expires_at;
        if (!expiresAt || new Date(expiresAt).getTime() <= Date.now()) {
          throw new Error('Lời mời đã hết hạn. Hãy nhờ Leader hoặc Admin mời lại.');
        }
        const { error: rpcErr } = await sb.rpc('accept_project_invite', { p_request_id: req.id });
        if (rpcErr) throwDb(rpcErr, 'Không chấp nhận được lời mời. Hãy kiểm tra đã chạy file SQL nexus-project-invites-db.sql chưa.');
      }

      const { error } = await sb
        .from('project_requests')
        .update({ status, reviewed_by: ctx.userId, review_note: action.note ?? null, reviewed_at: now })
        .eq('id', action.id);
      if (error) throwDb(error, 'Không cập nhật được yêu cầu.');

      // Thi hành yêu cầu khi được duyệt.
      let executedLog: ActivityLog | undefined;
      let reviewedProject: Project | undefined;
      let deletedProjectId: string | undefined;
      if (action.approve) {
        if (req.type === 'create_project') {
          // Dự án đã được tạo trước khi đổi trạng thái đơn (xem phía trên);
          // ở đây chỉ ghi log hoạt động.
          reviewedProject = createdProject;
          if (reviewedProject) {
            executedLog = buildLog(ctx, 'đã duyệt yêu cầu tạo', 'project', reviewedProject.id, reviewedProject.name);
            await insertLog(sb, ctx, executedLog);
          }
        } else if (req.type === 'pause_project' && req.projectId) {
          const proj = state.projects.find((x) => x.id === req.projectId);
          if (proj) {
            const updated = { ...proj, status: 'paused' as const, updatedAt: now };
            const { error: uErr } = await sb.from('projects').update(toProjectRow(updated, ctx.workspaceId)).eq('id', proj.id);
            if (uErr) throwDb(uErr, 'Không tạm dừng được dự án.');
            reviewedProject = updated;
            executedLog = buildLog(ctx, 'đã duyệt yêu cầu tạm dừng', 'project', proj.id, proj.name);
            await insertLog(sb, ctx, executedLog);
          }
        } else if (req.type === 'delete_project' && req.projectId) {
          const proj = state.projects.find((x) => x.id === req.projectId);
          const { error: dErr } = await sb.from('projects').delete().eq('id', req.projectId);
          if (dErr) throwDb(dErr, 'Không xóa được dự án.');
          deletedProjectId = req.projectId;
          if (proj) {
            executedLog = buildLog(ctx, 'đã duyệt yêu cầu xóa', 'project', proj.id, proj.name);
            await insertLog(sb, ctx, executedLog);
          }
        } else if (req.type === 'join_project' && req.projectId) {
          // Leader duyệt đơn xin tham gia: thêm người xin vào dự án.
          const proj = state.projects.find((x) => x.id === req.projectId);
          if (proj && !proj.memberIds.includes(req.requestedBy)) {
            const updated = { ...proj, memberIds: [...proj.memberIds, req.requestedBy], updatedAt: now };
            const { error: uErr } = await sb.from('projects').update(toProjectRow(updated, ctx.workspaceId)).eq('id', proj.id);
            if (uErr) throwDb(uErr, 'Không thêm được thành viên vào dự án.');
            await syncJoin(sb, 'project_members', 'project_id', proj.id, 'user_id', proj.memberIds, updated.memberIds);
            reviewedProject = updated;
            const requester = state.users.find((u) => u.id === req.requestedBy);
            executedLog = buildLog(ctx, `đã cho phép ${requester?.name ?? 'thành viên mới'} tham gia`, 'project', proj.id, proj.name);
            await insertLog(sb, ctx, executedLog);
          }
        } else if (req.type === 'invite_member' && req.projectId) {
          // Người được mời đã vào dự án qua hàm accept_project_invite (xem phía trên);
          // ở đây chỉ cập nhật state + ghi log.
          const proj = state.projects.find((x) => x.id === req.projectId);
          const inviteeId = req.payload.invitee_id;
          if (proj && typeof inviteeId === 'string' && !proj.memberIds.includes(inviteeId)) {
            reviewedProject = { ...proj, memberIds: [...proj.memberIds, inviteeId], updatedAt: now };
            executedLog = buildLog(ctx, 'đã chấp nhận lời mời tham gia', 'project', proj.id, proj.name);
            await insertLog(sb, ctx, executedLog);
          }
        }
      }

      // Từ chối đơn xin tham gia: ghi lại vào Hoạt động của dự án.
      if (!action.approve && req.type === 'join_project' && req.projectId) {
        const proj = state.projects.find((x) => x.id === req.projectId);
        if (proj) {
          const requester = state.users.find((u) => u.id === req.requestedBy);
          executedLog = buildLog(ctx, `đã từ chối ${requester?.name ?? 'thành viên mới'} tham gia`, 'project', proj.id, proj.name);
          await insertLog(sb, ctx, executedLog);
        }
      }

      // Từ chối lời mời vào dự án: ghi lại vào Hoạt động của dự án.
      if (!action.approve && req.type === 'invite_member' && req.projectId) {
        const proj = state.projects.find((x) => x.id === req.projectId);
        if (proj) {
          executedLog = buildLog(ctx, 'đã từ chối lời mời tham gia', 'project', proj.id, proj.name);
          await insertLog(sb, ctx, executedLog);
        }
      }

      // Báo kết quả cho người yêu cầu.
      if (req.requestedBy !== ctx.userId) {
        const verb = action.approve ? 'đã được duyệt' : 'đã bị từ chối';
        // Link tới chi tiết dự án khi dự án còn tồn tại sau khi xử lý
        // (tạo/tạm dừng được duyệt, hoặc tạm dừng/xóa bị từ chối);
        // còn không (tạo bị từ chối / xóa đã duyệt) thì về danh sách dự án.
        const detailProjectId =
          reviewedProject?.id ?? (action.approve ? undefined : req.projectId);
        const { error: nErr } = await sb.from('notifications').insert({
          id: newId(),
          user_id: req.requestedBy,
          kind: 'project',
          title: `Yêu cầu ${verb}`,
          body: `Yêu cầu "${title}" của bạn ${verb}${action.note ? `: ${action.note}` : '.'}`,
          link: detailProjectId ? `/user/projects/${detailProjectId}` : '/user/projects',
        });
        if (nErr) throw nErr;
      }
      const reviewed: ProjectRequest = {
        ...req, status, reviewedBy: ctx.userId,
        reviewNote: action.note ?? undefined, reviewedAt: now,
      };
      return { ...action, request: reviewed, log: executedLog, project: reviewedProject, projectDeletedId: deletedProjectId };
    }

    case 'TASK_ADD': {
      // Đồng hồ 12h tự động nhận bắt đầu từ lúc giao.
      const task = action.task.assigneeIds.length > 0
        ? { ...action.task, assignedAt: new Date().toISOString() }
        : action.task;
      const { error } = await sb.from('tasks').insert(toTaskRow(task));
      if (error) throwDb(error, 'Không tạo được nhiệm vụ.');
      await syncJoin(sb, 'task_assignees', 'task_id', task.id, 'user_id', [], task.assigneeIds);
      await syncJoin(sb, 'task_watchers', 'task_id', task.id, 'user_id', [], task.watcherIds);
      await syncJoin(sb, 'task_labels', 'task_id', task.id, 'label_id', [], task.labelIds);
      const log = buildLog(ctx, 'đã tạo', 'task', task.id, task.title);
      await insertLog(sb, ctx, log);
      await notifyAssignees(sb, ctx, task, task.assigneeIds);
      return { ...action, task, log };
    }

    case 'TASK_UPDATE': {
      const prev = state.tasks.find((t) => t.id === action.task.id);
      const statusChanged = prev && prev.status !== action.task.status;
      const assigneesChanged =
        prev && [...action.task.assigneeIds].sort().join() !== [...prev.assigneeIds].sort().join();
      let completedAt = action.task.completedAt;
      if (statusChanged) {
        completedAt = action.task.status === 'done' ? new Date().toISOString() : undefined;
      }
      let task = { ...action.task, completedAt };
      // Đổi người thực hiện: reset đồng hồ 12h + xóa thông tin từ chối cũ.
      // Task rời khỏi 'todo' (bắt đầu làm / gửi duyệt / hoàn thành): từ chối không còn ý nghĩa.
      if (assigneesChanged) {
        task = { ...task, assignedAt: new Date().toISOString(), declinedBy: undefined, declinedReason: undefined, declinedAt: undefined };
      } else if (statusChanged && task.status !== 'todo') {
        task = { ...task, declinedBy: undefined, declinedReason: undefined, declinedAt: undefined };
      }
      const { error } = await sb.from('tasks').update(toTaskRow(task)).eq('id', task.id);
      if (error) throwDb(error, 'Không cập nhật được nhiệm vụ.');
      await syncJoin(sb, 'task_assignees', 'task_id', task.id, 'user_id', prev?.assigneeIds ?? [], task.assigneeIds);
      await syncJoin(sb, 'task_watchers', 'task_id', task.id, 'user_id', prev?.watcherIds ?? [], task.watcherIds);
      await syncJoin(sb, 'task_labels', 'task_id', task.id, 'label_id', prev?.labelIds ?? [], task.labelIds);
      // Chỉ ghi log cho sự kiện đáng chú ý (đổi trạng thái / đổi người thực hiện), tránh spam.
      let log: ActivityLog | undefined;
      if (statusChanged || assigneesChanged) {
        log = buildLog(ctx, statusChanged ? 'đã chuyển trạng thái' : 'đã cập nhật người thực hiện', 'task', task.id, task.title);
        await insertLog(sb, ctx, log);
      }
      if (prev) {
        const added = task.assigneeIds.filter((id) => !prev.assigneeIds.includes(id));
        await notifyAssignees(sb, ctx, task, added);
      }
      if (statusChanged) {
        const wasReview = prev?.status === 'in_review';
        const leaderId = state.projects.find((p) => p.id === task.projectId)?.managerId;
        if (!wasReview && task.status === 'in_review') {
          await notifyReview(sb, ctx, task, 'requested', leaderId);
        } else if (wasReview && task.status === 'done') {
          await notifyReview(sb, ctx, task, 'approved');
        } else if (wasReview) {
          await notifyReview(sb, ctx, task, 'rejected');
        }
      }
      return { ...action, task, log };
    }

    case 'TASK_MOVE': {
      const task = state.tasks.find((t) => t.id === action.id);
      if (!task) return action;
      const wasReview = task.status === 'in_review';
      const completedAt = action.status === 'done' ? new Date().toISOString() : null;
      // Task rời khỏi 'todo' (nhận làm / gửi duyệt / hoàn thành): từ chối không còn ý nghĩa.
      const clearDecline = action.status !== 'todo'
        ? { declined_by: null, declined_reason: null, declined_at: null }
        : {};
      const { error } = await sb.from('tasks').update({ status: action.status, completed_at: completedAt, ...clearDecline }).eq('id', action.id);
      if (error) throwDb(error, 'Không chuyển trạng thái được.');
      const log = buildLog(ctx, 'đã chuyển trạng thái', 'task', task.id, task.title);
      await insertLog(sb, ctx, log);
      if (!wasReview && action.status === 'in_review') {
        const leaderId = state.projects.find((p) => p.id === task.projectId)?.managerId;
        await notifyReview(sb, ctx, task, 'requested', leaderId);
      } else if (wasReview && action.status === 'done') {
        await notifyReview(sb, ctx, task, 'approved');
      } else if (wasReview) {
        await notifyReview(sb, ctx, task, 'rejected');
      }
      return { ...action, log };
    }

    case 'TASK_DECLINE': {
      const task = state.tasks.find((t) => t.id === action.id);
      if (!task) return action;
      const declinedAt = new Date().toISOString();
      const { error } = await sb.from('tasks').update({
        declined_by: ctx.userId,
        declined_reason: action.reason,
        declined_at: declinedAt,
      }).eq('id', action.id);
      if (error) throwDb(error, 'Không gửi được từ chối.');
      const log = buildLog(ctx, 'đã từ chối nhận', 'task', task.id, task.title);
      await insertLog(sb, ctx, log);
      const leaderId = state.projects.find((p) => p.id === task.projectId)?.managerId;
      await notifyDeclined(sb, ctx, task, action.reason, leaderId);
      return { ...action, log };
    }

    case 'TASK_AUTO_ACCEPT': {
      const task = state.tasks.find((t) => t.id === action.id);
      if (!task) return action;
      // Chỉ đổi trạng thái + log riêng; không gửi thông báo (theo kế hoạch đã duyệt).
      const { error } = await sb.from('tasks').update({
        status: 'in_progress',
        completed_at: null,
        declined_by: null,
        declined_reason: null,
        declined_at: null,
      }).eq('id', action.id);
      if (error) throwDb(error, 'Không tự động xác nhận được nhiệm vụ.');
      const log = buildLog(ctx, 'đã được hệ thống tự động xác nhận thực hiện (quá 12h không phản hồi)', 'task', task.id, task.title);
      await insertLog(sb, ctx, log);
      return { ...action, log };
    }

    case 'TASK_DELETE': {
      const { error } = await sb.from('tasks').delete().eq('id', action.id);
      if (error) throwDb(error, 'Không xóa được nhiệm vụ.');
      return action;
    }

    case 'CHECKLIST_TOGGLE': {
      const item = state.checklists.find((c) => c.id === action.id);
      if (!item) return action;
      const { error } = await sb.from('task_checklists').update({ done: !item.done }).eq('id', action.id);
      if (error) throwDb(error, 'Không cập nhật được checklist.');
      return action;
    }

    case 'CHECKLIST_ADD': {
      const { error } = await sb.from('task_checklists').insert({
        id: action.id, task_id: action.taskId, title: action.title, done: false,
      });
      if (error) throwDb(error, 'Không thêm được mục checklist.');
      return action;
    }

    case 'CHECKLIST_DELETE': {
      const { error } = await sb.from('task_checklists').delete().eq('id', action.id);
      if (error) throwDb(error, 'Không xóa được mục checklist.');
      return action;
    }

    case 'COMMENT_ADD': {
      const { error } = await sb.from('task_comments').insert({
        id: action.id, task_id: action.taskId, author_id: ctx.userId, body: action.body,
      });
      if (error) throwDb(error, 'Không gửi được bình luận.');
      const task = state.tasks.find((t) => t.id === action.taskId);
      const log = buildLog(ctx, 'đã bình luận trong', 'task', action.taskId, task?.title ?? '');
      await insertLog(sb, ctx, log);
      return { ...action, log };
    }

    case 'COMMENT_DELETE': {
      const { error } = await sb.from('task_comments').delete().eq('id', action.id);
      if (error) throwDb(error, 'Không xóa được bình luận.');
      return action;
    }

    case 'DEPENDENCY_ADD': {
      const { error } = await sb.from('task_dependencies').insert({
        id: action.id, task_id: action.taskId, depends_on_id: action.dependsOnId,
      });
      if (error) {
        if (isConflict(error)) throw new Error('Phụ thuộc này đã tồn tại.');
        throwDb(error, 'Không thêm được phụ thuộc.');
      }
      return action;
    }

    case 'DEPENDENCY_DELETE': {
      const { error } = await sb.from('task_dependencies').delete().eq('id', action.id);
      if (error) throwDb(error, 'Không gỡ được phụ thuộc.');
      return action;
    }

    case 'NOTIF_READ': {
      const { error } = await sb.from('notifications').update({ read: true }).eq('id', action.id).eq('user_id', ctx.userId);
      if (error) throwDb(error, 'Không đánh dấu được thông báo.');
      return action;
    }

    case 'NOTIF_READ_ALL': {
      const { error } = await sb.from('notifications').update({ read: true }).eq('user_id', ctx.userId).eq('read', false);
      if (error) throwDb(error, 'Không đánh dấu được thông báo.');
      return action;
    }

    case 'USER_ADD': {
      // Thêm thành viên đã có tài khoản Nexus vào workspace bằng email.
      const cleanInput = action.email.trim().toLowerCase();
      const { data: profile, error: findErr } = await sb
        .from('profiles')
        .select('id, name, email, username, title, avatar_url')
        .ilike('email', cleanInput)
        .maybeSingle();
      if (findErr) throwDb(findErr, 'Không tìm được thành viên.');
      if (!profile) throw new Error(`Email ${action.email} chưa đăng ký tài khoản Nexus. Người này cần đăng ký trước.`);
      if (profile.id === ctx.userId) throw new Error('Đây là tài khoản của chính bạn.');
      const { error: insErr } = await sb.from('workspace_members').insert({
        workspace_id: ctx.workspaceId, user_id: profile.id, role: action.role,
      });
      if (insErr) {
        if (isConflict(insErr)) throw new Error('Thành viên này đã có trong workspace.');
        throwDb(insErr, 'Không thêm được thành viên.');
      }
      const p = profile as DbProfile;
      const user: User = mapUser(p, action.role);
      user.workload = 0;
      return { ...action, user };
    }

    case 'USER_UPDATE_ROLE': {
      const { error } = await sb.from('workspace_members')
        .update({ role: action.role })
        .eq('workspace_id', ctx.workspaceId)
        .eq('user_id', action.id);
      if (error) throwDb(error, 'Không đổi được vai trò.');
      return action;
    }

    case 'USER_UPDATE_PROFILE': {
      const { error } = await sb.from('profiles')
        .update({ name: action.name, title: action.title })
        .eq('id', action.id);
      if (error) throwDb(error, 'Không cập nhật được hồ sơ.');
      return action;
    }

    case 'WORKSPACE_UPDATE': {
      const { error } = await sb.from('workspaces')
        .update({ name: action.name, timezone: action.timezone })
        .eq('id', ctx.workspaceId);
      if (error) throwDb(error, 'Không cập nhật được workspace.');
      return action;
    }

    case 'DOC_ADD': {
      const doc: Document = {
        id: newId(),
        title: action.title,
        content: action.content,
        projectId: action.projectId,
        authorId: ctx.userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        fileUrl: action.fileUrl,
        fileName: action.fileName,
        fileSize: action.fileSize,
        fileType: action.fileType,
      };
      const row: Record<string, unknown> = {
        id: doc.id,
        workspace_id: ctx.workspaceId,
        project_id: doc.projectId ?? null,
        title: doc.title,
        content: doc.content,
        author_id: doc.authorId,
      };
      // Chỉ gửi kèm các cột file khi có tệp đính kèm — tài liệu chữ vẫn tạo được
      // ngay cả khi user chưa chạy SQL thêm cột file_* (nexus-part1-db.sql).
      if (doc.fileUrl) {
        row.file_url = doc.fileUrl;
        row.file_name = doc.fileName ?? null;
        row.file_size = doc.fileSize ?? null;
        row.file_type = doc.fileType ?? null;
      }
      const { error } = await sb.from('documents').insert(row);
      if (error) throwDb(error, 'Không tạo được tài liệu.');
      return { ...action, doc };
    }

    case 'DOC_UPDATE': {
      const { error } = await sb.from('documents')
        .update({ title: action.title, content: action.content })
        .eq('id', action.id);
      if (error) throwDb(error, 'Không cập nhật được tài liệu.');
      return action;
    }

    case 'DOC_DELETE': {
      const doc = state.documents.find((d) => d.id === action.id);
      const { error } = await sb.from('documents').delete().eq('id', action.id);
      if (error) throwDb(error, 'Không xóa được tài liệu.');
      // Xóa luôn file trong Storage nếu tài liệu có tệp đính kèm (lỗi thì bỏ qua).
      if (doc?.fileUrl) {
        await sb.storage.from(PROJECT_DOCS_BUCKET).remove([doc.fileUrl]).catch(() => undefined);
      }
      return action;
    }

    case 'PROJECT_JOIN_REQUEST': {
      const project = state.projects.find((p) => p.id === action.projectId);
      if (!project) throwDb(new Error('not found'), 'Không tìm thấy dự án.');
      if (project.managerId === ctx.userId) throw new Error('Bạn đã là Chủ dự án này.');
      if (project.memberIds.includes(ctx.userId)) throw new Error('Bạn đã là thành viên của dự án này.');
      // Chặn gửi trùng khi đã có đơn xin vào đang chờ duyệt.
      const dup = state.projectRequests.some(
        (r) => r.type === 'join_project' && r.projectId === action.projectId && r.requestedBy === ctx.userId && r.status === 'pending',
      );
      if (dup) throw new Error('Bạn đã gửi yêu cầu tham gia dự án này rồi.');
      // Lưu đơn xin vào để Leader duyệt (loại 'join_project' — cần chạy SQL
      // nexus-join-request-db.sql để DB chấp nhận loại này, xem ghi chú DB).
      const req: ProjectRequest = {
        id: newId(),
        workspaceId: ctx.workspaceId,
        type: 'join_project',
        projectId: project.id,
        payload: {},
        status: 'pending',
        requestedBy: ctx.userId,
        createdAt: new Date().toISOString(),
      };
      const { error: rErr } = await sb.from('project_requests').insert({
        id: req.id,
        workspace_id: ctx.workspaceId,
        type: 'join_project',
        project_id: project.id,
        payload: {},
        status: 'pending',
        requested_by: ctx.userId,
      });
      if (rErr) throwDb(rErr, 'Không gửi được yêu cầu tham gia.');
      const { error } = await sb.from('notifications').insert({
        id: newId(),
        user_id: project.managerId,
        kind: 'member',
        title: 'Có người xin tham gia dự án',
        body: `${ctx.userName} xin tham gia dự án "${project.name}". Mở chi tiết dự án để duyệt yêu cầu.`,
        link: `/user/projects/${project.id}`,
      });
      if (error) throwDb(error, 'Không gửi được yêu cầu tham gia.');
      return { ...action, request: req };
    }

    default:
      return action;
  }
}
