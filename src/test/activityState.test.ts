import { describe, expect, it } from "vitest";
import {
    ActivitySource,
    addSourceToActivityState,
    calcNumVariants,
    calcNumVariantsFromState,
    gatherDocumentStructure,
    generateNewActivityAttempt,
    getItemSequence,
    initializeActivityState,
    pruneActivityStateForSave,
    validateIds,
} from "../Activity/activityState";
import seq2sel from "./testSources/seq2sel.json";
import duplicateId from "./testSources/duplicateId.json";
import invalidId from "./testSources/invalidId.json";
import selMult2docs from "./testSources/selMult2docs.json";
import selMult1doc from "./testSources/selMult1doc.json";
import selMult1docNoVariant from "./testSources/selMult1docNoVariant.json";
import sel0 from "./testSources/sel0.json";
import seq0 from "./testSources/seq0.json";
import seq2Sel0 from "./testSources/seq2Sel0.json";
import seqSel0Sel from "./testSources/seqSel0Sel.json";

import { SelectSource, SelectState } from "../Activity/selectState";
import { SequenceSource, SequenceState } from "../Activity/sequenceState";

describe("Activity state tests", () => {
    it("prune and add source back to uninitialized state", () => {
        const source = seq2sel as SequenceSource;

        const { numActivityVariants } = gatherDocumentStructure(source);

        console.log({ numActivityVariants });

        const state = initializeActivityState({
            source,
            variant: 1,
            parentId: null,
            numActivityVariants,
        }) as SelectState;

        const expectedState = {
            type: "sequence",
            id: "seq",
            parentId: null,
            source: source,
            initialVariant: 1,
            creditAchieved: 0,
            attempts: [],
            latestChildStates: [
                {
                    type: "select",
                    id: "sel1",
                    parentId: "seq",
                    source: source.items[0],
                    creditAchieved: 0,
                    attempts: [],
                    latestChildStates: [
                        {
                            type: "singleDoc",
                            id: "doc4",
                            parentId: "sel1",
                            source: (source.items[0] as SelectSource).items[0],
                            creditAchieved: 0,
                            attempts: [],
                        },
                        {
                            type: "singleDoc",
                            id: "doc5",
                            parentId: "sel1",
                            source: (source.items[0] as SelectSource).items[1],
                            creditAchieved: 0,
                            attempts: [],
                        },
                    ],
                },
                {
                    type: "select",
                    id: "sel2",
                    parentId: "seq",
                    source: source.items[1],
                    creditAchieved: 0,
                    attempts: [],
                    latestChildStates: [
                        {
                            type: "singleDoc",
                            id: "doc3",
                            parentId: "sel2",
                            source: (source.items[1] as SelectSource).items[0],
                            creditAchieved: 0,
                            attempts: [],
                        },
                        {
                            type: "singleDoc",
                            id: "doc2",
                            parentId: "sel2",
                            source: (source.items[1] as SelectSource).items[1],
                            creditAchieved: 0,
                            attempts: [],
                        },
                        {
                            type: "singleDoc",
                            id: "doc1",
                            parentId: "sel2",
                            source: (source.items[1] as SelectSource).items[2],
                            creditAchieved: 0,
                            attempts: [],
                        },
                    ],
                },
            ],
        };

        expect(state).toMatchObject(expectedState);

        const prunedState = pruneActivityStateForSave(state);

        const expectedPrunedState = {
            type: "sequence",
            id: "seq",
            parentId: null,
            initialVariant: 1,
            creditAchieved: 0,
            attempts: [],
            latestChildStates: [
                {
                    type: "select",
                    id: "sel1",
                    parentId: "seq",
                    creditAchieved: 0,
                    attempts: [],
                    latestChildStates: [
                        {
                            type: "singleDoc",
                            id: "doc4",
                            parentId: "sel1",
                            creditAchieved: 0,
                            attempts: [],
                        },
                        {
                            type: "singleDoc",
                            id: "doc5",
                            parentId: "sel1",
                            creditAchieved: 0,
                            attempts: [],
                        },
                    ],
                },
                {
                    type: "select",
                    id: "sel2",
                    parentId: "seq",
                    creditAchieved: 0,
                    attempts: [],
                    latestChildStates: [
                        {
                            type: "singleDoc",
                            id: "doc3",
                            parentId: "sel2",
                            creditAchieved: 0,
                            attempts: [],
                        },
                        {
                            type: "singleDoc",
                            id: "doc2",
                            parentId: "sel2",
                            creditAchieved: 0,
                            attempts: [],
                        },
                        {
                            type: "singleDoc",
                            id: "doc1",
                            parentId: "sel2",
                            creditAchieved: 0,
                            attempts: [],
                        },
                    ],
                },
            ],
        };

        expect(prunedState).not.toMatchObject(expectedState);
        expect(prunedState).toMatchObject(expectedPrunedState);

        if (prunedState.type !== "sequence") {
            throw Error("nope");
        }

        expect("source" in prunedState).eq(false);
        for (const child of prunedState.latestChildStates) {
            if (child.type !== "select") {
                throw Error("nope");
            }
            expect("source" in child).eq(false);
            for (const grandChild of child.latestChildStates) {
                expect("source" in grandChild).eq(false);
            }
        }

        const stateWithAddedSource = addSourceToActivityState(
            prunedState,
            source,
        );

        expect(stateWithAddedSource).toMatchObject(expectedState);
    });

    it("initialize state of select-multiple selects", () => {
        // with a select that has numToSelect > 1,
        // initializeActivityState breaks up its children into slices that have just 1 one variant

        const source = selMult1doc as SelectSource;
        const docSource = source.items[0];

        const { numActivityVariants } = gatherDocumentStructure(source);

        const state = initializeActivityState({
            source,
            variant: 1,
            parentId: null,
            numActivityVariants,
        }) as SelectState;

        const docVariant = state.latestChildStates[0].initialVariant;

        const expectedState = {
            type: "select",
            id: "sel",
            parentId: null,
            source,
            initialVariant: 1,
            creditAchieved: 0,
            latestChildStates: [
                {
                    type: "singleDoc",
                    id: "doc4|1",
                    parentId: "sel",
                    source: docSource,
                    initialVariant: docVariant,
                    creditAchieved: 0,
                    attempts: [],
                    restrictToVariantSlice: { idx: 1, numSlices: 4 },
                },
                {
                    type: "singleDoc",
                    id: "doc4|2",
                    parentId: "sel",
                    source: docSource,
                    initialVariant: docVariant,
                    creditAchieved: 0,
                    attempts: [],
                    restrictToVariantSlice: { idx: 2, numSlices: 4 },
                },
                {
                    type: "singleDoc",
                    id: "doc4|3",
                    parentId: "sel",
                    source: docSource,
                    initialVariant: docVariant,
                    creditAchieved: 0,
                    attempts: [],
                    restrictToVariantSlice: { idx: 3, numSlices: 4 },
                },
                {
                    type: "singleDoc",
                    id: "doc4|4",
                    parentId: "sel",
                    source: docSource,
                    initialVariant: docVariant,
                    creditAchieved: 0,
                    attempts: [],
                    restrictToVariantSlice: { idx: 4, numSlices: 4 },
                },
            ],
            attempts: [],
            restrictToVariantSlice: undefined,
        };

        expect(state).eqls(expectedState);
    });

    it("validate source ids", () => {
        expect(validateIds(seq2sel as ActivitySource)).eqls([
            "seq",
            "sel1",
            "doc4",
            "doc5",
            "sel2",
            "doc3",
            "doc2",
            "doc1",
        ]);

        expect(() => validateIds(duplicateId as ActivitySource)).toThrowError(
            "Duplicate ids",
        );
        expect(() => validateIds(invalidId as ActivitySource)).toThrowError(
            'contains a "|"',
        );
    });

    it("calc num variants", () => {
        const source = seq2sel as SequenceSource;

        const { numActivityVariants } = gatherDocumentStructure(source);

        const numVarSel1 = numActivityVariants.doc4 + numActivityVariants.doc5;
        const numVarSel2 =
            numActivityVariants.doc3 +
            numActivityVariants.doc2 +
            numActivityVariants.doc1;
        const numVarSeq = Math.min(numVarSel1, numVarSel2);

        expect(calcNumVariants(source.items[0], numActivityVariants)).eq(
            numVarSel1,
        );
        expect(calcNumVariants(source.items[1], numActivityVariants)).eq(
            numVarSel2,
        );
        expect(calcNumVariants(source, numActivityVariants)).eq(numVarSeq);

        const source2 = selMult2docs as SelectSource;

        expect(calcNumVariants(source2, numActivityVariants)).eq(
            Math.floor(numVarSel1 / 2),
        );

        const source3 = selMult1doc as SelectSource;

        expect(calcNumVariants(source3, numActivityVariants)).eq(
            Math.floor(numActivityVariants.doc4 / 3),
        );
    });

    it("calc num variants from state", () => {
        const source = seq2sel as SequenceSource;
        let { numActivityVariants } = gatherDocumentStructure(source);

        const numVarSel1 = numActivityVariants.doc4 + numActivityVariants.doc5;
        const numVarSel2 =
            numActivityVariants.doc3 +
            numActivityVariants.doc2 +
            numActivityVariants.doc1;
        const numVarSeq = Math.min(numVarSel1, numVarSel2);

        const state = initializeActivityState({
            source,
            variant: 1,
            parentId: null,
            numActivityVariants,
        }) as SequenceState;

        expect(
            calcNumVariantsFromState(
                state.latestChildStates[0],
                numActivityVariants,
            ),
        ).eq(numVarSel1);
        expect(
            calcNumVariantsFromState(
                state.latestChildStates[1],
                numActivityVariants,
            ),
        ).eq(numVarSel2);
        expect(calcNumVariantsFromState(state, numActivityVariants)).eq(
            numVarSeq,
        );

        const source2 = selMult2docs as SelectSource;
        ({ numActivityVariants } = gatherDocumentStructure(source2));

        const state2 = initializeActivityState({
            source: source2,
            variant: 1,
            parentId: null,
            numActivityVariants,
        }) as SelectState;

        expect(calcNumVariantsFromState(state2, numActivityVariants)).eq(
            Math.floor(numVarSel1 / 2),
        );

        // since had a select multiple, created separate children for each variant,
        // each restricted to a slice that contains one variant
        for (let i = 0; i < numVarSel1; i++) {
            expect(
                calcNumVariantsFromState(
                    state2.latestChildStates[i],
                    numActivityVariants,
                ),
            ).eq(1);
        }

        const source3 = selMult1doc as SelectSource;
        const state3 = initializeActivityState({
            source: source3,
            variant: 1,
            parentId: null,
            numActivityVariants,
        }) as SelectState;

        expect(calcNumVariantsFromState(state3, numActivityVariants)).eq(
            Math.floor(numActivityVariants.doc4 / 3),
        );

        // since had a select multiple, created separate children for each variant,
        // each restricted to a slice that contains one variant
        for (let i = 0; i < numActivityVariants.doc4; i++) {
            expect(
                calcNumVariantsFromState(
                    state3.latestChildStates[i],
                    numActivityVariants,
                ),
            ).eq(1);
        }
    });

    it("get item sequence", () => {
        const source = seq2sel as SequenceSource;
        const { numActivityVariants, questionCounts } =
            gatherDocumentStructure(source);

        const initialState = initializeActivityState({
            source,
            variant: 1,
            parentId: null,
            numActivityVariants,
        }) as SequenceState;

        const { state: newState } = generateNewActivityAttempt({
            state: initialState,
            numActivityVariants,
            initialQuestionCounter: 1,
            questionCounts,
            parentAttempt: 1,
        });

        const state = newState as SequenceState;

        const firstSelectState = state.latestChildStates[0] as SelectState;
        const secondSelectState = state.latestChildStates[1] as SelectState;

        const docFromFirstSelect =
            firstSelectState.attempts[0].activities[0].id;
        expect(["doc4", "doc5"].includes(docFromFirstSelect)).eq(true);
        const docFromSecondSelect =
            secondSelectState.attempts[0].activities[0].id;
        expect(["doc3", "doc2", "doc1"].includes(docFromSecondSelect)).eq(true);

        if (state.attempts[0].activities[0].id === firstSelectState.id) {
            expect(getItemSequence(state)).eqls([
                docFromFirstSelect,
                docFromSecondSelect,
            ]);
        } else {
            expect(getItemSequence(state)).eqls([
                docFromSecondSelect,
                docFromFirstSelect,
            ]);
        }
    });

    it("get item sequence, select from 0", () => {
        const source = sel0 as SelectSource;
        const { numActivityVariants, questionCounts } =
            gatherDocumentStructure(source);

        const initialState = initializeActivityState({
            source,
            variant: 1,
            parentId: null,
            numActivityVariants,
        }) as SelectState;

        const { state } = generateNewActivityAttempt({
            state: initialState,
            numActivityVariants,
            initialQuestionCounter: 1,
            questionCounts,
            parentAttempt: 1,
        });

        expect(getItemSequence(state)).eqls([]);
    });

    it("get item sequence, sequence of 0", () => {
        const source = seq0 as SequenceSource;
        const { numActivityVariants, questionCounts } =
            gatherDocumentStructure(source);

        const initialState = initializeActivityState({
            source,
            variant: 1,
            parentId: null,
            numActivityVariants,
        }) as SequenceState;

        const { state } = generateNewActivityAttempt({
            state: initialState,
            numActivityVariants,
            initialQuestionCounter: 1,
            questionCounts,
            parentAttempt: 1,
        });

        expect(getItemSequence(state)).eqls([]);
    });

    it("get item sequence, sequence of two selects from 0", () => {
        const source = seq2Sel0 as SequenceSource;
        const { numActivityVariants, questionCounts } =
            gatherDocumentStructure(source);

        const initialState = initializeActivityState({
            source,
            variant: 1,
            parentId: null,
            numActivityVariants,
        }) as SequenceState;

        const { state } = generateNewActivityAttempt({
            state: initialState,
            numActivityVariants,
            initialQuestionCounter: 1,
            questionCounts,
            parentAttempt: 1,
        });

        expect(getItemSequence(state)).eqls([]);
    });

    it("get item sequence, sequence of select from 0 and select", () => {
        const source = seqSel0Sel as SequenceSource;
        const { numActivityVariants, questionCounts } =
            gatherDocumentStructure(source);

        const initialState = initializeActivityState({
            source,
            variant: 1,
            parentId: null,
            numActivityVariants,
        }) as SequenceState;

        const { state: newState } = generateNewActivityAttempt({
            state: initialState,
            numActivityVariants,
            initialQuestionCounter: 1,
            questionCounts,
            parentAttempt: 1,
        });

        const state = newState as SequenceState;

        const secondSelectState = state.latestChildStates[1] as SelectState;

        const docFromSecondSelect =
            secondSelectState.attempts[0].activities[0].id;
        expect(["doc3", "doc2", "doc1"].includes(docFromSecondSelect)).eq(true);

        expect(getItemSequence(state)).eqls([docFromSecondSelect]);
    });

    it("error when select multiple from a single doc with selectByVariant=false", () => {
        const source = selMult1docNoVariant as SelectSource;
        const { numActivityVariants, questionCounts } =
            gatherDocumentStructure(source);

        const initialState = initializeActivityState({
            source,
            variant: 1,
            parentId: null,
            numActivityVariants,
        }) as SelectState;

        expect(() =>
            generateNewActivityAttempt({
                state: initialState,
                numActivityVariants,
                initialQuestionCounter: 1,
                questionCounts,
                parentAttempt: 1,
            }),
        ).toThrowError("larger than the number of available activities");
    });
});
