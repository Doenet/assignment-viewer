import { memo, ReactElement } from "react";
import { Activity, ActivityCommonProps } from "./Activity";
import { SelectState } from "./selectState";

export const SelectActivity = memo(function SelectActivity({
    state,
    ...props
}: ActivityCommonProps & { state: SelectState }) {
    const selectedActivities: ReactElement[] = [];

    for (const activity of state.selectedChildren) {
        selectedActivities.push(
            <Activity key={activity.id} {...props} state={activity} />,
        );
    }

    return (
        <div key={state.attemptNumber}>
            <div>{selectedActivities}</div>
        </div>
    );
});
