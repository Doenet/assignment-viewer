import React from "react";
import { ActivityViewer } from "../../../src/activity-viewer";
import type { ActivityViewerWarning } from "../../../src/activity-viewer";
import type { ActivitySource } from "../../../src/Activity/activityState";

// Issue #39: an assignment whose documents request different DoenetML
// versions makes every viewer load a separate multi-MB standalone bundle
// per distinct version. A console warning is invisible to the site's
// visitors, so the condition is reported to the containing page through
// `reportWarningsCallback` — the page decides how to display it.

const MIXED_SOURCE: ActivitySource = {
    type: "sequence",
    id: "seq",
    title: "mixed versions",
    shuffle: false,
    items: [
        {
            type: "singleDoc",
            id: "doc-a",
            doenetML: "<p>doc a</p>",
            version: "0.7.4",
            isDescription: false,
            numVariants: 1,
        },
        {
            type: "singleDoc",
            id: "doc-b",
            doenetML: "<p>doc b</p>",
            version: "0.7.3",
            isDescription: false,
            numVariants: 1,
        },
    ],
} as ActivitySource;

const UNIFORM_SOURCE: ActivitySource = {
    type: "singleDoc",
    id: "doc-u",
    doenetML: "<p>uniform</p>",
    version: "0.7.4",
    isDescription: false,
    numVariants: 1,
};

describe("ActivityViewer — mixed DoenetML versions are reported to the host", () => {
    it("calls reportWarningsCallback exactly once with the distinct versions", () => {
        const received: ActivityViewerWarning[][] = [];
        cy.mount(
            <ActivityViewer
                source={MIXED_SOURCE}
                activityId="mixed"
                addVirtualKeyboard={false}
                reportWarningsCallback={(warnings) => {
                    received.push(warnings);
                }}
            />,
        );

        cy.wrap(null).should(() => {
            expect(received, "reported once").to.have.length(1);
            expect(received[0]).to.eql([
                {
                    type: "mixedDoenetmlVersions",
                    versions: ["0.7.4", "0.7.3"],
                },
            ]);
        });
        // Still exactly one report after re-renders settle.
        cy.wrap(null).should(() => {
            expect(received).to.have.length(1);
        });
    });

    it("stays silent for a uniform assignment", () => {
        const received: ActivityViewerWarning[][] = [];
        cy.mount(
            <ActivityViewer
                source={UNIFORM_SOURCE}
                activityId="uniform"
                addVirtualKeyboard={false}
                reportWarningsCallback={(warnings) => {
                    received.push(warnings);
                }}
            />,
        );

        // The viewer mounts (its iframe appears) without any warning report.
        cy.get("iframe").should("exist");
        cy.wrap(null).should(() => {
            expect(received).to.have.length(0);
        });
    });
});
