import React from "react";
import { ActivityViewer } from "../../../src/activity-viewer";
import type { ActivitySource } from "../../../src/Activity/activityState";
import type { SingleDocSource } from "../../../src/Activity/singleDocState";
import {
    STANDALONE_URL,
    STANDALONE_CSS_URL,
    IFRAME_READY_TIMEOUT,
} from "./helpers";

// `addVirtualKeyboard` must reach each document's embedded `<DoenetViewer>`,
// whose iframe wrapper draws the virtual keyboard tray in this page. Every
// viewer on a page shares one tray, so an activity of several documents still
// shows a single keyboard.

function mkDoc(id: string): SingleDocSource {
    return {
        id,
        type: "singleDoc",
        isDescription: false,
        doenetML: `<p><mathInput name="mi" /></p>`,
        version: "0.7.24",
        numVariants: 1,
    };
}

const SOURCE = {
    type: "sequence",
    id: "seq",
    title: "keyboard",
    shuffle: false,
    items: [mkDoc("doc1"), mkDoc("doc2")],
} as ActivitySource;

function waitForDocuments() {
    cy.get("iframe", { timeout: IFRAME_READY_TIMEOUT }).should(
        "have.length",
        2,
    );
    cy.get("iframe").each(($iframe) => {
        cy.wrap($iframe)
            .its("0.contentDocument.body", { timeout: IFRAME_READY_TIMEOUT })
            .find("#mi", { timeout: IFRAME_READY_TIMEOUT })
            .should("exist");
    });
}

describe("ActivityViewer — virtual keyboard", () => {
    it("offers one virtual keyboard for all its documents by default", () => {
        cy.mount(
            <ActivityViewer
                source={SOURCE}
                activityId="keyboard"
                paginate={false}
                standaloneUrl={STANDALONE_URL}
                cssUrl={STANDALONE_CSS_URL}
            />,
        );

        waitForDocuments();
        cy.get("#virtual-keyboard-tray").should("have.length", 1);
        cy.get(".open-keyboard-button").should("have.length", 1);
    });

    it("leaves the keyboard out when addVirtualKeyboard is false", () => {
        cy.mount(
            <ActivityViewer
                source={SOURCE}
                activityId="keyboard"
                paginate={false}
                addVirtualKeyboard={false}
                standaloneUrl={STANDALONE_URL}
                cssUrl={STANDALONE_CSS_URL}
            />,
        );

        waitForDocuments();
        cy.get("#virtual-keyboard-tray").should("not.exist");
        cy.get(".open-keyboard-button").should("not.exist");
    });
});
