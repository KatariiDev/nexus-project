import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';

export const TARGET_DISCORD_GUILD_ID = import.meta.env.VITE_DISCORD_GUILD_ID as string | undefined;

export interface DiscordAuthResult {
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
  if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
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
      let response = await fetch('https://discord.com/api/v10/users/@me/guilds', {
        headers: {
          Authorization: `Bearer ${providerToken}`,
        },
      });

      // Nếu gặp HTTP 429 (Rate limit), chờ retry_after và thử lại 1 lần
      if (response.status === 429) {
        const rateLimitData = await response.json().catch(() => ({}));
        const retryAfterSec = Number(rateLimitData.retry_after || 2);
        const waitMs = Math.min(Math.max(retryAfterSec * 1000, 1500), 4000);
        console.warn(`Discord API 429: Chờ ${waitMs}ms trước khi thử lại...`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));

        response = await fetch('https://discord.com/api/v10/users/@me/guilds', {
          headers: {
            Authorization: `Bearer ${providerToken}`,
          },
        });
      }

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

export interface DiscordGuildMember {
  nick?: string | null;
  avatar?: string | null;
  user?: {
    id: string;
    username: string;
    global_name?: string | null;
    avatar?: string | null;
  };
}

export function extractStoredProviderToken(): string | null {
  if (typeof window === 'undefined') return null;
  // 1. Kiểm tra URL hash (ngay sau khi Discord redirect về)
  if (window.location.hash) {
    try {
      const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const pt = params.get('provider_token');
      if (pt) return pt;
    } catch { /* ignore */ }
  }
  // 2. Kiểm tra sessionStorage
  try {
    const s = sessionStorage.getItem('nexus_discord_provider_token');
    if (s) return s;
  } catch { /* ignore */ }
  // 3. Kiểm tra localStorage
  try {
    const l = localStorage.getItem('nexus_discord_provider_token');
    if (l) return l;
  } catch { /* ignore */ }
  // 4. Kiểm tra Supabase Auth Session lưu trong localStorage
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const val = localStorage.getItem(key);
        if (val) {
          const parsed = JSON.parse(val);
          if (parsed && typeof parsed.provider_token === 'string' && parsed.provider_token) {
            return parsed.provider_token;
          }
        }
      }
    }
  } catch { /* ignore */ }
  return null;
}

export function persistProviderToken(token: string) {
  try {
    sessionStorage.setItem('nexus_discord_provider_token', token);
    localStorage.setItem('nexus_discord_provider_token', token);
  } catch { /* ignore */ }
}

const memberCheckCache = new Map<string, { member: DiscordGuildMember | null; timestamp: number }>();
let inFlightMemberFetch: Promise<DiscordGuildMember | null> | null = null;

/**
 * Lấy thông tin thành viên (nickname, avatar riêng) của user trong Discord Server nội bộ (BCN).
 * Yêu cầu quyền scope: guilds.members.read
 */
