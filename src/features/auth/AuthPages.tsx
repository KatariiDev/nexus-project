import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Hexagon, Mail, Lock, User as UserIcon, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { Button } from '../../components/ui/button';
import { Input, Field } from '../../components/ui/input';
import { Card, CardContent } from '../../components/ui/card';

function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:flex w-[45%] flex-col justify-between bg-primary p-10 text-primary-foreground">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15"><Hexagon className="h-6 w-6" /></span>
          <span className="text-xl font-bold">Nexus Project</span>
        </div>
        <div>
          <h2 className="text-3xl font-bold leading-snug">Quản lý dự án,<br />đội nhóm và tiến độ<br />trên một nền tảng duy nhất.</h2>
          <p className="mt-4 max-w-md text-white/80">Kanban trực quan, Gantt timeline, báo cáo real-time và cộng tác theo thời gian thực cho mọi quy mô đội nhóm.</p>
          <div className="mt-8 flex gap-6 text-sm">
            <div><p className="text-2xl font-bold">12k+</p><p className="text-white/70">Đội nhóm tin dùng</p></div>
            <div><p className="text-2xl font-bold">98%</p><p className="text-white/70">Hoàn thành đúng hạn</p></div>
            <div><p className="text-2xl font-bold">4.9/5</p><p className="text-white/70">Đánh giá người dùng</p></div>
          </div>
        </div>
        <p className="text-sm text-white/60">© 2026 Nexus Project. Bảo mật chuẩn doanh nghiệp.</p>
      </div>
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Hexagon className="h-6 w-6" /></span>
            <span className="text-xl font-bold">Nexus Project</span>
          </div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
          <Card className="mt-6"><CardContent className="pt-6">{children}</CardContent></Card>
        </div>
      </div>
    </div>
  );
}

export function LoginPage() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState('minhanh@nexus.vn');
  const [password, setPassword] = useState('demo1234');
  const [error, setError] = useState('');

  const login = (userId: string) => {
    dispatch({ type: 'AUTH_LOGIN', userId });
    navigate('/');
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const user = state.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user) { setError('Email chưa được đăng ký trong workspace demo.'); return; }
    if (password.length < 4) { setError('Mật khẩu không đúng.'); return; }
    login(user.id);
  };

  return (
    <AuthShell title="Đăng nhập" subtitle="Chào mừng trở lại với Nexus Project.">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Email">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ban@congty.vn" />
          </div>
        </Field>
        <Field label="Mật khẩu" error={error}>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
        </Field>
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm text-primary hover:underline">Quên mật khẩu?</Link>
        </div>
        <Button type="submit" className="w-full" size="lg">Đăng nhập</Button>
        <Button type="button" variant="outline" className="w-full" size="lg" onClick={() => login('u1')}>
          Dùng tài khoản demo
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Chưa có tài khoản? <Link to="/register" className="text-primary font-medium hover:underline">Đăng ký</Link>
        </p>
      </form>
    </AuthShell>
  );
}

export function RegisterPage() {
  const { dispatch } = useApp();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Vui lòng nhập họ tên.'); return; }
    if (!/^\S+@\S+\.\S+$/.test(email)) { setError('Email không hợp lệ.'); return; }
    if (password.length < 6) { setError('Mật khẩu phải có ít nhất 6 ký tự.'); return; }
    dispatch({ type: 'USER_ADD', name: name.trim(), email: email.trim(), role: 'member' });
    dispatch({ type: 'AUTH_LOGIN', userId: 'u1' });
    navigate('/');
  };

  return (
    <AuthShell title="Tạo tài khoản" subtitle="Bắt đầu quản lý dự án hiệu quả ngay hôm nay.">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Họ tên">
          <div className="relative">
            <UserIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nguyễn Văn A" />
          </div>
        </Field>
        <Field label="Email">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ban@congty.vn" />
          </div>
        </Field>
        <Field label="Mật khẩu" error={error}>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Tối thiểu 6 ký tự" />
          </div>
        </Field>
        <Button type="submit" className="w-full" size="lg">Đăng ký</Button>
        <p className="text-center text-sm text-muted-foreground">
          Đã có tài khoản? <Link to="/login" className="text-primary font-medium hover:underline">Đăng nhập</Link>
        </p>
      </form>
    </AuthShell>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) { setError('Email không hợp lệ.'); return; }
    setSent(true);
  };

  return (
    <AuthShell title="Quên mật khẩu" subtitle="Nhập email để nhận liên kết đặt lại mật khẩu.">
      {sent ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <CheckCircle2 className="h-12 w-12 text-success" />
          <p className="font-semibold">Đã gửi email đặt lại mật khẩu</p>
          <p className="text-sm text-muted-foreground">Vui lòng kiểm tra hộp thư <b>{email}</b> và làm theo hướng dẫn.</p>
          <Link to="/login" className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" /> Quay lại đăng nhập
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Email" error={error}>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ban@congty.vn" />
            </div>
          </Field>
          <Button type="submit" className="w-full" size="lg">Gửi liên kết đặt lại</Button>
          <Link to="/login" className="inline-flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Quay lại đăng nhập
          </Link>
        </form>
      )}
    </AuthShell>
  );
}
