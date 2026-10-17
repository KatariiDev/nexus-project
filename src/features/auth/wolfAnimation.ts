/**
 * Quản lý hoạt ảnh Sói hú trên đỉnh núi (Summit Stage).
 * Tự động tải 60 khung hình trong suốt và keyframes định tuyến đường đi của sói.
 * Khi bị đèn pin chiếu vào, sói sẽ ngẩng đầu hú.
 */

interface RouteKeyframe {
  x: number;
  y: number;
  opacity: number;
  lean: number;
}

interface WolfData {
  fps: number;
  frames: RouteKeyframe[];
}

export function initSummitWolf(stage: HTMLElement): () => void {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const sources = Array.from(
    { length: 60 },
    (_, i) => `/images/wolf-transparent/frame-${String(i).padStart(2, '0')}.png`,
  );

  let ready = false;
  let active = false;
  let departing = false;
  let returnTime = 0;
  let frameId = 0;
  let elapsed = 0;
  let previous = 0;
  let lastFrame = -1;
  let routeFrames: RouteKeyframe[] = [];
  let fps = 30;
  let routeGroup: SVGGElement | null = null;
  let bodyPose: SVGGElement | null = null;
  let frameImage: SVGImageElement | null = null;
  let howlActive = false;
  let howlFrame = 59;
  let howlPhase: 'lowering' | 'raising' | 'holding' = 'lowering';
  let holdTime = 0;
  let frameDelta = 0;
  let destroyed = false;

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  function paint(seconds: number) {
    if (!routeGroup || !bodyPose || !frameImage || routeFrames.length === 0) return;
    const position = Math.min(routeFrames.length - 1, seconds * fps);
    const index = Math.floor(position);
    const a = routeFrames[index];
    const b = routeFrames[Math.min(index + 1, routeFrames.length - 1)];
    const blend = position - index;
    const value = (key: keyof RouteKeyframe) => lerp(a[key], b[key], blend);
    const idle = seconds > 5.8 && !reduced.matches ? Math.sin((seconds - 5.8) * 2.1) * 0.005 : 0;

    routeGroup.setAttribute('transform', `translate(${value('x')} ${value('y')}) scale(.86)`);
    routeGroup.setAttribute('opacity', String(value('opacity')));
    bodyPose.setAttribute('transform', `rotate(${value('lean')}) scale(1 ${1 + idle})`);

    let frame = 0;
    if (seconds < 3.8) frame = Math.min(38, Math.floor((Math.max(0, seconds - 0.7) / 3.1) * 39));
    else if (seconds < 4.4) frame = Math.min(47, 39 + Math.floor(((seconds - 3.8) / 0.6) * 9));
    else frame = Math.min(59, 48 + Math.floor(((seconds - 4.4) / 1.4) * 12));

    const lit = !departing && stage.classList.contains('is-beam-lit');
    if (!departing && seconds >= 5.8 && !reduced.matches && (lit || howlActive)) {
      howlActive = true;
      if (!lit) howlPhase = 'lowering';
      if (howlPhase === 'lowering') {
        howlFrame = Math.max(47, howlFrame - frameDelta * 10);
        if (howlFrame === 47 && lit) howlPhase = 'raising';
      } else if (howlPhase === 'raising') {
        howlFrame = Math.min(59, howlFrame + frameDelta * 10);
        if (howlFrame === 59) {
          howlPhase = 'holding';
          holdTime = 0;
        }
      } else {
        holdTime += frameDelta;
        if (holdTime >= 0.85) howlPhase = 'lowering';
      }
      frame = Math.round(howlFrame);
    }

    if (departing && seconds < 3.8) frame = Math.floor(returnTime * 14) % 18;
    frameImage.setAttribute('transform', departing && seconds < 3.8 ? 'scale(-1 1)' : '');
    if (frame !== lastFrame) {
      frameImage.setAttribute('href', sources[frame]);
      lastFrame = frame;
    }
  }

  function tick(now: number) {
    if (destroyed) return;
    if ((!active && !departing) || !ready) return;
    frameDelta = Math.min(0.06, Math.max(0, (now - previous) / 1000));
    previous = now;
    if (departing) {
      returnTime += frameDelta;
      elapsed = Math.max(0, elapsed - frameDelta * 1.65);
    } else {
      elapsed += frameDelta;
    }
    paint(elapsed);
    if (departing && elapsed === 0) {
      departing = false;
      return;
    }
    frameId = requestAnimationFrame(tick);
  }

  function sync() {
    if (destroyed) return;
    const night = document.body.classList.contains('night');
    const enabled = night && !document.body.classList.contains('night-exiting');
    if (enabled === active && (night || !departing)) return;
    const wasDeparting = departing;
    active = enabled;
    cancelAnimationFrame(frameId);
    if (!ready) return;
    if (!enabled) {
      departing = night && !reduced.matches && elapsed > 0;
      if (!departing) {
        return;
      }
      elapsed = Math.min(elapsed, 5.8);
      if (howlActive) elapsed = 4.4 + (Math.max(0, howlFrame - 48) / 12) * 1.4;
      howlActive = false;
      returnTime = 0;
      previous = performance.now();
      frameId = requestAnimationFrame(tick);
      return;
    }
    departing = false;
    howlActive = false;
    howlFrame = 59;
    howlPhase = 'lowering';
    holdTime = 0;
    frameDelta = 0;
    elapsed = reduced.matches ? 5.8 : wasDeparting ? elapsed : 0;
    paint(elapsed);
    previous = performance.now();
    if (!reduced.matches) frameId = requestAnimationFrame(tick);
  }

  // Load keyframes JSON & preload wolf images
  fetch('/images/wolf-frames/keyframes.json')
    .then((res) => res.json())
    .then((data: WolfData) => {
      if (destroyed) return;
      const svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('viewBox', '0 0 400 500');
      svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
      svg.setAttribute('aria-hidden', 'true');

      routeGroup = document.createElementNS(SVG_NS, 'g');
      bodyPose = document.createElementNS(SVG_NS, 'g');
      frameImage = document.createElementNS(SVG_NS, 'image');
      frameImage.setAttribute('x', '-62.5');
      frameImage.setAttribute('y', '-84.375');
      frameImage.setAttribute('width', '125');
      frameImage.setAttribute('height', '90.625');

      bodyPose.append(frameImage);
      routeGroup.append(bodyPose);
      svg.append(routeGroup);
      stage.replaceChildren(svg);

      routeFrames = data.frames;
      fps = data.fps;
      ready = true;
      active = false;
      sync();
    })
    .catch((err) => console.warn('Không tải được tài nguyên sói:', err));

  const observer = new MutationObserver(sync);
  observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

  const onVisibilityChange = () => {
    previous = performance.now();
  };

  const onReducedChange = () => {
    cancelAnimationFrame(frameId);
    if (!ready || !active) return;
    if (reduced.matches) {
      elapsed = 5.8;
      paint(elapsed);
    } else {
      previous = performance.now();
      frameId = requestAnimationFrame(tick);
    }
  };

  document.addEventListener('visibilitychange', onVisibilityChange);
  reduced.addEventListener('change', onReducedChange);

  return () => {
    destroyed = true;
    cancelAnimationFrame(frameId);
    observer.disconnect();
    document.removeEventListener('visibilitychange', onVisibilityChange);
    reduced.removeEventListener('change', onReducedChange);
    stage.replaceChildren();
  };
}

