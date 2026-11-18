# Fonts for the shared-link images

Read at build time by `src/lib/og-card.tsx` to draw the pictures LINE, Facebook and X show
for a shared link (`opengraph-image.tsx`). The pages themselves load their fonts with
`next/font/google`; these files are only for the images, which cannot use those.

- `NotoSansThai-Bold.ttf`: Noto Sans Thai, weight 700, for Thai
- `Manrope-Bold.ttf`: Manrope, weight 700, for Latin letters and numbers

Both come from Google Fonts and are under the SIL Open Font License 1.1
(https://openfontlicense.org), which allows bundling them with the app.
