import seedrandom from "seedrandom";
import { calcNumVariantsFromState } from "./activityState";
import {
    ActivityVariantRecord,
    QuestionCountRecord,
    RestrictToVariantSlice,
} from "../types";

const rngClass = seedrandom.alea;

/** The source for creating a single doc activity */
export type SingleDocSource = {
    type: "singleDoc";
    id: string;
    title?: string;
    /**
     * If `isDescription` is `true`, then this activity is not considered one of the scored items
     * and its credit achieved is ignored.
     */
    isDescription: boolean;
    doenetML: string;
    /** The version of DoenetML that should be used to render this activity. */
    version: string;
};

/** The current state of a single doc activity, including all attempts. */
export type SingleDocState = {
    type: "singleDoc";
    id: string;
    parentId: string | null;
    source: SingleDocSource;
    /** Used to seed the random number generate to yield the actual variants of each attempt. */
    initialVariant: number;
    /** Credit achieved (between 0 and 1) over all attempts of this activity */
    creditAchieved: number;
    attempts: SingleDocAttemptState[];
    /** See {@link RestrictToVariantSlice} */
    restrictToVariantSlice?: RestrictToVariantSlice;
};

/** The state of an attempt of a single doc activity. */
export type SingleDocAttemptState = {
    /** The variant selected for this attempt */
    variant: number;
    /** A json object containing the state need to reconstitute the activity */
    doenetState: unknown;
    /** Credit achieved (between 0 and 1) on this attempt */
    creditAchieved: number;
    /** The value of the question counter set for the beginning of this activity */
    initialQuestionCounter: number;
};

/**
 * The current state of a single doc activity, where references to the source have been eliminated.
 *
 * Useful for saving to a database, as this extraneously information has been removed.
 */
export type SingleDocStateNoSource = Omit<SingleDocState, "source">;

// type guards

export function isSingleDocSource(obj: unknown): obj is SingleDocSource {
    const typedObj = obj as SingleDocSource;
    return (
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        typedObj !== null &&
        typeof typedObj === "object" &&
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        typedObj.type === "singleDoc" &&
        typeof typedObj.id === "string" &&
        typeof typedObj.isDescription === "boolean" &&
        typeof typedObj.doenetML === "string" &&
        typeof typedObj.version === "string"
    );
}

export function isSingleDocState(obj: unknown): obj is SingleDocState {
    const typedObj = obj as SingleDocState;
    return (
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        typedObj !== null &&
        typeof typedObj === "object" &&
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        typedObj.type === "singleDoc" &&
        typeof typedObj.id === "string" &&
        (typedObj.parentId === null || typeof typedObj.parentId === "string") &&
        isSingleDocSource(typedObj.source) &&
        typeof typedObj.initialVariant === "number" &&
        typeof typedObj.creditAchieved === "number" &&
        Array.isArray(typedObj.attempts) &&
        typedObj.attempts.every(
            (attempt) =>
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                attempt !== null &&
                typeof attempt === "object" &&
                typeof attempt.creditAchieved === "number" &&
                typeof attempt.variant === "number",
        )
    );
}

export function isSingleDocStateNoSource(
    obj: unknown,
): obj is SingleDocStateNoSource {
    const typedObj = obj as SingleDocStateNoSource;
    return (
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        typedObj !== null &&
        typeof typedObj === "object" &&
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        typedObj.type === "singleDoc" &&
        typeof typedObj.id === "string" &&
        (typedObj.parentId === null || typeof typedObj.parentId === "string") &&
        typeof typedObj.initialVariant === "number" &&
        typeof typedObj.creditAchieved === "number" &&
        Array.isArray(typedObj.attempts) &&
        typedObj.attempts.every(
            (attempt) =>
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                attempt !== null &&
                typeof attempt === "object" &&
                typeof attempt.creditAchieved === "number" &&
                typeof attempt.variant === "number",
        )
    );
}

/**
 * Initialize activity state from `source` so that it is ready to generate attempts.
 *
 * If an ancestor was a select-multiple selects, then restrictToVariantSlice
 * will be supplied to restrict this instance to a subset (typically one) of the variants.
 *
 * The provided `variant` will be used to create a seed to randomly generate
 * the variant of attempts.
 */
export function initializeSingleDocState({
    source,
    variant,
    parentId,
    restrictToVariantSlice,
}: {
    source: SingleDocSource;
    variant: number;
    parentId: string | null;
    restrictToVariantSlice?: RestrictToVariantSlice;
}): SingleDocState {
    const extendedId =
        source.id +
        (restrictToVariantSlice === undefined
            ? ""
            : "|" + restrictToVariantSlice.idx.toString());

    return {
        type: "singleDoc",
        id: extendedId,
        parentId,
        source,
        initialVariant: variant,
        creditAchieved: 0,
        attempts: [],
        restrictToVariantSlice,
    };
}

