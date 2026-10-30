import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [
    dts({
      entryRoot: "src",
      insertTypesEntry: true,
      exclude: ["**/*.test.ts"],
    }),
  ],
  build: {
    sourcemap: true,
    lib: {
      entry: ["src/index.ts", "src/client/index.ts"],
      formats: ["es"],
    },
    rollupOptions: {
      external: ["next-auth"],
      output: {
        entryFileNames: "[name].js",
        preserveModules: true,
        preserveModulesRoot: "src",
      },
    },
  },
});
