# Video compression tool

Small static web app that compresses video in the browser using [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) (H.264 via `libx264`, same idea as `ffmpeg -vcodec libx264 -crf …` on the command line).

## Features

- **Compression presets:** Low (CRF 23), Medium (CRF 26), High (CRF 28).
- **Output name:** `originalname_compression.mp4` (the base name of the file you pick, plus `_compression.mp4`).
- **Same folder as the source (Chromium):** use **Select folder**, grant read/write access, pick the video in the list. The encoded file is written into that folder.
- **Other browsers:** use **Select video file**; the result downloads with the correct filename.

## Local development

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173/`).

## Production build

```bash
npm run build
```

The site is written to **`docs/`** (configured in [vite.config.ts](vite.config.ts)). Commit changes under `docs/` when you update the app so GitHub Pages stays in sync.

The production `base` path is `/video-compression-tool/` for a **project site**. If your repository name changes, update `base` in `vite.config.ts`, rebuild, and commit the new `docs/` output.

## GitHub Pages (deploy from `master` + `/docs`)

**Yes — you can use the `master` branch.** In repo settings you choose **which branch and folder** GitHub serves as static hosting. Here we use **`master`** with folder **`/docs`**.

### Why some projects use GitHub Actions instead

| Approach | What happens |
|----------|----------------|
| **Branch + `/docs` (this repo)** | You run `npm run build` locally (or elsewhere) and **commit** the generated `docs/` folder. Pages serves those files. No Actions workflow; repo includes large built assets (e.g. WASM). |
| **GitHub Actions** | CI runs `npm run build` on every push and publishes `dist` without committing binaries to git. Cleaner git history, automatic deploys, but needs workflow YAML and Actions enabled. |

### Enable Pages (once)

1. Open [Pages settings](https://github.com/kaisarnajar/video-compression-tool/settings/pages).
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
3. Choose **Branch:** `master`, **Folder:** `/docs`, then **Save**.

Live URL:

**https://kaisarnajar.github.io/video-compression-tool/**

If Pages was previously set to **GitHub Actions**, switch it to **Deploy from a branch** as above (you can ignore old workflow runs).

## Notes

- This project uses the **single-thread** `@ffmpeg/core` build so it runs on GitHub Pages without special `Cross-Origin-Embedder-Policy` headers.
- The first run downloads the WebAssembly core (tens of MB); encoding is CPU-heavy and runs entirely in your browser.

## License

ffmpeg.wasm core is GPL-2.0-or-later; see dependency notices in `node_modules/@ffmpeg/core`.
