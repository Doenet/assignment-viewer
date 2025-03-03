import { ReactElement } from "react";
import type { DoenetMLFlags } from "../types";
import { Activity } from "./Activity";
import { SequenceState } from "./sequenceState";
import { ActivityState } from "./activityState";

export function SequenceActivity({
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
    checkRender,
    checkHidden,
    allowItemAttemptButtons = false,
    generateNewItemAttempt,
    hasRenderedCallback,
    reportVisibility = false,
    reportVisibilityCallback,
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
    state: SequenceState;
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
}) {
    const activityList: ReactElement[] = [];

    for (const activity of state.orderedChildren) {
        activityList.push(
            <Activity
                key={activity.id}
                state={activity}
                flags={flags}
                baseId={baseId}
                forceDisable={forceDisable}
                forceShowCorrectness={forceShowCorrectness}
                forceShowSolution={forceShowSolution}
                forceUnsuppressCheckwork={forceUnsuppressCheckwork}
                linkSettings={linkSettings}
                darkMode={darkMode}
                showAnswerTitles={showAnswerTitles}
                reportScoreAndStateCallback={reportScoreAndStateCallback}
                checkRender={checkRender}
                checkHidden={checkHidden}
                allowItemAttemptButtons={allowItemAttemptButtons}
                generateNewItemAttempt={generateNewItemAttempt}
                hasRenderedCallback={hasRenderedCallback}
                reportVisibility={reportVisibility}
                reportVisibilityCallback={reportVisibilityCallback}
            />,
        );
    }

    return (
        <div hidden={!checkRender(state)} key={state.attemptNumber}>
            {activityList}
        </div>
    );
}
