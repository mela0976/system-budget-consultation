import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

test("major headings expose intentional Chinese phrase boundaries", () => {
  assert.match(html, /<h1><span class="heading-line">做系統，<\/span><span class="heading-line">就像<em>裝潢。<\/em><\/span><\/h1>/);
  assert.ok((html.match(/class="phrase"/g) || []).length >= 12);
  assert.match(styles, /\.phrase \{[^}]*display: inline-block;[^}]*max-width: 100%;/s);
  assert.match(styles, /\.heading-line \{[^}]*display: block;[^}]*white-space: nowrap;/s);
  assert.match(html, /<span class="phrase">先確認<\/span><wbr><span class="phrase">想要的改變，<\/span>/);
  assert.match(html, /<span class="phrase">也可以<\/span><wbr><span class="phrase">分階段完成。<\/span>/);
  assert.match(html, /<span class="phrase">先說，<\/span><wbr><span class="phrase">你想解決什麼。<\/span>/);
});

test("narrow form cards preserve complete Chinese words at preferred breaks", () => {
  assert.equal((html.match(/class="semantic-options"/g) || []).length, 6);
  assert.match(html, /讓客戶看懂<wbr>並主動詢問/);
  assert.match(html, /管理客戶、案件<wbr>或任務/);
  assert.match(styles, /\.semantic-options \{[^}]*word-break: keep-all;[^}]*overflow-wrap: anywhere;/s);
});

test("motion is orchestrated around the renovation plan and remains optional", () => {
  assert.match(styles, /@keyframes hero-copy-in/);
  assert.match(styles, /@keyframes map-node-in/);
  assert.match(styles, /\.system-map\.is-visible \.node-grow \{[^}]*animation-delay:/s);
  assert.match(styles, /\.intake-dialog\[open\] \{[^}]*animation: dialog-enter/s);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.hero-copy\.reveal > \*,[\s\S]*\.system-map \.map-node/s);
});
