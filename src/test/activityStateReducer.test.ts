import { afterEach, describe, expect, it, MockInstance, vi } from "vitest";
import { SequenceSource } from "../Activity/sequenceState";
import {
    ActivityAndDoenetState,
    gatherDocumentStructure,
    initializeActivityState,
    pruneActivityStateForSave,
} from "../Activity/activityState";
import { activityDoenetStateReducer } from "../Activity/activityStateReducer";
import seq2sel from "./testSources/seq2sel.json";
import doc from "./testSources/doc.json";
import seqShuf from "./testSources/seqShuf.json";
import selMult2docs from "./testSources/selMult2docs.json";
import { SingleDocSource, SingleDocState } from "../Activity/singleDocState";
import { SelectSource, SelectState } from "../Activity/selectState";
import hash from "object-hash";

describe("Activity reducer tests", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("initialize", () => {
        const source0 = seq2sel as SequenceSource;
        const state0 = initializeActivityState({
            source: source0,
            variant: 1,
            parentId: "abc",
            numActivityVariants: {},
        });

        const source = doc as SingleDocSource;
        const { numActivityVariants } = gatherDocumentStructure(source);

        const newState = activityDoenetStateReducer(
            {
                activityState: state0,
                doenetStates: [],
                itemAttemptNumbers: [1],
            },
            {
                type: "initialize",
                source,
                variantIndex: 5,
                numActivityVariants,
            },
        );

        const expectedActivityState: SingleDocState = {
            type: "singleDoc",
            id: source.id,
            parentId: null,
            source,
            doenetStateIdx: null,
            initialVariant: 5,
            creditAchieved: 0,
            initialQuestionCounter: 0,
            currentVariant: 0,
            previousVariants: [],
            attemptNumber: 0,
            restrictToVariantSlice: undefined,
        };

        expect(newState).eqls({
            activityState: expectedActivityState,
            doenetStates: [],
            itemAttemptNumbers: [1],
        });
    });

    it("set", () => {
        vi.stubGlobal("window", {
            postMessage: vi.fn(() => null),
        });
        const spy = vi.spyOn(window, "postMessage");

        const source0 = seq2sel as SequenceSource;
        const state0 = initializeActivityState({
            source: source0,
            variant: 1,
            parentId: "abc",
            numActivityVariants: {},
        });

        const source = doc as SingleDocSource;
        const { numActivityVariants } = gatherDocumentStructure(source);

        const activityState = initializeActivityState({
            source: source,
            variant: 5,
            parentId: null,
            numActivityVariants,
        });

        const state = {
            activityState,
            doenetStates: [],
            itemAttemptNumbers: [1],
        };

        let newState = activityDoenetStateReducer(
            {
                activityState: state0,
                doenetStates: [],
                itemAttemptNumbers: [1],
            },
            {
                type: "set",
                state,
                allowSaveState: false,
                baseId: "newId",
            },
        );

        expect(newState).eqls(state);
        expect(spy).toHaveBeenCalledTimes(0);

        newState = activityDoenetStateReducer(
            { activityState, doenetStates: [], itemAttemptNumbers: [1] },
            {
                type: "set",
                state,
                allowSaveState: true,
                baseId: "newId",
            },
        );

        expect(newState).eqls(state);
        expect(spy).toHaveBeenCalledTimes(1);

        expect(spy.mock.lastCall).eqls([
            {
                subject: "SPLICE.reportScoreByItem",
                score: 0,
                itemScores: [
                    {
                        id: "doc5",
                        score: 0,
                        docId: "doc5",
                        shuffledOrder: 1,
                        variant: 0,
                    },
                ],
                activityId: "newId",
            },
        ]);
    });

    it("generate new activity attempt", () => {
        vi.stubGlobal("window", {
            postMessage: vi.fn(() => null),
        });
        const spy = vi.spyOn(window, "postMessage");

        const source = doc as SingleDocSource;
        const { numActivityVariants } = gatherDocumentStructure(source);
        const sourceHash = hash(source);

        const state0 = initializeActivityState({
            source: source,
            variant: 5,
            parentId: null,
            numActivityVariants,
        }) as SingleDocState;

        // artificially set credit on state0
        state0.creditAchieved = 0.8;

        let state = activityDoenetStateReducer(
            {
                activityState: state0,
                doenetStates: [],
                itemAttemptNumbers: [1],
            },
            {
                type: "generateNewActivityAttempt",
                numActivityVariants,
                initialQuestionCounter: 9,
                questionCounts: {},
                allowSaveState: false,
                baseId: "newId",
                sourceHash,
            },
        );
        expect(spy).toHaveBeenCalledTimes(0);

        let activityState = state.activityState as SingleDocState;

        expect(typeof activityState.currentVariant).eq("number");
        const previousVariants = [activityState.currentVariant];

        let expectedState: SingleDocState = {
            ...state0,
            initialQuestionCounter: 9,
            creditAchieved: 0,
            attemptNumber: 1,
            currentVariant: previousVariants[0],
            previousVariants,
        };

        expect(activityState).eqls(expectedState);

        // repeat creation of first attempt, this time with `allowSaveState`
        state = activityDoenetStateReducer(
            {
                activityState: state0,
                doenetStates: [],
                itemAttemptNumbers: [1],
            },
            {
                type: "generateNewActivityAttempt",
                numActivityVariants,
                initialQuestionCounter: 9,
                questionCounts: {},
                allowSaveState: true,
                baseId: "newId",
                sourceHash,
            },
        );
        activityState = state.activityState as SingleDocState;

        expect(activityState).eqls(expectedState);

        expect(spy).toHaveBeenCalledTimes(1);

        expect(spy.mock.lastCall).eqls([
            {
                subject: "SPLICE.reportScoreAndState",
                score: 0,
                itemScores: [
                    {
                        id: "doc5",
                        score: 0,
                        docId: "doc5",
                        shuffledOrder: 1,
                        variant: activityState.currentVariant,
                    },
                ],
                state: {
                    activityState: pruneActivityStateForSave(activityState),
                    sourceHash,
                    doenetStates: [],
                    itemAttemptNumbers: [1],
                },
                activityId: "newId",
                newAttempt: true,
            },
        ]);

        state = activityDoenetStateReducer(state, {
            type: "generateNewActivityAttempt",
            numActivityVariants,
            initialQuestionCounter: 6,
            questionCounts: {},
            allowSaveState: true,
            baseId: "newId",
            sourceHash,
        });
        activityState = state.activityState as SingleDocState;

        expect(typeof activityState.currentVariant).eq("number");
        previousVariants.push(activityState.currentVariant);

        expectedState = {
            ...state0,
            initialQuestionCounter: 6,
            creditAchieved: 0,
            attemptNumber: 2,
            currentVariant: previousVariants[1],
            previousVariants,
        };

        expect(spy).toHaveBeenCalledTimes(2);

        expect(spy.mock.lastCall).eqls([
            {
                subject: "SPLICE.reportScoreAndState",
                score: 0,
                itemScores: [
                    {
                        id: "doc5",
                        score: 0,
                        docId: "doc5",
                        shuffledOrder: 1,
                        variant: activityState.currentVariant,
                    },
                ],
                state: {
                    activityState: pruneActivityStateForSave(activityState),
                    sourceHash,
                    doenetStates: [],
                    itemAttemptNumbers: [1],
                },
                activityId: "newId",
                newAttempt: true,
            },
        ]);

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        expect("newAttemptForItem" in spy.mock.lastCall![0]).eq(false);
    });

    it("update single state, single document", () => {
        vi.stubGlobal("window", {
            postMessage: vi.fn(() => null),
        });
        const spy = vi.spyOn(window, "postMessage");

        const source = doc as SingleDocSource;
        const { numActivityVariants } = gatherDocumentStructure(source);
        const sourceHash = hash(source);

        const state0 = initializeActivityState({
            source: source,
            variant: 5,
            parentId: null,
            numActivityVariants,
        });

        let state = activityDoenetStateReducer(
            {
                activityState: state0,
                doenetStates: [],
                itemAttemptNumbers: [1],
            },
            {
                type: "generateNewActivityAttempt",
                numActivityVariants,
                initialQuestionCounter: 0,
                questionCounts: {},
                allowSaveState: false,
                baseId: "newId",
                sourceHash,
            },
        );

        // Get score of 0.2
        state = activityDoenetStateReducer(state, {
            type: "updateSingleState",
            docId: "doc5",
            doenetStateIdx: 0,
            doenetState: "DoenetML state 1",
            itemSequence: ["doc5"],
            creditAchieved: 0.2,
            allowSaveState: true,
            baseId: "newId",
            sourceHash,
        });

        let activityState = state.activityState;

        if (activityState.type !== "singleDoc") {
            throw Error("Shouldn't happen");
        }

        expect(activityState.creditAchieved).eq(0.2);
        if (activityState.doenetStateIdx === null) {
            throw Error("Should have a doenet state index");
        }
        expect(activityState.doenetStateIdx).eq(0);
        expect(state.doenetStates[activityState.doenetStateIdx]).eq(
            "DoenetML state 1",
        );

        expect(spy).toHaveBeenCalledTimes(1);

        expect(spy.mock.lastCall).eqls([
            {
                subject: "SPLICE.reportScoreAndState",
                score: 0.2,
                itemScores: [
                    {
                        id: "doc5",
                        score: 0.2,
                        docId: "doc5",
                        shuffledOrder: 1,
                        variant: activityState.currentVariant,
                    },
                ],
                itemUpdated: 1,
                state: {
                    activityState: pruneActivityStateForSave(activityState),
                    doenetStates: ["DoenetML state 1"],
                    itemAttemptNumbers: [1],
                    sourceHash,
                },
                newDoenetStateIdx: 0,
                activityId: "newId",
            },
        ]);

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        expect("newAttempt" in spy.mock.lastCall![0]).eq(false);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        expect("newAttemptForItem" in spy.mock.lastCall![0]).eq(false);

        // decrease score
        state = activityDoenetStateReducer(state, {
            type: "updateSingleState",
            docId: "doc5",
            doenetState: "DoenetML state 2",
            doenetStateIdx: 0,
            itemSequence: ["doc5"],
            creditAchieved: 0.1,
            allowSaveState: true,
            baseId: "newId",
            sourceHash,
        });

        activityState = state.activityState;

        if (activityState.type !== "singleDoc") {
            throw Error("Shouldn't happen");
        }

        expect(activityState.creditAchieved).eq(0.1);
        if (activityState.doenetStateIdx === null) {
            throw Error("Should have a doenet state index");
        }
        expect(activityState.doenetStateIdx).eq(0);
        expect(state.doenetStates[activityState.doenetStateIdx]).eq(
            "DoenetML state 2",
        );

        expect(spy).toHaveBeenCalledTimes(2);

        expect(spy.mock.lastCall).eqls([
            {
                subject: "SPLICE.reportScoreAndState",
                score: 0.1,
                itemScores: [
                    {
                        id: "doc5",
                        score: 0.1,
                        docId: "doc5",
                        shuffledOrder: 1,
                        variant: activityState.currentVariant,
                    },
                ],
                itemUpdated: 1,
                state: {
                    activityState: pruneActivityStateForSave(activityState),
                    doenetStates: ["DoenetML state 2"],
                    itemAttemptNumbers: [1],
                    sourceHash,
                },
                newDoenetStateIdx: 0,
                activityId: "newId",
            },
        ]);

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        expect("newAttempt" in spy.mock.lastCall![0]).eq(false);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        expect("newAttemptForItem" in spy.mock.lastCall![0]).eq(false);

        // increase score
        state = activityDoenetStateReducer(state, {
            type: "updateSingleState",
            docId: "doc5",
            doenetState: "DoenetML state 3",
            doenetStateIdx: 0,
            itemSequence: ["doc5"],
            creditAchieved: 0.3,
            allowSaveState: true,
            baseId: "newId",
            sourceHash,
        });

        activityState = state.activityState;

        if (activityState.type !== "singleDoc") {
            throw Error("Shouldn't happen");
        }

        expect(activityState.creditAchieved).eq(0.3);
        if (activityState.doenetStateIdx === null) {
            throw Error("Should have a doenet state index");
        }
        expect(activityState.doenetStateIdx).eq(0);
        expect(state.doenetStates[activityState.doenetStateIdx]).eq(
            "DoenetML state 3",
        );

        expect(spy).toHaveBeenCalledTimes(3);

        expect(spy.mock.lastCall).eqls([
            {
                subject: "SPLICE.reportScoreAndState",
                score: 0.3,
                itemScores: [
                    {
                        id: "doc5",
                        score: 0.3,
                        docId: "doc5",
                        shuffledOrder: 1,
                        variant: activityState.currentVariant,
                    },
                ],
                itemUpdated: 1,
                state: {
                    activityState: pruneActivityStateForSave(activityState),
                    doenetStates: ["DoenetML state 3"],
                    itemAttemptNumbers: [1],
                    sourceHash,
                },
                newDoenetStateIdx: 0,
                activityId: "newId",
            },
        ]);

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        expect("newAttempt" in spy.mock.lastCall![0]).eq(false);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        expect("newAttemptForItem" in spy.mock.lastCall![0]).eq(false);

        // generate new attempt
        state = activityDoenetStateReducer(state, {
            type: "generateNewActivityAttempt",
            numActivityVariants,
            initialQuestionCounter: 0,
            questionCounts: {},
            allowSaveState: true,
            baseId: "newId",
            sourceHash,
        });

        activityState = state.activityState;

        if (activityState.type !== "singleDoc") {
            throw Error("Shouldn't happen");
        }

        expect(activityState.creditAchieved).eq(0.0);
        expect(activityState.doenetStateIdx).eq(null);

        expect(spy).toHaveBeenCalledTimes(4);

        expect(spy.mock.lastCall).eqls([
            {
                subject: "SPLICE.reportScoreAndState",
                score: 0,
                itemScores: [
                    {
                        id: "doc5",
                        score: 0,
                        docId: "doc5",
                        shuffledOrder: 1,
                        variant: activityState.currentVariant,
                    },
                ],
                state: {
                    activityState: pruneActivityStateForSave(activityState),
                    doenetStates: [],
                    itemAttemptNumbers: [1],
                    sourceHash,
                },
                activityId: "newId",
                newAttempt: true,
            },
        ]);

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        expect("newAttemptForItem" in spy.mock.lastCall![0]).eq(false);

        // start attempt with low score
        state = activityDoenetStateReducer(state, {
            type: "updateSingleState",
            docId: "doc5",
            doenetState: "DoenetML state 4",
            doenetStateIdx: 0,
            itemSequence: ["doc5"],
            creditAchieved: 0.1,
            allowSaveState: true,
            baseId: "newId",
            sourceHash,
        });

        activityState = state.activityState;

        if (activityState.type !== "singleDoc") {
            throw Error("Shouldn't happen");
        }

        expect(activityState.creditAchieved).eq(0.1);
        if (activityState.doenetStateIdx === null) {
            throw Error("Should have a doenet state index");
        }
        expect(activityState.doenetStateIdx).eq(0);
        expect(state.doenetStates[activityState.doenetStateIdx]).eq(
            "DoenetML state 4",
        );

        expect(spy).toHaveBeenCalledTimes(5);

        expect(spy.mock.lastCall).eqls([
            {
                subject: "SPLICE.reportScoreAndState",
                score: 0.1,
                itemScores: [
                    {
                        id: "doc5",
                        score: 0.1,
                        docId: "doc5",
                        shuffledOrder: 1,
                        variant: activityState.currentVariant,
                    },
                ],
                itemUpdated: 1,
                state: {
                    activityState: pruneActivityStateForSave(activityState),
                    doenetStates: ["DoenetML state 4"],
                    itemAttemptNumbers: [1],
                    sourceHash,
                },
                newDoenetStateIdx: 0,
                activityId: "newId",
            },
        ]);

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        expect("newAttempt" in spy.mock.lastCall![0]).eq(false);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        expect("newAttemptForItem" in spy.mock.lastCall![0]).eq(false);

        // increase score
        state = activityDoenetStateReducer(state, {
            type: "updateSingleState",
            docId: "doc5",
            doenetState: "DoenetML state 5",
            doenetStateIdx: 0,
            itemSequence: ["doc5"],
            creditAchieved: 0.5,
            allowSaveState: true,
            baseId: "newId",
            sourceHash,
        });

        activityState = state.activityState;

        if (activityState.type !== "singleDoc") {
            throw Error("Shouldn't happen");
        }

        expect(activityState.creditAchieved).eq(0.5);
        if (activityState.doenetStateIdx === null) {
            throw Error("Should have a doenet state index");
        }
        expect(activityState.doenetStateIdx).eq(0);
        expect(state.doenetStates[activityState.doenetStateIdx]).eq(
            "DoenetML state 5",
        );

        expect(spy).toHaveBeenCalledTimes(6);

        expect(spy.mock.lastCall).eqls([
            {
                subject: "SPLICE.reportScoreAndState",
                score: 0.5,
                itemScores: [
                    {
                        id: "doc5",
                        score: 0.5,
                        docId: "doc5",
                        shuffledOrder: 1,
                        variant: activityState.currentVariant,
                    },
                ],
                itemUpdated: 1,
                state: {
                    activityState: pruneActivityStateForSave(activityState),
                    doenetStates: ["DoenetML state 5"],
                    itemAttemptNumbers: [1],
                    sourceHash,
                },
                newDoenetStateIdx: 0,
                activityId: "newId",
            },
        ]);

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        expect("newAttempt" in spy.mock.lastCall![0]).eq(false);
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        expect("newAttemptForItem" in spy.mock.lastCall![0]).eq(false);
    });

    function testStateSeq3Docs({
        state,
        docCredits,
        docAttemptNumbers,
        docStates,
        docIds,
        attemptNumber,
        itemAttemptNumbers,
        itemUpdated,
        newAttempt,
        newAttemptForItem,
        newDoenetStateIdx,
        sourceHash,
        spy,
    }: {
        state: ActivityAndDoenetState;
        docCredits: number[];
        docAttemptNumbers: number[];
        docStates: (string | undefined | null)[];
        docIds: string[];
        attemptNumber: number;
        itemAttemptNumbers: number[];
        itemUpdated?: number;
        newAttempt?: boolean;
        newAttemptForItem?: number;
        newDoenetStateIdx?: number;
        sourceHash: string;
        spy: MockInstance;
    }) {
        const activityState = state.activityState;

        if (activityState.type !== "sequence") {
            throw Error("Shouldn't happen");
        }

        const creditAchieved = activityState.creditAchieved;
        expect(creditAchieved).closeTo(
            docCredits.reduce((a, c) => a + c, 0) / 3,
            1e-12,
        );

        expect(activityState.attemptNumber).eq(attemptNumber);

        const docVariants: number[] = [];

        for (let i = 0; i < 3; i++) {
            const docState = activityState.orderedChildren[i];
            if (docState.type !== "singleDoc") {
                throw Error("Shouldn't happen");
            }
            expect(docState.id).eq(docIds[i]);
            expect(docState.creditAchieved).eq(docCredits[i]);
            expect(docState.attemptNumber).eq(docAttemptNumbers[i]);
            if (docStates[i] === undefined || docStates[i] === null) {
                expect(docState.doenetStateIdx === null);
            } else {
                if (docState.doenetStateIdx === null) {
                    throw Error("Should have doenet state index");
                }
                expect(state.doenetStates[docState.doenetStateIdx]).eq(
                    docStates[i],
                );
            }

            docVariants.push(docState.currentVariant);
        }

        const newInfoObj: {
            newAttempt?: boolean;
            newAttemptForItem?: number;
            newDoenetStateIdx?: number;
            itemUpdated?: number;
        } = {};
        if (newAttempt) {
            newInfoObj.newAttempt = true;
        }
        if (newAttemptForItem) {
            newInfoObj.newAttemptForItem = newAttemptForItem;
        }
        if (newDoenetStateIdx !== undefined) {
            newInfoObj.newDoenetStateIdx = newDoenetStateIdx;
        }
        if (itemUpdated !== undefined) {
            newInfoObj.itemUpdated = itemUpdated;
        }

        expect(spy.mock.lastCall).eqls([
            {
                subject: "SPLICE.reportScoreAndState",
                score: creditAchieved,
                itemScores: activityState.allChildren.map((child) => {
                    const idx = docIds.indexOf(child.id);
                    return {
                        id: docIds[idx],
                        score: docCredits[idx],
                        docId: docIds[idx],
                        shuffledOrder: idx + 1,
                        variant: docVariants[idx],
                    };
                }),
                state: {
                    activityState: pruneActivityStateForSave(activityState),
                    doenetStates: docStates,
                    itemAttemptNumbers,
                    sourceHash,
                },
                activityId: "newId",
                ...newInfoObj,
            },
        ]);

        if (!newAttempt) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            expect("newAttempt" in spy.mock.lastCall![0]).eq(false);
        }
        if (!newAttemptForItem) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            expect("newAttemptForItem" in spy.mock.lastCall![0]).eq(false);
        }
    }

    it("update single state, sequence of three documents, activity-wide new attempts", () => {
        vi.stubGlobal("window", {
            postMessage: vi.fn(() => null),
        });
        const spy = vi.spyOn(window, "postMessage");

        const source = seqShuf as SequenceSource;
        const sourceHash = hash(source);

        const { numActivityVariants } = gatherDocumentStructure(source);

        const state0 = initializeActivityState({
            source: source,
            variant: 5,
            parentId: null,
            numActivityVariants,
        });

        const itemAttemptNumbers = [1, 1, 1];

        let state = activityDoenetStateReducer(
            {
                activityState: state0,
                doenetStates: [],
                itemAttemptNumbers,
            },
            {
                type: "generateNewActivityAttempt",
                numActivityVariants,
                initialQuestionCounter: 0,
                questionCounts: {},
                allowSaveState: false,
                baseId: "newId",
                sourceHash,
            },
        );

        const activityState = state.activityState;

        if (activityState.type !== "sequence") {
            throw Error("Shouldn't happen");
        }

        // determine ordered documents
        const docIds = activityState.orderedChildren.map((c) => c.id);
        let docCredits = [0, 0, 0];
        let docAttemptNumbers = [1, 1, 1];
        let docStates: (string | undefined | null)[] = [];
        let attemptNumber = 1;

        // Get score of 0.4 in first doc
        docStates[0] = "DoenetML state 1.1";
        docCredits[0] = 0.4;
        state = activityDoenetStateReducer(state, {
            type: "updateSingleState",
            docId: docIds[0],
            doenetState: docStates[0],
            doenetStateIdx: 0,
            itemSequence: docIds,
            creditAchieved: docCredits[0],
            allowSaveState: true,
            baseId: "newId",
            sourceHash,
        });

        testStateSeq3Docs({
            state,
            docCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            itemAttemptNumbers,
            itemUpdated: 1,
            newDoenetStateIdx: 0,
            sourceHash,
            spy,
        });

        // Get score of 0.6 in second doc
        docStates[1] = "DoenetML state 2.1";
        docCredits[1] = 0.6;
        state = activityDoenetStateReducer(state, {
            type: "updateSingleState",
            docId: docIds[1],
            doenetState: docStates[1],
            doenetStateIdx: 1,
            itemSequence: docIds,
            creditAchieved: docCredits[1],
            allowSaveState: true,
            baseId: "newId",
            sourceHash,
        });
        testStateSeq3Docs({
            state,
            docCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            itemAttemptNumbers,
            itemUpdated: 2,
            sourceHash,
            newDoenetStateIdx: 1,
            spy,
        });

        // Decrease score of 0.2 in second doc
        docStates[1] = "DoenetML state 2.2";
        docCredits[1] = 0.2;
        state = activityDoenetStateReducer(state, {
            type: "updateSingleState",
            docId: docIds[1],
            doenetState: docStates[1],
            doenetStateIdx: 1,
            itemSequence: docIds,
            creditAchieved: docCredits[1],
            allowSaveState: true,
            baseId: "newId",
            sourceHash,
        });
        testStateSeq3Docs({
            state,
            docCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            newDoenetStateIdx: 1,
            attemptNumber,
            itemAttemptNumbers,
            itemUpdated: 2,
            sourceHash,
            spy,
        });

        // Generate new attempt of entire activity
        state = activityDoenetStateReducer(state, {
            type: "generateNewActivityAttempt",
            numActivityVariants,
            initialQuestionCounter: 0,
            questionCounts: {},
            allowSaveState: true,
            baseId: "newId",
            sourceHash,
        });

        attemptNumber++;
        docAttemptNumbers = docAttemptNumbers.map((x) => x + 1);
        docCredits = [0, 0, 0];
        docStates = [];

        testStateSeq3Docs({
            state,
            docCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            itemAttemptNumbers,
            newAttempt: true,
            sourceHash,
            spy,
        });

        // get score of 0.8 on third doc
        docStates[2] = "DoenetML state 3.1";
        docCredits[2] = 0.8;
        state = activityDoenetStateReducer(state, {
            type: "updateSingleState",
            docId: docIds[2],
            doenetState: docStates[2],
            doenetStateIdx: 2,
            itemSequence: docIds,
            creditAchieved: docCredits[2],
            allowSaveState: true,
            baseId: "newId",
            sourceHash,
        });

        testStateSeq3Docs({
            state,
            docCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            itemAttemptNumbers,
            itemUpdated: 3,
            newDoenetStateIdx: 2,
            sourceHash,
            spy,
        });
    });

    it("update single state, sequence of three documents, new attempts for documents", () => {
        vi.stubGlobal("window", {
            postMessage: vi.fn(() => null),
        });
        const spy = vi.spyOn(window, "postMessage");

        const source = seqShuf as SequenceSource;
        const sourceHash = hash(source);

        const { numActivityVariants } = gatherDocumentStructure(source);

        const childIds = source.items.map((c) => c.id);

        const state0 = initializeActivityState({
            source: source,
            variant: 5,
            parentId: null,
            numActivityVariants,
        });

        const itemAttemptNumbers = [1, 1, 1];

        let state = activityDoenetStateReducer(
            { activityState: state0, doenetStates: [], itemAttemptNumbers },
            {
                type: "generateNewActivityAttempt",
                numActivityVariants,
                initialQuestionCounter: 0,
                questionCounts: {},
                allowSaveState: false,
                baseId: "newId",
                sourceHash,
            },
        );

        const activityState = state.activityState;

        if (activityState.type !== "sequence") {
            throw Error("Shouldn't happen");
        }

        // determine ordered documents
        const docIds = activityState.orderedChildren.map((c) => c.id);
        const docCredits = [0, 0, 0];
        const docAttemptNumbers = [1, 1, 1];
        const docStates: (string | undefined | null)[] = [];
        const attemptNumber = 1;

        // Get score of 0.4 in first doc
        docStates[0] = "DoenetML state 1.1";
        docCredits[0] = 0.4;
        state = activityDoenetStateReducer(state, {
            type: "updateSingleState",
            docId: docIds[0],
            doenetState: docStates[0],
            doenetStateIdx: 0,
            itemSequence: docIds,
            creditAchieved: docCredits[0],
            allowSaveState: true,
            baseId: "newId",
            sourceHash,
        });

        testStateSeq3Docs({
            state,
            docCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            itemAttemptNumbers,
            itemUpdated: 1,
            newDoenetStateIdx: 0,
            sourceHash,
            spy,
        });

        // Get score of 0.6 in second doc
        docStates[1] = "DoenetML state 2.1";
        docCredits[1] = 0.6;
        state = activityDoenetStateReducer(state, {
            type: "updateSingleState",
            docId: docIds[1],
            doenetState: docStates[1],
            doenetStateIdx: 1,
            itemSequence: docIds,
            creditAchieved: docCredits[1],
            allowSaveState: true,
            baseId: "newId",
            sourceHash,
        });
        testStateSeq3Docs({
            state,
            docCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            itemAttemptNumbers,
            itemUpdated: 2,
            newDoenetStateIdx: 1,
            sourceHash,
            spy,
        });

        // Decrease score of 0.2 in second doc
        docStates[1] = "DoenetML state 2.2";
        docCredits[1] = 0.2;
        state = activityDoenetStateReducer(state, {
            type: "updateSingleState",
            docId: docIds[1],
            doenetState: docStates[1],
            doenetStateIdx: 1,
            itemSequence: docIds,
            creditAchieved: docCredits[1],
            allowSaveState: true,
            baseId: "newId",
            sourceHash,
        });
        testStateSeq3Docs({
            state,
            docCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            itemAttemptNumbers,
            itemUpdated: 2,
            newDoenetStateIdx: 1,
            sourceHash,
            spy,
        });

        // Generate new attempt of first document
        state = activityDoenetStateReducer(state, {
            type: "generateSingleDocSubActivityAttempt",
            docId: docIds[0],
            doenetStateIdx: 0,
            itemSequence: docIds,
            numActivityVariants,
            initialQuestionCounter: 0,
            questionCounts: {},
            allowSaveState: true,
            baseId: "newId",
            sourceHash,
        });

        docAttemptNumbers[0]++;
        itemAttemptNumbers[0]++;
        docCredits[0] = 0;
        docStates[0] = null;

        testStateSeq3Docs({
            state,
            docCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            itemAttemptNumbers,
            newAttempt: true,
            newAttemptForItem: childIds.indexOf(docIds[0]) + 1,
            newDoenetStateIdx: 0,
            sourceHash,
            spy,
        });

        // get score of 0.5 on first doc
        docStates[0] = "DoenetML state 1.2";
        docCredits[0] = 0.5;
        state = activityDoenetStateReducer(state, {
            type: "updateSingleState",
            docId: docIds[0],
            doenetState: docStates[0],
            doenetStateIdx: 0,
            itemSequence: docIds,
            creditAchieved: docCredits[0],
            allowSaveState: true,
            baseId: "newId",
            sourceHash,
        });

        testStateSeq3Docs({
            state,
            docCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            itemAttemptNumbers,
            itemUpdated: 1,
            newDoenetStateIdx: 0,
            sourceHash,
            spy,
        });

        // get score of 0.8 on third doc
        docStates[2] = "DoenetML state 3.1";
        docCredits[2] = 0.8;
        state = activityDoenetStateReducer(state, {
            type: "updateSingleState",
            docId: docIds[2],
            doenetState: docStates[2],
            doenetStateIdx: 2,
            itemSequence: docIds,
            creditAchieved: docCredits[2],
            allowSaveState: true,
            baseId: "newId",
            sourceHash,
        });

        testStateSeq3Docs({
            state,
            docCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            itemAttemptNumbers,
            itemUpdated: 3,
            newDoenetStateIdx: 2,
            sourceHash,
            spy,
        });

        // get score of 0 on second doc
        docStates[1] = "DoenetML state 2.3";
        docCredits[1] = 0;
        state = activityDoenetStateReducer(state, {
            type: "updateSingleState",
            docId: docIds[1],
            doenetState: docStates[1],
            doenetStateIdx: 1,
            itemSequence: docIds,
            creditAchieved: docCredits[1],
            allowSaveState: true,
            baseId: "newId",
            sourceHash,
        });

        testStateSeq3Docs({
            state,
            docCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            itemAttemptNumbers,
            itemUpdated: 2,
            newDoenetStateIdx: 1,
            sourceHash,
            spy,
        });

        // Generate new attempt of second document
        state = activityDoenetStateReducer(state, {
            type: "generateSingleDocSubActivityAttempt",
            docId: docIds[1],
            doenetStateIdx: 1,
            itemSequence: docIds,
            numActivityVariants,
            initialQuestionCounter: 0,
            questionCounts: {},
            allowSaveState: true,
            baseId: "newId",
            sourceHash,
        });

        docAttemptNumbers[1]++;
        itemAttemptNumbers[1]++;
        docCredits[1] = 0;
        docStates[1] = null;

        testStateSeq3Docs({
            state,
            docCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            itemAttemptNumbers,
            newAttempt: true,
            newAttemptForItem: childIds.indexOf(docIds[1]) + 1,
            newDoenetStateIdx: 1,
            sourceHash,
            spy,
        });

        // get score of 0.9 on second doc
        docStates[1] = "DoenetML state 2.4";
        docCredits[1] = 0.9;
        state = activityDoenetStateReducer(state, {
            type: "updateSingleState",
            docId: docIds[1],
            doenetState: docStates[1],
            doenetStateIdx: 1,
            itemSequence: docIds,
            creditAchieved: docCredits[1],
            allowSaveState: true,
            baseId: "newId",
            sourceHash,
        });

        testStateSeq3Docs({
            state,
            docCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            itemAttemptNumbers,
            itemUpdated: 2,
            newDoenetStateIdx: 1,
            sourceHash,
            spy,
        });
    });

    function testStateSeq2Sels({
        state,
        selCredits,
        selAttemptNumbers,
        selIds,
        docCredits,
        docAttemptNumbers,
        docStates,
        docIds,
        attemptNumber,
        itemAttemptNumbers,
        itemUpdated,
        newAttempt,
        newAttemptForItem,
        newDoenetStateIdx,
        sourceHash,
        spy,
    }: {
        state: ActivityAndDoenetState;
        selCredits: number[];
        selAttemptNumbers: number[];
        selIds: string[];
        docCredits: number[];
        docAttemptNumbers: Record<string, number>;
        docStates: (string | undefined | null)[];
        docIds: string[];
        attemptNumber: number;
        itemAttemptNumbers: number[];
        itemUpdated?: number;
        newAttempt?: boolean;
        newAttemptForItem?: number;
        newDoenetStateIdx?: number;
        sourceHash: string;
        spy: MockInstance;
    }) {
        const activityState = state.activityState;

        if (activityState.type !== "sequence") {
            throw Error("Shouldn't happen");
        }

        const creditAchieved = activityState.creditAchieved;
        expect(creditAchieved).closeTo(
            selCredits.reduce((a, c) => a + c, 0) / 2,
            1e-12,
        );

        expect(activityState.attemptNumber).eq(attemptNumber);

        const docVariants: number[] = [];

        for (let i = 0; i < 2; i++) {
            const selectState = activityState.orderedChildren[i];
            if (selectState.type !== "select") {
                throw Error("Shouldn't happen");
            }
            expect(selectState.id).eq(selIds[i]);
            expect(selectState.creditAchieved).eq(selCredits[i]);
            expect(selectState.attemptNumber).eq(selAttemptNumbers[i]);

            const docState = selectState.selectedChildren[0];
            if (docState.type !== "singleDoc") {
                throw Error("Shouldn't happen");
            }
            expect(docState.id).eq(docIds[i]);
            expect(docState.creditAchieved).eq(docCredits[i]);
            expect(docState.attemptNumber).eq(docAttemptNumbers[docIds[i]]);
            if (docStates[i] === undefined || docStates[i] === null) {
                expect(docState.doenetStateIdx === null);
            } else {
                if (docState.doenetStateIdx === null) {
                    throw Error("Should have doenet state index");
                }
                expect(state.doenetStates[docState.doenetStateIdx]).eq(
                    docStates[i],
                );
            }

            docVariants.push(docState.currentVariant);
        }

        const newInfoObj: {
            newAttempt?: boolean;
            newAttemptForItem?: number;
            newDoenetStateIdx?: number;
            itemUpdated?: number;
        } = {};
        if (newAttempt) {
            newInfoObj.newAttempt = true;
        }
        if (newAttemptForItem) {
            newInfoObj.newAttemptForItem = newAttemptForItem;
        }
        if (newDoenetStateIdx !== undefined) {
            newInfoObj.newDoenetStateIdx = newDoenetStateIdx;
        }
        if (itemUpdated !== undefined) {
            newInfoObj.itemUpdated = itemUpdated;
        }

        expect(spy.mock.lastCall).eqls([
            {
                subject: "SPLICE.reportScoreAndState",
                score: creditAchieved,
                itemScores: activityState.allChildren.map((child) => {
                    const idx = selIds.indexOf(child.id);
                    return {
                        id: selIds[idx],
                        score: selCredits[idx],
                        docId: docIds[idx],
                        shuffledOrder: idx + 1,
                        variant: docVariants[idx],
                    };
                }),
                state: {
                    activityState: pruneActivityStateForSave(activityState),
                    doenetStates: docStates,
                    itemAttemptNumbers,
                    sourceHash,
                },
                activityId: "newId",
                ...newInfoObj,
            },
        ]);

        if (!newAttempt) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            expect("newAttempt" in spy.mock.lastCall![0]).eq(false);
        }
        if (!newAttemptForItem) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            expect("newAttemptForItem" in spy.mock.lastCall![0]).eq(false);
        }
    }

    it("update single state, sequence of two selects, activity-wide new attempts", () => {
        vi.stubGlobal("window", {
            postMessage: vi.fn(() => null),
        });
        const spy = vi.spyOn(window, "postMessage");

        const source = seq2sel as SequenceSource;
        const sourceHash = hash(source);

        const { numActivityVariants } = gatherDocumentStructure(source);

        const state0 = initializeActivityState({
            source: source,
            variant: 5,
            parentId: null,
            numActivityVariants,
        });

        const itemAttemptNumbers = [1, 1];
        let state = activityDoenetStateReducer(
            { activityState: state0, doenetStates: [], itemAttemptNumbers },
            {
                type: "generateNewActivityAttempt",
                numActivityVariants,
                initialQuestionCounter: 0,
                questionCounts: {},
                allowSaveState: false,
                baseId: "newId",
                sourceHash,
            },
        );

        let activityState = state.activityState;

        if (activityState.type !== "sequence") {
            throw Error("Shouldn't happen");
        }

        // determine ordered selects and the selected documents
        let selIds = activityState.orderedChildren.map((c) => c.id);
        let docIds = [];
        for (const a of activityState.orderedChildren) {
            if (a.type !== "select") {
                throw Error("Shouldn't happen");
            }
            docIds.push(a.selectedChildren[0].id);
        }

        let selAttemptNumbers = [1, 1];
        let selCredits = [0, 0];

        const docAttemptNumbers = { [docIds[0]]: 1, [docIds[1]]: 1 };
        let docCredits = [0, 0];
        let docStates: (string | undefined | null)[] = [];
        let attemptNumber = 1;

        // Get score of 0.4 in first doc
        docStates[0] = "DoenetML state 1.1";
        docCredits[0] = 0.4;
        selCredits[0] = 0.4;
        state = activityDoenetStateReducer(state, {
            type: "updateSingleState",
            docId: docIds[0],
            doenetState: docStates[0],
            doenetStateIdx: 0,
            itemSequence: docIds,
            creditAchieved: docCredits[0],
            allowSaveState: true,
            baseId: "newId",
            sourceHash,
        });

        testStateSeq2Sels({
            state,
            selCredits,
            selAttemptNumbers,
            selIds,
            docCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            itemAttemptNumbers,
            itemUpdated: 1,
            newDoenetStateIdx: 0,
            sourceHash,
            spy,
        });

        // Get score of 0.6 in second doc
        docStates[1] = "DoenetML state 2.1";
        docCredits[1] = 0.6;
        selCredits[1] = 0.6;
        state = activityDoenetStateReducer(state, {
            type: "updateSingleState",
            docId: docIds[1],
            doenetState: docStates[1],
            doenetStateIdx: 1,
            itemSequence: docIds,
            creditAchieved: docCredits[1],
            allowSaveState: true,
            baseId: "newId",
            sourceHash,
        });

        testStateSeq2Sels({
            state,
            selCredits,
            selAttemptNumbers,
            selIds,
            docCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            itemAttemptNumbers,
            itemUpdated: 2,
            newDoenetStateIdx: 1,
            sourceHash,
            spy,
        });

        // Decrease score of 0.2 in second doc
        docStates[1] = "DoenetML state 2.2";
        docCredits[1] = 0.2;
        selCredits[1] = 0.2;
        state = activityDoenetStateReducer(state, {
            type: "updateSingleState",
            docId: docIds[1],
            doenetState: docStates[1],
            doenetStateIdx: 1,
            itemSequence: docIds,
            creditAchieved: docCredits[1],
            allowSaveState: true,
            baseId: "newId",
            sourceHash,
        });

        testStateSeq2Sels({
            state,
            selCredits,
            selAttemptNumbers,
            selIds,
            docCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            itemAttemptNumbers,
            itemUpdated: 2,
            newDoenetStateIdx: 1,
            sourceHash,
            spy,
        });

        // Generate new attempt of entire activity
        state = activityDoenetStateReducer(state, {
            type: "generateNewActivityAttempt",
            numActivityVariants,
            initialQuestionCounter: 0,
            questionCounts: {},
            allowSaveState: true,
            baseId: "newId",
            sourceHash,
        });

        activityState = state.activityState;

        if (activityState.type !== "sequence") {
            throw Error("Shouldn't happen");
        }

        // determine ordered selects and the selected documents
        selIds = activityState.orderedChildren.map((c) => c.id);
        docIds = [];
        for (const a of activityState.orderedChildren) {
            if (a.type !== "select") {
                throw Error("Shouldn't happen");
            }
            docIds.push(a.selectedChildren[0].id);
        }
        for (let i = 0; i < 2; i++) {
            docAttemptNumbers[docIds[i]] =
                (docAttemptNumbers[docIds[i]] ?? 0) + 1;
        }

        selAttemptNumbers = [2, 2];
        selCredits = [0, 0];

        docCredits = [0, 0];
        docStates = [];
        attemptNumber++;

        testStateSeq2Sels({
            state,
            selCredits,
            selAttemptNumbers,
            selIds,
            docCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            itemAttemptNumbers,
            newAttempt: true,
            spy,
            sourceHash,
        });

        // get score of 0.8 second doc
        docStates[1] = "DoenetML state 2.3";
        docCredits[1] = 0.8;
        selCredits[1] = 0.8;
        state = activityDoenetStateReducer(state, {
            type: "updateSingleState",
            docId: docIds[1],
            doenetState: docStates[1],
            doenetStateIdx: 1,
            itemSequence: docIds,
            creditAchieved: docCredits[1],
            allowSaveState: true,
            baseId: "newId",
            sourceHash,
        });
        testStateSeq2Sels({
            state,
            selCredits,
            selAttemptNumbers,
            selIds,
            docCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            itemAttemptNumbers,
            itemUpdated: 2,
            newDoenetStateIdx: 1,
            sourceHash,
            spy,
        });
    });

    it("update single state, sequence of two selects, new attempts for docs", () => {
        vi.stubGlobal("window", {
            postMessage: vi.fn(() => null),
        });
        const spy = vi.spyOn(window, "postMessage");

        const source = seq2sel as SequenceSource;
        const sourceHash = hash(source);

        const { numActivityVariants } = gatherDocumentStructure(source);

        const childIds = source.items.map((c) => c.id);

        const state0 = initializeActivityState({
            source: source,
            variant: 5,
            parentId: null,
            numActivityVariants,
        });

        const itemAttemptNumbers = [1, 1];

        let state = activityDoenetStateReducer(
            { activityState: state0, doenetStates: [], itemAttemptNumbers },
            {
                type: "generateNewActivityAttempt",
                numActivityVariants,
                initialQuestionCounter: 0,
                questionCounts: {},
                allowSaveState: false,
                baseId: "newId",
                sourceHash,
            },
        );

        let activityState = state.activityState;

        if (activityState.type !== "sequence") {
            throw Error("Shouldn't happen");
        }

        // determine ordered selects and the selected documents
        const selIds = activityState.orderedChildren.map((c) => c.id);
        const docIds = [];
        for (const a of activityState.orderedChildren) {
            if (a.type !== "select") {
                throw Error("Shouldn't happen");
            }
            docIds.push(a.selectedChildren[0].id);
        }

        const selAttemptNumbers = [1, 1];
        const selCredits = [0, 0];

        const docAttemptNumbers = { [docIds[0]]: 1, [docIds[1]]: 1 };
        const docCredits = [0, 0];
        const docStates: (string | undefined | null)[] = [];
        const attemptNumber = 1;

        // Get score of 0.4 in first doc
        docStates[0] = "DoenetML state 1.1";
        docCredits[0] = 0.4;
        selCredits[0] = 0.4;
        state = activityDoenetStateReducer(state, {
            type: "updateSingleState",
            docId: docIds[0],
            doenetState: docStates[0],
            doenetStateIdx: 0,
            itemSequence: docIds,
            creditAchieved: docCredits[0],
            allowSaveState: true,
            baseId: "newId",
            sourceHash,
        });

        testStateSeq2Sels({
            state,
            selCredits,
            selAttemptNumbers,
            selIds,
            docCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            itemAttemptNumbers,
            itemUpdated: 1,
            newDoenetStateIdx: 0,
            sourceHash,
            spy,
        });

        // Get score of 0.6 in second doc
        docStates[1] = "DoenetML state 2.1";
        docCredits[1] = 0.6;
        selCredits[1] = 0.6;
        state = activityDoenetStateReducer(state, {
            type: "updateSingleState",
            docId: docIds[1],
            doenetState: docStates[1],
            doenetStateIdx: 1,
            itemSequence: docIds,
            creditAchieved: docCredits[1],
            allowSaveState: true,
            baseId: "newId",
            sourceHash,
        });

        testStateSeq2Sels({
            state,
            selCredits,
            selAttemptNumbers,
            selIds,
            docCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            itemAttemptNumbers,
            itemUpdated: 2,
            newDoenetStateIdx: 1,
            sourceHash,
            spy,
        });

        // Decrease score to 0.2 in second doc
        docStates[1] = "DoenetML state 2.2";
        docCredits[1] = 0.2;
        selCredits[1] = 0.2;
        state = activityDoenetStateReducer(state, {
            type: "updateSingleState",
            docId: docIds[1],
            doenetState: docStates[1],
            doenetStateIdx: 1,
            itemSequence: docIds,
            creditAchieved: docCredits[1],
            allowSaveState: true,
            baseId: "newId",
            sourceHash,
        });

        testStateSeq2Sels({
            state,
            selCredits,
            selAttemptNumbers,
            selIds,
            docCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            itemAttemptNumbers,
            itemUpdated: 2,
            newDoenetStateIdx: 1,
            sourceHash,
            spy,
        });

        // Generate new attempt the second doc
        state = activityDoenetStateReducer(state, {
            type: "generateSingleDocSubActivityAttempt",
            docId: docIds[1],
            doenetStateIdx: 1,
            itemSequence: docIds,
            numActivityVariants,
            initialQuestionCounter: 0,
            questionCounts: {},
            allowSaveState: true,
            baseId: "newId",
            sourceHash,
        });

        activityState = state.activityState;

        if (activityState.type !== "sequence") {
            throw Error("Shouldn't happen");
        }

        const selectAttempts = [1, 2];

        // determine the identity of the second document
        docIds[1] = (
            activityState.orderedChildren[1] as SelectState
        ).selectedChildren[0].id;
        docAttemptNumbers[docIds[1]] = (docAttemptNumbers[docIds[1]] ?? 0) + 1;

        selAttemptNumbers[1]++;
        selCredits[1] = 0; // don't change selCredit[1], as the credit achieved is remembered
        docStates[1] = null;
        docCredits[1] = 0;
        itemAttemptNumbers[1]++;

        testStateSeq2Sels({
            state,
            selCredits,
            selAttemptNumbers,
            selIds,
            docCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            itemAttemptNumbers,
            newAttempt: true,
            newAttemptForItem: childIds.indexOf(selIds[1]) + 1,
            newDoenetStateIdx: 1,
            sourceHash,
            spy,
        });

        // get new high score of score of 0.8 in second doc
        docStates[1] = "DoenetML state 2.3";
        docCredits[1] = 0.8;
        selCredits[1] = 0.8;
        state = activityDoenetStateReducer(state, {
            type: "updateSingleState",
            docId: docIds[1],
            doenetState: docStates[1],
            doenetStateIdx: 1,
            itemSequence: docIds,
            creditAchieved: docCredits[1],
            allowSaveState: true,
            baseId: "newId",
            sourceHash,
        });

        testStateSeq2Sels({
            state,
            selCredits,
            selAttemptNumbers,
            selIds,
            docCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            itemAttemptNumbers,
            itemUpdated: 2,
            newDoenetStateIdx: 1,
            sourceHash,
            spy,
        });

        // decrease score to 0.2 on second doc
        docStates[1] = "DoenetML state 2.4";
        docCredits[1] = 0.2;
        selCredits[1] = 0.2;
        state = activityDoenetStateReducer(state, {
            type: "updateSingleState",
            docId: docIds[1],
            doenetState: docStates[1],
            doenetStateIdx: 1,
            itemSequence: docIds,
            creditAchieved: docCredits[1],
            allowSaveState: true,
            baseId: "newId",
            sourceHash,
        });

        testStateSeq2Sels({
            state,
            selCredits,
            selAttemptNumbers,
            selIds,
            docCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            itemAttemptNumbers,
            itemUpdated: 2,
            newDoenetStateIdx: 1,
            sourceHash,
            spy,
        });

        // Generate new attempt the first doc
        state = activityDoenetStateReducer(state, {
            type: "generateSingleDocSubActivityAttempt",
            docId: docIds[0],
            doenetStateIdx: 0,
            itemSequence: docIds,
            numActivityVariants,
            initialQuestionCounter: 0,
            questionCounts: {},
            allowSaveState: true,
            baseId: "newId",
            sourceHash,
        });

        activityState = state.activityState;

        if (activityState.type !== "sequence") {
            throw Error("Shouldn't happen");
        }

        selectAttempts[0]++;

        // determine the identity of the second document
        docIds[0] = (
            activityState.orderedChildren[0] as SelectState
        ).selectedChildren[0].id;
        docAttemptNumbers[docIds[0]] = (docAttemptNumbers[docIds[0]] ?? 0) + 1;

        selAttemptNumbers[0]++;
        selCredits[0] = 0; // don't change selCredit[0], as the credit achieved is remembered
        docStates[0] = null;
        docCredits[0] = 0;
        itemAttemptNumbers[0]++;

        testStateSeq2Sels({
            state,
            selCredits,
            selAttemptNumbers,
            selIds,
            docCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            itemAttemptNumbers,
            newAttempt: true,
            newAttemptForItem: childIds.indexOf(selIds[0]) + 1,
            newDoenetStateIdx: 0,
            sourceHash,
            spy,
        });

        // get score of 0.3 on first doc
        docStates[0] = "DoenetML state 1.2";
        docCredits[0] = 0.3;
        selCredits[0] = 0.3;
        state = activityDoenetStateReducer(state, {
            type: "updateSingleState",
            docId: docIds[0],
            doenetState: docStates[0],
            doenetStateIdx: 0,
            itemSequence: docIds,
            creditAchieved: docCredits[0],
            allowSaveState: true,
            baseId: "newId",
            sourceHash,
        });

        testStateSeq2Sels({
            state,
            selCredits,
            selAttemptNumbers,
            selIds,
            docCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            itemAttemptNumbers,
            itemUpdated: 1,
            newDoenetStateIdx: 0,
            sourceHash,
            spy,
        });
    });

    function testStateSelMult2Docs({
        state,
        docCredits,
        docAttemptNumbers,
        docStates,
        docIds,
        attemptNumber,
        itemAttemptNumbers,
        itemUpdated,
        newAttempt,
        newAttemptForItem,
        newDoenetStateIdx,
        sourceHash,
        spy,
    }: {
        state: ActivityAndDoenetState;
        docCredits: number[];
        docAttemptNumbers: Record<string, number>;
        docStates: (string | undefined | null)[];
        docIds: string[];
        attemptNumber: number;
        itemAttemptNumbers: number[];
        itemUpdated?: number;
        newAttempt?: boolean;
        newAttemptForItem?: number;
        newDoenetStateIdx?: number;
        sourceHash: string;
        spy: MockInstance;
    }) {
        const activityState = state.activityState;

        if (activityState.type !== "select") {
            throw Error("Shouldn't happen");
        }

        const creditAchieved = activityState.creditAchieved;
        expect(creditAchieved).closeTo(
            docCredits.reduce((a, c) => a + c, 0) / 2,
            1e-12,
        );

        expect(activityState.attemptNumber).eq(attemptNumber);

        for (let i = 0; i < 2; i++) {
            const docState = activityState.selectedChildren[i];
            if (docState.type !== "singleDoc") {
                throw Error("Shouldn't happen");
            }
            expect(docState.id).eq(docIds[i]);
            expect(docState.creditAchieved).eq(docCredits[i]);
            expect(docState.attemptNumber).eq(docAttemptNumbers[docIds[i]]);
            if (docStates[i] === undefined || docStates[i] === null) {
                expect(docState.doenetStateIdx === null);
            } else {
                if (docState.doenetStateIdx === null) {
                    throw Error("Should have doenet state index");
                }
                expect(state.doenetStates[docState.doenetStateIdx]).eq(
                    docStates[i],
                );
            }
        }

        const newInfoObj: {
            newAttempt?: boolean;
            newAttemptForItem?: number;
            newDoenetStateIdx?: number;
            itemUpdated?: number;
        } = {};
        if (newAttempt) {
            newInfoObj.newAttempt = true;
        }
        if (newAttemptForItem) {
            newInfoObj.newAttemptForItem = newAttemptForItem;
        }
        if (newDoenetStateIdx !== undefined) {
            newInfoObj.newDoenetStateIdx = newDoenetStateIdx;
        }
        if (itemUpdated !== undefined) {
            newInfoObj.itemUpdated = itemUpdated;
        }

        expect(spy.mock.lastCall).eqls([
            {
                subject: "SPLICE.reportScoreAndState",
                score: creditAchieved,
                itemScores: [
                    {
                        id: docIds[0],
                        score: docCredits[0],
                        docId: docIds[0],
                        shuffledOrder: 1,
                        variant: Number(docIds[0].split("|")[1]),
                    },
                    {
                        id: docIds[1],
                        score: docCredits[1],
                        docId: docIds[1],
                        shuffledOrder: 2,
                        variant: Number(docIds[1].split("|")[1]),
                    },
                ],
                state: {
                    activityState: pruneActivityStateForSave(activityState),
                    doenetStates: docStates,
                    itemAttemptNumbers,
                    sourceHash,
                },
                activityId: "newId",
                ...newInfoObj,
            },
        ]);

        if (!newAttempt) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            expect("newAttempt" in spy.mock.lastCall![0]).eq(false);
        }
        if (!newAttemptForItem) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            expect("newAttemptForItem" in spy.mock.lastCall![0]).eq(false);
        }
    }

    it("update single state, select multiple from 2 docs, new attempts for docs", () => {
        vi.stubGlobal("window", {
            postMessage: vi.fn(() => null),
        });
        const spy = vi.spyOn(window, "postMessage");

        const source = selMult2docs as SelectSource;
        const sourceHash = hash(source);

        const { numActivityVariants } = gatherDocumentStructure(source);

        const state0 = initializeActivityState({
            source: source,
            variant: 5,
            parentId: null,
            numActivityVariants,
        });

        const itemAttemptNumbers = [1, 1];

        let state = activityDoenetStateReducer(
            { activityState: state0, doenetStates: [], itemAttemptNumbers },
            {
                type: "generateNewActivityAttempt",
                numActivityVariants,
                initialQuestionCounter: 0,
                questionCounts: {},
                allowSaveState: false,
                baseId: "newId",
                sourceHash,
            },
        );

        let activityState = state.activityState;

        if (activityState.type !== "select") {
            throw Error("Shouldn't happen");
        }

        // determine the selected documents
        const docIds = activityState.selectedChildren.map((c) => c.id);

        const docAttemptNumbers = { [docIds[0]]: 1, [docIds[1]]: 1 };
        const docCredits = [0, 0];
        const docStates: (string | undefined | null)[] = [];
        const attemptNumber = 1;

        // Get score of 0.4 in first doc
        docStates[0] = "DoenetML state 1.1";
        docCredits[0] = 0.4;
        state = activityDoenetStateReducer(state, {
            type: "updateSingleState",
            docId: docIds[0],
            doenetState: docStates[0],
            doenetStateIdx: 0,
            itemSequence: docIds,
            creditAchieved: docCredits[0],
            allowSaveState: true,
            baseId: "newId",
            sourceHash,
        });

        testStateSelMult2Docs({
            state,
            docCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            itemAttemptNumbers,
            itemUpdated: 1,
            newDoenetStateIdx: 0,
            sourceHash,
            spy,
        });

        // Get score of 0.6 in second doc
        docStates[1] = "DoenetML state 2.1";
        docCredits[1] = 0.6;
        state = activityDoenetStateReducer(state, {
            type: "updateSingleState",
            docId: docIds[1],
            doenetState: docStates[1],
            doenetStateIdx: 1,
            itemSequence: docIds,
            creditAchieved: docCredits[1],
            allowSaveState: true,
            baseId: "newId",
            sourceHash,
        });

        testStateSelMult2Docs({
            state,
            docCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            itemAttemptNumbers,
            itemUpdated: 2,
            newDoenetStateIdx: 1,
            sourceHash,
            spy,
        });

        // Decrease score to 0.2 in second doc
        docStates[1] = "DoenetML state 2.2";
        docCredits[1] = 0.2;
        state = activityDoenetStateReducer(state, {
            type: "updateSingleState",
            docId: docIds[1],
            doenetState: docStates[1],
            doenetStateIdx: 1,
            itemSequence: docIds,
            creditAchieved: docCredits[1],
            allowSaveState: true,
            baseId: "newId",
            sourceHash,
        });

        testStateSelMult2Docs({
            state,
            docCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            itemAttemptNumbers,
            itemUpdated: 2,
            newDoenetStateIdx: 1,
            sourceHash,
            spy,
        });

        // Generate new attempt the second document
        state = activityDoenetStateReducer(state, {
            type: "generateSingleDocSubActivityAttempt",
            docId: docIds[1],
            doenetStateIdx: 1,
            itemSequence: docIds,
            numActivityVariants,
            initialQuestionCounter: 0,
            questionCounts: {},
            allowSaveState: true,
            baseId: "newId",
            sourceHash,
        });

        activityState = state.activityState;

        if (activityState.type !== "select") {
            throw Error("Shouldn't happen");
        }

        // determine the identity of the second document
        docIds[1] = activityState.selectedChildren[1].id;
        docAttemptNumbers[docIds[1]] = (docAttemptNumbers[docIds[1]] ?? 0) + 1;

        docStates[1] = null;
        docCredits[1] = 0;

        itemAttemptNumbers[1]++;

        testStateSelMult2Docs({
            state,
            docCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            itemAttemptNumbers,
            newAttempt: true,
            newAttemptForItem: 2,
            newDoenetStateIdx: 1,
            sourceHash,
            spy,
        });

        // get new high score of score of 0.8 in second doc
        docStates[1] = "DoenetML state 2.3";
        docCredits[1] = 0.8;
        state = activityDoenetStateReducer(state, {
            type: "updateSingleState",
            docId: docIds[1],
            doenetState: docStates[1],
            doenetStateIdx: 1,
            itemSequence: docIds,
            creditAchieved: docCredits[1],
            allowSaveState: true,
            baseId: "newId",
            sourceHash,
        });

        testStateSelMult2Docs({
            state,
            docCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            itemAttemptNumbers,
            itemUpdated: 2,
            newDoenetStateIdx: 1,
            sourceHash,
            spy,
        });

        // decrease score to 0.2 on second doc
        docStates[1] = "DoenetML state 2.4";
        docCredits[1] = 0.2;
        state = activityDoenetStateReducer(state, {
            type: "updateSingleState",
            docId: docIds[1],
            doenetState: docStates[1],
            doenetStateIdx: 1,
            itemSequence: docIds,
            creditAchieved: docCredits[1],
            allowSaveState: true,
            baseId: "newId",
            sourceHash,
        });

        testStateSelMult2Docs({
            state,
            docCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            itemAttemptNumbers,
            itemUpdated: 2,
            newDoenetStateIdx: 1,
            sourceHash,
            spy,
        });

        // Generate new attempt the first document
        state = activityDoenetStateReducer(state, {
            type: "generateSingleDocSubActivityAttempt",
            docId: docIds[0],
            doenetStateIdx: 0,
            itemSequence: docIds,
            numActivityVariants,
            initialQuestionCounter: 0,
            questionCounts: {},
            allowSaveState: true,
            baseId: "newId",
            sourceHash,
        });

        activityState = state.activityState;

        if (activityState.type !== "select") {
            throw Error("Shouldn't happen");
        }

        // determine the identity of the second document
        docIds[0] = activityState.selectedChildren[0].id;
        docAttemptNumbers[docIds[0]] = (docAttemptNumbers[docIds[0]] ?? 0) + 1;

        docStates[0] = null;
        docCredits[0] = 0;
        itemAttemptNumbers[0]++;

        testStateSelMult2Docs({
            state,
            docCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            itemAttemptNumbers,
            newAttempt: true,
            newAttemptForItem: 1,
            newDoenetStateIdx: 0,
            sourceHash,
            spy,
        });

        // get score of 0.3 on first doc
        docStates[0] = "DoenetML state 1.2";
        docCredits[0] = 0.3;
        state = activityDoenetStateReducer(state, {
            type: "updateSingleState",
            docId: docIds[0],
            doenetState: docStates[0],
            doenetStateIdx: 0,
            itemSequence: docIds,
            creditAchieved: docCredits[0],
            allowSaveState: true,
            baseId: "newId",
            sourceHash,
        });

        testStateSelMult2Docs({
            state,
            docCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            itemAttemptNumbers,
            itemUpdated: 1,
            newDoenetStateIdx: 0,
            sourceHash,
            spy,
        });
    });
});