/**
 * Generate a new attempt of this single doc activity, adding the attempt to its `state`, which is returned.
 *
 * Calculate the variant of the new attempt based on the initial variant index stored in the `state`,
 * along with the previously chosen variants.
 * Variants are chosen so that each unique variant is selected once before variants repeat.
 *
 * If the `restrictToVariantSlice` parameter from `state` has previous specified,
 * then the variants selected are restricted to that specified slice.
 *
 * The `initialQuestionCounter` parameter specifies the initial value of the counters for any
 * `<question>`, `<problem>`, or `<exercise>`.
 *
 * Calculates a value for the next question counter (`finalQuestionCounter`) based on
 * the numbers of questions in the new attempt, as specified by `questionCounts`.
 *
 * If `resetCredit` is true, set the `creditAchieved` of the new attempt to zero.
 *
 * The `parentAttempt` counter should be the current attempt number of the parent activity.
 * It is used to ensure that selected variants change with the parent's attempt number.
 *
 * @returns
 * - state: the new activity state
 * - finalQuestionCounter: the question counter to be given as an `initialQuestionCounter` for the next activity
 */
export function generateNewSingleDocAttempt({
    state,
    numActivityVariants,
    initialQuestionCounter,
    questionCounts,
    parentAttempt,
    resetCredit = false,
}: {
    state: SingleDocState;
    numActivityVariants: ActivityVariantRecord;
    initialQuestionCounter: number;
    questionCounts: QuestionCountRecord;
    parentAttempt: number;
    resetCredit?: boolean;
}): { finalQuestionCounter: number; state: SingleDocState } {
    const previousVariants = state.attempts.map((a) => a.variant);
    const numVariants = calcNumVariantsFromState(state, numActivityVariants);

    const numPrevVariants = previousVariants.length;
    const numVariantsToExclude = numPrevVariants % numVariants;
    const numVariantOptions = numVariants - numVariantsToExclude;
    const variantsToExclude = previousVariants
        .slice(numPrevVariants - numVariantsToExclude, numPrevVariants)
        .sort((a, b) => a - b);

    const rngSeed =
        state.initialVariant.toString() +
        "|" +
        state.id.toString() +
        "|" +
        state.attempts.length.toString() +
        "|" +
        parentAttempt.toString();

    const rng = rngClass(rngSeed);
    let selectedVariant = Math.floor(rng() * numVariantOptions) + 1;
    for (const excludedVariant of variantsToExclude) {
        if (selectedVariant >= excludedVariant) {
            selectedVariant++;
        }
    }

    if (state.restrictToVariantSlice) {
        selectedVariant =
            (selectedVariant - 1) * state.restrictToVariantSlice.numSlices +
            state.restrictToVariantSlice.idx;
    }

    const newAttemptState: SingleDocAttemptState = {
        variant: selectedVariant,
        doenetState: null,
        creditAchieved: 0,
        initialQuestionCounter,
    };

    const finalQuestionCounter =
        initialQuestionCounter + questionCounts[state.source.id];

    const newState = { ...state };

    newState.attempts = [...newState.attempts, newAttemptState];

    if (resetCredit) {
        newState.creditAchieved = 0;
    }

    return { finalQuestionCounter, state: newState };
}

/**
 * Return the credit achieved of this single doc activity or an empty array if it is a description.
 */
export function extractSingleDocItemCredit(
    activityState: SingleDocState,
): { id: string; score: number }[] {
    if (activityState.source.isDescription) {
        return [];
    } else {
        return [
            {
                id: activityState.id,
                score: activityState.creditAchieved,
            },
        ];
    }
}

/**
 * Remove all references to source from `activityState`, forming an instance of `ActivityStateNoSource`
 * that is intended to be saved to a database.
 *
 * If `clearDoenetState` is `true`, then also remove the `doenetState`.
 *
 * Even if `clearDoenetState` is `false`, still clear `doenetState` on all but the latest attempt,
 * so the (potentially large) DoenetML state is saved
 * only where needed to reconstitute the activity state.
 */
export function pruneSingleDocStateForSave(
    activityState: SingleDocState,
    clearDoenetState: boolean,
): SingleDocStateNoSource {
    const { source: _source, ...newState } = { ...activityState };

    const numAttempts = newState.attempts.length;

    const attempts = newState.attempts.map((attempt, i) => ({
        ...attempt,
        doenetState:
            clearDoenetState || i !== numAttempts - 1
                ? null
                : attempt.doenetState,
    }));

    return { ...newState, attempts };
}

/** Reverse the effect of `pruneSingleDocStateForSave by adding back adding back references to the source */
export function addSourceToSingleDocState(
    activityState: SingleDocStateNoSource,
    source: SingleDocSource,
): SingleDocState {
    return { ...activityState, source };
}
