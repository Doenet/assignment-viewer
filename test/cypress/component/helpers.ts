// Shared helpers for assignment-viewer component tests.
//
// Build CDN URLs for the standalone bundle from the installed
// @doenet/doenetml-iframe package version — dev versions are published to
// the CDN, so no local sibling-directory reference is needed.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { version } = require("@doenet/doenetml-iframe/package.json");
const CDN = `https://cdn.jsdelivr.net/npm/@doenet/standalone@${version as string}`;

export const STANDALONE_URL = `${CDN}/doenet-standalone.js`;
export const STANDALONE_CSS_URL = `${CDN}/style.css`;

// Budget enough time for the standalone bundle to evaluate inside the iframe
// on a cold CDN fetch.
export const IFRAME_READY_TIMEOUT = 20_000;
