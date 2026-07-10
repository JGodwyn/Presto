// Presto Figma bridge — receives exports from the "Presto Export" Figma plugin
// and writes them into design-sync/. Node built-ins only, plus sharp when
// available (bundled with Next.js) to convert PNGs to WebP.
// Run with: npm run figma:bridge

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = 4411;
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_ROOT = path.join(REPO_ROOT, "design-sync");
const MAX_BODY_BYTES = 200 * 1024 * 1024;

// WebP at q80 is visually indistinguishable for UI art at a fraction of PNG's
// size; 2880px caps at 2x of a 1440-wide desktop frame.
const WEBP_QUALITY = 80;
const MAX_DIMENSION = 2880;

let sharp = null;
try {
  sharp = (await import("sharp")).default;
} catch {
  console.warn(
    "sharp not found — writing assets as unoptimized PNGs. (sharp ships with Next; run npm install.)"
  );
}

async function optimizePng(buf) {
  if (!sharp) return null;
  try {
    return await sharp(buf)
      .resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
  } catch (e) {
    console.warn("webp conversion failed, keeping png:", e.message);
    return null;
  }
}

// The plugin slugifies names, but never trust a path from the network.
function safeSegment(s) {
  const clean = String(s).replace(/[^a-z0-9._-]/gi, "-").replace(/^\.+/, "");
  if (!clean) throw new Error(`Unsafe path segment: ${s}`);
  return clean;
}

function kb(n) {
  return `${Math.round(n / 1024)} KB`;
}

async function writeExport(payload) {
  if (!Array.isArray(payload.frames) || payload.frames.length === 0) {
    throw new Error("Payload has no frames");
  }
  const written = [];
  const dirs = [];

  for (const frame of payload.frames) {
    const slug = safeSegment(frame.slug);
    const frameDir = path.join(OUT_ROOT, slug);
    fs.rmSync(frameDir, { recursive: true, force: true });
    fs.mkdirSync(frameDir, { recursive: true });
    dirs.push(`design-sync/${slug}`);

    // assets/foo.png may become assets/foo.webp — remember renames so the
    // `asset` references inside the tree JSON can be rewritten to match.
    const renames = new Map();

    if (frame.screenshotB64) {
      const png = Buffer.from(frame.screenshotB64, "base64");
      const webp = await optimizePng(png);
      const shotPath = path.join(frameDir, webp ? "screenshot.webp" : "screenshot.png");
      fs.writeFileSync(shotPath, webp ?? png);
      written.push(
        `${path.relative(REPO_ROOT, shotPath)}` +
          (webp ? ` (${kb(png.length)} → ${kb(webp.length)})` : ` (${kb(png.length)})`)
      );
    }

    for (const asset of frame.assets || []) {
      const parts = String(asset.path).split("/").map(safeSegment);
      let buf = Buffer.from(asset.b64, "base64");
      let note = ` (${kb(buf.length)})`;
      if (asset.format === "png") {
        const webp = await optimizePng(buf);
        if (webp) {
          note = ` (${kb(buf.length)} → ${kb(webp.length)})`;
          buf = webp;
          const oldPath = parts.join("/");
          parts[parts.length - 1] = parts[parts.length - 1].replace(/\.png$/i, ".webp");
          renames.set(oldPath, parts.join("/"));
        }
      }
      const assetPath = path.join(frameDir, ...parts);
      fs.mkdirSync(path.dirname(assetPath), { recursive: true });
      fs.writeFileSync(assetPath, buf);
      written.push(path.relative(REPO_ROOT, assetPath) + note);
    }

    const meta = {
      file: payload.file,
      page: payload.page,
      exportedAt: payload.exportedAt,
      name: frame.name,
      nodeCount: frame.nodeCount,
      truncated: frame.truncated || undefined,
      assets: (frame.assets || []).map((a) => renames.get(a.path) ?? a.path),
      tree: frame.tree,
    };
    let json = JSON.stringify(meta, null, 2);
    for (const [oldPath, newPath] of renames) {
      json = json.replaceAll(`"${oldPath}"`, `"${newPath}"`);
    }
    const jsonPath = path.join(frameDir, "frame.json");
    fs.writeFileSync(jsonPath, json);
    written.push(path.relative(REPO_ROOT, jsonPath));
  }
  return { written, dirs };
}

const server = http.createServer((req, res) => {
  // The plugin UI iframe has a null origin, so CORS must be permissive.
  // Safe because the server only listens on localhost.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type");

  if (req.method === "OPTIONS") {
    res.writeHead(204).end();
    return;
  }

  if (req.method === "GET") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end(
      `Presto Figma bridge is running. Output: ${OUT_ROOT} (webp: ${sharp ? "on" : "off"})\n`
    );
    return;
  }

  if (req.method === "POST" && req.url === "/export") {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        res.writeHead(413).end();
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", async () => {
      try {
        const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        const result = await writeExport(payload);
        console.log(
          `[${new Date().toLocaleTimeString()}] Export received — ${result.written.length} files:`
        );
        for (const f of result.written) console.log(`  ${f}`);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (e) {
        console.error("Export failed:", e.message);
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404).end();
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Presto Figma bridge listening on http://localhost:${PORT}`);
  console.log(`Exports will be written to ${OUT_ROOT}`);
  console.log(`PNG → WebP optimization: ${sharp ? `on (q${WEBP_QUALITY}, max ${MAX_DIMENSION}px)` : "off — sharp unavailable"}`);
});
