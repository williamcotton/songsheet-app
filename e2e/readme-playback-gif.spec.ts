import { execFile } from 'node:child_process'
import { mkdir, rm } from 'node:fs/promises'
import { promisify } from 'node:util'
import { test } from '@playwright/test'

const execFileAsync = promisify(execFile)
const FRAME_DIR = '.tmp/readme-playback-gif-frames'
const PALETTE_PATH = `${FRAME_DIR}/palette.png`
const OUTPUT_GIF_PATH = 'screenshots/readme-playback-loop.gif'
const VIEWPORT = { width: 1440, height: 1024 }

async function waitForHydration(page: any) {
  await page.waitForFunction(() => {
    const root = document.getElementById('root')
    if (!root) return false
    return Object.keys(root).some(k => k.startsWith('__reactFiber') || k.startsWith('__reactContainer'))
  }, { timeout: 10000 })
}

async function runFfmpeg(args: string[]) {
  await execFileAsync('ffmpeg', args)
}

test.describe('README playback GIF generation', () => {
  test.skip(
    process.env.GENERATE_README_GIF !== '1',
    'Set GENERATE_README_GIF=1 to run this capture workflow.'
  )

  test('capture playback loop as animated GIF', async ({ page }) => {
    await rm(FRAME_DIR, { recursive: true, force: true })
    await mkdir(FRAME_DIR, { recursive: true })
    await mkdir('screenshots', { recursive: true })

    await page.addInitScript(() => {
      const OriginalAudioContext = window.AudioContext || (window as any).webkitAudioContext
      if (!OriginalAudioContext) return
      const origResume = OriginalAudioContext.prototype.resume
      OriginalAudioContext.prototype.resume = function () {
        Object.defineProperty(this, 'state', { value: 'running', writable: true, configurable: true })
        return origResume.call(this)
      }
    })

    await page.setViewportSize(VIEWPORT)
    await page.goto('/songs/a-way-out-online')
    await waitForHydration(page)
    await page.waitForTimeout(500)

    await page.click('#btn-play')
    await page.locator('#btn-pause').waitFor({ state: 'visible', timeout: 10000 })
    await page.locator('.section-header').first().dblclick()
    await page.locator('.section').first().locator('.chord-marker.active-marker').first()
      .waitFor({ state: 'visible', timeout: 10000 })

    for (let i = 0; i < 42; i += 1) {
      const framePath = `${FRAME_DIR}/frame-${String(i).padStart(3, '0')}.png`
      await page.screenshot({ path: framePath })
      await page.waitForTimeout(90)
    }

    await runFfmpeg([
      '-y',
      '-framerate', '11',
      '-i', `${FRAME_DIR}/frame-%03d.png`,
      '-vf', 'palettegen=stats_mode=diff',
      PALETTE_PATH,
    ])

    await runFfmpeg([
      '-y',
      '-framerate', '11',
      '-i', `${FRAME_DIR}/frame-%03d.png`,
      '-i', PALETTE_PATH,
      '-lavfi', 'fps=11,scale=1200:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=sierra2_4a',
      OUTPUT_GIF_PATH,
    ])

    await rm(FRAME_DIR, { recursive: true, force: true })
  })
})
