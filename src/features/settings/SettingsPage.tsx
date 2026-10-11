import { useState } from 'react';
import { Bell, Database, Moon, Sun, User, AlertTriangle, Check } from 'lucide-react';
import { useApp, useCurrentUser } from '../../store/AppContext';
import { PageHeader, ConfirmDialog } from '../../components/ui/feedback';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input, Select, Field } from '../../components/ui/input';
import { Tabs } from '../../components/ui/tabs';
import { Switch } from '../../components/ui/controls';
import { Avatar } from '../../components/ui/avatar';
import { toast } from '../../components/ui/toast';
import { cn } from '../../lib/utils';

type TabKey = 'profile' | 'appearance' | 'notifications' | 'workspace' | 'data';

const TABS: { value: TabKey; label: string; icon: React.ReactNode }[] = [
  { value: 'profile', label: 'Hồ sơ', icon: <User className="h-4 w-4" /> },
  { value: 'appearance', label: 'Giao diện', icon: <Sun className="h-4 w-4" /> },
  { value: 'notifications', label: 'Thông báo', icon: <Bell className="h-4 w-4" /> },
  { value: 'workspace', label: 'Workspace', icon: <Database className="h-4 w-4" /> },
  { value: 'data', label: 'Dữ liệu', icon: <AlertTriangle className="h-4 w-4" /> },
];

const TIMEZONES = [
  { value: 'Asia/Ho_Chi_Minh', label: 'Giờ Hồ Chí Minh (GMT+7)' },
  { value: 'Asia/Bangkok', label: 'Giờ Bangkok (GMT+7)' },
  { value: 'Asia/Singapore', label: 'Giờ Singapore (GMT+8)' },
  { value: 'Asia/Tokyo', label: 'Giờ Tokyo (GMT+9)' },
  { value: 'UTC', label: 'UTC (GMT+0)' },
];

const NOTIF_KEY = 'nexus-notif-prefs';

interface NotifPrefs {
  assigned: boolean;
  dueSoon: boolean;
  overdue: boolean;
  mentions: boolean;
}

const DEFAULT_PREFS: NotifPrefs = { assigned: true, dueSoon: true, overdue: true, mentions: true };

function loadPrefs(): NotifPrefs {
  try {
    const raw = localStorage.getItem(NOTIF_KEY);
    if (raw) return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<NotifPrefs>) };
  } catch {
    /* ignore */
  }
  return DEFAULT_PREFS;
}

const NOTIF_ROWS: { key: keyof NotifPrefs; title: string; desc: string }[] = [
  { key: 'assigned', title: 'Được giao nhiệm vụ', desc: 'Nhận thông báo khi ai đó giao nhiệm vụ cho bạn.' },
  { key: 'dueSoon', title: 'Sắp đến hạn', desc: 'Nhắc trước khi nhiệm vụ đến deadline.' },
  { key: 'overdue', title: 'Quá hạn', desc: 'Nhận thông báo khi nhiệm vụ bị quá hạn.' },
  { key: 'mentions', title: 'Nhắc tên trong bình luận', desc: 'Nhận thông báo khi có người nhắc đến bạn.' },
];

