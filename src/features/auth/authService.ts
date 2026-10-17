import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';
import { signInWithDiscordOAuth, verifyDiscordGuildMembership } from './discordAuth';

export interface AuthResult {
  success: boolean;
  error?: string;
  isDev?: boolean;
  name?: string;
}

/**
 * Đăng nhập bằng Email và Mật khẩu (dành cho phương án dự phòng khi Discord gặp trục trặc).
 * Tài khoản do Dev/Admin tạo trực tiếp trong Supabase Auth.
 */
export async function signInWithEmailAndPassword(
  email: string,
  password: string,
): Promise<AuthResult> {
  const cleanEmail = email.trim();
  if (!cleanEmail) {
    return { success: false, error: 'Vui lòng nhập Email.' };
  }
  if (!cleanEmail.includes('@')) {
    return { success: false, error: 'Vui lòng nhập đúng định dạng Email.' };
  }
  if (!password) {
    return { success: false, error: 'Vui lòng nhập Mật khẩu.' };
  }

  // Khi chưa cấu hình Supabase URL & Key (.env trống), cho phép xem trước UI
  if (!isSupabaseConfigured) {
    return {
      success: true,
      isDev: true,
      name: cleanEmail.split('@')[0],
    };
  }

  try {
    const sb = getSupabase();
    const { error } = await sb.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error) {
      let message = error.message;
      if (error.message === 'Invalid login credentials') {
        message = 'Email hoặc mật khẩu không chính xác.';
      } else if (error.message.includes('Email not confirmed')) {
        message = 'Tài khoản chưa được kích hoạt. Vui lòng kiểm tra hộp thư (cả mục Spam) và bấm vào liên kết xác thực để kích hoạt tài khoản trước khi đăng nhập.';
      }
      return { success: false, error: message };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Đã xảy ra lỗi khi kết nối máy chủ.',
    };
  }
}

/**
 * Bắt đầu luồng đăng nhập qua Discord OAuth.
 */
export async function signInWithDiscord(): Promise<AuthResult> {
  if (!isSupabaseConfigured) {
    return {
      success: false,
      error:
        'Hệ thống đang chạy chế độ xem trước (chưa cấu hình Supabase .env). Bạn có thể nhập Email dự phòng bên dưới để trải nghiệm ngay.',
    };
  }

  return await signInWithDiscordOAuth();
}

export { verifyDiscordGuildMembership };
