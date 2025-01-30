import { useState } from "react";
import type { DoenetMLFlags } from "../types";
import { DoenetViewer } from "@doenet/doenetml-iframe";
import { SingleDocState } from "./singleDocState";
import { extendedId } from "./activityState";

export function SingleDocActivity({
    flags,
    baseId,
    forceDisable = false,
    forceShowCorrectness = false,
    forceShowSolution = false,
    forceUnsuppressCheckwork = false,
    linkSettings,
    darkMode = "light",
    showAnswerTitles = false,
    state,
    reportScoreAndStateCallback,
    documentStructureCallback,
    render = true,
    allowItemAttemptButtons = false,
    generateNewItemAttempt,
}: {
    flags: DoenetMLFlags;
    baseId: string;
    forceDisable?: boolean;
    forceShowCorrectness?: boolean;
    forceShowSolution?: boolean;
    forceUnsuppressCheckwork?: boolean;
    linkSettings?: { viewURL: string; editURL: string };
    darkMode?: "dark" | "light";
    showAnswerTitles?: boolean;
    state: SingleDocState;
    reportScoreAndStateCallback: (args: unknown) => void;
    documentStructureCallback: (args: unknown) => void;
    render?: boolean;
    allowItemAttemptButtons?: boolean;
    generateNewItemAttempt?: (
        id: string,
        initialQuestionCounter: number,
    ) => void;
}) {
    const [_rendered, setRendered] = useState(false);

    const [attemptNumber, setAttemptNumber] = useState(state.attempts.length);
    const [initialDoenetState, setInitialDoenetState] = useState<Record<
        string,
        unknown
    > | null>(null);

    const latestAttempt =
        state.attempts.length > 0
            ? state.attempts[state.attempts.length - 1]
            : null;

    const [requestedVariantIndex, setRequestedVariantIndex] = useState(
        latestAttempt ? latestAttempt.variant : state.initialVariant,
    );

    // Note: given the way the `<DoenetViewer>` iframe is set up, any changes in props
    // will reinitialize the activity. Hence, we make sure that no props change
    // unless the attempt number has changed.
    if (state.attempts.length !== attemptNumber) {
        setAttemptNumber(state.attempts.length);

        setInitialDoenetState(
            latestAttempt
                ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (latestAttempt.doenetState as Record<string, any> | null)
                : null,
        );

        setRequestedVariantIndex(
            latestAttempt ? latestAttempt.variant : state.initialVariant,
        );
    }

    const initialCounters = latestAttempt
        ? {
              question: latestAttempt.initialQuestionCounter,
              problem: latestAttempt.initialQuestionCounter,
              exercise: latestAttempt.initialQuestionCounter,
          }
        : undefined;

    const source = state.source;

    const showAttemptButton =
        allowItemAttemptButtons &&
        generateNewItemAttempt !== undefined &&
        !source.isDescription;

    const docId = extendedId(state);

    return (
        <div hidden={!render} style={{ minHeight: "100px" }}>
            {/* <div style={{ marginLeft: "20px" }} hidden={rendered}>
                Initializing...
            </div> */}
            <DoenetViewer
                key={state.attempts.length}
                doenetML={source.doenetML}
                doenetmlVersion={source.version}
                render={render}
                requestedVariantIndex={requestedVariantIndex}
                flags={flags}
                activityId={baseId}
                prefixForIds={docId}
                docId={docId}
                forceDisable={forceDisable}
                forceShowCorrectness={forceShowCorrectness}
                forceShowSolution={forceShowSolution}
                forceUnsuppressCheckwork={forceUnsuppressCheckwork}
                linkSettings={linkSettings}
                darkMode={darkMode}
                showAnswerTitles={showAnswerTitles}
                addVirtualKeyboard={false}
                initialState={initialDoenetState}
                initializeCounters={initialCounters}
                reportScoreAndStateCallback={reportScoreAndStateCallback}
                documentStructureCallback={(args: unknown) => {
                    documentStructureCallback(args);
                }}
                initializedCallback={() => {
                    setRendered(true);
                }}
            />
            {showAttemptButton ? (
                <button
                    onClick={() => {
                        generateNewItemAttempt(
                            docId,
                            latestAttempt?.initialQuestionCounter ?? 1,
                        );
                    }}
                    style={{ marginLeft: "20px" }}
                >
                    New question attempt
                </button>
            ) : null}
        </div>
    );
}
