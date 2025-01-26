export type Question = {
    type: "question";
    id: "string";
    weight?: number;
    documents: Document[];
};

export type Document = {
    id: string;
    doenetML: string;
    version: string;
};

export type Description = {
    type: "description";
    id: "string";
    document: Document;
};

export type AssignmentSource = {
    title: string;
    numVariants?: number;
    items: (Question | Description)[];
};

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
