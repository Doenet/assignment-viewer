/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { DoenetMLFlags, isSingleDocReportStateMessage } from "../types";
import {
    useCallback,
    useEffect,
    useMemo,
    useReducer,
    useRef,
    useState,
} from "react";
import { nanoid } from "nanoid";
import { MdError } from "react-icons/md";
import {
    ActivitySource,
    ActivityState,
    addSourceToActivityState,
    getItemSequence,
    validateIds,
    isExportedActivityState,
    validateStateAndSource,
    gatherDocumentStructure,
    initializeActivityAndDoenetState,
    getNumItems,
    ActivityAndDoenetState,
    isActivityAndDoenetState,
    createSourceHash,
} from "../Activity/activityState";
import { Activity } from "../Activity/Activity";
import { activityDoenetStateReducer } from "../Activity/activityStateReducer";

export function Viewer({
    source,
    flags,
    activityId,
    userId = null,
    initialVariantIndex,
    maxAttemptsAllowed = 1,
    itemLevelAttempts = false,
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
    showAnswerResponseMenu = false,
    answerResponseCountsByItem = [],
    showTitle = true,
}: {
    source: ActivitySource;
    flags: DoenetMLFlags;
    activityId: string;
    userId?: string | null;
    initialVariantIndex: number;
    maxAttemptsAllowed?: number;
    itemLevelAttempts?: boolean;
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
    showAnswerResponseMenu?: boolean;
    answerResponseCountsByItem?: Record<string, number>[];
    showTitle?: boolean;
}) {
    const [errMsg, setErrMsg] = useState<string | null>(null);

    const initialPass = useRef(true);

    const { numActivityVariants, sourceHash, numItems } = useMemo(() => {
        try {
            validateIds(source);
            const docStructure = gatherDocumentStructure(source);
            const sourceHash = createSourceHash(source);
            const numItems = getNumItems(source);
            return { ...docStructure, sourceHash, numItems };
        } catch (e) {
            const message = e instanceof Error ? e.message : "";
            setErrMsg(`Error in activity source: ${message}`);
            return {
                numActivityVariants: {},
                sourceHash: "",
                numItems: 0,
            };
        }
    }, [source]);

    const [activityDoenetState, activityDoenetStateDispatch] = useReducer(
        activityDoenetStateReducer,
        {
            source,
            variant: initialVariantIndex,
            parentId: null,
            numActivityVariants,
        },
        initializeActivityAndDoenetState,
    );
    const activityState = activityDoenetState.activityState;

    const itemSequence = getItemSequence(activityState);

    // The index of the current item
    const [currentItemIdx, setCurrentItemIdx] = useState(0);
    const currentItemId = itemSequence[currentItemIdx];

    const [itemsRendered, setItemsRendered] = useState<string[]>([]);
    const [itemsToRender, setItemsToRender] = useState<string[]>([]);
    const [itemsVisible, setItemsVisible] = useState<string[]>([]);

    const attemptNumber = activityState.attemptNumber;

    function addItemToRender(id: string) {
        if (!itemsToRender.includes(id)) {
            setItemsToRender((was) => {
                if (was.includes(id)) {
                    return was;
                }
                const obj = [...was];
                obj.push(id);
                return obj;
            });
        }
    }

    const checkRender = useCallback(
        (state: ActivityState) => {
            if (state.type === "singleDoc") {
                return itemsToRender.includes(state.id);
            } else {
                return true;
            }
        },
        [itemsToRender],
    );

    const checkHidden = useCallback(
        (state: ActivityState) => {
            if (state.type === "singleDoc") {
                return paginate && currentItemId !== state.id;
            } else {
                return false;
            }
        },
        [currentItemId, paginate],
    );

    useEffect(() => {
        if (initialPass.current) {
            initialPass.current = false;
        } else {
            activityDoenetStateDispatch({
                type: "initialize",
                source,
                variantIndex: initialVariantIndex,
                numActivityVariants,
            });
        }
    }, [activityId, source, initialVariantIndex, numActivityVariants]);

    useEffect(() => {
        const listenersAdded: ((event: MessageEvent) => void)[] = [];
        const timeoutIdsAdded: number[] = [];
        function loadState() {
            return new Promise<ActivityAndDoenetState | null>(
                (resolve, reject) => {
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
                                    const exportedState: unknown =
                                        event.data.state;
                                    if (
                                        isExportedActivityState(exportedState)
                                    ) {
                                        if (
                                            validateStateAndSource(
                                                exportedState,
                                                source,
                                            )
                                        ) {
                                            const state =
                                                addSourceToActivityState(
                                                    exportedState.activityState,
                                                    source,
                                                );
                                            resolve({
                                                activityState: state,
                                                doenetStates:
                                                    exportedState.doenetStates,
                                                itemAttemptNumbers:
                                                    exportedState.itemAttemptNumbers,
                                            });
                                        } else {
                                            reject(
                                                Error(
                                                    "Received state did not match source",
                                                ),
                                            );
                                        }
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
                },
            );
        }

        function getNewActivityState() {
            try {
                activityDoenetStateDispatch({
                    type: "generateNewActivityAttempt",
                    numActivityVariants,
                    initialQuestionCounter: 1,
                    allowSaveState: flags.allowSaveState,
                    baseId: activityId,
                    sourceHash,
                });
            } catch (e) {
                const message = e instanceof Error ? e.message : "";
                setErrMsg(`Error in activity: ${message}`);
            }
        }

        if (flags.allowLoadState) {
            loadState()
                .then((state) => {
                    if (isActivityAndDoenetState(state)) {
                        activityDoenetStateDispatch({
                            type: "set",
                            state,
                            allowSaveState: flags.allowSaveState,
                            baseId: activityId,
                        });
                    } else if (state === null) {
                        getNewActivityState();
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
            getNewActivityState();
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
        numActivityVariants,
        sourceHash,
    ]);

    function clickNext() {
        setCurrentItemIdx((was) => Math.min(numItems - 1, was + 1));
    }
    function clickPrevious() {
        setCurrentItemIdx((was) => Math.max(0, was - 1));
    }

    function reportScoreAndStateCallback(msg: unknown) {
        if (isSingleDocReportStateMessage(msg)) {
            activityDoenetStateDispatch({
                type: "updateSingleState",
                docId: msg.docId,
                doenetState: msg.state,
                doenetStateIdx: itemSequence.indexOf(msg.docId),
                itemSequence,
                creditAchieved: msg.score,
                allowSaveState: flags.allowSaveState,
                baseId: activityId,
                sourceHash,
            });
        }
    }

    function generateNewItemAttempt(
        id: string,
        initialQuestionCounter: number,
    ) {
        activityDoenetStateDispatch({
            type: "generateSingleDocSubActivityAttempt",
            docId: id,
            doenetStateIdx: itemSequence.indexOf(id),
            itemSequence,
            numActivityVariants,
            initialQuestionCounter,
            allowSaveState: flags.allowSaveState,
            baseId: activityId,
            sourceHash,
        });
        setItemsRendered((was) => {
            const idx = was.indexOf(id);
            if (idx === -1) {
                return was;
            } else {
                const arr = [...was];
                arr.splice(idx, 1);
                return arr;
            }
        });
        setItemsToRender((was) => {
            const idx = was.indexOf(id);
            if (idx === -1) {
                return was;
            } else {
                const arr = [...was];
                arr.splice(idx, 1);
                return arr;
            }
        });
    }

    function hasRenderedCallback(id: string) {
        setItemsRendered((was) => {
            if (was.includes(id)) {
                return was;
            }
            const obj = [...was];
            obj.push(id);
            return obj;
        });
    }

    function reportVisibilityCallback(id: string, isVisible: boolean) {
        setItemsVisible((was) => {
            if (isVisible) {
                if (was.includes(id)) {
                    return was;
                } else {
                    const obj = [...was];
                    obj.push(id);
                    return obj;
                }
            } else {
                const idx = was.indexOf(id);
                if (idx === -1) {
                    return was;
                } else {
                    const obj = [...was];
                    obj.splice(idx, 1);
                    return obj;
                }
            }
        });
    }

    function generateActivityAttempt() {
        activityDoenetStateDispatch({
            type: "generateNewActivityAttempt",
            numActivityVariants,
            initialQuestionCounter: 1,
            allowSaveState: flags.allowSaveState,
            baseId: activityId,
            sourceHash,
        });
        setItemsRendered([]);
        setCurrentItemIdx(0);
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

    if (paginate) {
        if (!itemsRendered.includes(currentItemId)) {
            // the current item is always rendered
            addItemToRender(currentItemId);
        } else {
            const nextItemId = itemSequence[currentItemIdx + 1];
            if (
                currentItemIdx < numItems - 1 &&
                !itemsRendered.includes(nextItemId)
            ) {
                // render the next item if the current item is already rendered
                addItemToRender(nextItemId);
            } else {
                const prevItemId = itemSequence[currentItemIdx - 1];
                if (currentItemIdx > 0 && !itemsRendered.includes(prevItemId)) {
                    // render the previous item if the current and next item are already rendered
                    addItemToRender(prevItemId);
                }
            }
        }
    } else {
        for (const id of itemSequence) {
            if (!itemsRendered.includes(id) && itemsVisible.includes(id)) {
                addItemToRender(id);
                break;
            }
        }
    }

    return (
        <div>
            {showTitle ? (
                <h2 style={{ marginLeft: "20px" }}>{source.title}</h2>
            ) : null}

            <div style={{ marginTop: "5px" }}>
                <div>
                    <span hidden={!paginate}>
                        <button
                            onClick={clickPrevious}
                            style={{
                                marginLeft: "20px",
                                marginRight: "10px",
                                backgroundColor: "lightgray",
                                borderRadius: "10px",
                                padding: "5px 20px",
                            }}
                            disabled={currentItemIdx <= 0}
                        >
                            Previous
                        </button>
                        Page {currentItemIdx + 1} of {numItems}
                        <button
                            onClick={clickNext}
                            style={{
                                marginLeft: "10px",
                                backgroundColor: "lightgray",
                                borderRadius: "10px",
                                padding: "5px 20px",
                            }}
                            disabled={currentItemIdx >= numItems - 1}
                        >
                            Next
                        </button>
                    </span>
                    {activityLevelAttempts && maxAttemptsAllowed !== 1 ? (
                        <button
                            onClick={generateActivityAttempt}
                            disabled={
                                numItems === 0 ||
                                (maxAttemptsAllowed > 0 &&
                                    attemptNumber >= maxAttemptsAllowed)
                            }
                            style={{
                                marginLeft: "30px",
                                backgroundColor: "lightgray",
                                borderRadius: "10px",
                                padding: "5px 20px",
                            }}
                        >
                            New attempt{" "}
                            {maxAttemptsAllowed > 0
                                ? `(${(maxAttemptsAllowed - attemptNumber).toString()} left)`
                                : null}
                        </button>
                    ) : null}
                </div>
            </div>

            <div
                hidden={itemsRendered.length > 0 || numItems === 0}
                style={{ marginLeft: "20px", marginTop: "20px" }}
            >
                Initializing...
            </div>
            <Activity
                flags={flags}
                baseId={activityId}
                maxAttemptsAllowed={maxAttemptsAllowed}
                forceDisable={forceDisable}
                forceShowCorrectness={forceShowCorrectness}
                forceShowSolution={forceShowSolution}
                forceUnsuppressCheckwork={forceUnsuppressCheckwork}
                linkSettings={linkSettings}
                darkMode={darkMode}
                showAnswerResponseMenu={showAnswerResponseMenu}
                answerResponseCountsByItem={answerResponseCountsByItem}
                state={activityState}
                doenetStates={activityDoenetState.doenetStates}
                reportScoreAndStateCallback={reportScoreAndStateCallback}
                checkRender={checkRender}
                checkHidden={checkHidden}
                allowItemAttemptButtons={itemLevelAttempts}
                generateNewItemAttempt={generateNewItemAttempt}
                hasRenderedCallback={hasRenderedCallback}
                reportVisibility={!paginate}
                reportVisibilityCallback={reportVisibilityCallback}
                itemAttemptNumbers={activityDoenetState.itemAttemptNumbers}
                itemSequence={itemSequence}
            />
        </div>
    );
}
