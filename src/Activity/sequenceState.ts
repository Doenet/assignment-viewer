import {
    ActivitySource,
    ActivityState,
    ActivityStateNoSource,
    addSourceToActivityState,
    calcNumVariants,
    extractActivityItemCredit,
    extractSourceId,
    generateNewActivityAttempt,
    initializeActivityState,
    isActivitySource,
    isActivityState,
    isActivityStateNoSource,
    pruneActivityStateForSave,
} from "./activityState";

import seedrandom from "seedrandom";
import { SingleDocSource } from "./singleDocState";

const rngClass = seedrandom.alea;

export type SequenceSource = {
    type: "sequence";
    id: string;
    title?: string;
    items: ActivitySource[];
    shuffle: boolean;
    weights?: number[];
};

export type SequenceState = {
    type: "sequence";
    id: string;
    parentId: string | null;
    source: SequenceSource;
    initialVariant: number;
    creditAchieved: number;
    latestChildStates: ActivityState[];
    attempts: SequenceAttemptState[];
    restrictToVariantSlice?: { idx: number; numSlices: number };
};

export type SequenceAttemptState = {
    activities: ActivityState[];
    creditAchieved: number;
};

export type SequenceStateNoSource = Omit<
    SequenceState,
    "source" | "latestChildStates" | "attempts"
> & {
    latestChildStates: ActivityStateNoSource[];
    attempts: { activities: ActivityStateNoSource[]; creditAchieved: number }[];
};

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
        (typedObj.weights === undefined ||
            (Array.isArray(typedObj.weights) &&
                typedObj.weights.every((weight) => typeof weight === "number")))
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
        Array.isArray(typedObj.latestChildStates) &&
        typedObj.latestChildStates.every(isActivityState) &&
        Array.isArray(typedObj.attempts) &&
        typedObj.attempts.every(
            (attempt) =>
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                attempt !== null &&
                typeof attempt === "object" &&
                typeof attempt.creditAchieved === "number" &&
                Array.isArray(attempt.activities) &&
                attempt.activities.every(isActivityState),
        )
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
        Array.isArray(typedObj.latestChildStates) &&
        typedObj.latestChildStates.every(isActivityStateNoSource) &&
        Array.isArray(typedObj.attempts) &&
        typedObj.attempts.every(
            (attempt) =>
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                attempt !== null &&
                typeof attempt === "object" &&
                typeof attempt.creditAchieved === "number" &&
                Array.isArray(attempt.activities) &&
                attempt.activities.every(isActivityStateNoSource),
        )
    );
}

