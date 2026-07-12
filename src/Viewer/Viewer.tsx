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
    createSourceHash,
} from "../Activity/activityState";
import type { MountPolicy } from "@doenet/doenetml-iframe";
import { Activity } from "../Activity/Activity";
import { activityDoenetStateReducer } from "../Activity/activityStateReducer";
import { useContentStable } from "../utils/hooks";

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
    standaloneUrl,
    cssUrl,
    doenetmlVersion,
    fetchExternalDoenetML,
    darkMode = "light",
    showAnswerResponseMenu = false,
    answerResponseCountsByItem = [],
    showTitle = true,
    itemWord = "item",
    mountPolicy,
    useSharedCoreWorker = false,
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
    standaloneUrl?: string;
    cssUrl?: string;
    doenetmlVersion?: string;
    fetchExternalDoenetML?: (arg: string) => Promise<string>;
    darkMode?: "dark" | "light";
    showAnswerResponseMenu?: boolean;
    answerResponseCountsByItem?: Record<string, number>[];
    showTitle?: boolean;
    itemWord?: string;
    mountPolicy: MountPolicy;
    useSharedCoreWorker?: boolean;
}) {
    const initialPass = useRef(true);

    // Source analysis. A source error is *derived* from the memo (not set
    // into state), so a later valid `source` self-clears it.
    const { numActivityVariants, sourceHash, numItems, sourceErrMsg } =
        useMemo(() => {
            try {
                validateIds(source);
                const docStructure = gatherDocumentStructure(source);
                const sourceHash = createSourceHash(source);
                const numItems = getNumItems(source);
                return {
                    ...docStructure,
                    sourceHash,
                    numItems,
                    sourceErrMsg: null,
                };
            } catch (e) {
                const message = e instanceof Error ? e.message : "";
                return {
                    numActivityVariants: {},
                    sourceHash: "",
                    numItems: 0,
                    sourceErrMsg: `Error in activity source: ${message}`,
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

    // Identifies the state generation items were seeded from: bumped by the
    // reducer when the whole activity re-initializes or loads saved state,
    // telling items to re-read their initial Doenet state.
    const stateVersion = activityDoenetState.stateVersion;

    // A runtime (attempt-generation) error leaves the previous activity
    // state untouched, so the activity stays rendered with an error banner
    // above it — the student's work is preserved and "New attempt" offers a
    // retry, which self-clears the error on success.
    const runtimeErrMsg = activityDoenetState.errMsg;

    // Content-stable: every reducer action (each score report included)
    // rebuilds `activityState`, but the sequence of item ids rarely changes.
    // Keeping the previous identity when the ids match lets everything
    // derived from it (`itemIndexById`, the callbacks, the memoized item
    // subtrees) stay stable across reports.
    const computedItemSequence = useMemo(
        () => getItemSequence(activityState),
        [activityState],
    );
    const itemSequence = useContentStable(
        computedItemSequence,
        JSON.stringify(computedItemSequence),
    );

    const itemIndexById = useMemo(
        () => new Map(itemSequence.map((id, idx) => [id, idx])),
        [itemSequence],
    );

    // The index of the current item
    const [currentItemIdx, setCurrentItemIdx] = useState(0);
    const currentItemId = itemSequence[currentItemIdx];

    const [itemsRendered, setItemsRendered] = useState<string[]>([]);

    const [newAttemptNum, setNewAttemptNum] = useState(0);
    const dialogRef = useRef<HTMLDialogElement>(null);
    const newItemAttemptInfo = useRef({ id: "", initialQuestionCounter: 0 });

    const attemptNumber = activityState.attemptNumber;

    // Every item's viewer is always mounted; the windowed mounting policy
    // (`mountPolicy`) decides which of them are actually booted, parking the
    // rest as placeholders. In paginated mode the current page and its
    // neighbors are marked `keepLive` so they boot eagerly (hidden pages
    // never intersect the viewport) and page flips within the window are
    // instant; in scroll mode visibility alone governs.
    const checkKeepLive = useCallback(
        (state: ActivityState) => {
            if (!paginate || state.type !== "singleDoc") {
                return false;
            }
            const itemIdx = itemIndexById.get(state.id);
            return (
                itemIdx !== undefined && Math.abs(itemIdx - currentItemIdx) <= 1
            );
        },
        [paginate, itemIndexById, currentItemIdx],
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
        } else if (sourceErrMsg === null) {
            activityDoenetStateDispatch({
                type: "initialize",
                source,
                variantIndex: initialVariantIndex,
                numActivityVariants,
            });
        }
    }, [
        activityId,
        source,
        initialVariantIndex,
        numActivityVariants,
        sourceErrMsg,
    ]);

    useEffect(() => {
        if (sourceErrMsg !== null) {
            // An invalid source must not reach the reducer; when a valid
            // source arrives, this effect re-runs (its inputs derive from
            // `source`) and initializes normally.
            return;
        }

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

        activityDoenetStateDispatch({
            type: "generateNewActivityAttempt",
            numActivityVariants,
            initialQuestionCounter: 1,
            allowSaveState: flags.allowSaveState,
            baseId: activityId,
            sourceHash,
            initialAttempt: true,
        });

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
        sourceErrMsg,
    ]);

    function clickNext() {
        setCurrentItemIdx((was) => Math.min(numItems - 1, was + 1));
    }
    function clickPrevious() {
        setCurrentItemIdx((was) => Math.max(0, was - 1));
    }

    const reportScoreAndStateCallback = useCallback(
        (msg: unknown) => {
            if (isSingleDocReportStateMessage(msg)) {
                // The reducer derives the document's position (and ignores
                // reports from documents no longer in the activity).
                activityDoenetStateDispatch({
                    type: "updateSingleState",
                    docId: msg.docId,
                    doenetState: msg.state,
                    creditAchieved: msg.score,
                    allowSaveState: flags.allowSaveState,
                    baseId: activityId,
                    sourceHash,
                });
            }
        },
        [flags.allowSaveState, activityId, sourceHash],
    );

    const generateNewItemAttemptPrompt = useCallback(
        (id: string, initialQuestionCounter: number) => {
            newItemAttemptInfo.current = { id, initialQuestionCounter };
            setNewAttemptNum((itemIndexById.get(id) ?? 0) + 1);
            dialogRef.current?.showModal();
        },
        [itemIndexById],
    );

    function generateNewItemAttempt() {
        const { id, initialQuestionCounter } = newItemAttemptInfo.current;
        activityDoenetStateDispatch({
            type: "generateSingleDocSubActivityAttempt",
            docId: id,
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
    }

    const hasRenderedCallback = useCallback((id: string) => {
        setItemsRendered((was) => (was.includes(id) ? was : [...was, id]));
    }, []);

    function generateActivityAttempt() {
        setItemsRendered([]);
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

    const errorIcon = (
        <span style={{ fontSize: "1em", color: "#C1292E" }}>
            <MdError />
        </span>
    );

    // Without a valid source there is nothing to render; the derived
    // `sourceErrMsg` self-clears when a valid `source` prop arrives.
    if (sourceErrMsg !== null) {
        return (
            <div
                style={{
                    fontSize: "1.3em",
                    marginLeft: "20px",
                    marginTop: "20px",
                }}
            >
                {errorIcon} {sourceErrMsg}
            </div>
        );
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
                            backgroundColor: "var(--buttonSurface)",
                            color: "var(--canvasText)",
                            borderRadius: "10px",
                            padding: "5px 20px",
                        }}
                        data-test="Cancel Create New Attempt"
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
                            backgroundColor: "var(--buttonSurface)",
                            color: "var(--canvasText)",
                            borderRadius: "10px",
                            padding: "5px 20px",
                        }}
                        data-test="Confirm Create New Attempt"
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
                                backgroundColor: "var(--buttonSurface)",
                                color: "var(--canvasText)",
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
                                backgroundColor: "var(--buttonSurface)",
                                color: "var(--canvasText)",
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
                                backgroundColor: "var(--buttonSurfaceAlt)",
                                color: "var(--canvasText)",
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

            {runtimeErrMsg !== null ? (
                <div
                    style={{
                        fontSize: "1.3em",
                        marginLeft: "20px",
                        marginTop: "20px",
                    }}
                    data-test="Activity Error"
                >
                    {errorIcon} {runtimeErrMsg}
                </div>
            ) : null}
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
                standaloneUrl={standaloneUrl}
                cssUrl={cssUrl}
                doenetmlVersion={doenetmlVersion}
                fetchExternalDoenetML={fetchExternalDoenetML}
                darkMode={darkMode}
                showAnswerResponseMenu={showAnswerResponseMenu}
                answerResponseCountsByItem={answerResponseCountsByItem}
                state={activityState}
                doenetStates={activityDoenetState.doenetStates}
                stateVersion={stateVersion}
                mountPolicy={mountPolicy}
                useSharedCoreWorker={useSharedCoreWorker}
                reportScoreAndStateCallback={reportScoreAndStateCallback}
                checkHidden={checkHidden}
                checkKeepLive={checkKeepLive}
                allowItemAttemptButtons={itemLevelAttempts}
                generateNewItemAttempt={generateNewItemAttemptPrompt}
                hasRenderedCallback={hasRenderedCallback}
                itemAttemptNumbers={activityDoenetState.itemAttemptNumbers}
                itemIndexById={itemIndexById}
                itemWord={itemWord}
            />
        </div>
    );
}
