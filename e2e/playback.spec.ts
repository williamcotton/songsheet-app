import { test, expect } from '@playwright/test'

// Chromium headless may block AudioContext without a real user gesture.
// Override the AudioContext prototype so Tone.js always succeeds.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const OriginalAudioContext = window.AudioContext || (window as any).webkitAudioContext
    if (OriginalAudioContext) {
      const origResume = OriginalAudioContext.prototype.resume
      OriginalAudioContext.prototype.resume = function () {
        // Force state to 'running' so Tone.js thinks the context is active
        Object.defineProperty(this, 'state', { value: 'running', writable: true, configurable: true })
        return origResume.call(this)
      }
    }
  })
})

// Helper: navigate and wait for the audio engine dynamic import to resolve
async function gotoAndWaitForEngine(page: any, url: string) {
  await page.goto(url)
  // The audio engine loads via dynamic import in useAudioPlayback.
  // Wait a moment for it to initialize before interacting with playback controls.
  await page.waitForTimeout(500)
}

test('play button starts playback, shows pause and enables stop', async ({ page }) => {
  await gotoAndWaitForEngine(page, '/songs/america')
  const playBtn = page.locator('#btn-play')
  await expect(playBtn).toHaveText('Play')

  await playBtn.click()

  // After play: play button becomes pause, stop is enabled
  await expect(page.locator('#btn-pause')).toBeVisible({ timeout: 10000 })
  await expect(page.locator('#btn-stop')).toBeEnabled()
})

test('pause button pauses playback', async ({ page }) => {
  await gotoAndWaitForEngine(page, '/songs/america')
  await page.click('#btn-play')
  await expect(page.locator('#btn-pause')).toBeVisible({ timeout: 10000 })

  await page.click('#btn-pause')

  // Should show Resume button
  await expect(page.locator('#btn-play')).toHaveText('Resume')
})

test('stop button stops playback', async ({ page }) => {
  await gotoAndWaitForEngine(page, '/songs/america')
  await page.click('#btn-play')
  await expect(page.locator('#btn-pause')).toBeVisible({ timeout: 10000 })

  await page.click('#btn-stop')

  // Should show Play button again, stop disabled
  await expect(page.locator('#btn-play')).toHaveText('Play')
  await expect(page.locator('#btn-stop')).toBeDisabled()
})

test('clicking a chord line seeks playback', async ({ page }) => {
  await gotoAndWaitForEngine(page, '/songs/america')
  // Click on a section (line-pair) to trigger seek
  const linePair = page.locator('.line-pair').first()
  if (await linePair.isVisible()) {
    await linePair.click()
    // Playback should start (or seek if already playing)
    // After click-to-seek, we should be playing
    await expect(page.locator('#btn-pause')).toBeVisible({ timeout: 10000 })
  }
})

test('double-clicking section header toggles vamp', async ({ page }) => {
  await gotoAndWaitForEngine(page, '/songs/america')
  // Start playback first so vamp is meaningful
  await page.click('#btn-play')
  await expect(page.locator('#btn-pause')).toBeVisible({ timeout: 10000 })

  // Double-click a section header
  const sectionHeader = page.locator('.section-header').first()
  if (await sectionHeader.isVisible()) {
    await sectionHeader.dblclick()
    // Look for vamp indicator (class 'vamped-section' on the section)
    const section = page.locator('.section').first()
    await expect(section).toHaveClass(/vamped-section/, { timeout: 3000 })
  }
})
