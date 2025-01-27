/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { useEffect, useMemo, useState } from "react";
import { AssignmentViewer } from "../src/assignment-builder";
import { AssignmentSource } from "../src/types";
import assignmentSource from "./testAssignment.json";

import initialAssignmentState from "./testInitialState.json";
import {
    AssignmentAttemptState,
    AssignmentState,
    ItemId,
} from "../src/Viewer/assignmentState";

function App() {
    const defaultTestSettings: {
        requestedVariantIndex: number;
        showCorrectness: boolean;
        readOnly: boolean;
        showFeedback: boolean;
        showHints: boolean;
        questionLevelAttempts: boolean;
        assignmentLevelAttempts: boolean;
        shuffle: boolean;
        paginate: boolean;
    } = {
        requestedVariantIndex: 1,
        showCorrectness: true,
        readOnly: false,
        showFeedback: true,
        showHints: true,
        questionLevelAttempts: true,
        assignmentLevelAttempts: true,
        shuffle: false,
        paginate: false,
    };

    const [controlsVisible, setControlsVisible] = useState(false);
    const [testSettings, setTestSettings] = useState(defaultTestSettings);
    const [updateNumber, setUpdateNumber] = useState(0);

    const {
        requestedVariantIndex,
        showCorrectness,
        readOnly,
        showFeedback,
        showHints,
        questionLevelAttempts,
        assignmentLevelAttempts,
        shuffle,
        paginate,
    } = testSettings;

    let controls = null;
    let buttonText = "show";
    if (controlsVisible) {
        buttonText = "hide";
        controls = (
            <div style={{ padding: "8px" }}>
                <p>
                    The assignment is displayed is loaded from the file:{" "}
                    <code>dev/testAssignment.json</code>.
                </p>

                <div>
                    <button
                        onClick={() => {
                            setTestSettings(defaultTestSettings);
                            setUpdateNumber((was) => was + 1);
                        }}
                        style={{
                            padding: "2px",
                            marginLeft: "12px",
                            width: "80px",
                            height: "30px",
                        }}
                    >
                        Reset
                    </button>
                </div>
                <hr />
                <div>
                    <label>
                        {" "}
                        <input
                            type="checkbox"
                            checked={showCorrectness}
                            onChange={() => {
                                setTestSettings((was) => {
                                    const newObj = { ...was };
                                    newObj.showCorrectness =
                                        !was.showCorrectness;
                                    return newObj;
                                });
                                setUpdateNumber((was) => was + 1);
                            }}
                        />
                        Show Correctness
                    </label>
                </div>
                <div>
                    <label>
                        {" "}
                        <input
                            type="checkbox"
                            checked={readOnly}
                            onChange={() => {
                                setTestSettings((was) => {
                                    const newObj = { ...was };
                                    newObj.readOnly = !was.readOnly;
                                    return newObj;
                                });
                                setUpdateNumber((was) => was + 1);
                            }}
                        />
                        Read Only
                    </label>
                </div>
                <div>
                    <label>
                        {" "}
                        <input
                            type="checkbox"
                            checked={showFeedback}
                            onChange={() => {
                                setTestSettings((was) => {
                                    const newObj = { ...was };
                                    newObj.showFeedback = !was.showFeedback;
                                    return newObj;
                                });
                                setUpdateNumber((was) => was + 1);
                            }}
                        />
                        Show Feedback
                    </label>
                </div>
                <div>
                    <label>
                        {" "}
                        <input
                            type="checkbox"
                            checked={showHints}
                            onChange={() => {
                                setTestSettings((was) => {
                                    const newObj = { ...was };
                                    newObj.showHints = !was.showHints;
                                    return newObj;
                                });
                                setUpdateNumber((was) => was + 1);
                            }}
                        />
                        Show Hints
                    </label>
                </div>
                <div>
                    <label>
                        {" "}
                        <input
                            type="checkbox"
                            checked={questionLevelAttempts}
                            onChange={() => {
                                setTestSettings((was) => {
                                    const newObj = { ...was };
                                    newObj.questionLevelAttempts =
                                        !was.questionLevelAttempts;
                                    return newObj;
                                });
                                setUpdateNumber((was) => was + 1);
                            }}
                        />
                        Question level attempts
                    </label>
                </div>
                <div>
                    <label>
                        {" "}
                        <input
                            type="checkbox"
                            checked={assignmentLevelAttempts}
                            onChange={() => {
                                setTestSettings((was) => {
                                    const newObj = { ...was };
                                    newObj.assignmentLevelAttempts =
                                        !was.assignmentLevelAttempts;
                                    return newObj;
                                });
                                setUpdateNumber((was) => was + 1);
                            }}
                        />
                        Assignment level attempts
                    </label>
                </div>
                <div>
                    <label>
                        {" "}
                        <input
                            type="checkbox"
                            checked={shuffle}
                            onChange={() => {
                                setTestSettings((was) => {
                                    const newObj = { ...was };
                                    newObj.shuffle = !was.shuffle;
                                    return newObj;
                                });
                                setUpdateNumber((was) => was + 1);
                            }}
                        />
                        Shuffle question order
                    </label>
                </div>
                <div>
                    <label>
                        {" "}
                        <input
                            type="checkbox"
                            checked={paginate}
                            onChange={() => {
                                setTestSettings((was) => {
                                    const newObj = { ...was };
                                    newObj.paginate = !was.paginate;
                                    return newObj;
                                });
                                setUpdateNumber((was) => was + 1);
                            }}
                        />
                        Paginate
                    </label>
                </div>
            </div>
        );
    }

    const assignmentId = "apple";

    const [assignmentState, setAssignmentState] = useState<AssignmentState>(
        initialAssignmentState,
    );

    const [score, setScore] = useState(0);

    useEffect(() => {
        const stateListener = function (e: MessageEvent) {
            if (e.data.assignmentId !== assignmentId) {
                return;
            }
            console.log("got an event for this assignment", e.data);

            if (e.data.subject === "SPLICE.reportScoreAndState") {
                setAssignmentState(e.data.state as AssignmentState);
                setScore(e.data.score as number);
            } else if (e.data.subject === "SPLICE.getState") {
                window.postMessage({
                    subject: "SPLICE.getState.response",
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    messageId: e.data.messageId,
                    success: true,
                    loadedState: true,
                    state: initialAssignmentState,
                });
            }
        };

        window.addEventListener("message", stateListener);

        return () => {
            window.removeEventListener("message", stateListener);
        };
    }, []);

    const [itemIdToOrigItemIdx, itemWeights] = useMemo(() => {
        const idToIdx: Record<ItemId, number> = {};
        let weights = [];
        let totalWeight = 0;
        for (const [idx, item] of assignmentSource.items.entries()) {
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

        return [idToIdx, weights];
    }, []);

    console.log({ score, assignmentState });

    const lastAssignmentAttempt = assignmentState.attempts[
        assignmentState.assignmentAttemptNumber - 1
    ] as AssignmentAttemptState | null;

    return (
        <>
            <div
                style={{
                    backgroundColor: "lightGray",
                    width: "800px",
                    padding: "20px",
                }}
            >
                <h3>
                    <div style={{ display: "flex" }}>
                        Test assignment viewer
                        <button
                            onClick={() => {
                                setControlsVisible((was) => !was);
                            }}
                            style={{
                                padding: "2px",
                                marginLeft: "12px",
                                width: "160px",
                                height: "30px",
                            }}
                        >
                            {buttonText + " controls"}
                        </button>
                    </div>
                </h3>
                {controls}

                <div>
                    Assignment credit: {assignmentState.creditAchieved * 100}%
                </div>
                <div>
                    Credit by item, latest attempt:
                    <ol>
                        {lastAssignmentAttempt?.items
                            .filter(
                                (item) =>
                                    assignmentSource.items[
                                        itemIdToOrigItemIdx[item.itemId]
                                    ].type === "question",
                            )
                            .map((item) => (
                                <li key={item.itemId}>
                                    {item.creditAchieved * 100}%
                                </li>
                            ))}
                    </ol>
                </div>
                <div>
                    Assignment attempt number:{" "}
                    {assignmentState.assignmentAttemptNumber}
                </div>
            </div>

            <AssignmentViewer
                key={"viewer" + updateNumber.toString()}
                source={assignmentSource as AssignmentSource}
                flags={{
                    showCorrectness,
                    readOnly,
                    showFeedback,
                    showHints,
                    allowSaveEvents: true,
                    allowSaveState: true,
                    allowLoadState: true,
                }}
                shuffle={true}
                paginate={paginate}
                assignmentId={assignmentId}
                questionLevelAttempts={questionLevelAttempts}
                assignmentLevelAttempts={assignmentLevelAttempts}
            />
        </>
    );
}

export default App;
