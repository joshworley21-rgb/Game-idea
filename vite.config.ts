import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        // One JS file: the single-file artifact build inlines the bundle, and a
        // code-split chunk would be left behind as an unresolvable request.
        inlineDynamicImports: true,
      },
    },
  },
});
