import { useState } from "react";

/**
 * Keep the previous identity of a derived value when its content (as
 * captured by `key`) is unchanged, so downstream memos and `React.memo`
 * children are not invalidated by recomputations that produced equal
 * content. The sanctioned adjust-state-during-render pattern: when the key
 * changes, the new value is adopted (and returned for the current render).
 */
export function useContentStable<T>(value: T, key: string): T {
    const [stable, setStable] = useState({ value, key });
    if (stable.key !== key) {
        setStable({ value, key });
        return value;
    }
    return stable.value;
}
