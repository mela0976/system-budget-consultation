import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

test("intake form has a bounded desktop scroll region", () => {
  assert.match(
    styles,
    /\.intake-dialog \{[^}]*height: min\(792px, calc\(100vh - 32px\)\);/s
  );
  assert.match(styles, /\.intake-shell \{[^}]*height: 100%;[^}]*min-height: 0;/s);
  assert.match(styles, /\.intake-form \{[^}]*min-height: 0;[^}]*overflow-y: auto;/s);
});

test("intake form contains scroll chaining and keeps focused controls visible", () => {
  assert.match(styles, /\.intake-form \{[^}]*overscroll-behavior: contain;/s);
  assert.match(styles, /\.intake-form \{[^}]*scroll-padding: 24px 0 104px;/s);
});
