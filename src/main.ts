import './style.css'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import coreURL from '@ffmpeg/core?url'
import wasmURL from '@ffmpeg/core/wasm?url'

const CRF_BY_PRESET = { low: 23, medium: 26, high: 28 } as const
type Preset = keyof typeof CRF_BY_PRESET

const INPUT_WORK = 'src_in'
const OUTPUT_WORK = 'out.mp4'

const VIDEO_PICKER_TYPES = [
  {
    description: 'Video',
    accept: {
      'video/*': ['.mp4', '.webm', '.mov', '.mkv', '.avi', '.m4v'],
    },
  },
]

function outputFilename(originalName: string): string {
  const dot = originalName.lastIndexOf('.')
  const base = dot === -1 ? originalName : originalName.slice(0, dot)
  return `${base}_compression.mp4`
}

function sourceExtension(filename: string): string {
  const dot = filename.lastIndexOf('.')
  return dot === -1 ? '.mp4' : filename.slice(dot)
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

async function saveCompressedVideo(suggestedName: string, data: Uint8Array): Promise<void> {
  const picker = window.showSaveFilePicker
  if (typeof picker === 'function') {
    try {
      const handle = await picker.call(window, {
        suggestedName,
        types: [{ description: 'MP4 video', accept: { 'video/mp4': ['.mp4'] } }],
      })
      const w = await handle.createWritable()
      await w.write(new Uint8Array(data))
      await w.close()
      setMessage(`Saved · ${suggestedName}`)
      return
    } catch (e) {
      const err = e as Error
      if (err.name === 'AbortError') {
        setMessage('Save cancelled.')
        return
      }
      setMessage(`${err.message || String(e)} — downloading instead.`, true)
    }
  }
  triggerDownload(suggestedName, data)
  setMessage(`Download started · ${suggestedName}`)
}

const els = {
  btnPickVideo: document.querySelector<HTMLButtonElement>('#btn-pick-video')!,
  fileInput: document.querySelector<HTMLInputElement>('#file-input')!,
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

function secondaryHintForSelection(): string {
  return typeof window.showSaveFilePicker === 'function'
    ? 'After compression, choose where to save — open the same folder as this video to keep both files together.'
    : 'After compression, your browser will download the file (no save-location dialog here).'
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

function setSelectionWithFile(filename: string): void {
  els.selectionCard.classList.add('has-file')
  els.selectionPrimary.textContent = filename
  els.selectionSecondary.hidden = false
  els.selectionSecondary.textContent = secondaryHintForSelection()
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

async function pickVideo(): Promise<void> {
  setMessage('')
  const openPicker = window.showOpenFilePicker
  if (typeof openPicker === 'function') {
    try {
      const handles = await openPicker.call(window, {
        multiple: false,
        excludeAcceptAllOption: true,
        types: [...VIDEO_PICKER_TYPES],
      })
      const fh = handles[0]
      if (!fh) return
      activeFile = await fh.getFile()
      activeLabel = activeFile.name
      setSelectionWithFile(activeLabel)
      updateCompressEnabled()
      return
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    }
  }
  els.fileInput.value = ''
  els.fileInput.click()
}

els.btnPickVideo.addEventListener('click', () => {
  void pickVideo()
})

els.fileInput.addEventListener('change', () => {
  const f = els.fileInput.files?.[0]
  if (!f) {
    activeFile = null
    activeLabel = ''
    setSelectionEmpty(undefined, 'Tap “Choose video” or use the dialog when your browser opens it.')
    updateCompressEnabled()
    return
  }
  activeFile = f
  activeLabel = f.name
  setSelectionWithFile(activeLabel)
  updateCompressEnabled()
})

els.btnCompress.addEventListener('click', () => {
  void runCompress()
})

document.querySelectorAll('input[name="preset"]').forEach((el) => {
  el.addEventListener('change', () => updateOutputHint())
})

setSelectionEmpty(undefined, 'Choose a video below. Browsers never expose the full file path, but after encoding you can save next to the original when prompted.')

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

    await saveCompressedVideo(outName, data)
  } catch (e) {
    setMessage((e as Error).message || String(e), true)
  } finally {
    els.btnCompress.disabled = false
    els.progressWrap.hidden = true
    updateCompressEnabled()
  }
}
