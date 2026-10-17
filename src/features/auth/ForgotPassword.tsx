import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Hexagon, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase';
import { Button } from '../../components/ui/button';
import { Input, Field } from '../../components/ui/input';
import { Card, CardContent } from '../../components/ui/card';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Email không hợp lệ.');
      return;
    }
    if (!isSupabaseConfigured) {
      setError('Hệ thống hiện đang ở chế độ xem trước nội bộ. Vui lòng liên hệ Dev/Admin để đặt lại mật khẩu.');
      return;
    }
    setBusy(true);
    try {
      const { error: resetErr } = await getSupabase().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/login`,
      });
      if (resetErr) {
        setError(resetErr.message);
        return;
      }
      setSent(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-6 text-slate-100">
      <Card className="w-full max-w-md border-slate-700 bg-slate-800/90 text-slate-100 backdrop-blur">
        <CardContent className="pt-6">
          <div className="mb-6 flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Hexagon className="h-6 w-6" />
            </span>
            <span className="text-xl font-bold">Nexus Project</span>
          </div>

          <h1 className="text-2xl font-bold">Quên mật khẩu</h1>
          <p className="mt-1 text-sm text-slate-400">Nhập email để nhận liên kết đặt lại mật khẩu nội bộ.</p>

          {sent ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-400" />
              <p className="font-semibold">Đã gửi email đặt lại mật khẩu</p>
              <p className="text-sm text-slate-400">
                Vui lòng kiểm tra hộp thư <b>{email}</b> và làm theo hướng dẫn.
              </p>
              <Link to="/login" className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                <ArrowLeft className="h-4 w-4" /> Quay lại đăng nhập
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
              <Field label="Email" error={error}>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ban@congty.vn"
                    autoComplete="email"
                  />
                </div>
              </Field>
              <Button type="submit" className="w-full" size="lg" disabled={busy}>
                {busy ? 'Đang gửi...' : 'Gửi liên kết đặt lại'}
              </Button>
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-1.5 text-sm text-slate-400 hover:text-slate-200"
              >
                <ArrowLeft className="h-4 w-4" /> Quay lại đăng nhập
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

