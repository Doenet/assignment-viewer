import { AssignmentSource, DoenetMLFlags } from "../types";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { prng_alea } from "esm-seedrandom";

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const rngClass = prng_alea;

export type ItemAttemptState = {
    docId: DocId;
    variant: number;
    docState: unknown;
    creditAchieved: number;
};

export type ItemState = {
    itemId: ItemId;
    itemAttemptNumber: number;
    creditAchieved: number;
    attempts: ItemAttemptState[];
};

export type AssignmentAttemptState = {
    creditAchieved: number;
    items: ItemState[];
};

/** @see {isAssignmentState} ts-auto-guard:type-guard */
export type AssignmentState = {
    assignmentAttemptNumber: number;
    creditAchieved: number;
    attempts: AssignmentAttemptState[];
};

export type DocId = string;
export type ItemId = string;

type GenerateAssignmentAttemptAction = {
    type: "generateNewAssignmentAttempt";
    source: AssignmentSource;
    numVariantsByItemDoc: Record<ItemId, Record<DocId, number>>;
    variantIndex: number;
    shuffle: boolean;
};

type GenerateItemAttemptAction = {
    type: "generateNewItemAttempt";
    source: AssignmentSource;
    itemIdx: number;
    numVariantsPerDoc: Record<DocId, number>;
    variantIndex: number;
};

type UpdateItemStateAction = {
    type: "updateItemState";
    itemId: string;
    docState: unknown;
    creditAchieved: number;
    itemWeights: number[];
    itemIdToOrigItemIdx: Record<ItemId, number>;
    itemOrder: { index: number; id: ItemId }[];
    flags: DoenetMLFlags;
    assignmentId: string;
};

export type AssignmentStateAction =
    | {
          type: "set";
          state: AssignmentState;
      }
    | GenerateAssignmentAttemptAction
    | GenerateItemAttemptAction
    | UpdateItemStateAction;

export function assignmentStateReducer(
    state: AssignmentState,
    action: AssignmentStateAction,
): AssignmentState {
    switch (action.type) {
        case "set": {
            return action.state;
        }
        case "generateNewAssignmentAttempt": {
            const newAttemptNumber = state.assignmentAttemptNumber + 1;
            const newAttempt = generateNewAssignmentAttempt(
                action,
                newAttemptNumber,
            );

            return {
                assignmentAttemptNumber: newAttemptNumber,
                creditAchieved: state.creditAchieved,
                attempts: [...state.attempts, newAttempt],
            };
        }
        case "generateNewItemAttempt": {
            const lastAssignmentAttempt =
                state.attempts[state.assignmentAttemptNumber - 1];
            const itemState = lastAssignmentAttempt.items[action.itemIdx];
            const newItemAttemptNumber = itemState.itemAttemptNumber + 1;
            const newItemAttempt = generateNewItemAttempt(
                action,
                newItemAttemptNumber,
            );

            const newItemState: ItemState = {
                ...itemState,
                itemAttemptNumber: newItemAttemptNumber,
                attempts: [...itemState.attempts, newItemAttempt],
            };

            const newLastAssignmentAttempt: AssignmentAttemptState = {
                creditAchieved: lastAssignmentAttempt.creditAchieved,
                items: [...lastAssignmentAttempt.items],
            };
            newLastAssignmentAttempt.items.splice(
                action.itemIdx,
                1,
                newItemState,
            );

            const newAssignmentState: AssignmentState = {
                ...state,
                attempts: [...state.attempts],
            };
            newAssignmentState.attempts.splice(
                state.assignmentAttemptNumber - 1,
                1,
                newLastAssignmentAttempt,
            );

            return newAssignmentState;
        }
        case "updateItemState": {
            return updateItemState(action, state);
        }
    }
}

