import { useRef, useState } from "react";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { prng_alea } from "esm-seedrandom";
import { Viewer } from "./Viewer/Viewer";
import { AssignmentSource, DoenetMLFlags } from "./types";

type DoenetMLFlagsSubset = Partial<DoenetMLFlags>;

const defaultFlags: DoenetMLFlags = {
    showCorrectness: true,
    readOnly: false,
    solutionDisplayMode: "button",
    showFeedback: true,
    showHints: true,
    allowLoadState: false,
    allowSaveState: false,
    allowLocalState: false,
    allowSaveSubmissions: false,
    allowSaveEvents: false,
    autoSubmit: false,
};

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const rngClass = prng_alea;

type PropSet = {
    source: string;
    assignmentId?: string;
    requestedVariantIndex?: number;
};

export function AssignmentViewer({
    source,
    flags: specifiedFlags = {},
    shuffle = false,
    assignmentId = "a",
    attemptNumber = 1,
    requestedVariantIndex,
    maxAttemptsAllowed = Infinity,
    questionLevelAttempts = false,
    assignmentLevelAttempts = false,
    paginate = true,
    showFinishButton = false,
    forceDisable = false,
    forceShowCorrectness = false,
    forceShowSolution = false,
    forceUnsuppressCheckwork = false,
    addVirtualKeyboard = true,
    externalVirtualKeyboardProvided = false,
    linkSettings,
    darkMode = "light",
    showAnswerTitles = false,
    includeVariantSelector = false,
}: {
    source: AssignmentSource;
    flags?: DoenetMLFlagsSubset;
    shuffle?: boolean;
    assignmentId?: string;
    attemptNumber?: number;
    requestedVariantIndex?: number;
    maxAttemptsAllowed?: number;
    questionLevelAttempts?: boolean;
    assignmentLevelAttempts?: boolean;
    paginate?: boolean;
    showFinishButton?: boolean;
    forceDisable?: boolean;
    forceShowCorrectness?: boolean;
    forceShowSolution?: boolean;
    forceUnsuppressCheckwork?: boolean;
    addVirtualKeyboard?: boolean;
    externalVirtualKeyboardProvided?: boolean;
    linkSettings?: { viewURL: string; editURL: string };
    darkMode?: "dark" | "light";
    showAnswerTitles?: boolean;
    includeVariantSelector?: boolean;
}) {
    // const [variants, setVariants] = useState({
    //     index: 1,
    //     numVariants: 1,
    //     allPossibleVariants: ["a"],
    // });

    const [variantIndex, setVariantIndex] = useState<number | null>(null);

    const thisPropSet: PropSet = {
        source: JSON.stringify(source),
        assignmentId,
        requestedVariantIndex,
    };
    const lastPropSet = useRef<PropSet>({ source: "" });

    const flags: DoenetMLFlags = { ...defaultFlags, ...specifiedFlags };

    // Normalize variant index to an integer.
    // Generate a random variant index if the requested variant index is undefined.
    // To preserve the generated variant index on rerender,
    // regenerate only if one of the props in propSet has changed
    let foundPropChange = false;
    let key: keyof PropSet;
    for (key in thisPropSet) {
        if (thisPropSet[key] !== lastPropSet.current[key]) {
            foundPropChange = true;
        }
    }
    lastPropSet.current = thisPropSet;

    if (foundPropChange) {
        if (requestedVariantIndex === undefined) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
            const rng = new rngClass(new Date());
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            setVariantIndex(Math.floor(rng() * 1000000) + 1);
        } else {
            setVariantIndex(
                Number.isInteger(requestedVariantIndex)
                    ? requestedVariantIndex
                    : 1,
            );
        }
    }

    if (variantIndex === null) {
        return null;
    }

    console.log({ flags, variantIndex, includeVariantSelector });

    return (
        <Viewer
            source={source}
            flags={flags}
            shuffle={shuffle}
            assignmentId={assignmentId}
            attemptNumber={attemptNumber}
            variantIndex={variantIndex}
            maxAttemptsAllowed={maxAttemptsAllowed}
            questionLevelAttempts={questionLevelAttempts}
            assignmentLevelAttempts={assignmentLevelAttempts}
            paginate={paginate}
            showFinishButton={showFinishButton}
            forceDisable={forceDisable}
            forceShowCorrectness={forceShowCorrectness}
            forceShowSolution={forceShowSolution}
            forceUnsuppressCheckwork={forceUnsuppressCheckwork}
            addVirtualKeyboard={addVirtualKeyboard}
            externalVirtualKeyboardProvided={externalVirtualKeyboardProvided}
            linkSettings={linkSettings}
            darkMode={darkMode}
            showAnswerTitles={showAnswerTitles}
        />
    );
}
