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
    answerResponseCountsByItem?: Record<string, number>[];
    state: ActivityState;
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
                    doenetViewerUrl={doenetViewerUrl}
                    fetchExternalDoenetML={fetchExternalDoenetML}
                    darkMode={darkMode}
                    showAnswerResponseMenu={showAnswerResponseMenu}
                    answerResponseCountsByItem={answerResponseCountsByItem}
                    state={state}
                    doenetStates={doenetStates}
                    loadedStateNum={loadedStateNum}
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
                    doenetViewerUrl={doenetViewerUrl}
                    fetchExternalDoenetML={fetchExternalDoenetML}
                    darkMode={darkMode}
                    showAnswerResponseMenu={showAnswerResponseMenu}
                    answerResponseCountsByItem={answerResponseCountsByItem}
                    state={state}
                    doenetStates={doenetStates}
                    loadedStateNum={loadedStateNum}
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
                    doenetViewerUrl={doenetViewerUrl}
                    fetchExternalDoenetML={fetchExternalDoenetML}
                    darkMode={darkMode}
                    showAnswerResponseMenu={showAnswerResponseMenu}
                    answerResponseCountsByItem={answerResponseCountsByItem}
                    state={state}
                    doenetStates={doenetStates}
                    loadedStateNum={loadedStateNum}
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
                />
            );
        }
    }
}
