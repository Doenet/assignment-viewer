import {
    ActivitySource,
    ActivityState,
    ActivityStateNoSource,
    addSourceToActivityState,
    calcNumVariants,
    extractActivityItemCredit,
    extractSourceId,
    generateNewActivityAttempt,
    getNumItems,
    initializeActivityState,
    isActivitySource,
    isActivityState,
    isActivityStateNoSource,
    pruneActivityStateForSave,
} from "./activityState";
import seedrandom from "seedrandom";
import { SingleDocSource } from "./singleDocState";
import {
    ActivityVariantRecord,
    isRestrictToVariantSlice,
    QuestionCountRecord,
    RestrictToVariantSlice,
} from "../types";

const rngClass = seedrandom.alea;

/** The source for creating a sequence activity */
export type SequenceSource = {
    type: "sequence";
    id: string;
    title?: string;
    /** The child activities that form the sequence. */
    items: ActivitySource[];
    /** If `true`, randomly permute the item order on each new attempt. */
    shuffle: boolean;
    /**
     * Weights given to the credit achieved of each item
     * when averaging them to determine the credit achieved of the sequence activity.
     * Items missing a weight are given the weight 1.
     */
    creditWeights?: number[];
};

/** The current state of a sequence activity, including all attempts. */
export type SequenceState = {
    type: "sequence";
    id: string;
    parentId: string | null;
    source: SequenceSource;
    /** Used to seed the random number generate to yield the actual variants of each attempt. */
    initialVariant: number;
    /** Credit achieved (between 0 and 1) from the latest submission */
    creditAchieved: number;
    /** The maximum credit achieved over all submissions of this attempt of the activity */
    maxCreditAchieved: number;
    /** The state of child activities, in their original order */
    allChildren: ActivityState[];
    /** The number of the current attempt */
    attemptNumber: number;
    /** The activities as ordered for the current attempt */
    orderedChildren: ActivityState[];
    /** See {@link RestrictToVariantSlice} */
    restrictToVariantSlice?: RestrictToVariantSlice;
};

/**
 * The current state of a sequence activity, where references to the source have been eliminated.
 *
 * Useful for saving to a database, as this extraneously information has been removed.
 */
export type SequenceStateNoSource = Omit<
    SequenceState,
    "source" | "allChildren" | "orderedChildren"
> & {
    allChildren: ActivityStateNoSource[];
    orderedChildren: ActivityStateNoSource[];
};

// type guards

export function isSequenceSource(obj: unknown): obj is SequenceSource {
    const typedObj = obj as SequenceSource;
    return (
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        typedObj !== null &&
        typeof typedObj === "object" &&
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        typedObj.type === "sequence" &&
        typeof typedObj.id === "string" &&
        Array.isArray(typedObj.items) &&
        typedObj.items.every(isActivitySource) &&
        typeof typedObj.shuffle === "boolean" &&
        (typedObj.creditWeights === undefined ||
            (Array.isArray(typedObj.creditWeights) &&
                typedObj.creditWeights.every(
                    (weight) => typeof weight === "number",
                )))
    );
}

export function isSequenceState(obj: unknown): obj is SequenceState {
    const typedObj = obj as SequenceState;
    return (
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        typedObj !== null &&
        typeof typedObj === "object" &&
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        typedObj.type === "sequence" &&
        typeof typedObj.id === "string" &&
        (typedObj.parentId === null || typeof typedObj.parentId === "string") &&
        isSequenceSource(typedObj.source) &&
        typeof typedObj.initialVariant === "number" &&
        typeof typedObj.creditAchieved === "number" &&
        typeof typedObj.maxCreditAchieved === "number" &&
        Array.isArray(typedObj.allChildren) &&
        typedObj.allChildren.every(isActivityState) &&
        typeof typedObj.attemptNumber === "number" &&
        Array.isArray(typedObj.orderedChildren) &&
        typedObj.orderedChildren.every(isActivityState) &&
        (typedObj.restrictToVariantSlice === undefined ||
            isRestrictToVariantSlice(typedObj.restrictToVariantSlice))
    );
}

export function isSequenceStateNoSource(
    obj: unknown,
): obj is SequenceStateNoSource {
    const typedObj = obj as SequenceStateNoSource;
    return (
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        typedObj !== null &&
        typeof typedObj === "object" &&
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        typedObj.type === "sequence" &&
        typeof typedObj.id === "string" &&
        (typedObj.parentId === null || typeof typedObj.parentId === "string") &&
        typeof typedObj.initialVariant === "number" &&
        typeof typedObj.creditAchieved === "number" &&
        typeof typedObj.maxCreditAchieved === "number" &&
        Array.isArray(typedObj.allChildren) &&
        typedObj.allChildren.every(isActivityStateNoSource) &&
        typeof typedObj.attemptNumber === "number" &&
        Array.isArray(typedObj.orderedChildren) &&
        typedObj.orderedChildren.every(isActivityStateNoSource) &&
        (typedObj.restrictToVariantSlice === undefined ||
            isRestrictToVariantSlice(typedObj.restrictToVariantSlice))
    );
}

