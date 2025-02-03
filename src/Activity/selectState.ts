import {
    ActivityVariantRecord,
    QuestionCountRecord,
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
    initializeActivityState,
    isActivitySource,
    isActivityState,
    isActivityStateNoSource,
    pruneActivityStateForSave,
} from "./activityState";

import seedrandom from "seedrandom";

const rngClass = seedrandom.alea;

export type SelectSource = {
    type: "select";
    id: string;
    title?: string;
    items: ActivitySource[];
    numToSelect: number;
    weights?: number[];
};

export type SelectState = {
    type: "select";
    id: string;
    parentId: string | null;
    source: SelectSource;
    initialVariant: number;
    creditAchieved: number;
    latestChildStates: ActivityState[];
    attempts: SelectAttemptState[];
    restrictToVariantSlice?: RestrictToVariantSlice;
};

export type SelectAttemptState = {
    activities: ActivityState[];
    creditAchieved: number;
    initialQuestionCounter: number;
    singleQuestionReplacementIdx?: number;
};

export type SelectStateNoSource = Omit<
    SelectState,
    "source" | "latestChildStates" | "attempts"
> & {
    latestChildStates: ActivityStateNoSource[];
    attempts: {
        activities: ActivityStateNoSource[];
        creditAchieved: number;
        initialQuestionCounter: number;
        singleQuestionReplacementIdx?: number;
    }[];
};

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
        (typedObj.weights === undefined ||
            (Array.isArray(typedObj.weights) &&
                typedObj.weights.every(
                    (weight) => typeof weight === "number",
                ))) &&
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
        Array.isArray(typedObj.latestChildStates) &&
        typedObj.latestChildStates.every(isActivityState) &&
        Array.isArray(typedObj.attempts) &&
        typedObj.attempts.every(
            (attempt) =>
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                attempt !== null &&
                typeof attempt === "object" &&
                typeof attempt.creditAchieved === "number" &&
                Array.isArray(attempt.activities) &&
                attempt.activities.every(isActivityState),
        )
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
        Array.isArray(typedObj.latestChildStates) &&
        typedObj.latestChildStates.every(isActivityStateNoSource) &&
        Array.isArray(typedObj.attempts) &&
        typedObj.attempts.every(
            (attempt) =>
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                attempt !== null &&
                typeof attempt === "object" &&
                typeof attempt.creditAchieved === "number" &&
                Array.isArray(attempt.activities) &&
                attempt.activities.every(isActivityStateNoSource),
        )
    );
}

