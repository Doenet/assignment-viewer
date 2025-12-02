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
    doenetViewerUrl,
    fetchExternalDoenetML,
    darkMode = "light",
    showAnswerResponseMenu = false,
    answerResponseCountsByItem = [],
    showTitle = true,
    itemWord = "item",
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
    doenetViewerUrl?: string;
    fetchExternalDoenetML?: (arg: string) => Promise<string>;
    darkMode?: "dark" | "light";
    showAnswerResponseMenu?: boolean;
    answerResponseCountsByItem?: Record<string, number>[];
    showTitle?: boolean;
    itemWord?: string;
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

    const [newAttemptNum, setNewAttemptNum] = useState(0);
    const dialogRef = useRef<HTMLDialogElement>(null);
    const newItemAttemptInfo = useRef({ id: "", initialQuestionCounter: 0 });

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

        function requestLoadState() {
            const message_id = nanoid();

            window.postMessage({
                subject: "SPLICE.getState",
                message_id,
                activity_id: activityId,
                user_id: userId,
            });

            const loadStateListener = function (event: MessageEvent) {
                if (event.origin !== window.location.origin) {
                    return;
                }

                if (
                    event.data.subject === "SPLICE.getState.response" &&
                    event.data.message_id === message_id
                ) {
                    const exportedState: unknown = event.data.state;
                    if (isExportedActivityState(exportedState)) {
                        if (validateStateAndSource(exportedState, source)) {
                            const state = addSourceToActivityState(
                                exportedState.activityState,
                                source,
                            );

                            activityDoenetStateDispatch({
                                type: "set",
                                state: {
                                    activityState: state,
                                    doenetStates: exportedState.doenetStates,
                                    itemAttemptNumbers:
                                        exportedState.itemAttemptNumbers,
                                },
                                allowSaveState: flags.allowSaveState,
                                baseId: activityId,
                            });
                        }
                    }

                    window.removeEventListener("message", loadStateListener);
                }
            };

            window.addEventListener("message", loadStateListener);
            listenersAdded.push(loadStateListener);
        }

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

        if (flags.allowLoadState) {
            requestLoadState();
        }

        return () => {
            // make sure all listeners are removed
            for (const listener of listenersAdded) {
                window.removeEventListener("message", listener);
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

    function generateNewItemAttemptPrompt(
        id: string,
        initialQuestionCounter: number,
    ) {
        newItemAttemptInfo.current = { id, initialQuestionCounter };
        setNewAttemptNum((itemSequence.indexOf(id) ?? 0) + 1);
        dialogRef.current?.showModal();
    }

    function generateNewItemAttempt() {
        const { id, initialQuestionCounter } = newItemAttemptInfo.current;
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
        setItemsRendered([]);
        setItemsToRender([]);
        setCurrentItemIdx(0);
        activityDoenetStateDispatch({
            type: "generateNewActivityAttempt",
            numActivityVariants,
            initialQuestionCounter: 1,
            allowSaveState: flags.allowSaveState,
            baseId: activityId,
            sourceHash,
        });
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

    const activityAttemptsLeft = Math.max(
        maxAttemptsAllowed - attemptNumber,
        0,
    );
    const newAttemptsLeft =
        newAttemptNum === 0
            ? activityAttemptsLeft
            : Math.max(
                  maxAttemptsAllowed -
                      activityDoenetState.itemAttemptNumbers[newAttemptNum - 1],
                  0,
              );

    const newAttemptDisabled =
        numItems === 0 || (maxAttemptsAllowed > 0 && activityAttemptsLeft <= 0);

    return (
        <div>
            <dialog ref={dialogRef}>
                <h3>
                    Create new attempt of{" "}
                    {newAttemptNum === 0
                        ? "the entire activity"
                        : `${itemWord} ${newAttemptNum.toString()}`}
                    ?
                </h3>

                <p>
                    Creating a new attempt will generate{" "}
                    {newAttemptNum === 0
                        ? `new versions of all ${itemWord}s so that you can start again at the beginning.`
                        : `a new version of ${itemWord} ${newAttemptNum.toString()} so that you can start that ${itemWord} again.`}
                </p>

                {maxAttemptsAllowed > 0 ? (
                    <p>
                        You can create a new attempt{" "}
                        {newAttemptsLeft.toString()} more time
                        {newAttemptsLeft > 1 ? "s" : ""}.
                    </p>
                ) : null}

                <p style={{ marginTop: "30px" }}>
                    <button
                        autoFocus
                        onClick={() => {
                            dialogRef.current?.close();
                        }}
                        style={{
                            marginLeft: "30px",
                            backgroundColor: "lightgray",
                            borderRadius: "10px",
                            padding: "5px 20px",
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => {
                            if (newAttemptNum === 0) {
                                generateActivityAttempt();
                            } else {
                                generateNewItemAttempt();
                            }
                            dialogRef.current?.close();
                        }}
                        style={{
                            marginLeft: "30px",
                            backgroundColor: "lightgray",
                            borderRadius: "10px",
                            padding: "5px 20px",
                        }}
                    >
                        Create new attempt
                    </button>
                </p>
            </dialog>
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
                            onClick={() => {
                                setNewAttemptNum(0);
                                dialogRef.current?.showModal();
                            }}
                            disabled={newAttemptDisabled}
                            style={{
                                marginLeft: "30px",
                                backgroundColor: "rgb(237, 242, 247)",
                                opacity: newAttemptDisabled ? 0.4 : "inherit",
                                borderRadius: "10px",
                                padding: "5px 20px",
                                cursor: newAttemptDisabled
                                    ? "not-allowed"
                                    : "pointer",
                            }}
                        >
                            New attempt{" "}
                            {maxAttemptsAllowed > 0
                                ? `(${activityAttemptsLeft.toString()} left)`
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
                doenetViewerUrl={doenetViewerUrl}
                fetchExternalDoenetML={fetchExternalDoenetML}
                darkMode={darkMode}
                showAnswerResponseMenu={showAnswerResponseMenu}
                answerResponseCountsByItem={answerResponseCountsByItem}
                state={activityState}
                doenetStates={activityDoenetState.doenetStates}
                reportScoreAndStateCallback={reportScoreAndStateCallback}
                checkRender={checkRender}
                checkHidden={checkHidden}
                allowItemAttemptButtons={itemLevelAttempts}
                generateNewItemAttempt={generateNewItemAttemptPrompt}
                hasRenderedCallback={hasRenderedCallback}
                reportVisibility={!paginate}
                reportVisibilityCallback={reportVisibilityCallback}
                itemAttemptNumbers={activityDoenetState.itemAttemptNumbers}
                itemSequence={itemSequence}
                itemWord={itemWord}
            />
        </div>
    );
}
