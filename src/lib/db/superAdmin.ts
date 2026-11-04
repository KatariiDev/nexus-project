import type { Sb } from './mappers';
import { throwDb } from './persist-helpers';

export async function fetchIsSuperAdmin(sb: Sb, userId: string): Promise<boolean> {
  try {
    const { data } = await sb.from('profiles').select('is_super_admin').eq('id', userId).maybeSingle();
    return Boolean((data as unknown as { is_super_admin?: boolean })?.is_super_admin);
  } catch {
    return false;
  }
}

export async function setSuperAdmin(sb: Sb, targetId: string, makeAdmin: boolean): Promise<void> {
  const { error } = await sb.from('profiles').update({ is_super_admin: makeAdmin }).eq('id', targetId);
  if (error) throwDb(error, 'Không thể cập nhật quyền Admin tổng.');
}
