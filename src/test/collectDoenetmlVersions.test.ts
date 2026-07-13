import { describe, expect, it } from "vitest";
import { SequenceSource } from "../Activity/sequenceState";
import { SelectSource } from "../Activity/selectState";
import { SingleDocSource } from "../Activity/singleDocState";
import { collectDoenetmlVersions } from "../Activity/activityState";
import doc from "./testSources/doc.json";
import seq2sel from "./testSources/seq2sel.json";

function mkDoc(id: string, version: string): SingleDocSource {
    return {
        id,
        type: "singleDoc",
        isDescription: false,
        doenetML: "<p>hi</p>",
        version,
    };
}

describe("collectDoenetmlVersions", () => {
    it("single document", () => {
        expect(collectDoenetmlVersions(doc as SingleDocSource)).eqls(["0.7.4"]);
    });

    it("uniform versions collapse to one entry", () => {
        expect(
            collectDoenetmlVersions(seq2sel as SequenceSource),
        ).to.have.length(1);
    });

    it("mixed versions are reported in first-appearance order", () => {
        const source: SequenceSource = {
            id: "seq",
            type: "sequence",
            title: "mixed",
            shuffle: false,
            items: [
                mkDoc("a", "0.7.4"),
                {
                    id: "sel",
                    type: "select",
                    title: "sel",
                    numToSelect: 1,
                    selectByVariant: false,
                    items: [mkDoc("b", "0.6.5"), mkDoc("c", "0.7.4")],
                } as SelectSource,
                mkDoc("d", "0.7"),
            ],
        } as SequenceSource;

        expect(collectDoenetmlVersions(source)).eqls(["0.7.4", "0.6.5", "0.7"]);
    });

    it("a container with no documents yields no versions", () => {
        const source: SequenceSource = {
            id: "seq",
            type: "sequence",
            title: "empty",
            shuffle: false,
            items: [],
        } as SequenceSource;

        expect(collectDoenetmlVersions(source)).eqls([]);
    });
});
