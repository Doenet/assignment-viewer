import { describe, expect, it } from "vitest";

import seqShuf from "./testSources/seqShuf.json";
import selMult1doc from "./testSources/selMult1doc.json";
import selMult2docs from "./testSources/selMult2docs.json";
import seq2sel from "./testSources/seq2sel.json";
import selMult4docsNoVariant from "./testSources/selMult4docsNoVariant.json";

import { SequenceSource, SequenceState } from "../Activity/sequenceState";
import {
    gatherDocumentStructure,
    generateNewActivityAttempt,
    generateNewSubActivityAttempt,
    initializeActivityState,
} from "../Activity/activityState";
import { SingleDocState } from "../Activity/singleDocState";
import { SelectSource, SelectState } from "../Activity/selectState";

describe("Test of generating new item attempts", () => {
    it("sequence", () => {
        const source = seqShuf as SequenceSource;
        const { numActivityVariants, questionCounts } =
            gatherDocumentStructure(source);

        const allQuestionVariants: number[][][] = [];

        const variants = [1, 2, 3, 1, 3];

        for (const variant of variants) {
            const initialState0 = initializeActivityState({
                source,
                variant,
                parentId: null,
                numActivityVariants,
            }) as SequenceState;

            const res = generateNewActivityAttempt({
                state: initialState0,
                numActivityVariants,
                initialQuestionCounter: 1,
                questionCounts,
                parentAttempt: 1,
            });
            const initialState = res.state as SequenceState;

            const docIds = initialState.orderedChildren.map((a) => a.id);
            expect([...docIds].sort()).eqls(["doc1", "doc4", "doc5"]);

            const questionVariants: number[][] = [[], [], []];
            allQuestionVariants.push(questionVariants);

            let state = initialState;

            for (const [idx, docId] of docIds.entries()) {
                const questionIdx = ["doc1", "doc4", "doc5"].indexOf(docId);
                for (let i = 0; i < 10; i++) {
                    const activities = state.orderedChildren;

                    expect(activities.length).eq(3);

                    const doc = activities[idx] as SingleDocState;

                    questionVariants[questionIdx].push(doc.currentVariant);

                    state = generateNewSubActivityAttempt({
                        id: docId,
                        state,
                        numActivityVariants,
                        initialQuestionCounter: 1, // not right, but doesn't matter for this test
                        questionCounts,
                    }) as SequenceState;
                }
            }

            expect(questionVariants[0]).eqls(Array(10).fill(1));

            expect(questionVariants[1].slice(0, 4).sort((a, b) => a - b)).eqls([
                1, 2, 3, 4,
            ]);
            expect(questionVariants[1].slice(4, 8).sort((a, b) => a - b)).eqls([
                1, 2, 3, 4,
            ]);
            expect(questionVariants[2].slice(0, 5).sort((a, b) => a - b)).eqls([
                1, 2, 3, 4, 5,
            ]);
            expect(questionVariants[2].slice(5, 10).sort((a, b) => a - b)).eqls(
                [1, 2, 3, 4, 5],
            );
        }

        // different question variants for each base variant
        expect(allQuestionVariants[0]).not.eqls(allQuestionVariants[1]);
        expect(allQuestionVariants[0]).not.eqls(allQuestionVariants[2]);
        expect(allQuestionVariants[1]).not.eqls(allQuestionVariants[2]);

        // identical question variants when repeat base variant
        expect(allQuestionVariants[0]).eqls(allQuestionVariants[3]);
        expect(allQuestionVariants[2]).eqls(allQuestionVariants[4]);
    });

    it("select multiple from a single doc", () => {
        const source = selMult1doc as SelectSource;
        const { numActivityVariants, questionCounts } =
            gatherDocumentStructure(source);

        const allQuestionVariants: number[][] = [];

        const variants = [1, 2, 3, 1, 3];

        for (const variant of variants) {
            const initialState0 = initializeActivityState({
                source,
                variant,
                parentId: null,
                numActivityVariants,
            }) as SelectState;

            const res = generateNewActivityAttempt({
                state: initialState0,
                numActivityVariants,
                initialQuestionCounter: 1,
                questionCounts,
                parentAttempt: 1,
            });
            const initialState = res.state as SelectState;

            const questionVariants: number[] = [];
            allQuestionVariants.push(questionVariants);

            let state = initialState;

            const currentVariants = state.selectedChildren.map((a) => {
                return (a as SingleDocState).currentVariant;
            });

            questionVariants.push(...currentVariants);

            for (let i = 0; i < 4; i++) {
                for (let j = 0; j < 3; j++) {
                    const otherVariants = currentVariants.filter(
                        (_v, i) => i !== j,
                    );

                    const newVariants: number[] = [];

                    const validVariants = [1, 2, 3, 4].filter(
                        (v) => !otherVariants.includes(v),
                    );

                    for (let k = 0; k < 3; k++) {
                        const docIds = state.selectedChildren.map((a) => a.id);

                        state = generateNewSubActivityAttempt({
                            id: docIds[j],
                            state,
                            numActivityVariants,
                            initialQuestionCounter: 1, // not right, but doesn't matter for this test
                            questionCounts,
                        }) as SelectState;

                        const doc = state.selectedChildren[j] as SingleDocState;

                        const newVariant = doc.currentVariant;

                        // should not get a variant that matches one of the other current variants
                        expect(validVariants.includes(newVariant)).eq(true);

                        newVariants.push(newVariant);
                        questionVariants.push(newVariant);
                        currentVariants[j] = newVariant;
                    }

                    // every valid variant must have been selected at least once
                    expect(
                        validVariants.every((v) => newVariants.includes(v)),
                    ).eq(true);
                }
            }
        }

        // different question variants for each base variant
        expect(allQuestionVariants[0]).not.eqls(allQuestionVariants[1]);
        expect(allQuestionVariants[0]).not.eqls(allQuestionVariants[2]);
        expect(allQuestionVariants[1]).not.eqls(allQuestionVariants[2]);

        // identical question variants when repeat base variant
        expect(allQuestionVariants[0]).eqls(allQuestionVariants[3]);
        expect(allQuestionVariants[2]).eqls(allQuestionVariants[4]);
    });

    it("select multiple from two docs", () => {
        const source = selMult2docs as SelectSource;
        const { numActivityVariants, questionCounts } =
            gatherDocumentStructure(source);

        const allQuestionIds: string[][] = [];

        const variants = [1, 2, 3, 1, 3];

        const allDocIds1 = [1, 2, 3, 4].map((v) => `doc4|${v.toString()}`);
        const allDocIds2 = [1, 2, 3, 4, 5].map((v) => `doc5|${v.toString()}`);
        const allDocIds = [...allDocIds1, ...allDocIds2];

        for (const variant of variants) {
            const initialState0 = initializeActivityState({
                source,
                variant,
                parentId: null,
                numActivityVariants,
            }) as SelectState;

            const res = generateNewActivityAttempt({
                state: initialState0,
                numActivityVariants,
                initialQuestionCounter: 1,
                questionCounts,
                parentAttempt: 1,
            });
            const initialState = res.state as SelectState;

            const questionIds: string[] = [];
            allQuestionIds.push(questionIds);

            let state = initialState;

            const currentDocIds = state.selectedChildren.map((a) => a.id);

            questionIds.push(...currentDocIds);

            for (let i = 0; i < 4; i++) {
                for (let j = 0; j < 2; j++) {
                    const otherDocId = currentDocIds[1 - j];

                    const newDocIds: string[] = [];

                    const validDocIds = allDocIds.filter(
                        (v) => v != otherDocId,
                    );

                    // with 8 valid variants, could take 15 to get all of them
                    for (let k = 0; k < 15; k++) {
                        const docIds = state.selectedChildren.map((a) => a.id);

                        state = generateNewSubActivityAttempt({
                            id: docIds[j],
                            state,
                            numActivityVariants,
                            initialQuestionCounter: 1, // not right, but doesn't matter for this test
                            questionCounts,
                        }) as SelectState;

                        const newDocId = state.selectedChildren[j].id;

                        // should not get a variant that matches one of the other current variants
                        expect(validDocIds.includes(newDocId)).eq(true);

                        newDocIds.push(newDocId);
                        questionIds.push(newDocId);
                        currentDocIds[j] = newDocId;
                    }

                    // every valid variant must have been selected at least once
                    expect(validDocIds.every((v) => newDocIds.includes(v))).eq(
                        true,
                    );

                    // in every group of 9 consecutive selections,
                    // no variant should have been selected more than twice
                    for (const id of validDocIds) {
                        for (let k = 0; k < 6; k++) {
                            expect(
                                newDocIds.slice(k, k + 9).filter((v) => v == id)
                                    .length,
                            ).lte(2);
                        }
                    }
                }
            }
        }

        // different question variants for each base variant
        expect(allQuestionIds[0]).not.eqls(allQuestionIds[1]);
        expect(allQuestionIds[0]).not.eqls(allQuestionIds[2]);
        expect(allQuestionIds[1]).not.eqls(allQuestionIds[2]);

        // identical question variants when repeat base variant
        expect(allQuestionIds[0]).eqls(allQuestionIds[3]);
        expect(allQuestionIds[2]).eqls(allQuestionIds[4]);
    });

    it("sequence with selects", () => {
        const source = seq2sel as SequenceSource;
        const { numActivityVariants, questionCounts } =
            gatherDocumentStructure(source);

        const allQuestionIds: string[][][] = [];

        const variants = [1, 2, 3, 1, 3];

        const allDocIds1 = ["doc1|1"];
        const allDocIds2 = [1, 2].map((v) => `doc2|${v.toString()}`);
        const allDocIds3 = [1, 2, 3].map((v) => `doc3|${v.toString()}`);
        const allDocIds4 = [1, 2, 3, 4].map((v) => `doc4|${v.toString()}`);
        const allDocIds5 = [1, 2, 3, 4, 5].map((v) => `doc5|${v.toString()}`);

        const allDocIds123 = [...allDocIds1, ...allDocIds2, ...allDocIds3];
        const allDocIds45 = [...allDocIds4, ...allDocIds5];

        for (const variant of variants) {
            const initialState0 = initializeActivityState({
                source,
                variant,
                parentId: null,
                numActivityVariants,
            }) as SequenceState;

            const res = generateNewActivityAttempt({
                state: initialState0,
                numActivityVariants,
                initialQuestionCounter: 1,
                questionCounts,
                parentAttempt: 1,
            });
            const initialState = res.state as SequenceState;

            const questionIds: string[][] = [[], []];
            allQuestionIds.push(questionIds);

            let state = initialState;

            const selIds = state.orderedChildren.map((a) => a.id);
            expect([...selIds].sort()).eqls(["sel1", "sel2"]);

            for (let k = 0; k < 6; k++) {
                for (let i = 0; i < 2; i++) {
                    const selIdx = ["sel1", "sel2"].indexOf(selIds[i]);
                    for (let j = 0; j < 3; j++) {
                        const activities = state.orderedChildren;
                        expect(activities.length).eq(2);

                        const selState = activities[i] as SelectState;
                        expect(selState.selectedChildren.length).eq(1);

                        const docState = selState
                            .selectedChildren[0] as SingleDocState;
                        const docExtendedId =
                            docState.id +
                            "|" +
                            docState.currentVariant.toString();

                        questionIds[selIdx].push(docExtendedId);

                        state = generateNewSubActivityAttempt({
                            id: docState.id,
                            state,
                            numActivityVariants,
                            initialQuestionCounter: 1, // not right, but doesn't matter for this test
                            questionCounts,
                        }) as SequenceState;
                    }
                }
            }

            expect(questionIds[0].slice(0, 9).sort()).eqls(allDocIds45);
            expect(questionIds[0].slice(9, 18).sort()).eqls(allDocIds45);
            expect(questionIds[1].slice(0, 6).sort()).eqls(allDocIds123);
            expect(questionIds[1].slice(6, 12).sort()).eqls(allDocIds123);
            expect(questionIds[1].slice(12, 18).sort()).eqls(allDocIds123);
        }

        // different question variants for each base variant
        expect(allQuestionIds[0]).not.eqls(allQuestionIds[1]);
        expect(allQuestionIds[0]).not.eqls(allQuestionIds[2]);
        expect(allQuestionIds[1]).not.eqls(allQuestionIds[2]);

        // identical question variants when repeat base variant
        expect(allQuestionIds[0]).eqls(allQuestionIds[3]);
        expect(allQuestionIds[2]).eqls(allQuestionIds[4]);
    });

    it("sequence with selects, combine item and activity attempts", () => {
        const source = seq2sel as SequenceSource;
        const { numActivityVariants, questionCounts } =
            gatherDocumentStructure(source);

        const allQuestionIds: string[][][] = [];

        const variants = [1, 2, 3, 1, 3];

        const allDocIds1 = ["doc1|1"];
        const allDocIds2 = [1, 2].map((v) => `doc2|${v.toString()}`);
        const allDocIds3 = [1, 2, 3].map((v) => `doc3|${v.toString()}`);
        const allDocIds4 = [1, 2, 3, 4].map((v) => `doc4|${v.toString()}`);
        const allDocIds5 = [1, 2, 3, 4, 5].map((v) => `doc5|${v.toString()}`);

        const allDocIds123 = [...allDocIds1, ...allDocIds2, ...allDocIds3];
        const allDocIds45 = [...allDocIds4, ...allDocIds5];

        for (const variant of variants) {
            const initialState0 = initializeActivityState({
                source,
                variant,
                parentId: null,
                numActivityVariants,
            }) as SequenceState;

            const res = generateNewActivityAttempt({
                state: initialState0,
                numActivityVariants,
                initialQuestionCounter: 1,
                questionCounts,
                parentAttempt: 1,
            });
            const initialState = res.state as SequenceState;

            const questionIds: string[][] = [[], []];
            allQuestionIds.push(questionIds);

            let state = initialState;

            let selIds = state.orderedChildren.map((a) => a.id);
            expect([...selIds].sort()).eqls(["sel1", "sel2"]);

            for (let k = 0; k < 12; k++) {
                for (let i = 0; i < 4; i++) {
                    const selIdx = ["sel1", "sel2"].indexOf(selIds[i % 2]);

                    const activities = state.orderedChildren;
                    expect(activities.length).eq(2);

                    const selState = activities[i % 2] as SelectState;

                    expect(selState.selectedChildren.length).eq(1);

                    const docState = selState
                        .selectedChildren[0] as SingleDocState;
                    const docExtendedId =
                        docState.id + "|" + docState.currentVariant.toString();

                    questionIds[selIdx].push(docExtendedId);

                    if (i < 2) {
                        state = generateNewSubActivityAttempt({
                            id: docState.id,
                            state,
                            numActivityVariants,
                            initialQuestionCounter: 1, // not right, but doesn't matter for this test
                            questionCounts,
                        }) as SequenceState;
                    } else if (i === 3) {
                        const res = generateNewActivityAttempt({
                            state,
                            numActivityVariants,
                            initialQuestionCounter: 1, // not right, but doesn't matter for this test
                            questionCounts,
                            parentAttempt: 1,
                        });
                        state = res.state as SequenceState;

                        selIds = state.orderedChildren.map((a) => a.id);
                    }
                }
            }

            expect(questionIds[0].slice(0, 9).sort()).eqls(allDocIds45);
            expect(questionIds[0].slice(9, 18).sort()).eqls(allDocIds45);
            expect(questionIds[1].slice(0, 6).sort()).eqls(allDocIds123);
            expect(questionIds[1].slice(6, 12).sort()).eqls(allDocIds123);
            expect(questionIds[1].slice(12, 18).sort()).eqls(allDocIds123);
        }

        // different question variants for each base variant
        expect(allQuestionIds[0]).not.eqls(allQuestionIds[1]);
        expect(allQuestionIds[0]).not.eqls(allQuestionIds[2]);
        expect(allQuestionIds[1]).not.eqls(allQuestionIds[2]);

        // identical question variants when repeat base variant
        expect(allQuestionIds[0]).eqls(allQuestionIds[3]);
        expect(allQuestionIds[2]).eqls(allQuestionIds[4]);
    });

    it("select multiple from four docs, selectByVariant=false", () => {
        const source = selMult4docsNoVariant as SelectSource;
        const { numActivityVariants, questionCounts } =
            gatherDocumentStructure(source);

        const allQuestionIds: string[][] = [];
        const allQuestionVariants: number[][][] = [];

        const variants = [1, 2, 3, 1, 3];
        const allDocIds = ["doc1", "doc2", "doc4", "doc5"];

        for (const variant of variants) {
            const initialState0 = initializeActivityState({
                source,
                variant,
                parentId: null,
                numActivityVariants,
            }) as SelectState;

            const res = generateNewActivityAttempt({
                state: initialState0,
                numActivityVariants,
                initialQuestionCounter: 1,
                questionCounts,
                parentAttempt: 1,
            });
            const initialState = res.state as SelectState;
            const questionIds: string[] = [];
            allQuestionIds.push(questionIds);

            const questionVariants: number[][] = [[], [], [], []];
            allQuestionVariants.push(questionVariants);

            let state = initialState;

            const currentDocIds = state.selectedChildren.map((a) => a.id);

            questionIds.push(...currentDocIds);
            for (const activity of state.selectedChildren) {
                questionVariants[allDocIds.indexOf(activity.id)].push(
                    (activity as SingleDocState).currentVariant,
                );
            }

            for (let i = 0; i < 4; i++) {
                for (let j = 0; j < 2; j++) {
                    const otherDocId = currentDocIds[1 - j];

                    const newDocIds: string[] = [];

                    const validDocIds = allDocIds.filter(
                        (v) => v != otherDocId,
                    );

                    // with 3 valid doc choices, could take 5 to get all of them
                    for (let k = 0; k < 5; k++) {
                        const docIds = state.selectedChildren.map((a) => a.id);

                        state = generateNewSubActivityAttempt({
                            id: docIds[j],
                            state,
                            numActivityVariants,
                            initialQuestionCounter: 1, // not right, but doesn't matter for this test
                            questionCounts,
                        }) as SelectState;

                        const doc = state.selectedChildren[j] as SingleDocState;
                        const newDocId = doc.id;

                        // should not get a variant that matches one of the other current variants
                        expect(validDocIds.includes(newDocId)).eq(true);

                        newDocIds.push(newDocId);
                        questionIds.push(newDocId);
                        currentDocIds[j] = newDocId;

                        questionVariants[allDocIds.indexOf(newDocId)].push(
                            doc.currentVariant,
                        );
                    }

                    // every valid variant must have been selected at least once
                    expect(validDocIds.every((v) => newDocIds.includes(v))).eq(
                        true,
                    );

                    // in every group of 4 consecutive selections,
                    // no doc should have been selected more than twice
                    for (const id of validDocIds) {
                        for (let k = 0; k < 5; k++) {
                            expect(
                                newDocIds.slice(k, k + 4).filter((v) => v == id)
                                    .length,
                            ).lte(2);
                        }
                    }
                }
            }

            expect(questionVariants[0].slice(0, 10)).eqls(Array(10).fill(1));

            for (let i = 0; i < 5; i++) {
                expect(
                    questionVariants[1]
                        .slice(2 * i, 2 * i + 2)
                        .sort((a, b) => a - b),
                ).eqls([1, 2]);
            }
            expect(questionVariants[2].slice(0, 4).sort((a, b) => a - b)).eqls([
                1, 2, 3, 4,
            ]);
            expect(questionVariants[2].slice(4, 8).sort((a, b) => a - b)).eqls([
                1, 2, 3, 4,
            ]);
            expect(questionVariants[3].slice(0, 5).sort((a, b) => a - b)).eqls([
                1, 2, 3, 4, 5,
            ]);
            expect(questionVariants[3].slice(5, 10).sort((a, b) => a - b)).eqls(
                [1, 2, 3, 4, 5],
            );
        }

        // different question variants for each base variant
        expect(allQuestionVariants[0]).not.eqls(allQuestionVariants[1]);
        expect(allQuestionVariants[0]).not.eqls(allQuestionVariants[2]);
        expect(allQuestionVariants[1]).not.eqls(allQuestionVariants[2]);

        // identical question variants when repeat base variant
        expect(allQuestionVariants[0]).eqls(allQuestionVariants[3]);
        expect(allQuestionVariants[2]).eqls(allQuestionVariants[4]);

        // different questions for each base variant
        expect(allQuestionIds[0]).not.eqls(allQuestionIds[1]);
        expect(allQuestionIds[0]).not.eqls(allQuestionIds[2]);
        expect(allQuestionIds[1]).not.eqls(allQuestionIds[2]);

        // identical questions when repeat base variant
        expect(allQuestionIds[0]).eqls(allQuestionIds[3]);
        expect(allQuestionIds[2]).eqls(allQuestionIds[4]);
    });
});
