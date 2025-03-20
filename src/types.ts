import {
    ExportedActivityState,
    isExportedActivityState,
} from "./Activity/activityState";
import type {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    calcNumVariants,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    calcNumVariantsFromState,
} from "./Activity/activityState";

export type DoenetMLFlags = {
    showCorrectness: boolean;
    readOnly: boolean;
    solutionDisplayMode: string;
    showFeedback: boolean;
    showHints: boolean;
    allowLoadState: boolean;
    allowSaveState: boolean;
    allowLocalState: boolean;
    allowSaveSubmissions: boolean;
    allowSaveEvents: boolean;
    autoSubmit: boolean;
};

export type DocumentStructureData = {
    activityId: string;
    docId: string;
    args: {
        allPossibleVariants: string[];
        success: boolean;
    };
};

export function isDocumentStructureData(
    obj: unknown,
): obj is DocumentStructureData {
    const typeObj = obj as DocumentStructureData;

    return (
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        typeObj !== null &&
        typeof typeObj === "object" &&
        typeof typeObj.activityId === "string" &&
        typeof typeObj.docId === "string" &&
        typeof typeObj.args === "object" &&
        Array.isArray(typeObj.args.allPossibleVariants) &&
        typeObj.args.allPossibleVariants.every((v) => typeof v === "string") &&
        typeof typeObj.args.success === "boolean"
    );
}

export type singleDocReportStateMessage = {
    activityId: string;
    docId: string;
    score: number;
    state: unknown;
};

export function isSingleDocReportStateMessage(
    obj: unknown,
): obj is singleDocReportStateMessage {
    const typeObj = obj as singleDocReportStateMessage;

    return (
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        typeObj !== null &&
        typeof typeObj === "object" &&
        typeof typeObj.activityId === "string" &&
        typeof typeObj.docId === "string" &&
        typeof typeObj.score === "number"
    );
}

export type ReportStateMessage = {
    subject: "SPLICE.reportScoreAndState";
    activityId: string;
    score: number;
    itemScores: {
        id: string;
        score: number;
        docId: string;
        shuffledOrder: number;
        variant: number;
    }[];
    itemUpdated?: number;
    state: ExportedActivityState;
    newAttempt?: boolean;
    newAttemptForItem?: number;
    newDoenetStateIdx?: number;
};

export function isReportStateMessage(obj: unknown): obj is ReportStateMessage {
    const typedObj = obj as ReportStateMessage;

    return (
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        typedObj !== null &&
        typeof typedObj === "object" &&
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        typedObj.subject === "SPLICE.reportScoreAndState" &&
        typeof typedObj.activityId === "string" &&
        typeof typedObj.score === "number" &&
        Array.isArray(typedObj.itemScores) &&
        typedObj.itemScores.every(
            (item) =>
                typeof item.id === "string" &&
                typeof item.score === "number" &&
                typeof item.docId === "string" &&
                typeof item.shuffledOrder === "number" &&
                typeof item.variant === "number",
        ) &&
        (typedObj.itemUpdated === undefined ||
            typeof typedObj.itemUpdated === "number") &&
        isExportedActivityState(typedObj.state) &&
        (typedObj.newAttempt === undefined ||
            typeof typedObj.newAttempt === "boolean") &&
        (typedObj.newAttemptForItem === undefined ||
            typeof typedObj.newAttemptForItem === "number") &&
        (typedObj.newDoenetStateIdx === undefined ||
            typeof typedObj.newDoenetStateIdx === "number")
    );
}

export type ReportScoreByItemMessage = {
    subject: "SPLICE.reportScoreByItem";
    activityId: string;
    score: number;
    itemScores: {
        id: string;
        score: number;
        docId: string;
        shuffledOrder: number;
        variant: number;
    }[];
};

export function isReportScoreByItemMessage(
    obj: unknown,
): obj is ReportScoreByItemMessage {
    const typeObj = obj as ReportScoreByItemMessage;

    return (
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        typeObj !== null &&
        typeof typeObj === "object" &&
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        typeObj.subject === "SPLICE.reportScoreByItem" &&
        typeof typeObj.activityId === "string" &&
        typeof typeObj.score === "number" &&
        Array.isArray(typeObj.itemScores) &&
        typeObj.itemScores.every(
            (item) =>
                typeof item.id === "string" &&
                typeof item.score === "number" &&
                typeof item.docId === "string" &&
                typeof item.shuffledOrder === "number" &&
                typeof item.variant === "number",
        )
    );
}

/**
 * A record of the number of variants for each single document activity,
 * keyed by activity id.
 *
 * Use {@link calcNumVariants} to calculate the number of variants for other activities
 * from this record.
 *
 * Use {@link calcNumVariantsFromState} to calculate the number of variants of activities
 * from this record, taking into account possible restrictions to variant slices.
 *
 */
export type ActivityVariantRecord = Record<string, number>;

/**
 * A description of how to restrict the variant of a given activity.
 *
 * The `numSlices` attribute indicates how many slices the variants were broken up into.
 * The (1-indexed) `idx` attribute indicate which slice of those `numSlices` slices this activity
 * is restricted to.
 *
 * The typical case is that `numSlices` equals the number of variants for this activity,
 * so each slice contains just a single variant.
 */
export type RestrictToVariantSlice = { idx: number; numSlices: number };

export function isRestrictToVariantSlice(
    obj: unknown,
): obj is RestrictToVariantSlice {
    const typeObj = obj as RestrictToVariantSlice;

    return (
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        typeObj !== null &&
        typeof typeObj === "object" &&
        typeof typeObj.idx === "number" &&
        typeof typeObj.numSlices === "number"
    );
}
