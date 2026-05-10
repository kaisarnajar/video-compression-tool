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

This repo includes [.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml). GitHub still requires **one manual step** to turn Pages on (there is no `pages.yml` in git that can skip this).

### Enable Pages (once)

1. Open **Pages settings** for the repo:  
   [github.com/kaisarnajar/video-compression-tool/settings/pages](https://github.com/kaisarnajar/video-compression-tool/settings/pages)
2. Under **Build and deployment**, set **Source** to **GitHub Actions** (not “Deploy from a branch”).
3. Open the [**Actions**](https://github.com/kaisarnajar/video-compression-tool/actions) tab. If **Deploy GitHub Pages** did not run after your last push, select it → **Run workflow** (or push any commit to `master`) so `dist` is built and published.

After a successful deploy, the site is:

**https://kaisarnajar.github.io/video-compression-tool/**

That path matches `base: '/video-compression-tool/'` in [vite.config.ts](vite.config.ts).

### Optional: enable via API

If you use a [personal access token](https://github.com/settings/tokens) with **Administration** → **Pages** on this repo (or classic token with `repo` scope):

```bash
curl -L -X POST \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  https://api.github.com/repos/kaisarnajar/video-compression-tool/pages \
  -d '{"build_type":"workflow"}'
```

If Pages already exists with another source, you may need **PUT** to switch `build_type` to `workflow` (see [GitHub REST API: Pages](https://docs.github.com/en/rest/pages/pages)).

## Notes

- This project uses the **single-thread** `@ffmpeg/core` build so it runs on GitHub Pages without special `Cross-Origin-Embedder-Policy` headers.
- The first run downloads the WebAssembly core (tens of MB); encoding is CPU-heavy and runs entirely in your browser.

## License

ffmpeg.wasm core is GPL-2.0-or-later; see dependency notices in `node_modules/@ffmpeg/core`.
