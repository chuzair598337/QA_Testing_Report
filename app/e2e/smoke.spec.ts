import { test, expect } from '@playwright/test'

// Minimal smoke suite — no auth, no data setup. Just proves the SPA
// actually boots and the router's auth guard is doing its job. This is
// what the QA gate and the staging smoke test both run.

test('home page loads', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('QA Testing Report')
})

test('dashboard redirects to login when unauthenticated', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
  await expect(page.locator('h1.auth-title')).toHaveText('Log in')
})
