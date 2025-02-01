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
    generateNewSingleDocAttemptForMultiSelect,
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
import hash from "object-hash";
import { ActivityVariantRecord, QuestionCountRecord } from "../types";

export type ActivitySource = SingleDocSource | SelectSource | SequenceSource;

export type ActivityState = SingleDocState | SelectState | SequenceState;

export type ActivityStateNoSource =
    | SingleDocStateNoSource
    | SelectStateNoSource
    | SequenceStateNoSource;

export type ExportedActivityState = {
    state: ActivityStateNoSource;
    sourceHash: string;
};

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
export function isExportedActivityState(
    obj: unknown,
): obj is ExportedActivityState {
    const typedObj = obj as ExportedActivityState;
    return (
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        typedObj !== null &&
        typeof typedObj === "object" &&
        isActivityStateNoSource(typedObj.state) &&
        typeof typedObj.sourceHash === "string"
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
 * Using the provided `variant` to create a seed, an initial variant is randomly selected for each activity.
 */
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
    numActivityVariants: ActivityVariantRecord;
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
 * The counters for `initialQuestionCounter` specifies the
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
    parentAttempt,
    resetCredit = false,
}: {
    state: ActivityState;
    numActivityVariants: ActivityVariantRecord;
    initialQuestionCounter: number;
    questionCounts: QuestionCountRecord;
    parentAttempt: number;
    resetCredit?: boolean;
}): { finalQuestionCounter: number; state: ActivityState } {
    switch (state.type) {
        case "singleDoc": {
            return generateNewSingleDocAttempt({
                state,
                numActivityVariants,
                initialQuestionCounter,
                questionCounts,
                parentAttempt,
                resetCredit,
            });
        }
        case "select": {
            return generateNewSelectAttempt({
                state,
                numActivityVariants,
                initialQuestionCounter,
                questionCounts,
                parentAttempt,
                resetCredit,
            });
        }
        case "sequence": {
            return generateNewSequenceAttempt({
                state,
                numActivityVariants,
                initialQuestionCounter,
                questionCounts,
                parentAttempt,
                resetCredit,
            });
        }
    }

    throw Error("Invalid activity type");
}