/**
 * Randomly generates a new assignment attempt, generating new attempts for each item.
 *
 * The random generator is seeded by the `action.variantIndex` and `attemptNumber`.
 *
 * The new assignment state returned by this function should be appended to the `attempts` field
 * of the assignment state and the `assignmentAttemptNumber` should be set to `attemptNumber`.
 */
function generateNewAssignmentAttempt(
    action: GenerateAssignmentAttemptAction,
    attemptNumber: number,
): AssignmentAttemptState {
    /** Total number of variants of all the documents in the item */
    const numVariantsPerItem: Record<ItemId, number> = {};
    for (const itemId in action.numVariantsByItemDoc) {
        numVariantsPerItem[itemId] = Object.values(
            action.numVariantsByItemDoc[itemId],
        ).reduce((a, c) => a + c, 0);
    }

    const rngSeed =
        action.variantIndex.toString() + "|" + attemptNumber.toString();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const rng = rngClass(rngSeed);

    /** The selected item variants will determine for each item
     * which document to select and which of its variants to select. */
    const selectedItemVariants = Object.fromEntries(
        Object.entries(numVariantsPerItem).map(([key, val]) => [
            key,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            Math.floor(rng() * val) + 1,
        ]),
    );

    const sourceItems = action.source.items;

    const itemOrder = [...Array(sourceItems.length).keys()];

    // If `action.shuffle` is specified, then we randomly shuffle the items that are questions.
    // Every item that is a description is held in place and each group of questions
    // in between descriptions is shuffled.
    if (action.shuffle) {
        // randomly shuffle `numItems` components of `arr` starting with `startInd`
        function shuffle_items(
            arr: number[],
            startInd: number,
            numItems: number,
        ) {
            // https://stackoverflow.com/a/12646864
            for (let i = numItems - 1; i > 0; i--) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                const j = Math.floor(rng() * (i + 1));
                [arr[startInd + i], arr[startInd + j]] = [
                    arr[startInd + j],
                    arr[startInd + i],
                ];
            }
        }

        let startInd = 0;
        while (startInd < sourceItems.length) {
            // find the first item that is a question
            while (sourceItems[startInd]?.type !== "question") {
                startInd++;
            }
            if (startInd >= sourceItems.length) {
                break;
            }

            // find the next item that is not a question
            let numItems = 1;
            while (sourceItems[startInd + numItems]?.type === "question") {
                numItems++;
            }

            if (numItems > 1) {
                // shuffle the group questions that were found between descriptions
                shuffle_items(itemOrder, startInd, numItems);
            }
            startInd += numItems;
        }
    }

    /** The docId selected for each `itemId` */
    const qDocs: Record<ItemId, DocId> = {};
    /** The variant selected from the chosen document for `itemId` */
    const qDocVariants: Record<ItemId, number> = {};

    // Determine for each value of `selectedItemVariants` the doc and variant to select.
    // eslint-disable-next-line prefer-const
    for (let [itemId, variantIdx] of Object.entries(selectedItemVariants)) {
        if (itemId in action.numVariantsByItemDoc) {
            for (const [docId, numVars] of Object.entries(
                action.numVariantsByItemDoc[itemId],
            )) {
                if (variantIdx <= numVars) {
                    qDocs[itemId] = docId;
                    qDocVariants[itemId] = variantIdx;
                    break;
                } else {
                    variantIdx -= numVars;
                }
            }
        }
    }

    return {
        creditAchieved: 0,
        items: itemOrder.map((origItemIdx) => ({
            itemId: sourceItems[origItemIdx].id,
            itemAttemptNumber: 1,
            creditAchieved: 0,

            attempts: [
                {
                    docId: qDocs[sourceItems[origItemIdx].id],
                    variant: qDocVariants[sourceItems[origItemIdx].id],
                    creditAchieved: 0,
                    docState: null,
                },
            ],
        })),
    };
}

