import {
    ActivityVariantRecord,
    isRestrictToVariantSlice,
    RestrictToVariantSlice,
} from "../types";
import {
    ActivitySource,
    ActivityState,
    ActivityStateNoSource,
    addSourceToActivityState,
    calcNumVariants,
    calcNumVariantsFromState,
    extractActivityItemCredit,
    extractSourceId,
    generateNewActivityAttempt,
    getNumItems,
    initializeActivityState,
    isActivitySource,
    isActivityState,
    isActivityStateNoSource,
    pruneActivityStateForSave,
} from "./activityState";

import seedrandom from "seedrandom";
import { SingleDocState } from "./singleDocState";

const rngClass = seedrandom.alea;

/** The source for creating a select activity */
export type SelectSource = {
    type: "select";
    id: string;
    title?: string;
    /** The child activities to select from */
    items: ActivitySource[];
    /** The number of child activities to select (without replacement) for each attempt */
    numToSelect: number;
    /**
     * Whether or not to consider each variant of each child a separate option to select from.
     * If `selectByVariant` is `true`, the selection is from the total set of all variants,
     * meaning selection probabilities is weighted by the number of variants each child has,
     * and, if `numToSelect` > 1, a child could be selected multiple times for a given attempt.
     */
    selectByVariant: boolean;
};

/** The current state of a select activity */
export type SelectState = {
    type: "select";
    id: string;
    parentId: string | null;
    source: SelectSource;
    /** Used to seed the random number generate to yield the actual variants of each attempt. */
    initialVariant: number;
    /** Credit achieved (between 0 and 1) from the latest submission */
    creditAchieved: number;
    /** The maximum credit achieved over all submissions of this attempt of the activity */
    allChildren: ActivityState[];
    /** The number of the current attempt */
    attemptNumber: number;
    /** The children selected for the current attempt  */
    selectedChildren: ActivityState[];
    /** A list of the the ids of the children selected in all attempts, ordered by attempt number */
    previousSelections: string[];
    /** The value of the question counter set for the beginning of this activity */
    initialQuestionCounter: number;
    /** See {@link RestrictToVariantSlice} */
    restrictToVariantSlice?: RestrictToVariantSlice;
};

/**
 * The current state of a select activity, where references to the source have been eliminated.
 *
 * Useful for saving to a database, as this extraneously information has been removed.
 */
export type SelectStateNoSource = Omit<
    SelectState,
    "source" | "allChildren" | "selectedChildren"
> & {
    allChildren: ActivityStateNoSource[];
    selectedChildren: ActivityStateNoSource[];
};

// type guards

export function isSelectSource(obj: unknown): obj is SelectSource {
    const typedObj = obj as SelectSource;
    return (
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        typedObj !== null &&
        typeof typedObj === "object" &&
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        typedObj.type === "select" &&
        typeof typedObj.id === "string" &&
        typeof typedObj.numToSelect === "number" &&
        typeof typedObj.selectByVariant === "boolean" &&
        Array.isArray(typedObj.items) &&
        typedObj.items.every(isActivitySource)
    );
}

export function isSelectState(obj: unknown): obj is SelectState {
    const typedObj = obj as SelectState;
    return (
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        typedObj !== null &&
        typeof typedObj === "object" &&
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        typedObj.type === "select" &&
        typeof typedObj.id === "string" &&
        (typedObj.parentId === null || typeof typedObj.parentId === "string") &&
        isSelectSource(typedObj.source) &&
        typeof typedObj.initialVariant === "number" &&
        typeof typedObj.creditAchieved === "number" &&
        Array.isArray(typedObj.allChildren) &&
        typedObj.allChildren.every(isActivityState) &&
        typeof typedObj.attemptNumber === "number" &&
        Array.isArray(typedObj.selectedChildren) &&
        typedObj.selectedChildren.every(isActivityState) &&
        Array.isArray(typedObj.previousSelections) &&
        typedObj.previousSelections.every((x) => typeof x === "string") &&
        typeof typedObj.initialQuestionCounter === "number" &&
        (typedObj.restrictToVariantSlice === undefined ||
            isRestrictToVariantSlice(typedObj.restrictToVariantSlice))
    );
}