export async function fetchDiscordGuildMember(
  providerToken?: string | null,
  targetGuildId?: string,
): Promise<DiscordGuildMember | null> {
  const guildId = (targetGuildId || TARGET_DISCORD_GUILD_ID || '1337249537072435281')?.trim();
  if (!guildId) return null;

  const token = providerToken || extractStoredProviderToken();

  // Nếu không có token, thử đọc từ cache trong localStorage và sessionStorage
  if (!token) {
    try {
      const saved =
        (typeof localStorage !== 'undefined' ? localStorage.getItem(`nexus_discord_member_${guildId}`) : null) ||
        (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(`nexus_discord_member_${guildId}`) : null);
      if (saved) return JSON.parse(saved) as DiscordGuildMember;
    } catch { /* ignore */ }
    return null;
  }

  persistProviderToken(token);

  // 1. Kiểm tra cache bộ nhớ (5 phút)
  const cached = memberCheckCache.get(`${guildId}_${token}`);
  if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
    return cached.member;
  }

  // 2. Tái sử dụng in-flight request nếu đang có request chạy song song
  if (inFlightMemberFetch) {
    return inFlightMemberFetch;
  }

  inFlightMemberFetch = (async () => {
    try {
      let response = await fetch(`https://discord.com/api/v10/users/@me/guilds/${guildId}/member`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Nếu gặp HTTP 429, chờ retry_after và thử lại
      if (response.status === 429) {
        const rateLimitData = await response.json().catch(() => ({}));
        const retryAfterSec = Number(rateLimitData.retry_after || 2);
        const waitMs = Math.min(Math.max(retryAfterSec * 1000, 1500), 4000);
        console.warn(`Discord API Member 429: Chờ ${waitMs}ms trước khi thử lại...`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));

        response = await fetch(`https://discord.com/api/v10/users/@me/guilds/${guildId}/member`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }

      if (!response.ok) {
        console.warn(
          `Không thể lấy thông tin member trong guild ${guildId} (HTTP ${response.status}). Có thể cần đăng xuất và đăng nhập lại để cấp scope "guilds.members.read".`,
        );
        // Thử lấy lại từ storage nếu có bản lưu trước
        try {
          const saved =
            (typeof localStorage !== 'undefined' ? localStorage.getItem(`nexus_discord_member_${guildId}`) : null) ||
            (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(`nexus_discord_member_${guildId}`) : null);
          if (saved) return JSON.parse(saved) as DiscordGuildMember;
        } catch { /* ignore */ }
        return null;
      }

      const member: DiscordGuildMember = await response.json();
      memberCheckCache.set(`${guildId}_${token}`, { member, timestamp: Date.now() });

      try {
        const serialized = JSON.stringify(member);
        sessionStorage.setItem(`nexus_discord_member_${guildId}`, serialized);
        localStorage.setItem(`nexus_discord_member_${guildId}`, serialized);

        const serverNick = member.nick?.trim();
        if (serverNick) {
          sessionStorage.setItem('nexus_discord_server_name', serverNick);
          localStorage.setItem('nexus_discord_server_name', serverNick);
        }

        const discordId = member.user?.id;
        if (member.avatar && discordId) {
          const ext = member.avatar.startsWith('a_') ? 'gif' : 'png';
          const serverAvatarUrl = `https://cdn.discordapp.com/guilds/${guildId}/users/${discordId}/avatars/${member.avatar}.${ext}?size=256`;
          sessionStorage.setItem('nexus_discord_avatar_url', serverAvatarUrl);
          localStorage.setItem('nexus_discord_avatar_url', serverAvatarUrl);
        } else if (member.user?.avatar && discordId) {
          const ext = member.user.avatar.startsWith('a_') ? 'gif' : 'png';
          const globalAvatarUrl = `https://cdn.discordapp.com/avatars/${discordId}/${member.user.avatar}.${ext}?size=256`;
          sessionStorage.setItem('nexus_discord_avatar_url', globalAvatarUrl);
          localStorage.setItem('nexus_discord_avatar_url', globalAvatarUrl);
        }
      } catch { /* ignore */ }

      return member;
    } catch (err) {
      console.warn('Lỗi khi fetchDiscordGuildMember:', err);
      try {
        const saved =
          (typeof localStorage !== 'undefined' ? localStorage.getItem(`nexus_discord_member_${guildId}`) : null) ||
          (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(`nexus_discord_member_${guildId}`) : null);
        if (saved) return JSON.parse(saved) as DiscordGuildMember;
      } catch { /* ignore */ }
      return null;
    } finally {
      inFlightMemberFetch = null;
    }
  })();

  return inFlightMemberFetch;
}

/**
 * Lấy tên hiển thị phù hợp nhất từ thông tin người dùng Discord.
 * Thứ tự ưu tiên:
 * 1. Tên riêng (nickname) trong server Discord BCN (guildMember.nick)
 * 2. Tên server BCN đã lưu trong localStorage / sessionStorage (nexus_discord_server_name)
 * 3. Tên từ cache guild member trong storage
 * 4. Fallback (khi chưa hoặc không có nickname trong BCN): Tên hiển thị toàn cầu Discord (global_name) / Họ tên
 * 5. Discord username
 * 6. Email username (phần trước @)
 * 7. Mặc định: 'Thành viên'
 */
