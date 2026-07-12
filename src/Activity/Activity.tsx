import { memo } from "react";
import { DoenetMLFlags } from "../types";
import { ActivityState } from "./activityState";
import { SelectActivity } from "./SelectActivity";
import { SequenceActivity } from "./SequenceActivity";
import { SingleDocActivity } from "./SingleDocActivity";

export type ActivityCommonProps = {
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
    doenetStates: unknown[];
    stateVersion: number;
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
    itemIndexById: ReadonlyMap<string, number>;
    itemWord: string;
};

export const Activity = memo(function Activity({
    state,
    ...props
}: ActivityCommonProps & { state: ActivityState }) {
    switch (state.type) {
        case "singleDoc": {
            // Extract this item's slice of the per-item arrays so the leaf's
            // props only change when *its* data changes: the arrays get a
            // fresh identity on every report from any document, which would
            // otherwise defeat SingleDocActivity's memo for all N items.
            const {
                doenetStates,
                itemAttemptNumbers,
                answerResponseCountsByItem = [],
                itemIndexById,
                ...leafProps
            } = props;
            const itemIdx = itemIndexById.get(state.id) ?? -1;
            return (
                <SingleDocActivity
                    {...leafProps}
                    state={state}
                    doenetState={
                        state.doenetStateIdx === null
                            ? null
                            : (doenetStates[state.doenetStateIdx] ?? null)
                    }
                    itemAttemptNumber={itemAttemptNumbers[itemIdx]}
                    answerResponseCounts={answerResponseCountsByItem[itemIdx]}
                />
            );
        }
        case "select": {
            return <SelectActivity {...props} state={state} />;
        }
        case "sequence": {
            return <SequenceActivity {...props} state={state} />;
        }
    }
});
