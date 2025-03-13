import {
    ActivityVariantRecord,
    QuestionCountRecord,
    ReportScoreByItemMessage,
    ReportStateMessage,
} from "../types";
import {
    ActivityAndDoenetState,
    ActivitySource,
    extractActivityItemCredit,
    gatherStates,
    generateNewActivityAttempt,
    generateNewSingleDocSubAttempt,
    getNumItems,
    initializeActivityState,
    propagateStateChangeToRoot,
    pruneActivityStateForSave,
} from "./activityState";

type InitializeStateAction = {
    type: "initialize";
    source: ActivitySource;
    variantIndex: number;
    numActivityVariants: ActivityVariantRecord;
};

type SetStateAction = {
    type: "set";
    state: ActivityAndDoenetState;
    allowSaveState: boolean;
    baseId: string;
};

type GenerateActivityAttemptAction = {
    type: "generateNewActivityAttempt";
    numActivityVariants: ActivityVariantRecord;
    initialQuestionCounter: number;
    questionCounts: QuestionCountRecord;
    allowSaveState: boolean;
    baseId: string;
    sourceHash: string;
};

type GenerateSingleDocSubAttemptAction = {
    type: "generateSingleDocSubActivityAttempt";
    docId: string;
    doenetStateIdx: number;
    itemSequence: string[];
    numActivityVariants: ActivityVariantRecord;
    initialQuestionCounter: number;
    questionCounts: QuestionCountRecord;
    allowSaveState: boolean;
    baseId: string;
    sourceHash: string;
};

type UpdateSingleDocStateAction = {
    type: "updateSingleState";
    id: string;
    doenetState: unknown;
    doenetStateIdx: number;
    creditAchieved: number;
    allowSaveState: boolean;
    baseId: string;
    sourceHash: string;
};

export type ActivityStateAction =
    | InitializeStateAction
    | SetStateAction
    | GenerateActivityAttemptAction
    | GenerateSingleDocSubAttemptAction
    | UpdateSingleDocStateAction;