export function isSelectStateNoSource(
    obj: unknown,
): obj is SelectStateNoSource {
    const typedObj = obj as SelectStateNoSource;
    return (
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        typedObj !== null &&
        typeof typedObj === "object" &&
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        typedObj.type === "select" &&
        typeof typedObj.id === "string" &&
        (typedObj.parentId === null || typeof typedObj.parentId === "string") &&
        typeof typedObj.initialVariant === "number" &&
        typeof typedObj.creditAchieved === "number" &&
        Array.isArray(typedObj.allChildren) &&
        typedObj.allChildren.every(isActivityStateNoSource) &&
        typeof typedObj.attemptNumber === "number" &&
        Array.isArray(typedObj.selectedChildren) &&
        typedObj.selectedChildren.every(isActivityStateNoSource) &&
        Array.isArray(typedObj.previousSelections) &&
        typedObj.previousSelections.every((x) => typeof x === "string") &&
        typeof typedObj.initialQuestionCounter === "number" &&
        (typedObj.restrictToVariantSlice === undefined ||
            isRestrictToVariantSlice(typedObj.restrictToVariantSlice))
    );
}

/**
 * Initialize activity state from `source` so that it is ready to generate attempts.
 *
 * Populates all the activities through the `allChildren` field,
 * similar to the behavior of `getUninitializedActivityState`,
 * only this time it takes advantage of `numActivityVariants`,
 * which stores of the number of variants calculated for each single doc activity.
 *
 * If `source.selectByVariant` is `true` and the `source.numToSelect` is larger than one,
 * then create a separate child for each variant of each child
 * (using `numActivityVariants` to determine the number of unique variants for each child)
 *
 * Using the provided `variant` to create a seed, an initial variant is randomly selected for each child.
 */
export function initializeSelectState({
    source,
    variant,
    parentId,
    numActivityVariants,
    restrictToVariantSlice,
}: {
    source: SelectSource;
    variant: number;
    parentId: string | null;
    numActivityVariants: ActivityVariantRecord;
    restrictToVariantSlice?: RestrictToVariantSlice;
}): SelectState {
    const rngSeed = variant.toString() + "|" + source.id.toString();

    const rng = rngClass(rngSeed);

    const childStates: ActivityState[] = [];

    const extendedId =
        source.id +
        (restrictToVariantSlice === undefined
            ? ""
            : "|" + restrictToVariantSlice.idx.toString());

    // TODO: handle restrictToVariantSlice
    if (restrictToVariantSlice !== undefined) {
        throw Error(
            "A select inside a select-multiple has not yet been implemented.",
        );
    }

    if (source.numToSelect === 1 || !source.selectByVariant) {
        for (const activitySource of source.items) {
            const childVariant = Math.floor(rng() * 1000000);
            childStates.push(
                initializeActivityState({
                    source: activitySource,
                    variant: childVariant,
                    parentId: extendedId,
                    numActivityVariants,
                }),
            );
        }
    } else {
        // We are selecting multiple items while selecting by variant.
        // Create a separate child state for each variant of each child.

        // NB: we separate variants only if `numToSelect` > 1 because this separation is imperfect.
        // The calculated `numVariants` is only the number of variants that are completely unique,
        // but a select or sequence activity may have more variants than `numVariants`.
        // If `numToSelect` is 1, we delegation the selection of variants completely to the child activities,
        // which have access to more information about their variants.
        // If `numToSelect` exceeds 1, then we need to coordinate variants among selections,
        // so we fall back to separating them at this level.
        for (const activitySource of source.items) {
            const childVariant = Math.floor(rng() * 1000000) + 1;
            const numVariants = calcNumVariants(
                activitySource,
                numActivityVariants,
            );

            for (let idx = 1; idx <= numVariants; idx++) {
                childStates.push(
                    initializeActivityState({
                        source: activitySource,
                        variant: childVariant,
                        parentId: extendedId,
                        numActivityVariants,
                        // If `numVariants` is actually the number of variants,
                        // this restrictions creates a slice of just one variant.
                        // Otherwise, the slice may still contain multiple variants,
                        // but they at least will not overlap with other slices.
                        restrictToVariantSlice: { idx, numSlices: numVariants },
                    }),
                );
            }
        }
    }

    return {
        type: "select",
        id: extendedId,
        parentId,
        source,
        initialVariant: variant,
        creditAchieved: 0,
        allChildren: childStates,
        attemptNumber: 0,
        selectedChildren: [],
        previousSelections: [],
        initialQuestionCounter: 0,
        restrictToVariantSlice,
    };
}

