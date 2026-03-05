import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    format: ["esm"],
    dts: true,
    clean: true,
    minify: true,
    outDir: "dist",
    target: "es2022",
    banner: {
        js: "#!/usr/bin/env node",
    }
});
