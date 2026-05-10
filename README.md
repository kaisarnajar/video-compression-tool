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

Output is in `dist/`. The production `base` path is set for a **project site** at `/video-compression-tool/`. If your GitHub repository name is different, change `base` in [vite.config.ts](vite.config.ts) to `/<your-repo-name>/` and rebuild.

## GitHub Pages

1. Create a repository (for example `video-compression-tool`) and push the `master` branch.
2. In the repo on GitHub: **Settings → Pages → Build and deployment → Source** → choose **GitHub Actions**.
3. The [Deploy GitHub Pages](.github/workflows/deploy-pages.yml) workflow builds on every push to `master` and publishes `dist`.

The app will be available at `https://<username>.github.io/video-compression-tool/` (path matches the `base` in `vite.config.ts`).

## Notes

- This project uses the **single-thread** `@ffmpeg/core` build so it runs on GitHub Pages without special `Cross-Origin-Embedder-Policy` headers.
- The first run downloads the WebAssembly core (tens of MB); encoding is CPU-heavy and runs entirely in your browser.

## License

ffmpeg.wasm core is GPL-2.0-or-later; see dependency notices in `node_modules/@ffmpeg/core`.
