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
  selectionStatus: document.querySelector<HTMLElement>('#selection-status')!,
  btnCompress: document.querySelector<HTMLButtonElement>('#btn-compress')!,
  progressWrap: document.querySelector<HTMLElement>('#progress-wrap')!,
  progressBar: document.querySelector<HTMLProgressElement>('#progress-bar')!,
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

ffmpeg.on('progress', ({ progress }) => {
  els.progressBar.value = Number.isFinite(progress) ? progress : 0
  els.progressText.textContent = `${Math.round((Number.isFinite(progress) ? progress : 0) * 100)}%`
})

function setSelectionStatus(text: string): void {
  els.selectionStatus.textContent = text
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
    updateCompressEnabled()
    return
  }
  activeFile = await handle.getFile()
  activeLabel = activeFile.name
  setSelectionStatus(`Selected: ${activeLabel} (same-folder save enabled)`)
  updateCompressEnabled()
}

async function onPickFolder(): Promise<void> {
  if (!supportsFolderPick()) {
    setMessage('Folder selection is not supported in this browser. Use “Select video file” — the result will download.', true)
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
      setSelectionStatus('No video files found in that folder.')
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
    setSelectionStatus('No file selected.')
    updateCompressEnabled()
    return
  }
  activeFile = f
  activeLabel = f.name
  setSelectionStatus(`Selected: ${activeLabel} (will download after compression)`)
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

async function runCompress(): Promise<void> {
  const file = activeFile
  if (!file) return

  const outName = outputFilename(file.name)
  const crf = CRF_BY_PRESET[selectedPreset()]
  const ext = sourceExtension(file.name)
  const inputName = `${INPUT_WORK}${ext}`

  els.progressWrap.hidden = false
  els.progressBar.value = 0
  els.progressText.textContent = '0%'
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
      setMessage(`Saved: ${outName} in the selected folder.`)
    } else {
      triggerDownload(outName, bytes)
      setMessage(`Download started: ${outName}`)
    }
  } catch (e) {
    setMessage((e as Error).message || String(e), true)
  } finally {
    els.btnCompress.disabled = false
    els.progressWrap.hidden = true
    updateCompressEnabled()
  }
}
