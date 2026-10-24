import { copyFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";

// Static hosts can serve the PKCE callback without an SPA rewrite service.
await mkdir("dist/auth/callback", { recursive: true });
await copyFile("dist/index.html", "dist/auth/callback/index.html");

// A public, script-free privacy page uses the same verbatim source as the in-site modal.
const { readFile, writeFile } = await import("node:fs/promises");
const policy = JSON.parse(await readFile("src/content/privacy.json", "utf8"));
const index = await readFile("dist/index.html", "utf8");
const escape = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
const base = index.match(/href="([^"]*)assets\/[^\"]+\.css"/)?.[1] || "/";
const renderBlock = (block, title) => {
  if (block.type === "paragraph") return `<p>${escape(block.text)}</p>`;
  if (block.type === "list")
    return `<ol>${block.items.map((item) => `<li>${escape(item)}</li>`).join("")}</ol>`;
  return `<div class="privacy-table-wrap${block.headers.length === 3 ? " privacy-table-wide" : ""}"${block.headers.length === 3 ? ' tabindex="0"' : ""} role="region" aria-label="${escape(title)} 표"><table><thead><tr>${block.headers.map((header) => `<th scope="col">${escape(header)}</th>`).join("")}</tr></thead><tbody>${block.rows.map((row) => `<tr>${row.map((cell) => `<td>${escape(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
};
const document = `<article class="privacy-document"><header class="privacy-heading"><h1>${escape(policy.title)}</h1><p>${escape(policy.byline)}</p></header><p>${escape(policy.introduction)}</p>${policy.sections.map((section, index) => `<section aria-labelledby="policy-article-${index + 1}"><h2 id="policy-article-${index + 1}">${escape(section.title)}</h2>${section.blocks.map((block) => renderBlock(block, section.title)).join("")}</section>`).join("")}<section class="privacy-source-notes" aria-labelledby="policy-source-notes"><h2 id="policy-source-notes">${escape(policy.notes.title)}</h2><ul>${policy.notes.items.map((item) => `<li>${escape(item)}</li>`).join("")}</ul></section><nav class="privacy-document-links" aria-label="개인정보 처리방침 문서"><a href="${escape(base)}privacy-policy.pdf" download="한푼 개인정보 처리방침.pdf">처리방침 PDF 다운로드</a></nav></article>`;
const head = index
  .match(/<head>([\s\S]*?)<\/head>/)[1]
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "")
  .replace(/<link\b[^>]*rel="modulepreload"[^>]*>/g, "")
  .replace(/<title>[\s\S]*?<\/title>/, `<title>${escape(policy.title)}</title>`)
  .replace(
    /(<meta\s+name="description"\s+content=")[^"]*("\s*\/?>)/,
    `$1한푼 개인정보 처리방침 전문과 PDF.$2`,
  );
await mkdir("dist/privacy", { recursive: true });
await writeFile(
  "dist/privacy/index.html",
  `<!doctype html><html lang="ko"><head>${head}</head><body class="privacy-page"><main class="privacy-page-shell"><a class="privacy-back-link" href="${escape(base)}">← 한푼으로 돌아가기</a>${document}</main></body></html>`,
);

// All chunks are cached on install, so lazy pages also open without a network.
// Keep the worker scope relative to the built base (including /money/ previews).
const { readdir } = await import("node:fs/promises");
const assets = (await readdir("dist/assets"))
  .sort()
  .filter((name) => /\.(js|css)$/.test(name));
const files = [
  "index.html",
  "offline.html",
  "offline.css",
  "favicon.svg",
  "ai-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/apple-touch-icon.png",
  ...assets.map((name) => `assets/${name}`),
];
const template = await readFile("scripts/service-worker.template.js", "utf8");
const revision = createHash("sha256")
  .update(index + JSON.stringify(files) + template)
  .digest("hex")
  .slice(0, 16);
await writeFile(
  "dist/sw.js",
  template
    .replace("__CACHE_NAME__", JSON.stringify(`hanpun-shell-${revision}`))
    .replace("__PRECACHE_FILES__", JSON.stringify(files)),
);
