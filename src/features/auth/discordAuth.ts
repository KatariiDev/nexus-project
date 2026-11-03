import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';
import {
  DISCORD_CACHE_TTL_MS,
  TARGET_DISCORD_GUILD_ID,
  extractStoredProviderToken,
  fetchDiscordCurrentUser,
  fetchDiscordGuildMember,
  fetchDiscordWith429Retry,
} from './discordApi';
import type { DiscordCurrentUser, DiscordGuildMember } from './discordApi';
import { getDiscordAvatarUrl, getDiscordDisplayName, getDiscordUsername } from './discordProfile';

// Re-export de import ngoai khong doi (AppContext import tu file nay nhu cu).
export { getDiscordDisplayName } from './discordProfile';
export { extractStoredProviderToken, persistProviderToken } from './discordApi';

interface DiscordAuthResult {
  success: boolean;
  error?: string;
}

/**
 * Đăng nhập thông qua Discord OAuth.
 * Yêu cầu quyền scopes: identify, email, guilds để kiểm tra user có thuộc Server nội bộ hay không.
 */
export async function signInWithDiscordOAuth(): Promise<DiscordAuthResult> {
  if (!isSupabaseConfigured) {
    return {
      success: false,
      error:
        'Chưa cấu hình Supabase URL và Anon Key trong .env. Bạn có thể sử dụng tính năng Đăng nhập thử nghiệm bên dưới để xem trước giao diện.',
    };
  }

  try {
    const sb = getSupabase();
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: `${window.location.origin}/`,
        scopes: 'identify email guilds guilds.members.read',
        queryParams: {
          prompt: 'consent',
        },
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Lỗi không xác định khi kết nối Discord.',
    };
  }
}


// Cache kết quả xác thực server Discord (TTL 5 phút)
const guildCheckCache = new Map<string, { allowed: boolean; reason?: string; timestamp: number }>();
let inFlightVerification: Promise<{ allowed: boolean; reason?: string }> | null = null;

/**
 * Kiểm tra xem người dùng Discord có thuộc Server (Guild) nội bộ hay không.
 * Nếu có cài đặt VITE_DISCORD_GUILD_ID và người dùng không thuộc server đó,
 * hàm trả về false để hệ thống từ chối truy cập và đăng xuất tài khoản.
 */
export async function verifyDiscordGuildMembership(providerToken?: string | null): Promise<{
  allowed: boolean;
  reason?: string;
}> {
  const targetGuild = TARGET_DISCORD_GUILD_ID?.trim();

  // Nếu chưa cấu hình ID server nội bộ thì cho phép vào
  if (!targetGuild || !providerToken) {
    return { allowed: true };
  }

  // 1. Kiểm tra cache trong bộ nhớ (5 phút)
  const cached = guildCheckCache.get(providerToken);
  if (cached && Date.now() - cached.timestamp < DISCORD_CACHE_TTL_MS) {
    return { allowed: cached.allowed, reason: cached.reason };
  }

  // 2. Kiểm tra sessionStorage (nếu đã xác thực thành công trong phiên này)
  try {
    const sessionVerified = sessionStorage.getItem(`nexus_discord_guild_${targetGuild}`);
    if (sessionVerified === 'true') {
      return { allowed: true };
    }
  } catch {
    // ignore
  }

  // 3. Nếu đang có một request xác thực đang chạy, tái sử dụng Promise để tránh gửi liên tiếp
  if (inFlightVerification) {
    return inFlightVerification;
  }

  inFlightVerification = (async () => {
    try {
      const response = await fetchDiscordWith429Retry('https://discord.com/api/v10/users/@me/guilds', {
        headers: {
          Authorization: `Bearer ${providerToken}`,
        },
      });

      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        console.error('Discord API /users/@me/guilds error:', response.status, errBody);

        let reason = 'Không thể xác thực danh sách server Discord của bạn.';
        if (response.status === 401 || response.status === 403) {
          reason =
            'Không thể lấy danh sách server Discord (Phiên cũ chưa có quyền "guilds"). Vui lòng thử bấm Đăng nhập với Discord lại để hệ thống xin lại quyền.';
        } else if (response.status === 429) {
          reason = 'Discord đang tạm giới hạn tần suất yêu cầu (HTTP 429). Vui lòng đợi vài giây và bấm đăng nhập lại.';
        } else {
          reason = `Không thể xác thực danh sách server Discord (Discord HTTP ${response.status}).`;
        }

        const result = { allowed: false, reason };
        return result;
      }

      const guilds: Array<{ id: string; name: string }> = await response.json();
      const isMember = guilds.some((g) => String(g.id).trim() === targetGuild);

      if (!isMember) {
        const result = {
          allowed: false,
          reason:
            'Truy cập bị từ chối: Tài khoản Discord của bạn không thuộc Server Discord nội bộ. Hệ thống chỉ dành cho thành viên nội bộ.',
        };
        guildCheckCache.set(providerToken, { ...result, timestamp: Date.now() });
        return result;
      }

      const success = { allowed: true };
      guildCheckCache.set(providerToken, { allowed: true, timestamp: Date.now() });
      try {
        sessionStorage.setItem(`nexus_discord_guild_${targetGuild}`, 'true');
      } catch {
        // ignore
      }
      return success;
    } catch (err) {
      console.error('Lỗi khi kiểm tra Discord guild:', err);
      return { allowed: true };
    } finally {
      inFlightVerification = null;
    }
  })();

  return inFlightVerification;
}

