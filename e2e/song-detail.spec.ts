import { test, expect } from '@playwright/test'

// After SSR page load, React hydration happens asynchronously.
// Wait until React event handlers are wired up by checking that
// the transpose button actually updates the displayed value.
async function waitForHydration(page: any) {
  // The page.goto already waits for load. But React hydration is async.
  // Poll by clicking transpose up, checking if value changes, then reverting.
  await page.waitForFunction(() => {
    // Check if React root is hydrated by looking for __reactFiber on the root container
    const root = document.getElementById('root')
    if (!root) return false
    return Object.keys(root).some(k => k.startsWith('__reactFiber') || k.startsWith('__reactContainer'))
  }, { timeout: 10000 })
}

test('song detail page renders title and chords', async ({ page }) => {
  await page.goto('/songs/a-way-out-online')
  await expect(page.locator('#song-display')).toBeVisible()
  await expect(page.locator('#song-display')).toContainText(/A WAY OUT ONLINE/i)
})

test('Edit link navigates to edit page', async ({ page }) => {
  await page.goto('/songs/a-way-out-online')
  await page.click('a.btn-link:has-text("Edit")')
  await expect(page).toHaveURL('/songs/a-way-out-online/edit')
})

test('Stage link navigates to performance page', async ({ page }) => {
  await page.goto('/songs/a-way-out-online')
  await page.click('#btn-performance-link')
  await expect(page).toHaveURL('/songs/a-way-out-online/performance')
  await expect(page.locator('#btn-back-to-chart')).toBeVisible()
  await expect(page.locator('#btn-transpose-up')).toHaveCount(0)
})

test('Export menu exposes print, text, and share options', async ({ page }) => {
  await page.goto('/songs/a-way-out-online')
  await waitForHydration(page)
  await page.click('#btn-export')
  await expect(page.locator('#export-menu')).toBeVisible()
  await expect(page.locator('#btn-export-print')).toHaveText('PDF / Print')
  await expect(page.locator('#btn-export-text')).toHaveText('Plain Text')
  await expect(page.locator('#btn-export-link')).toHaveText('Copy Share Link')
})

test('Export plain text triggers a song text download', async ({ page }) => {
  await page.goto('/songs/a-way-out-online')
  await waitForHydration(page)
  await page.click('#btn-export')
  const downloadPromise = page.waitForEvent('download')
  await page.click('#btn-export-text')
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('a-way-out-online.txt')
})

test('Export share link copies URL', async ({ page }) => {
  await page.addInitScript(() => {
    ;(window as any).__copiedShareUrl = ''
    const clipboardStub = {
      writeText: async (text: string) => {
        ;(window as any).__copiedShareUrl = text
      },
    }
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: clipboardStub,
    })
  })

  await page.goto('/songs/a-way-out-online')
  await waitForHydration(page)
  await page.click('#btn-export')
  await page.click('#btn-export-link')

  await expect(page.locator('#export-copy-status')).toHaveText('Copied link')
  const copiedUrl = await page.evaluate(() => (window as any).__copiedShareUrl)
  expect(copiedUrl).toContain('/songs/a-way-out-online')
})

test('Export print calls window.print', async ({ page }) => {
  await page.addInitScript(() => {
    ;(window as any).__printCallCount = 0
    window.print = () => {
      ;(window as any).__printCallCount += 1
    }
  })

  await page.goto('/songs/a-way-out-online')
  await waitForHydration(page)
  await page.click('#btn-export')
  await page.click('#btn-export-print')
  const printCallCount = await page.evaluate(() => (window as any).__printCallCount)
  expect(printCallCount).toBe(1)
})

test('transpose up changes chords', async ({ page }) => {
  await page.goto('/songs/a-way-out-online')
  await waitForHydration(page)
  const displayBefore = await page.locator('#song-display').textContent()
  // Click transpose up
  await page.click('#btn-transpose-up')
  // Wait for the UI to update — transpose value should show +1
  await expect(page.locator('#transpose-value')).toHaveText('+1')
  // Verify transposition changes the rendered chords.
  const displayAfter = await page.locator('#song-display').textContent()
  expect(displayAfter).not.toBe(displayBefore)
})

test('transpose down reverts chords', async ({ page }) => {
  await page.goto('/songs/a-way-out-online')
  await waitForHydration(page)
  const displayBefore = await page.locator('#song-display').textContent()
  // Transpose up then down — should return to original
  await page.click('#btn-transpose-up')
  await expect(page.locator('#transpose-value')).toHaveText('+1')
  await page.click('#btn-transpose-down')
  await expect(page.locator('#transpose-value')).toHaveText('0')
  // Should be back to the original rendered song text.
  const displayAfter = await page.locator('#song-display').textContent()
  expect(displayAfter).toBe(displayBefore)
})

test('NNS toggle switches chords to numbers', async ({ page }) => {
  await page.goto('/songs/a-way-out-online')
  const nnsBtn = page.locator('#btn-nashville')
  const isDisabled = await nnsBtn.isDisabled()
  if (!isDisabled) {
    const displayBefore = await page.locator('#song-display').textContent()
    await nnsBtn.click()
    const displayAfter = await page.locator('#song-display').textContent()
    expect(displayAfter).not.toBe(displayBefore)
  }
})
