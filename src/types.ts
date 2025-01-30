import {
    ActivityStateNoSource,
    isActivityStateNoSource,
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
        baseLevelComponentCounts: Record<string, number>;
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
        typeof typeObj.args.baseLevelComponentCounts === "object" &&
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

export type reportStateMessage = {
    subject: "SPLICE.reportScoreAndState";
    activityId: string;
    score: number;
    scoreByItem: { id: string; score: number; duplicateNumber?: number }[];
    state: ActivityStateNoSource;
};

export function isReportStateMessage(obj: unknown): obj is reportStateMessage {
    const typeObj = obj as reportStateMessage;

    return (
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        typeObj !== null &&
        typeof typeObj === "object" &&
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        typeObj.subject === "SPLICE.reportScoreAndState" &&
        typeof typeObj.activityId === "string" &&
        typeof typeObj.score === "number" &&
        Array.isArray(typeObj.scoreByItem) &&
        typeObj.scoreByItem.every(
            (item) =>
                typeof item.id === "string" && typeof item.score === "number",
        ) &&
        isActivityStateNoSource(typeObj.state)
    );
}

export type reportScoreByItemMessage = {
    subject: "SPLICE.reportScoreByItem";
    activityId: string;
    score: number;
    scoreByItem: { id: string; score: number; duplicateNumber?: number }[];
};

export function isReportScoreByItemMessage(
    obj: unknown,
): obj is reportScoreByItemMessage {
    const typeObj = obj as reportScoreByItemMessage;

    return (
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        typeObj !== null &&
        typeof typeObj === "object" &&
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        typeObj.subject === "SPLICE.reportScoreByItem" &&
        typeof typeObj.activityId === "string" &&
        typeof typeObj.score === "number" &&
        Array.isArray(typeObj.scoreByItem) &&
        typeObj.scoreByItem.every(
            (item) =>
                typeof item.id === "string" && typeof item.score === "number",
        )
    );
}
