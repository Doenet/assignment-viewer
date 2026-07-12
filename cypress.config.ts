import { defineConfig } from "cypress";
import vitePreprocessor from "cypress-vite";

export default defineConfig({
    retries: {
        runMode: 2,
        openMode: 0,
    },
    component: {
        devServer: {
            framework: "react",
            bundler: "vite",
            viteConfig: {
                resolve: {
                    dedupe: ["react", "react-dom"],
                },
            },
        },
        specPattern: "test/cypress/component/**/*.cy.{js,jsx,ts,tsx}",
        supportFile: "test/cypress/support/component.ts",
        indexHtmlFile: "test/cypress/support/component-index.html",
        setupNodeEvents(on) {
            on("file:preprocessor", vitePreprocessor());
        },
    },
});