/**
 * Generate a new attempt for the base activity of `state`, recursing to child activities.
 *
 * For each attempt, a set of children from `state.allChildren` of size `state.source.numToSelect`
 * is selected. If `state.source.selectByVariant` is `true`, then the selection probability of each
 * child is weighted by its number of variants, and a child may be selected multiple times (but with different variants).
 *
 * See {@link generateNewActivityAttempt} for more information on the influence of parameters.
 *
 * @returns
 * - state: the new activity state
 * - finalQuestionCounter: the question counter to be given as an `initialQuestionCounter` for the next activity
 */
export function generateNewSelectAttempt({
    state,
    numActivityVariants,
    initialQuestionCounter,
    parentAttempt,
}: {
    state: SelectState;
    numActivityVariants: ActivityVariantRecord;
    initialQuestionCounter: number;
    parentAttempt: number;
}): { finalQuestionCounter: number; state: SelectState } {
    const source = state.source;
    const numToSelect = source.numToSelect;
    const numChildren = state.allChildren.length;

    if (numChildren === 0) {
        return { finalQuestionCounter: initialQuestionCounter, state };
    }

    // If the child's variants have already been broken up into slices via `initializeSelectState`, above,
    // this calculation based on activity state will take that into account.
    // In particular, if `numToSelect` > 1, each child should report just one variant.
    const numVariantsPerChild = state.allChildren.map((a) =>
        calcNumVariantsFromState(a, numActivityVariants),
    );

    // If `selectByVariants` is true, then the number of available options
    // is the total number of variants of all child activities.
    // Otherwise, the number of available options is the number of child activities.
    const totalNumOptions = source.selectByVariant
        ? numVariantsPerChild.reduce((a, c) => a + c)
        : numChildren;

    if (numToSelect > totalNumOptions) {
        if (source.selectByVariant) {
            throw Error(
                `For a select activity, "number to select" is ${numToSelect.toString()}, which is larger than the number of available variants (${totalNumOptions.toString()}).`,
            );
        } else {
            const totalNumChildVariants = numVariantsPerChild.reduce(
                (a, c) => a + c,
            );
            if (numToSelect > totalNumChildVariants) {
                throw Error(
                    `For a select activity, "number to select" is ${numToSelect.toString()}, which is larger than the number of available activities (${totalNumOptions.toString()}).`,
                );
            } else {
                throw Error(
                    `For a select activity, "number to select" is ${numToSelect.toString()}, which is larger than the number of available activities (${totalNumOptions.toString()}). (Turning on "select by variant" will add enough options for the select activity to function.)`,
                );
            }
        }
    }

    const childIdToIdx: Record<string, number> = {};
    for (const [idx, child] of state.allChildren.entries()) {
        childIdToIdx[child.id] = idx;
    }

    // Goal: randomly select `numToSelect` options from `source.activities`,
    // where an option is either a child activity (if `selectByVariants` is `false`)
    // on a variant of a child activity (if `selectByVariants` is `true`.)

    // Strategy: over the course of consecutive attempts, we select each option once before selecting repeats
    // (though we do not allow any repeats in a group of selections if `numToSelect` is larger than 1).
    // Break consecutive selections down into groups of size `totalNumOptions`,
    // where each option is selected exactly once per group.

    // Further notes for the ase when `selectByVariants` is `true`:
    // If `selectByVariants` is `true`, the goal is to select individual variants of children.
    // However, we don't actually select the variants, but simply select children multiple times,
    // weighted by the number of variants, delegating the actually selection of variants to the child.
    // The actual number of variants of a child may be larger than the calculated `numVariantsPerChild`,
    // and the child activity has access to more information to select the variants.

    // total number of options selected in previous attempts
    const numPrevSelected = numToSelect * state.attemptNumber;

    // The total number of options selected so far in our current group of size `totalNumOptions`
    const numInGroup = numPrevSelected % totalNumOptions;

    const numLeftInGroup = totalNumOptions - numInGroup;

    // Go back to the previous `numInGroup` children
    // and count how many times each child has already been selected
    const childCountsInGroup = Array<number>(numChildren).fill(0);
    for (const childId of [...state.previousSelections]
        .reverse()
        .slice(0, numInGroup)) {
        childCountsInGroup[childIdToIdx[childId]]++;
    }

    // List of the children left in group, where the child's index is repeated
    // based on the number of its variants left in the group.
    const childOptionsLeft = childCountsInGroup.flatMap((cnt, idx) => {
        if (source.selectByVariant) {
            return Array<number>(numVariantsPerChild[idx] - cnt).fill(idx);
        } else {
            if (cnt) {
                return [];
            } else {
                return [idx];
            }
        }
    });

    if (childOptionsLeft.length !== numLeftInGroup) {
        throw Error("we did something wrong");
    }

    const rngSeed =
        state.initialVariant.toString() +
        "|" +
        state.id.toString() +
        "|" +
        state.attemptNumber.toString() +
        "|" +
        parentAttempt.toString();

    const rng = rngClass(rngSeed);

    const childrenChosen: number[] = [];

    // randomly pick from childOptionsLeft without replacement
    for (let i = 0; i < Math.min(numToSelect, numLeftInGroup); i++) {
        const idx = Math.floor(rng() * childOptionsLeft.length);
        const newChildInd = childOptionsLeft.splice(idx, 1)[0];
        childrenChosen.push(newChildInd);
    }

    if (numToSelect > numLeftInGroup) {
        // We need to select more items than child variant options left, i.e., start a new group.
        // Select any additional items from the options that were initially excluded,
        // i.e., from items that were in the original group before we started this attempt.

        // Initialize to the array of the child variants,
        // represented by the (possibly repeated) indices of the children,
        // that were in the previous group
        const nextChildOptions = childCountsInGroup.flatMap((cnt, idx) => {
            if (source.selectByVariant) {
                return Array<number>(cnt).fill(idx);
            } else {
                if (cnt) {
                    return [idx];
                } else {
                    return [];
                }
            }
        });

        // randomly pick from nextChildOptions without replacement
        for (let i = 0; i < numToSelect - numLeftInGroup; i++) {
            const idx = Math.floor(rng() * nextChildOptions.length);
            const newChildInd = nextChildOptions.splice(idx, 1)[0];
            childrenChosen.push(newChildInd);
        }
    }

    // For each child chosen, generate a new activity attempt,
    // storing the state representing this attempt in `newActivityOptionStates`,
    // and appending the state to `newActivityStates`.
    const newActivityStates: ActivityState[] = [];
    const newActivityOptionStates = [...state.allChildren];
    let questionCounter = initialQuestionCounter;

    for (const childIdx of childrenChosen) {
        const { finalQuestionCounter: endCounter, state: newState } =
            generateNewActivityAttempt({
                state: newActivityOptionStates[childIdx],
                numActivityVariants,
                initialQuestionCounter: questionCounter,
                parentAttempt: state.attemptNumber + 1,
            });
        questionCounter = endCounter;

        newActivityOptionStates[childIdx] = newState;

        newActivityStates.push(newState);
    }

    const newState: SelectState = {
        ...state,
        creditAchieved: 0,
        allChildren: newActivityOptionStates,
        attemptNumber: state.attemptNumber + 1,
        selectedChildren: newActivityStates,
        previousSelections: [
            ...state.previousSelections,
            ...newActivityStates.map((s) => s.id),
        ],
        initialQuestionCounter,
    };

    return { finalQuestionCounter: questionCounter, state: newState };
}

