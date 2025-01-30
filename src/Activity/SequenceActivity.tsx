import { ReactElement } from "react";
import type { DoenetMLFlags } from "../types";
import { Activity } from "./Activity";
import { SequenceState } from "./sequenceState";

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
    state: SequenceState;
    reportScoreAndStateCallback: (args: unknown) => void;
    documentStructureCallback: (args: unknown) => void;
    render?: boolean;
    allowItemAttemptButtons?: boolean;
    generateNewItemAttempt?: (
        id: string,
        initialQuestionCounter: number,
    ) => void;
}) {
    const latestAttempt =
        state.attempts.length > 0
            ? state.attempts[state.attempts.length - 1]
            : null;

    const activityList: ReactElement[] = [];

    if (latestAttempt) {
        for (const activity of latestAttempt.activities) {
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
                    documentStructureCallback={documentStructureCallback}
                    render={render}
                    allowItemAttemptButtons={allowItemAttemptButtons}
                    generateNewItemAttempt={generateNewItemAttempt}
                />,
            );
        }
    } else {
        // if don't have latest attempt, just create from the data we have
        for (const activity of state.latestChildStates) {
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
                    documentStructureCallback={documentStructureCallback}
                    render={render}
                    allowItemAttemptButtons={allowItemAttemptButtons}
                    generateNewItemAttempt={generateNewItemAttempt}
                />,
            );
        }
    }

    return <div>{activityList}</div>;
}