/**
 * Randomly generates a new attempt for an item.
 *
 * The random generators is seeded based on `action.variantIndex`, `action.itemIdx` and `attemptNumber`.
 *
 * The new item attempt state returned by this function should be appended to the `attempts` of the item state
 * and the `itemAttemptNumber` should be set to `attemptNumber`.
 */
function generateNewItemAttempt(
    action: GenerateItemAttemptAction,
    attemptNumber: number,
): ItemAttemptState {
    const numVariantsForItem = Object.values(action.numVariantsPerDoc).reduce(
        (a, c) => a + c,
        0,
    );

    const rngSeed =
        action.variantIndex.toString() +
        "|" +
        action.itemIdx.toString() +
        "|" +
        attemptNumber.toString();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const rng = rngClass(rngSeed);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const selectedItemVariant = Math.floor(rng() * numVariantsForItem) + 1;

    let qDocId: DocId = "";
    let qDocVariant = -1;

    let variantIdx = selectedItemVariant;
    for (const [docId, numVars] of Object.entries(action.numVariantsPerDoc)) {
        if (variantIdx <= numVars) {
            qDocId = docId;
            qDocVariant = variantIdx;
            break;
        } else {
            variantIdx -= numVars;
        }
    }

    return {
        docId: qDocId,
        variant: qDocVariant,
        creditAchieved: 0,
        docState: null,
    };
}

/**
 * Update the latest attempt of item `action.itemId` to `action.docState` and `action.creditAchieved`.
 * Update the overall credit achieved of the item, its assignment attempt, and the whole assignment.
 *
 * Note: This function also has the side effect, if the `allowSaveState` flag is set,
 * of sending out a "SPLICE.reportScoreAndState" message with the final assignment state and credit achieved.
 */
function updateItemState(
    action: UpdateItemStateAction,
    state: AssignmentState,
): AssignmentState {
    const origItemIdx = action.itemIdToOrigItemIdx[action.itemId];
    const shuffledItemIdx = action.itemOrder
        .map((io) => io.index)
        .indexOf(origItemIdx);

    const newAssignmentState: AssignmentState = {
        ...state,
        attempts: state.attempts.map((a) => ({
            creditAchieved: a.creditAchieved,
            items: [...a.items],
        })),
    };

    const thisAssignmentAttempt =
        newAssignmentState.attempts[
            newAssignmentState.assignmentAttemptNumber - 1
        ];

    const thisItem: ItemState = {
        ...thisAssignmentAttempt.items[shuffledItemIdx],
        attempts: [...thisAssignmentAttempt.items[shuffledItemIdx].attempts],
    };
    const thisItemAttempt: ItemAttemptState = {
        ...thisItem.attempts[thisItem.itemAttemptNumber - 1],
    };
    thisItemAttempt.docState = action.docState;
    thisItemAttempt.creditAchieved = action.creditAchieved;
    thisItem.attempts[thisItem.itemAttemptNumber - 1] = thisItemAttempt;
    thisItem.creditAchieved = Math.max(
        thisItem.creditAchieved,
        thisItemAttempt.creditAchieved,
    );
    thisAssignmentAttempt.items[shuffledItemIdx] = thisItem;
    const newTotalAttemptCredit = thisAssignmentAttempt.items.reduce(
        (a, c, i) =>
            a +
            c.creditAchieved *
                action.itemWeights[
                    action.itemOrder.map((io) => io.index).indexOf(i)
                ],
        0,
    );
    thisAssignmentAttempt.creditAchieved = Math.max(
        thisAssignmentAttempt.creditAchieved,
        newTotalAttemptCredit,
    );
    newAssignmentState.creditAchieved = Math.max(
        newAssignmentState.creditAchieved,
        thisAssignmentAttempt.creditAchieved,
    );

    if (action.flags.allowSaveState) {
        window.postMessage({
            state: newAssignmentState,
            score: newAssignmentState.creditAchieved,
            subject: "SPLICE.reportScoreAndState",
            assignmentId: action.assignmentId,
        });
    }

    return newAssignmentState;
}