export function SettingsPage() {
  const { state, dispatch } = useApp();
  const me = useCurrentUser();
  const [tab, setTab] = useState<TabKey>('profile');

  const [name, setName] = useState(me.name);
  const [title, setTitle] = useState(me.title);
  const [profileError, setProfileError] = useState('');

  const [wsName, setWsName] = useState(state.workspace.name);
  const [wsTz, setWsTz] = useState(state.workspace.timezone);
  const [wsError, setWsError] = useState('');

  const [prefs, setPrefs] = useState<NotifPrefs>(loadPrefs);
  const [confirmReset, setConfirmReset] = useState(false);

  function saveProfile() {
    const n = name.trim();
    if (!n) {
      setProfileError('Vui lòng nhập tên hiển thị.');
      return;
    }
    dispatch({ type: 'USER_UPDATE_PROFILE', id: me.id, name: n, title: title.trim() });
    toast('Đã cập nhật hồ sơ', 'Thông tin cá nhân của bạn đã được lưu.');
  }

  function saveWorkspace() {
    const n = wsName.trim();
    if (!n) {
      setWsError('Vui lòng nhập tên workspace.');
      return;
    }
    dispatch({ type: 'WORKSPACE_UPDATE', name: n, timezone: wsTz });
    toast('Đã cập nhật workspace', `Workspace "${n}" đã được lưu.`);
  }

  function togglePref(key: keyof NotifPrefs, v: boolean) {
    const next = { ...prefs, [key]: v };
    setPrefs(next);
    try {
      localStorage.setItem(NOTIF_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  function handleReset() {
    dispatch({ type: 'RESET_DEMO' });
    setConfirmReset(false);
    setWsName(state.workspace.name);
    setWsTz(state.workspace.timezone);
    toast('Đã khôi phục dữ liệu demo', 'Mọi thay đổi đã được đưa về trạng thái ban đầu.');
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Cài đặt" desc="Quản lý hồ sơ, giao diện, thông báo và dữ liệu của bạn." />

      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === 'profile' && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Hồ sơ cá nhân</CardTitle>
            <CardDescription>Thông tin hiển thị của bạn trong workspace.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex items-center gap-4">
              <Avatar name={name || me.name} size="lg" className="h-20 w-20 text-xl" />
              <div>
                <p className="font-semibold">{name || me.name}</p>
                <p className="text-sm text-muted-foreground">{title || me.title}</p>
              </div>
            </div>
            <Field label="Tên hiển thị" error={profileError}>
              <Input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (profileError) setProfileError('');
                }}
                placeholder="Nhập tên của bạn…"
              />
            </Field>
            <Field label="Chức danh">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ví dụ: Product Manager…" />
            </Field>
            <Field label="Email">
              <Input value={me.email} disabled />
            </Field>
            <div>
              <Button onClick={saveProfile}>Lưu thay đổi</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === 'appearance' && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Giao diện</CardTitle>
            <CardDescription>Chọn chế độ sáng hoặc tối cho toàn bộ ứng dụng.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-4">
              {(
                [
                  { value: 'light', label: 'Sáng', icon: <Sun className="h-5 w-5" /> },
                  { value: 'dark', label: 'Tối', icon: <Moon className="h-5 w-5" /> },
                ] as const
              ).map((opt) => {
                const active = state.theme === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => dispatch({ type: 'SET_THEME', theme: opt.value })}
                    className={cn(
                      'flex flex-col gap-3 rounded-lg border p-4 text-left transition-all',
                      active ? 'border-primary ring-2 ring-primary/20' : 'hover:border-muted-foreground/40',
                    )}
                    aria-pressed={active}
                  >
                    <span className="flex items-center justify-between">
                      <span className="flex items-center gap-2 font-medium">
                        {opt.icon}
                        {opt.label}
                      </span>
                      {active && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="h-3 w-3" />
                        </span>
                      )}
                    </span>
                    <span className={cn('rounded-md border p-3', opt.value === 'dark' ? 'bg-[#0f1420] text-slate-200' : 'bg-white text-slate-800')}>
                      <span className={cn('block h-2 w-2/3 rounded', opt.value === 'dark' ? 'bg-slate-600' : 'bg-slate-200')} />
                      <span className={cn('mt-2 block h-2 w-1/2 rounded', opt.value === 'dark' ? 'bg-indigo-500/40' : 'bg-indigo-100')} />
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-sm text-muted-foreground">Chế độ hiện tại: {state.theme === 'dark' ? 'Tối' : 'Sáng'}.</p>
          </CardContent>
        </Card>
      )}

      {tab === 'notifications' && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Tùy chọn thông báo</CardTitle>
            <CardDescription>Chọn loại thông báo bạn muốn nhận. Tùy chọn được lưu trên trình duyệt này.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col divide-y">
            {NOTIF_ROWS.map((row) => (
              <div key={row.key} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium">{row.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{row.desc}</p>
                </div>
                <Switch checked={prefs[row.key]} onChange={(v) => togglePref(row.key, v)} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {tab === 'workspace' && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Workspace</CardTitle>
            <CardDescription>Cấu hình chung cho không gian làm việc của nhóm.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <Field label="Tên workspace" error={wsError}>
              <Input
                value={wsName}
                onChange={(e) => {
                  setWsName(e.target.value);
                  if (wsError) setWsError('');
                }}
                placeholder="Nhập tên workspace…"
              />
            </Field>
            <Field label="Múi giờ">
              <Select value={wsTz} onChange={(e) => setWsTz(e.target.value)}>
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </Select>
            </Field>
            <div>
              <Button onClick={saveWorkspace}>Lưu thay đổi</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === 'data' && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Dữ liệu</CardTitle>
            <CardDescription>Quản lý dữ liệu demo của ứng dụng.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
              <div className="text-sm">
                <p className="font-semibold">Khôi phục dữ liệu demo</p>
                <p className="mt-1 text-muted-foreground">
                  Tất cả dự án, nhiệm vụ, tài liệu và thay đổi của bạn sẽ bị mất. Dữ liệu mẫu ban đầu sẽ được khôi phục.
                </p>
              </div>
            </div>
            <div>
              <Button variant="destructive" onClick={() => setConfirmReset(true)}>
                Khôi phục dữ liệu demo
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Chế độ demo: dữ liệu được lưu trên trình duyệt của bạn.</p>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={confirmReset}
        title="Khôi phục dữ liệu demo?"
        desc="Toàn bộ thay đổi của bạn (dự án, nhiệm vụ, tài liệu, thành viên…) sẽ bị mất và không thể hoàn tác. Bạn có chắc muốn tiếp tục?"
        confirmLabel="Khôi phục"
        onConfirm={handleReset}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  );
}
