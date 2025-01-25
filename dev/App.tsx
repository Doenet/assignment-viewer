/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { useEffect, useState } from "react";
import { AssignmentViewer } from "../src/assignment-builder";
import { AssignmentSource } from "../src/types";
import assignmentSource from "./testAssignment.json";

import initialAssignmentState from "./testInitialState.json";
import { AssignmentState } from "../src/Viewer/assignmentState";

function App() {
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

    console.log({ score, assignmentState });
    return (
        <>
            <h1>Test assignment builder</h1>
            <AssignmentViewer
                source={assignmentSource as AssignmentSource}
                flags={{
                    allowSaveEvents: true,
                    allowSaveState: true,
                    allowLoadState: true,
                }}
                shuffle={true}
                assignmentId={assignmentId}
            />
        </>
    );
}

export default App;
