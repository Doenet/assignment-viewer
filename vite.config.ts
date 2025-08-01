import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import dts from "vite-plugin-dts";

const fullReloadAlways: Plugin = {
    name: "full-reload",
    handleHotUpdate({ server }) {
        server.ws.send({ type: "full-reload" });
        return [];
    },
};

// These are the dependencies that will not be bundled into the library.
const EXTERNAL_DEPS = ["react", "react-dom", "@doenet/doenetml-iframe"];

export default defineConfig({
    plugins: [react(), dts(), fullReloadAlways],
    build: {
        minify: false,
        lib: {
            entry: {
                index: "./src/index.ts",
            },
            formats: ["es"],
        },
        rollupOptions: {
            external: EXTERNAL_DEPS,
            output: {
                globals: Object.fromEntries(
                    EXTERNAL_DEPS.map((dep) => [dep, dep]),
                ),
            },
            onwarn(warning, warn) {
                // Ignore warnings about module level directives. I.e., literal strings like `"use strict";` included at the top of source code.
                if (warning.code === "MODULE_LEVEL_DIRECTIVE") {
                    return;
                }
                warn(warning);
            },
        },
    },
});
