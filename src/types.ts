export type Question = {
    type: "question";
    weight?: number;
    documents: string[];
};

export type Description = {
    type: "description";
    document: string;
};

export type AssignmentSource = {
    title: string;
    numVariants?: number;
    content: (Question | Description)[];
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
