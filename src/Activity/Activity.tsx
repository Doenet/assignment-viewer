import { DoenetMLFlags } from "../types";
import { ActivityState } from "./activityState";
import { SelectActivity } from "./SelectActivity";
import { SequenceActivity } from "./SequenceActivity";
import { SingleDocActivity } from "./SingleDocActivity";

export function Activity({
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
    render = false,
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
    state: ActivityState;
    reportScoreAndStateCallback: (args: unknown) => void;
    documentStructureCallback: (args: unknown) => void;
    render?: boolean;
    allowItemAttemptButtons?: boolean;
    generateNewItemAttempt?: (
        id: string,
        initialQuestionCounter: number,
    ) => void;
}) {
    switch (state.type) {
        case "singleDoc": {
            return (
                <SingleDocActivity
                    flags={flags}
                    baseId={baseId}
                    forceDisable={forceDisable}
                    forceShowCorrectness={forceShowCorrectness}
                    forceShowSolution={forceShowSolution}
                    forceUnsuppressCheckwork={forceUnsuppressCheckwork}
                    linkSettings={linkSettings}
                    darkMode={darkMode}
                    showAnswerTitles={showAnswerTitles}
                    state={state}
                    reportScoreAndStateCallback={reportScoreAndStateCallback}
                    documentStructureCallback={documentStructureCallback}
                    render={render}
                    allowItemAttemptButtons={allowItemAttemptButtons}
                    generateNewItemAttempt={generateNewItemAttempt}
                />
            );
        }
        case "select": {
            return (
                <SelectActivity
                    flags={flags}
                    baseId={baseId}
                    forceDisable={forceDisable}
                    forceShowCorrectness={forceShowCorrectness}
                    forceShowSolution={forceShowSolution}
                    forceUnsuppressCheckwork={forceUnsuppressCheckwork}
                    linkSettings={linkSettings}
                    darkMode={darkMode}
                    showAnswerTitles={showAnswerTitles}
                    state={state}
                    reportScoreAndStateCallback={reportScoreAndStateCallback}
                    documentStructureCallback={documentStructureCallback}
                    render={render}
                    allowItemAttemptButtons={allowItemAttemptButtons}
                    generateNewItemAttempt={generateNewItemAttempt}
                />
            );
        }
        case "sequence": {
            return (
                <SequenceActivity
                    flags={flags}
                    baseId={baseId}
                    forceDisable={forceDisable}
                    forceShowCorrectness={forceShowCorrectness}
                    forceShowSolution={forceShowSolution}
                    forceUnsuppressCheckwork={forceUnsuppressCheckwork}
                    linkSettings={linkSettings}
                    darkMode={darkMode}
                    showAnswerTitles={showAnswerTitles}
                    state={state}
                    reportScoreAndStateCallback={reportScoreAndStateCallback}
                    documentStructureCallback={documentStructureCallback}
                    render={render}
                    allowItemAttemptButtons={allowItemAttemptButtons}
                    generateNewItemAttempt={generateNewItemAttempt}
                />
            );
        }
    }
}