/**
 * Initialize activity state from `source` so that it is ready to generate attempts.
 *
 * Populates all the activities through the `allChildren` field,
 * similar to the behavior of `getUninitializedActivityState`,
 * only this time it takes advantage of `numActivityVariants`,
 * which stores of the number of variants calculated for each single doc activity.
 *
 * Using the provided `variant` to create a seed, an initial variant is randomly selected for each child.
 */
export function initializeSequenceState({
    source,
    variant,
    parentId,
    numActivityVariants,
    restrictToVariantSlice,
}: {
    source: SequenceSource;
    variant: number;
    parentId: string | null;
    numActivityVariants: ActivityVariantRecord;
    restrictToVariantSlice?: RestrictToVariantSlice;
}): SequenceState {
    const rngSeed = variant.toString() + "|" + source.id.toString();

    const rng = rngClass(rngSeed);

    const extendedId =
        source.id +
        (restrictToVariantSlice === undefined
            ? ""
            : "|" + restrictToVariantSlice.idx.toString());

    const childStates = source.items.map((activitySource) => {
        const childVariant = Math.floor(rng() * 1000000);

        return initializeActivityState({
            source: activitySource,
            variant: childVariant,
            parentId: extendedId,
            numActivityVariants,
            restrictToVariantSlice,
        });
    });

    return {
        type: "sequence",
        id: extendedId,
        parentId,
        source,
        initialVariant: variant,
        creditAchieved: 0,
        maxCreditAchieved: 0,
        allChildren: childStates,
        attemptNumber: 0,
        orderedChildren: [],
        restrictToVariantSlice,
    };
}

/**
 * Generate a new attempt for the base activity of `state`, recursing to child activities.
 *
 * Generate a new attempt for each child.  If `source.shuffle` is `true`, randomly permute the child order.
 *
 * See {@link generateNewActivityAttempt} for more information on the influence of parameters.
 *
 * @returns
 * - state: the new activity state
 * - finalQuestionCounter: the question counter to be given as an `initialQuestionCounter` for the next activity
 */
export function generateNewSequenceAttempt({
    state,
    numActivityVariants,
    initialQuestionCounter,
    questionCounts,
    parentAttempt,
}: {
    state: SequenceState;
    numActivityVariants: ActivityVariantRecord;
    initialQuestionCounter: number;
    questionCounts: QuestionCountRecord;
    parentAttempt: number;
}): { finalQuestionCounter: number; state: SequenceState } {
    const source = state.source;

    const childOrder = state.allChildren.map((state) => state.id);

    if (source.shuffle) {
        // Leave the descriptions in place and shuffle each group of activities between descriptions
        const rngSeed =
            state.initialVariant.toString() +
            "|" +
            state.id.toString() +
            "|" +
            state.attemptNumber.toString() +
            "|" +
            parentAttempt.toString();

        const rng = rngClass(rngSeed);

        // randomly shuffle `numItems` components of `arr` starting with `startInd`
        function shuffle_ids(
            arr: string[],
            startInd: number,
            numItems: number,
        ) {
            // https://stackoverflow.com/a/12646864
            for (let i = numItems - 1; i > 0; i--) {
                const j = Math.floor(rng() * (i + 1));
                [arr[startInd + i], arr[startInd + j]] = [
                    arr[startInd + j],
                    arr[startInd + i],
                ];
            }
        }

        let startInd = 0;
        while (startInd < state.allChildren.length) {
            // find the first item that isn't a description
            while (
                state.allChildren[startInd]?.type === "singleDoc" &&
                (state.allChildren[startInd].source as SingleDocSource)
                    .isDescription
            ) {
                startInd++;
            }
            if (startInd >= state.allChildren.length) {
                break;
            }

            // find the next item that is a description
            let numItems = 1;
            while (
                state.allChildren[startInd + numItems] &&
                (state.allChildren[startInd + numItems].type !== "singleDoc" ||
                    !(
                        state.allChildren[startInd + numItems]
                            .source as SingleDocSource
                    ).isDescription)
            ) {
                numItems++;
            }

            if (numItems > 1) {
                // shuffle the group of activities that were found between descriptions
                shuffle_ids(childOrder, startInd, numItems);
            }
            startInd += numItems;
        }
    }

    // generate new attempts of the children in the final order so that the counters will be sequential
    const orderedChildStates: ActivityState[] = [];
    const unorderedChildStates = [...state.allChildren];

    let questionCounter = initialQuestionCounter;
    for (const childId of childOrder) {
        const childIdx = state.allChildren.findIndex(
            (child) => child.id === childId,
        );
        const originalState = state.allChildren[childIdx];
        const { finalQuestionCounter: endCounter, state: newState } =
            generateNewActivityAttempt({
                state: originalState,
                numActivityVariants,
                initialQuestionCounter: questionCounter,
                questionCounts,
                parentAttempt: state.attemptNumber + 1,
            });

        questionCounter = endCounter;
        orderedChildStates.push(newState);
        unorderedChildStates[childIdx] = newState;
    }

    const newState: SequenceState = {
        ...state,
        creditAchieved: 0,
        maxCreditAchieved: 0,
        allChildren: unorderedChildStates,
        attemptNumber: state.attemptNumber + 1,
        orderedChildren: orderedChildStates,
    };

    return { finalQuestionCounter: questionCounter, state: newState };
}

