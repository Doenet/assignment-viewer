import { Component, ErrorInfo, ReactNode, useRef, useState } from "react";
import seedrandom from "seedrandom";
import { Viewer } from "./Viewer/Viewer";
import { DoenetMLFlags } from "./types";
import { ActivitySource } from "./Activity/activityState";

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

const rngClass = seedrandom.alea;

type PropSet = {
    source: string;
    activityId?: string;
    requestedVariantIndex?: number;
};

export function ActivityViewer({
    source,
    flags: specifiedFlags = {},
    activityId = "a",
    userId = null,
    requestedVariantIndex,
    maxAttemptsAllowed = 1,
    itemLevelAttempts = false,
    activityLevelAttempts = false,
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
    showAnswerResponseMenu = false,
    answerResponseCountsByItem = [],
    includeVariantSelector: _includeVariantSelector = false,
    showTitle = true,
    itemWord = "item",
}: {
    source: ActivitySource;
    flags?: DoenetMLFlagsSubset;
    activityId?: string;
    userId?: string | null;
    requestedVariantIndex?: number;
    maxAttemptsAllowed?: number;
    itemLevelAttempts?: boolean;
    activityLevelAttempts?: boolean;
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
    showAnswerResponseMenu?: boolean;
    answerResponseCountsByItem?: Record<string, number>[];
    includeVariantSelector?: boolean;
    showTitle?: boolean;
    itemWord?: string;
}) {
    // const [variants, setVariants] = useState({
    //     index: 1,
    //     numVariants: 1,
    //     allPossibleVariants: ["a"],
    // });

    const [initialVariantIndex, setInitialVariantIndex] = useState<
        number | null
    >(null);

    const thisPropSet: PropSet = {
        source: JSON.stringify(source),
        activityId,
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
            const rng = rngClass(new Date().toString());
            setInitialVariantIndex(Math.floor(rng() * 1000000) + 1);
        } else {
            setInitialVariantIndex(
                Number.isInteger(requestedVariantIndex)
                    ? requestedVariantIndex
                    : 1,
            );
        }
    }

    if (initialVariantIndex === null) {
        return null;
    }

    return (
        <ErrorBoundary>
            <Viewer
                source={source}
                flags={flags}
                activityId={activityId}
                userId={userId}
                initialVariantIndex={initialVariantIndex}
                maxAttemptsAllowed={maxAttemptsAllowed}
                itemLevelAttempts={itemLevelAttempts}
                activityLevelAttempts={activityLevelAttempts}
                paginate={paginate}
                showFinishButton={showFinishButton}
                forceDisable={forceDisable}
                forceShowCorrectness={forceShowCorrectness}
                forceShowSolution={forceShowSolution}
                forceUnsuppressCheckwork={forceUnsuppressCheckwork}
                addVirtualKeyboard={addVirtualKeyboard}
                externalVirtualKeyboardProvided={
                    externalVirtualKeyboardProvided
                }
                linkSettings={linkSettings}
                darkMode={darkMode}
                showAnswerResponseMenu={showAnswerResponseMenu}
                answerResponseCountsByItem={answerResponseCountsByItem}
                showTitle={showTitle}
                itemWord={itemWord}
            />
        </ErrorBoundary>
    );
}

type ErrorProps = {
    children?: ReactNode;
};

type ErrorState = { hasError: boolean; message: string };

class ErrorBoundary extends Component<ErrorProps, ErrorState> {
    constructor(props: ErrorProps) {
        super(props);
        this.state = { hasError: false, message: "" };
    }

    static getDerivedStateFromError(error: Error): ErrorState {
        return { hasError: true, message: error.message };
    }
    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error", error, errorInfo);
    }
    render() {
        if (this.state.hasError) {
            return (
                <div style={{ marginLeft: "20px" }}>
                    <h1>An error occurred</h1>
                    <p>{this.state.message}</p>
                </div>
            );
        }
        return this.props.children;
    }
}
