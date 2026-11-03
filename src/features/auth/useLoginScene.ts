import { useEffect, useRef, useState } from 'react';
import { initHalloweenSpider } from './spiderAnimation';
import { initSummitWolf } from './wolfAnimation';
import { initHalloweenVines, type VineController } from './vinesAnimation';

/**
 * Logic khung cảnh trang đăng nhập: theme ngày/đêm, SVG, hoạt ảnh
 * (nhện/sói/dây leo), đèn pin soi mật khẩu, phù thủy bay.
 * Nhận `password` hiện tại để vẽ lại ký tự soi khi bật/tắt đèn pin.
 */
export function useLoginScene(password: string) {
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

  // Cập nhật ký tự soi khi người dùng gõ mật khẩu (phần scene; setPassword ở LoginPage).
  const syncPasswordReveal = (val: string) => {
    if (nightMode && flashlightOn) {
      renderPasswordChars(val);
      updateFlashlightBeam();
    }
  };

  return {
    nightMode,
    flashlightOn,
    cardRef,
    spiderCanvasRef,
    wolfStageRef,
    vinesHostRef,
    skyWitchRef,
    passwordInputRef,
    toggleEyeRef,
    flashBeamRef,
    flashlightRef,
    passwordRevealRef,
    revealTextRef,
    emailOwlRef,
    handleToggleNight,
    handleTogglePassword,
    syncPasswordReveal,
  };
}