/**
 * For a select-multiple, generate a new attempt that replaces just the selection given by `childId`
 * and leaves all other selections unchanged.
 */
export function generateNewSingleDocAttemptForMultiSelect({
    state,
    numActivityVariants,
    initialQuestionCounter,
    parentAttempt,
    childId,
}: {
    state: SelectState;
    numActivityVariants: ActivityVariantRecord;
    initialQuestionCounter: number;
    parentAttempt: number;
    childId: string;
}): { finalQuestionCounter: number; state: SelectState } {
    const source = state.source;
    const numToSelect = source.numToSelect;

    if (numToSelect === 1 || state.attemptNumber === 0) {
        throw Error(
            "no reason to call when selecting just one item or for first attempt",
        );
    }

    const numChildren = state.allChildren.length;

    const childIdToIdx: Record<string, number> = {};
    for (const [idx, child] of state.allChildren.entries()) {
        childIdToIdx[child.id] = idx;
    }

    // Note: when selecting a child to replace `childId`, we apply two rules:
    // 1. exclude from selection any of the other currently selected children, and
    // 2. for the remaining children, look back at previous attempts to make sure
    //    that all options get selected once before allowing repeats,
    //    where the bookkeeping includes all previous selections of those children,
    //    including previous replacements of other children and entire attempts via `generateNewSelectAttempt`.

    // First, we exclude all the currently selected sources for this attempt
    const otherSelectedIds = state.selectedChildren
        .filter((a) => a.id !== childId)
        .map((a) => a.id);

    if (otherSelectedIds.length !== numToSelect - 1) {
        throw Error("We made a miscalculation");
    }

    // We'll select from all the other ids (which includes this child's id)
    const idOptions = state.allChildren
        .map((s) => s.id)
        .filter((id) => !otherSelectedIds.includes(id));
    const numOptions = idOptions.length;

    // We apply the same algorithm as if we had `numToSelect=1` for this list of ids.
    // We create a list of when these ids were selected, create groups of `numOptions`,
    // and exclude those id's that are in our current group.
    // (We don't worry that the current group might have duplicate ids.)
    const prevSelectionOfOptions = state.previousSelections.filter(
        (id) => !otherSelectedIds.includes(id),
    );

    const numPrevSelections = prevSelectionOfOptions.length;
    const numInGroup = numPrevSelections % numOptions;
    const additionalExcludes = prevSelectionOfOptions.slice(
        numPrevSelections - numInGroup,
        numPrevSelections,
    );

    // The complete list of all the activities were are excluding from selection,
    // represented by their index into `allChildren`
    const idxOfAllExcluded = [...otherSelectedIds, ...additionalExcludes]
        .map((id) => childIdToIdx[id])
        .sort((a, b) => a - b);

    // The slot number (in the latest attempts activity) that we are replacing
    const slotNum = state.selectedChildren.map((a) => a.id).indexOf(childId);

    const rngSeed =
        state.initialVariant.toString() +
        "|" +
        state.id.toString() +
        "|" +
        state.attemptNumber.toString() +
        "|" +
        parentAttempt.toString();

    const rng = rngClass(rngSeed);

    let selectedIdx = Math.floor(
        rng() * (numChildren - idxOfAllExcluded.length),
    );
    for (const excludedIdx of idxOfAllExcluded) {
        if (selectedIdx >= excludedIdx) {
            selectedIdx++;
        }
    }

    const newActivityStates = [...state.selectedChildren];
    const newActivityOptionStates = [...state.allChildren];

    // Generate a new attempt for the selected child
    const { finalQuestionCounter, state: newChildState } =
        generateNewActivityAttempt({
            state: newActivityOptionStates[selectedIdx],
            numActivityVariants,
            initialQuestionCounter,
            parentAttempt: state.attemptNumber + 1,
        });

    newActivityOptionStates[selectedIdx] = newChildState;
    newActivityStates[slotNum] = newChildState;

    // calculate the credit achieved assuming the score for `slotNum` is zero
    const latestOtherCreditAchieved = state.selectedChildren
        .filter((_, i) => i != slotNum)
        .map((a) => a.creditAchieved);
    const creditAchieved =
        latestOtherCreditAchieved.reduce((a, c) => a + c, 0) /
        state.selectedChildren.length;

    const newState: SelectState = {
        ...state,
        allChildren: newActivityOptionStates,
        selectedChildren: newActivityStates,
        creditAchieved,
        previousSelections: [...state.previousSelections, newChildState.id],
        initialQuestionCounter,
    };

    return { finalQuestionCounter, state: newState };
}

