# Doenet assignment viewer

View assignments from questions written in DoenetML

## Mixed DoenetML versions

Each document in an assignment carries its own DoenetML `version`, and every
embedded viewer downloads and parses the multi-MB standalone bundle for its
document's version — so an assignment mixing versions multiplies that cost
by the number of distinct versions on the page.

The viewer does not normalize versions itself (that would change how the
older documents behave). Instead, when an assignment mixes versions, it
reports the condition to the containing page — a console warning alone would
be invisible to the site's visitors — via the `reportWarningsCallback` prop,
and the page decides how to display it:

```tsx
<ActivityViewer
    source={source}
    reportWarningsCallback={(warnings) => {
        for (const warning of warnings) {
            if (warning.type === "mixedDoenetmlVersions") {
                showBanner(
                    `This assignment mixes DoenetML versions (${warning.versions.join(", ")}), ` +
                        "which slows loading. Consider updating its documents to one version.",
                );
            }
        }
    }}
/>
```

To consolidate, normalize the documents' `version` fields in the assignment
source. Saved student state survives such a change: it is keyed on a source
hash that deliberately ignores `version`.

## Windowed mounting

Every item's viewer component is always mounted, but memory tracks what the
student can see — the pagination window or viewport — instead of the
assignment's length. The embedded viewers register with a page-wide
_windowed mounting_ policy (`mountPolicy` from `@doenet/doenetml-iframe`):
items only boot their iframe (a multi-MB bundle parse plus a core worker)
when near the viewport or within the pagination window, simultaneous boots
are capped, and at most `maxLiveViewers` stay live — the rest are **parked**:
their state is flushed, their iframe is replaced by a placeholder, and they
are restored (student's typed work intact) when the student returns to them.
In paginated mode the current page and its neighbors are kept live, so page
flips within the window stay instant.

This is the default. Tune it with the `mountPolicy` prop (overrides for
`maxLiveViewers`, `visibleMargin`, `parkDelayMs`, `flushTimeoutMs`,
`maxConcurrentBoots`):

```tsx
<ActivityViewer
    source={source}
    flags={{ allowSaveState: true }}
    mountPolicy={{ maxLiveViewers: 5 }}
/>
```

Parking requires a persistence path (`flags.allowSaveState` or
`flags.allowLocalState`) so no student work can be lost; without one,
viewers still mount lazily but stay live once booted.

To cut the per-document core cost further, `useSharedCoreWorker` serves all
documents' cores from a shared worker pool instead of one dedicated ~100 MB
worker per document (default off; see `@doenet/doenetml-iframe`).
