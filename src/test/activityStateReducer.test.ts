import { afterEach, describe, expect, it, MockInstance, vi } from "vitest";
import { SequenceSource } from "../Activity/sequenceState";
import {
    ActivityState,
    gatherDocumentStructure,
    initializeActivityState,
    pruneActivityStateForSave,
} from "../Activity/activityState";
import { activityStateReducer } from "../Activity/activityStateReducer";
import seq2sel from "./testSources/seq2sel.json";
import doc from "./testSources/doc.json";
import seqShuf from "./testSources/seqShuf.json";
import selMult2docs from "./testSources/selMult2docs.json";
import { SingleDocSource, SingleDocState } from "../Activity/singleDocState";
import { SelectSource, SelectState } from "../Activity/selectState";

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

        const newState = activityStateReducer(state0, {
            type: "initialize",
            source,
            variantIndex: 5,
            numActivityVariants,
        });

        const expectedState: SingleDocState = {
            type: "singleDoc",
            id: source.id,
            parentId: null,
            source,
            doenetState: null,
            initialVariant: 5,
            creditAchieved: 0,
            latestCreditAchieved: 0,
            initialQuestionCounter: 0,
            currentVariant: 0,
            previousVariants: [],
            attemptNumber: 0,
            restrictToVariantSlice: undefined,
        };

        expect(newState).eqls(expectedState);
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

        const state = initializeActivityState({
            source: source,
            variant: 5,
            parentId: null,
            numActivityVariants,
        });

        let newState = activityStateReducer(state0, {
            type: "set",
            state,
            allowSaveState: false,
            baseId: "newId",
        });

        expect(newState).eqls(state);
        expect(spy).toHaveBeenCalledTimes(0);

        newState = activityStateReducer(state0, {
            type: "set",
            state,
            allowSaveState: true,
            baseId: "newId",
        });

        expect(newState).eqls(state);
        expect(spy).toHaveBeenCalledTimes(1);

        expect(spy.mock.lastCall).eqls([
            {
                subject: "SPLICE.reportScoreByItem",
                score: 0,
                latestScore: 0,
                scoreByItem: [
                    { id: "doc5", score: 0, latestScore: 0, docId: "doc5" },
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

        const state0 = initializeActivityState({
            source: source,
            variant: 5,
            parentId: null,
            numActivityVariants,
        }) as SingleDocState;

        // artificially set credit on state0
        state0.creditAchieved = 0.9;
        state0.latestCreditAchieved = 0.8;

        let state = activityStateReducer(state0, {
            type: "generateNewActivityAttempt",
            numActivityVariants,
            initialQuestionCounter: 9,
            questionCounts: {},
            allowSaveState: false,
            baseId: "newId",
        }) as SingleDocState;
        expect(spy).toHaveBeenCalledTimes(0);

        expect(typeof state.currentVariant).eq("number");
        const previousVariants = [state.currentVariant];

        let expectState: SingleDocState = {
            ...state0,
            initialQuestionCounter: 9,
            creditAchieved: 0,
            latestCreditAchieved: 0,
            attemptNumber: 1,
            currentVariant: previousVariants[0],
            previousVariants,
        };

        expect(state).eqls(expectState);

        state = activityStateReducer(state0, {
            type: "generateNewActivityAttempt",
            numActivityVariants,
            initialQuestionCounter: 9,
            questionCounts: {},
            allowSaveState: true,
            baseId: "newId",
        }) as SingleDocState;
        expect(state).eqls(expectState);

        expect(spy).toHaveBeenCalledTimes(1);

        expect(spy.mock.lastCall).eqls([
            {
                subject: "SPLICE.reportScoreByItem",
                score: 0,
                latestScore: 0,
                scoreByItem: [
                    { id: "doc5", score: 0, latestScore: 0, docId: "doc5" },
                ],
                activityId: "newId",
            },
        ]);

        state = activityStateReducer(state, {
            type: "generateNewActivityAttempt",
            numActivityVariants,
            initialQuestionCounter: 6,
            questionCounts: {},
            allowSaveState: true,
            baseId: "newId",
        }) as SingleDocState;

        expect(typeof state.currentVariant).eq("number");
        previousVariants.push(state.currentVariant);

        expectState = {
            ...state0,
            initialQuestionCounter: 6,
            creditAchieved: 0,
            latestCreditAchieved: 0,
            attemptNumber: 2,
            currentVariant: previousVariants[1],
            previousVariants,
        };

        expect(spy).toHaveBeenCalledTimes(2);

        expect(spy.mock.lastCall).toMatchObject([
            {
                subject: "SPLICE.reportScoreAndState",
                score: 0,
                latestScore: 0,
                scoreByItem: [
                    { id: "doc5", score: 0, latestScore: 0, docId: "doc5" },
                ],
                state: {
                    state: pruneActivityStateForSave(state),
                },
                activityId: "newId",
            },
        ]);
    });

    it("update single state, single document", () => {
        vi.stubGlobal("window", {
            postMessage: vi.fn(() => null),
        });
        const spy = vi.spyOn(window, "postMessage");

        const source = doc as SingleDocSource;
        const { numActivityVariants } = gatherDocumentStructure(source);

        const state0 = initializeActivityState({
            source: source,
            variant: 5,
            parentId: null,
            numActivityVariants,
        });

        let state = activityStateReducer(state0, {
            type: "generateNewActivityAttempt",
            numActivityVariants,
            initialQuestionCounter: 0,
            questionCounts: {},
            allowSaveState: false,
            baseId: "newId",
        });

        // Get score of 0.2
        state = activityStateReducer(state, {
            type: "updateSingleState",
            id: "doc5",
            doenetState: "DoenetML state 1",
            creditAchieved: 0.2,
            allowSaveState: true,
            baseId: "newId",
        });

        if (state.type !== "singleDoc") {
            throw Error("Shouldn't happen");
        }

        expect(state.creditAchieved).eq(0.2);
        expect(state.latestCreditAchieved).eq(0.2);
        expect(state.doenetState).eq("DoenetML state 1");

        expect(spy).toHaveBeenCalledTimes(1);

        expect(spy.mock.lastCall).toMatchObject([
            {
                subject: "SPLICE.reportScoreAndState",
                score: 0.2,
                latestScore: 0.2,
                scoreByItem: [
                    { id: "doc5", score: 0.2, latestScore: 0.2, docId: "doc5" },
                ],
                state: {
                    state: pruneActivityStateForSave(state),
                },
                activityId: "newId",
            },
        ]);

        // decrease score
        state = activityStateReducer(state, {
            type: "updateSingleState",
            id: "doc5",
            doenetState: "DoenetML state 2",
            creditAchieved: 0.1,
            allowSaveState: true,
            baseId: "newId",
        });

        if (state.type !== "singleDoc") {
            throw Error("Shouldn't happen");
        }

        expect(state.creditAchieved).eq(0.2);
        expect(state.latestCreditAchieved).eq(0.1);
        expect(state.doenetState).eq("DoenetML state 2");

        expect(spy).toHaveBeenCalledTimes(2);

        expect(spy.mock.lastCall).toMatchObject([
            {
                subject: "SPLICE.reportScoreAndState",
                score: 0.2,
                latestScore: 0.1,
                scoreByItem: [
                    { id: "doc5", score: 0.2, latestScore: 0.1, docId: "doc5" },
                ],
                state: {
                    state: pruneActivityStateForSave(state),
                },
                activityId: "newId",
            },
        ]);

        // increase score
        state = activityStateReducer(state, {
            type: "updateSingleState",
            id: "doc5",
            doenetState: "DoenetML state 3",
            creditAchieved: 0.3,
            allowSaveState: true,
            baseId: "newId",
        });

        if (state.type !== "singleDoc") {
            throw Error("Shouldn't happen");
        }

        expect(state.creditAchieved).eq(0.3);
        expect(state.latestCreditAchieved).eq(0.3);
        expect(state.doenetState).eq("DoenetML state 3");

        expect(spy).toHaveBeenCalledTimes(3);

        expect(spy.mock.lastCall).toMatchObject([
            {
                subject: "SPLICE.reportScoreAndState",
                score: 0.3,
                latestScore: 0.3,
                scoreByItem: [
                    { id: "doc5", score: 0.3, latestScore: 0.3, docId: "doc5" },
                ],
                state: {
                    state: pruneActivityStateForSave(state),
                },
                activityId: "newId",
            },
        ]);

        // generate new attempt
        state = activityStateReducer(state, {
            type: "generateNewActivityAttempt",
            numActivityVariants,
            initialQuestionCounter: 0,
            questionCounts: {},
            allowSaveState: true,
            baseId: "newId",
        });

        if (state.type !== "singleDoc") {
            throw Error("Shouldn't happen");
        }

        expect(state.creditAchieved).eq(0.0);
        expect(state.latestCreditAchieved).eq(0.0);
        expect(state.doenetState).eq(null);

        expect(spy).toHaveBeenCalledTimes(4);

        expect(spy.mock.lastCall).toMatchObject([
            {
                subject: "SPLICE.reportScoreAndState",
                score: 0,
                latestScore: 0,
                scoreByItem: [
                    { id: "doc5", score: 0, latestScore: 0, docId: "doc5" },
                ],
                state: {
                    state: pruneActivityStateForSave(state),
                },
                activityId: "newId",
            },
        ]);

        // start attempt with low score
        state = activityStateReducer(state, {
            type: "updateSingleState",
            id: "doc5",
            doenetState: "DoenetML state 4",
            creditAchieved: 0.1,
            allowSaveState: true,
            baseId: "newId",
        });

        if (state.type !== "singleDoc") {
            throw Error("Shouldn't happen");
        }

        expect(state.creditAchieved).eq(0.1);
        expect(state.latestCreditAchieved).eq(0.1);
        expect(state.doenetState).eq("DoenetML state 4");

        expect(spy).toHaveBeenCalledTimes(5);

        expect(spy.mock.lastCall).toMatchObject([
            {
                subject: "SPLICE.reportScoreAndState",
                score: 0.1,
                latestScore: 0.1,
                scoreByItem: [
                    { id: "doc5", score: 0.1, latestScore: 0.1, docId: "doc5" },
                ],
                state: {
                    state: pruneActivityStateForSave(state),
                },
                activityId: "newId",
            },
        ]);

        // increase score
        state = activityStateReducer(state, {
            type: "updateSingleState",
            id: "doc5",
            doenetState: "DoenetML state 5",
            creditAchieved: 0.5,
            allowSaveState: true,
            baseId: "newId",
        });

        if (state.type !== "singleDoc") {
            throw Error("Shouldn't happen");
        }

        expect(state.creditAchieved).eq(0.5);
        expect(state.latestCreditAchieved).eq(0.5);
        expect(state.doenetState).eq("DoenetML state 5");

        expect(spy).toHaveBeenCalledTimes(6);

        expect(spy.mock.lastCall).toMatchObject([
            {
                subject: "SPLICE.reportScoreAndState",
                score: 0.5,
                latestScore: 0.5,
                scoreByItem: [
                    { id: "doc5", score: 0.5, latestScore: 0.5, docId: "doc5" },
                ],
                state: {
                    state: pruneActivityStateForSave(state),
                },
                activityId: "newId",
            },
        ]);
    });

    function testStateSeq3Docs({
        state,
        docCredits,
        docLatestCredits,
        docAttemptNumbers,
        docStates,
        docIds,
        attemptNumber,
        spy,
    }: {
        state: ActivityState;
        docCredits: number[];
        docLatestCredits: number[];
        docAttemptNumbers: number[];
        docStates: (string | null)[];
        docIds: string[];
        attemptNumber: number;
        spy: MockInstance;
    }) {
        if (state.type !== "sequence") {
            throw Error("Shouldn't happen");
        }

        const credit = state.creditAchieved;
        expect(credit).closeTo(
            docCredits.reduce((a, c) => a + c, 0) / 3,
            1e-12,
        );
        const latestCredit = state.latestCreditAchieved;
        expect(latestCredit).closeTo(
            docLatestCredits.reduce((a, c) => a + c, 0) / 3,
            1e-12,
        );

        expect(state.attemptNumber).eq(attemptNumber);

        for (let i = 0; i < 2; i++) {
            const docState = state.orderedChildren[i];
            if (docState.type !== "singleDoc") {
                throw Error("Shouldn't happen");
            }
            expect(docState.id).eq(docIds[i]);
            expect(docState.creditAchieved).eq(docCredits[i]);
            expect(docState.latestCreditAchieved).eq(docLatestCredits[i]);
            expect(docState.attemptNumber).eq(docAttemptNumbers[i]);
            expect(docState.doenetState).eq(docStates[i]);
        }

        expect(spy.mock.lastCall).toMatchObject([
            {
                subject: "SPLICE.reportScoreAndState",
                score: credit,
                latestScore: latestCredit,
                scoreByItem: [
                    {
                        id: docIds[0],
                        score: docCredits[0],
                        latestScore: docLatestCredits[0],
                        docId: docIds[0],
                    },
                    {
                        id: docIds[1],
                        score: docCredits[1],
                        latestScore: docLatestCredits[1],
                        docId: docIds[1],
                    },
                    {
                        id: docIds[2],
                        score: docCredits[2],
                        latestScore: docLatestCredits[2],
                        docId: docIds[2],
                    },
                ],
                state: {
                    state: pruneActivityStateForSave(state),
                },
                activityId: "newId",
            },
        ]);
    }

    it("update single state, sequence of three documents, activity-wide new attempts", () => {
        vi.stubGlobal("window", {
            postMessage: vi.fn(() => null),
        });
        const spy = vi.spyOn(window, "postMessage");

        const source = seqShuf as SequenceSource;

        const { numActivityVariants } = gatherDocumentStructure(source);

        const state0 = initializeActivityState({
            source: source,
            variant: 5,
            parentId: null,
            numActivityVariants,
        });

        let state = activityStateReducer(state0, {
            type: "generateNewActivityAttempt",
            numActivityVariants,
            initialQuestionCounter: 0,
            questionCounts: {},
            allowSaveState: false,
            baseId: "newId",
        });

        if (state.type !== "sequence") {
            throw Error("Shouldn't happen");
        }

        // determine ordered documents
        const docIds = state.orderedChildren.map((c) => c.id);
        let docCredits = [0, 0, 0];
        let docLatestCredits = [0, 0, 0];
        let docAttemptNumbers = [1, 1, 1];
        let docStates: (string | null)[] = [null, null, null];
        let attemptNumber = 1;

        // Get score of 0.4 in first doc
        docStates[0] = "DoenetML state 1.1";
        docLatestCredits[0] = docCredits[0] = 0.4;
        state = activityStateReducer(state, {
            type: "updateSingleState",
            id: docIds[0],
            doenetState: docStates[0],
            creditAchieved: docLatestCredits[0],
            allowSaveState: true,
            baseId: "newId",
        });

        testStateSeq3Docs({
            state,
            docCredits,
            docLatestCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            spy,
        });

        // Get score of 0.6 in second doc
        docStates[1] = "DoenetML state 2.1";
        docLatestCredits[1] = docCredits[1] = 0.6;
        state = activityStateReducer(state, {
            type: "updateSingleState",
            id: docIds[1],
            doenetState: docStates[1],
            creditAchieved: docLatestCredits[1],
            allowSaveState: true,
            baseId: "newId",
        });
        testStateSeq3Docs({
            state,
            docCredits,
            docLatestCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            spy,
        });

        // Decrease score of 0.2 in second doc
        docStates[1] = "DoenetML state 2.2";
        docLatestCredits[1] = 0.2;
        state = activityStateReducer(state, {
            type: "updateSingleState",
            id: docIds[1],
            doenetState: docStates[1],
            creditAchieved: docLatestCredits[1],
            allowSaveState: true,
            baseId: "newId",
        });
        testStateSeq3Docs({
            state,
            docCredits,
            docLatestCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            spy,
        });

        // Generate new attempt of entire activity
        state = activityStateReducer(state, {
            type: "generateNewActivityAttempt",
            numActivityVariants,
            initialQuestionCounter: 0,
            questionCounts: {},
            allowSaveState: true,
            baseId: "newId",
        });

        attemptNumber++;
        docAttemptNumbers = docAttemptNumbers.map((x) => x + 1);
        docCredits = [0, 0, 0];
        docLatestCredits = [0, 0, 0];
        docStates = [null, null, null];

        testStateSeq3Docs({
            state,
            docCredits,
            docLatestCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            spy,
        });

        // get score of 0.8 on third doc
        docStates[2] = "DoenetML state 3.1";
        docLatestCredits[2] = docCredits[2] = 0.8;
        state = activityStateReducer(state, {
            type: "updateSingleState",
            id: docIds[2],
            doenetState: docStates[2],
            creditAchieved: docLatestCredits[2],
            allowSaveState: true,
            baseId: "newId",
        });

        testStateSeq3Docs({
            state,
            docCredits,
            docLatestCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            spy,
        });
    });

    it("update single state, sequence of three documents, new attempts for documents", () => {
        vi.stubGlobal("window", {
            postMessage: vi.fn(() => null),
        });
        const spy = vi.spyOn(window, "postMessage");

        const source = seqShuf as SequenceSource;

        const { numActivityVariants } = gatherDocumentStructure(source);

        const state0 = initializeActivityState({
            source: source,
            variant: 5,
            parentId: null,
            numActivityVariants,
        });

        let state = activityStateReducer(state0, {
            type: "generateNewActivityAttempt",
            numActivityVariants,
            initialQuestionCounter: 0,
            questionCounts: {},
            allowSaveState: false,
            baseId: "newId",
        });

        if (state.type !== "sequence") {
            throw Error("Shouldn't happen");
        }

        // determine ordered documents
        const docIds = state.orderedChildren.map((c) => c.id);
        const docCredits = [0, 0, 0];
        const docLatestCredits = [0, 0, 0];
        const docAttemptNumbers = [1, 1, 1];
        const docStates: (string | null)[] = [null, null, null];
        const attemptNumber = 1;

        // Get score of 0.4 in first doc
        docStates[0] = "DoenetML state 1.1";
        docLatestCredits[0] = docCredits[0] = 0.4;
        state = activityStateReducer(state, {
            type: "updateSingleState",
            id: docIds[0],
            doenetState: docStates[0],
            creditAchieved: docLatestCredits[0],
            allowSaveState: true,
            baseId: "newId",
        });

        testStateSeq3Docs({
            state,
            docCredits,
            docLatestCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            spy,
        });

        // Get score of 0.6 in second doc
        docStates[1] = "DoenetML state 2.1";
        docLatestCredits[1] = docCredits[1] = 0.6;
        state = activityStateReducer(state, {
            type: "updateSingleState",
            id: docIds[1],
            doenetState: docStates[1],
            creditAchieved: docLatestCredits[1],
            allowSaveState: true,
            baseId: "newId",
        });
        testStateSeq3Docs({
            state,
            docCredits,
            docLatestCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            spy,
        });

        // Decrease score of 0.2 in second doc
        docStates[1] = "DoenetML state 2.2";
        docLatestCredits[1] = 0.2;
        state = activityStateReducer(state, {
            type: "updateSingleState",
            id: docIds[1],
            doenetState: docStates[1],
            creditAchieved: docLatestCredits[1],
            allowSaveState: true,
            baseId: "newId",
        });
        testStateSeq3Docs({
            state,
            docCredits,
            docLatestCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            spy,
        });

        // Generate new attempt of first document
        state = activityStateReducer(state, {
            type: "generateNewActivityAttempt",
            id: docIds[0],
            numActivityVariants,
            initialQuestionCounter: 0,
            questionCounts: {},
            allowSaveState: true,
            baseId: "newId",
        });

        docAttemptNumbers[0]++;
        docLatestCredits[0] = 0;
        docStates[0] = null;

        testStateSeq3Docs({
            state,
            docCredits,
            docLatestCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            spy,
        });

        // get score of 0.5 on first doc
        docStates[0] = "DoenetML state 1.2";
        docLatestCredits[0] = docCredits[0] = 0.5;
        state = activityStateReducer(state, {
            type: "updateSingleState",
            id: docIds[0],
            doenetState: docStates[0],
            creditAchieved: docLatestCredits[0],
            allowSaveState: true,
            baseId: "newId",
        });

        testStateSeq3Docs({
            state,
            docCredits,
            docLatestCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            spy,
        });

        // get score of 0.8 on third doc
        docStates[2] = "DoenetML state 3.1";
        docLatestCredits[2] = docCredits[2] = 0.8;
        state = activityStateReducer(state, {
            type: "updateSingleState",
            id: docIds[2],
            doenetState: docStates[2],
            creditAchieved: docLatestCredits[2],
            allowSaveState: true,
            baseId: "newId",
        });

        testStateSeq3Docs({
            state,
            docCredits,
            docLatestCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            spy,
        });

        // get score of 0 on second doc
        docStates[1] = "DoenetML state 2.3";
        docLatestCredits[1] = 0;
        state = activityStateReducer(state, {
            type: "updateSingleState",
            id: docIds[1],
            doenetState: docStates[1],
            creditAchieved: docLatestCredits[1],
            allowSaveState: true,
            baseId: "newId",
        });

        testStateSeq3Docs({
            state,
            docCredits,
            docLatestCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            spy,
        });

        // Generate new attempt of second document
        state = activityStateReducer(state, {
            type: "generateNewActivityAttempt",
            id: docIds[1],
            numActivityVariants,
            initialQuestionCounter: 0,
            questionCounts: {},
            allowSaveState: true,
            baseId: "newId",
        });

        docAttemptNumbers[1]++;
        docLatestCredits[1] = 0;
        docStates[1] = null;

        testStateSeq3Docs({
            state,
            docCredits,
            docLatestCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            spy,
        });

        // get score of 0.9 on second doc
        docStates[1] = "DoenetML state 2.4";
        docLatestCredits[1] = docCredits[1] = 0.9;
        state = activityStateReducer(state, {
            type: "updateSingleState",
            id: docIds[1],
            doenetState: docStates[1],
            creditAchieved: docLatestCredits[1],
            allowSaveState: true,
            baseId: "newId",
        });

        testStateSeq3Docs({
            state,
            docCredits,
            docLatestCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            spy,
        });
    });

    function testStateSeq2Sels({
        state,
        selCredits,
        selLatestCredits,
        selAttemptNumbers,
        selIds,
        docCredits,
        docLatestCredits,
        docAttemptNumbers,
        docStates,
        docIds,
        attemptNumber,
        spy,
    }: {
        state: ActivityState;
        selCredits: number[];
        selLatestCredits: number[];
        selAttemptNumbers: number[];
        selIds: string[];
        docCredits: number[];
        docLatestCredits: number[];
        docAttemptNumbers: Record<string, number>;
        docStates: (string | null)[];
        docIds: string[];
        attemptNumber: number;
        spy: MockInstance;
    }) {
        if (state.type !== "sequence") {
            throw Error("Shouldn't happen");
        }

        const credit = state.creditAchieved;
        expect(credit).closeTo(
            selCredits.reduce((a, c) => a + c, 0) / 2,
            1e-12,
        );
        const latestCredit = state.latestCreditAchieved;
        expect(latestCredit).closeTo(
            selLatestCredits.reduce((a, c) => a + c, 0) / 2,
            1e-12,
        );

        expect(state.attemptNumber).eq(attemptNumber);

        for (let i = 0; i < 2; i++) {
            const selectState = state.orderedChildren[i];
            if (selectState.type !== "select") {
                throw Error("Shouldn't happen");
            }
            expect(selectState.id).eq(selIds[i]);
            expect(selectState.creditAchieved).eq(selCredits[i]);
            expect(selectState.latestCreditAchieved).eq(selLatestCredits[i]);
            expect(selectState.attemptNumber).eq(selAttemptNumbers[i]);

            const docState = selectState.selectedChildren[0];
            if (docState.type !== "singleDoc") {
                throw Error("Shouldn't happen");
            }
            expect(docState.id).eq(docIds[i]);
            expect(docState.creditAchieved).eq(docCredits[i]);
            expect(docState.latestCreditAchieved).eq(docLatestCredits[i]);
            expect(docState.attemptNumber).eq(docAttemptNumbers[docIds[i]]);
            expect(docState.doenetState).eq(docStates[i]);
        }

        expect(spy.mock.lastCall).toMatchObject([
            {
                subject: "SPLICE.reportScoreAndState",
                score: credit,
                latestScore: latestCredit,
                scoreByItem: [
                    {
                        id: selIds[0],
                        score: selCredits[0],
                        latestScore: selLatestCredits[0],
                        docId: docIds[0],
                    },
                    {
                        id: selIds[1],
                        score: selCredits[1],
                        latestScore: selLatestCredits[1],
                        docId: docIds[1],
                    },
                ],
                state: {
                    state: pruneActivityStateForSave(state),
                },
                activityId: "newId",
            },
        ]);
    }

    it("update single state, sequence of two selects, activity-wide new attempts", () => {
        vi.stubGlobal("window", {
            postMessage: vi.fn(() => null),
        });
        const spy = vi.spyOn(window, "postMessage");

        const source = seq2sel as SequenceSource;

        const { numActivityVariants } = gatherDocumentStructure(source);

        const state0 = initializeActivityState({
            source: source,
            variant: 5,
            parentId: null,
            numActivityVariants,
        });

        let state = activityStateReducer(state0, {
            type: "generateNewActivityAttempt",
            numActivityVariants,
            initialQuestionCounter: 0,
            questionCounts: {},
            allowSaveState: false,
            baseId: "newId",
        });

        if (state.type !== "sequence") {
            throw Error("Shouldn't happen");
        }

        // determine ordered selects and the selected documents
        let selIds = state.orderedChildren.map((c) => c.id);
        let docIds = [];
        for (const a of state.orderedChildren) {
            if (a.type !== "select") {
                throw Error("Shouldn't happen");
            }
            docIds.push(a.selectedChildren[0].id);
        }

        let selAttemptNumbers = [1, 1];
        let selCredits = [0, 0];
        let selLatestCredits = [0, 0];

        const docAttemptNumbers = { [docIds[0]]: 1, [docIds[1]]: 1 };
        let docCredits = [0, 0];
        let docLatestCredits = [0, 0];
        let docStates: (string | null)[] = [null, null];
        let attemptNumber = 1;

        // Get score of 0.4 in first doc
        docStates[0] = "DoenetML state 1.1";
        docLatestCredits[0] = docCredits[0] = 0.4;
        selLatestCredits[0] = selCredits[0] = 0.4;
        state = activityStateReducer(state, {
            type: "updateSingleState",
            id: docIds[0],
            doenetState: docStates[0],
            creditAchieved: docLatestCredits[0],
            allowSaveState: true,
            baseId: "newId",
        });

        testStateSeq2Sels({
            state,
            selCredits,
            selLatestCredits,
            selAttemptNumbers,
            selIds,
            docCredits,
            docLatestCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            spy,
        });

        // Get score of 0.6 in second doc
        docStates[1] = "DoenetML state 2.1";
        docLatestCredits[1] = docCredits[1] = 0.6;
        selLatestCredits[1] = selCredits[1] = 0.6;
        state = activityStateReducer(state, {
            type: "updateSingleState",
            id: docIds[1],
            doenetState: docStates[1],
            creditAchieved: docLatestCredits[1],
            allowSaveState: true,
            baseId: "newId",
        });

        testStateSeq2Sels({
            state,
            selCredits,
            selLatestCredits,
            selAttemptNumbers,
            selIds,
            docCredits,
            docLatestCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            spy,
        });

        // Decrease score of 0.2 in second doc
        docStates[1] = "DoenetML state 2.2";
        docLatestCredits[1] = 0.2;
        selLatestCredits[1] = 0.2;
        state = activityStateReducer(state, {
            type: "updateSingleState",
            id: docIds[1],
            doenetState: docStates[1],
            creditAchieved: docLatestCredits[1],
            allowSaveState: true,
            baseId: "newId",
        });

        testStateSeq2Sels({
            state,
            selCredits,
            selLatestCredits,
            selAttemptNumbers,
            selIds,
            docCredits,
            docLatestCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            spy,
        });

        // Generate new attempt of entire activity
        state = activityStateReducer(state, {
            type: "generateNewActivityAttempt",
            numActivityVariants,
            initialQuestionCounter: 0,
            questionCounts: {},
            allowSaveState: true,
            baseId: "newId",
        });

        if (state.type !== "sequence") {
            throw Error("Shouldn't happen");
        }

        // determine ordered selects and the selected documents
        selIds = state.orderedChildren.map((c) => c.id);
        docIds = [];
        for (const a of state.orderedChildren) {
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
        selLatestCredits = [0, 0];

        docCredits = [0, 0];
        docLatestCredits = [0, 0];
        docStates = [null, null];
        attemptNumber++;

        testStateSeq2Sels({
            state,
            selCredits,
            selLatestCredits,
            selAttemptNumbers,
            selIds,
            docCredits,
            docLatestCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            spy,
        });

        // get score of 0.8 second doc
        docStates[1] = "DoenetML state 2.3";
        docCredits[1] = docLatestCredits[1] = 0.8;
        selCredits[1] = selLatestCredits[1] = 0.8;
        state = activityStateReducer(state, {
            type: "updateSingleState",
            id: docIds[1],
            doenetState: docStates[1],
            creditAchieved: docLatestCredits[1],
            allowSaveState: true,
            baseId: "newId",
        });
        testStateSeq2Sels({
            state,
            selCredits,
            selLatestCredits,
            selAttemptNumbers,
            selIds,
            docCredits,
            docLatestCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            spy,
        });
    });

    it("update single state, sequence of two selects, new attempts for selects", () => {
        vi.stubGlobal("window", {
            postMessage: vi.fn(() => null),
        });
        const spy = vi.spyOn(window, "postMessage");

        const source = seq2sel as SequenceSource;

        const { numActivityVariants } = gatherDocumentStructure(source);

        const state0 = initializeActivityState({
            source: source,
            variant: 5,
            parentId: null,
            numActivityVariants,
        });

        let state = activityStateReducer(state0, {
            type: "generateNewActivityAttempt",
            numActivityVariants,
            initialQuestionCounter: 0,
            questionCounts: {},
            allowSaveState: false,
            baseId: "newId",
        });

        if (state.type !== "sequence") {
            throw Error("Shouldn't happen");
        }

        // determine ordered selects and the selected documents
        const selIds = state.orderedChildren.map((c) => c.id);
        const docIds = [];
        for (const a of state.orderedChildren) {
            if (a.type !== "select") {
                throw Error("Shouldn't happen");
            }
            docIds.push(a.selectedChildren[0].id);
        }

        const selAttemptNumbers = [1, 1];
        const selCredits = [0, 0];
        const selLatestCredits = [0, 0];

        const docAttemptNumbers = { [docIds[0]]: 1, [docIds[1]]: 1 };
        const docCredits = [0, 0];
        const docLatestCredits = [0, 0];
        const docStates: (string | null)[] = [null, null];
        const attemptNumber = 1;

        // Get score of 0.4 in first doc
        docStates[0] = "DoenetML state 1.1";
        docLatestCredits[0] = docCredits[0] = 0.4;
        selLatestCredits[0] = selCredits[0] = 0.4;
        state = activityStateReducer(state, {
            type: "updateSingleState",
            id: docIds[0],
            doenetState: docStates[0],
            creditAchieved: docLatestCredits[0],
            allowSaveState: true,
            baseId: "newId",
        });

        testStateSeq2Sels({
            state,
            selCredits,
            selLatestCredits,
            selAttemptNumbers,
            selIds,
            docCredits,
            docLatestCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            spy,
        });

        // Get score of 0.6 in second doc
        docStates[1] = "DoenetML state 2.1";
        docLatestCredits[1] = docCredits[1] = 0.6;
        selLatestCredits[1] = selCredits[1] = 0.6;
        state = activityStateReducer(state, {
            type: "updateSingleState",
            id: docIds[1],
            doenetState: docStates[1],
            creditAchieved: docLatestCredits[1],
            allowSaveState: true,
            baseId: "newId",
        });

        testStateSeq2Sels({
            state,
            selCredits,
            selLatestCredits,
            selAttemptNumbers,
            selIds,
            docCredits,
            docLatestCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            spy,
        });

        // Decrease score to 0.2 in second doc
        docStates[1] = "DoenetML state 2.2";
        docLatestCredits[1] = 0.2;
        selLatestCredits[1] = 0.2;
        state = activityStateReducer(state, {
            type: "updateSingleState",
            id: docIds[1],
            doenetState: docStates[1],
            creditAchieved: docLatestCredits[1],
            allowSaveState: true,
            baseId: "newId",
        });

        testStateSeq2Sels({
            state,
            selCredits,
            selLatestCredits,
            selAttemptNumbers,
            selIds,
            docCredits,
            docLatestCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            spy,
        });

        // Generate new attempt the second select
        state = activityStateReducer(state, {
            type: "generateNewActivityAttempt",
            id: selIds[1],
            numActivityVariants,
            initialQuestionCounter: 0,
            questionCounts: {},
            allowSaveState: true,
            baseId: "newId",
        });

        if (state.type !== "sequence") {
            throw Error("Shouldn't happen");
        }

        const selectAttempts = [1, 2];

        // determine the identity of the second document
        docIds[1] = (
            state.orderedChildren[1] as SelectState
        ).selectedChildren[0].id;
        docAttemptNumbers[docIds[1]] = (docAttemptNumbers[docIds[1]] ?? 0) + 1;

        selAttemptNumbers[1]++;
        selLatestCredits[1] = 0; // don't change selCredit[1], as the credit achieved is remembered
        docStates[1] = null;
        docLatestCredits[1] = 0;
        docCredits[1] = 0; // document doesn't retain the credit achieved

        testStateSeq2Sels({
            state,
            selCredits,
            selLatestCredits,
            selAttemptNumbers,
            selIds,
            docCredits,
            docLatestCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            spy,
        });

        // get new high score of score of 0.8 in second doc
        docStates[1] = "DoenetML state 2.3";
        docLatestCredits[1] = docCredits[1] = 0.8;
        selLatestCredits[1] = selCredits[1] = 0.8;
        state = activityStateReducer(state, {
            type: "updateSingleState",
            id: docIds[1],
            doenetState: docStates[1],
            creditAchieved: docLatestCredits[1],
            allowSaveState: true,
            baseId: "newId",
        });

        testStateSeq2Sels({
            state,
            selCredits,
            selLatestCredits,
            selAttemptNumbers,
            selIds,
            docCredits,
            docLatestCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            spy,
        });

        // decrease score to 0.2 on second doc
        docStates[1] = "DoenetML state 2.4";
        docLatestCredits[1] = 0.2;
        selLatestCredits[1] = 0.2;
        state = activityStateReducer(state, {
            type: "updateSingleState",
            id: docIds[1],
            doenetState: docStates[1],
            creditAchieved: docLatestCredits[1],
            allowSaveState: true,
            baseId: "newId",
        });

        testStateSeq2Sels({
            state,
            selCredits,
            selLatestCredits,
            selAttemptNumbers,
            selIds,
            docCredits,
            docLatestCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            spy,
        });

        // Generate new attempt the first select
        state = activityStateReducer(state, {
            type: "generateNewActivityAttempt",
            id: selIds[0],
            numActivityVariants,
            initialQuestionCounter: 0,
            questionCounts: {},
            allowSaveState: true,
            baseId: "newId",
        });

        if (state.type !== "sequence") {
            throw Error("Shouldn't happen");
        }

        selectAttempts[0]++;

        // determine the identity of the second document
        docIds[0] = (
            state.orderedChildren[0] as SelectState
        ).selectedChildren[0].id;
        docAttemptNumbers[docIds[0]] = (docAttemptNumbers[docIds[0]] ?? 0) + 1;

        selAttemptNumbers[0]++;
        selLatestCredits[0] = 0; // don't change selCredit[0], as the credit achieved is remembered
        docStates[0] = null;
        docLatestCredits[0] = 0;
        docCredits[0] = 0; // document doesn't retain the credit achieved

        testStateSeq2Sels({
            state,
            selCredits,
            selLatestCredits,
            selAttemptNumbers,
            selIds,
            docCredits,
            docLatestCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            spy,
        });

        // get score of 0.3 on first doc
        docStates[0] = "DoenetML state 1.2";
        docLatestCredits[0] = docCredits[0] = 0.3;
        selLatestCredits[0] = 0.3;
        state = activityStateReducer(state, {
            type: "updateSingleState",
            id: docIds[0],
            doenetState: docStates[0],
            creditAchieved: docLatestCredits[0],
            allowSaveState: true,
            baseId: "newId",
        });

        testStateSeq2Sels({
            state,
            selCredits,
            selLatestCredits,
            selAttemptNumbers,
            selIds,
            docCredits,
            docLatestCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            spy,
        });
    });

    function testStateSelMult2Docs({
        state,
        docCredits,
        docLatestCredits,
        docAttemptNumbers,
        docStates,
        docIds,
        attemptNumber,
        spy,
    }: {
        state: ActivityState;
        docCredits: number[];
        docLatestCredits: number[];
        docAttemptNumbers: Record<string, number>;
        docStates: (string | null)[];
        docIds: string[];
        attemptNumber: number;
        spy: MockInstance;
    }) {
        if (state.type !== "select") {
            throw Error("Shouldn't happen");
        }

        const credit = state.creditAchieved;
        expect(credit).closeTo(
            docCredits.reduce((a, c) => a + c, 0) / 2,
            1e-12,
        );
        const latestCredit = state.latestCreditAchieved;
        expect(latestCredit).closeTo(
            docLatestCredits.reduce((a, c) => a + c, 0) / 2,
            1e-12,
        );

        expect(state.attemptNumber).eq(attemptNumber);

        for (let i = 0; i < 2; i++) {
            const docState = state.selectedChildren[i];
            if (docState.type !== "singleDoc") {
                throw Error("Shouldn't happen");
            }
            expect(docState.id).eq(docIds[i]);
            expect(docState.creditAchieved).eq(docCredits[i]);
            expect(docState.latestCreditAchieved).eq(docLatestCredits[i]);
            expect(docState.attemptNumber).eq(docAttemptNumbers[docIds[i]]);
            expect(docState.doenetState).eq(docStates[i]);
        }

        expect(spy.mock.lastCall).toMatchObject([
            {
                subject: "SPLICE.reportScoreAndState",
                score: credit,
                latestScore: latestCredit,
                scoreByItem: [
                    {
                        id: docIds[0],
                        score: docCredits[0],
                        latestScore: docLatestCredits[0],
                        docId: docIds[0],
                    },
                    {
                        id: docIds[1],
                        score: docCredits[1],
                        latestScore: docLatestCredits[1],
                        docId: docIds[1],
                    },
                ],
                state: {
                    state: pruneActivityStateForSave(state),
                },
                activityId: "newId",
            },
        ]);
    }

    it("update single state, select multiple from 2 docs, new attempts for docs", () => {
        vi.stubGlobal("window", {
            postMessage: vi.fn(() => null),
        });
        const spy = vi.spyOn(window, "postMessage");

        const source = selMult2docs as SelectSource;

        const { numActivityVariants } = gatherDocumentStructure(source);

        const state0 = initializeActivityState({
            source: source,
            variant: 5,
            parentId: null,
            numActivityVariants,
        });

        let state = activityStateReducer(state0, {
            type: "generateNewActivityAttempt",
            numActivityVariants,
            initialQuestionCounter: 0,
            questionCounts: {},
            allowSaveState: false,
            baseId: "newId",
        });

        if (state.type !== "select") {
            throw Error("Shouldn't happen");
        }

        // determine the selected documents
        const docIds = state.selectedChildren.map((c) => c.id);

        const docAttemptNumbers = { [docIds[0]]: 1, [docIds[1]]: 1 };
        const docCredits = [0, 0];
        const docLatestCredits = [0, 0];
        const docStates: (string | null)[] = [null, null];
        const attemptNumber = 1;

        // Get score of 0.4 in first doc
        docStates[0] = "DoenetML state 1.1";
        docLatestCredits[0] = docCredits[0] = 0.4;
        state = activityStateReducer(state, {
            type: "updateSingleState",
            id: docIds[0],
            doenetState: docStates[0],
            creditAchieved: docLatestCredits[0],
            allowSaveState: true,
            baseId: "newId",
        });

        testStateSelMult2Docs({
            state,
            docCredits,
            docLatestCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            spy,
        });

        // Get score of 0.6 in second doc
        docStates[1] = "DoenetML state 2.1";
        docLatestCredits[1] = docCredits[1] = 0.6;
        state = activityStateReducer(state, {
            type: "updateSingleState",
            id: docIds[1],
            doenetState: docStates[1],
            creditAchieved: docLatestCredits[1],
            allowSaveState: true,
            baseId: "newId",
        });

        testStateSelMult2Docs({
            state,
            docCredits,
            docLatestCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            spy,
        });

        // Decrease score to 0.2 in second doc
        docStates[1] = "DoenetML state 2.2";
        docLatestCredits[1] = 0.2;
        state = activityStateReducer(state, {
            type: "updateSingleState",
            id: docIds[1],
            doenetState: docStates[1],
            creditAchieved: docLatestCredits[1],
            allowSaveState: true,
            baseId: "newId",
        });

        testStateSelMult2Docs({
            state,
            docCredits,
            docLatestCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            spy,
        });

        // Generate new attempt the second document
        state = activityStateReducer(state, {
            type: "generateNewActivityAttempt",
            id: docIds[1],
            numActivityVariants,
            initialQuestionCounter: 0,
            questionCounts: {},
            allowSaveState: true,
            baseId: "newId",
        });

        if (state.type !== "select") {
            throw Error("Shouldn't happen");
        }

        // determine the identity of the second document
        docIds[1] = state.selectedChildren[1].id;
        docAttemptNumbers[docIds[1]] = (docAttemptNumbers[docIds[1]] ?? 0) + 1;

        docStates[1] = null;
        docLatestCredits[1] = 0; // don't change docCredits[1], as the credit achieved is remembered

        testStateSelMult2Docs({
            state,
            docCredits,
            docLatestCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            spy,
        });

        // get new high score of score of 0.8 in second doc
        docStates[1] = "DoenetML state 2.3";
        docLatestCredits[1] = docCredits[1] = 0.8;
        state = activityStateReducer(state, {
            type: "updateSingleState",
            id: docIds[1],
            doenetState: docStates[1],
            creditAchieved: docLatestCredits[1],
            allowSaveState: true,
            baseId: "newId",
        });

        testStateSelMult2Docs({
            state,
            docCredits,
            docLatestCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            spy,
        });

        // decrease score to 0.2 on second doc
        docStates[1] = "DoenetML state 2.4";
        docLatestCredits[1] = 0.2;
        state = activityStateReducer(state, {
            type: "updateSingleState",
            id: docIds[1],
            doenetState: docStates[1],
            creditAchieved: docLatestCredits[1],
            allowSaveState: true,
            baseId: "newId",
        });

        testStateSelMult2Docs({
            state,
            docCredits,
            docLatestCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            spy,
        });

        // Generate new attempt the first document
        state = activityStateReducer(state, {
            type: "generateNewActivityAttempt",
            id: docIds[0],
            numActivityVariants,
            initialQuestionCounter: 0,
            questionCounts: {},
            allowSaveState: true,
            baseId: "newId",
        });

        if (state.type !== "select") {
            throw Error("Shouldn't happen");
        }

        // determine the identity of the second document
        docIds[0] = state.selectedChildren[0].id;
        docAttemptNumbers[docIds[0]] = (docAttemptNumbers[docIds[0]] ?? 0) + 1;

        docStates[0] = null;
        docLatestCredits[0] = 0; // don't change docCredits[0], as the credit achieved is remembered

        testStateSelMult2Docs({
            state,
            docCredits,
            docLatestCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            spy,
        });

        // get score of 0.3 on first doc
        docStates[0] = "DoenetML state 1.2";
        docLatestCredits[0] = 0.3;
        state = activityStateReducer(state, {
            type: "updateSingleState",
            id: docIds[0],
            doenetState: docStates[0],
            creditAchieved: docLatestCredits[0],
            allowSaveState: true,
            baseId: "newId",
        });

        testStateSelMult2Docs({
            state,
            docCredits,
            docLatestCredits,
            docAttemptNumbers,
            docStates,
            docIds,
            attemptNumber,
            spy,
        });
    });
});
