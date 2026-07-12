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
