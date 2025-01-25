/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { DoenetViewer } from "@doenet/doenetml-iframe";
import {
    AssignmentSource,
    Description,
    DoenetMLFlags,
    Question,
} from "../types";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { useEffect, useMemo, useReducer, useState } from "react";
import { nanoid } from "nanoid";
import { MdError } from "react-icons/md";
import { isAssignmentState } from "./assignmentState.guard";
import { assignmentStateReducer, DocId, ItemId } from "./assignmentState";
import { useGetPossibleVariants } from "./useGetPossibleVariants";

export function Viewer({
    source,
    flags,
    shuffle = false,
    assignmentId,
    userId,
    attemptNumber: _attemptNumber = 1,
    variantIndex,
    maxAttemptsAllowed: _maxAttemptsAllowed = Infinity,
    questionLevelAttempts: _questionLevelAttempts = false,
    assignmentLevelAttempts: _assignmentLevelAttempts = false,
    paginate = false,
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
    source: AssignmentSource;
    flags: DoenetMLFlags;
    shuffle?: boolean;
    assignmentId: string;
    userId?: string;
    attemptNumber?: number;
    variantIndex: number;
    maxAttemptsAllowed?: number;
    questionLevelAttempts?: boolean;
    assignmentLevelAttempts?: boolean;
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
    // The items that have already been rendered
    const [itemsRendered, setItemsRendered] = useState<Set<ItemId>>(new Set());

    // The items that have been designated to be rendered
    const [itemsToRender, setItemsToRender] = useState<Set<ItemId>>(new Set());

    const [needNewAssignmentState, setNeedNewAssignmentState] = useState(false);
    const [needNewGetStateListeners, setNeedNewGetStateListeners] =
        useState(false);

    const [assignmentState, assignmentStateDispatch] = useReducer(
        assignmentStateReducer,
        {
            assignmentAttemptNumber: 0,
            creditAchieved: 0,
            attempts: [],
        },
    );

    const numItems = source.items.length;

    const itemOrder: { index: number; id: ItemId }[] = useMemo(() => {
        if (assignmentState.assignmentAttemptNumber === 0) {
            return [...Array(numItems).keys()].map((index) => ({
                index,
                id: source.items[index].id,
            }));
        } else {
            return assignmentState.attempts[
                assignmentState.assignmentAttemptNumber - 1
            ].items.map((item) => ({
                id: item.itemId,
                index: source.items.findIndex((v) => v.id === item.itemId),
            }));
        }
    }, [assignmentState, source.items, numItems]);

    const selectedItemDocs: Record<ItemId, { docId: DocId; variant: number }> =
        useMemo(() => {
            if (assignmentState.assignmentAttemptNumber === 0) {
                return {};
            }

            const lastAssignmentAttempt =
                assignmentState.attempts[
                    assignmentState.assignmentAttemptNumber - 1
                ];

            return Object.fromEntries(
                lastAssignmentAttempt.items.map((item) => {
                    const lastItemAttempt =
                        item.attempts[item.itemAttemptNumber - 1];
                    return [
                        item.itemId,
                        {
                            docId: lastItemAttempt.docId,
                            variant: lastItemAttempt.variant,
                        },
                    ];
                }),
            );
        }, [assignmentState]);

    // The index of the current item
    const [currentItemIdx, setCurrentItemIdx] = useState(0);

    // The id of the current item
    const currentItemId = itemOrder[currentItemIdx]?.id;

    const [errMsg, setErrMsg] = useState<string | null>(null);

    const [itemIdToOrigItemIdx, itemWeights, numDocsTotal] = useMemo(() => {
        const idToIdx: Record<ItemId, number> = {};
        let weights = [];
        let totalWeight = 0;
        let numDocsTotal = 0;
        for (const [idx, item] of source.items.entries()) {
            numDocsTotal += getNumDocs(item);
            idToIdx[item.id] = idx;
            if (item.type === "question") {
                const w = item.weight ?? 1;
                weights.push(w);
                totalWeight += w;
            } else {
                weights.push(0);
            }
        }
        weights = weights.map((w) => w / totalWeight);

        return [idToIdx, weights, numDocsTotal];
    }, [source]);

    const { numVariantsByItemDoc, allVariantsCalculated } =
        useGetPossibleVariants({ assignmentId, numDocsTotal });

    useEffect(() => {
        const listenersAdded: ((event: MessageEvent) => void)[] = [];
        const timeoutIdsAdded: number[] = [];
        function loadState() {
            return new Promise<Record<string, unknown> | null>(
                (resolve, reject) => {
                    const messageId = nanoid();

                    window.postMessage({
                        subject: "SPLICE.getState",
                        messageId,
                        assignmentId,
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
                                    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                                    resolve(event.data.state);
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

        if (flags.allowLoadState) {
            loadState()
                .then((state) => {
                    if (isAssignmentState(state)) {
                        assignmentStateDispatch({ type: "set", state });
                        setNeedNewGetStateListeners(true);
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
    }, [flags.allowLoadState, assignmentId, userId]);

    useEffect(() => {
        if (needNewAssignmentState && allVariantsCalculated) {
            assignmentStateDispatch({
                type: "generateNewAssignmentAttempt",
                source,
                numVariantsByItemDoc,
                variantIndex,
                shuffle,
            });
            setNeedNewAssignmentState(false);
            setNeedNewGetStateListeners(true);
        }
    }, [
        needNewAssignmentState,
        allVariantsCalculated,
        source,
        numVariantsByItemDoc,
        variantIndex,
        shuffle,
    ]);

    useEffect(() => {
        const listenersAdded: ((event: MessageEvent) => void)[] = [];
        if (needNewGetStateListeners) {
            function setUpDocumentGetStateListeners() {
                const lastAssignmentAttempt =
                    assignmentState.attempts[
                        assignmentState.assignmentAttemptNumber - 1
                    ];

                for (const item of lastAssignmentAttempt.items) {
                    const itemId = item.itemId;
                    const lastItemAttempt =
                        item.attempts[item.itemAttemptNumber - 1];

                    const itemStateListener = function (event: MessageEvent) {
                        if (event.origin !== window.location.origin) {
                            return;
                        }

                        if (
                            event.data.subject === "SPLICE.getState" &&
                            event.data.activityId === assignmentId &&
                            event.data.docId ===
                                `${itemId}|${lastItemAttempt.docId}`
                        ) {
                            window.postMessage({
                                subject: "SPLICE.getState.response",
                                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                                messageId: event.data.messageId,
                                success: true,
                                loadedState: lastItemAttempt.docState !== null,
                                state: lastItemAttempt.docState,
                            });

                            window.removeEventListener(
                                "message",
                                itemStateListener,
                            );
                        }
                    };

                    window.addEventListener("message", itemStateListener);
                    listenersAdded.push(itemStateListener);
                }
            }

            setUpDocumentGetStateListeners();
        }

        return () => {
            // make sure all listeners are removed
            for (const listener of listenersAdded) {
                window.removeEventListener("message", listener);
            }
        };
    }, [needNewGetStateListeners, assignmentId, assignmentState]);

    // Set listener for the `SPLICE.initialized` event from the selected doc of each item.
    // When the event occurs, set `itemsRendered` to record the item is now rendered.
    useEffect(() => {
        const renderedListener = (event: MessageEvent) => {
            if (event.origin !== window.location.origin) {
                return;
            }
            if (
                event.data.subject === "SPLICE.initialized" &&
                event.data.activityId === assignmentId
            ) {
                const [itemId, _docId] = (event.data.docId as string).split(
                    "|",
                );
                setItemsRendered((was) => {
                    const obj = new Set(was);
                    obj.add(itemId);
                    return obj;
                });
            }
        };

        window.addEventListener("message", renderedListener);

        return () => {
            window.removeEventListener("message", renderedListener);
        };
    }, [assignmentId]);

    useEffect(() => {
        const stateListener = (event: MessageEvent) => {
            if (
                event.origin !== window.location.origin ||
                event.data.activityId !== assignmentId
            ) {
                return;
            }

            if (event.data.subject === "SPLICE.reportScoreAndState") {
                const [itemId] = (event.data.docId as string).split("|");

                assignmentStateDispatch({
                    type: "updateItemState",
                    itemId,
                    docState: event.data.state,
                    creditAchieved: event.data.score as number,
                    itemIdToOrigItemIdx,
                    itemOrder,
                    itemWeights,
                    flags,
                    assignmentId,
                });
            }
        };

        window.addEventListener("message", stateListener);

        return () => {
            window.removeEventListener("message", stateListener);
        };
    }, [assignmentId, itemIdToOrigItemIdx, itemWeights, itemOrder, flags]);

    function addItemToRender(itemId: ItemId) {
        if (!itemsToRender.has(itemId)) {
            setItemsToRender((was) => {
                const obj = new Set(was);
                obj.add(itemId);
                return obj;
            });
        }
    }

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

    if (allVariantsCalculated && !needNewAssignmentState) {
        if (paginate) {
            if (!itemsRendered.has(currentItemId)) {
                // the current item is always rendered
                addItemToRender(currentItemId);
            } else {
                const nextItemId = itemOrder[currentItemIdx + 1]?.id;
                if (
                    currentItemIdx < numItems - 1 &&
                    !itemsRendered.has(nextItemId)
                ) {
                    // render the next item if the current item is already rendered
                    addItemToRender(nextItemId);
                } else {
                    const prevItemId = itemOrder[currentItemIdx - 1]?.id;
                    if (currentItemIdx > 0 && !itemsRendered.has(prevItemId)) {
                        // render the previous item if the current and next item are already rendered
                        addItemToRender(prevItemId);
                    }
                }
            }
        }
    }

    // We include a `<DoenetViewer>` for every document in the assignment even though they may not all be rendered.
    // Having this rendered in the render loop is needed so that each document will send the
    // `SPLICE.allPossibleVariants` message that the `useGetPossibleVariants` hook need to calculate all variants.
    let questionNumber = 0;
    const viewersByItem = itemOrder.map(
        ({ index: origItemIdx }, shuffledItemIdx) => {
            const item = source.items[origItemIdx];
            const itemHidden = paginate && shuffledItemIdx !== currentItemIdx;

            if (item.type === "question") {
                questionNumber++;
                return (
                    <div key={item.id} hidden={itemHidden}>
                        {item.id}
                        {item.documents.map((d) => {
                            const render =
                                itemsToRender.has(item.id) &&
                                selectedItemDocs[item.id].docId === d.id;

                            return (
                                <div key={d.id} hidden={!render}>
                                    {d.id}
                                    <DoenetViewer
                                        doenetML={d.doenetML}
                                        render={render}
                                        requestedVariantIndex={
                                            selectedItemDocs[item.id]
                                                ?.variant ?? 1
                                        }
                                        flags={flags}
                                        activityId={assignmentId}
                                        prefixForIds={`${assignmentId}|${item.id}|${d.id}`}
                                        docId={`${item.id}|${d.id}`}
                                        forceDisable={forceDisable}
                                        forceShowCorrectness={
                                            forceShowCorrectness
                                        }
                                        forceShowSolution={forceShowSolution}
                                        forceUnsuppressCheckwork={
                                            forceUnsuppressCheckwork
                                        }
                                        linkSettings={linkSettings}
                                        darkMode={darkMode}
                                        showAnswerTitles={showAnswerTitles}
                                        addVirtualKeyboard={false}
                                        initializeCounters={{
                                            question: questionNumber,
                                            problem: questionNumber,
                                        }}
                                    />
                                </div>
                            );
                        })}
                    </div>
                );
            } else {
                return (
                    <div key={item.id} hidden={itemHidden}>
                        <DoenetViewer
                            doenetML={item.document.doenetML}
                            render={itemsToRender.has(item.id)}
                            requestedVariantIndex={
                                selectedItemDocs[item.id]?.variant ?? 1
                            }
                            flags={flags}
                            activityId={assignmentId}
                            prefixForIds={`${assignmentId}|${item.id}|${item.id}`}
                            docId={`${item.id}|${item.id}`}
                            forceDisable={forceDisable}
                            forceShowCorrectness={forceShowCorrectness}
                            forceShowSolution={forceShowSolution}
                            forceUnsuppressCheckwork={forceUnsuppressCheckwork}
                            linkSettings={linkSettings}
                            darkMode={darkMode}
                            showAnswerTitles={showAnswerTitles}
                            addVirtualKeyboard={false}
                        />
                    </div>
                );
            }
        },
    );

    return (
        <div>
            <h2>{source.title}</h2>
            <div>
                <button onClick={clickPrevious}>Previous</button>
                <button onClick={clickNext}>Next</button>
            </div>
            <div>Assignment credit: {assignmentState.creditAchieved}</div>
            <div>
                Credit by item, latest attempt:
                <ol>
                    {assignmentState.attempts[
                        assignmentState.assignmentAttemptNumber - 1
                    ]?.items
                        .filter(
                            (item) =>
                                source.items[itemIdToOrigItemIdx[item.itemId]]
                                    .type === "question",
                        )
                        .map((item) => (
                            <li key={item.itemId}>{item.creditAchieved}</li>
                        ))}
                </ol>
            </div>
            {viewersByItem}
        </div>
    );
}

function getNumDocs(item: Question | Description) {
    if (item.type === "question") {
        return item.documents.length;
    } else {
        return 1;
    }
}
