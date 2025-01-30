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
}: {
    source: ActivitySource;
    variant: number;
    parentId: string | null;
}): ActivityState {
    switch (source.type) {
        case "singleDoc": {
            return initializeSingleDocState({ source, variant, parentId });
        }
        case "select": {
            return initializeSelectState({ source, variant, parentId });
        }
        case "sequence": {
            return initializeSequenceState({ source, variant, parentId });
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
}: {
    state: ActivityState;
    numActivityVariants: Record<string, number>;
    initialQuestionCounter: number;
    questionCounts: Record<string, number>;
    resetCredit?: boolean;
}): { finalQuestionCounter: number; state: ActivityState } {
    switch (state.type) {
        case "singleDoc": {
            return generateNewSingleDocAttempt({
                state,
                numActivityVariants,
                initialQuestionCounter,
                questionCounts,
                resetCredit,
            });
        }
        case "select": {
            return generateNewSelectAttempt({
                state,
                numActivityVariants,
                initialQuestionCounter,
                questionCounts,
                resetCredit,
            });
        }
        case "sequence": {
            return generateNewSequenceAttempt({
                state,
                numActivityVariants,
                initialQuestionCounter,
                questionCounts,
                resetCredit,
            });
        }
    }

    throw Error("Invalid activity type");
}

type setStateAction = {
    type: "set";
    state: ActivityState;
    allowSaveState: boolean;
    baseId: string;
};

type GenerateActivityAttemptAction = {
    type: "generateNewActivityAttempt";
    id?: string;
    numActivityVariants: Record<string, number>;
    initialQuestionCounter: number;
    questionCounts: Record<string, number>;
    allowSaveState: boolean;
    baseId: string;
};

type UpdateSingleDocStateAction = {
    type: "updateSingleState";
    id: string;
    doenetState: unknown;
    creditAchieved: number;
    allowSaveState: boolean;
    baseId: string;
};

export type ActivityStateAction =
    | { type: "reinitialize"; source: ActivitySource }
    | setStateAction
    | GenerateActivityAttemptAction
    | UpdateSingleDocStateAction;

export function activityStateReducer(
    state: ActivityState,
    action: ActivityStateAction,
): ActivityState {
    switch (action.type) {
        case "reinitialize": {
            return initializeActivityState({
                source: action.source,
                variant: state.initialVariant,
                parentId: null,
            });
        }
        case "set": {
            const scoreByItem = extractActivityItemCredit(action.state);
            if (action.allowSaveState) {
                window.postMessage({
                    score: action.state.creditAchieved,
                    scoreByItem,
                    subject: "SPLICE.reportScoreByItem",
                    activityId: action.baseId,
                });
            }
            return action.state;
        }
        case "generateNewActivityAttempt": {
            let newActivityState: ActivityState;
            if (!action.id || action.id === state.id) {
                ({ state: newActivityState } = generateNewActivityAttempt({
                    state,
                    numActivityVariants: action.numActivityVariants,
                    initialQuestionCounter: action.initialQuestionCounter,
                    questionCounts: action.questionCounts,
                }));
            } else {
                // creating a new attempt at a lower level
                const allStates = gatherStates(state);

                const { state: newSubActivityState } =
                    generateNewActivityAttempt({
                        state: allStates[action.id],
                        numActivityVariants: action.numActivityVariants,
                        initialQuestionCounter: action.initialQuestionCounter,
                        questionCounts: action.questionCounts,
                    });

                allStates[action.id] = newSubActivityState;

                newActivityState = propagateStateChangeToRoot({
                    allStates,
                    id: action.id,
                });
            }

            if (action.allowSaveState) {
                const scoreByItem = extractActivityItemCredit(newActivityState);
                window.postMessage({
                    score: newActivityState.creditAchieved,
                    scoreByItem,
                    subject: "SPLICE.reportScoreByItem",
                    activityId: action.baseId,
                });
            }

            return newActivityState;
        }
        case "updateSingleState": {
            const newActivityState = updateSingleDocState(action, state);

            if (action.allowSaveState) {
                const scoreByItem = extractActivityItemCredit(newActivityState);

                window.postMessage({
                    state: pruneActivityStateForSave(newActivityState, false),
                    score: newActivityState.creditAchieved,
                    scoreByItem,
                    subject: "SPLICE.reportScoreAndState",
                    activityId: action.baseId,
                });
            }

            return newActivityState;
        }
    }

    throw Error("Invalid activity action");
}

function gatherStates(state: ActivityState): Record<string, ActivityState> {
    const allStates: Record<string, ActivityState> = {
        [extendedId(state)]: state,
    };

    if (state.type === "select") {
        for (const child of state.latestChildStates) {
            Object.assign(allStates, gatherStates(child));
            const duplicateNumber = child.duplicateNumber ?? 0;
            if (duplicateNumber > 0) {
                const childId = child.id;
                const latestAttempt = state.attempts[state.attempts.length - 1];
                for (let i = 1; i <= latestAttempt.activities.length; i++) {
                    if (i === duplicateNumber) {
                        continue;
                    }
                    const childState = latestAttempt.activities.find(
                        (a) =>
                            extendedId(a) ==
                            extendedId({ id: childId, duplicateNumber: i }),
                    );
                    if (childState) {
                        Object.assign(allStates, gatherStates(childState));
                    }
                }
            }
        }
    }

    if (state.type === "sequence") {
        for (const child of state.latestChildStates) {
            Object.assign(allStates, gatherStates(child));
        }
    }

    return allStates;
}

/**
 * Update the latest attempt of the single doc activity `action.id` to `action.doenetState` and `action.creditAchieved`.
 * Propagate this change upward in the activity tree to the root activity,
 * obtaining the new overall activity state and credit achieved.
 */
function updateSingleDocState(
    action: UpdateSingleDocStateAction,
    state: ActivityState,
): ActivityState {
    const allStates = gatherStates(state);

    const newSingleDocState = (allStates[action.id] = {
        ...allStates[action.id],
    });

    if (newSingleDocState.type !== "singleDoc") {
        throw Error(
            "Received the wrong type of activity for updateSingleDocState",
        );
    }

    newSingleDocState.creditAchieved = Math.max(
        newSingleDocState.creditAchieved,
        action.creditAchieved,
    );

    const newAttempts = (newSingleDocState.attempts = [
        ...newSingleDocState.attempts,
    ]);

    const lastAttempt = {
        ...newAttempts[newSingleDocState.attempts.length - 1],
        doenetState: action.doenetState,
    };
    lastAttempt.creditAchieved = Math.max(
        lastAttempt.creditAchieved,
        action.creditAchieved,
    );

    newAttempts[newSingleDocState.attempts.length - 1] = lastAttempt;

    const rootActivityState = propagateStateChangeToRoot({
        allStates,
        id: extendedId(newSingleDocState),
    });

    return rootActivityState;
}

function propagateStateChangeToRoot({
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
        .map((child) => extendedId(child))
        .indexOf(id);

    if (childIdx === -1) {
        // if we have a select multiple with a duplicated child,
        // that duplicated child's state might not be latestChildStates
        if (
            !(
                newParentState.type === "select" &&
                newParentState.source.numToSelect > 0 &&
                id.includes("|")
            )
        ) {
            throw Error("Something went wrong as parent didn't have child.");
        }
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
        .map((child) => extendedId(child))
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

export function extractActivityItemCredit(
    activityState: ActivityState,
): { id: string; score: number; duplicateNumber?: number }[] {
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

export function extendedId({
    id,
    duplicateNumber,
}: {
    id: string;
    duplicateNumber?: number;
}) {
    return id + (duplicateNumber ? "|" + duplicateNumber.toString() : "");
}

export function getItemSequence(state: ActivityState): string[] {
    if (state.type === "singleDoc") {
        return [extendedId(state)];
    } else {
        const numAttempts = state.attempts.length;
        if (numAttempts === 0) {
            return [extendedId(state)];
        }
        return state.attempts[numAttempts - 1].activities.flatMap((a) =>
            getItemSequence(a),
        );
    }
}
