import {
    ActivitySource,
    ActivityState,
    extractActivityItemCredit,
    generateNewActivityAttempt,
    getUninitializedActivityState,
    initializeActivityState,
    pruneActivityStateForSave,
} from "./activityState";

type ResetStateAction = {
    type: "reset";
    source: ActivitySource;
};

type InitializeStateAction = {
    type: "initialize";
    variantIndex: number;
    numActivityVariants: Record<string, number>;
    initialQuestionCounter: number;
    questionCounts: Record<string, number>;
    allowSaveState: boolean;
    baseId: string;
};

type SetStateAction = {
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
    | ResetStateAction
    | InitializeStateAction
    | SetStateAction
    | GenerateActivityAttemptAction
    | UpdateSingleDocStateAction;

export function activityStateReducer(
    state: ActivityState,
    action: ActivityStateAction,
): ActivityState {
    switch (action.type) {
        case "reset": {
            return getUninitializedActivityState(action.source);
        }
        case "initialize": {
            const initialState = initializeActivityState({
                source: state.source,
                variant: action.variantIndex,
                parentId: null,
                numActivityVariants: action.numActivityVariants,
            });

            const { state: newActivityState } = generateNewActivityAttempt({
                state: initialState,
                numActivityVariants: action.numActivityVariants,
                initialQuestionCounter: action.initialQuestionCounter,
                questionCounts: action.questionCounts,
            });

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
        id: newSingleDocState.id,
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

function gatherStates(state: ActivityState): Record<string, ActivityState> {
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
