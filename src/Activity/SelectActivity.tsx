import { ReactElement } from "react";
import type { DoenetMLFlags } from "../types";
import { SelectState } from "./selectState";
import { Activity } from "./Activity";
import { ActivityState, getNumItems } from "./activityState";

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
    doenetStates,
    reportScoreAndStateCallback,
    checkRender,
    checkHidden,
    allowItemAttemptButtons = false,
    generateNewItemAttempt,
    hasRenderedCallback,
    reportVisibility = false,
    reportVisibilityCallback,
    renderOnlyItem = null,
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
    renderOnlyItem?: number | null;
}) {
    const selectedActivities: ReactElement[] = [];
    const selectedIds: string[] = [];

    let nextRenderOnly = renderOnlyItem;

    for (const activity of state.selectedChildren) {
        selectedActivities.push(
            <Activity
                key={activity.id}
                state={activity}
                doenetStates={doenetStates}
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
                renderOnlyItem={nextRenderOnly}
            />,
        );
        selectedIds.push(activity.id);

        if (nextRenderOnly !== null) {
            // if `numToSelect` is larger than one, account for the items of previous selection(s)
            nextRenderOnly -= getNumItems(activity.source);
        }
    }

    return (
        <div key={state.attemptNumber} hidden={!checkRender(state)}>
            <div>{selectedActivities}</div>
        </div>
    );
}
