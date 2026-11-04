import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { signInWithDiscord, signInWithEmailAndPassword } from './authService';
import { useLoginScene } from './useLoginScene';
import { LoginScene } from './LoginScene';
import { LoginForm } from './LoginForm';
import './login-theme.css';

export function LoginPage() {
  const navigate = useNavigate();
  const { state, loginDev } = useApp();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(() => {
    try {
      const savedAuthError = sessionStorage.getItem('nexus_auth_error');
      if (savedAuthError) {
        sessionStorage.removeItem('nexus_auth_error');
        return savedAuthError;
      }
    } catch {
      // ignore
    }
    return '';
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const scene = useLoginScene(password);
  // Destructure các ref dùng trong JSX để oxlint không cảnh báo "access refs during render".
  const {
    cardRef,
    spiderCanvasRef,
    vinesHostRef,
    skyWitchRef,
    flashBeamRef,
    flashlightRef,
    passwordRevealRef,
    revealTextRef,
  } = scene;

  // Cập nhật ký tự soi khi người dùng gõ mật khẩu
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPassword(val);
    scene.syncPasswordReveal(val);
  };

  const handleForgotPassword = () => {
    setError('Vui lòng liên hệ Trưởng nhóm kỹ thuật (Dev/Admin) để được cấp lại mật khẩu nội bộ.');
  };

  const handleDiscordLogin = async () => {
    setError('');
    setIsSubmitting(true);
    try {
      const res = await signInWithDiscord();
      if (!res.success && res.error) {
        setError(res.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định khi kết nối Discord.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Xử lý gửi form đăng nhập dự phòng bằng Email + Mật khẩu
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Vui lòng nhập Email.');
      return;
    }
    if (!cleanEmail.includes('@')) {
      setError('Vui lòng nhập đúng định dạng Email.');
      return;
    }
    if (!password) {
      setError('Vui lòng nhập Mật khẩu.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await signInWithEmailAndPassword(cleanEmail, password);
      if (!res.success) {
        setError(res.error || 'Đăng nhập không thành công.');
        return;
      }

      if (res.isDev) {
        loginDev?.(cleanEmail);
        navigate('/', { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đã xảy ra lỗi khi đăng nhập.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (state.authed && !state.loading) {
    return <Navigate to="/" replace />;
  }

  return (
    <>
      {/* Khung cảnh nền toàn trang */}
      <div className="landscape-scene page-landscape" aria-hidden="true">
        <img className="scene-land scene-day" src="/images/background-day.svg" alt="" />
        <img className="scene-land scene-night" src="/images/background-night.svg" alt="" />
        <div className="sky-flight" aria-hidden="true">
          <span className="sky-bat bat-1">
            <span className="flyer-facing">
              <span data-svg="/images/bat.svg" aria-hidden="true"></span>
            </span>
          </span>
          <span className="sky-bat bat-2">
            <span className="flyer-facing">
              <span data-svg="/images/bat.svg" aria-hidden="true"></span>
            </span>
          </span>
          <span className="sky-bat bat-3">
            <span className="flyer-facing">
              <span data-svg="/images/bat.svg" aria-hidden="true"></span>
            </span>
          </span>
          <span className="sky-bat bat-4">
            <span className="flyer-facing">
              <span data-svg="/images/bat.svg" aria-hidden="true"></span>
            </span>
          </span>
          <span className="sky-bat bat-5">
            <span className="flyer-facing">
              <span data-svg="/images/bat.svg" aria-hidden="true"></span>
            </span>
          </span>
          <span className="sky-bat bat-6">
            <span className="flyer-facing">
              <span data-svg="/images/bat.svg" aria-hidden="true"></span>
            </span>
          </span>
          <span className="sky-witch" ref={skyWitchRef}>
            <span className="flyer-facing">
              <img src="/images/witch.svg" alt="" width="3600" height="3400" draggable="false" />
            </span>
          </span>
        </div>
      </div>

      {/* Vỏ bao bọc khung đăng nhập */}
      <div className="login-shell">
        <div className="halloween-vines" id="halloween-vines" ref={vinesHostRef} aria-hidden="true"></div>

        <main className="login-card" ref={cardRef} aria-labelledby="login-title">
          {/* Cột trái: Cảnh núi và Đỉnh sói hú */}
          <LoginScene
            wolfStageRef={scene.wolfStageRef}
            nightMode={scene.nightMode}
            onToggleNight={scene.handleToggleNight}
          />

          {/* Cột phải: Form đăng nhập */}
          <LoginForm
            email={email}
            password={password}
            error={error}
            isSubmitting={isSubmitting}
            flashlightOn={scene.flashlightOn}
            passwordInputRef={scene.passwordInputRef}
            toggleEyeRef={scene.toggleEyeRef}
            emailOwlRef={scene.emailOwlRef}
            onEmailChange={setEmail}
            onPasswordChange={handlePasswordChange}
            onTogglePassword={scene.handleTogglePassword}
            onDiscordLogin={handleDiscordLogin}
            onSubmit={handleSubmit}
            onForgotPassword={handleForgotPassword}
          />
        </main>
      </div>

      {/* Canvas vẽ Nhện Halloween */}
      <canvas id="halloween-spider" ref={spiderCanvasRef} aria-hidden="true"></canvas>

      {/* Chùm sáng đèn pin */}
      <div className="flash-beam" id="flash-beam" ref={flashBeamRef} aria-hidden="true"></div>

      {/* Lớp hiển thị chữ mật khẩu phát sáng */}
      <div className="password-reveal" id="password-reveal" ref={passwordRevealRef} aria-hidden="true">
        <span id="reveal-text" ref={revealTextRef}></span>
      </div>

      {/* Cây đèn pin di động */}
      <div className="flashlight" id="flashlight" ref={flashlightRef} aria-hidden="true">
        <img src="/images/flashlight.svg" alt="" width="33" height="33" />
      </div>
    </>
  );
}
