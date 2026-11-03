export const TARGET_DISCORD_GUILD_ID = import.meta.env.VITE_DISCORD_GUILD_ID as string | undefined;

/** Thời gian cache kiểm tra Discord trong bộ nhớ (5 phút). */
export const DISCORD_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Gọi Discord API, gặp HTTP 429 thì chờ `retry_after` rồi thử lại 1 lần.
 * Trả về response của lần gọi đầu hoặc lần thử lại.
 */
export async function fetchDiscordWith429Retry(url: string, init?: RequestInit): Promise<Response> {
  let response = await fetch(url, init);
  if (response.status === 429) {
    const rateLimitData = await response.json().catch(() => ({}));
    const retryAfterSec = Number(rateLimitData.retry_after || 2);
    const waitMs = Math.min(Math.max(retryAfterSec * 1000, 1500), 4000);
    console.warn(`Discord API 429: Chờ ${waitMs}ms trước khi thử lại...`);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    response = await fetch(url, init);
  }
  return response;
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
  if (cached && Date.now() - cached.timestamp < DISCORD_CACHE_TTL_MS) {
    return cached.member;
  }

  // 2. Tái sử dụng in-flight request nếu đang có request chạy song song
  if (inFlightMemberFetch) {
    return inFlightMemberFetch;
  }

  inFlightMemberFetch = (async () => {
    try {
      const response = await fetchDiscordWith429Retry(`https://discord.com/api/v10/users/@me/guilds/${guildId}/member`, {
        headers: {
          Authorization: `Bearer ${providerToken}`,
        },
      });

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
  if (cached && Date.now() - cached.timestamp < DISCORD_CACHE_TTL_MS) {
    return cached.user;
  }

  if (inFlightCurrentUserFetch) {
    return inFlightCurrentUserFetch;
  }

  inFlightCurrentUserFetch = (async () => {
    try {
      const response = await fetchDiscordWith429Retry('https://discord.com/api/v10/users/@me', {
        headers: {
          Authorization: `Bearer ${providerToken}`,
        },
      });

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
