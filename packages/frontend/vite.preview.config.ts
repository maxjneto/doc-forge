/**
 * Design preview: the real app with Clerk stubbed and the API answered from
 * fixtures (preview/). For reviewing screens without a backend or a login.
 * Never used by `build` — see `npm run dev:preview`.
 */
import { defineConfig, mergeConfig, type Plugin } from "vite";
import { resolve } from "path";
import base from "./vite.config";

const previewEntry: Plugin = {
  name: "docforge-preview-entry",
  transformIndexHtml: (html) => html.replace("/src/main.tsx", "/preview/main.tsx"),
};

export default mergeConfig(
  base,
  defineConfig({
    plugins: [previewEntry],
    resolve: {
      alias: {
        "@clerk/clerk-react": resolve(__dirname, "./preview/clerk-stub.tsx"),
      },
    },
    server: { port: 5199 },
    build: { target: "es2022" },
    esbuild: { target: "es2022" },
  }),
);
