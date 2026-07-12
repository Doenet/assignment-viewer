// Shared helpers for assignment-viewer component tests.
//
// Build CDN URLs for the standalone bundle from the installed
// @doenet/doenetml-iframe package version — dev versions are published to
// the CDN, so no local sibling-directory reference is needed.

import { version } from "@doenet/doenetml-iframe/package.json";

const CDN = `https://cdn.jsdelivr.net/npm/@doenet/standalone@${version}`;

export const STANDALONE_URL = `${CDN}/doenet-standalone.js`;
export const STANDALONE_CSS_URL = `${CDN}/style.css`;

// Budget enough time for the standalone bundle to evaluate inside the iframe
// on a cold CDN fetch.
export const IFRAME_READY_TIMEOUT = 20_000;

// The windowed-mounting specs park viewers, which requires a standalone
// bundle that acknowledges `SPLICE.flushState` — true of the bundle
// published alongside the installed doenetml-iframe version (the wrapper
// treats a host-specified standaloneUrl as modern).
export const WINDOWED_STANDALONE_URL = STANDALONE_URL;
export const WINDOWED_STANDALONE_CSS_URL = STANDALONE_CSS_URL;

// Parking additionally waits for the off-screen viewer's realm to boot far
// enough to acknowledge the flush.
export const PARK_TIMEOUT = 40_000;
