/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { useEffect, useState } from "react";
import { ActivityViewer } from "../src/activity-viewer";
import activitySource from "./testActivity.json";

import initialAssignmentState from "./testInitialState.json";
import {
    ExportedActivityState,
    isActivitySource,
    isExportedActivityState,
    validateStateAndSource,
} from "../src/Activity/activityState";
import { isReportScoreByItemMessage, isReportStateMessage } from "../src/types";

function App() {
    const defaultTestSettings: {
        requestedVariantIndex: number;
        showCorrectness: boolean;
        readOnly: boolean;
        showFeedback: boolean;
        showHints: boolean;
        itemLevelAttempts: boolean;
        activityLevelAttempts: boolean;
        paginate: boolean;
        maxAttempts: number;
    } = {
        requestedVariantIndex: 1,
        showCorrectness: true,
        readOnly: false,
        showFeedback: true,
        showHints: true,
        itemLevelAttempts: true,
        activityLevelAttempts: true,
        paginate: false,
        maxAttempts: 2,
    };

    const [controlsVisible, setControlsVisible] = useState(false);
    const [testSettings, setTestSettings] = useState(defaultTestSettings);
    const [updateNumber, setUpdateNumber] = useState(0);

    const {
        requestedVariantIndex: _requestedVariantIndex,
        showCorrectness,
        readOnly,
        showFeedback,
        showHints,
        itemLevelAttempts,
        activityLevelAttempts,
        paginate,
        maxAttempts,
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
                        <input
                            type="checkbox"
                            checked={itemLevelAttempts}
                            onChange={() => {
                                setTestSettings((was) => {
                                    const newObj = { ...was };
                                    newObj.itemLevelAttempts =
                                        !was.itemLevelAttempts;
                                    return newObj;
                                });
                                setUpdateNumber((was) => was + 1);
                            }}
                        />
                        Item level attempts
                    </label>
                </div>
                <div>
                    <label>
                        <input
                            type="checkbox"
                            checked={activityLevelAttempts}
                            onChange={() => {
                                setTestSettings((was) => {
                                    const newObj = { ...was };
                                    newObj.activityLevelAttempts =
                                        !was.activityLevelAttempts;
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
                <div>
                    <label>
                        Max attempts:
                        <input
                            type="text"
                            style={{ marginLeft: "5px" }}
                            defaultValue={maxAttempts}
                            onChange={(e) => {
                                const numValue = parseInt(e.target.value);
                                if (
                                    Number.isInteger(numValue) &&
                                    numValue >= 0
                                ) {
                                    setTestSettings((was) => {
                                        const newObj = { ...was };
                                        newObj.maxAttempts = numValue;
                                        return newObj;
                                    });
                                }
                            }}
                        />
                    </label>
                </div>
            </div>
        );
    }

    const activityId = "apple";

    const initialState = initialAssignmentState;

    const [activityState, setActivityState] =
        useState<ExportedActivityState | null>(
            // null,
            isExportedActivityState(initialState) &&
                validateStateAndSource(initialState, activitySource)
                ? initialState
                : null,
        );

    const [_score, setScore] = useState(0);
    const [itemScores, setItemScores] = useState<
        {
            id: string;
            score: number;
            docId?: string;
            shuffledOrder: number;
        }[]
    >([]);

    useEffect(() => {
        const stateListener = function (e: MessageEvent) {
            if (e.data.activityId !== activityId) {
                return;
            }

            const msg: unknown = e.data;

            console.log("got an event for this assignment", e.data);

            if (isReportStateMessage(msg)) {
                setActivityState(msg.state);
                setScore(msg.score);
                setItemScores(msg.itemScores);
            } else if (isReportScoreByItemMessage(msg)) {
                setScore(msg.score);
                setItemScores(msg.itemScores);
            } else if (e.data.subject === "SPLICE.getState") {
                const haveState = validateStateAndSource(
                    initialAssignmentState,
                    activitySource,
                );

                window.postMessage({
                    subject: "SPLICE.getState.response",
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    messageId: e.data.messageId,
                    success: true,
                    loadedState: haveState,
                    state: haveState ? initialAssignmentState : null,
                });
            }
        };

        window.addEventListener("message", stateListener);

        return () => {
            window.removeEventListener("message", stateListener);
        };
    }, []);

    // const lastAssignmentAttempt = activityState.attempts[
    //     activityState.assignmentAttemptNumber - 1
    // ] as AssignmentAttemptState | null;

    if (!isActivitySource(activitySource)) {
        return <>Bad activity source</>;
    }

    return (
        <div style={{ marginBottom: "50vh" }}>
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
                    Assignment credit:{" "}
                    {(activityState?.activityState.creditAchieved ?? 0) * 100}%
                </div>
                <div>
                    Credit by item, latest attempt:
                    <ol>
                        {[...itemScores]
                            .sort((a, b) => a.shuffledOrder - b.shuffledOrder)
                            .map((item) => (
                                <li key={item.id}>{item.score * 100}%</li>
                            ))}
                    </ol>
                </div>
                <div>
                    Assignment attempt number:{" "}
                    {activityState?.activityState.attemptNumber ?? 0 + 1}
                </div>
            </div>

            <ActivityViewer
                key={"viewer" + updateNumber.toString()}
                source={activitySource}
                flags={{
                    showCorrectness,
                    readOnly,
                    showFeedback,
                    showHints,
                    allowSaveEvents: true,
                    allowSaveState: true,
                    allowLoadState: true,
                }}
                paginate={paginate}
                activityId={activityId}
                itemLevelAttempts={itemLevelAttempts}
                activityLevelAttempts={activityLevelAttempts}
                maxAttemptsAllowed={maxAttempts}
            />
        </div>
    );
}

export default App;
