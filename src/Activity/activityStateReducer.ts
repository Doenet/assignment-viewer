import { ActivityVariantRecord, QuestionCountRecord } from "../types";
import {
    ActivitySource,
    ActivityState,
    extractActivityItemCredit,
    gatherStates,
    generateNewActivityAttempt,
    generateNewSubActivityAttempt,
    initializeActivityState,
    propagateStateChangeToRoot,
    pruneActivityStateForSave,
} from "./activityState";
import hash from "object-hash";

type InitializeStateAction = {
    type: "initialize";
    source: ActivitySource;
    variantIndex: number;
    numActivityVariants: ActivityVariantRecord;
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
    | InitializeStateAction
    | SetStateAction
    | GenerateActivityAttemptAction
    | UpdateSingleDocStateAction;

export function activityStateReducer(
    state: ActivityState,
    action: ActivityStateAction,
): ActivityState {
    switch (action.type) {
        case "initialize": {
            return initializeActivityState({
                source: action.source,
                variant: action.variantIndex,
                parentId: null,
                numActivityVariants: action.numActivityVariants,
            });
        }
        case "set": {
            if (action.allowSaveState) {
                const scoreByItem = extractActivityItemCredit(action.state);
                window.postMessage({
                    score: action.state.creditAchieved,
                    latestScore: action.state.latestCreditAchieved,
                    scoreByItem,
                    subject: "SPLICE.reportScoreByItem",
                    activityId: action.baseId,
                });
            }
            return action.state;
        }
        case "generateNewActivityAttempt": {
            let newActivityState: ActivityState;
            let firstAttempt = false;
            if (!action.id || action.id === state.id) {
                if (state.attemptNumber === 0) {
                    firstAttempt = true;
                }
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

                if (firstAttempt) {
                    // If first attempt, no need to save state.
                    // Just send score by item to indicate how many items are in the activity
                    window.postMessage({
                        score: newActivityState.creditAchieved,
                        latestScore: newActivityState.latestCreditAchieved,
                        scoreByItem,
                        subject: "SPLICE.reportScoreByItem",
                        activityId: action.baseId,
                    });
                } else {
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
                        latestScore: newActivityState.latestCreditAchieved,
                        scoreByItem,
                        subject: "SPLICE.reportScoreAndState",
                        activityId: action.baseId,
                    });
                }
            }

            return newActivityState;
        }
        case "updateSingleState": {
            const newActivityState = updateSingleDocState(action, state);

            if (action.allowSaveState) {
                const scoreByItem = extractActivityItemCredit(newActivityState);

                const sourceHash = hash(newActivityState.source);

                let onSubmission = false;
                const doenetState = action.doenetState;
                if (
                    typeof doenetState === "object" &&
                    doenetState !== null &&
                    "onSubmission" in doenetState &&
                    typeof doenetState.onSubmission === "boolean"
                ) {
                    onSubmission = doenetState.onSubmission;
                }

                window.postMessage({
                    state: {
                        state: pruneActivityStateForSave(
                            newActivityState,
                            false,
                        ),
                        sourceHash,
                        onSubmission,
                    },
                    score: newActivityState.creditAchieved,
                    latestScore: newActivityState.latestCreditAchieved,
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
    newSingleDocState.latestCreditAchieved = action.creditAchieved;

    newSingleDocState.doenetState = action.doenetState;

    const rootActivityState = propagateStateChangeToRoot({
        allStates,
        id: newSingleDocState.id,
    });

    return rootActivityState;
}