/**
 * Initialize activity state from `source` so that it is ready to generate attempts.
 *
 * Populates all the activities through the `latestChildStates` field,
 * similar to the behavior of `getUninitializedActivityState`,
 * only this time it takes advantage of `numActivityVariants`,
 * which stores of the number of variants calculated for each single doc activity.
 *
 * If the `numToSelect` parameter from `source` is larger than one,
 * then create a separate child for each variant of each child
 * (using `numActivityVariants` to determine the number of variants for each child)
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

    if (source.numToSelect === 1) {
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
        // We are selecting multiple items.
        // Create a separate child state for each variant of each child
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
        latestChildStates: childStates,
        attempts: [],
        restrictToVariantSlice,
    };
}

export function generateNewSelectAttempt({
    state,
    numActivityVariants,
    initialQuestionCounter,
    questionCounts,
    parentAttempt,
    resetCredit = false,
}: {
    state: SelectState;
    numActivityVariants: ActivityVariantRecord;
    initialQuestionCounter: number;
    questionCounts: QuestionCountRecord;
    parentAttempt: number;
    resetCredit?: boolean;
}): { finalQuestionCounter: number; state: SelectState } {
    const source = state.source;
    const numToSelect = source.numToSelect;
    const numChildren = state.latestChildStates.length;
    const numVariantsPerChild = state.latestChildStates.map((a) =>
        calcNumVariantsFromState(a, numActivityVariants),
    );
    const totalNumChildVariants = numVariantsPerChild.reduce((a, c) => a + c);

    if (numToSelect > totalNumChildVariants) {
        throw Error(
            "numToSelect is larger than the number of available variants",
        );
    }

    const childIdToIdx: Record<string, number> = {};
    for (const [idx, child] of state.latestChildStates.entries()) {
        childIdToIdx[child.id] = idx;
    }

    // Goal: randomly select `numToSelect` child variants from `source.activities`
    // weighted by the number of unique variants for each child.
    // However, we don't actually pick the child variant here,
    // just the number of times the child is selected,
    // as the child is responsible for determining its variants.

    // Strategy: to spread out the variants selected,
    // choose child variants in groups of size `totalNumChildVariants`,
    // where each child variant is selected exactly once per group.

    // Note: the algorithm is easier to understand if one thinks of selecting a variant for each child,
    // even though we actually just select a child and ignore the variant.

    // Rationale for ignoring actual child variants:
    // `numVariantsPerChild` is actually just a lower bound on the number of unique variants per child.
    // We use that number to determine how often to select a child variant,
    // but delegate to the child the algorithm for selecting the variant.

    // total number of child variants selected in previous attempts
    const numPrevChildVariants = numToSelect * state.attempts.length;

    // The total number of child variants selected so far in our current group of size `totalNumChildVariants`
    const numChildVariantsInGroup =
        numPrevChildVariants % totalNumChildVariants;
    const numChildVariantsLeft =
        totalNumChildVariants - numChildVariantsInGroup;

    // Go back to the previous `numChildVariantsInGroup` children
    // and count how many times each child has already been selected
    const childCountsInGroup = Array<number>(numChildren).fill(0);
    for (const childId of state.attempts
        .flatMap((attempt) => attempt.activities.map((activity) => activity.id))
        .reverse()
        .slice(0, numChildVariantsInGroup)) {
        childCountsInGroup[childIdToIdx[childId]]++;
    }

    // List of the children left in group, where the child's index is repeated
    // based on the number of its variants left in the group.
    const childOptionsLeft = childCountsInGroup.flatMap((cnt, idx) =>
        Array<number>(numVariantsPerChild[idx] - cnt).fill(idx),
    );

    if (childOptionsLeft.length !== numChildVariantsLeft) {
        throw Error("we did something wrong");
    }

    const rngSeed =
        state.initialVariant.toString() +
        "|" +
        state.id.toString() +
        "|" +
        state.attempts.length.toString() +
        "|" +
        parentAttempt.toString();

    const rng = rngClass(rngSeed);

    const childrenChosen: number[] = [];

    // randomly pick from childOptionsLeft without replacement
    for (let i = 0; i < Math.min(numToSelect, numChildVariantsLeft); i++) {
        const idx = Math.floor(rng() * childOptionsLeft.length);
        const newChildInd = childOptionsLeft.splice(idx, 1)[0];
        childrenChosen.push(newChildInd);
    }

    if (numToSelect > numChildVariantsLeft) {
        // We need to select more items than child variant options left, i.e., start a new group.
        // Select any additional items from the options that were initially excluded,
        // i.e., from items that were in the original group before we started this attempt.

        // Initialize to the array of the child variants,
        // represented by the (possibly repeated) indices of the children,
        // that were in the previous group
        const nextChildOptions = childCountsInGroup.flatMap((cnt, idx) =>
            Array<number>(cnt).fill(idx),
        );

        // randomly pick from nextChildOptions without replacement
        for (let i = 0; i < numToSelect - numChildVariantsLeft; i++) {
            const idx = Math.floor(rng() * nextChildOptions.length);
            const newChildInd = nextChildOptions.splice(idx, 1)[0];
            childrenChosen.push(newChildInd);
        }
    }

    // For each child chosen, generate a new activity attempt,
    // storing the state representing this attempt in `newActivityOptionStates`,
    // and appending the state to `newActivityStates`.
    const newActivityStates: ActivityState[] = [];
    const newActivityOptionStates = [...state.latestChildStates];
    let questionCounter = initialQuestionCounter;

    for (const childIdx of childrenChosen) {
        const { finalQuestionCounter: endCounter, state: newState } =
            generateNewActivityAttempt({
                state: newActivityOptionStates[childIdx],
                numActivityVariants,
                initialQuestionCounter: questionCounter,
                questionCounts,
                parentAttempt: state.attempts.length + 1,
                resetCredit: true,
            });
        questionCounter = endCounter;

        newActivityOptionStates[childIdx] = newState;

        newActivityStates.push(newState);
    }

    const newAttemptState: SelectAttemptState = {
        activities: newActivityStates,
        creditAchieved: 0,
        initialQuestionCounter,
    };

    const newState: SelectState = {
        ...state,
        latestChildStates: newActivityOptionStates,
    };

    newState.attempts = [...newState.attempts, newAttemptState];

    if (resetCredit) {
        newState.creditAchieved = 0;
    }

    return { finalQuestionCounter: questionCounter, state: newState };
}

export function generateNewSingleDocAttemptForMultiSelect({
    state,
    numActivityVariants,
    initialQuestionCounter,
    questionCounts,
    parentAttempt,
    childId,
}: {
    state: SelectState;
    numActivityVariants: ActivityVariantRecord;
    initialQuestionCounter: number;
    questionCounts: QuestionCountRecord;
    parentAttempt: number;
    childId: string;
}): { finalQuestionCounter: number; state: SelectState } {
    const source = state.source;
    const numToSelect = source.numToSelect;

    if (numToSelect === 1 || state.attempts.length === 0) {
        throw Error(
            "no reason to call when selecting just one item or for first attempt",
        );
    }

    const numChildren = state.latestChildStates.length;

    const childIdToIdx: Record<string, number> = {};
    for (const [idx, child] of state.latestChildStates.entries()) {
        childIdToIdx[child.id] = idx;
    }

    // Randomly select a child for childIdx, but exclude all the current selected sources for this attempt
    const lastAttempt = state.attempts[state.attempts.length - 1];

    const otherSelectedIds = lastAttempt.activities
        .filter((a) => a.id !== childId)
        .map((a) => a.id);

    if (otherSelectedIds.length !== numToSelect - 1) {
        throw Error("We made a miscalculation");
    }

    // We'll select from all the other ids (which includes this child's id)
    const idOptions = state.latestChildStates
        .map((s) => s.id)
        .filter((id) => !otherSelectedIds.includes(id));
    const numOptions = idOptions.length;

    // We apply the same algorithm as if we had `numToSelect=1` for this list of ids.
    // We create a list of when these ids were selected, create groups of `numOptions`,
    // and exclude those id's that are in our current group.
    // (We don't worry that the current group might have duplicate ids.)
    const prevSelectionOfOptions = state.attempts.flatMap((attempt) => {
        if (attempt.singleQuestionReplacementIdx === undefined) {
            return attempt.activities
                .map((activity) => activity.id)
                .filter((id) => !otherSelectedIds.includes(id));
        } else {
            // if the select attempt just replaced a single question, only count that question
            const changedId =
                attempt.activities[attempt.singleQuestionReplacementIdx].id;
            if (otherSelectedIds.includes(changedId)) {
                return [];
            } else {
                return [changedId];
            }
        }
    });

    const numPrevSelections = prevSelectionOfOptions.length;
    const numInGroup = numPrevSelections % numOptions;
    const additionalExcludes = prevSelectionOfOptions.slice(
        numPrevSelections - numInGroup,
        numPrevSelections,
    );

    const idxOfAllExcluded = [...otherSelectedIds, ...additionalExcludes]
        .map((id) => childIdToIdx[id])
        .sort((a, b) => a - b);

    const slotNum = lastAttempt.activities.map((a) => a.id).indexOf(childId);

    const rngSeed =
        state.initialVariant.toString() +
        "|" +
        state.id.toString() +
        "|" +
        state.attempts.length.toString() +
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

    const newActivityStates = [...lastAttempt.activities];
    const newActivityOptionStates = [...state.latestChildStates];

    const { finalQuestionCounter, state: newChildState } =
        generateNewActivityAttempt({
            state: newActivityOptionStates[selectedIdx],
            numActivityVariants,
            initialQuestionCounter,
            questionCounts,
            parentAttempt: state.attempts.length + 1,
        });

    const childStatePreserveCredit = { ...newChildState };
    childStatePreserveCredit.creditAchieved =
        lastAttempt.activities[slotNum].creditAchieved;

    newActivityOptionStates[selectedIdx] = childStatePreserveCredit;
    newActivityStates[slotNum] = childStatePreserveCredit;

    const newAttemptState: SelectAttemptState = {
        activities: newActivityStates,
        creditAchieved: lastAttempt.creditAchieved, // keep credit achieved the same
        initialQuestionCounter,
        singleQuestionReplacementIdx: slotNum,
    };

    const newState: SelectState = {
        ...state,
        latestChildStates: newActivityOptionStates,
        attempts: [...state.attempts, newAttemptState],
    };

    return { finalQuestionCounter, state: newState };
}

/**
 * Recurse through the descendants of `activityState`,
 * returning an array of the `creditAchieved` of the latest single document activities,
 * or of select activities that select a single document.
 */
