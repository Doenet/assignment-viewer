import { ActivityVariantRecord, QuestionCountRecord } from "../types";
import {
    ActivitySource,
    ActivityState,
    extractActivityItemCredit,
    gatherStates,
    generateNewActivityAttempt,
    generateNewSubActivityAttempt,
    getUninitializedActivityState,
    initializeActivityState,
    propagateStateChangeToRoot,
    pruneActivityStateForSave,
} from "./activityState";
import hash from "object-hash";

type ResetStateAction = {
    type: "reset";
    source: ActivitySource;
};

type InitializeStateAction = {
    type: "initialize";
    variantIndex: number;
    numActivityVariants: ActivityVariantRecord;
    initialQuestionCounter: number;
    questionCounts: QuestionCountRecord;
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
    numActivityVariants: ActivityVariantRecord;
    initialQuestionCounter: number;
    questionCounts: QuestionCountRecord;
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
                parentAttempt: 1,
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
                    parentAttempt: 1,
                }));
            } else {
                newActivityState = generateNewSubActivityAttempt({
                    id: action.id,
                    state,
                    numActivityVariants: action.numActivityVariants,
                    initialQuestionCounter: action.initialQuestionCounter,
                    questionCounts: action.questionCounts,
                });
            }

            if (action.allowSaveState) {
                const scoreByItem = extractActivityItemCredit(newActivityState);
                const sourceHash = hash(newActivityState.source);

                window.postMessage({
                    state: {
                        state: pruneActivityStateForSave(
                            newActivityState,
                            false,
                        ),
                        sourceHash,
                    },
                    score: newActivityState.creditAchieved,
                    scoreByItem,
                    subject: "SPLICE.reportScoreAndState",
                    activityId: action.baseId,
                });
            }

            return newActivityState;
        }
        case "updateSingleState": {
            const newActivityState = updateSingleDocState(action, state);

            if (action.allowSaveState) {
                const scoreByItem = extractActivityItemCredit(newActivityState);

                const sourceHash = hash(newActivityState.source);

                window.postMessage({
                    state: {
                        state: pruneActivityStateForSave(
                            newActivityState,
                            false,
                        ),
                        sourceHash,
                    },
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
