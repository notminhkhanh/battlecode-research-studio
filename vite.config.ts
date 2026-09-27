import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { fileURLToPath } from "node:url";

const visualiser = fileURLToPath(new URL("./vendor/unswbc/packages/visualiser/src/index.ts", import.meta.url));

export default defineConfig({
  plugins: [
    svelte({ compilerOptions: { cssHash: ({ hash, css, name }) => `svelte-${hash(name + css)}` } }),
  ],
  resolve: {
    alias: { "@battledragon/visualiser": visualiser },
    dedupe: ["@lucide/svelte", "capnp-es", "svelte"],
  },
  build: {
    outDir: "dist/webview",
    emptyOutDir: true,
    assetsInlineLimit: 200000,
    cssCodeSplit: false,
    lib: {
      entry: fileURLToPath(new URL("./webview/main.ts", import.meta.url)),
      formats: ["iife"],
      name: "BattlecodeResearchWebview",
      fileName: () => "webview.js",
    },
    rollupOptions: { output: { assetFileNames: "webview.[ext]" } },
  },
});