export function extractSelectItemCredit(
    activityState: SelectState,
): { id: string; score: number }[] {
    if (
        activityState.source.numToSelect === 1 &&
        activityState.latestChildStates.every(
            (child) => child.type === "singleDoc",
        )
    ) {
        // The select acts like a single question, so we just use it's credit achieved
        return [{ id: activityState.id, score: activityState.creditAchieved }];
    } else if (activityState.attempts.length === 0) {
        return [{ id: activityState.id, score: 0 }];
    } else {
        const latestAttempt =
            activityState.attempts[activityState.attempts.length - 1];

        return latestAttempt.activities.flatMap((state) =>
            extractActivityItemCredit(state),
        );
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
export function pruneSelectStateForSave(
    activityState: SelectState,
    clearDoenetState: boolean,
): SelectStateNoSource {
    const { source: _source, ...newState } = { ...activityState };

    const latestChildStates = newState.latestChildStates.map((child) =>
        pruneActivityStateForSave(child, true),
    );

    const numAttempts = newState.attempts.length;

    const attempts = newState.attempts.map((attempt, i) => ({
        ...attempt,
        activities: attempt.activities.map((state) =>
            pruneActivityStateForSave(
                state,
                i !== numAttempts - 1 || clearDoenetState,
            ),
        ),
    }));

    return { ...newState, latestChildStates, attempts };
}

/** Reverse the effect of `pruneSelectStateForSave by adding back adding back references to the source */
export function addSourceToSelectState(
    activityState: SelectStateNoSource,
    source: SelectSource,
): SelectState {
    const latestChildStates = activityState.latestChildStates.map((child) => {
        const idx = source.items.findIndex(
            (src) => src.id === extractSourceId(child.id),
        );
        return addSourceToActivityState(child, source.items[idx]);
    });

    const attempts = activityState.attempts.map((attempt) => ({
        ...attempt,
        activities: attempt.activities.map((state) => {
            const idx = source.items.findIndex(
                (src) => src.id === extractSourceId(state.id),
            );
            return addSourceToActivityState(state, source.items[idx]);
        }),
    }));

    return {
        ...activityState,
        source,
        latestChildStates,
        attempts,
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