/**
 * Initialize activity state from `source` so that it is ready to generate attempts.
 *
 * Populates all the activities through the `latestChildStates` field,
 * similar to the behavior of `getUninitializedActivityState`,
 * only this time it takes advantage of `numActivityVariants`,
 * which stores of the number of variants calculated for each single doc activity.
 *
 * If the source contains any select-multiple selects, all the variants of each child activity
 * becomes a separate child in `latestChildStates`, where each child is restricted to one variant,
 * using the `restrictToVariantSlice` parameter when recursing.
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
    numActivityVariants: Record<string, number>;
    restrictToVariantSlice?: { idx: number; numSlices: number };
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
        latestChildStates: childStates,
        attempts: [],
        restrictToVariantSlice,
    };
}

export function generateNewSequenceAttempt({
    state,
    numActivityVariants,
    initialQuestionCounter,
    questionCounts,
    parentAttempt,
    resetCredit = false,
    resetAttempts = false,
}: {
    state: SequenceState;
    numActivityVariants: Record<string, number>;
    initialQuestionCounter: number;
    questionCounts: Record<string, number>;
    parentAttempt: number;
    resetCredit?: boolean;
    resetAttempts?: boolean;
}): { finalQuestionCounter: number; state: SequenceState } {
    const source = state.source;

    const childOrder = state.latestChildStates.map((state) => state.id);

    if (source.shuffle) {
        // Leave the descriptions in place and shuffle each group of activities between descriptions
        const rngSeed =
            state.initialVariant.toString() +
            "|" +
            state.id.toString() +
            "|" +
            state.attempts.length.toString() +
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
        while (startInd < state.latestChildStates.length) {
            // find the first item that isn't a description
            while (
                state.latestChildStates[startInd]?.type === "singleDoc" &&
                (state.latestChildStates[startInd].source as SingleDocSource)
                    .isDescription
            ) {
                startInd++;
            }
            if (startInd >= state.latestChildStates.length) {
                break;
            }

            // find the next item that is a description
            let numItems = 1;
            while (
                state.latestChildStates[startInd + numItems] &&
                (state.latestChildStates[startInd + numItems].type !==
                    "singleDoc" ||
                    !(
                        state.latestChildStates[startInd + numItems]
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
    const unorderedChildStates = [...state.latestChildStates];

    let questionCounter = initialQuestionCounter;
    for (const childId of childOrder) {
        const childIdx = state.latestChildStates.findIndex(
            (child) => child.id === childId,
        );
        const originalState = state.latestChildStates[childIdx];
        const { finalQuestionCounter: endCounter, state: newState } =
            generateNewActivityAttempt({
                state: originalState,
                numActivityVariants,
                initialQuestionCounter: questionCounter,
                questionCounts,
                parentAttempt: resetAttempts ? 1 : state.attempts.length + 1,
                // resetAttempts: true,
                resetCredit: true,
            });

        questionCounter = endCounter;
        orderedChildStates.push(newState);
        unorderedChildStates[childIdx] = newState;
    }

    const newAttemptState: SequenceAttemptState = {
        activities: orderedChildStates,
        creditAchieved: 0,
    };

    const newState: SequenceState = {
        ...state,
        latestChildStates: unorderedChildStates,
    };

    if (resetAttempts) {
        newState.attempts = [newAttemptState];
    } else {
        newState.attempts = [...newState.attempts, newAttemptState];
    }

    if (resetCredit) {
        newState.creditAchieved = 0;
    }

    return { finalQuestionCounter: questionCounter, state: newState };
}

export function extractSequenceItemCredit(
    activityState: SequenceState,
): { id: string; score: number }[] {
    if (activityState.attempts.length === 0) {
        return [{ id: activityState.id, score: 0 }];
    } else {
        const latestAttempt =
            activityState.attempts[activityState.attempts.length - 1];

        return latestAttempt.activities.flatMap((state) =>
            extractActivityItemCredit(state),
        );
    }
}

/**
 * Remove all references to source from `activityState`, forming an instance of `ActivityStateNoSource`
 * that is intended to be saved to a database.
 *
 * If `clearDoenetState` is `true`, then also remove the `doenetState` in single documents.
 *
 * Even if `clearDoenetState` is `false``, still clear `doenetState` on all but the latest attempt
 * and clear it on all `latestChildStates`. In this way, the (potentially large) DoenetML state is saved
 * only where needed to reconstitute the activity state.
 */
export function pruneSequenceStateForSave(
    activityState: SequenceState,
    clearDoenetState: boolean,
): SequenceStateNoSource {
    const { source: _source, ...newState } = { ...activityState };

    const latestChildStates = newState.latestChildStates.map((child) =>
        pruneActivityStateForSave(child, true),
    );

    const numAttempts = newState.attempts.length;

    const attempts = newState.attempts.map((attempt, i) => ({
        ...attempt,
        activities: attempt.activities.map((state) =>
            pruneActivityStateForSave(
                state,
                i !== numAttempts - 1 || clearDoenetState,
            ),
        ),
    }));

    return { ...newState, latestChildStates, attempts };
}

/** Reverse the effect of `pruneSequenceStateForSave by adding back adding back references to the source */
export function addSourceToSequenceState(
    activityState: SequenceStateNoSource,
    source: SequenceSource,
): SequenceState {
    const latestChildStates = activityState.latestChildStates.map((child) => {
        const idx = source.items.findIndex(
            (src) => src.id === extractSourceId(child.id),
        );
        return addSourceToActivityState(child, source.items[idx]);
    });

    const attempts = activityState.attempts.map((attempt) => ({
        ...attempt,
        activities: attempt.activities.map((state) => {
            const idx = source.items.findIndex(
                (src) => src.id === extractSourceId(state.id),
            );
            return addSourceToActivityState(state, source.items[idx]);
        }),
    }));

    return {
        ...activityState,
        source,
        latestChildStates,
        attempts,
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
    numActivityVariants: Record<string, number>,
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
