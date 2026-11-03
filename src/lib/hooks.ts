import { useEffect, useState } from 'react';

/** Giờ hiện tại, cập nhật mỗi phút để đếm ngược lời mời chạy. */
export function useNow(intervalMs = 60000): Date {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
