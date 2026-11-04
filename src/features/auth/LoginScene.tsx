import type { RefObject } from 'react';

interface LoginSceneProps {
  wolfStageRef: RefObject<HTMLDivElement | null>;
  nightMode: boolean;
  onToggleNight: () => void;
}

/** Cột trái trang đăng nhập: cảnh núi, đỉnh sói hú, nút Ngày/Đêm, thông điệp chào mừng. */
export function LoginScene({ wolfStageRef, nightMode, onToggleNight }: LoginSceneProps) {
  return (
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
  onClick={onToggleNight}
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
  );
}
