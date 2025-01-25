/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { useCallback, useEffect, useState } from "react";
import { DocId, ItemId } from "./assignmentState";

/**
 * A hook that calculates all possible variants by listening for
 * the `SPLICE.allPossibleVariants` message coming from `numDocsTotal` DoenetML
 * documents with activityId = `assignmentId` and whose `docId`
 * contains an `itemId` and `docId` concatenated with a `|` in between.
 *
 * For this to work, all the DoenetML documents must be initiated,
 * i.e., returned as the render result of a component,
 * so that they will calculate the variants and send the `SPLICE.allPossibleVariants` message.
 * They can be hidden and have their render attribute set to `false`,
 * which will prevent core from actually starting.
 *
 * When the calculations are complete, `allVariantsCalculated` will be set to `true`,
 * and numVariantsByItemDoc will be on object keyed by `itemId` with values
 * that are objects keyed by `docId` and values that give the number of variants for each document.
 */
export function useGetPossibleVariants({
    assignmentId,
    numDocsTotal,
}: {
    assignmentId: string;
    numDocsTotal: number;
}) {
    // The number of variants present in the DoenetML for each doc (rendered or not)
    const [numVariantsByItemDoc, setNumVariantsByItemDoc] = useState<
        Record<ItemId, Record<DocId, number>>
    >({});

    // The total number of docs for which we have calculated `numVariantsByItemDoc`
    const [numDocsWithVariantsCalculated, setNumDocsWithVariantsCalculated] =
        useState(0);

    const [allVariantsCalculated, setAllVariantsCalculated] = useState(false);

    /**
     * A listener for the `SPLICE.allPossibleVariants` event
     * originating from every document of every item (even if not rendered).
     *
     * Sets the state variables associated with variant information for each document:
     * - numVariantsByItemDoc
     * - numDocsWithVariantsCalculated
     */
    const variantListener = useCallback(
        (event: MessageEvent) => {
            if (event.origin !== window.location.origin) {
                return;
            }

            if (
                event.data.subject === "SPLICE.allPossibleVariants" &&
                event.data.activityId === assignmentId
            ) {
                const [itemId, docId] = (event.data.docId as string).split("|");
                const numVariants = (
                    event.data.args.allPossibleVariants as string[]
                ).length;

                setNumVariantsByItemDoc((was) => {
                    const obj = { ...was };

                    if (itemId in obj) {
                        obj[itemId] = { ...obj[itemId] };
                    } else {
                        obj[itemId] = {};
                    }
                    obj[itemId][docId] = numVariants;
                    return obj;
                });

                setNumDocsWithVariantsCalculated((was) => was + 1);
            }
        },
        [assignmentId],
    );

    // When `source` has been changed, reset all variant/selected item variables
    // and add a listener for the events that the number of variants have been calculated
    useEffect(() => {
        setNumVariantsByItemDoc({});
        setNumDocsWithVariantsCalculated(0);
        setAllVariantsCalculated(false);

        window.addEventListener("message", variantListener);

        return () => {
            window.removeEventListener("message", variantListener);
        };
    }, [variantListener]);

    useEffect(() => {
        if (numDocsWithVariantsCalculated === numDocsTotal) {
            window.removeEventListener("message", variantListener);
            setAllVariantsCalculated(true);
        }
    }, [numDocsWithVariantsCalculated, numDocsTotal, variantListener]);

    return {
        numVariantsByItemDoc,
        allVariantsCalculated,
    };
}
