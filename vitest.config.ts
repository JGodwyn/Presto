import path from "node:path"
import { config } from "dotenv"
import { defineConfig } from "vitest/config"

// Vitest doesn't auto-load .env.local the way Next.js does — load it
// explicitly so tests see the same env vars the app does.
config({ path: path.resolve(__dirname, ".env.local") })

export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
})
