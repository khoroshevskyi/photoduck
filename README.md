# 🦆 photoDuck

**Make your own passport, ID, or visa photo at home — for free, in about a minute.**

No appointment, no photo booth, no uploading your face to a stranger's website. Open the
page, upload a selfie or any portrait, and photoDuck crops it to the exact official size,
helps you line up your face, and gives you a print-ready photo to download.

### 👉 Try it now: **[photoduck.molfar.dev](https://photoduck.molfar.dev)**

Works right in your web browser on a laptop or phone. Nothing to install.

---

## 🔒 Your photo never leaves your device

This is the important part: **photoDuck does everything on your own computer or phone.**
Your picture is *never* uploaded, stored, or sent anywhere. There's no account, no sign-up,
and no company keeping a copy of your face. When you close the tab, it's gone.

---

## 📸 What you can make

Pick your country, and photoDuck knows the official photo rules for it — the right size,
how big your head should be, and which background color is allowed:

| | | |
|---|---|---|
| 🇪🇺 Europe / Schengen visa | 🇺🇸 United States | 🇬🇧 United Kingdom |
| 🇩🇪 Germany | 🇫🇷 France | 🇪🇸 Spain |
| 🇮🇹 Italy | 🇳🇱 Netherlands | 🇵🇱 Poland |
| 🇨🇦 Canada | 🇧🇷 Brazil | 🇦🇺 Australia |
| 🇮🇳 India (visa / OCI) | 🇲🇽 Mexico (US visa) | 🇳🇬 Nigeria |
| 🇵🇭 Philippines | | |

Most are the standard **35 × 45 mm** (passport / ID card / visa) or the **2 × 2 inch** size
used by the US and several others. More countries get added over time.

---

## ✨ How to use it — 3 easy steps

### 1. Choose your document
Select the country and document type (for example, *US passport* or *European ID card*).

### 2. Upload and line up your face
Drag in a photo or pick one from your device (a normal JPEG or PNG selfie works fine).
photoDuck automatically finds your face and fits it to the frame. You'll see two guide lines —
one for the **top of your head** and one for your **chin**. Just drag and zoom your photo
until your face sits between them.

While you adjust, a little checklist tells you in plain terms whether everything looks right:

- ✅ Head is the correct size
- ✅ Face is centered and straight
- ✅ Eyes are at the right height
- ✅ Background is plain and acceptable
- ✅ Photo is sharp enough to print

You can also brighten the photo, fix the colors, straighten a slight tilt, and — if your
country allows it — swap a messy background for a clean white or grey one.

### 3. Download and print
Download a ready-to-use photo, plus a **print sheet** that fits several copies onto a single
4 × 6 inch print — so you can print it at home or at any photo kiosk/pharmacy and cut them out.

---

## ❓ Good to know

**Is it really free?** Yes. No fees, no watermark, no catch.

**Do I need to create an account?** No.

**Will my photo be accepted?** photoDuck sizes and positions your photo to each country's
official rules and flags obvious problems. You still need to help by using a clear,
front-facing photo with a neutral expression and even lighting — just like any passport photo.
Final approval is always up to the office that issues your document.

**What kind of photo should I start with?** A plain, well-lit photo of your face looking
straight at the camera, with your whole head and the top of your shoulders visible. A phone
selfie against a plain wall works great.

**Does it work on my phone?** Yes, it runs in your phone's web browser too.

---

<br>

---

## 🛠️ For developers

<details>
<summary>Click to expand technical documentation (running locally, project structure, deployment).</summary>

<br>

photoDuck is a static, client-side SPA. All face detection, cropping, and rendering happen
in-browser with [MediaPipe Tasks Vision](https://developers.google.com/mediapipe) — there is
no backend and no runtime network call for user data.

**Tech:** TypeScript · React 18 · Vite 6 · Zustand · MediaPipe Tasks Vision · HTML5 Canvas.
Styling follows the `web-design-style` system (design tokens + utility classes + BEM
components; no inline styles, no Tailwind).

### Run it locally

```bash
npm install
npm run setup:models   # downloads MediaPipe models + wasm into public/ (self-hosted)
npm run dev            # http://localhost:5173
```

`setup:models` self-hosts the face-detection and segmentation assets so the app runs offline
and nothing is ever requested from a third party at runtime. (The model files are git-ignored;
re-run the command after a fresh clone.)

### Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Type-check + production build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm run setup:models` | Fetch & self-host MediaPipe wasm + models |
| `npx tsx scripts/verify-geometry.ts` | Headless test of the cropping + compliance math |

### Adding a format

Formats are plain JSON in `src/presets/formats/`. Drop in a new `*.json` (matching the
`FormatSpec` shape) and it auto-registers — no code changes. See `european.json` / `us.json`.

### Project structure

```
src/
├── lib/            geometry, image pipeline, face detection, segmentation, exporters, compliance
├── store/          Zustand editor state (declarative, non-destructive)
├── hooks/          file loading, detection orchestration, background compositing, render/export
├── presets/        document-type presets (16 countries; extensible via JSON)
├── components/     layout · upload · crop · adjust · background · compliance · preview · export
└── styles/         tokens.css · utilities.css · components.css · modal.css · main.css
```

### Deployment

A static SPA deployed to **GitHub Pages via GitHub Actions** (`.github/workflows/deploy.yml`).
On every push to `main`, CI runs `npm ci` → `npm run setup:models` (re-fetches the git-ignored
models + wasm) → `npm run build`, then publishes `dist/`. The custom domain comes from
`public/CNAME` (`photoduck.molfar.dev`), which Vite copies into `dist/` on each build.

First-time setup (once):

1. `npm install` to re-sync `package-lock.json`, then commit it.
2. Push the repo to GitHub.
3. **Settings → Pages → Source = "GitHub Actions"**.
4. **Settings → Pages → Custom domain = `photoduck.molfar.dev`**, then enable "Enforce HTTPS".
5. Add a DNS `CNAME` record: `photoduck` → `<your-account>.github.io`.

To host elsewhere, any static host works — just run `npm run setup:models && npm run build`
first so the `public/models` + `public/mediapipe` assets are present in `dist/`.

</details>
