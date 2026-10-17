import React, { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { signInWithDiscord, signInWithEmailAndPassword } from './authService';
import { initHalloweenSpider } from './spiderAnimation';
import { initSummitWolf } from './wolfAnimation';
import { initHalloweenVines, type VineController } from './vinesAnimation';
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
  const [nightMode, setNightMode] = useState(false);
  const [flashlightOn, setFlashlightOn] = useState(false);

  const cardRef = useRef<HTMLElement | null>(null);
  const spiderCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const wolfStageRef = useRef<HTMLDivElement | null>(null);
  const vinesHostRef = useRef<HTMLDivElement | null>(null);
  const vineControllerRef = useRef<VineController | null>(null);

  const passwordInputRef = useRef<HTMLInputElement | null>(null);
  const toggleEyeRef = useRef<HTMLButtonElement | null>(null);
  const flashBeamRef = useRef<HTMLDivElement | null>(null);
  const flashlightRef = useRef<HTMLDivElement | null>(null);
  const passwordRevealRef = useRef<HTMLDivElement | null>(null);
  const revealTextRef = useRef<HTMLSpanElement | null>(null);
  const emailOwlRef = useRef<HTMLDivElement | null>(null);
  const skyWitchRef = useRef<HTMLSpanElement | null>(null);

  const cursorRef = useRef({ x: 0, y: 0 });
  const beamAngleRef = useRef(Math.PI);
  const nightModeRef = useRef(nightMode);
  const flashlightOnRef = useRef(flashlightOn);

  useEffect(() => {
    nightModeRef.current = nightMode;
  }, [nightMode]);

  useEffect(() => {
    flashlightOnRef.current = flashlightOn;
  }, [flashlightOn]);

  // Khởi tạo theme, SVG icons, và các hoạt ảnh
  useEffect(() => {
    document.body.classList.add('login-active');

    // Nạp mặt nạ CSS
    document.documentElement.style.setProperty('--sky-mask', 'url("/images/sky-mask.svg")');
    document.documentElement.style.setProperty('--beam-mask', 'url("/images/beam-mask.svg")');

    // Chèn nội dung SVG trực tiếp vào placeholder [data-svg] để các CSS animation có hiệu lực
    const loadSvgPlaceholders = async () => {
      const placeholders = document.querySelectorAll<HTMLElement>('[data-svg]');
      const cache = new Map<string, string>();
      for (const el of Array.from(placeholders)) {
        const path = el.dataset.svg;
        if (!path) continue;
        try {
          if (!cache.has(path)) {
            const res = await fetch(path);
            const text = await res.text();
            cache.set(path, text);
          }
          const svgContent = cache.get(path);
          if (svgContent && el.isConnected) {
            const doc = new DOMParser().parseFromString(svgContent, 'image/svg+xml');
            const svgNode = doc.documentElement;
            if (svgNode) {
              el.replaceWith(document.importNode(svgNode, true));
            }
          }
        } catch {
          // ignore placeholder load errors
        }
      }
    };
    loadSvgPlaceholders();

    // Khởi tạo hoạt ảnh nhện
    let cleanupSpider = () => {};
    if (spiderCanvasRef.current) {
      cleanupSpider = initHalloweenSpider(spiderCanvasRef.current);
    }

    // Khởi tạo hoạt ảnh sói trên đỉnh núi
    let cleanupWolf = () => {};
    if (wolfStageRef.current) {
      cleanupWolf = initSummitWolf(wolfStageRef.current);
    }

    // Khởi tạo hoạt ảnh dây leo
    if (vinesHostRef.current && cardRef.current) {
      vineControllerRef.current = initHalloweenVines(vinesHostRef.current, cardRef.current);
    }

    return () => {
      document.body.classList.remove('login-active', 'night', 'night-exiting', 'flashlight-on');
      cleanupSpider();
      cleanupWolf();
      if (vineControllerRef.current) {
        vineControllerRef.current.cleanup();
      }
    };
  }, []);

  // Tính toán đường bay của phù thủy theo kích thước thẻ đăng nhập
  useEffect(() => {
    const updateWitchRoute = () => {
      const card = cardRef.current;
      const witch = skyWitchRef.current;
      if (!card || !witch || !witch.parentElement) return;
      const cardBounds = card.getBoundingClientRect();
      const skyBounds = witch.parentElement.getBoundingClientRect();
      const width = parseFloat(getComputedStyle(witch).width) || 100;
      witch.style.setProperty('--witch-left', `${Math.max(6, cardBounds.left - skyBounds.left - 94)}px`);
      witch.style.setProperty(
        '--witch-right',
        `${Math.min(skyBounds.width - width - 6, cardBounds.right - skyBounds.left + 94 - width)}px`,
      );
      witch.style.setProperty('--witch-top', `${Math.max(16, cardBounds.top - skyBounds.top - 150)}px`);
    };

    updateWitchRoute();
    window.addEventListener('resize', updateWitchRoute);
    return () => window.removeEventListener('resize', updateWitchRoute);
  }, []);

  // Điều khiển chế độ Night / Day
  const handleToggleNight = () => {
    const next = !nightMode;
    setNightMode(next);
    document.body.classList.toggle('night', next);

    if (vineControllerRef.current) {
      vineControllerRef.current.setNightMode(next);
    }

    // Tắt đèn pin khi chuyển về ban ngày
    if (!next) {
      setFlashlightOn(false);
      document.body.classList.remove('flashlight-on');
      if (passwordInputRef.current) passwordInputRef.current.type = 'password';
    }
  };

  // Cập nhật vị trí chùm đèn pin và soi mật khẩu
  const updateFlashlightBeam = () => {
    if (!nightModeRef.current || !flashlightOnRef.current) return;
    const toggle = toggleEyeRef.current;
    const input = passwordInputRef.current;
    const beam = flashBeamRef.current;
    const flashlight = flashlightRef.current;
    const overlay = passwordRevealRef.current;
    const revealText = revealTextRef.current;
    const owl = emailOwlRef.current;
    if (!toggle || !input || !beam || !flashlight || !overlay || !revealText) return;

    const eyeRect = toggle.getBoundingClientRect();
    const fieldRect = input.getBoundingClientRect();
    const eyeX = eyeRect.left + eyeRect.width / 2;
    const eyeY = eyeRect.top + eyeRect.height / 2;
    const pointerDistance = Math.hypot(cursorRef.current.x - eyeX, cursorRef.current.y - eyeY);
    if (pointerDistance > 24) {
      beamAngleRef.current = Math.atan2(cursorRef.current.y - eyeY, cursorRef.current.x - eyeX);
    }
    const angleDeg = (beamAngleRef.current * 180) / Math.PI;
    const unitX = Math.cos(beamAngleRef.current);
    const unitY = Math.sin(beamAngleRef.current);
    const originX = eyeX + unitX * 13;
    const originY = eyeY + unitY * 13;
    const beamLength = Math.max(160, Math.min(1600, pointerDistance * 1.65));
    const beamHeight = beamLength * 0.38;

    beam.style.left = `${originX}px`;
    beam.style.top = `${originY - beamHeight / 2}px`;
    beam.style.width = `${beamLength}px`;
    beam.style.height = `${beamHeight}px`;
    beam.style.transform = `rotate(${angleDeg}deg)`;

    flashlight.style.left = `${eyeX - 17}px`;
    flashlight.style.top = `${eyeY - 17}px`;
    flashlight.style.transform = `rotate(${angleDeg}deg)`;

    overlay.style.left = `${fieldRect.left}px`;
    overlay.style.top = `${fieldRect.top}px`;
    overlay.style.width = `${Math.max(0, fieldRect.width - 45)}px`;
    overlay.style.height = `${fieldRect.height}px`;
    revealText.style.transform = `translateX(${-input.scrollLeft}px)`;

    const getLightLevel = (x: number, y: number) => {
      const offsetX = x - originX;
      const offsetY = y - originY;
      const along = offsetX * unitX + offsetY * unitY;
      const sideways = Math.abs(-offsetX * unitY + offsetY * unitX);
      const halfBeam = beamHeight * (0.01 + (0.49 * Math.max(0, along)) / beamLength);
      const edgeFade = Math.max(0, Math.min(1, (halfBeam - sideways + 4) / 16));
      const tail = Math.max(0, Math.min(1, (along / beamLength - 0.55) / 0.41));
      const endFade = 1 - tail * tail * (3 - 2 * tail);
      return along >= 0 ? edgeFade * endFade : 0;
    };

    // Chiếu sáng từng ký tự mật khẩu
    for (const charNode of Array.from(revealText.children) as HTMLElement[]) {
      const bounds = charNode.getBoundingClientRect();
      const level = getLightLevel(bounds.left + bounds.width / 2, fieldRect.top + fieldRect.height / 2);
      charNode.style.setProperty('--lit', String(level));
    }

    // Ánh mắt con cú nhìn theo đèn
    if (owl) {
      const owlBounds = owl.getBoundingClientRect();
      const owlX = owlBounds.left + owlBounds.width / 2;
      const owlY = owlBounds.top + owlBounds.height / 2;
      const owlLight = getLightLevel(owlX, owlY);
      owl.style.opacity = String(owlLight);
      const dx = originX - owlX;
      const dy = originY - (owlBounds.top + owlBounds.height * 0.36);
      const distance = Math.max(1, Math.hypot(dx, dy));
      const lit = owlLight > 0.08;
      const gazeX = lit ? dx / distance : 0;
      const gazeY = lit ? dy / distance : 0;
      owl.classList.toggle('is-lit', lit);
      owl.style.setProperty('--owl-gaze-x', `${gazeX * 70}px`);
      owl.style.setProperty('--owl-gaze-y', `${gazeY * 45}px`);
      owl.style.setProperty('--owl-head-x', `${gazeX * 22}px`);
      owl.style.setProperty('--owl-head-y', `${gazeY * 12}px`);
      owl.style.setProperty('--owl-tilt', `${gazeX * 5}deg`);
    }

    // Chiếu đèn lên sói trên đỉnh núi
    const summitStage = wolfStageRef.current;
    if (summitStage) {
      const wolfImg = summitStage.querySelector('image');
      if (wolfImg) {
        const bounds = wolfImg.getBoundingClientRect();
        const level = getLightLevel(bounds.left + bounds.width * 0.6, bounds.top + bounds.height * 0.5);
        const threshold = summitStage.classList.contains('is-beam-lit') ? 0.06 : 0.14;
        summitStage.classList.toggle('is-beam-lit', level > threshold);
      }
    }

    // Chiếu đèn lên bí ngô và lá dây leo
    if (vineControllerRef.current) {
      vineControllerRef.current.updateBeamLight(originX, originY, getLightLevel);
    }
  };

  // Render các ký tự mật khẩu ẩn / hiện
  const renderPasswordChars = (val: string) => {
    const container = revealTextRef.current;
    if (!container) return;
    container.replaceChildren(
      ...Array.from(val, (letter) => {
        const span = document.createElement('span');
        span.className = 'reveal-char';
        const masked = document.createElement('span');
        masked.className = 'masked-char';
        masked.textContent = '•';
        const plain = document.createElement('span');
        plain.className = 'plain-char';
        plain.textContent = letter;
        span.append(masked, plain);
        return span;
      }),
    );
  };

  // Bật / Tắt soi mật khẩu
  const handleTogglePassword = () => {
    const next = !flashlightOn;
    setFlashlightOn(next);

    if (nightMode) {
      document.body.classList.toggle('flashlight-on', next);
      if (next) {
        renderPasswordChars(password);
        if (passwordInputRef.current) {
          const rect = passwordInputRef.current.getBoundingClientRect();
          beamAngleRef.current = Math.PI;
          cursorRef.current = { x: rect.left, y: rect.top + rect.height / 2 };
        }
        updateFlashlightBeam();
      } else {
        if (revealTextRef.current) revealTextRef.current.replaceChildren();
        if (wolfStageRef.current) wolfStageRef.current.classList.remove('is-beam-lit');
        if (emailOwlRef.current) {
          emailOwlRef.current.style.opacity = '0';
          emailOwlRef.current.classList.remove('is-lit');
        }
      }
    } else {
      // Ở chế độ ban ngày: chuyển đổi text / password thông thường
      if (passwordInputRef.current) {
        passwordInputRef.current.type = next ? 'text' : 'password';
      }
    }
  };

  // Lắng nghe pointer di chuyển khi đang bật đèn pin
  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      if (!nightModeRef.current || !flashlightOnRef.current) return;
      cursorRef.current = { x: e.clientX, y: e.clientY };
      updateFlashlightBeam();
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('resize', updateFlashlightBeam);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('resize', updateFlashlightBeam);
    };
  }, []);

  // Cập nhật ký tự soi khi người dùng gõ mật khẩu
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPassword(val);
    if (nightMode && flashlightOn) {
      renderPasswordChars(val);
      updateFlashlightBeam();
    }
  };

  // Xử lý nút Discord Gatekeeper
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
          <section className="scene-panel" aria-labelledby="welcome-title">
            <div className="landscape-scene" aria-hidden="true">
              <div className="scene-sky-objects">
                <div className="scene-sun"></div>
                <div className="scene-moon"></div>
              </div>
              <img className="scene-land scene-day" src="/images/panel-day.svg" alt="" />
              <img className="scene-land scene-night" src="/images/panel-night.svg" alt="" />
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
              </div>
            </div>

            {/* Sân khấu sói hú */}
            <div className="summit-stage" ref={wolfStageRef} aria-hidden="true"></div>

            {/* Nút chuyển đổi Ngày / Đêm Halloween */}
            <button
              className="theme-toggle"
              id="theme-toggle"
              type="button"
              aria-pressed={nightMode}
              aria-label={nightMode ? 'Trở về ban ngày' : 'Bật đêm Halloween'}
              onClick={handleToggleNight}
            >
              <span className="theme-toggle-thumb" aria-hidden="true"></span>
              <span data-svg="/images/icon-sun.svg" aria-hidden="true"></span>
              <span data-svg="/images/icon-moon.svg" aria-hidden="true"></span>
            </button>

            {/* Thông điệp chào mừng */}
            <div className="scene-copy">
              <h2 id="welcome-title">Nexus Project</h2>
              <p>Quản lý dự án, Kanban & Gantt timeline thời gian thực cho đội ngũ Ban Công Nghệ.</p>
            </div>
          </section>

          {/* Cột phải: Form đăng nhập */}
          <section className="form-panel">
            <form className="login-form" id="login-form" onSubmit={handleSubmit}>
              <div className="login-header-group">
                <h1 className="login-title" id="login-title">Đăng nhập</h1>
                <p className="login-subtitle">Không gian làm việc nội bộ Ban Công Nghệ</p>
              </div>

              {/* Nút đăng nhập Discord Gatekeeper */}
              <button
                type="button"
                className="discord-btn"
                onClick={handleDiscordLogin}
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
                  onChange={(e) => setEmail(e.target.value)}
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
                  onChange={handlePasswordChange}
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
                  onClick={handleTogglePassword}
                >
                  <img src="/images/icon-eye.svg" alt="" width="18" height="18" />
                </button>
              </div>

              {/* Quên mật khẩu */}
              <button
                className="text-action forgot"
                id="forgot-password"
                type="button"
                onClick={() =>
                  setError('Vui lòng liên hệ Trưởng nhóm kỹ thuật (Dev/Admin) để được cấp lại mật khẩu nội bộ.')
                }
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
