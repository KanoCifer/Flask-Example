function getCssVar(
  isDark: boolean,
  scheme: string | undefined,
  varName: string,
  fallback: string,
): string {
  const temp = document.createElement('div');
  temp.style.cssText = 'position:absolute;visibility:hidden;';
  if (isDark) temp.classList.add('dark');
  if (scheme) temp.setAttribute('data-color-scheme', scheme);
  document.body.appendChild(temp);
  const value = getComputedStyle(temp).getPropertyValue(varName).trim();
  document.body.removeChild(temp);
  return value || fallback;
}

function createTransitionIcon(
  targetTheme: 'light' | 'dark' | 'system',
): HTMLElement {
  const container = document.createElement('div');
  container.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 120px;
    height: 120px;
  `;

  if (targetTheme === 'dark') {
    container.innerHTML = `<div><svg t="1778846851241" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="8408" width="120" height="120"><path d="M718.506667 500.906667a213.333333 213.333333 0 0 0-413.013334 0 42.666667 42.666667 0 0 0 42.666667 53.333333h330.24a42.666667 42.666667 0 0 0 42.666667-53.333333zM512 298.666667a42.666667 42.666667 0 0 1-42.666667-42.666667V170.666667a42.666667 42.666667 0 0 1 85.333334 0v85.333333a42.666667 42.666667 0 0 1-42.666667 42.666667zM300.8 386.133333a42.666667 42.666667 0 0 1-30.293333-12.373333L210.346667 313.173333a42.666667 42.666667 0 0 1 60.16-60.16l60.586666 60.16a42.666667 42.666667 0 0 1 0 60.586667 42.666667 42.666667 0 0 1-30.293333 12.373333zM725.333333 386.133333a42.666667 42.666667 0 0 1-30.293333-12.373333 42.666667 42.666667 0 0 1 0-60.586667l60.586667-60.16a42.666667 42.666667 0 1 1 60.16 60.16l-62.293334 60.586667a42.666667 42.666667 0 0 1-28.16 12.373333zM896 725.333333H128a42.666667 42.666667 0 0 1 0-85.333333h768a42.666667 42.666667 0 0 1 0 85.333333zM725.333333 896H298.666667a42.666667 42.666667 0 0 1 0-85.333333h426.666666a42.666667 42.666667 0 0 1 0 85.333333z" fill="#ffffff" p-id="8409"></path></svg></div>`;
  } else if (targetTheme === 'system') {
    container.innerHTML = `<div><svg viewBox="0 0 48 48" width="120" height="120" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="44" height="28" rx="2" ry="2"/><line x1="16" y1="42" x2="32" y2="42"/><line x1="24" y1="35" x2="24" y2="42"/></svg></div>`;
  } else {
    container.innerHTML = `<div class="animate-tt-spin"><svg viewBox="0 0 48 48" width="120" height="120" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9.15039 9.15088L11.3778 11.3783" stroke="#f5df17" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 24H6.15" stroke="#f5df17" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.15039 38.8495L11.3778 36.6221" stroke="#f5df17" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M38.8495 38.8495L36.6221 36.6221" stroke="#f5df17" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M44.9996 24H41.8496" stroke="#f5df17" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M38.8495 9.15088L36.6221 11.3783" stroke="#f5df17" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 3V6.15" stroke="#f5df17" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 36C30.6274 36 36 30.6274 36 24C36 17.3726 30.6274 12 24 12C17.3726 12 12 17.3726 12 24C12 30.6274 17.3726 36 24 36Z" fill="#f5df17" stroke="#f5df17" stroke-width="4" stroke-linejoin="round"/><path d="M24 45.0001V41.8501" stroke="#f5df17" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`;
  }

  return container;
}

export function playThemeTransition(
  event: { clientX: number; clientY: number },
  targetTheme: 'light' | 'dark' | 'system',
  scheme?: string,
  onComplete?: () => void,
) {
  const isDark =
    targetTheme === 'dark' ||
    (targetTheme === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  const targetColor = getCssVar(
    isDark,
    scheme,
    '--page',
    isDark ? '#0f172a' : '#ffffff',
  );

  const cx = event.clientX;
  const cy = event.clientY;

  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 99999;
    pointer-events: none;
    background-color: ${targetColor};
    clip-path: circle(0% at ${cx}px ${cy}px);
    transition: clip-path 0.6s ease-in-out;
  `;

  const icon = createTransitionIcon(targetTheme);
  overlay.appendChild(icon);

  document.body.appendChild(overlay);

  void overlay.offsetWidth;

  requestAnimationFrame(() => {
    overlay.style.clipPath = `circle(150% at ${cx}px ${cy}px)`;
  });

  let phase: 'expand' | 'shrink' = 'expand';

  const handleTransitionEnd = (e: TransitionEvent) => {
    if (e.propertyName !== 'clip-path') return;

    if (phase === 'expand') {
      phase = 'shrink';
      onComplete?.();
      overlay.style.clipPath = `circle(0% at ${cx}px ${cy}px)`;
      overlay.style.transition = 'clip-path 0.3s ease-out';
    } else {
      overlay.removeEventListener('transitionend', handleTransitionEnd);
      overlay.remove();
    }
  };

  overlay.addEventListener('transitionend', handleTransitionEnd);
}
