import { mkdir } from 'node:fs/promises'
import { test, expect } from '@playwright/test'

const VIEWPORT = { width: 1440, height: 1024 }

async function waitForHydration(page: any) {
  await page.waitForFunction(() => {
    const root = document.getElementById('root')
    if (!root) return false
    return Object.keys(root).some(k => k.startsWith('__reactFiber') || k.startsWith('__reactContainer'))
  }, { timeout: 10000 })
}

async function enableAudioContext(page: any) {
  await page.addInitScript(() => {
    const OriginalAudioContext = window.AudioContext || (window as any).webkitAudioContext
    if (!OriginalAudioContext) return
    const origResume = OriginalAudioContext.prototype.resume
    OriginalAudioContext.prototype.resume = function () {
      Object.defineProperty(this, 'state', { value: 'running', writable: true, configurable: true })
      return origResume.call(this)
    }
  })
}

test.beforeAll(async () => {
  await mkdir('screenshots', { recursive: true })
})

test('README: song library landing page', async ({ page }) => {
  await page.setViewportSize(VIEWPORT)
  await page.goto('/songs')
  await expect(page.locator('h1')).toHaveText('Songs')
  await expect(page.locator('#song-list ul li a').first()).toBeVisible()
  await page.screenshot({ path: 'screenshots/readme-song-list.png' })
})

test('README: parse a-way-out-online into full song detail page', async ({ page }) => {
  await page.setViewportSize(VIEWPORT)
  await page.goto('/songs/a-way-out-online')
  await waitForHydration(page)
  await expect(page.locator('#song-title')).toContainText(/A Way Out Online/i)
  await expect(page.locator('#song-display')).toContainText('Well I know you Knight Riders')
  await page.screenshot({ path: 'screenshots/readme-song-detail-full.png', fullPage: true })
})

test('README: live editing updates preview in-place', async ({ page }) => {
  await page.setViewportSize(VIEWPORT)
  await page.goto('/songs/a-way-out-online/edit')
  await waitForHydration(page)

  const textarea = page.locator('.edit-textarea')
  const original = await textarea.inputValue()
  const edited = original.replace(
    'A Way Out Online - Willie Cotton',
    'A Way Out Online (Draft Edit) - Willie Cotton'
  )

  await textarea.evaluate((el: HTMLTextAreaElement, nextValue: string) => {
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value'
    )!.set!
    nativeSetter.call(el, nextValue)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }, edited)

  await expect(page.locator('#song-title')).toContainText(/Draft Edit/i)
  await page.screenshot({ path: 'screenshots/readme-live-edit.png' })
})

test('README: transpose and tempo controls reshape playback settings', async ({ page }) => {
  await page.setViewportSize(VIEWPORT)
  await page.goto('/songs/a-way-out-online')
  await waitForHydration(page)

  await page.click('#btn-transpose-up')
  await page.click('#btn-transpose-up')
  await expect(page.locator('#transpose-value')).toHaveText('+2')

  await page.locator('#bpm-slider').evaluate((el: HTMLInputElement, nextValue: string) => {
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )!.set!
    nativeSetter.call(el, nextValue)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }, '132')
  await expect(page.locator('#bpm-value')).toHaveText('132')

  await page.click('#btn-metronome')
  await expect(page.locator('#btn-metronome')).not.toHaveClass(/on/)

  await page.screenshot({ path: 'screenshots/readme-transpose-tempo.png' })
})

test('README: playback controls and section vamp loop', async ({ page }) => {
  await enableAudioContext(page)
  await page.setViewportSize(VIEWPORT)
  await page.goto('/songs/a-way-out-online')
  await waitForHydration(page)
  await page.waitForTimeout(500)

  await page.click('#btn-play')
  await expect(page.locator('#btn-pause')).toBeVisible({ timeout: 10000 })

  await page.locator('.section-header').first().dblclick()
  await expect(page.locator('.section').first()).toHaveClass(/vamped-section/, { timeout: 3000 })

  await page.screenshot({ path: 'screenshots/readme-playback-loop.png' })
})

test('README: performance mode stage layout', async ({ page }) => {
  await enableAudioContext(page)
  await page.setViewportSize(VIEWPORT)
  await page.goto('/songs/a-way-out-online/performance')
  await waitForHydration(page)
  await page.waitForTimeout(500)

  await expect(page.locator('#song-display')).toContainText('Well I know you Knight Riders')
  await expect(page.locator('#btn-transpose-up')).toHaveCount(0)

  await page.screenshot({ path: 'screenshots/readme-performance-mode.png' })
})

test('README: Nashville numbers on keyed songs', async ({ page }) => {
  await page.setViewportSize(VIEWPORT)
  await page.goto('/songs/spent-some-time-in-buffalo')
  await waitForHydration(page)

  const displayBefore = await page.locator('#song-display').textContent()
  const nnsBtn = page.locator('#btn-nashville')
  await expect(nnsBtn).toBeEnabled()
  await nnsBtn.click()
  await expect(nnsBtn).toHaveClass(/on/)

  const displayAfter = await page.locator('#song-display').textContent()
  expect(displayAfter).not.toBe(displayBefore)
  await expect(page.locator('.chord-nashville').first()).toBeVisible()

  await page.screenshot({ path: 'screenshots/readme-nashville.png' })
})
