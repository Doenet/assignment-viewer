import { ReactElement } from "react";
import type { DoenetMLFlags } from "../types";
import { SelectState } from "./selectState";
import { Activity } from "./Activity";
import { ActivityState } from "./activityState";

export function SelectActivity({
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
    state: SelectState;
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
}) {
    const selectedActivities: ReactElement[] = [];
    const selectedIds: string[] = [];

    for (const activity of state.selectedChildren) {
        selectedActivities.push(
            <Activity
                key={activity.id}
                state={activity}
                doenetStates={doenetStates}
                flags={flags}
                baseId={baseId}
                maxAttemptsAllowed={maxAttemptsAllowed}
                forceDisable={forceDisable}
                forceShowCorrectness={forceShowCorrectness}
                forceShowSolution={forceShowSolution}
                forceUnsuppressCheckwork={forceUnsuppressCheckwork}
                linkSettings={linkSettings}
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
