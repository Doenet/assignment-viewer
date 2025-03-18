import { DoenetMLFlags } from "../types";
import { ActivityState } from "./activityState";
import { SelectActivity } from "./SelectActivity";
import { SequenceActivity } from "./SequenceActivity";
import { SingleDocActivity } from "./SingleDocActivity";

export function Activity({
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
    itemAttemptNumbers: number[];
    itemSequence: string[];
}) {
    switch (state.type) {
        case "singleDoc": {
            return (
                <SingleDocActivity
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
                    itemAttemptNumbers={itemAttemptNumbers}
                    itemSequence={itemSequence}
                />
            );
        }
        case "select": {
            return (
                <SelectActivity
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
                    itemAttemptNumbers={itemAttemptNumbers}
                    itemSequence={itemSequence}
                />
            );
        }
        case "sequence": {
            return (
                <SequenceActivity
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
                    itemAttemptNumbers={itemAttemptNumbers}
                    itemSequence={itemSequence}
                />
            );
        }
    }
}
