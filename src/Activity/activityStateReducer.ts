import { nanoid } from "nanoid";
import {
    ActivityVariantRecord,
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
    allowSaveState: boolean;
    baseId: string;
    sourceHash: string;
    initialAttempt?: boolean;
};

type GenerateSingleDocSubAttemptAction = {
    type: "generateSingleDocSubActivityAttempt";
    docId: string;
    doenetStateIdx: number;
    itemSequence: string[];
    numActivityVariants: ActivityVariantRecord;
    initialQuestionCounter: number;
    allowSaveState: boolean;
    baseId: string;
    sourceHash: string;
};

type UpdateSingleDocStateAction = {
    type: "updateSingleState";
    docId: string;
    doenetState: unknown;
    doenetStateIdx: number;
    itemSequence: string[];
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
                    item_scores: itemScores,
                    subject: "SPLICE.reportScoreByItem",
                    activity_id: action.baseId,
                    message_id: nanoid(),
                };
                window.postMessage(message);
            }
            return action.state;
        }
        case "generateNewActivityAttempt": {
            const { state: newActivityState } = generateNewActivityAttempt({
                state: activityState,
                numActivityVariants: action.numActivityVariants,
                initialQuestionCounter: action.initialQuestionCounter,
                parentAttempt: 1,
            });

            // reset all item attempt numbers to 1
            const newItemAttemptNumbers = state.itemAttemptNumbers.map(() => 1);

            if (action.allowSaveState && !action.initialAttempt) {
                const itemScores = extractActivityItemCredit(newActivityState);

                const message: ReportStateMessage = {
                    state: {
                        activityState:
                            pruneActivityStateForSave(newActivityState),
                        doenetStates: [],
                        itemAttemptNumbers: newItemAttemptNumbers,
                        sourceHash: action.sourceHash,
                    },
                    score: newActivityState.creditAchieved,
                    item_scores: itemScores,
                    subject: "SPLICE.reportScoreAndState",
                    activity_id: action.baseId,
                    message_id: nanoid(),
                    new_attempt: true,
                };
                window.postMessage(message);
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
                    item_scores: itemScores,
                    new_doenet_state_idx: action.doenetStateIdx,
                    subject: "SPLICE.reportScoreAndState",
                    activity_id: action.baseId,
                    message_id: nanoid(),
                    new_attempt: true,
                    new_attempt_for_item: newAttemptForItem,
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
                    item_scores: itemScores,
                    item_updated: itemUpdated,
                    new_doenet_state_idx: action.doenetStateIdx,
                    subject: "SPLICE.reportScoreAndState",
                    activity_id: action.baseId,
                    message_id: nanoid(),
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

    const newSingleDocState = (allStates[action.docId] = {
        ...allStates[action.docId],
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
