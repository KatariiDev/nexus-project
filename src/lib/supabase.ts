import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True khi đã cấu hình đủ URL + anon key để dùng backend thật. */
export const isSupabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

/**
 * Trả về Supabase client đã cấu hình.
 * Ném lỗi nếu thiếu cấu hình — App sẽ hiển thị màn hình hướng dẫn thay vì crash.
 */
export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured || !url || !anonKey) {
    throw new Error(
      'Chưa cấu hình Supabase. Tạo file .env từ .env.example và điền VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY.',
    );
  }
  if (!client) {
    client = createClient(url, anonKey);
  }
  return client;
}

/** Client dùng cho các thao tác cần kiểm tra null an toàn (hiếm khi dùng). */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string)
  : null;
