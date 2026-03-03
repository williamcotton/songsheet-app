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

test.beforeAll(async () => {
  await mkdir('screenshots', { recursive: true })
})

test('README: parse a-way-out-online into full song detail page', async ({ page }) => {
  await page.setViewportSize(VIEWPORT)
  await page.goto('/songs/a-way-out-online')
  await waitForHydration(page)
  await expect(page.locator('#song-title')).toContainText(/A Way Out Online/i)
  await expect(page.locator('#song-display')).toContainText('Well I know you Knight Riders')
  await page.screenshot({ path: 'screenshots/readme-song-detail-full.png', fullPage: true })
})
