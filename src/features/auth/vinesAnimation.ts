/**
 * Quản lý hoạt ảnh Dây leo Halloween (Halloween Vines).
 * Tự động tải SVG dây leo, khớp tọa độ bám quanh thẻ đăng nhập (.login-card)
 * và co giãn mượt mà khi đổi kích thước hoặc chuyển đổi Day/Night mode.
 */

interface VineKeyframeDash {
  dash: number;
}
interface VineKeyframeTransform {
  opacity: number;
  angle: number;
  scale: number;
}
type VineKeyframe = VineKeyframeDash | VineKeyframeTransform;

export interface VineController {
  setNightMode: (enabled: boolean) => void;
  updateBeamLight: (originX: number, originY: number, getLightLevel: (x: number, y: number) => number) => void;
  cleanup: () => void;
}

export function initHalloweenVines(host: HTMLElement, card: HTMLElement): VineController {
  let vineNodes: Element[] = [];
  let vineFrames: VineKeyframe[][] = [];
  let vineProgress = 0;
  let vineTarget = 0;
  let vineAnimation = 0;
  let vineReady = false;
  let destroyed = false;

  interface LeafState {
    node: HTMLElement | SVGElement;
    strength: number;
    target: number;
    phase: number;
  }
  let leafStates: LeafState[] = [];
  let leafAnimation = 0;
  let leafPrevious = 0;

  const reducedVineMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function animateLitLeaves() {
    if (leafAnimation || reducedVineMotion.matches) return;
    leafPrevious = performance.now();

    function tick(now: number) {
      if (destroyed) return;
      const dt = Math.min((now - leafPrevious) / 1000, 0.06);
      leafPrevious = now;
      let moving = false;
      leafStates.forEach((leaf, index) => {
        const easing = 1 - Math.exp(-dt / (leaf.target > leaf.strength ? 0.22 : 0.45));
        leaf.strength += (leaf.target - leaf.strength) * easing;
        leaf.phase += dt * (2.6 + (index % 4) * 0.23);
        const angle = (Math.sin(leaf.phase) * 7 + Math.sin(leaf.phase * 1.7) * 1.4) * leaf.strength;
        if (leaf.strength > 0.002 || leaf.target > 0) {
          leaf.node.style.transform = `rotate(${angle.toFixed(3)}deg)`;
          moving = true;
        } else {
          leaf.strength = 0;
          leaf.node.style.removeProperty('transform');
        }
      });
      leafAnimation = moving ? requestAnimationFrame(tick) : 0;
    }
    leafAnimation = requestAnimationFrame(tick);
  }

  function paintVineFrame(progress: number) {
    if (!vineReady || destroyed) return;
    const position = progress * (vineFrames.length - 1);
    const first = Math.floor(position);
    const second = Math.min(first + 1, vineFrames.length - 1);
    const mix = position - first;

    vineNodes.forEach((node, index) => {
      const a = vineFrames[first][index];
      const b = vineFrames[second][index];
      if ('dash' in a && 'dash' in b) {
        const dash = a.dash + (b.dash - a.dash) * mix;
        node.setAttribute('stroke-dashoffset', dash.toFixed(2));
        node.setAttribute('opacity', dash >= 999.99 ? '0' : '1');
      } else if ('opacity' in a && 'opacity' in b) {
        const interpolate = (key: 'opacity' | 'angle' | 'scale') => a[key] + (b[key] - a[key]) * mix;
        node.setAttribute('opacity', interpolate('opacity').toFixed(3));
        node.setAttribute(
          'transform',
          `rotate(${interpolate('angle').toFixed(2)}) scale(${interpolate('scale').toFixed(4)})`,
        );
      }
    });
  }

  function animateVines(enabled: boolean) {
    vineTarget = enabled ? 1 : 0;
    cancelAnimationFrame(vineAnimation);
    if (!vineReady || destroyed) return;
    if (reducedVineMotion.matches) {
      vineProgress = vineTarget;
      paintVineFrame(vineProgress);
      return;
    }
    let previous: number | undefined;
    function tick(now: number) {
      if (destroyed) return;
      if (previous !== undefined) {
        const step = Math.min(now - previous, 50) / 3600;
        vineProgress = vineTarget ? Math.min(1, vineProgress + step) : Math.max(0, vineProgress - step);
      }
      previous = now;
      paintVineFrame(vineProgress);
      if (vineProgress !== vineTarget) vineAnimation = requestAnimationFrame(tick);
    }
    vineAnimation = requestAnimationFrame(tick);
  }

  function fitVineArtwork(svg: SVGSVGElement) {
    const main = [...svg.querySelectorAll<SVGGElement>('[data-layout="main"]')];
    const branches = [...svg.querySelectorAll<SVGGElement>('[data-layout="branch"]')];
    const ornaments = [...svg.querySelectorAll<SVGGElement>('[data-layout="ornament"]')];
    const numbers = /-?\d+(?:\.\d+)?/g;
    const rootOf = (group: SVGGElement) =>
      group.dataset.path!.match(numbers)!.slice(0, 2).map(Number) as [number, number];

    function resize() {
      if (destroyed) return;
      const { width, height } = host.getBoundingClientRect();
      if (!width || !height) return;
      const unit = Math.min(width / 1000, height / 620);
      const bounds = card.getBoundingClientRect();
      const frame = host.getBoundingClientRect();
      const left = bounds.left - frame.left;
      const top = bounds.top - frame.top;
      const right = bounds.right - frame.left;
      const bottom = bounds.bottom - frame.top;
      const radius = parseFloat(getComputedStyle(card).borderTopLeftRadius) || 32;

      const interpolate = (value: number, source: number[], target: number[]) => {
        const i = value < source[1] ? 0 : value > source[2] ? 2 : 1;
        return target[i] + ((value - source[i]) * (target[i + 1] - target[i])) / (source[i + 1] - source[i]);
      };
      const map = (x: number, y: number): [number, number] => [
        interpolate(x, [58, 98, 902, 942], [left, left + radius, right - radius, right]),
        interpolate(y, [55, 95, 537, 565], [top, top + radius, bottom - radius, bottom]),
      ];

      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

      function draw(group: SVGGElement, mapping: (cx: number, cy: number) => [number, number]) {
        const values = group.dataset.path!.match(numbers)!.map(Number);
        let n = 0;
        const path = group.dataset.path!.replace(numbers, () => {
          const coordinate = n % 2;
          const at = n - coordinate;
          const point = mapping(values[at], values[at + 1]);
          n++;
          return point[coordinate].toFixed(3);
        });
        for (const node of group.children) {
          node.setAttribute('d', path);
          node.setAttribute('stroke-width', String(Number(group.dataset.width || 1) * unit));
        }
      }

      main.forEach((group) => draw(group, map));

      const samples = main.flatMap((group) => {
        const path = group.firstElementChild as SVGGeometryElement | null;
        if (!path || !path.getTotalLength) return [];
        const length = path.getTotalLength();
        return Array.from({ length: 401 }, (_, i) => path.getPointAtLength((length * i) / 400));
      });

      const attach = (x: number, y: number): [number, number] => {
        const [px, py] = map(x, y);
        if (samples.length === 0) return [px, py];
        const closest = samples.reduce(
          (best, point) =>
            (point.x - px) ** 2 + (point.y - py) ** 2 < (best.x - px) ** 2 + (best.y - py) ** 2 ? point : best,
          samples[0],
        );
        return [closest.x, closest.y];
      };

      branches.forEach((group) => {
        const [x, y] = rootOf(group);
        const [px, py] = attach(x, y);
        draw(group, (cx, cy) => [px + (cx - x) * unit, py + (cy - y) * unit]);
      });

      ornaments.forEach((group) => {
        const { art, x, y, scale, rotation } = group.dataset;
        if (!art || !x || !y) return;
        let point: [number, number] = art === 'pumpkin' ? map(+x, +y) : attach(+x, +y);
        if (group.dataset.branchRootX !== undefined) {
          const rx = Number(group.dataset.branchRootX);
          const ry = Number(group.dataset.branchRootY);
          const anchor = attach(rx, ry);
          point = [anchor[0] + (+x - rx) * unit, anchor[1] + (+y - ry) * unit];
        }
        if (art === 'lantern') {
          const root = +x < 500 ? [65, 219] : [946, 300];
          const anchor = attach(root[0], root[1]);
          point = [anchor[0] + (+x - root[0]) * unit, anchor[1] + (+y - root[1]) * unit];
        }
        group.setAttribute(
          'transform',
          `translate(${point[0]} ${point[1]}) rotate(${rotation || 0}) scale(${Number(scale || 1) * unit})`,
        );
      });
    }

    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
  }

  // Load Vine SVG artwork and keyframes JSON
  Promise.all([
    fetch('/images/vine-styles/outer/artwork.svg').then((r) => r.text()),
    fetch('/images/vine-styles/outer/keyframes.json').then((r) => r.json()),
  ])
    .then(([source, frames]) => {
      if (destroyed) return;
      const artwork = new DOMParser().parseFromString(source, 'image/svg+xml');
      const svg = document.importNode(artwork.documentElement, true) as unknown as SVGSVGElement;
      const nodes = [...svg.querySelectorAll('[data-grow]')];

      cancelAnimationFrame(vineAnimation);
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      host.replaceChildren(svg);
      fitVineArtwork(svg);

      vineNodes = nodes;
      vineFrames = frames;
      leafStates = [...svg.querySelectorAll<HTMLElement | SVGElement>('.leaf-reaction')].map((node, index) => ({
        node,
        strength: 0,
        target: 0,
        phase: index * 1.31,
      }));
      vineReady = true;
      paintVineFrame(vineProgress);
      animateVines(document.body.classList.contains('night'));
    })
    .catch((err) => console.warn('Không tải được dây leo:', err));

  return {
    setNightMode(enabled: boolean) {
      animateVines(enabled);
    },
    updateBeamLight(_originX: number, _originY: number, getLightLevel: (x: number, y: number) => number) {
      // Cập nhật phản ứng của bí ngô khi được đèn rọi vào
      document.querySelectorAll<HTMLElement>('.pumpkin-reaction').forEach((pumpkin) => {
        const face = pumpkin.querySelector('.pumpkin-face-normal');
        if (!face) return;
        const rect = face.getBoundingClientRect();
        const level = getLightLevel(rect.left + rect.width / 2, rect.top + rect.height / 2);
        const threshold = pumpkin.classList.contains('is-beam-lit') ? 0.06 : 0.14;
        pumpkin.classList.toggle('is-beam-lit', level > threshold);
      });

      // Cập nhật độ rung của lá
      leafStates.forEach((leaf) => {
        const bounds = leaf.node.getBoundingClientRect();
        const level = getLightLevel(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
        leaf.target = level > 0.08 ? level : 0;
      });
      animateLitLeaves();
    },
    cleanup() {
      destroyed = true;
      cancelAnimationFrame(vineAnimation);
      cancelAnimationFrame(leafAnimation);
      host.replaceChildren();
    },
  };
}

