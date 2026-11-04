# photoDuck

Create compliant biometric document photos entirely in your browser — **European
35 × 45 mm** (passport / ID / Schengen visa), **Poland**, and **US 2 × 2 in** (passport / visa).
Pick the format, upload a portrait, line the face up with the fixed guides, fine-tune
light & color, optionally replace the background, and download a print-ready photo plus
a 6-up print sheet.

> 🔒 **Private by design.** Your photo never leaves your device — all detection,
> cropping and rendering happen locally in the browser. There is no backend.

## Quick start

```bash
npm install
npm run setup:models   # downloads MediaPipe models + wasm into public/ (self-hosted)
npm run dev            # http://localhost:5173
```

`setup:models` self-hosts the face-detection and segmentation assets so the app runs
offline and nothing is ever requested from a third party at runtime. (The model files
are git-ignored; re-run the command after a fresh clone.)

### Other scripts

| Command | Purpose |
|---|---|
| `npm run build` | Type-check + production build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm run setup:models` | Fetch & self-host MediaPipe wasm + models |
| `npx tsx scripts/verify-geometry.ts` | Headless test of the cropping + compliance math |

## How it works — 3 steps

1. **Upload** — choose the document format (European / Poland / US), then drag & drop or
   pick a JPEG/PNG/WebP. EXIF orientation is honored.
2. **Modify** — the photo stays on the left (it's the live preview); tools are on the
   right as tabs:
   - **Position** — [MediaPipe FaceLandmarker](https://developers.google.com/mediapipe)
     detects the face in-browser and auto-fits the crop so the head hits the format's
     target size, centered, with correct headroom. Pan/zoom the photo to line it up with
     the fixed **Top of head** / **Chin** guides; a live readout shows the head size
     against the required band.
   - **Enhance** — brightness / contrast / exposure, saturation / temperature (white
     balance), and a straighten slider.
   - **Background** — optional person segmentation replaces the backdrop with a uniform
     white / grey / custom color (Germany needs grey, Poland & the US need white).

   A compact live compliance strip (head height, centering, tilt, eye line, resolution,
   background) sits under the photo; the full checklist is in the Position tab. The format
   can be changed at any time.
3. **Download** — a single photo at 300 DPI and a 4 × 6″ **6-up print sheet**, as JPEG or
   PNG. Both adapt to the selected format.

## Adding a format

Formats are plain JSON in `src/presets/formats/`. Drop in a new `*.json` (matching the
`FormatSpec` shape) and it auto-registers — no code changes. See `european.json` / `us.json`.

## Tech

TypeScript · React 18 · Vite 6 · Zustand · MediaPipe Tasks Vision · HTML5 Canvas.
Styling follows the `web-design-style` system (design tokens + utility classes + BEM
components; no inline styles, no Tailwind).

## Project structure

```
src/
├── lib/            geometry, image pipeline, face detection, segmentation, exporters, compliance
├── store/          Zustand editor state (declarative, non-destructive)
├── hooks/          file loading, detection orchestration, background compositing, render/export
├── presets/        document-type presets (EU 35×45, Poland, US 2×2 in; extensible)
├── components/     layout · upload · crop · adjust · background · compliance · preview · export
└── styles/         tokens.css · utilities.css · components.css · modal.css · main.css
```

## Deployment

It's a static SPA deployed to **GitHub Pages via GitHub Actions**
(`.github/workflows/deploy.yml`). On every push to `main`, CI runs `npm ci` →
`npm run setup:models` (re-fetches the git-ignored models + wasm) → `npm run build`,
then publishes `dist/`. The custom domain comes from `public/CNAME`
(`photoduck.molfar.dev`), which Vite copies into `dist/` on each build.

First-time setup (once):

1. `npm install` to re-sync `package-lock.json` after the rename, then commit it.
2. Push the repo to GitHub.
3. **Settings → Pages → Source = "GitHub Actions"**.
4. **Settings → Pages → Custom domain = `photoduck.molfar.dev`**, then enable "Enforce HTTPS".
5. Add a DNS `CNAME` record: `photoduck` → `<your-account>.github.io`.

To host elsewhere, any static host works — just run `npm run setup:models && npm run build`
first so the `public/models` + `public/mediapipe` assets are present in `dist/`.
