import React from "react";
import { ActivityViewer } from "../../../src/activity-viewer";
import type { ActivitySource } from "../../../src/Activity/activityState";
import {
    STANDALONE_URL,
    STANDALONE_CSS_URL,
    IFRAME_READY_TIMEOUT,
} from "./helpers";

// `doenetViewerUrl` (the `<ref>` renderer's activity-link base) and
// `doenetImagesUrl` (the `<image source="doenet:…">` base, DoenetML#1457) are
// props of the inner DoenetViewer. ActivityViewer must thread them through
// Viewer → Activity → SingleDocActivity to each embedded `<DoenetViewer>`.
// The iframe wrapper bakes a booted viewer's props into the iframe `srcdoc`,
// so a forwarded URL shows up there — a stable check that does not depend on
// the bundle rendering a ref/image.

const VIEWER_URL = "https://viewer.example.test/activityViewer";
const IMAGES_URL = "https://images.example.test/api/media";

const SOURCE: ActivitySource = {
    type: "singleDoc",
    id: "doc",
    doenetML: "<p>hello</p>",
    version: "0.7.4",
    isDescription: false,
    numVariants: 1,
} as ActivitySource;

describe("ActivityViewer — forwards doenetViewerUrl and doenetImagesUrl to the viewer", () => {
    it("bakes both URLs into the embedded DoenetViewer's iframe", () => {
        cy.mount(
            <ActivityViewer
                source={SOURCE}
                activityId="urls"
                addVirtualKeyboard={false}
                standaloneUrl={STANDALONE_URL}
                cssUrl={STANDALONE_CSS_URL}
                doenetViewerUrl={VIEWER_URL}
                doenetImagesUrl={IMAGES_URL}
            />,
        );

        cy.get("iframe", { timeout: IFRAME_READY_TIMEOUT })
            .should("have.attr", "srcdoc")
            .and("include", VIEWER_URL)
            .and("include", IMAGES_URL);
    });
});
