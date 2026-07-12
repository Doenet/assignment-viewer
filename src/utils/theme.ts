import { useSyncExternalStore } from "react";

/**
 * `ThemeSetting` is the public, author-facing value of the `darkMode` prop:
 * `"light"` and `"dark"` pin a specific theme, while `"system"` follows the
 * OS/browser `prefers-color-scheme` preference and updates live.
 */
export type ThemeSetting = "dark" | "light" | "system";

/**
 * `ResolvedTheme` is the concrete two-state value used internally after
 * resolving `"system"` to the actual OS preference.
 */
export type ResolvedTheme = "dark" | "light";

const DEFAULT_THEME: ResolvedTheme = "light";

// No-op unsubscribe used when there is nothing to listen to (a pinned theme,
// or an environment without `matchMedia`).
// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {};

/**
 * Returns `true` when `window.matchMedia` is usable. It is absent in
 * non-browser environments (SSR) and in some test environments (e.g. jsdom),
 * so callers must fall back to a safe default when this is `false`.
 */
function canMatchMedia(): boolean {
    return (
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function"
    );
}

function getSystemTheme(): ResolvedTheme {
    if (!canMatchMedia()) {
        return DEFAULT_THEME;
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
}

function subscribeToSystemTheme(onChange: () => void): () => void {
    if (!canMatchMedia()) {
        return noop;
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", onChange);
    return () => {
        mq.removeEventListener("change", onChange);
    };
}

function subscribeToPinnedTheme(): () => void {
    return noop;
}

/**
 * Resolves a `ThemeSetting` to a concrete `ResolvedTheme`.
 *
 * When the setting is `"system"`, the resolved value tracks the
 * `prefers-color-scheme` media query and updates live when the user changes
 * their OS/browser preference. When the setting is pinned to `"light"` or
 * `"dark"`, the media query is never read, so the hook is safe to use in SSR
 * and test environments where `window.matchMedia` is unavailable.
 */
export function useResolvedTheme(setting: ThemeSetting): ResolvedTheme {
    const isSystem = setting === "system";

    // When pinned, take a snapshot of the fixed setting rather than reading
    // `matchMedia`, so pinned themes never depend on the browser environment.
    const getPinnedSnapshot = () => setting as ResolvedTheme;

    return useSyncExternalStore(
        isSystem ? subscribeToSystemTheme : subscribeToPinnedTheme,
        isSystem ? getSystemTheme : getPinnedSnapshot,
        isSystem ? () => DEFAULT_THEME : getPinnedSnapshot,
    );
}
