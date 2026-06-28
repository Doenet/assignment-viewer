import { ReactElement } from "react";
import type { DoenetMLFlags } from "../types";
import { Activity } from "./Activity";
import { SequenceState } from "./sequenceState";
import { ActivityState } from "./activityState";

export function SequenceActivity({
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
    answerResponseCountsByItem = [],
    state,
    doenetStates,
    loadedStateNum,
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
    doenetViewerUrl?: string;
    fetchExternalDoenetML?: (arg: string) => Promise<string>;
    darkMode?: "dark" | "light";
    showAnswerResponseMenu?: boolean;
    state: SequenceState;
    answerResponseCountsByItem?: Record<string, number>[];
    doenetStates: unknown[];
    loadedStateNum: number;
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
    const activityList: ReactElement[] = [];

    for (const activity of state.orderedChildren) {
        activityList.push(
            <Activity
                key={activity.id}
                state={activity}
                doenetStates={doenetStates}
                loadedStateNum={loadedStateNum}
                flags={flags}
                baseId={baseId}
                maxAttemptsAllowed={maxAttemptsAllowed}
                forceDisable={forceDisable}
                forceShowCorrectness={forceShowCorrectness}
                forceShowSolution={forceShowSolution}
                forceUnsuppressCheckwork={forceUnsuppressCheckwork}
                doenetViewerUrl={doenetViewerUrl}
                fetchExternalDoenetML={fetchExternalDoenetML}
                darkMode={darkMode}
                showAnswerResponseMenu={showAnswerResponseMenu}
                answerResponseCountsByItem={answerResponseCountsByItem}
                reportScoreAndStateCallback={reportScoreAndStateCallback}
                checkRender={checkRender}
                checkHidden={checkHidden}
                allowItemAttemptButtons={allowItemAttemptButtons}
                generateNewItemAttempt={generateNewItemAttempt}
                hasRenderedCallback={hasRenderedCallback}
                reportVisibility={reportVisibility}
                reportVisibilityCallback={reportVisibilityCallback}
                itemAttemptNumbers={itemAttemptNumbers}
                itemSequence={itemSequence}
                itemWord={itemWord}
            />,
        );
    }

    return (
        <div hidden={!checkRender(state)} key={state.attemptNumber}>
            {activityList}
        </div>
    );
}
