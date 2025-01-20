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
import { prng_alea } from "esm-seedrandom";
import { useCallback, useEffect, useState } from "react";

/**
 * A message that is sent from an iframe to the parent window.
 */
// type IframeMessage = {
//     origin: string;
//     data: Record<string, unknown>;
//     subject?: string;
// };

export function Viewer({
    source,
    flags,
    shuffle: _shuffle = false,
    assignmentId,
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
    assignmentId?: string;
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const rngClass = prng_alea;

    const [numVariantsByItemDoc, setNumVariantsByItemDoc] = useState<
        number[][]
    >([]);
    const [numVariantsPerItem, setNumVariantsPerItem] = useState<number[]>([]);
    const [_numVariantsTotal, _setNumVariantsTotal] = useState(0);

    const [_numDocsPerItem, setNumDocsPerItem] = useState<number[]>([]);
    const [numDocsTotal, setNumDocsTotal] = useState(0);
    const [numDocsWithVariantsCalculated, setNumDocsWithVariantsCalculated] =
        useState(0);

    const [selectedItemVariants, setSelectedItemVariants] = useState<
        number[] | null
    >(null);

    const [selectedItemDocs, setSelectedItemDocs] = useState<number[]>(
        Array(source.content.length).fill(-1),
    );
    const [selectedItemDocVariants, setSelectedItemDocVariants] = useState<
        number[]
    >(Array(source.content.length).fill(1));

    const [currentItem, setCurrentItem] = useState(1);
    const [itemsRendered, setItemsRendered] = useState<Set<number>>(new Set());
    const [itemsToRender, setItemsToRender] = useState<Set<number>>(new Set());

    const numItems = source.content.length;

    function getNumDocs(item: Question | Description) {
        if (item.type === "question") {
            return item.documents.length;
        } else {
            return 1;
        }
    }

    const variantListener = useCallback(
        (event: MessageEvent) => {
            if (
                event.data.subject === "SPLICE.allPossibleVariants" &&
                event.data.args.activityId === assignmentId
            ) {
                const [qInd, dInd] = (event.data.args.docId as string)
                    .split("_")
                    .map((s) => Number(s));
                const numVariants = (
                    event.data.args.allPossibleVariants as string[]
                ).length;

                setNumVariantsByItemDoc((was) => {
                    const arr = was.map((v) => [...v]);
                    if (!arr[qInd]) {
                        arr[qInd] = [];
                    }
                    arr[qInd][dInd] = numVariants;
                    return arr;
                });

                setNumVariantsPerItem((was) => {
                    const arr = [...was];
                    arr[qInd] = (arr[qInd] ?? 0) + numVariants;
                    return arr;
                });

                setNumDocsWithVariantsCalculated((was) => was + 1);
            }
        },
        [assignmentId],
    );

    useEffect(() => {
        const renderedListener = (event: MessageEvent) => {
            if (
                event.data.subject === "SPLICE.initialized" &&
                event.data.activityId === assignmentId
            ) {
                const [qInd, _dInd] = (event.data.docId as string)
                    .split("_")
                    .map((s) => Number(s));
                console.log(`item ${qInd.toString()} was rendered`);
                setItemsRendered((was) => {
                    const obj = new Set(was);
                    obj.add(qInd);
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
        console.log("resetting", JSON.parse(JSON.stringify(source)));
        setNumDocsPerItem(source.content.map((item) => getNumDocs(item)));
        setNumDocsTotal(source.content.reduce((a, c) => a + getNumDocs(c), 0));
        setNumVariantsByItemDoc([]);
        setNumVariantsPerItem([]);
        setNumDocsWithVariantsCalculated(0);
        setSelectedItemVariants(null);
        setSelectedItemDocs(Array(source.content.length).fill(-1));
        setSelectedItemDocVariants(Array(source.content.length).fill(1));

        setItemsRendered(new Set());
        setItemsToRender(new Set());

        window.addEventListener("message", variantListener);

        return () => {
            window.removeEventListener("message", variantListener);
        };
    }, [source, variantListener]);

    useEffect(() => {
        if (
            numDocsWithVariantsCalculated === numDocsTotal &&
            numDocsTotal > 0
        ) {
            console.log("calculated all variants");

            window.removeEventListener("message", variantListener);

            // we've calculated the number of variants for all documents
            // and can now select a variant for each item

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
            const rng = rngClass(variantIndex.toString());
            setSelectedItemVariants(
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                numVariantsPerItem.map((n) => Math.floor(rng() * n) + 1),
            );
        }
    }, [
        numDocsTotal,
        numDocsWithVariantsCalculated,
        numVariantsPerItem,
        rngClass,
        variantIndex,
        variantListener,
    ]);

    useEffect(() => {
        if (selectedItemVariants !== null && numVariantsByItemDoc.length > 0) {
            const qDocs = [];
            const qDocVariants = [];

            // eslint-disable-next-line prefer-const
            for (let [qInd, variantInd] of selectedItemVariants.entries()) {
                if (numVariantsByItemDoc[qInd]) {
                    for (const [dInd, numVars] of numVariantsByItemDoc[
                        qInd
                    ].entries()) {
                        if (variantInd <= numVars) {
                            qDocs.push(dInd);
                            qDocVariants.push(variantInd);
                            break;
                        } else {
                            variantInd -= numVars;
                        }
                    }
                }
            }

            setSelectedItemDocs(qDocs);
            setSelectedItemDocVariants(qDocVariants);
        }
    }, [selectedItemVariants, numVariantsByItemDoc]);

    function addItemToRender(qInd: number) {
        if (!itemsToRender.has(qInd)) {
            setItemsToRender((was) => {
                const obj = new Set(was);
                obj.add(qInd);
                return obj;
            });
        }
    }

    function clickNext() {
        setCurrentItem((was) => Math.min(numItems, was + 1));
    }
    function clickPrevious() {
        setCurrentItem((was) => Math.max(1, was - 1));
    }

    if (numDocsWithVariantsCalculated === numDocsTotal && numDocsTotal > 0) {
        if (paginate) {
            if (!itemsRendered.has(currentItem - 1)) {
                // the current item is always rendered
                addItemToRender(currentItem - 1);
            } else if (
                currentItem < numItems &&
                !itemsRendered.has(currentItem)
            ) {
                // render the next item if the current item is already rendered
                addItemToRender(currentItem);
            } else if (currentItem > 1 && !itemsRendered.has(currentItem - 2)) {
                // render the previous item if the current and next item are already rendered
                addItemToRender(currentItem - 2);
            }
        }
    }

    const viewersByItem = source.content.map((item, qInd) => {
        const itemHidden = paginate && qInd !== currentItem - 1;

        if (item.type === "question") {
            return (
                <div
                    key={qInd}
                    hidden={itemHidden}
                    style={{ height: "1000px" }}
                >
                    {item.documents.map((d, dInd) => {
                        const rendered =
                            itemsToRender.has(qInd) &&
                            selectedItemDocs[qInd] === dInd;

                        return (
                            <div
                                key={dInd}
                                hidden={!rendered}
                                style={{ height: "1000px" }}
                            >
                                <DoenetViewer
                                    key={`${qInd.toString()}_${dInd.toString()}`}
                                    doenetML={d}
                                    rendered={rendered}
                                    requestedVariantIndex={
                                        selectedItemDocVariants[qInd]
                                    }
                                    flags={flags}
                                    activityId={assignmentId}
                                    prefixForIds={`${assignmentId ?? ""}_${qInd.toString()}_${dInd.toString()}`}
                                    docId={`${qInd.toString()}_${dInd.toString()}`}
                                    forceDisable={forceDisable}
                                    forceShowCorrectness={forceShowCorrectness}
                                    forceShowSolution={forceShowSolution}
                                    forceUnsuppressCheckwork={
                                        forceUnsuppressCheckwork
                                    }
                                    linkSettings={linkSettings}
                                    darkMode={darkMode}
                                    showAnswerTitles={showAnswerTitles}
                                    addVirtualKeyboard={false}
                                />
                            </div>
                        );
                    })}
                </div>
            );
        } else {
            return (
                <div
                    key={qInd}
                    hidden={itemHidden}
                    style={{ height: "1000px" }}
                >
                    <DoenetViewer
                        key={qInd}
                        doenetML={item.document}
                        rendered={itemsToRender.has(qInd)}
                        requestedVariantIndex={selectedItemDocVariants[qInd]}
                        flags={flags}
                        activityId={assignmentId}
                        prefixForIds={`${assignmentId ?? ""}_${qInd.toString()}_0`}
                        docId={`${qInd.toString()}_0`}
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
    });

    return (
        <div>
            <h2>{source.title}</h2>
            <div>
                <button onClick={clickPrevious}>Previous</button>
                <button onClick={clickNext}>Next</button>
            </div>
            {viewersByItem}
        </div>
    );
}
