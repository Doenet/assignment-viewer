import {
    addSourceToSingleDocState,
    extractSingleDocItemCredit,
    generateNewSingleDocAttempt,
    initializeSingleDocState,
    isSingleDocSource,
    isSingleDocState,
    isSingleDocStateNoSource,
    pruneSingleDocStateForSave,
    SingleDocSource,
    SingleDocState,
    SingleDocStateNoSource,
} from "./singleDocState";
import {
    addSourceToSelectState,
    calcNumVariantsSelect,
    extractSelectItemCredit,
    generateNewSelectAttempt,
    initializeSelectState,
    isSelectSource,
    isSelectState,
    isSelectStateNoSource,
    pruneSelectStateForSave,
    SelectSource,
    SelectState,
    SelectStateNoSource,
} from "./selectState";
import {
    addSourceToSequenceState,
    calcNumVariantsSequence,
    extractSequenceItemCredit,
    generateNewSequenceAttempt,
    initializeSequenceState,
    isSequenceSource,
    isSequenceState,
    isSequenceStateNoSource,
    pruneSequenceStateForSave,
    SequenceSource,
    SequenceState,
    SequenceStateNoSource,
} from "./sequenceState";

export type ActivitySource = SingleDocSource | SelectSource | SequenceSource;

export type ActivityState = SingleDocState | SelectState | SequenceState;

export type ActivityStateNoSource =
    | SingleDocStateNoSource
    | SelectStateNoSource
    | SequenceStateNoSource;

export function isActivitySource(obj: unknown): obj is ActivitySource {
    return (
        isSingleDocSource(obj) || isSelectSource(obj) || isSequenceSource(obj)
    );
}

export function isActivityState(obj: unknown): obj is ActivityState {
    return isSingleDocState(obj) || isSelectState(obj) || isSequenceState(obj);
}
export function isActivityStateNoSource(
    obj: unknown,
): obj is ActivityStateNoSource {
    return (
        isSingleDocStateNoSource(obj) ||
        isSelectStateNoSource(obj) ||
        isSequenceStateNoSource(obj)
    );
}

export function initializeActivityState({
    source,
    variant,
    parentId,
    numActivityVariants,
    restrictToVariantSlice,
}: {
    source: ActivitySource;
    variant: number;
    parentId: string | null;
    numActivityVariants: Record<string, number>;
    restrictToVariantSlice?: { idx: number; numSlices: number };
}): ActivityState {
    switch (source.type) {
        case "singleDoc": {
            return initializeSingleDocState({
                source,
                variant,
                parentId,
                restrictToVariantSlice,
            });
        }
        case "select": {
            return initializeSelectState({
                source,
                variant,
                parentId,
                numActivityVariants,
                restrictToVariantSlice,
            });
        }
        case "sequence": {
            return initializeSequenceState({
                source,
                variant,
                parentId,
                numActivityVariants,
                restrictToVariantSlice,
            });
        }
    }

    throw Error("Invalid activity type");
}

/**
 * Generate a new attempt for the specified activity, recursing to child activities.
 *
 * @returns
 * - state: the new activity state
 * - finalQuestionCounter: the question counter to be given as an `initialQuestionCounter` for the next activity
 */
export function generateNewActivityAttempt({
    state,
    numActivityVariants,
    initialQuestionCounter,
    questionCounts,
    resetCredit = false,
    resetAttempts = false,
}: {
    state: ActivityState;
    numActivityVariants: Record<string, number>;
    initialQuestionCounter: number;
    questionCounts: Record<string, number>;
    resetCredit?: boolean;
    resetAttempts?: boolean;
}): { finalQuestionCounter: number; state: ActivityState } {
    switch (state.type) {
        case "singleDoc": {
            return generateNewSingleDocAttempt({
                state,
                numActivityVariants,
                initialQuestionCounter,
                questionCounts,
                resetCredit,
                resetAttempts,
            });
        }
        case "select": {
            return generateNewSelectAttempt({
                state,
                numActivityVariants,
                initialQuestionCounter,
                questionCounts,
                resetCredit,
                resetAttempts,
            });
        }
        case "sequence": {
            return generateNewSequenceAttempt({
                state,
                numActivityVariants,
                initialQuestionCounter,
                questionCounts,
                resetCredit,
                resetAttempts,
            });
        }
    }

    throw Error("Invalid activity type");
}

