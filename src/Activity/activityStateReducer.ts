import { nanoid } from "nanoid";
import {
    ActivityVariantRecord,
    ReportScoreByItemMessage,
    ReportStateMessage,
} from "../types";
import {
    ActivityAndDoenetState,
    ActivityAndDoenetStateCore,
    ActivitySource,
    extractActivityItemCredit,
    gatherStates,
    generateNewActivityAttempt,
    generateNewSingleDocSubAttempt,
    getItemSequence,
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
    state: ActivityAndDoenetStateCore;
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
                stateVersion: state.stateVersion + 1,
                errMsg: null,
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
            return {
                ...action.state,
                stateVersion: state.stateVersion + 1,
                errMsg: null,
            };
        }
        case "generateNewActivityAttempt": {
            let newActivityState;
            try {
                ({ state: newActivityState } = generateNewActivityAttempt({
                    state: activityState,
                    numActivityVariants: action.numActivityVariants,
                    initialQuestionCounter: action.initialQuestionCounter,
                    parentAttempt: 1,
                }));
            } catch (e) {
                // Surface the failure through state rather than throwing:
                // React runs reducers during render, where a throw would
                // unmount the viewer via an error boundary instead of
                // showing the error message — and a later successful action
                // self-clears it.
                const message = e instanceof Error ? e.message : "";
                return { ...state, errMsg: `Error in activity: ${message}` };
            }

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
                stateVersion: state.stateVersion + 1,
                errMsg: null,
            };
        }

        case "generateSingleDocSubActivityAttempt": {
            if (action.docId === activityState.id) {
                throw Error(
                    "Should not call generateSingleDocSubActivityAttempt on entire activity",
                );
            }

            // The document's position in the item sequence is derived from
            // the reducer's own state (callers used to pass it in, which
            // required them to track the current sequence).
            const doenetStateIdx = getItemSequence(activityState).indexOf(
                action.docId,
            );

            let newActivityState;
            try {
                newActivityState = generateNewSingleDocSubAttempt({
                    singleDocId: action.docId,
                    state: activityState,
                    numActivityVariants: action.numActivityVariants,
                    initialQuestionCounter: action.initialQuestionCounter,
                });
            } catch (e) {
                // Same treatment as generateNewActivityAttempt: surface
                // through state instead of throwing out of the dispatch.
                const message = e instanceof Error ? e.message : "";
                return { ...state, errMsg: `Error in activity: ${message}` };
            }

            const newDoenetMLStates = [...state.doenetStates];
            newDoenetMLStates[doenetStateIdx] = null;

            // increment the item attempt number corresponding to the document
            const newItemAttemptNumbers = [...state.itemAttemptNumbers];
            newItemAttemptNumbers[doenetStateIdx]++;

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
                    new_doenet_state_idx: doenetStateIdx,
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
                // Not a stateVersion bump: the remount is driven by the
                // item's own attemptNumber.
                stateVersion: state.stateVersion,
                errMsg: null,
            };
        }
        case "updateSingleState": {
            // A report can arrive from a document that is no longer part of
            // the activity — e.g. an in-flight save from a just-regenerated
            // attempt, or after a select re-picked its children. Ignore it:
            // recording it would corrupt another item's slot, and throwing
            // would unmount the whole viewer via an error boundary.
            const doenetStateIdx = getItemSequence(activityState).indexOf(
                action.docId,
            );
            if (doenetStateIdx === -1) {
                return state;
            }

            const newActivityDoenetState = updateSingleDocState(
                action,
                doenetStateIdx,
                state,
            );

            if (action.allowSaveState) {
                const newActivityState = newActivityDoenetState.activityState;
                const itemScores = extractActivityItemCredit(newActivityState);

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
                    item_updated: doenetStateIdx + 1,
                    new_doenet_state_idx: doenetStateIdx,
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
 * Update the latest attempt of the single doc activity `action.docId` to `action.doenetState` and `action.creditAchieved`.
 * Propagate this change upward in the activity tree to the root activity,
 * obtaining the new overall activity state and credit achieved.
 */
function updateSingleDocState(
    action: UpdateSingleDocStateAction,
    doenetStateIdx: number,
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
    doenetStates[doenetStateIdx] = action.doenetState;
    newSingleDocState.doenetStateIdx = doenetStateIdx;

    const rootActivityState = propagateStateChangeToRoot({
        allStates,
        id: newSingleDocState.id,
    });

    return {
        activityState: rootActivityState,
        doenetStates,
        itemAttemptNumbers: activityDoenetState.itemAttemptNumbers,
        stateVersion: activityDoenetState.stateVersion,
        errMsg: null,
    };
}
