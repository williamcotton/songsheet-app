import { test, expect } from '@playwright/test'

test('song list page displays songs', async ({ page }) => {
  await page.goto('/songs')
  await expect(page.locator('h1')).toHaveText('Songs')
  // Should have at least one song link
  const links = page.locator('#song-list ul li a')
  await expect(links.first()).toBeVisible()
})

test('clicking a song navigates to song detail', async ({ page }) => {
  await page.goto('/songs')
  const firstLink = page.locator('#song-list ul li a').first()
  const href = await firstLink.getAttribute('href')
  await firstLink.click()
  await expect(page).toHaveURL(href!)
  // Song detail should have controls
  await expect(page.locator('#controls')).toBeVisible()
})