export function activityDoenetStateReducer(
    state: ActivityAndDoenetState,
    action: ActivityStateAction,
): ActivityAndDoenetState {
    const activityState = state.activityState;
    switch (action.type) {
        case "initialize": {
            const numItems = getNumItems(action.source);
            return {
                activityState: initializeActivityState({
                    source: action.source,
                    variant: action.variantIndex,
                    parentId: null,
                    numActivityVariants: action.numActivityVariants,
                }),
                doenetStates: [],
                itemAttemptNumbers: Array<number>(numItems).fill(1),
            };
        }
        case "set": {
            if (action.allowSaveState) {
                const itemScores = extractActivityItemCredit(
                    action.state.activityState,
                );
                const message: ReportScoreByItemMessage = {
                    score: action.state.activityState.creditAchieved,
                    itemScores,
                    subject: "SPLICE.reportScoreByItem",
                    activityId: action.baseId,
                };
                window.postMessage(message);
            }
            return action.state;
        }
        case "generateNewActivityAttempt": {
            const firstAttempt = activityState.attemptNumber === 0;

            const { state: newActivityState } = generateNewActivityAttempt({
                state: activityState,
                numActivityVariants: action.numActivityVariants,
                initialQuestionCounter: action.initialQuestionCounter,
                questionCounts: action.questionCounts,
                parentAttempt: 1,
            });

            // reset all item attempt numbers to 1
            const newItemAttemptNumbers = state.itemAttemptNumbers.map(() => 1);

            if (action.allowSaveState) {
                const itemScores = extractActivityItemCredit(newActivityState);
                if (firstAttempt) {
                    // If first attempt, no need to save state.
                    // Just send score by item to indicate how many items are in the activity
                    const message: ReportScoreByItemMessage = {
                        score: newActivityState.creditAchieved,
                        itemScores,
                        subject: "SPLICE.reportScoreByItem",
                        activityId: action.baseId,
                    };
                    window.postMessage(message);
                } else {
                    const message: ReportStateMessage = {
                        state: {
                            activityState:
                                pruneActivityStateForSave(newActivityState),
                            doenetStates: [],
                            itemAttemptNumbers: newItemAttemptNumbers,
                            sourceHash: action.sourceHash,
                        },
                        score: newActivityState.creditAchieved,
                        itemScores,
                        subject: "SPLICE.reportScoreAndState",
                        activityId: action.baseId,
                        newAttempt: true,
                    };
                    window.postMessage(message);
                }
            }

            return {
                activityState: newActivityState,
                doenetStates: [],
                itemAttemptNumbers: newItemAttemptNumbers,
            };
        }

        case "generateSingleDocSubActivityAttempt": {
            if (action.docId === activityState.id) {
                throw Error(
                    "Should not call generateSingleDocSubActivityAttempt on entire activity",
                );
            }

            const newActivityState = generateNewSingleDocSubAttempt({
                singleDocId: action.docId,
                state: activityState,
                numActivityVariants: action.numActivityVariants,
                initialQuestionCounter: action.initialQuestionCounter,
                questionCounts: action.questionCounts,
            });

            const newDoenetMLStates = [...state.doenetStates];
            newDoenetMLStates[action.doenetStateIdx] = null;

            // increment the item attempt number corresponding to the document
            const itemIdx = action.itemSequence.indexOf(action.docId);
            const newItemAttemptNumbers = [...state.itemAttemptNumbers];
            newItemAttemptNumbers[itemIdx]++;

            if (action.allowSaveState) {
                const itemScores = extractActivityItemCredit(newActivityState);

                // determine the item number for which we are generating a new attempt
                const itemScoresOld = extractActivityItemCredit(activityState);

                const newAttemptForItem =
                    itemScoresOld.findIndex(
                        (s) =>
                            s.id === action.docId || s.docId === action.docId,
                    ) + 1;

                const message: ReportStateMessage = {
                    state: {
                        activityState:
                            pruneActivityStateForSave(newActivityState),
                        doenetStates: newDoenetMLStates,
                        itemAttemptNumbers: newItemAttemptNumbers,
                        sourceHash: action.sourceHash,
                    },
                    score: newActivityState.creditAchieved,
                    itemScores,
                    newDoenetStateIdx: action.doenetStateIdx,
                    subject: "SPLICE.reportScoreAndState",
                    activityId: action.baseId,
                    newAttempt: true,
                    newAttemptForItem,
                };

                window.postMessage(message);
            }

            return {
                activityState: newActivityState,
                doenetStates: newDoenetMLStates,
                itemAttemptNumbers: newItemAttemptNumbers,
            };
        }
        case "updateSingleState": {
            const newActivityDoenetState = updateSingleDocState(action, state);

            if (action.allowSaveState) {
                const newActivityState = newActivityDoenetState.activityState;
                const itemScores = extractActivityItemCredit(newActivityState);

                const itemUpdated =
                    action.itemSequence.indexOf(action.docId) + 1;

                const message: ReportStateMessage = {
                    state: {
                        activityState:
                            pruneActivityStateForSave(newActivityState),
                        sourceHash: action.sourceHash,
                        doenetStates: newActivityDoenetState.doenetStates,
                        itemAttemptNumbers: state.itemAttemptNumbers,
                    },
                    score: newActivityState.creditAchieved,
                    itemScores,
                    itemUpdated,
                    newDoenetStateIdx: action.doenetStateIdx,
                    subject: "SPLICE.reportScoreAndState",
                    activityId: action.baseId,
                };

                window.postMessage(message);
            }

            return newActivityDoenetState;
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
    activityDoenetState: ActivityAndDoenetState,
): ActivityAndDoenetState {
    const allStates = gatherStates(activityDoenetState.activityState);

    const newSingleDocState = (allStates[action.id] = {
        ...allStates[action.id],
    });

    if (newSingleDocState.type !== "singleDoc") {
        throw Error(
            "Received the wrong type of activity for updateSingleDocState",
        );
    }

    newSingleDocState.creditAchieved = action.creditAchieved;

    const doenetStates = [...activityDoenetState.doenetStates];
    doenetStates[action.doenetStateIdx] = action.doenetState;
    newSingleDocState.doenetStateIdx = action.doenetStateIdx;

    const rootActivityState = propagateStateChangeToRoot({
        allStates,
        id: newSingleDocState.id,
    });

    return {
        activityState: rootActivityState,
        doenetStates,
        itemAttemptNumbers: activityDoenetState.itemAttemptNumbers,
    };
}
