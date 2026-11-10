// The Rep Right figure with its long shadow, as in app/icon.svg, cropped
// tighter so the figure stays legible in the 32px header tile.
const FIGURE = "M140 360 L580 360 L480 700 L240 700 L440 870 L205 1380 L225 960 L20 800 Z";
const SHADOW_STEPS = Array.from({ length: 30 }, (_, i) => (30 - i) * 22);

export function LogoMark() {
  return (
    <svg aria-hidden viewBox="-430 -60 1460 1460" className="h-8 w-8 shrink-0">
      <defs>
        <linearGradient id="logo-face" x1="0" y1="0" x2=".5" y2="1">
          <stop offset="0" stopColor="#ffc06e" />
          <stop offset="1" stopColor="#ea7a0f" />
        </linearGradient>
        <clipPath id="logo-tile">
          <rect x="-430" y="-60" width="1460" height="1460" rx="300" />
        </clipPath>
        <g id="logo-figure">
          <circle cx="360" cy="150" r="110" />
          <path d={FIGURE} strokeWidth="28" strokeLinejoin="round" />
        </g>
      </defs>
      <rect x="-430" y="-60" width="1460" height="1460" rx="300" fill="#1f2b4d" />
      <g clipPath="url(#logo-tile)" fill="#0b1222" stroke="#0b1222" opacity=".55">
        {SHADOW_STEPS.map((d) => (
          <use key={d} href="#logo-figure" x={d} y={d} />
        ))}
      </g>
      <g fill="url(#logo-face)" stroke="url(#logo-face)">
        <use href="#logo-figure" />
      </g>
      <rect x="-418" y="-48" width="1436" height="1436" rx="290" fill="none" stroke="#34446f" strokeWidth="24" />
    </svg>
  );
}