/**
//  * Recurse through the descendants of `activityState`,
//  * returning an array of score information of the latest single document activities,
//  * or of select activities that select a single document.
 */
export function extractSelectItemCredit(
    activityState: SelectState,
    nPrevInShuffleOrder = 0,
): {
    id: string;
    score: number;
    docId: string;
    shuffledOrder: number;
    variant: number;
}[] {
    if (activityState.attemptNumber === 0) {
        const nChildren = activityState.allChildren.length;
        if (nChildren === 0) {
            return [];
        }
        // just select the items in order to give results that are at least in the right form
        const results: {
            id: string;
            score: number;
            docId: string;
            shuffledOrder: number;
            variant: number;
        }[] = [];
        let nPrev = nPrevInShuffleOrder;

        for (let i = 0; i < activityState.source.numToSelect; i++) {
            const childState = activityState.allChildren[i % nChildren];
            const next = extractActivityItemCredit(childState, nPrev);
            nPrev += next.length;
            results.push(...next);
        }
        return results;
    }
    if (
        activityState.source.numToSelect === 1 &&
        activityState.allChildren.every((child) => child.type === "singleDoc")
    ) {
        // The select acts like a single question, so we just use it's credit achieved
        return [
            {
                id: activityState.id,
                score: activityState.creditAchieved,
                docId: activityState.selectedChildren[0].id,
                shuffledOrder: nPrevInShuffleOrder + 1,
                variant: (activityState.selectedChildren[0] as SingleDocState)
                    .currentVariant,
            },
        ];
    } else {
        let nPrev = nPrevInShuffleOrder;
        return activityState.selectedChildren.flatMap((state) => {
            const next = extractActivityItemCredit(state, nPrev);
            nPrev += next.length;
            return next;
        });
    }
}

