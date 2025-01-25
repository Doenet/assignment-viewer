/*
 * Generated type guards for "assignmentState.ts".
 * WARNING: Do not manually change this file.
 */
import { AssignmentState } from "./assignmentState";

export function isAssignmentState(obj: unknown): obj is AssignmentState {
    const typedObj = obj as AssignmentState
    return (
        (typedObj !== null &&
            typeof typedObj === "object" ||
            typeof typedObj === "function") &&
        typeof typedObj["assignmentAttemptNumber"] === "number" &&
        typeof typedObj["creditAchieved"] === "number" &&
        Array.isArray(typedObj["attempts"]) &&
        typedObj["attempts"].every((e: any) =>
            (e !== null &&
                typeof e === "object" ||
                typeof e === "function") &&
            typeof e["creditAchieved"] === "number" &&
            Array.isArray(e["items"]) &&
            e["items"].every((e: any) =>
                (e !== null &&
                    typeof e === "object" ||
                    typeof e === "function") &&
                typeof e["itemId"] === "string" &&
                typeof e["itemAttemptNumber"] === "number" &&
                typeof e["creditAchieved"] === "number" &&
                Array.isArray(e["attempts"]) &&
                e["attempts"].every((e: any) =>
                    (e !== null &&
                        typeof e === "object" ||
                        typeof e === "function") &&
                    typeof e["docId"] === "string" &&
                    typeof e["variant"] === "number" &&
                    typeof e["creditAchieved"] === "number"
                )
            )
        )
    )
}
