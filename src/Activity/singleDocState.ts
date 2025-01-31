// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { prng_alea } from "esm-seedrandom";
import { calcNumVariantsFromState } from "./activityState";

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const rngClass = prng_alea;

export type SingleDocSource = {
    type: "singleDoc";
    id: string;
    title?: string;
    isDescription: boolean;
    doenetML: string;
    version: string;
};

export type SingleDocState = {
    type: "singleDoc";
    id: string;
    parentId: string | null;
    source: SingleDocSource;
    initialVariant: number;
    creditAchieved: number;
    attempts: SingleDocAttemptState[];
    restrictToVariantSlice?: { idx: number; numSlices: number };
};

export type SingleDocAttemptState = {
    variant: number;
    doenetState: unknown;
    creditAchieved: number;
    initialQuestionCounter: number;
};

export type SingleDocStateNoSource = Omit<SingleDocState, "source">;

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

export function initializeSingleDocState({
    source,
    variant,
    parentId,
    restrictToVariantSlice,
}: {
    source: SingleDocSource;
    variant: number;
    parentId: string | null;
    restrictToVariantSlice?: { idx: number; numSlices: number };
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

export function generateNewSingleDocAttempt({
    state,
    numActivityVariants,
    initialQuestionCounter,
    questionCounts,
    parentAttempt,
    resetCredit = false,
    resetAttempts = false,
}: {
    state: SingleDocState;
    numActivityVariants: Record<string, number>;
    initialQuestionCounter: number;
    questionCounts: Record<string, number>;
    parentAttempt: number;
    resetCredit?: boolean;
    resetAttempts?: boolean;
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

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const rng = rngClass(rngSeed);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    let selectedVariant = Math.floor(rng() * numVariantOptions) + 1;
    for (const excludedVariant of variantsToExclude) {
        if (selectedVariant === excludedVariant) {
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

    if (resetAttempts) {
        newState.attempts = [newAttemptState];
    } else {
        newState.attempts = [...newState.attempts, newAttemptState];
    }

    if (resetCredit) {
        newState.creditAchieved = 0;
    }

    return { finalQuestionCounter, state: newState };
}

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

export function pruneSingleDocStateForSave(
    activityState: SingleDocState,
    clearDoenetState: boolean,
): SingleDocStateNoSource {
    const { source: _source, ...newState } = { ...activityState };

    let attempts = [...newState.attempts];

    if (clearDoenetState) {
        attempts = attempts.map((attempt) => ({
            ...attempt,
            doenetState: null,
        }));
    }

    return { ...newState, attempts };
}

export function addSourceToSingleDocState(
    activityState: SingleDocStateNoSource,
    source: SingleDocSource,
): SingleDocState {
    return { ...activityState, source };
}
