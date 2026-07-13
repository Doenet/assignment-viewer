import React, { useState } from "react";
import { ActivityViewer } from "../../../src/activity-viewer";
import { IFRAME_READY_TIMEOUT } from "./helpers";
import type { ActivitySource } from "../../../src/Activity/activityState";

// Issue #40: a source/runtime error must clear once the underlying problem
// is fixed — updating the `source` prop from an invalid to a valid activity
// on the SAME mounted component must leave the error screen and render the
// activity. (Previously `errMsg` was set from inside a useMemo and never
// reset, so the stale error persisted forever.)

const VALID_SOURCE: ActivitySource = {
    type: "singleDoc",
    id: "test-doc",
    doenetML: "<p>Recovered content</p>",
    version: "0.7.4",
    isDescription: false,
    numVariants: 1,
};

// Duplicate ids: rejected by source validation (validateIds).
const INVALID_SOURCE: ActivitySource = {
    type: "sequence",
    id: "dup",
    title: "duplicated ids",
    shuffle: false,
    items: [
        {
            type: "singleDoc",
            id: "dup",
            doenetML: "<p>one</p>",
            version: "0.7.4",
            isDescription: false,
            numVariants: 1,
        },
    ],
};

/**
 * Assert the iframe rendered `text` as real content. The raw doenetML also
 * sits in a `<script type="text/doenetml">` tag inside the iframe, so a
 * plain `contain.text` on the body would match before (or without) any
 * rendering — strip script tags first.
 */
function assertRenderedContent(text: string) {
    cy.get("iframe")
        .its("0.contentDocument.body", { timeout: IFRAME_READY_TIMEOUT })
        .should((body: HTMLElement) => {
            const clone = body.cloneNode(true) as HTMLElement;
            clone.querySelectorAll("script").forEach((s) => {
                s.remove();
            });
            expect(clone.textContent).to.contain(text);
        });
}

function Harness() {
    const [valid, setValid] = useState(true);
    return (
        <div>
            <button
                data-test="toggle-source"
                onClick={() => {
                    setValid(!valid);
                }}
            >
                source: {valid ? "valid" : "invalid"}
            </button>
            <ActivityViewer
                source={valid ? VALID_SOURCE : INVALID_SOURCE}
                activityId="error-recovery"
                addVirtualKeyboard={false}
            />
        </div>
    );
}

describe("ActivityViewer — error state clears when the source is fixed", () => {
    it("shows a source error and recovers when a valid source arrives on the same mount", () => {
        cy.mount(<Harness />);

        // Healthy at first.
        assertRenderedContent("Recovered content");
        cy.contains("Error in activity source").should("not.exist");

        // Break the source: the error screen replaces the activity.
        cy.get("[data-test=toggle-source]").click();
        cy.contains("Error in activity source").should("exist");
        cy.get("iframe").should("not.exist");

        // Fix the source on the same mounted component: the error clears
        // and the activity renders again.
        cy.get("[data-test=toggle-source]").click();
        cy.contains("Error in activity source").should("not.exist");
        assertRenderedContent("Recovered content");
    });
});