/**
 * Đồng bộ tên hiển thị (ưu tiên tên riêng trong server BCN) và avatar từ Discord vào bảng public.profiles trên Supabase.
 */
export async function syncDiscordProfile(
  sb: import('@supabase/supabase-js').SupabaseClient,
  user: {
    id: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
    identities?: Array<{ provider: string; id?: string; identity_data?: Record<string, unknown> }>;
  },
  providerToken?: string | null,
): Promise<{ name: string; avatarUrl?: string; username: string }> {
  const tokenToUse = providerToken || extractStoredProviderToken();

  let guildMember: DiscordGuildMember | null = null;
  let directUser: DiscordCurrentUser | null = null;

  if (tokenToUse) {
    [guildMember, directUser] = await Promise.all([
      fetchDiscordGuildMember(tokenToUse),
      fetchDiscordCurrentUser(tokenToUse),
    ]);
  } else {
    guildMember = await fetchDiscordGuildMember(null);
    directUser = await fetchDiscordCurrentUser(null);
  }

  // Tên hiển thị: ưu tiên tuyệt đối tên trong server BCN (guildMember.nick)
  const serverNick = guildMember?.nick?.trim();
  let name: string;
  if (serverNick) {
    name = serverNick;
  } else {
    // Nếu chưa lấy được serverNick ở lượt này, kiểm tra xem storage đã có serverNick chưa
    const savedServerName =
      (typeof localStorage !== 'undefined' ? localStorage.getItem('nexus_discord_server_name') : null) ||
      (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('nexus_discord_server_name') : null);
    if (savedServerName && savedServerName.trim()) {
      name = savedServerName.trim();
    } else {
      name = getDiscordDisplayName(user, guildMember);
    }
  }

  let avatarUrl = getDiscordAvatarUrl(user, guildMember);
  if (!avatarUrl && directUser?.avatar && directUser.id) {
    const ext = directUser.avatar.startsWith('a_') ? 'gif' : 'png';
    avatarUrl = `https://cdn.discordapp.com/avatars/${directUser.id}/${directUser.avatar}.${ext}?size=256`;
  }
  if (!avatarUrl) {
    try {
      const savedAvatar =
        (typeof localStorage !== 'undefined' ? localStorage.getItem('nexus_discord_avatar_url') : null) ||
        (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('nexus_discord_avatar_url') : null);
      if (savedAvatar) avatarUrl = savedAvatar;
    } catch { /* ignore */ }
  }

  let username = getDiscordUsername(user, guildMember, directUser);
  if (username.toLowerCase() === 'trantuongvan') {
    username = '_trantuongvan';
  }

  try {
    localStorage.setItem('nexus_discord_username', username);
    sessionStorage.setItem('nexus_discord_username', username);
    if (serverNick) {
      localStorage.setItem('nexus_discord_server_name', serverNick);
      sessionStorage.setItem('nexus_discord_server_name', serverNick);
    } else if (name) {
      const existing =
        (typeof localStorage !== 'undefined' ? localStorage.getItem('nexus_discord_server_name') : null) ||
        (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('nexus_discord_server_name') : null);
      if (!existing) {
        localStorage.setItem('nexus_discord_server_name', name);
        sessionStorage.setItem('nexus_discord_server_name', name);
      }
    }
    if (avatarUrl) {
      localStorage.setItem('nexus_discord_avatar_url', avatarUrl);
      sessionStorage.setItem('nexus_discord_avatar_url', avatarUrl);
    }
  } catch { /* ignore */ }

  try {
    const cleanEmail = (user.email ?? '').trim().toLowerCase();
    const payload: {
      id: string;
      name: string;
      email: string;
      username?: string;
      avatar_url?: string;
      updated_at: string;
    } = {
      id: user.id,
      name,
      email: cleanEmail,
      ...(username ? { username } : {}),
      ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
      updated_at: new Date().toISOString(),
    };

    const { error: upsertErr } = await sb.from('profiles').upsert(payload, { onConflict: 'id' });
    if (upsertErr) {
      // Thử dùng update nếu upsert bị cản
      await sb
        .from('profiles')
        .update({
          name,
          ...(username ? { username } : {}),
          ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
    }
  } catch (err) {
    console.warn('Không thể đồng bộ hồ sơ Discord:', err);
  }

  return { name, avatarUrl, username };
}
