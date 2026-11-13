import { defineConfig, devices } from '@playwright/test'
import baseConfig from './playwright.config'

// Staging config: points at the deployed staging URL instead of building
// and serving locally — no webServer block, since there's nothing to
// build, just a live deployment to smoke-test post-push. Requires the
// STAGING_URL repo secret (e.g. https://staging.your-app.vercel.app).
export default defineConfig({
  ...baseConfig,
  use: {
    ...baseConfig.use,
    baseURL: process.env.STAGING_URL,
  },
  webServer: undefined,
})
