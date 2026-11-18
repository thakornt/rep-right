// The picture LINE, Facebook and X show for a shared link: the logo, a big title and one line
// under it, in the app's dark grey and orange. Drawn at build time by the opengraph-image files.

import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const OG_SIZE = { width: 1200, height: 630 };

// Thai has no glyphs in the default image font, so both fonts come with the app (assets/fonts).
const fonts = Promise.all([
  readFile(join(process.cwd(), "assets/fonts/Manrope-Bold.ttf")),
  readFile(join(process.cwd(), "assets/fonts/NotoSansThai-Bold.ttf")),
]);

// The Rep Right figure from app/icon.svg, with a few steps of its long shadow.
const FIGURE = "M140 360 L580 360 L480 700 L240 700 L440 870 L205 1380 L225 960 L20 800 Z";
const figure = (fill: string, dx = 0) =>
  `<g transform="translate(${dx} ${dx})" fill="${fill}" stroke="${fill}"><circle cx="360" cy="150" r="110"/><path d="${FIGURE}" stroke-width="28" stroke-linejoin="round"/></g>`;
const LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-430 -60 1460 1460">
<defs><linearGradient id="f" x1="0" y1="0" x2=".5" y2="1"><stop offset="0" stop-color="#ffc06e"/><stop offset="1" stop-color="#ea7a0f"/></linearGradient>
<clipPath id="t"><rect x="-430" y="-60" width="1460" height="1460" rx="300"/></clipPath></defs>
<rect x="-430" y="-60" width="1460" height="1460" rx="300" fill="#202023"/>
<g clip-path="url(#t)" opacity=".55">${[220, 176, 132, 88, 44].map((d) => figure("#050506", d)).join("")}</g>
${figure("url(#f)")}
</svg>`;
const LOGO_SRC = `data:image/svg+xml;base64,${Buffer.from(LOGO).toString("base64")}`;

export async function ogCard({ title, subtitle }: { title: string; subtitle: string }) {
  const [manrope, notoThai] = await fonts;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "linear-gradient(135deg, #161618 0%, #0b0b0c 70%)",
          color: "#f2f2f3",
          fontFamily: "Manrope, Noto Sans Thai",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse draws plain <img> only */}
          <img src={LOGO_SRC} width={96} height={96} alt="" />
          <div style={{ fontSize: 44, letterSpacing: -1 }}>Rep Right</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: title.length > 22 ? 64 : 84, lineHeight: 1.25, color: "#f7941d" }}>{title}</div>
          <div style={{ fontSize: 38, lineHeight: 1.4, color: "#a6a6ad" }}>{subtitle}</div>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: "Manrope", data: manrope, weight: 700, style: "normal" },
        { name: "Noto Sans Thai", data: notoThai, weight: 700, style: "normal" },
      ],
    },
  );
}
