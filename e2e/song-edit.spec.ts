import { test, expect } from '@playwright/test'

async function waitForHydration(page: any) {
  await page.waitForFunction(() => {
    const root = document.getElementById('root')
    if (!root) return false
    return Object.keys(root).some(k => k.startsWith('__reactFiber') || k.startsWith('__reactContainer'))
  }, { timeout: 10000 })
}

test('edit page shows textarea and preview', async ({ page }) => {
  await page.goto('/songs/a-way-out-online/edit')
  await expect(page.locator('.edit-textarea')).toBeVisible()
  await expect(page.locator('.edit-right')).toBeVisible()
})

test('typing in textarea updates preview', async ({ page }) => {
  await page.goto('/songs/a-way-out-online/edit')
  await waitForHydration(page)
  const textarea = page.locator('.edit-textarea')
  const preview = page.locator('.edit-right #song-display')

  await expect(preview).toContainText(/A WAY OUT ONLINE/i)

  // Use evaluate to set value via React's native value setter, which triggers onChange
  await textarea.evaluate((el: HTMLTextAreaElement) => {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, 'value'
    )!.set!
    nativeInputValueSetter.call(el, 'TEST TITLE - TEST AUTHOR\n\nVERSE:\nD  A\nHello world\n')
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })

  // Preview should update with new content
  await expect(preview).toContainText('TEST TITLE', { timeout: 5000 })
})

test('save submits form and reloads', async ({ page }) => {
  await page.goto('/songs/a-way-out-online/edit')
  const textarea = page.locator('.edit-textarea')

  // Read original text to restore later
  const originalText = await textarea.inputValue()

  // Submit the form (without changing content to avoid modifying the fixture)
  await page.click('button[type="submit"]')

  // Should redirect back to the edit page
  await expect(page).toHaveURL('/songs/a-way-out-online/edit')
  await expect(textarea).toBeVisible()

  // Verify content is preserved after save
  const textAfterSave = await textarea.inputValue()
  expect(textAfterSave).toBe(originalText)
})