/**
 * Remove all references to source from `activityState`, forming an instance of `ActivityStateNoSource`
 * that is intended to be saved to a database.
 */
export function pruneSelectStateForSave(
    activityState: SelectState,
): SelectStateNoSource {
    const { source: _source, ...newState } = { ...activityState };

    const allChildren = newState.allChildren.map((child) =>
        pruneActivityStateForSave(child),
    );

    const selectedChildren = newState.selectedChildren.map((child) =>
        pruneActivityStateForSave(child),
    );

    return { ...newState, allChildren, selectedChildren };
}

/** Reverse the effect of `pruneSelectStateForSave by adding back adding back references to the source */
export function addSourceToSelectState(
    activityState: SelectStateNoSource,
    source: SelectSource,
): SelectState {
    const allChildren = activityState.allChildren.map((child) => {
        const idx = source.items.findIndex(
            (src) => src.id === extractSourceId(child.id),
        );
        return addSourceToActivityState(child, source.items[idx]);
    });

    const selectedChildren = activityState.selectedChildren.map((child) => {
        const idx = source.items.findIndex(
            (src) => src.id === extractSourceId(child.id),
        );
        return addSourceToActivityState(child, source.items[idx]);
    });

    return {
        ...activityState,
        source,
        allChildren,
        selectedChildren,
    };
}

/**
 * Assuming that `numActivityVariants` contains the number of variants for all single doc activities,
 * calculate the number of unique variants of the the activity given by `source`.
 *
 * The activity could contain more variants than the returned value, but the value is
 * the number of unique variants that have no overlap with each other.
 */
export function calcNumVariantsSelect(
    source: SelectSource,
    numActivityVariants: ActivityVariantRecord,
): number {
    // To calculate the number of completely unique variants,
    // add up the variants of all items and divide by the number to select

    const numVariantsTot = source.items.reduce(
        (a, c) => a + calcNumVariants(c, numActivityVariants),
        0,
    );

    return Math.floor(numVariantsTot / source.numToSelect);
}

/**
 * Return the number of documents that will be rendered by this select.
 *
 * Throw an error if this select has options with different numbers of documents.
 */
export function getNumItemsInSelect(source: SelectSource): number {
    if (source.items.length === 0) {
        return 0;
    }

    const numDocumentsPerItem = getNumItems(source.items[0]);

    if (source.items.length > 1) {
        for (const item of source.items.slice(1)) {
            if (getNumItems(item) !== numDocumentsPerItem) {
                throw Error(
                    "The case where a select has options with different numbers of documents is not implemented",
                );
            }
        }
    }

    return source.numToSelect * numDocumentsPerItem;
}
