import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const forceDemo = (import.meta.env.VITE_DEMO_MODE as string | undefined) === 'true';

/**
 * Client Supabase. Khi chưa cấu hình (hoặc VITE_DEMO_MODE=true),
 * app chạy ở CHẾ ĐỘ DEMO với dữ liệu mẫu lưu trên localStorage.
 * Xem README.md mục "Kết nối Supabase" để cấu hình backend thật.
 */
export const isSupabaseConfigured = Boolean(url && anonKey) && !forceDemo;

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string)
  : null;

export const DEMO_MODE = !isSupabaseConfigured;
