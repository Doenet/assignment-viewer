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
import {
    ActivityVariantRecord,
    QuestionCountRecord,
    RestrictToVariantSlice,
} from "../types";

/** The source for creating an activity */
export type ActivitySource = SingleDocSource | SelectSource | SequenceSource;

/** The current state of an activity, including all descendants and attempts. */
export type ActivityState = SingleDocState | SelectState | SequenceState;

/**
 * The current state of an activity, where references to the source have been eliminated.
 *
 * Useful for saving to a database, as this extraneously information has been removed.
 */
export type ActivityStateNoSource =
    | SingleDocStateNoSource
    | SelectStateNoSource
    | SequenceStateNoSource;

/**
 * The activity state packaged for saving to a database.
 *
 * The `sourceHash` is a hash of the source (which has been removed from `state`),
 * which will be used to verify that the state matches the current source
 * when loading in the state.
 */
export type ExportedActivityState = {
    state: ActivityStateNoSource;
    sourceHash: string;
};

// Type guards

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
 * Populates all the activities through the `latestChildStates` field.
 * Result is based on `numActivityVariants`,
 * which stores of the number of variants calculated for each single doc activity.
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
    restrictToVariantSlice?: RestrictToVariantSlice;
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
 * Generate a new attempt for the base activity of `state`, recursing to child activities.
 *
 * The `initialQuestionCounter` parameter specifies the initial value of the counters for any
 * `<question>`, `<problem>`, or `<exercise>`.
 *
 * Calculates a value for the next question counter (`finalQuestionCounter`) based on
 * the numbers of questions in the single documents of the new attempt, as specified by `questionCounts`.
 *
 * If `resetCredit` is true, set the `creditAchieved` of the new attempt to zero.
 *
 * The `parentAttempt` counter should be the current attempt number of the parent activity.
 * It is used to ensure that selected variants change with the parent's attempt number.
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

/**
 * Generate a new activity for the descendant activity `id` of the base activity `state`.
 * Once the the new descendant activity is calculated, recurse to ancestors to create
 * a new state of the base activity, which is returned.
 */
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

/**
 * Recurse through the descendants of `activityState`,
 * returning an array of the `creditAchieved` of the latest single document activities,
 * or of select activities that select a single document.
 */
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

/**
 * In case `compositeId` was formed by appending variant information to the original id from with source,
 * extract and return the original id, which is the first part of an composite id.
 * Return the id unchanged in the case that it is still the original id.
 */
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
            if (state.latestChildStates.length === 0) {
                return [];
            } else {
                const prelimResult = state.latestChildStates.flatMap((a) =>
                    getItemSequence(a),
                );
                if (state.type === "sequence") {
                    return prelimResult;
                } else {
                    return prelimResult.slice(0, state.source.numToSelect);
                }
            }
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

/**
 * Given that the source stores the number of variants and
 * base level component counts for each single doc,
 * recurse though all activities to to form:
 * - `numActivityVariants`: the number of variants of each single doc activity,
 *    keyed by id
 * - `questionCounts`: the total number of base question/problem/exercise tags
 *    of each single doc activity, keyed by id
 */
export function gatherDocumentStructure(source: ActivitySource): {
    numActivityVariants: ActivityVariantRecord;
    questionCounts: QuestionCountRecord;
} {
    if (source.type === "singleDoc") {
        return {
            numActivityVariants: { [source.id]: source.numVariants ?? 1 },
            questionCounts: {
                [source.id]: source.baseComponentCounts
                    ? (source.baseComponentCounts.question ?? 0) +
                      (source.baseComponentCounts.problem ?? 0) +
                      (source.baseComponentCounts.exercise ?? 0)
                    : 1,
            },
        };
    } else {
        const numActivityVariants: ActivityVariantRecord = {};
        const questionCounts: QuestionCountRecord = {};
        for (const item of source.items) {
            const res = gatherDocumentStructure(item);
            Object.assign(numActivityVariants, res.numActivityVariants);
            Object.assign(questionCounts, res.questionCounts);
        }

        return { numActivityVariants, questionCounts };
    }
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

/**
 * Gather the states of all the descendants of `state`,
 * adding them to the returned object, which is indexed by `id`.
 */
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

/**
 * Given the changed state of activity with `id`, as stored in `allStates[id]`,
 * propagate the change to the activities ancestors, updating their
 * `latestChidStates`, `attempts`, and `creditAchieved` fields.
 *
 * Creates new state objects via shallow copies (and does not modify existing state objects),
 * adding the new state objects back to `allStates`.
 *
 * Returns the new activity state corresponding to the root activity,
 * which contains all the newly calculated states as descendants.
 */
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

        let creditWeights = [...(newParentState.source.creditWeights ?? [])];
        if (creditWeights.length < nonDescriptions.length) {
            creditWeights.push(
                ...Array<number>(
                    nonDescriptions.length - creditWeights.length,
                ).fill(1),
            );
        }
        creditWeights = creditWeights.slice(0, nonDescriptions.length);

        const totWeights = creditWeights.reduce((a, c) => a + c);
        creditWeights = creditWeights.map((w) => w / totWeights);

        credit = nonDescriptions.reduce(
            (a, c, i) => a + c.creditAchieved * creditWeights[i],
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
