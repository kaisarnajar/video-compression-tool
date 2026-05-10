import './style.css'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import coreURL from '@ffmpeg/core?url'
import wasmURL from '@ffmpeg/core/wasm?url'

const CRF_BY_PRESET = { low: 23, medium: 26, high: 28 } as const
type Preset = keyof typeof CRF_BY_PRESET

const VIDEO_RE = /\.(mp4|webm|mov|mkv|avi|m4v)$/i

const INPUT_WORK = 'src_in'
const OUTPUT_WORK = 'out.mp4'

function outputFilename(originalName: string): string {
  const dot = originalName.lastIndexOf('.')
  const base = dot === -1 ? originalName : originalName.slice(0, dot)
  return `${base}_compression.mp4`
}

function sourceExtension(filename: string): string {
  const dot = filename.lastIndexOf('.')
  return dot === -1 ? '.mp4' : filename.slice(dot)
}

function supportsFolderPick(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

async function listVideosInDirectory(dir: FileSystemDirectoryHandle): Promise<FileSystemFileHandle[]> {
  const out: FileSystemFileHandle[] = []
  for await (const handle of dir.values()) {
    if (handle.kind === 'file' && VIDEO_RE.test(handle.name)) {
      out.push(handle as FileSystemFileHandle)
    }
  }
  out.sort((a, b) => a.name.localeCompare(b.name))
  return out
}

async function saveToDirectory(dir: FileSystemDirectoryHandle, name: string, data: Uint8Array): Promise<void> {
  const fh = await dir.getFileHandle(name, { create: true })
  const w = await fh.createWritable()
  const chunk = new Uint8Array(data)
  await w.write(chunk)
  await w.close()
}

function triggerDownload(name: string, data: Uint8Array): void {
  const blob = new Blob([new Uint8Array(data)], { type: 'video/mp4' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

const els = {
  btnFolder: document.querySelector<HTMLButtonElement>('#btn-folder')!,
  btnFile: document.querySelector<HTMLButtonElement>('#btn-file')!,
  fileInput: document.querySelector<HTMLInputElement>('#file-input')!,
  folderPanel: document.querySelector<HTMLElement>('#folder-panel')!,
  folderSelect: document.querySelector<HTMLSelectElement>('#folder-select')!,
  selectionCard: document.querySelector<HTMLElement>('#selection-card')!,
  selectionPrimary: document.querySelector<HTMLElement>('#selection-primary')!,
  selectionSecondary: document.querySelector<HTMLElement>('#selection-secondary')!,
  btnCompress: document.querySelector<HTMLButtonElement>('#btn-compress')!,
  compressOutHint: document.querySelector<HTMLElement>('#compress-out-hint')!,
  progressWrap: document.querySelector<HTMLElement>('#progress-wrap')!,
  progressTrack: document.querySelector<HTMLElement>('#progress-track')!,
  progressFill: document.querySelector<HTMLElement>('#progress-fill')!,
  progressText: document.querySelector<HTMLElement>('#progress-text')!,
  message: document.querySelector<HTMLElement>('#message')!,
}

function selectedPreset(): Preset {
  const checked = document.querySelector<HTMLInputElement>('input[name="preset"]:checked')
  const v = checked?.value
  if (v === 'medium' || v === 'high' || v === 'low') return v
  return 'low'
}

let directoryHandle: FileSystemDirectoryHandle | null = null
let folderFileHandles: FileSystemFileHandle[] = []
let activeFile: File | null = null
let activeLabel = ''

const ffmpeg = new FFmpeg()
let ffmpegLoaded = false

function setProgress(ratio: number): void {
  const r = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0
  const pct = Math.round(r * 100)
  els.progressFill.style.width = `${pct}%`
  els.progressText.textContent = `${pct}%`
  els.progressTrack.setAttribute('aria-valuenow', String(pct))
}

ffmpeg.on('progress', ({ progress }) => {
  setProgress(Number.isFinite(progress) ? progress : 0)
})

function updateOutputHint(): void {
  els.compressOutHint.textContent = activeLabel ? `Creates ${outputFilename(activeLabel)}` : ''
}

function setSelectionEmpty(primary = 'No video selected', secondary?: string): void {
  els.selectionCard.classList.remove('has-file')
  els.selectionPrimary.textContent = primary
  if (secondary) {
    els.selectionSecondary.hidden = false
    els.selectionSecondary.textContent = secondary
  } else {
    els.selectionSecondary.hidden = true
    els.selectionSecondary.textContent = ''
  }
  updateOutputHint()
}

function setSelectionWithFile(filename: string, mode: 'folder' | 'download'): void {
  els.selectionCard.classList.add('has-file')
  els.selectionPrimary.textContent = filename
  els.selectionSecondary.hidden = false
  els.selectionSecondary.textContent =
    mode === 'folder'
      ? 'Writes beside the original in the folder you chose.'
      : 'Downloads automatically when encoding completes.'
  updateOutputHint()
}

function setMessage(text: string, isError = false): void {
  els.message.textContent = text
  els.message.dataset.error = isError ? '1' : ''
}

function updateCompressEnabled(): void {
  els.btnCompress.disabled = !activeFile
}

async function ensureFfmpegLoaded(): Promise<void> {
  if (ffmpegLoaded) return
  setMessage('Loading ffmpeg…')
  await ffmpeg.load({ coreURL, wasmURL })
  ffmpegLoaded = true
  setMessage('')
}

async function refreshFolderSelection(): Promise<void> {
  const idx = els.folderSelect.selectedIndex
  const handle = folderFileHandles[idx]
  if (!handle) {
    activeFile = null
    activeLabel = ''
    setSelectionEmpty()
    updateCompressEnabled()
    return
  }
  activeFile = await handle.getFile()
  activeLabel = activeFile.name
  setSelectionWithFile(activeLabel, 'folder')
  updateCompressEnabled()
}

async function onPickFolder(): Promise<void> {
  if (!supportsFolderPick()) {
    setMessage('Folder selection is not supported in this browser. Use “Select video file”.', true)
    return
  }
  setMessage('')
  try {
    const dir = await window.showDirectoryPicker!({ mode: 'readwrite' })
    directoryHandle = dir
    folderFileHandles = await listVideosInDirectory(dir)
    els.folderSelect.innerHTML = ''
    if (folderFileHandles.length === 0) {
      els.folderPanel.hidden = true
      activeFile = null
      activeLabel = ''
      setSelectionEmpty('No video files in that folder', 'Pick another folder or use file selection.')
      updateCompressEnabled()
      return
    }
    for (const h of folderFileHandles) {
      const opt = document.createElement('option')
      opt.value = h.name
      opt.textContent = h.name
      els.folderSelect.appendChild(opt)
    }
    els.folderPanel.hidden = false
    els.folderSelect.selectedIndex = 0
    await refreshFolderSelection()
  } catch (e) {
    if ((e as Error).name === 'AbortError') return
    setMessage((e as Error).message || String(e), true)
  }
}

function onPickFileClick(): void {
  setMessage('')
  directoryHandle = null
  folderFileHandles = []
  els.folderPanel.hidden = true
  els.folderSelect.innerHTML = ''
  els.fileInput.click()
}

els.fileInput.addEventListener('change', () => {
  const f = els.fileInput.files?.[0]
  if (!f) {
    activeFile = null
    activeLabel = ''
    setSelectionEmpty(undefined, 'Pick a folder or a single video file.')
    updateCompressEnabled()
    return
  }
  activeFile = f
  activeLabel = f.name
  setSelectionWithFile(activeLabel, 'download')
  updateCompressEnabled()
})

els.folderSelect.addEventListener('change', () => {
  void refreshFolderSelection()
})

els.btnFolder.addEventListener('click', () => {
  void onPickFolder()
})

els.btnFile.addEventListener('click', onPickFileClick)

if (!supportsFolderPick()) {
  els.btnFolder.disabled = true
  els.btnFolder.title = 'Folder access is not available in this browser.'
}

els.btnCompress.addEventListener('click', () => {
  void runCompress()
})

document.querySelectorAll('input[name="preset"]').forEach((el) => {
  el.addEventListener('change', () => updateOutputHint())
})

setSelectionEmpty(undefined, 'Pick a folder or a single video file.')

async function runCompress(): Promise<void> {
  const file = activeFile
  if (!file) return

  const outName = outputFilename(file.name)
  const crf = CRF_BY_PRESET[selectedPreset()]
  const ext = sourceExtension(file.name)
  const inputName = `${INPUT_WORK}${ext}`

  els.progressWrap.hidden = false
  setProgress(0)
  els.btnCompress.disabled = true
  setMessage('')

  try {
    await ensureFfmpegLoaded()

    const buf = new Uint8Array(await file.arrayBuffer())
    await ffmpeg.writeFile(inputName, buf)

    const code = await ffmpeg.exec([
      '-i',
      inputName,
      '-vcodec',
      'libx264',
      '-crf',
      String(crf),
      '-preset',
      'medium',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      OUTPUT_WORK,
    ])

    await ffmpeg.deleteFile(inputName).catch(() => {})

    if (code !== 0) {
      throw new Error(`ffmpeg exited with code ${code}`)
    }

    const data = await ffmpeg.readFile(OUTPUT_WORK)
    await ffmpeg.deleteFile(OUTPUT_WORK).catch(() => {})

    if (!(data instanceof Uint8Array)) {
      throw new Error('Compressed output was not binary data.')
    }
    const bytes = data

    if (directoryHandle) {
      await saveToDirectory(directoryHandle, outName, bytes)
      setMessage(`Saved ${outName} in your folder.`)
    } else {
      triggerDownload(outName, bytes)
      setMessage(`Started download · ${outName}`)
    }
  } catch (e) {
    setMessage((e as Error).message || String(e), true)
  } finally {
    els.btnCompress.disabled = false
    els.progressWrap.hidden = true
    updateCompressEnabled()
  }
}
