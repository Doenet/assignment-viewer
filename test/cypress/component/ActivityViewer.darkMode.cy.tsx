import React, { useState } from "react";
import { ActivityViewer } from "../../../src/activity-viewer";
import {
    STANDALONE_URL,
    STANDALONE_CSS_URL,
    IFRAME_READY_TIMEOUT,
} from "./helpers";
import type { ActivitySource } from "../../../src/Activity/activityState";

const ACTIVITY_SOURCE: ActivitySource = {
    type: "singleDoc",
    id: "test-doc",
    doenetML: "<p>Hello dark mode</p>",
    version: "0.7.4",
    isDescription: false,
    numVariants: 1,
};

const DARK_BG = "rgb(18, 18, 18)"; // --canvas in dark: #121212
const LIGHT_BG = "rgb(255, 255, 255)"; // --canvas in light: white

/** Assert background-color on the assignment-viewer root div. */
function assertRootBg(expected: string) {
    cy.get(".assignment-viewer-root").should(
        "have.css",
        "background-color",
        expected,
    );
}

/** Assert the CSS-applied background on the iframe element itself
 *  (set by our `.assignment-viewer-root iframe` rule). */
function assertIframeElBg(expected: string) {
    cy.get(".assignment-viewer-root iframe").should(
        "have.css",
        "background-color",
        expected,
    );
}

/** Wait for the iframe body to load, then assert its background-color. */
function assertIframeBodyBg(expected: string) {
    cy.get("iframe")
        .its("0.contentDocument.body", { timeout: IFRAME_READY_TIMEOUT })
        .should("have.css", "background-color", expected);
}

function viewer(darkMode: "light" | "dark" | "system") {
    return (
        <ActivityViewer
            source={ACTIVITY_SOURCE}
            activityId="test"
            darkMode={darkMode}
            standaloneUrl={STANDALONE_URL}
            cssUrl={STANDALONE_CSS_URL}
            addVirtualKeyboard={false}
        />
    );
}

describe("ActivityViewer — dark mode", () => {
    describe("root element data-theme and background", () => {
        it('darkMode="dark" sets data-theme="dark" and dark background', () => {
            cy.mount(viewer("dark"));
            cy.get(".assignment-viewer-root")
                .should("have.attr", "data-theme", "dark")
                .and("have.css", "background-color", DARK_BG);
        });

        it('darkMode="light" sets data-theme="light" and white background', () => {
            cy.mount(viewer("light"));
            cy.get(".assignment-viewer-root")
                .should("have.attr", "data-theme", "light")
                .and("have.css", "background-color", LIGHT_BG);
        });
    });

    describe("iframe element background (CSS rule)", () => {
        it('darkMode="dark" gives the iframe element a dark background', () => {
            cy.mount(viewer("dark"));
            assertIframeElBg(DARK_BG);
        });

        it('darkMode="light" gives the iframe element a white background', () => {
            cy.mount(viewer("light"));
            assertIframeElBg(LIGHT_BG);
        });
    });

    describe("iframe body background (loaded from CDN)", () => {
        it('darkMode="dark" sets iframe body background to dark', () => {
            cy.mount(viewer("dark"));
            assertIframeBodyBg(DARK_BG);
        });

        it('darkMode="light" sets iframe body background to white', () => {
            cy.mount(viewer("light"));
            assertIframeBodyBg(LIGHT_BG);
        });
    });

    describe("darkMode prop change after mount", () => {
        it("switching dark→light→dark updates root and iframe backgrounds", () => {
            function Harness() {
                const [darkMode, setDarkMode] = useState<"light" | "dark">(
                    "dark",
                );
                return (
                    <div>
                        <button
                            data-test="toggle"
                            onClick={() => {
                                setDarkMode((m) =>
                                    m === "dark" ? "light" : "dark",
                                );
                            }}
                        >
                            Toggle
                        </button>
                        <ActivityViewer
                            source={ACTIVITY_SOURCE}
                            activityId="test"
                            darkMode={darkMode}
                            standaloneUrl={STANDALONE_URL}
                            cssUrl={STANDALONE_CSS_URL}
                            addVirtualKeyboard={false}
                        />
                    </div>
                );
            }

            cy.mount(<Harness />);

            // Starts dark
            assertRootBg(DARK_BG);
            assertIframeBodyBg(DARK_BG);

            // Switch to light
            cy.get("[data-test=toggle]").click();
            assertRootBg(LIGHT_BG);
            assertIframeBodyBg(LIGHT_BG);

            // Switch back to dark
            cy.get("[data-test=toggle]").click();
            assertRootBg(DARK_BG);
            assertIframeBodyBg(DARK_BG);
        });
    });
});
