import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
  root: path.resolve(__dirname, "src/renderer"),
  base: "./",
  build: {
    outDir: path.resolve(__dirname, "dist/renderer"),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
    host: "127.0.0.1",
  },
  plugins: [react()],
});
