import { memo, useEffect, useMemo, useRef, useState } from "react";
import { DoenetViewer } from "@doenet/doenetml-iframe";
import { SingleDocState } from "./singleDocState";
import type { ActivityCommonProps } from "./Activity";

type SingleDocActivityProps = Omit<
    ActivityCommonProps,
    | "doenetStates"
    | "itemAttemptNumbers"
    | "answerResponseCountsByItem"
    | "itemIndexById"
> & {
    state: SingleDocState;
    /** This item's saved Doenet state (its slice of `doenetStates`). */
    doenetState: unknown;
    itemAttemptNumber: number;
    answerResponseCounts?: Record<string, number>;
};

export const SingleDocActivity = memo(function SingleDocActivity({
    flags,
    baseId,
    maxAttemptsAllowed,
    forceDisable = false,
    forceShowCorrectness = false,
    forceShowSolution = false,
    forceUnsuppressCheckwork = false,
    doenetViewerUrl,
    fetchExternalDoenetML,
    darkMode = "light",
    showAnswerResponseMenu = false,
    answerResponseCounts,
    state,
    doenetState,
    stateVersion,
    reportScoreAndStateCallback,
    checkRender,
    checkHidden,
    allowItemAttemptButtons = false,
    generateNewItemAttempt,
    hasRenderedCallback,
    reportVisibility = false,
    reportVisibilityCallback,
    itemAttemptNumber,
    itemWord,
}: SingleDocActivityProps) {
    const [rendered, setRendered] = useState(false);

    const [attemptNumber, setAttemptNumber] = useState(state.attemptNumber);
    const [stateVersionUsed, setStateVersionUsed] = useState(stateVersion);
    const [initialDoenetState, setInitialDoenetState] = useState<Record<
        string,
        unknown
    > | null>(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (doenetState ?? null) as Record<string, any> | null,
    );

    const [requestedVariantIndex, setRequestedVariantIndex] = useState(
        state.currentVariant,
    );

    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (reportVisibility && ref.current) {
            const observer = new IntersectionObserver(
                ([entry]) => {
                    reportVisibilityCallback(state.id, entry.isIntersecting);
                },
                { rootMargin: "1000px 1000px 1000px 1000px" },
            );

            observer.observe(ref.current);

            return () => {
                observer.disconnect();
            };
        }
    }, [reportVisibility, ref, reportVisibilityCallback, state.id]);

    // The initial Doenet state is deliberately *frozen*: it seeds the viewer
    // and must not follow every subsequent report (the viewer owns the live
    // state). It is re-read only when the item gets a new attempt or the
    // whole activity's state is externally (re)loaded (`stateVersion`).
    if (
        state.attemptNumber !== attemptNumber ||
        stateVersionUsed !== stateVersion
    ) {
        setAttemptNumber(state.attemptNumber);
        setStateVersionUsed(stateVersion);

        setInitialDoenetState(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (doenetState ?? null) as Record<string, any> | null,
        );

        setRequestedVariantIndex(state.currentVariant);
    }

    const initialCounters = useMemo(
        () => ({
            question: state.initialQuestionCounter,
            problem: state.initialQuestionCounter,
            exercise: state.initialQuestionCounter,
        }),
        [state.initialQuestionCounter],
    );

    const source = state.source;

    const showAttemptButton =
        allowItemAttemptButtons &&
        generateNewItemAttempt !== undefined &&
        !source.isDescription &&
        maxAttemptsAllowed !== 1;

    const render = checkRender(state);
    const hidden = checkHidden(state);

    const newAttemptsLeft = Math.max(maxAttemptsAllowed - itemAttemptNumber, 0);
    const attemptButtonDisabled =
        maxAttemptsAllowed > 0 && newAttemptsLeft <= 0;

    return (
        <div ref={ref}>
            <div hidden={!render || hidden} style={{ minHeight: "100px" }}>
                <DoenetViewer
                    // `initialState` is seed-only for the viewer, so applying
                    // a re-read one (new item attempt, or externally loaded
                    // state — which may not change the attempt number)
                    // requires a remount. Built from the *frozen* values so
                    // the key and the seed always change in the same commit.
                    key={`${attemptNumber.toString()}-${stateVersionUsed.toString()}`}
                    doenetML={source.doenetML}
                    doenetmlVersion={source.version}
                    render={render}
                    requestedVariantIndex={requestedVariantIndex}
                    flags={flags}
                    activityId={baseId}
                    docId={state.id}
                    forceDisable={forceDisable}
                    forceShowCorrectness={forceShowCorrectness}
                    forceShowSolution={forceShowSolution}
                    forceUnsuppressCheckwork={forceUnsuppressCheckwork}
                    doenetViewerUrl={doenetViewerUrl}
                    fetchExternalDoenetML={fetchExternalDoenetML}
                    darkMode={darkMode}
                    showAnswerResponseMenu={showAnswerResponseMenu}
                    answerResponseCounts={answerResponseCounts}
                    addVirtualKeyboard={false}
                    initialState={initialDoenetState}
                    initializeCounters={initialCounters}
                    reportScoreAndStateCallback={reportScoreAndStateCallback}
                    initializedCallback={() => {
                        setRendered(true);
                        hasRenderedCallback(state.id);
                    }}
                />
                {showAttemptButton ? (
                    <button
                        hidden={!rendered}
                        onClick={() => {
                            generateNewItemAttempt(
                                state.id,
                                state.initialQuestionCounter,
                            );
                        }}
                        disabled={attemptButtonDisabled}
                        style={{
                            marginLeft: "20px",
                            backgroundColor: "var(--buttonSurfaceAlt)",
                            color: "var(--canvasText)",
                            opacity: attemptButtonDisabled ? 0.4 : "inherit",
                            borderRadius: "10px",
                            padding: "5px 20px",
                            cursor: attemptButtonDisabled
                                ? "not-allowed"
                                : "pointer",
                        }}
                        data-test="New Item Attempt"
                    >
                        New {itemWord} attempt{" "}
                        {maxAttemptsAllowed > 0
                            ? `(${newAttemptsLeft.toString()} left)`
                            : null}
                    </button>
                ) : null}
            </div>
        </div>
    );
});
