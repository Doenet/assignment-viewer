import { ReactElement } from "react";
import type { DoenetMLFlags } from "../types";
import { SelectState } from "./selectState";
import { Activity } from "./Activity";
import { ActivityState } from "./activityState";

export function SelectActivity({
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
    state: SelectState;
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
    const selectedActivities: ReactElement[] = [];
    const selectedIds: string[] = [];

    for (const activity of state.selectedChildren) {
        selectedActivities.push(
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
        selectedIds.push(activity.id);
    }

    return (
        <div key={state.attemptNumber} hidden={!checkRender(state)}>
            <div>{selectedActivities}</div>
        </div>
    );
}
