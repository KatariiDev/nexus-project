import type { RefObject } from 'react';

interface LoginFormProps {
  email: string;
  password: string;
  error: string;
  isSubmitting: boolean;
  flashlightOn: boolean;
  passwordInputRef: RefObject<HTMLInputElement | null>;
  toggleEyeRef: RefObject<HTMLButtonElement | null>;
  emailOwlRef: RefObject<HTMLDivElement | null>;
  onEmailChange: (value: string) => void;
  onPasswordChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onTogglePassword: () => void;
  onDiscordLogin: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onForgotPassword: () => void;
}

/** Cột phải trang đăng nhập: nút Discord, form email + mật khẩu (kèm cú/đèn pin). */
export function LoginForm({
  email,
  password,
  error,
  isSubmitting,
  flashlightOn,
  passwordInputRef,
  toggleEyeRef,
  emailOwlRef,
  onEmailChange,
  onPasswordChange,
  onTogglePassword,
  onDiscordLogin,
  onSubmit,
  onForgotPassword,
}: LoginFormProps) {
  return (
<section className="form-panel">
<form className="login-form" id="login-form" onSubmit={onSubmit}>
  <div className="login-header-group">
    <h1 className="login-title" id="login-title">Đăng nhập</h1>
    <p className="login-subtitle">Không gian làm việc nội bộ Ban Công Nghệ</p>
  </div>

  {/* Nút đăng nhập Discord Gatekeeper */}
  <button
    type="button"
    className="discord-btn"
    onClick={onDiscordLogin}
    disabled={isSubmitting}
    title="Chỉ thành viên thuộc Discord Server nội bộ mới được cấp quyền vào web"
  >
    <svg className="discord-icon" viewBox="0 0 127.14 96.36">
      <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,45.91,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,45.91,96.12,53,91.08,65.69,84.69,65.69Z" />
    </svg>
    <span>{isSubmitting ? 'Đang kết nối...' : 'Đăng nhập với Discord'}</span>
  </button>

  {/* Dòng kẻ ngăn cách */}
  <div className="auth-divider">
    <span>hoặc</span>
  </div>

  {/* Ô Email dự phòng (Kèm cú theo dõi) */}
  <div className="field">
    <label className="sr-only" htmlFor="email">
      Email dự phòng
    </label>
    <input
      id="email"
      name="email"
      type="email"
      placeholder="Email"
      autoComplete="email"
      value={email}
      onChange={(e) => onEmailChange(e.target.value)}
      required
    />
    <div className="email-owl" id="email-owl" ref={emailOwlRef} aria-hidden="true">
      <span data-svg="/images/owl.svg" aria-hidden="true"></span>
    </div>
  </div>

  {/* Ô Mật khẩu (Kèm đèn pin soi) */}
  <div className="field password">
    <label className="sr-only" htmlFor="password">
      Mật khẩu
    </label>
    <input
      ref={passwordInputRef}
      id="password"
      name="password"
      type="password"
      placeholder="Mật khẩu"
      autoComplete="current-password"
      value={password}
      onChange={onPasswordChange}
      required
    />
    <button
      ref={toggleEyeRef}
      className="eye"
      id="show-password"
      type="button"
      aria-label={flashlightOn ? 'Tắt đèn pin' : 'Hiện mật khẩu'}
      aria-pressed={flashlightOn}
      aria-controls="password"
      onClick={onTogglePassword}
    >
      <img src="/images/icon-eye.svg" alt="" width="18" height="18" />
    </button>
  </div>

  {/* Quên mật khẩu */}
  <button
    className="text-action forgot"
    id="forgot-password"
    type="button"
    onClick={onForgotPassword}
  >
    Quên mật khẩu?
  </button>

  {/* Nút gửi form */}
  <button className="submit" type="submit" disabled={isSubmitting}>
    <span>{isSubmitting ? 'Đang xác thực...' : 'Đăng nhập'}</span>
    <img src="/images/icon-arrow.svg" alt="" width="17" height="17" />
  </button>

  {/* Thông báo lỗi hoặc trạng thái */}
  {error && <p className="status-msg error">{error}</p>}
</form>
</section>
  );
}
