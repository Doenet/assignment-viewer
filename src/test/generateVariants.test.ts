import { describe, expect, it } from "vitest";

import doc from "./testSources/doc.json";
import seq from "./testSources/seq.json";
import seqShuf from "./testSources/seqShuf.json";
import sel from "./testSources/sel.json";
import selMult1doc from "./testSources/selMult1doc.json";
import selMult2docs from "./testSources/selMult2docs.json";
import seqWithDes from "./testSources/seqWithDes.json";
import seq2sel from "./testSources/seq2sel.json";
import sel2seq from "./testSources/sel2seq.json";
import selMult2seq from "./testSources/selMult2seq.json";
import selNoVariant from "./testSources/selNoVariant.json";
import selMult4docsNoVariant from "./testSources/selMult4docsNoVariant.json";
import { SequenceSource, SequenceState } from "../Activity/sequenceState";
import {
    gatherDocumentStructure,
    generateNewActivityAttempt,
    initializeActivityState,
} from "../Activity/activityState";
import { SingleDocSource, SingleDocState } from "../Activity/singleDocState";
import { SelectSource, SelectState } from "../Activity/selectState";

describe("Test of generating activity variants", () => {
    it("single doc", () => {
        const source = doc as SingleDocSource;
        const { numActivityVariants, questionCounts } =
            gatherDocumentStructure(source);

        const allQuestionVariants: number[][] = [];

        const variants = [1, 2, 3, 1, 3];

        for (const variant of variants) {
            const initialState = initializeActivityState({
                source,
                variant,
                parentId: null,
                numActivityVariants,
            }) as SingleDocState;

            const questionVariants: number[] = [];
            allQuestionVariants.push(questionVariants);

            let state = initialState;
            for (let i = 0; i < 15; i++) {
                const res = generateNewActivityAttempt({
                    state,
                    numActivityVariants,
                    initialQuestionCounter: 1,
                    questionCounts,
                    parentAttempt: 1,
                });

                state = res.state as SingleDocState;

                expect(state.attemptNumber).eq(i + 1);

                questionVariants.push(state.currentVariant);
            }

            expect(questionVariants.slice(0, 5).sort((a, b) => a - b)).eqls([
                1, 2, 3, 4, 5,
            ]);
            expect(questionVariants.slice(5, 10).sort((a, b) => a - b)).eqls([
                1, 2, 3, 4, 5,
            ]);
            expect(questionVariants.slice(10, 15).sort((a, b) => a - b)).eqls([
                1, 2, 3, 4, 5,
            ]);
        }

        // different question variants for each base variant
        expect(allQuestionVariants[0]).not.eqls(allQuestionVariants[1]);
        expect(allQuestionVariants[0]).not.eqls(allQuestionVariants[2]);
        expect(allQuestionVariants[1]).not.eqls(allQuestionVariants[2]);

        // identical question variants when repeat base variant
        expect(allQuestionVariants[0]).eqls(allQuestionVariants[3]);
        expect(allQuestionVariants[2]).eqls(allQuestionVariants[4]);
    });

    it("sequence with no shuffle", () => {
        const source = seq as SequenceSource;
        const { numActivityVariants, questionCounts } =
            gatherDocumentStructure(source);

        const allQuestionVariants: number[][][] = [];

        const variants = [1, 2, 3, 1, 3];

        for (const variant of variants) {
            const initialState = initializeActivityState({
                source,
                variant,
                parentId: null,
                numActivityVariants,
            }) as SequenceState;

            const questionVariants: number[][] = [[], [], []];
            allQuestionVariants.push(questionVariants);

            const docIds = ["doc4", "doc5", "doc1"];

            let state = initialState;
            for (let i = 0; i < 10; i++) {
                const res = generateNewActivityAttempt({
                    state,
                    numActivityVariants,
                    initialQuestionCounter: 1,
                    questionCounts,
                    parentAttempt: 1,
                });

                state = res.state as SequenceState;

                expect(state.attemptNumber).eq(i + 1);

                const activities = state.orderedChildren;

                expect(activities.length).eq(3);

                for (let j = 0; j < 3; j++) {
                    const doc = activities[j] as SingleDocState;
                    expect(doc.id).eq(docIds[j]);
                    expect(doc.attemptNumber).eq(i + 1);

                    questionVariants[j].push(doc.currentVariant);
                }
            }

            expect(questionVariants[0].slice(0, 4).sort((a, b) => a - b)).eqls([
                1, 2, 3, 4,
            ]);
            expect(questionVariants[0].slice(4, 8).sort((a, b) => a - b)).eqls([
                1, 2, 3, 4,
            ]);
            expect(questionVariants[1].slice(0, 5).sort((a, b) => a - b)).eqls([
                1, 2, 3, 4, 5,
            ]);
            expect(questionVariants[1].slice(5, 10).sort((a, b) => a - b)).eqls(
                [1, 2, 3, 4, 5],
            );
            expect(questionVariants[2]).eqls(Array(10).fill(1));
        }

        // different question variants for each base variant
        expect(allQuestionVariants[0]).not.eqls(allQuestionVariants[1]);
        expect(allQuestionVariants[0]).not.eqls(allQuestionVariants[2]);
        expect(allQuestionVariants[1]).not.eqls(allQuestionVariants[2]);

        // identical question variants when repeat base variant
        expect(allQuestionVariants[0]).eqls(allQuestionVariants[3]);
        expect(allQuestionVariants[2]).eqls(allQuestionVariants[4]);
    });

    it("sequence with shuffle", () => {
        const source = seqShuf as SequenceSource;
        const { numActivityVariants, questionCounts } =
            gatherDocumentStructure(source);

        const allQuestionVariants: number[][][] = [];

        const variants = [1, 2, 3, 1, 3];

        let numReordered = 0;

        for (const variant of variants) {
            const initialState = initializeActivityState({
                source,
                variant,
                parentId: null,
                numActivityVariants,
            }) as SequenceState;

            const questionVariants: number[][] = [[], [], []];
            allQuestionVariants.push(questionVariants);

            const docIds = ["doc1", "doc4", "doc5"];

            let state = initialState;
            for (let i = 0; i < 10; i++) {
                const res = generateNewActivityAttempt({
                    state,
                    numActivityVariants,
                    initialQuestionCounter: 1,
                    questionCounts,
                    parentAttempt: 1,
                });

                state = res.state as SequenceState;

                expect(state.attemptNumber).eq(i + 1);

                const activities = state.orderedChildren;

                expect(activities.length).eq(3);

                expect(activities.map((a) => a.id).sort()).eqls(docIds);

                for (let j = 0; j < 3; j++) {
                    const doc = activities[j] as SingleDocState;
                    const questionIdx = docIds.indexOf(doc.id);
                    if (questionIdx !== j) {
                        numReordered++;
                    }
                    expect(doc.attemptNumber).eq(i + 1);
                    questionVariants[questionIdx].push(doc.currentVariant);
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

        // at least 50 of the 150 questions should have been shuffled away from their original position
        expect(numReordered).greaterThan(50);

        // different question variants for each base variant
        expect(allQuestionVariants[0]).not.eqls(allQuestionVariants[1]);
        expect(allQuestionVariants[0]).not.eqls(allQuestionVariants[2]);
        expect(allQuestionVariants[1]).not.eqls(allQuestionVariants[2]);

        // identical question variants when repeat base variant
        expect(allQuestionVariants[0]).eqls(allQuestionVariants[3]);
        expect(allQuestionVariants[2]).eqls(allQuestionVariants[4]);
    });

    it("select single doc", () => {
        const source = sel as SelectSource;
        const { numActivityVariants, questionCounts } =
            gatherDocumentStructure(source);

        const allQuestionVariants: number[][] = [];

        const variants = [1, 2, 3, 1, 3];

        for (const variant of variants) {
            const initialState = initializeActivityState({
                source,
                variant,
                parentId: null,
                numActivityVariants,
            }) as SelectState;

            const questionVariants: number[] = [];
            allQuestionVariants.push(questionVariants);

            const docIds = ["doc1", "doc4", "doc5"];

            let state = initialState;
            for (let i = 0; i < 20; i++) {
                const res = generateNewActivityAttempt({
                    state,
                    numActivityVariants,
                    initialQuestionCounter: 1,
                    questionCounts,
                    parentAttempt: 1,
                });

                state = res.state as SelectState;

                expect(state.attemptNumber).eq(i + 1);

                const activities = state.selectedChildren;

                expect(activities.length).eq(1);

                const doc = activities[0] as SingleDocState;
                const questionIdx = docIds.indexOf(doc.id);
                expect(questionIdx).not.eq(-1);

                questionVariants.push(questionIdx * 10 + doc.currentVariant);
            }

            const variantSet = [1, 11, 12, 13, 14, 21, 22, 23, 24, 25];

            expect(questionVariants.slice(0, 10).sort((a, b) => a - b)).eqls(
                variantSet,
            );
            expect(questionVariants.slice(10, 20).sort((a, b) => a - b)).eqls(
                variantSet,
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
            const initialState = initializeActivityState({
                source,
                variant,
                parentId: null,
                numActivityVariants,
            }) as SelectState;

            const questionVariants: number[] = [];
            allQuestionVariants.push(questionVariants);

            let state = initialState;
            for (let i = 0; i < 4; i++) {
                const res = generateNewActivityAttempt({
                    state,
                    numActivityVariants,
                    initialQuestionCounter: 1,
                    questionCounts,
                    parentAttempt: 1,
                });

                state = res.state as SelectState;

                expect(state.attemptNumber).eq(i + 1);

                const activities = state.selectedChildren;

                expect(activities.length).eq(3);

                for (let j = 0; j < 3; j++) {
                    // since there are four possible variants, another attempt per variant will be added every 4
                    const attemptIdx = Math.floor((i * 3 + j) / 4);

                    const doc = activities[j] as SingleDocState;
                    expect(doc.attemptNumber).eq(attemptIdx + 1);
                    questionVariants.push(doc.currentVariant);

                    expect(doc.id).eq(`doc4|${doc.currentVariant.toString()}`);
                }
            }

            const variantSet = [1, 2, 3, 4];

            expect(questionVariants.slice(0, 4).sort((a, b) => a - b)).eqls(
                variantSet,
            );
            expect(questionVariants.slice(4, 8).sort((a, b) => a - b)).eqls(
                variantSet,
            );
            expect(questionVariants.slice(8, 12).sort((a, b) => a - b)).eqls(
                variantSet,
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

    it("select multiple from two docs", () => {
        const source = selMult2docs as SelectSource;
        const { numActivityVariants, questionCounts } =
            gatherDocumentStructure(source);

        const allQuestionVariants: number[][] = [];

        const variants = [1, 2, 3, 1, 3];
        const docIds = ["doc4", "doc5"];

        for (const variant of variants) {
            const initialState = initializeActivityState({
                source,
                variant,
                parentId: null,
                numActivityVariants,
            }) as SelectState;

            const questionVariants: number[] = [];
            allQuestionVariants.push(questionVariants);

            let state = initialState;
            for (let i = 0; i < 14; i++) {
                const res = generateNewActivityAttempt({
                    state,
                    numActivityVariants,
                    initialQuestionCounter: 1,
                    questionCounts,
                    parentAttempt: 1,
                });

                state = res.state as SelectState;

                expect(state.attemptNumber).eq(i + 1);

                const activities = state.selectedChildren;

                expect(activities.length).eq(2);

                for (let j = 0; j < 2; j++) {
                    // since there are nine possible variants, another attempt per variant will be added every 9
                    const attemptIdx = Math.floor((i * 2 + j) / 9);

                    const doc = activities[j] as SingleDocState;

                    const questionIdx = docIds.indexOf(doc.id.split("|")[0]);
                    expect(questionIdx).not.eq(-1);

                    expect(doc.attemptNumber).eq(attemptIdx + 1);
                    questionVariants.push(
                        questionIdx * 10 + doc.currentVariant,
                    );

                    expect(doc.id).eq(
                        `${docIds[questionIdx]}|${doc.currentVariant.toString()}`,
                    );
                }
            }

            const variantSet = [1, 2, 3, 4, 11, 12, 13, 14, 15];

            expect(questionVariants.slice(0, 9).sort((a, b) => a - b)).eqls(
                variantSet,
            );
            expect(questionVariants.slice(9, 18).sort((a, b) => a - b)).eqls(
                variantSet,
            );
            expect(questionVariants.slice(18, 27).sort((a, b) => a - b)).eqls(
                variantSet,
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

    it("descriptions not shuffled", () => {
        const source = seqWithDes as SequenceSource;
        const { numActivityVariants, questionCounts } =
            gatherDocumentStructure(source);

        const allQuestionVariants: number[][][] = [];

        const variants = [1, 2, 3, 1, 3];

        let numReordered = 0;

        for (const variant of variants) {
            const initialState = initializeActivityState({
                source,
                variant,
                parentId: null,
                numActivityVariants,
            }) as SequenceState;

            const questionVariants: number[][] = [[], [], [], [], [], [], []];
            allQuestionVariants.push(questionVariants);

            const docIds1 = ["doc2", "doc4"];
            const docIds2 = ["doc1", "doc3", "doc5"];
            const allDocIds = [
                "doc1a",
                "doc4",
                "doc2",
                "doc3a",
                "doc5",
                "doc1",
                "doc3",
            ];

            let state = initialState;
            for (let i = 0; i < 10; i++) {
                const res = generateNewActivityAttempt({
                    state,
                    numActivityVariants,
                    initialQuestionCounter: 1,
                    questionCounts,
                    parentAttempt: 1,
                });

                state = res.state as SequenceState;

                expect(state.attemptNumber).eq(i + 1);

                const activities = state.orderedChildren;

                expect(activities.length).eq(7);

                expect(activities[0].id).eq("doc1a");
                expect(
                    activities
                        .slice(1, 3)
                        .map((a) => a.id)
                        .sort(),
                ).eqls(docIds1);
                expect(activities[3].id).eq("doc3a");
                expect(
                    activities
                        .slice(4, 7)
                        .map((a) => a.id)
                        .sort(),
                ).eqls(docIds2);

                for (let j = 0; j < 7; j++) {
                    const doc = activities[j] as SingleDocState;
                    const questionIdx = allDocIds.indexOf(doc.id);
                    if (questionIdx !== j) {
                        numReordered++;
                    }
                    expect(doc.attemptNumber).eq(i + 1);
                    questionVariants[questionIdx].push(doc.currentVariant);
                }
            }

            expect(questionVariants[0]).eqls(Array(10).fill(1));
            expect(questionVariants[1].slice(0, 4).sort((a, b) => a - b)).eqls([
                1, 2, 3, 4,
            ]);
            expect(questionVariants[1].slice(4, 8).sort((a, b) => a - b)).eqls([
                1, 2, 3, 4,
            ]);
            expect(questionVariants[2].slice(0, 2).sort((a, b) => a - b)).eqls([
                1, 2,
            ]);
            expect(questionVariants[2].slice(2, 4).sort((a, b) => a - b)).eqls([
                1, 2,
            ]);
            expect(questionVariants[2].slice(4, 6).sort((a, b) => a - b)).eqls([
                1, 2,
            ]);
            expect(questionVariants[2].slice(6, 8).sort((a, b) => a - b)).eqls([
                1, 2,
            ]);
            expect(questionVariants[2].slice(8, 10).sort((a, b) => a - b)).eqls(
                [1, 2],
            );
            expect(questionVariants[3].slice(0, 3).sort((a, b) => a - b)).eqls([
                1, 2, 3,
            ]);
            expect(questionVariants[3].slice(3, 6).sort((a, b) => a - b)).eqls([
                1, 2, 3,
            ]);
            expect(questionVariants[3].slice(6, 9).sort((a, b) => a - b)).eqls([
                1, 2, 3,
            ]);
            expect(questionVariants[4].slice(0, 5).sort((a, b) => a - b)).eqls([
                1, 2, 3, 4, 5,
            ]);
            expect(questionVariants[4].slice(5, 10).sort((a, b) => a - b)).eqls(
                [1, 2, 3, 4, 5],
            );
            expect(questionVariants[5]).eqls(Array(10).fill(1));
            expect(questionVariants[6].slice(0, 3).sort((a, b) => a - b)).eqls([
                1, 2, 3,
            ]);
            expect(questionVariants[6].slice(3, 6).sort((a, b) => a - b)).eqls([
                1, 2, 3,
            ]);
            expect(questionVariants[6].slice(6, 9).sort((a, b) => a - b)).eqls([
                1, 2, 3,
            ]);
        }

        // at least 100 of the 250 questions should have been shuffled away from their original position
        expect(numReordered).greaterThan(100);

        // different question variants for each base variant
        expect(allQuestionVariants[0]).not.eqls(allQuestionVariants[1]);
        expect(allQuestionVariants[0]).not.eqls(allQuestionVariants[2]);
        expect(allQuestionVariants[1]).not.eqls(allQuestionVariants[2]);

        // identical question variants when repeat base variant
        expect(allQuestionVariants[0]).eqls(allQuestionVariants[3]);
        expect(allQuestionVariants[2]).eqls(allQuestionVariants[4]);
    });

    it("sequence with selects", () => {
        const source = seq2sel as SequenceSource;
        const { numActivityVariants, questionCounts } =
            gatherDocumentStructure(source);

        const allQuestionVariants: number[][][] = [];

        const variants = [1, 2, 3, 1, 3];

        for (const variant of variants) {
            const initialState = initializeActivityState({
                source,
                variant,
                parentId: null,
                numActivityVariants,
            }) as SequenceState;

            const questionVariants: number[][] = [[], []];
            allQuestionVariants.push(questionVariants);

            const docIds1 = ["doc4", "doc5"];
            const docIds2 = ["doc1", "doc2", "doc3"];
            const allDocIds = [...docIds1, ...docIds2];

            const selIds = ["sel1", "sel2"];

            let state = initialState;
            for (let i = 0; i < 18; i++) {
                const res = generateNewActivityAttempt({
                    state,
                    numActivityVariants,
                    initialQuestionCounter: 1,
                    questionCounts,
                    parentAttempt: 1,
                });

                state = res.state as SequenceState;

                expect(state.attemptNumber).eq(i + 1);

                const activities = state.orderedChildren;

                expect(activities.length).eq(2);

                const idOrders =
                    activities[0].id === "sel1"
                        ? [docIds1, docIds2]
                        : [docIds2, docIds1];

                expect(activities.map((a) => a.id).sort()).eqls(selIds);

                for (let j = 0; j < 2; j++) {
                    const select = activities[j] as SelectState;
                    const selAttemptNum = select.attemptNumber;
                    expect(selAttemptNum).eq(i + 1);

                    expect(select.selectedChildren.length).eq(1);

                    const doc = select.selectedChildren[0] as SingleDocState;

                    expect(idOrders[j].includes(doc.id)).eq(true);

                    const questionIdx = allDocIds.indexOf(doc.id);

                    questionVariants[docIds1.includes(doc.id) ? 0 : 1].push(
                        questionIdx * 10 + doc.currentVariant,
                    );
                }
            }

            const variantSet1 = [1, 2, 3, 4, 11, 12, 13, 14, 15];
            const variantSet2 = [21, 31, 32, 41, 42, 43];

            expect(questionVariants[0].slice(0, 9).sort((a, b) => a - b)).eqls(
                variantSet1,
            );
            expect(questionVariants[0].slice(9, 18).sort((a, b) => a - b)).eqls(
                variantSet1,
            );
            expect(questionVariants[1].slice(0, 6).sort((a, b) => a - b)).eqls(
                variantSet2,
            );
            expect(questionVariants[1].slice(6, 12).sort((a, b) => a - b)).eqls(
                variantSet2,
            );
            expect(
                questionVariants[1].slice(12, 18).sort((a, b) => a - b),
            ).eqls(variantSet2);
        }

        // different question variants for each base variant
        expect(allQuestionVariants[0]).not.eqls(allQuestionVariants[1]);
        expect(allQuestionVariants[0]).not.eqls(allQuestionVariants[2]);
        expect(allQuestionVariants[1]).not.eqls(allQuestionVariants[2]);

        // identical question variants when repeat base variant
        expect(allQuestionVariants[0]).eqls(allQuestionVariants[3]);
        expect(allQuestionVariants[2]).eqls(allQuestionVariants[4]);
    });

    it("select from two sequences", () => {
        const source = sel2seq as SelectSource;
        const { numActivityVariants, questionCounts } =
            gatherDocumentStructure(source);

        const allQuestionVariants1: number[][][] = [];
        const allQuestionVariants2: number[][][] = [];

        const variants = [1, 2, 3, 1, 3];

        let numReordered = 0;

        for (const variant of variants) {
            const initialState = initializeActivityState({
                source,
                variant,
                parentId: null,
                numActivityVariants,
            }) as SelectState;

            const questionVariants1: number[][] = [[], []];
            const questionVariants2: number[][] = [[], [], []];
            allQuestionVariants1.push(questionVariants1);
            allQuestionVariants2.push(questionVariants2);

            const docIds1 = ["doc4", "doc5"];
            const docIds2 = ["doc3", "doc1"];

            const seqIds = ["seq1", "seq2"];

            let state = initialState;
            for (let i = 0; i < 40; i++) {
                const res = generateNewActivityAttempt({
                    state,
                    numActivityVariants,
                    initialQuestionCounter: 1,
                    questionCounts,
                    parentAttempt: 1,
                });

                state = res.state as SelectState;

                expect(state.attemptNumber).eq(i + 1);

                const activities = state.selectedChildren;

                expect(activities.length).eq(1);

                const sequence = activities[0] as SequenceState;
                expect(seqIds.includes(activities[0].id)).eq(true);

                if (sequence.id === "seq1") {
                    expect(sequence.orderedChildren.length).eq(2);
                    expect(sequence.orderedChildren.map((a) => a.id)).eqls(
                        docIds1,
                    );
                    for (let j = 0; j < 2; j++) {
                        const doc = sequence.orderedChildren[
                            j
                        ] as SingleDocState;

                        questionVariants1[j].push(doc.currentVariant);
                    }
                } else {
                    expect(sequence.orderedChildren.length).eq(2);
                    for (let j = 0; j < 2; j++) {
                        const doc = sequence.orderedChildren[
                            j
                        ] as SingleDocState;

                        const questionIdx = docIds2.indexOf(doc.id);

                        if (questionIdx !== j) {
                            numReordered++;
                        }

                        questionVariants2[questionIdx].push(doc.currentVariant);
                    }
                }
            }

            // since sequence 1 has 4 unique variants and sequence 2 only 1 unique variants,
            // sequence 1 should be selected 4 more times than sequence 2
            for (let i = 0; i < 2; i++) {
                expect(questionVariants1[i].length).eq(32);
            }
            for (let i = 0; i < 2; i++) {
                expect(questionVariants2[i].length).eq(8);
            }

            for (let i = 0; i < 8; i++) {
                expect(
                    questionVariants1[0]
                        .slice(4 * i, 4 * i + 4)
                        .sort((a, b) => a - b),
                ).eqls([1, 2, 3, 4]);
            }

            for (let i = 0; i < 6; i++) {
                expect(
                    questionVariants1[1]
                        .slice(5 * i, 5 * i + 5)
                        .sort((a, b) => a - b),
                ).eqls([1, 2, 3, 4, 5]);
            }

            expect(questionVariants2[0].slice(0, 3).sort((a, b) => a - b)).eqls(
                [1, 2, 3],
            );
            expect(questionVariants2[0].slice(3, 6).sort((a, b) => a - b)).eqls(
                [1, 2, 3],
            );

            expect(questionVariants2[1]).eqls(Array(8).fill(1));
        }

        // at least 20 of the 80 questions should have been shuffled away from their original position
        expect(numReordered).greaterThan(20);

        // different question variants for each base variant
        expect(allQuestionVariants1[0]).not.eqls(allQuestionVariants1[1]);
        expect(allQuestionVariants1[0]).not.eqls(allQuestionVariants1[2]);
        expect(allQuestionVariants1[1]).not.eqls(allQuestionVariants1[2]);
        expect(allQuestionVariants2[0]).not.eqls(allQuestionVariants2[1]);
        expect(allQuestionVariants2[0]).not.eqls(allQuestionVariants2[2]);
        expect(allQuestionVariants2[1]).not.eqls(allQuestionVariants2[2]);

        // identical question variants when repeat base variant
        expect(allQuestionVariants1[0]).eqls(allQuestionVariants1[3]);
        expect(allQuestionVariants1[2]).eqls(allQuestionVariants1[4]);
        expect(allQuestionVariants2[0]).eqls(allQuestionVariants2[3]);
        expect(allQuestionVariants2[2]).eqls(allQuestionVariants2[4]);
    });

    it("select multiple from two sequences", () => {
        const source = selMult2seq as SelectSource;
        const { numActivityVariants, questionCounts } =
            gatherDocumentStructure(source);

        const allQuestionVariants1: number[][][] = [];
        const allQuestionVariants2: number[][][] = [];

        const variants = [1, 2, 3, 1, 3];

        let numReordered = 0;

        for (const variant of variants) {
            const initialState = initializeActivityState({
                source,
                variant,
                parentId: null,
                numActivityVariants,
            }) as SelectState;

            const questionVariants1: number[][] = [[], []];
            const questionVariants2: number[][] = [[], []];
            allQuestionVariants1.push(questionVariants1);
            allQuestionVariants2.push(questionVariants2);

            const docIds1 = ["doc4", "doc5"];
            const docIds2 = ["doc3", "doc2"];

            const seqIds = ["seq1", "seq2"];

            let state = initialState;
            for (let i = 0; i < 12; i++) {
                const res = generateNewActivityAttempt({
                    state,
                    numActivityVariants,
                    initialQuestionCounter: 1,
                    questionCounts,
                    parentAttempt: 1,
                });

                state = res.state as SelectState;

                expect(state.attemptNumber).eq(i + 1);

                const activities = state.selectedChildren;

                expect(activities.length).eq(3);

                for (let k = 0; k < 3; k++) {
                    const sequence = activities[k] as SequenceState;
                    const seqSourceId = sequence.id.split("|")[0];
                    expect(seqIds.includes(seqSourceId)).eq(true);

                    if (seqSourceId === "seq1") {
                        expect(sequence.orderedChildren.length).eq(2);
                        expect(
                            sequence.orderedChildren.map(
                                (a) => a.id.split("|")[0],
                            ),
                        ).eqls(docIds1);
                        for (let j = 0; j < 2; j++) {
                            const doc = sequence.orderedChildren[
                                j
                            ] as SingleDocState;

                            questionVariants1[j].push(doc.currentVariant);
                        }
                    } else {
                        expect(sequence.orderedChildren.length).eq(2);
                        for (let j = 0; j < 2; j++) {
                            const doc = sequence.orderedChildren[
                                j
                            ] as SingleDocState;

                            const questionIdx = docIds2.indexOf(
                                doc.id.split("|")[0],
                            );

                            if (questionIdx !== j) {
                                numReordered++;
                            }

                            questionVariants2[questionIdx].push(
                                doc.currentVariant,
                            );
                        }
                    }
                }
            }

            // since sequence 1 has 4 unique variants and sequence 2 only 2 unique variants,
            // sequence 1 should be selected 2 more times than sequence 2
            for (let i = 0; i < 2; i++) {
                expect(questionVariants1[i].length).eq(24);
            }
            for (let i = 0; i < 2; i++) {
                expect(questionVariants2[i].length).eq(12);
            }

            // sequence 1 is selected in groups of 4
            for (let i = 0; i < 6; i++) {
                expect(
                    questionVariants1[0]
                        .slice(4 * i, 4 * i + 4)
                        .sort((a, b) => a - b),
                ).eqls([1, 2, 3, 4]);
            }

            // since sequence 1 is selected in groups of 4 and the second doc has 5 variants,
            // variants selected with be either [1,2,3,4] or [5,2,3,4],
            // so with a meta group of length 8 [[1,2,3,4], [5,2,3,4]]
            for (let i = 0; i < 3; i++) {
                const grp1 = questionVariants1[1]
                    .slice(8 * i, 8 * i + 4)
                    .sort((a, b) => a - b);
                const grp2 = questionVariants1[1]
                    .slice(8 * i + 4, 8 * i + 8)
                    .sort((a, b) => a - b);

                if (grp1[0] === 1) {
                    expect(grp1).eqls([1, 2, 3, 4]);
                    expect(grp2).eqls([2, 3, 4, 5]);
                } else {
                    expect(grp2).eqls([1, 2, 3, 4]);
                    expect(grp1).eqls([2, 3, 4, 5]);
                }
            }

            // sequence 2 is selected in groups of 2
            for (let i = 0; i < 6; i++) {
                expect(
                    questionVariants2[1]
                        .slice(2 * i, 2 * i + 2)
                        .sort((a, b) => a - b),
                ).eqls([1, 2]);
            }

            // since sequence 2 is selected in groups of 2 and the first doc has 3 variants,
            // variants selected with be either [1,2] or [3,2],
            // so with a meta group of length 4 [[1,2], [3,2]]
            for (let i = 0; i < 3; i++) {
                const grp1 = questionVariants2[0]
                    .slice(4 * i, 4 * i + 2)
                    .sort((a, b) => a - b);
                const grp2 = questionVariants2[0]
                    .slice(4 * i + 2, 4 * i + 4)
                    .sort((a, b) => a - b);

                if (grp1[0] === 1) {
                    expect(grp1).eqls([1, 2]);
                    expect(grp2).eqls([2, 3]);
                } else {
                    expect(grp2).eqls([1, 2]);
                    expect(grp1).eqls([2, 3]);
                }
            }
        }

        // at least 40 of the 120 questions should have been shuffled away from their original position
        expect(numReordered).greaterThan(40);

        // different question variants for each base variant
        expect(allQuestionVariants1[0]).not.eqls(allQuestionVariants1[1]);
        expect(allQuestionVariants1[0]).not.eqls(allQuestionVariants1[2]);
        expect(allQuestionVariants1[1]).not.eqls(allQuestionVariants1[2]);
        expect(allQuestionVariants2[0]).not.eqls(allQuestionVariants2[1]);
        expect(allQuestionVariants2[0]).not.eqls(allQuestionVariants2[2]);
        expect(allQuestionVariants2[1]).not.eqls(allQuestionVariants2[2]);

        // identical question variants when repeat base variant
        expect(allQuestionVariants1[0]).eqls(allQuestionVariants1[3]);
        expect(allQuestionVariants1[2]).eqls(allQuestionVariants1[4]);
        expect(allQuestionVariants2[0]).eqls(allQuestionVariants2[3]);
        expect(allQuestionVariants2[2]).eqls(allQuestionVariants2[4]);
    });

    it("select single doc, selectByVariant=false", () => {
        const source = selNoVariant as SelectSource;
        const { numActivityVariants, questionCounts } =
            gatherDocumentStructure(source);

        const allQuestionVariants: number[][][] = [];
        const allQuestions: number[][] = [];

        const variants = [1, 2, 3, 1, 3];

        for (const variant of variants) {
            const initialState = initializeActivityState({
                source,
                variant,
                parentId: null,
                numActivityVariants,
            }) as SelectState;

            const questions: number[] = [];
            allQuestions.push(questions);
            const questionVariants: number[][] = [[], [], []];
            allQuestionVariants.push(questionVariants);

            const docIds = ["doc1", "doc4", "doc5"];

            let state = initialState;
            for (let i = 0; i < 30; i++) {
                const res = generateNewActivityAttempt({
                    state,
                    numActivityVariants,
                    initialQuestionCounter: 1,
                    questionCounts,
                    parentAttempt: 1,
                });

                state = res.state as SelectState;

                expect(state.attemptNumber).eq(i + 1);

                const activities = state.selectedChildren;

                expect(activities.length).eq(1);

                const doc = activities[0] as SingleDocState;
                const questionIdx = docIds.indexOf(doc.id);
                expect(questionIdx).not.eq(-1);

                questions.push(questionIdx);

                questionVariants[questionIdx].push(doc.currentVariant);
            }

            for (let i = 0; i < 10; i++) {
                expect(
                    questions.slice(3 * i, 3 * i + 3).sort((a, b) => a - b),
                ).eqls([0, 1, 2]);
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

    it("select multiple from four docs, selectByVariant=false", () => {
        const source = selMult4docsNoVariant as SelectSource;
        const { numActivityVariants, questionCounts } =
            gatherDocumentStructure(source);

        const allQuestions: number[][] = [];
        const allQuestionVariants: number[][][] = [];

        const variants = [1, 2, 3, 1, 3];
        const docIds = ["doc1", "doc2", "doc4", "doc5"];

        for (const variant of variants) {
            const initialState = initializeActivityState({
                source,
                variant,
                parentId: null,
                numActivityVariants,
            }) as SelectState;

            const questions: number[] = [];
            allQuestions.push(questions);
            const questionVariants: number[][] = [[], [], [], []];
            allQuestionVariants.push(questionVariants);

            let state = initialState;
            for (let i = 0; i < 20; i++) {
                const res = generateNewActivityAttempt({
                    state,
                    numActivityVariants,
                    initialQuestionCounter: 1,
                    questionCounts,
                    parentAttempt: 1,
                });

                state = res.state as SelectState;

                expect(state.attemptNumber).eq(i + 1);

                const activities = state.selectedChildren;

                expect(activities.length).eq(2);

                for (let j = 0; j < 2; j++) {
                    const doc = activities[j] as SingleDocState;
                    const questionIdx = docIds.indexOf(doc.id);
                    expect(questionIdx).not.eq(-1);

                    questions.push(questionIdx);
                    questionVariants[questionIdx].push(doc.currentVariant);
                }
            }

            for (let i = 0; i < 10; i++) {
                expect(
                    questions.slice(4 * i, 4 * i + 4).sort((a, b) => a - b),
                ).eqls([0, 1, 2, 3]);
            }

            expect(questionVariants[0]).eqls(Array(10).fill(1));

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
    });
});
