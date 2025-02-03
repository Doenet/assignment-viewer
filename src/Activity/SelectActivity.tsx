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
    documentStructureCallback,
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
    documentStructureCallback: (args: unknown) => void;
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
    const latestAttempt =
        state.attempts.length > 0
            ? state.attempts[state.attempts.length - 1]
            : null;

    const selectedActivities: ReactElement[] = [];
    const selectedIds: string[] = [];

    if (latestAttempt) {
        for (const activity of latestAttempt.activities) {
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
                    documentStructureCallback={documentStructureCallback}
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
    }

    const unselectedActivities = state.latestChildStates
        .filter((activity) => !selectedIds.includes(activity.id))
        .map((activity) => (
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
                documentStructureCallback={documentStructureCallback}
                checkRender={() => false}
                checkHidden={checkHidden}
                hasRenderedCallback={hasRenderedCallback}
                reportVisibility={reportVisibility}
                reportVisibilityCallback={reportVisibilityCallback}
            />
        ));

    return (
        <div
            key={
                // Replace the activity in the DOM when a new attempt is created,
                // except preserve it if just a single item was replaced with the other items staying unchanged.
                state.attempts.filter(
                    (x) => x.singleItemReplacementIdx === undefined,
                ).length
            }
            hidden={!checkRender(state)}
        >
            <div>{selectedActivities}</div>
            <div hidden={true}>{unselectedActivities}</div>
        </div>
    );
}
