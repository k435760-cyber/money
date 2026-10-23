import { copyFile, mkdir, writeFile } from "node:fs/promises";

// Static hosts can serve the PKCE callback without an SPA rewrite service.
await mkdir("dist/auth/callback", { recursive: true });
await copyFile("dist/index.html", "dist/auth/callback/index.html");
await writeFile("dist/.nojekyll", "");
