import { useState } from 'react';
import { useApp } from '../../store/AppContext';
import { PageHeader } from '../../components/ui/feedback';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input, Field } from '../../components/ui/input';
import { toast } from '../../components/ui/toast';
import { DEFAULT_INVITE_EXPIRY_DAYS } from '../../types';

export function AdminSettingsPage() {
  const { state, dispatch } = useApp();
  const [days, setDays] = useState(String(state.workspace.inviteExpiryDays ?? DEFAULT_INVITE_EXPIRY_DAYS));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = () => {
    const n = Number(days);
    if (!Number.isInteger(n) || n < 1 || n > 30) {
      setError('Số ngày phải là số nguyên từ 1 đến 30.');
      return;
    }
    setError('');
    setBusy(true);
    void dispatch({ type: 'WORKSPACE_UPDATE_SETTINGS', inviteExpiryDays: n }).then((ok) => {
      setBusy(false);
      if (ok) toast('Đã lưu cấu hình', `Lời mời mới sẽ hết hạn sau ${n} ngày.`);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Cấu hình" desc="Tùy chỉnh chung của workspace" />
      <Card>
        <CardHeader>
          <CardTitle>Lời mời vào dự án</CardTitle>
          <CardDescription>Thời hạn hiệu lực của lời mời mới được gửi đi (lời mời đã gửi giữ nguyên hạn cũ).</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field label="Thời hạn lời mời (ngày)" error={error}>
            <Input type="number" min={1} max={30} step={1} value={days} onChange={(e) => setDays(e.target.value)} />
          </Field>
          <div className="flex justify-end">
            <Button disabled={busy} onClick={save}>Lưu cấu hình</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