export function getDiscordDisplayName(
  user: {
    email?: string;
    user_metadata?: Record<string, unknown>;
    identities?: Array<{ provider: string; id?: string; identity_data?: Record<string, unknown> }>;
  },
  guildMember?: DiscordGuildMember | null,
): string {
  // 1. Ưu tiên cao nhất: Tên riêng (nickname) trong server BCN từ guildMember
  if (guildMember && typeof guildMember.nick === 'string' && guildMember.nick.trim()) {
    const nick = guildMember.nick.trim();
    try {
      localStorage.setItem('nexus_discord_server_name', nick);
      sessionStorage.setItem('nexus_discord_server_name', nick);
    } catch { /* ignore */ }
    return nick;
  }

  // 2. Kiểm tra cache tên server BCN đã lưu trong localStorage hoặc sessionStorage
  try {
    const cachedServerName =
      (typeof localStorage !== 'undefined' ? localStorage.getItem('nexus_discord_server_name') : null) ||
      (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('nexus_discord_server_name') : null);
    if (cachedServerName && cachedServerName.trim()) {
      return cachedServerName.trim();
    }
  } catch { /* ignore */ }

  // 3. Thử đọc từ member cache trong storage
  const guildId = (TARGET_DISCORD_GUILD_ID || '1337249537072435281')?.trim();
  if (guildId) {
    try {
      const saved =
        (typeof localStorage !== 'undefined' ? localStorage.getItem(`nexus_discord_member_${guildId}`) : null) ||
        (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(`nexus_discord_member_${guildId}`) : null);
      if (saved) {
        const parsed: DiscordGuildMember = JSON.parse(saved);
        if (typeof parsed.nick === 'string' && parsed.nick.trim()) {
          const nick = parsed.nick.trim();
          try {
            localStorage.setItem('nexus_discord_server_name', nick);
            sessionStorage.setItem('nexus_discord_server_name', nick);
          } catch { /* ignore */ }
          return nick;
        }
      }
    } catch { /* ignore */ }
  }

  // 4. Fallback cuối cùng nếu không tìm thấy tên trong server BCN: Tên hiển thị toàn cầu Discord hoặc họ tên
  const meta = user.user_metadata || {};
  const customClaims = meta.custom_claims as Record<string, unknown> | undefined;
  const discordIdentity = user.identities?.find((id) => id.provider === 'discord');
  const identityData = discordIdentity?.identity_data;

  const candidate =
    guildMember?.user?.global_name ||
    (meta.global_name as string) ||
    (customClaims?.global_name as string) ||
    (identityData?.global_name as string) ||
    (meta.full_name as string) ||
    (meta.name as string) ||
    (customClaims?.full_name as string) ||
    (identityData?.full_name as string) ||
    (identityData?.name as string) ||
    guildMember?.user?.username ||
    (meta.preferred_username as string) ||
    (meta.user_name as string) ||
    (identityData?.preferred_username as string) ||
    (identityData?.user_name as string);

  if (candidate && typeof candidate === 'string' && candidate.trim()) {
    return candidate.trim();
  }

  if (user.email && user.email.includes('@')) {
    return user.email.split('@')[0];
  }

  return 'Thành viên';
}

/**
 * Lấy URL avatar đại diện từ thông tin tài khoản Discord.
 * Ưu tiên:
 * 1. Server Avatar riêng trong server BCN (nếu người dùng có cài đặt)
 * 2. Global Avatar trên Discord
 */
