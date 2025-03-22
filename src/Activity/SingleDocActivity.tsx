import { useEffect, useMemo, useRef, useState } from "react";
import type { DoenetMLFlags } from "../types";
import { DoenetViewer } from "@doenet/doenetml-iframe";
import { SingleDocState } from "./singleDocState";
import { ActivityState } from "./activityState";

export function SingleDocActivity({
    flags,
    baseId,
    maxAttemptsAllowed,
    forceDisable = false,
    forceShowCorrectness = false,
    forceShowSolution = false,
    forceUnsuppressCheckwork = false,
    linkSettings,
    darkMode = "light",
    showAnswerResponseMenu = false,
    answerResponseCountsByItem = [],
    state,
    doenetStates,
    reportScoreAndStateCallback,
    checkRender,
    checkHidden,
    allowItemAttemptButtons = false,
    generateNewItemAttempt,
    hasRenderedCallback,
    reportVisibility = false,
    reportVisibilityCallback,
    itemAttemptNumbers,
    itemSequence,
    itemWord,
}: {
    flags: DoenetMLFlags;
    baseId: string;
    maxAttemptsAllowed: number;
    forceDisable?: boolean;
    forceShowCorrectness?: boolean;
    forceShowSolution?: boolean;
    forceUnsuppressCheckwork?: boolean;
    linkSettings?: { viewURL: string; editURL: string };
    darkMode?: "dark" | "light";
    showAnswerResponseMenu?: boolean;
    answerResponseCountsByItem?: Record<string, number>[];
    state: SingleDocState;
    doenetStates: unknown[];
    reportScoreAndStateCallback: (args: unknown) => void;
    checkRender: (state: ActivityState) => boolean;
    checkHidden: (state: ActivityState) => boolean;
    allowItemAttemptButtons?: boolean;
    generateNewItemAttempt?: (
        id: string,
        initialQuestionCounter: number,
    ) => void;
    hasRenderedCallback: (id: string) => void;
    reportVisibility?: boolean;
    reportVisibilityCallback: (id: string, isVisible: boolean) => void;
    itemAttemptNumbers: number[];
    itemSequence: string[];
    itemWord: string;
}) {
    const [rendered, setRendered] = useState(false);

    const [attemptNumber, setAttemptNumber] = useState(state.attemptNumber);
    const [initialDoenetState, setInitialDoenetState] = useState<Record<
        string,
        unknown
    > | null>(
        (state.doenetStateIdx === null
            ? null
            : (doenetStates[state.doenetStateIdx] ?? null)) as Record<
            string,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            any
        > | null,
    );

    const [requestedVariantIndex, setRequestedVariantIndex] = useState(
        state.currentVariant,
    );

    const ref = useRef<HTMLDivElement>(null);

    const itemIdx = useMemo(
        () => itemSequence.indexOf(state.id),
        [itemSequence, state.id],
    );

    const itemAttemptNumber = itemAttemptNumbers[itemIdx];

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

    // Note: given the way the `<DoenetViewer>` iframe is set up, any changes in props
    // will reinitialize the activity. Hence, we make sure that no props change
    // unless the attempt number has changed.
    if (state.attemptNumber !== attemptNumber) {
        setAttemptNumber(state.attemptNumber);

        setInitialDoenetState(
            (state.doenetStateIdx === null
                ? null
                : (doenetStates[state.doenetStateIdx] ?? null)) as Record<
                string,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                any
            > | null,
        );

        setRequestedVariantIndex(state.currentVariant);
    }

    const initialCounters = {
        question: state.initialQuestionCounter,
        problem: state.initialQuestionCounter,
        exercise: state.initialQuestionCounter,
    };

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
                    key={state.attemptNumber}
                    doenetML={source.doenetML}
                    doenetmlVersion={source.version}
                    render={render}
                    requestedVariantIndex={requestedVariantIndex}
                    flags={flags}
                    activityId={baseId}
                    prefixForIds={state.id}
                    docId={state.id}
                    forceDisable={forceDisable}
                    forceShowCorrectness={forceShowCorrectness}
                    forceShowSolution={forceShowSolution}
                    forceUnsuppressCheckwork={forceUnsuppressCheckwork}
                    linkSettings={linkSettings}
                    darkMode={darkMode}
                    showAnswerResponseMenu={showAnswerResponseMenu}
                    answerResponseCounts={answerResponseCountsByItem[itemIdx]}
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
                            backgroundColor: "rgb(237, 242, 247)",
                            opacity: attemptButtonDisabled ? 0.4 : "inherit",
                            borderRadius: "10px",
                            padding: "5px 20px",
                            cursor: attemptButtonDisabled
                                ? "not-allowed"
                                : "pointer",
                        }}
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
}