export function extractActivityItemCredit(
    activityState: ActivityState,
): { id: string; score: number }[] {
    switch (activityState.type) {
        case "singleDoc": {
            return extractSingleDocItemCredit(activityState);
        }
        case "select": {
            return extractSelectItemCredit(activityState);
        }
        case "sequence": {
            return extractSequenceItemCredit(activityState);
        }
    }
}

export function pruneActivityStateForSave(
    activityState: ActivityState,
    clearDoenetState: boolean,
): ActivityStateNoSource {
    switch (activityState.type) {
        case "singleDoc": {
            return pruneSingleDocStateForSave(activityState, clearDoenetState);
        }
        case "select": {
            return pruneSelectStateForSave(activityState, clearDoenetState);
        }
        case "sequence": {
            return pruneSequenceStateForSave(activityState, clearDoenetState);
        }
    }
}

export function addSourceToActivityState(
    activityState: ActivityStateNoSource,
    source: ActivitySource,
): ActivityState {
    switch (activityState.type) {
        case "singleDoc": {
            if (isSingleDocSource(source)) {
                return addSourceToSingleDocState(activityState, source);
            } else {
                throw Error("Source didn't match state");
            }
        }
        case "select": {
            if (isSelectSource(source)) {
                return addSourceToSelectState(activityState, source);
            } else {
                throw Error("Source didn't make state");
            }
        }
        case "sequence": {
            if (isSequenceSource(source)) {
                return addSourceToSequenceState(activityState, source);
            } else {
                throw Error("Source didn't match state");
            }
        }
    }
}

export function extractSourceId(compositeId: string): string {
    return compositeId.split("|")[0];
}

export function getItemSequence(state: ActivityState): string[] {
    if (state.type === "singleDoc") {
        return [state.id];
    } else {
        const numAttempts = state.attempts.length;
        if (numAttempts === 0) {
            return [state.id];
        }
        return state.attempts[numAttempts - 1].activities.flatMap((a) =>
            getItemSequence(a),
        );
    }
}

export function calcNumVariants(
    source: ActivitySource,
    numActivityVariants: Record<string, number>,
): number {
    switch (source.type) {
        case "singleDoc": {
            // already have single doc's calculated
            return numActivityVariants[source.id];
        }
        case "select": {
            return calcNumVariantsSelect(source, numActivityVariants);
        }
        case "sequence": {
            return calcNumVariantsSequence(source, numActivityVariants);
        }
    }
}

export function calcNumVariantsFromState(
    state: ActivityState,
    numActivityVariants: Record<string, number>,
): number {
    let numVariants = calcNumVariants(state.source, numActivityVariants);

    if (state.restrictToVariantSlice) {
        numVariants = Math.ceil(
            numVariants / state.restrictToVariantSlice.numSlices,
        );
    }

    return numVariants;
}

export function getUninitializedActivityState(
    source: ActivitySource,
): ActivityState {
    switch (source.type) {
        case "singleDoc": {
            return {
                type: "singleDoc",
                id: source.id,
                parentId: null,
                source: source,
                initialVariant: 0,
                creditAchieved: 0,
                attempts: [],
            };
        }
        case "select": {
            return {
                type: "select",
                id: source.id,
                parentId: null,
                source: source,
                initialVariant: 0,
                creditAchieved: 0,
                attempts: [],
                latestChildStates: source.items.map(
                    getUninitializedActivityState,
                ),
            };
        }
        case "sequence": {
            return {
                type: "sequence",
                id: source.id,
                parentId: null,
                source: source,
                initialVariant: 0,
                creditAchieved: 0,
                attempts: [],
                latestChildStates: source.items.map(
                    getUninitializedActivityState,
                ),
            };
        }
    }
}
