import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      manifest: {
        name: "Local Writer",
        short_name: "Local Writer",
        description: "Private on-device writing assistant",
        theme_color: "#173f35",
        background_color: "#f6f5ef",
        display: "standalone",
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,ico,wasm}"],
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
