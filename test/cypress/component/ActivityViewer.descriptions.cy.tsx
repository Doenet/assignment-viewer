import React from "react";
import { ActivityViewer } from "../../../src/activity-viewer";
import type { ActivitySource } from "../../../src/Activity/activityState";
import type { SingleDocSource } from "../../../src/Activity/singleDocState";
import { IFRAME_READY_TIMEOUT } from "./helpers";

// A description is a document that is rendered like any other but is not one
// of the scored items: it gets a page, but no problem number, no per-item
// attempt, and no slot in the item numbering the host stores state by.

function mkDoc(
    id: string,
    label: string,
    isDescription: boolean,
): SingleDocSource {
    return {
        id,
        type: "singleDoc",
        isDescription,
        doenetML: isDescription
            ? `<p>${label}</p>`
            : `<problem><p>${label}: <textInput name="ti" /></p></problem>`,
        version: "0.7.24",
        numVariants: 1,
    };
}

// description, problem, problem — so the first problem is on page 2
const source: ActivitySource = {
    type: "sequence",
    id: "seq",
    title: "with descriptions",
    shuffle: false,
    items: [
        mkDoc("des1", "Read this first", true),
        mkDoc("doc1", "First problem", false),
        mkDoc("doc2", "Second problem", false),
    ],
} as ActivitySource;

function itemIframe(id: string, options?: { timeout?: number }) {
    return cy.get(`iframe[srcdoc*='"docId":"${id}"']`, options);
}

/** Assert rendered (script-stripped) iframe content for an item. */
function assertItemContent(id: string, text: string) {
    itemIframe(id)
        .its("0.contentDocument.body", { timeout: IFRAME_READY_TIMEOUT })
        .should((body: HTMLElement) => {
            const clone = body.cloneNode(true) as HTMLElement;
            clone.querySelectorAll("script").forEach((s) => {
                s.remove();
            });
            expect(clone.textContent).to.contain(text);
        });
}

describe("ActivityViewer — descriptions", () => {
    it("descriptions get a page but are not scored items", () => {
        cy.viewport(900, 700);
        cy.mount(
            <ActivityViewer
                source={source}
                activityId="descriptions"
                flags={{ allowSaveState: true }}
                paginate={true}
                itemLevelAttempts={true}
                maxAttemptsAllowed={3}
                itemWord="problem"
                addVirtualKeyboard={false}
                mountPolicy={{ parkDelayMs: 300, flushTimeoutMs: 15_000 }}
            />,
        );

        // Pagination counts every document, the description included.
        cy.contains("Page 1 of 3");
        assertItemContent("des1", "Read this first");

        // A description offers no per-item attempt. Every page stays mounted,
        // so count the buttons across the activity: one per scored item.
        cy.get("[data-test='New Item Attempt']").should("have.length", 2);
        cy.get("[data-test='New Item Attempt']:visible").should("not.exist");

        // Problem numbering skips the description: the first problem, on the
        // second page, is numbered 1.
        cy.contains("button", "Next").click();
        cy.contains("Page 2 of 3");
        assertItemContent("doc1", "Problem 1");

        // The new-attempt dialog uses the scored item numbering, so the first
        // problem is "problem 1" rather than "problem 2".
        cy.get("[data-test='New Item Attempt']:visible").click();
        cy.contains("new version of problem 1");
        cy.get("[data-test='Cancel Create New Attempt']").click();

        cy.contains("button", "Next").click();
        cy.contains("Page 3 of 3");
        assertItemContent("doc2", "Problem 2");
    });

    it("only scored items report state to the host", () => {
        // reports of an item update; the initial `new_attempt` report carries
        // no `item_updated` and is not collected
        const reports: { itemDocIds: string[]; itemUpdated: number }[] = [];

        cy.viewport(900, 700);
        cy.mount(
            <ActivityViewer
                source={source}
                activityId="descriptions-reports"
                flags={{ allowSaveState: true }}
                paginate={true}
                itemWord="problem"
                addVirtualKeyboard={false}
                mountPolicy={{ parkDelayMs: 300, flushTimeoutMs: 15_000 }}
            />,
        );

        cy.window().then((win) => {
            win.addEventListener("message", (event: MessageEvent) => {
                const data = event.data as {
                    subject?: string;
                    item_updated?: number;
                    item_scores?: { docId: string }[];
                };
                if (
                    data.subject === "SPLICE.reportScoreAndState" &&
                    data.item_updated !== undefined
                ) {
                    reports.push({
                        itemDocIds: (data.item_scores ?? []).map(
                            (s) => s.docId,
                        ),
                        itemUpdated: data.item_updated,
                    });
                }
            });
        });

        // Answer the first problem, which follows the description.
        cy.contains("button", "Next").click();
        assertItemContent("doc1", "Problem 1");
        itemIframe("doc1")
            .its("0.contentDocument.body")
            .find("input:not([type=checkbox])")
            .then(($el) => cy.wrap($el))
            .type("an answer{enter}");

        cy.then(() => {
            expect(reports.length).to.be.greaterThan(0);
            // Reported item numbers count scored items only, so the first
            // problem is item 1 even though it is the second document.
            for (const report of reports) {
                expect(report.itemUpdated).to.eq(1);
                // The description never appears among the scored items.
                expect(report.itemDocIds).to.eql(["doc1", "doc2"]);
            }
        });
    });
});
