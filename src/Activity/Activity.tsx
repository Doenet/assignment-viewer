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
    state: ActivityState;
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
    switch (state.type) {
        case "singleDoc": {
            if (renderOnlyItem !== null && renderOnlyItem !== 1) {
                return null;
            }
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
                    doenetStates={doenetStates}
                    reportScoreAndStateCallback={reportScoreAndStateCallback}
                    checkRender={checkRender}
                    checkHidden={checkHidden}
                    allowItemAttemptButtons={allowItemAttemptButtons}
                    generateNewItemAttempt={generateNewItemAttempt}
                    hasRenderedCallback={hasRenderedCallback}
                    reportVisibility={reportVisibility}
                    reportVisibilityCallback={reportVisibilityCallback}
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
                    doenetStates={doenetStates}
                    reportScoreAndStateCallback={reportScoreAndStateCallback}
                    checkRender={checkRender}
                    checkHidden={checkHidden}
                    allowItemAttemptButtons={allowItemAttemptButtons}
                    generateNewItemAttempt={generateNewItemAttempt}
                    hasRenderedCallback={hasRenderedCallback}
                    reportVisibility={reportVisibility}
                    reportVisibilityCallback={reportVisibilityCallback}
                    renderOnlyItem={renderOnlyItem}
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
                    doenetStates={doenetStates}
                    reportScoreAndStateCallback={reportScoreAndStateCallback}
                    checkRender={checkRender}
                    checkHidden={checkHidden}
                    allowItemAttemptButtons={allowItemAttemptButtons}
                    generateNewItemAttempt={generateNewItemAttempt}
                    hasRenderedCallback={hasRenderedCallback}
                    reportVisibility={reportVisibility}
                    reportVisibilityCallback={reportVisibilityCallback}
                    renderOnlyItem={renderOnlyItem}
                />
            );
        }
    }
}
