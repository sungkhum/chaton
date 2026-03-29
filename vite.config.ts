import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { serwist } from "@serwist/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths(),
    tailwindcss(),
    serwist({
      swSrc: "src/sw.ts",
      swDest: "sw.js",
      globDirectory: "dist",
      injectionPoint: "self.__SW_MANIFEST",
      rollupFormat: "iife",
    }),
  ],
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          "emoji-mart": ["@emoji-mart/data", "@emoji-mart/react", "emoji-mart"],
          "deso": ["deso-protocol"],
        },
      },
    },
  },
});
