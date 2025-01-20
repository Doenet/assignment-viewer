import { AssignmentViewer } from "../src/assignment-builder";
import { AssignmentSource } from "../src/types";
import assignmentSource from "./testAssignment.json";

function App() {
    return (
        <>
            <h1>Test assignment builder</h1>
            <AssignmentViewer
                source={assignmentSource as AssignmentSource}
                flags={{ allowSaveEvents: true }}
            />
        </>
    );
}

export default App;
