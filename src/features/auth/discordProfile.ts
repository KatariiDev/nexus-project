import { TARGET_DISCORD_GUILD_ID } from './discordApi';
import type { DiscordCurrentUser, DiscordGuildMember } from './discordApi';


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
