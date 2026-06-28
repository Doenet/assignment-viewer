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

function getSystemTheme(): ResolvedTheme {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
}

function subscribeToSystemTheme(onChange: () => void): () => void {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", onChange);
    return () => {
        mq.removeEventListener("change", onChange);
    };
}

function subscribeToPinnedTheme(): () => void {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return () => {};
}

/**
 * Resolves a `ThemeSetting` to a concrete `ResolvedTheme`.
 *
 * When the setting is `"system"`, the resolved value tracks the
 * `prefers-color-scheme` media query and updates live when the user changes
 * their OS/browser preference.
 */
export function useResolvedTheme(setting: ThemeSetting): ResolvedTheme {
    const subscribe =
        setting === "system" ? subscribeToSystemTheme : subscribeToPinnedTheme;
    const systemTheme = useSyncExternalStore(
        subscribe,
        getSystemTheme,
        () => "light" as ResolvedTheme,
    );

    if (setting === "system") {
        return systemTheme;
    }
    return setting;
}
