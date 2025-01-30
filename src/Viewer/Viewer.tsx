/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
    DoenetMLFlags,
    isDocumentStructureData,
    isSingleDocReportStateMessage,
} from "../types";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { useEffect, useMemo, useReducer, useState } from "react";
import { nanoid } from "nanoid";
import { MdError } from "react-icons/md";
import {
    ActivitySource,
    ActivityState,
    activityStateReducer,
    addSourceToActivityState,
    initializeActivityState,
    isActivityState,
    isActivityStateNoSource,
} from "../Activity/activityState";
import { Activity } from "../Activity/Activity";

export function Viewer({
    source,
    flags,
    activityId,
    userId,
    attemptNumber: _attemptNumber = 1,
    variantIndex: initialVariantIndex,
    maxAttemptsAllowed: _maxAttemptsAllowed = Infinity,
    questionLevelAttempts = false,
    activityLevelAttempts = false,
    paginate = true,
    showFinishButton: _showFinishButton = false,
    forceDisable = false,
    forceShowCorrectness = false,
    forceShowSolution = false,
    forceUnsuppressCheckwork = false,
    addVirtualKeyboard: _addVirtualKeyboard = true,
    externalVirtualKeyboardProvided: _externalVirtualKeyboardProvided = false,
    linkSettings,
    darkMode = "light",
    showAnswerTitles = false,
}: {
    source: ActivitySource;
    flags: DoenetMLFlags;
    activityId: string;
    userId?: string;
    attemptNumber?: number;
    variantIndex: number;
    maxAttemptsAllowed?: number;
    questionLevelAttempts?: boolean;
    activityLevelAttempts?: boolean;
    paginate?: boolean;
    showFinishButton?: boolean;
    forceDisable?: boolean;
    forceShowCorrectness?: boolean;
    forceShowSolution?: boolean;
    forceUnsuppressCheckwork?: boolean;
    addVirtualKeyboard?: boolean;
    externalVirtualKeyboardProvided?: boolean;
    linkSettings?: { viewURL: string; editURL: string };
    darkMode?: "dark" | "light";
    showAnswerTitles?: boolean;
}) {
    const numDocs = useMemo(() => getNumDocs(source), [source]);

    const [errMsg, setErrMsg] = useState<string | null>(null);

    const [numActivityVariants, setNumActivityVariants] = useState<
        Record<string, number>
    >({});

    const [questionCounts, setQuestionCounts] = useState<
        Record<string, number>
    >({});

    const [initialized, setInitialized] = useState(false);
    const [needNewAssignmentState, setNeedNewAssignmentState] = useState(false);

    useEffect(() => {
        setInitialized(false);
        setNumActivityVariants({});
        setQuestionCounts({});
    }, [activityId, userId, source]);

    const [activityState, activityStateDispatch] = useReducer(
        activityStateReducer,
        {
            source,
            variant: initialVariantIndex,
            parentId: null,
        },
        initializeActivityState,
    );

    useEffect(() => {
        if (
            !initialized &&
            Object.keys(numActivityVariants).length === numDocs &&
            Object.keys(questionCounts).length === numDocs
        ) {
            if (needNewAssignmentState) {
                try {
                    activityStateDispatch({
                        type: "generateNewActivityAttempt",
                        numActivityVariants,
                        initialQuestionCounter: 1,
                        questionCounts,
                        allowSaveState: flags.allowSaveState,
                        baseId: activityId,
                    });
                } catch (e) {
                    const message = e instanceof Error ? e.message : "";
                    setErrMsg(`Error in activity: ${message}`);
                }
            }
            setInitialized(true);
        }
    }, [
        numActivityVariants,
        questionCounts,
        numDocs,
        flags.allowSaveState,
        initialized,
        activityId,
        needNewAssignmentState,
    ]);

    // The index of the current item
    const [currentItemIdx, setCurrentItemIdx] = useState(0);

    useEffect(() => {
        activityStateDispatch({ type: "reinitialize", source });
    }, [activityId, source]);

    useEffect(() => {
        const listenersAdded: ((event: MessageEvent) => void)[] = [];
        const timeoutIdsAdded: number[] = [];
        function loadState() {
            return new Promise<ActivityState | null>((resolve, reject) => {
                const messageId = nanoid();

                window.postMessage({
                    subject: "SPLICE.getState",
                    messageId,
                    activityId,
                    userId,
                });

                let waitingToLoadState = true;
                let timeoutId = -1;

                const loadStateListener = function (event: MessageEvent) {
                    if (event.origin !== window.location.origin) {
                        return;
                    }

                    if (
                        event.data.subject === "SPLICE.getState.response" &&
                        event.data.messageId === messageId
                    ) {
                        waitingToLoadState = false;
                        if (event.data.success) {
                            if (event.data.loadedState) {
                                const stateNoSource: unknown = event.data.state;
                                if (isActivityStateNoSource(stateNoSource)) {
                                    const state = addSourceToActivityState(
                                        stateNoSource,
                                        source,
                                    );
                                    resolve(state);
                                } else {
                                    reject(Error("Received invalid state"));
                                }
                            } else {
                                resolve(null);
                            }
                        } else {
                            reject(Error("Error loading assignment state"));
                        }

                        window.removeEventListener(
                            "message",
                            loadStateListener,
                        );
                        clearTimeout(timeoutId);
                    }
                };

                window.addEventListener("message", loadStateListener);
                listenersAdded.push(loadStateListener);

                const MESSAGE_TIMEOUT = 15000;

                timeoutId = setTimeout(() => {
                    if (!waitingToLoadState) {
                        return;
                    }
                    reject(Error("Time out loading assignment state"));
                }, MESSAGE_TIMEOUT);

                timeoutIdsAdded.push(timeoutId);
            });
        }

        if (flags.allowLoadState) {
            loadState()
                .then((state) => {
                    if (isActivityState(state)) {
                        activityStateDispatch({
                            type: "set",
                            state,
                            allowSaveState: flags.allowSaveState,
                            baseId: activityId,
                        });
                    } else if (state === null) {
                        setNeedNewAssignmentState(true);
                    } else {
                        setErrMsg(`Invalid state returned`);
                    }
                })
                .catch((e: unknown) => {
                    setErrMsg(
                        `Failed to load state: ${e instanceof Error ? e.message : ""}`,
                    );
                });
        } else {
            setNeedNewAssignmentState(true);
        }

        return () => {
            // make sure all listeners are removed
            for (const listener of listenersAdded) {
                window.removeEventListener("message", listener);
            }
            for (const timeoutId of timeoutIdsAdded) {
                clearTimeout(timeoutId);
            }
        };
    }, [
        flags.allowLoadState,
        flags.allowSaveState,
        activityId,
        userId,
        source,
    ]);

    function clickNext() {
        setCurrentItemIdx((was) => Math.min(numItems - 1, was + 1));
    }
    function clickPrevious() {
        setCurrentItemIdx((was) => Math.max(0, was - 1));
    }

    if (errMsg !== null) {
        const errorIcon = (
            <span style={{ fontSize: "1em", color: "#C1292E" }}>
                <MdError />
            </span>
        );
        return (
            <div
                style={{
                    fontSize: "1.3em",
                    marginLeft: "20px",
                    marginTop: "20px",
                }}
            >
                {errorIcon} {errMsg}
            </div>
        );
    }

    // if (allVariantsCalculated && !needNewAssignmentState) {
    //     if (paginate) {
    //         if (!itemsRendered.has(currentItemId)) {
    //             // the current item is always rendered
    //             addItemToRender(currentItemId);
    //         } else {
    //             const nextItemId = itemOrder[currentItemIdx + 1]?.id;
    //             if (
    //                 currentItemIdx < numItems - 1 &&
    //                 !itemsRendered.has(nextItemId)
    //             ) {
    //                 // render the next item if the current item is already rendered
    //                 addItemToRender(nextItemId);
    //             } else {
    //                 const prevItemId = itemOrder[currentItemIdx - 1]?.id;
    //                 if (currentItemIdx > 0 && !itemsRendered.has(prevItemId)) {
    //                     // render the previous item if the current and next item are already rendered
    //                     addItemToRender(prevItemId);
    //                 }
    //             }
    //         }
    //     } else {
    //         for (const item of source.items) {
    //             if (!itemsRendered.has(item.id) && itemsVisible.has(item.id)) {
    //                 addItemToRender(item.id);
    //                 break;
    //             }
    //         }
    //     }
    // }

    return (
        <div>
            <h2 style={{ marginLeft: "20px" }}>{source.title}</h2>

            <div>
                {/* <div hidden={!paginate}>
                    <button
                        onClick={clickPrevious}
                        style={{ marginLeft: "20px" }}
                    >
                        Previous
                    </button>
                    <button onClick={clickNext} style={{ marginLeft: "20px" }}>
                        Next
                    </button>
                </div> */}
                {activityLevelAttempts ? (
                    <button
                        onClick={() => {
                            activityStateDispatch({
                                type: "generateNewActivityAttempt",
                                numActivityVariants,
                                initialQuestionCounter: 1,
                                questionCounts,
                                allowSaveState: flags.allowSaveState,
                                baseId: activityId,
                            });
                        }}
                        disabled={!initialized}
                        style={{ marginLeft: "20px" }}
                    >
                        New attempt
                    </button>
                ) : null}
            </div>

            <div hidden={initialized} style={{ marginLeft: "20px" }}>
                Initializing...
            </div>
            <Activity
                flags={flags}
                baseId={activityId}
                forceDisable={forceDisable}
                forceShowCorrectness={forceShowCorrectness}
                forceShowSolution={forceShowSolution}
                forceUnsuppressCheckwork={forceUnsuppressCheckwork}
                linkSettings={linkSettings}
                darkMode={darkMode}
                showAnswerTitles={showAnswerTitles}
                state={activityState}
                documentStructureCallback={(data: unknown) => {
                    if (isDocumentStructureData(data)) {
                        if (data.args.success) {
                            setNumActivityVariants((was) => {
                                if (data.docId in was) {
                                    return was;
                                }
                                const obj = { ...was };
                                obj[data.docId] =
                                    data.args.allPossibleVariants.length;
                                return obj;
                            });
                            setQuestionCounts((was) => {
                                if (data.docId in was) {
                                    return was;
                                }
                                const obj = { ...was };
                                obj[data.docId] =
                                    (data.args.baseLevelComponentCounts
                                        .question ?? 0) +
                                    (data.args.baseLevelComponentCounts
                                        .problem ?? 0) +
                                    (data.args.baseLevelComponentCounts
                                        .exercise ?? 0);
                                return obj;
                            });
                        }
                    }
                }}
                reportScoreAndStateCallback={(msg: unknown) => {
                    if (isSingleDocReportStateMessage(msg)) {
                        activityStateDispatch({
                            type: "updateSingleState",
                            id: msg.docId,
                            doenetState: msg.state,
                            creditAchieved: msg.score,
                            allowSaveState: flags.allowSaveState,
                            baseId: activityId,
                        });
                    }
                }}
                render={initialized}
                allowItemAttemptButtons={questionLevelAttempts}
                generateNewItemAttempt={(
                    id: string,
                    initialQuestionCounter: number,
                ) => {
                    if (initialized) {
                        activityStateDispatch({
                            type: "generateNewActivityAttempt",
                            id,
                            numActivityVariants,
                            initialQuestionCounter,
                            questionCounts,
                            allowSaveState: flags.allowSaveState,
                            baseId: activityId,
                        });
                    }
                }}
            />
        </div>
    );
}

function getNumDocs(activity: ActivitySource): number {
    switch (activity.type) {
        case "singleDoc": {
            return 1;
        }
        case "select": {
            return activity.items.reduce((a, c) => a + getNumDocs(c), 0);
        }
        case "sequence": {
            return activity.items.reduce((a, c) => a + getNumDocs(c), 0);
        }
    }
}
