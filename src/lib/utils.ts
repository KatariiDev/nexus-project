import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

let idCounter = 0;
export function genId(prefix = 'id'): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** ID cho entity lưu trên Supabase — uuid chuẩn, dùng làm khóa chính. */
export function newId(): string {
  return crypto.randomUUID();
}

export function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const AVATAR_HUES = [239, 262, 199, 142, 32, 0, 288, 172];
export function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 997;
  const hue = AVATAR_HUES[h % AVATAR_HUES.length];
  return `hsl(${hue} 65% 52%)`;
}
