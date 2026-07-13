import "./assignment-viewer.css";
import {
    Component,
    ErrorInfo,
    ReactNode,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import seedrandom from "seedrandom";
import { Viewer } from "./Viewer/Viewer";
import { DoenetMLFlags } from "./types";
import {
    ActivitySource,
    collectDoenetmlVersions,
} from "./Activity/activityState";
import { useResolvedTheme } from "./utils/theme";
import type { ThemeSetting } from "./utils/theme";

/**
 * A condition in the provided activity worth surfacing to the user — passed
 * to `reportWarningsCallback`, since a console warning is invisible to the
 * site's visitors. How (and whether) to display it is the containing page's
 * decision.
 */
export type ActivityViewerWarning = {
    type: "mixedDoenetmlVersions";
    /**
     * The distinct DoenetML versions the assignment's documents request, in
     * first-appearance order. Every embedded viewer downloads and parses
     * the multi-MB standalone bundle for its document's version, so mixing
     * versions multiplies that cost by the number of distinct versions.
     * (Normalizing the `version` fields in the source avoids it; saved
     * student state is keyed on a hash that ignores `version`, so it
     * survives such a change.)
     */
    versions: string[];
};

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

// A stable default identity: an inline `= {}` default would be a fresh
// object every render, making the `flags` memo below recompute (and hand the
// memoized Activity tree a fresh `flags` identity) whenever the consumer
// omits the prop.
const NO_FLAGS: DoenetMLFlagsSubset = {};

export function ActivityViewer({
    source,
    flags: specifiedFlags = NO_FLAGS,
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
    doenetViewerUrl,
    fetchExternalDoenetML,
    darkMode = "system",
    showAnswerResponseMenu = false,
    answerResponseCountsByItem = [],
    includeVariantSelector: _includeVariantSelector = false,
    showTitle = true,
    itemWord = "item",
    reportWarningsCallback,
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
    doenetViewerUrl?: string;
    fetchExternalDoenetML?: (arg: string) => Promise<string>;
    darkMode?: ThemeSetting;
    showAnswerResponseMenu?: boolean;
    answerResponseCountsByItem?: Record<string, number>[];
    includeVariantSelector?: boolean;
    showTitle?: boolean;
    itemWord?: string;
    /**
     * Called with conditions in `source` worth surfacing to the user, e.g.
     * an assignment mixing DoenetML versions. Invoked once per distinct set
     * of warnings — not on every render, and not again when the consumer
     * passes a fresh-but-equal `source` each render. The containing page
     * decides how to display them; a `console.warn` is also emitted for
     * developers.
     */
    reportWarningsCallback?: (warnings: ActivityViewerWarning[]) => void;
}) {
    const [initialVariantIndex, setInitialVariantIndex] = useState<
        number | null
    >(null);

    const resolvedTheme = useResolvedTheme(darkMode);

    const warnings = useMemo<ActivityViewerWarning[]>(() => {
        let versions: string[];
        try {
            versions = collectDoenetmlVersions(source);
        } catch {
            // An unwalkable source produces its own error screen.
            return [];
        }
        if (versions.length > 1) {
            return [{ type: "mixedDoenetmlVersions", versions }];
        }
        return [];
    }, [source]);

    // Report each distinct set of warnings at most once — not once per
    // render. `warnings` is a fresh array whenever the consumer passes a
    // new-but-equal `source` object each render (the same pattern
    // `propSetKey` below is built to tolerate), so dedupe on the serialized
    // content rather than on the array identity. The callback is read through
    // a ref so a change in its identity alone never triggers a re-report.
    const reportWarningsCallbackRef = useRef(reportWarningsCallback);
    useEffect(() => {
        reportWarningsCallbackRef.current = reportWarningsCallback;
    });
    const lastReportedWarningsKey = useRef<string | null>(null);
    useEffect(() => {
        const warningsKey = JSON.stringify(warnings);
        if (warningsKey === lastReportedWarningsKey.current) {
            return;
        }
        lastReportedWarningsKey.current = warningsKey;
        if (warnings.length === 0) {
            return;
        }
        for (const warning of warnings) {
            // `mixedDoenetmlVersions` is currently the only type.
            console.warn(
                `ActivityViewer: this assignment mixes DoenetML versions (${warning.versions.join(
                    ", ",
                )}). Each distinct version loads its own multi-MB standalone bundle; normalize the documents' \`version\` fields to avoid the multiplied download/parse cost (saved state survives, as its hash ignores \`version\`).`,
            );
        }
        reportWarningsCallbackRef.current?.(warnings);
    }, [warnings]);

    // Serializing the source is how prop "sameness" is detected for
    // consumers that pass a fresh `source` object each render; memoize it so
    // the (potentially large) assignment is only serialized when the
    // identity actually changes.
    const propSetKey = useMemo(
        () => JSON.stringify([source, activityId, requestedVariantIndex]),
        [source, activityId, requestedVariantIndex],
    );
    const [lastPropSetKey, setLastPropSetKey] = useState<string | null>(null);

    const flags: DoenetMLFlags = useMemo(
        () => ({ ...defaultFlags, ...specifiedFlags }),
        [specifiedFlags],
    );

    // Normalize variant index to an integer.
    // Generate a random variant index if the requested variant index is undefined.
    // To preserve the generated variant index on rerender, regenerate only
    // when one of the identifying props changed (the sanctioned
    // adjust-state-during-render pattern).
    if (propSetKey !== lastPropSetKey) {
        setLastPropSetKey(propSetKey);
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
            <div className="assignment-viewer-root" data-theme={resolvedTheme}>
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
                    doenetViewerUrl={doenetViewerUrl}
                    fetchExternalDoenetML={fetchExternalDoenetML}
                    darkMode={resolvedTheme}
                    showAnswerResponseMenu={showAnswerResponseMenu}
                    answerResponseCountsByItem={answerResponseCountsByItem}
                    showTitle={showTitle}
                    itemWord={itemWord}
                />
            </div>
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