export function getDiscordAvatarUrl(
  user: {
    user_metadata?: Record<string, unknown>;
    identities?: Array<{ provider: string; id?: string; identity_data?: Record<string, unknown> }>;
  },
  guildMember?: DiscordGuildMember | null,
): string | undefined {
  const meta = user.user_metadata || {};
  const customClaims = meta.custom_claims as Record<string, unknown> | undefined;
  const discordIdentity = user.identities?.find((id) => id.provider === 'discord');
  const identityData = discordIdentity?.identity_data;

  const discordId =
    guildMember?.user?.id ||
    (meta.provider_id as string) ||
    discordIdentity?.id ||
    (meta.sub as string) ||
    (identityData?.provider_id as string) ||
    (identityData?.sub as string);

  const guildId = TARGET_DISCORD_GUILD_ID?.trim();

  // 1. Kiểm tra Guild Avatar riêng trong Server BCN
  let serverAvatarHash = guildMember?.avatar;
  if (!serverAvatarHash && guildId) {
    try {
      const saved =
        (typeof localStorage !== 'undefined' ? localStorage.getItem(`nexus_discord_member_${guildId}`) : null) ||
        (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(`nexus_discord_member_${guildId}`) : null);
      if (saved) {
        const parsed: DiscordGuildMember = JSON.parse(saved);
        if (parsed.avatar) serverAvatarHash = parsed.avatar;
      }
    } catch { /* ignore */ }
  }

  if (serverAvatarHash && guildId && discordId) {
    const ext = serverAvatarHash.startsWith('a_') ? 'gif' : 'png';
    return `https://cdn.discordapp.com/guilds/${guildId}/users/${discordId}/avatars/${serverAvatarHash}.${ext}?size=256`;
  }

  // 2. Kiểm tra URL trực tiếp từ user_metadata / custom_claims / identity_data
  if (typeof meta.avatar_url === 'string' && meta.avatar_url.trim()) {
    return meta.avatar_url.trim();
  }
  if (typeof meta.picture === 'string' && meta.picture.trim()) {
    return meta.picture.trim();
  }
  if (customClaims && typeof customClaims.picture === 'string' && customClaims.picture.trim()) {
    return customClaims.picture.trim();
  }
  if (customClaims && typeof customClaims.avatar_url === 'string' && customClaims.avatar_url.trim()) {
    return customClaims.avatar_url.trim();
  }
  if (identityData) {
    if (typeof identityData.avatar_url === 'string' && identityData.avatar_url.trim()) {
      return identityData.avatar_url.trim();
    }
    if (typeof identityData.picture === 'string' && identityData.picture.trim()) {
      return identityData.picture.trim();
    }
  }

  // 3. Tự build CDN URL từ Discord User ID + Global Avatar hash
  const avatarHash =
    guildMember?.user?.avatar ||
    (meta.avatar as string) ||
    (customClaims?.avatar as string) ||
    (identityData?.avatar as string);

  if (avatarHash && discordId) {
    const ext = avatarHash.startsWith('a_') ? 'gif' : 'png';
    return `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.${ext}?size=256`;
  }

  // 4. Kiểm tra cache avatar URL đã lưu trong storage
  try {
    const cachedUrl =
      (typeof localStorage !== 'undefined' ? localStorage.getItem('nexus_discord_avatar_url') : null) ||
      (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('nexus_discord_avatar_url') : null);
    if (cachedUrl && cachedUrl.trim()) return cachedUrl.trim();
  } catch { /* ignore */ }

  return undefined;
}

export interface DiscordCurrentUser {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
}

const currentUserCache = new Map<string, { user: DiscordCurrentUser; timestamp: number }>();
let inFlightCurrentUserFetch: Promise<DiscordCurrentUser | null> | null = null;

/**
 * Lấy thông tin user Discord từ endpoint /users/@me (chỉ cần scope 'identify').
 */
export async function fetchDiscordCurrentUser(providerToken?: string | null): Promise<DiscordCurrentUser | null> {
  if (!providerToken) {
    if (typeof sessionStorage !== 'undefined') {
      try {
        const saved = sessionStorage.getItem('nexus_discord_current_user');
        if (saved) return JSON.parse(saved) as DiscordCurrentUser;
      } catch { /* ignore */ }
    }
    return null;
  }

  const cached = currentUserCache.get(providerToken);
  if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
    return cached.user;
  }

  if (inFlightCurrentUserFetch) {
    return inFlightCurrentUserFetch;
  }

  inFlightCurrentUserFetch = (async () => {
    try {
      let response = await fetch('https://discord.com/api/v10/users/@me', {
        headers: {
          Authorization: `Bearer ${providerToken}`,
        },
      });

      if (response.status === 429) {
        const rateLimitData = await response.json().catch(() => ({}));
        const retryAfterSec = Number(rateLimitData.retry_after || 2);
        const waitMs = Math.min(Math.max(retryAfterSec * 1000, 1500), 4000);
        await new Promise((resolve) => setTimeout(resolve, waitMs));

        response = await fetch('https://discord.com/api/v10/users/@me', {
          headers: {
            Authorization: `Bearer ${providerToken}`,
          },
        });
      }

      if (response.ok) {
        const data: DiscordCurrentUser = await response.json();
        currentUserCache.set(providerToken, { user: data, timestamp: Date.now() });
        if (typeof sessionStorage !== 'undefined') {
          try {
            sessionStorage.setItem('nexus_discord_current_user', JSON.stringify(data));
            if (data.username) {
              const cleanUsername = data.username.toLowerCase() === 'trantuongvan' ? '_trantuongvan' : data.username;
              sessionStorage.setItem('nexus_discord_username', cleanUsername);
              localStorage.setItem('nexus_discord_username', cleanUsername);
            }
          } catch { /* ignore */ }
        }
        return data;
      }
    } catch (err) {
      console.warn('Lỗi khi fetchDiscordCurrentUser:', err);
    } finally {
      inFlightCurrentUserFetch = null;
    }
    return null;
  })();

  return inFlightCurrentUserFetch;
}

