import { execFile } from 'node:child_process'
import { mkdir, rm } from 'node:fs/promises'
import { promisify } from 'node:util'
import { test, expect } from '@playwright/test'

const execFileAsync = promisify(execFile)
const TEMP_ROOT = '.tmp/readme-gif-frames'
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

async function renderGif(frameDir: string, outputPath: string, fps: number = 11) {
  const palettePath = `${frameDir}/palette.png`
  await runFfmpeg([
    '-y',
    '-framerate', String(fps),
    '-i', `${frameDir}/frame-%03d.png`,
    '-vf', 'palettegen=stats_mode=diff',
    palettePath,
  ])

  await runFfmpeg([
    '-y',
    '-framerate', String(fps),
    '-i', `${frameDir}/frame-%03d.png`,
    '-i', palettePath,
    '-lavfi', `fps=${fps},scale=1200:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=sierra2_4a`,
    outputPath,
  ])
}

async function captureFrames(
  page: any,
  frameDir: string,
  frameCount: number,
  frameDelayMs: number,
  onFrame?: (index: number) => Promise<void>
) {
  await rm(frameDir, { recursive: true, force: true })
  await mkdir(frameDir, { recursive: true })

  for (let i = 0; i < frameCount; i += 1) {
    if (onFrame) {
      await onFrame(i)
    }
    await page.screenshot({ path: `${frameDir}/frame-${String(i).padStart(3, '0')}.png` })
    if (i < frameCount - 1) {
      await page.waitForTimeout(frameDelayMs)
    }
  }
}

test.describe('README GIF generation', () => {
  test.skip(
    process.env.GENERATE_README_GIF !== '1',
    'Set GENERATE_README_GIF=1 to run this capture workflow.'
  )

  test.beforeAll(async () => {
    await rm(TEMP_ROOT, { recursive: true, force: true })
    await mkdir('screenshots', { recursive: true })
  })

  test.beforeEach(async ({ page }) => {
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
  })

  test.afterAll(async () => {
    await rm(TEMP_ROOT, { recursive: true, force: true })
  })

  test('generate readme-playback-loop.gif', async ({ page }) => {
    await page.goto('/songs/a-way-out-online')
    await waitForHydration(page)
    await page.waitForTimeout(500)

    await page.click('#btn-play')
    await expect(page.locator('#btn-pause')).toBeVisible({ timeout: 10000 })
    await page.locator('.section-header').first().dblclick()
    await expect(page.locator('.section').first()).toHaveClass(/vamped-section/, { timeout: 3000 })
    await expect(page.locator('.section').first().locator('.chord-marker.active-marker').first()).toBeVisible({ timeout: 10000 })

    const frameDir = `${TEMP_ROOT}/playback-loop`
    await captureFrames(page, frameDir, 42, 90)
    await renderGif(frameDir, 'screenshots/readme-playback-loop.gif', 11)
  })

  test('generate readme-live-edit.gif', async ({ page }) => {
    await page.goto('/songs/a-way-out-online/edit')
    await waitForHydration(page)

    const textarea = page.locator('.edit-textarea')
    const preview = page.locator('.edit-right #song-display')
    await textarea.evaluate((el: HTMLTextAreaElement) => {
      const cursorAtLineBreak = el.value.indexOf('\nCHORUS:')
      const cursor = cursorAtLineBreak >= 0 ? cursorAtLineBreak : el.value.indexOf('CHORUS:')
      if (cursor < 0) {
        throw new Error('Could not find CHORUS section anchor in song source.')
      }
      el.focus()
      el.setSelectionRange(cursor, cursor)
      const lineHeight = Number.parseFloat(getComputedStyle(el).lineHeight) || 20
      const linesBeforeCursor = el.value.slice(0, cursor).split('\n').length
      el.scrollTop = Math.max(0, (linesBeforeCursor - 8) * lineHeight)
    })
    await page.keyboard.press('Enter')
    await page.keyboard.press('ArrowLeft')

    const insertText = [
      '',
      'PRECHORUS:',
      '  C             F',
      'Screens glow in midnight blue',
      '  C             G',
      'One more line before the hook',
      '',
      '',
    ].join('\n')
    const chars = Array.from(insertText)
    const preRollFrames = 6
    const frameCount = preRollFrames + chars.length + 18

    const frameDir = `${TEMP_ROOT}/live-edit`
    await captureFrames(page, frameDir, frameCount, 80, async (index) => {
      const typeIndex = index - preRollFrames
      if (typeIndex >= 0 && typeIndex < chars.length) {
        const char = chars[typeIndex]
        if (char === '\n') {
          await page.keyboard.press('Enter')
        } else {
          await page.keyboard.type(char)
        }
      }
      if (index === preRollFrames + chars.length + 3) {
        await expect(preview).toContainText(/prechorus/i, { timeout: 5000 })
        await expect(preview).toContainText('One more line before the hook', { timeout: 5000 })
      }
    })
    await renderGif(frameDir, 'screenshots/readme-live-edit.gif', 12)
  })

  test('generate readme-chart-features.gif', async ({ page }) => {
    await page.goto('/songs/a-way-out-online')
    await waitForHydration(page)
    await expect(page.locator('#btn-nashville')).toBeEnabled()

    const frameDir = `${TEMP_ROOT}/chart-features`
    await captureFrames(page, frameDir, 74, 100, async (index) => {
      if (index === 8) await page.click('#btn-nashville')
      if (index === 12) await expect(page.locator('#btn-nashville')).toHaveClass(/on/)
      if (index === 18) await page.click('#btn-nashville')
      if (index === 22) await expect(page.locator('#btn-nashville')).not.toHaveClass(/on/)
      if (index === 30) await page.click('#btn-transpose-up')
      if (index === 40) await page.click('#btn-transpose-up')
      if (index === 50) await page.click('#btn-export')
      if (index === 60) await page.click('#btn-performance-link')
      if (index === 66) await expect(page).toHaveURL('/songs/a-way-out-online/performance')
    })
    await renderGif(frameDir, 'screenshots/readme-chart-features.gif', 8)
  })
})