/**
 * Recurse through the descendants of `activityState`,
 * returning an array of score information of the latest single document activities,
 * or of select activities that select a single document.
 */
export function extractSequenceItemCredit(
    activityState: SequenceState,
    nPrevInShuffleOrder = 0,
): {
    id: string;
    score: number;
    maxScore: number;
    docId?: string;
    shuffledOrder: number;
}[] {
    if (activityState.attemptNumber === 0) {
        return [
            {
                id: activityState.id,
                score: 0,
                maxScore: 0,
                shuffledOrder: nPrevInShuffleOrder + 1,
            },
        ];
    } else {
        let nPrev = nPrevInShuffleOrder;
        const inShuffledOrder = activityState.orderedChildren.map((state) => {
            const next = extractActivityItemCredit(state, nPrev);
            nPrev += next.length;
            return { childId: state.id, items: next };
        });

        const inOriginalOrder = activityState.allChildren.flatMap((state) => {
            const childResults = inShuffledOrder.find(
                (obj) => obj.childId === state.id,
            );
            if (!childResults) {
                throw Error("Unreachable");
            }
            return childResults.items;
        });

        return inOriginalOrder;
    }
}

/**
 * Remove all references to source from `activityState`, forming an instance of `ActivityStateNoSource`
 * that is intended to be saved to a database.
 *
 * If `clearDoenetState` is `true`, then also remove the `doenetState` in single documents.
 *
 * Even if `clearDoenetState` is `false``, still clear `doenetState` on all `allChildren`.
 * In this way, the (potentially large) DoenetML state is saved
 * only where needed to reconstitute the activity state.
 */
export function pruneSequenceStateForSave(
    activityState: SequenceState,
    clearDoenetState: boolean,
): SequenceStateNoSource {
    const { source: _source, ...newState } = { ...activityState };

    const allChildren = newState.allChildren.map((child) =>
        pruneActivityStateForSave(child, true),
    );

    const orderedChildren = newState.orderedChildren.map((child) =>
        pruneActivityStateForSave(child, clearDoenetState),
    );

    return { ...newState, allChildren, orderedChildren };
}

/** Reverse the effect of `pruneSequenceStateForSave by adding back adding back references to the source */
export function addSourceToSequenceState(
    activityState: SequenceStateNoSource,
    source: SequenceSource,
): SequenceState {
    const allChildren = activityState.allChildren.map((child) => {
        const idx = source.items.findIndex(
            (src) => src.id === extractSourceId(child.id),
        );
        return addSourceToActivityState(child, source.items[idx]);
    });

    const orderedChildren = activityState.orderedChildren.map((child) => {
        const idx = source.items.findIndex(
            (src) => src.id === extractSourceId(child.id),
        );
        return addSourceToActivityState(child, source.items[idx]);
    });

    return {
        ...activityState,
        source,
        allChildren,
        orderedChildren: orderedChildren,
    };
}

/**
 * Assuming that `numActivityVariants` contains the number of variants for all single doc activities,
 * calculate the number of unique variants of the the activity given by `source`.
 *
 * The activity could contain more variants than the returned value, but the value is
 * the number of unique variants that have no overlap with each other.
 */
export function calcNumVariantsSequence(
    source: SequenceSource,
    numActivityVariants: ActivityVariantRecord,
): number {
    // For the number of variants, we ignore any shuffling of items
    // and calculate the number of sequence variants that are completely unique,
    // i.e., the minimum number of variants over the items

    if (source.items.length === 0) {
        return 0;
    }

    let numVariants = Infinity;
    for (const item of source.items) {
        numVariants = Math.min(
            numVariants,
            calcNumVariants(item, numActivityVariants),
        );
    }

    return numVariants;
}

/**
 * Return the number of documents that will be rendered by this sequence.
 */
export function getNumItemsInSequence(source: SequenceSource): number {
    const numDocumentsForEachItem = source.items.map(getNumItems);

    const totalNumDocuments = numDocumentsForEachItem.reduce(
        (a, c) => a + c,
        0,
    );

    return totalNumDocuments;
}