/**
 * Lấy username Discord (handle định danh duy nhất, ví dụ: '_trantuongvan', 'hoangnam').
 */
export function getDiscordUsername(
  user: {
    email?: string;
    user_metadata?: Record<string, unknown>;
    identities?: Array<{ provider: string; id?: string; identity_data?: Record<string, unknown> }>;
  },
  guildMember?: DiscordGuildMember | null,
  directUser?: DiscordCurrentUser | null,
): string {
  // 1. Ưu tiên cao nhất: từ Discord user trực tiếp qua /users/@me
  if (directUser?.username) {
    const un = directUser.username.trim();
    return un.toLowerCase() === 'trantuongvan' ? '_trantuongvan' : un;
  }

  // 2. Từ thông tin member trong guild
  if (guildMember?.user?.username) {
    const un = guildMember.user.username.trim();
    return un.toLowerCase() === 'trantuongvan' ? '_trantuongvan' : un;
  }

  // 3. Từ cache localStorage hoặc sessionStorage
  if (typeof localStorage !== 'undefined') {
    try {
      const cached = localStorage.getItem('nexus_discord_username') || sessionStorage.getItem('nexus_discord_username');
      if (cached && cached.trim()) {
        const un = cached.trim();
        return un.toLowerCase() === 'trantuongvan' ? '_trantuongvan' : un;
      }
    } catch { /* ignore */ }
  }

  const guildId = TARGET_DISCORD_GUILD_ID?.trim();
  if (guildId && typeof sessionStorage !== 'undefined') {
    try {
      const saved = sessionStorage.getItem(`nexus_discord_member_${guildId}`);
      if (saved) {
        const parsed: DiscordGuildMember = JSON.parse(saved);
        if (parsed.user?.username) {
          const un = parsed.user.username.trim();
          return un.toLowerCase() === 'trantuongvan' ? '_trantuongvan' : un;
        }
      }
    } catch { /* ignore */ }
  }

  const meta = user.user_metadata || {};
  const customClaims = meta.custom_claims as Record<string, unknown> | undefined;
  const discordIdentity = user.identities?.find((id) => id.provider === 'discord');
  const identityData = discordIdentity?.identity_data;

  const candidate =
    (meta.preferred_username as string) ||
    (meta.user_name as string) ||
    (customClaims?.preferred_username as string) ||
    (identityData?.preferred_username as string) ||
    (identityData?.user_name as string) ||
    (meta.username as string);

  if (candidate && typeof candidate === 'string' && candidate.trim()) {
    const un = candidate.trim();
    return un.toLowerCase() === 'trantuongvan' ? '_trantuongvan' : un;
  }

  if (user.email && user.email.toLowerCase().includes('trantuongvan')) {
    return '_trantuongvan';
  }

  if (user.email && user.email.includes('@')) {
    const prefix = user.email.split('@')[0];
    return prefix.toLowerCase() === 'trantuongvan' ? '_trantuongvan' : prefix;
  }

  return 'thanhvien';
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
    const payload: { id: string; name: string; email: string; avatar_url?: string; updated_at: string } = {
      id: user.id,
      name,
      email: user.email ?? '',
      updated_at: new Date().toISOString(),
    };
    if (avatarUrl) {
      payload.avatar_url = avatarUrl;
    }

    const { error: upsertErr } = await sb.from('profiles').upsert(payload, { onConflict: 'id' });
    if (upsertErr) {
      // Thử dùng update nếu upsert bị trigger cản
      await sb
        .from('profiles')
        .update({ name, ...(avatarUrl ? { avatar_url: avatarUrl } : {}), updated_at: new Date().toISOString() })
        .eq('id', user.id);
    }
  } catch (err) {
    console.warn('Không thể đồng bộ hồ sơ Discord:', err);
  }

  return { name, avatarUrl, username };
}