export function generateNewSubActivityAttempt({
    id,
    state,
    numActivityVariants,
    initialQuestionCounter,
    questionCounts,
    resetCredit = false,
}: {
    id: string;
    state: ActivityState;
    numActivityVariants: ActivityVariantRecord;
    initialQuestionCounter: number;
    questionCounts: QuestionCountRecord;
    resetCredit?: boolean;
}): ActivityState {
    if (id === state.id) {
        // `id` does not correspond to a sub-activity, so generate full activity state
        const { state: newActivityState } = generateNewActivityAttempt({
            state,
            numActivityVariants,
            initialQuestionCounter,
            questionCounts,
            parentAttempt: 1,
            resetCredit,
        });
        return newActivityState;
    }

    // creating a new attempt at a lower level
    const allStates = gatherStates(state);

    const subActivityState = allStates[id];

    if (subActivityState.parentId === null) {
        throw Error("Lower lever should have parent");
    }

    const parentState = allStates[subActivityState.parentId];

    // If the activity is a single doc whose parent is a select with only single doc children,
    // then we delegate the new attempt to the select parent.
    if (
        subActivityState.type === "singleDoc" &&
        parentState.type === "select" &&
        parentState.latestChildStates.every(
            (child) => child.type === "singleDoc",
        )
    ) {
        const grandParentAttempt = parentState.parentId
            ? allStates[parentState.parentId].attempts.length
            : 1;

        let newParentState: ActivityState;

        if (parentState.source.numToSelect > 1) {
            // for a select-multiple, we generate a new selection of just one of its activities
            ({ state: newParentState } =
                generateNewSingleDocAttemptForMultiSelect({
                    state: parentState,
                    numActivityVariants,
                    initialQuestionCounter,
                    questionCounts,
                    parentAttempt: grandParentAttempt,
                    childId: id,
                }));
        } else {
            // for a select-one, just generate a new attempt of the select (rather than the single doc)
            // so that we pick a new single doc child rather than just a new variant of the original single doc
            ({ state: newParentState } = generateNewActivityAttempt({
                state: parentState,
                numActivityVariants,
                initialQuestionCounter,
                questionCounts,
                parentAttempt: grandParentAttempt,
            }));
        }

        allStates[parentState.id] = newParentState;

        return propagateStateChangeToRoot({
            allStates,
            id: parentState.id,
        });
    } else {
        const { state: newSubActivityState } = generateNewActivityAttempt({
            state: allStates[id],
            numActivityVariants,
            initialQuestionCounter,
            questionCounts,
            parentAttempt: parentState.attempts.length,
        });

        allStates[id] = newSubActivityState;

        return propagateStateChangeToRoot({
            allStates,
            id,
        });
    }
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
export function pruneActivityStateForSave(
    activityState: ActivityState,
    clearDoenetState = false,
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

/** Reverse the effect of `pruneActivityStateForSave by adding back adding back references to the source */
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

/**
 * Returns an array of the activity ids of the single document activities,
 * in the order they will appear.
 */
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

/**
 * Assuming that `numActivityVariants` contains the number of variants for all single doc activities,
 * calculate the number of unique variants of the the activity given by `source`.
 *
 * The activity could contain more variants than the returned value, but the value is
 * the number of unique variants that have no overlap with each other.
 */
export function calcNumVariants(
    source: ActivitySource,
    numActivityVariants: ActivityVariantRecord,
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

/**
 * Calculate the number of variants for the activity given by `state`,
 * taking into account its `restrictToVariantSlices`,
 * which could indicate the activity is restricted to a just a fraction
 * of the overall states specified by its source.
 */
export function calcNumVariantsFromState(
    state: ActivityState,
    numActivityVariants: ActivityVariantRecord,
): number {
    let numVariants = calcNumVariants(state.source, numActivityVariants);

    if (state.restrictToVariantSlice) {
        numVariants = Math.ceil(
            (numVariants - state.restrictToVariantSlice.idx + 1) /
                state.restrictToVariantSlice.numSlices,
        );
    }

    return numVariants;
}

/**
 * Create an uninitialized activity state (with no attempts or variants) based on `source`.
 *
 * Used to populate all activities through the `latestChildStates fields,
 * which will add all activities to the DOM when the activity from this state is rendered,
 * initializing the activities and calculating their document structure, including number of variants.
 */
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

/** Validate the ids in `source` to make sure no id contains a `|` and all ids are unique. */
export function validateIds(source: ActivitySource): string[] {
    if (source.id.includes("|")) {
        throw Error(`Id "${source.id}" contains a "|".`);
    }
    const idsFound = [source.id];

    if (source.type !== "singleDoc") {
        for (const item of source.items) {
            idsFound.push(...validateIds(item));
        }
    }

    if ([...new Set(idsFound)].length !== idsFound.length) {
        throw Error("Duplicate ids encountered in source");
    }

    return idsFound;
}

/** Validate `state` as an instance of `exportedActivityState`,
 * `source` as an instance of `ActivitySource`,
 * and verify that the hash of `source` matches `sourceHash` of `state`.
 *
 * Return `true` if all validations are satisfied, otherwise returns `false`.
 */
export function validateStateAndSource(state: unknown, source: unknown) {
    if (!isExportedActivityState(state) || !isActivitySource(source)) {
        return false;
    }

    const sourceHash = hash(source);

    return state.sourceHash === sourceHash;
}

export function gatherStates(
    state: ActivityState,
): Record<string, ActivityState> {
    const allStates: Record<string, ActivityState> = {
        [state.id]: state,
    };

    if (state.type !== "singleDoc") {
        for (const child of state.latestChildStates) {
            Object.assign(allStates, gatherStates(child));
        }
    }

    return allStates;
}

export function propagateStateChangeToRoot({
    allStates,
    id,
}: {
    allStates: Record<string, ActivityState>;
    id: string;
}): ActivityState {
    const activityState = allStates[id];
    if (activityState.parentId === null) {
        return activityState;
    }

    const newParentState = (allStates[activityState.parentId] = {
        ...allStates[activityState.parentId],
    });

    if (newParentState.type === "singleDoc") {
        throw Error("Single doc activity cannot be a parent");
    }

    const childIdx = newParentState.latestChildStates
        .map((child) => child.id)
        .indexOf(id);

    if (childIdx === -1) {
        throw Error("Something went wrong as parent didn't have child.");
    } else {
        newParentState.latestChildStates = [
            ...newParentState.latestChildStates,
        ];
        newParentState.latestChildStates[childIdx] = activityState;
    }

    newParentState.attempts = [...newParentState.attempts];
    const numAttempts = newParentState.attempts.length;
    const lastAttempt = (newParentState.attempts[numAttempts - 1] = {
        ...newParentState.attempts[numAttempts - 1],
    });

    const childIdx2 = lastAttempt.activities
        .map((child) => child.id)
        .indexOf(id);
    if (childIdx2 === -1) {
        throw Error(
            "Something went wrong as parent didn't have child in last attempt.",
        );
    }

    lastAttempt.activities = [...lastAttempt.activities];
    lastAttempt.activities[childIdx2] = activityState;

    let credit: number;

    if (newParentState.type === "sequence") {
        // calculate credit only from non-descriptions
        const nonDescriptions = newParentState.latestChildStates.filter(
            (activityState) =>
                activityState.type !== "singleDoc" ||
                !activityState.source.isDescription,
        );

        let weights = [...(newParentState.source.weights ?? [])];
        if (weights.length < nonDescriptions.length) {
            weights.push(
                ...Array<number>(nonDescriptions.length - weights.length).fill(
                    1,
                ),
            );
        }
        weights = weights.slice(0, nonDescriptions.length);

        const totWeights = weights.reduce((a, c) => a + c);
        weights = weights.map((w) => w / totWeights);

        credit = nonDescriptions.reduce(
            (a, c, i) => a + c.creditAchieved * weights[i],
            0,
        );
    } else {
        // select: take average of credit from all last attempt activities
        credit =
            lastAttempt.activities.reduce((a, c) => a + c.creditAchieved, 0) /
            lastAttempt.activities.length;
    }

    lastAttempt.creditAchieved = Math.max(lastAttempt.creditAchieved, credit);

    newParentState.creditAchieved = Math.max(
        newParentState.creditAchieved,
        credit,
    );

    return propagateStateChangeToRoot({
        allStates,
        id: newParentState.id,
    });
}
