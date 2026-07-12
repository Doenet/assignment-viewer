import { memo, ReactElement } from "react";
import { Activity, ActivityCommonProps } from "./Activity";
import { SequenceState } from "./sequenceState";

export const SequenceActivity = memo(function SequenceActivity({
    state,
    ...props
}: ActivityCommonProps & { state: SequenceState }) {
    const activityList: ReactElement[] = [];

    for (const activity of state.orderedChildren) {
        activityList.push(
            <Activity key={activity.id} {...props} state={activity} />,
        );
    }

    return <div key={state.attemptNumber}>{activityList}</div>;
});
