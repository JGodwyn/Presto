// Presto Export — Figma plugin main thread.
// Serializes the current selection (structure, token/variable bindings, text,
// assets) and hands the payload to the UI iframe, which POSTs it to the local
// bridge (figma-bridge/server.mjs). The main thread has no network access, so
// the UI does the upload.

const MAX_NODES = 4000;
const ICON_MAX_SIZE = 64;
const SCREENSHOT_SCALE = 2;

type Json = Record<string, unknown>;

interface AssetOut {
  path: string; // relative to the frame folder, e.g. "assets/arrow-left.svg"
  format: "svg" | "png";
  b64: string;
}

interface FrameOut {
  slug: string;
  name: string;
  tree: Json;
  screenshotB64: string;
  assets: AssetOut[];
  nodeCount: number;
  truncated: boolean;
}

function slugify(s: string): string {
  const slug = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "untitled";
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function toHex(c: RGB | RGBA, opacity?: number): string {
  const h = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, "0");
  const a = "a" in c ? c.a : opacity !== undefined ? opacity : 1;
  const base = `#${h(c.r)}${h(c.g)}${h(c.b)}`;
  return a >= 1 ? base : `${base}${h(a)}`;
}

async function variableName(alias: unknown): Promise<string | undefined> {
  if (
    !alias ||
    typeof alias !== "object" ||
    (alias as VariableAlias).type !== "VARIABLE_ALIAS"
  ) {
    return undefined;
  }
  try {
    const v = await figma.variables.getVariableByIdAsync(
      (alias as VariableAlias).id
    );
    return v ? v.name : undefined;
  } catch {
    return undefined;
  }
}

async function styleName(id: unknown): Promise<string | undefined> {
  if (typeof id !== "string" || id === "") return undefined;
  try {
    const s = await figma.getStyleByIdAsync(id);
    return s ? s.name : undefined;
  } catch {
    return undefined;
  }
}

async function serializePaint(p: Paint): Promise<Json | undefined> {
  if (p.visible === false) return undefined;
  const out: Json = { type: p.type };
  if (p.opacity !== undefined && p.opacity < 1) out.opacity = round(p.opacity);

  if (p.type === "SOLID") {
    out.color = toHex(p.color, p.opacity);
    const varName = await variableName(p.boundVariables?.color);
    if (varName) out.variable = varName;
  } else if (
    p.type === "GRADIENT_LINEAR" ||
    p.type === "GRADIENT_RADIAL" ||
    p.type === "GRADIENT_ANGULAR" ||
    p.type === "GRADIENT_DIAMOND"
  ) {
    out.stops = p.gradientStops.map((s) => ({
      position: round(s.position),
      color: toHex(s.color),
    }));
  } else if (p.type === "IMAGE") {
    out.scaleMode = p.scaleMode;
  }
  return out;
}

async function serializePaints(
  paints: readonly Paint[] | typeof figma.mixed
): Promise<Json[] | undefined> {
  if (paints === figma.mixed || !Array.isArray(paints) || paints.length === 0) {
    return undefined;
  }
  const out: Json[] = [];
  for (const p of paints as Paint[]) {
    const s = await serializePaint(p);
    if (s) out.push(s);
  }
  return out.length > 0 ? out : undefined;
}

function serializeLayout(node: SceneNode): Json | undefined {
  if (!("layoutMode" in node) || node.layoutMode === "NONE") return undefined;
  const n = node as FrameNode;
  const layout: Json = {
    direction: n.layoutMode === "HORIZONTAL" ? "row" : "column",
    gap:
      n.primaryAxisAlignItems === "SPACE_BETWEEN"
        ? "space-between"
        : round(n.itemSpacing),
    padding: [
      round(n.paddingTop),
      round(n.paddingRight),
      round(n.paddingBottom),
      round(n.paddingLeft),
    ],
    justify: n.primaryAxisAlignItems,
    align: n.counterAxisAlignItems,
  };
  if (n.layoutWrap === "WRAP") layout.wrap = true;
  return layout;
}

// Sizing behavior inside an auto-layout parent (FIXED / HUG / FILL).
function serializeSizing(node: SceneNode): Json | undefined {
  if (!("layoutSizingHorizontal" in node)) return undefined;
  try {
    const h = node.layoutSizingHorizontal;
    const v = node.layoutSizingVertical;
    if (h === "FIXED" && v === "FIXED") return undefined;
    return { horizontal: h, vertical: v };
  } catch {
    return undefined;
  }
}

function serializeCornerRadius(node: SceneNode): unknown {
  if (!("cornerRadius" in node)) return undefined;
  const r = node.cornerRadius;
  if (typeof r === "number") return r > 0 ? round(r) : undefined;
  // mixed — report per corner
  if ("topLeftRadius" in node) {
    const n = node as RectangleNode;
    return [
      round(n.topLeftRadius),
      round(n.topRightRadius),
      round(n.bottomRightRadius),
      round(n.bottomLeftRadius),
    ];
  }
  return undefined;
}

function serializeEffects(node: SceneNode): Json[] | undefined {
  if (!("effects" in node) || node.effects.length === 0) return undefined;
  const out: Json[] = [];
  for (const e of node.effects) {
    if (e.visible === false) continue;
    const item: Json = { type: e.type };
    if ("radius" in e) item.radius = round(e.radius);
    if ("color" in e && e.color) item.color = toHex(e.color);
    if ("offset" in e && e.offset)
      item.offset = [round(e.offset.x), round(e.offset.y)];
    if ("spread" in e && e.spread) item.spread = round(e.spread);
    out.push(item);
  }
  return out.length > 0 ? out : undefined;
}

// Non-paint variable bindings (spacing, radius, size, stroke, opacity, …).
// Paint color bindings are reported inline on each fill/stroke instead.
async function serializeBoundVariables(
  node: SceneNode
): Promise<Json | undefined> {
  if (!("boundVariables" in node) || !node.boundVariables) return undefined;
  const out: Json = {};
  const skip = new Set(["fills", "strokes", "effects", "componentProperties"]);
  for (const [field, value] of Object.entries(node.boundVariables)) {
    if (skip.has(field)) continue;
    if (Array.isArray(value)) {
      const names: string[] = [];
      for (const alias of value) {
        const n = await variableName(alias);
        if (n) names.push(n);
      }
      if (names.length > 0) out[field] = names.length === 1 ? names[0] : names;
    } else {
      const n = await variableName(value);
      if (n) out[field] = n;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

async function serializeText(node: TextNode): Promise<Json> {
  const out: Json = { characters: node.characters };
  try {
    const segments = node.getStyledTextSegments([
      "fontName",
      "fontSize",
      "fontWeight",
      "lineHeight",
      "letterSpacing",
      "fills",
      "textStyleId",
      "fillStyleId",
    ]);
    const segsOut: Json[] = [];
    for (const seg of segments) {
      const s: Json = {
        text: seg.characters,
        font: `${seg.fontName.family} ${seg.fontName.style}`,
        size: round(seg.fontSize),
        weight: seg.fontWeight,
      };
      if (seg.lineHeight.unit !== "AUTO") {
        s.lineHeight = `${round((seg.lineHeight as { value: number }).value)}${
          seg.lineHeight.unit === "PERCENT" ? "%" : "px"
        }`;
      }
      if (seg.letterSpacing.value !== 0) {
        s.letterSpacing = `${round(seg.letterSpacing.value)}${
          seg.letterSpacing.unit === "PERCENT" ? "%" : "px"
        }`;
      }
      const fills = await serializePaints(seg.fills);
      if (fills) s.fills = fills;
      const tStyle = await styleName(seg.textStyleId);
      if (tStyle) s.textStyle = tStyle;
      const fStyle = await styleName(seg.fillStyleId);
      if (fStyle) s.fillStyle = fStyle;
      segsOut.push(s);
    }
    // Single uniform segment: flatten it onto the text object for readability.
    if (segsOut.length === 1) {
      const only = segsOut[0];
      delete only.text;
      Object.assign(out, only);
    } else {
      out.segments = segsOut;
    }
  } catch (e) {
    out.segmentError = String(e);
  }
  if ("textAlignHorizontal" in node && node.textAlignHorizontal !== "LEFT") {
    out.align = node.textAlignHorizontal;
  }
  return out;
}

const VECTOR_TYPES = new Set([
  "VECTOR",
  "BOOLEAN_OPERATION",
  "STAR",
  "POLYGON",
  "LINE",
]);

// Icon heuristic: a small container whose visible leaves are all vector shapes,
// or a bare vector node. Exported as SVG instead of recursing into path data.
function isIconLike(node: SceneNode): boolean {
  if (VECTOR_TYPES.has(node.type)) return true;
  if (
    (node.type === "FRAME" ||
      node.type === "GROUP" ||
      node.type === "INSTANCE" ||
      node.type === "COMPONENT") &&
    node.width <= ICON_MAX_SIZE &&
    node.height <= ICON_MAX_SIZE
  ) {
    const leaves = node.findAll((n) => !("children" in n));
    return (
      leaves.length > 0 &&
      leaves.every(
        (n) =>
          VECTOR_TYPES.has(n.type) ||
          n.type === "ELLIPSE" ||
          n.type === "RECTANGLE" ||
          n.visible === false
      )
    );
  }
  return false;
}

function hasImageFill(node: SceneNode): boolean {
  if (!("fills" in node)) return false;
  const fills = node.fills;
  if (fills === figma.mixed || !Array.isArray(fills)) return false;
  return (fills as Paint[]).some(
    (p) => p.type === "IMAGE" && p.visible !== false
  );
}

class FrameSerializer {
  assets: AssetOut[] = [];
  nodeCount = 0;
  truncated = false;
  private assetNames = new Set<string>();

  private assetPath(node: SceneNode, ext: "svg" | "png"): string {
    let base = slugify(node.name);
    let candidate = `${base}.${ext}`;
    let i = 2;
    while (this.assetNames.has(candidate)) {
      candidate = `${base}-${i}.${ext}`;
      i++;
    }
    this.assetNames.add(candidate);
    return `assets/${candidate}`;
  }

  private async exportAsset(
    node: SceneNode,
    format: "svg" | "png"
  ): Promise<string | undefined> {
    try {
      const bytes =
        format === "svg"
          ? await node.exportAsync({ format: "SVG" })
          : await node.exportAsync({
              format: "PNG",
              constraint: { type: "SCALE", value: SCREENSHOT_SCALE },
            });
      const path = this.assetPath(node, format);
      this.assets.push({ path, format, b64: figma.base64Encode(bytes) });
      return path;
    } catch {
      return undefined;
    }
  }

  async serialize(node: SceneNode, isRoot: boolean): Promise<Json | null> {
    if (node.visible === false) return null;
    if (this.nodeCount >= MAX_NODES) {
      this.truncated = true;
      return null;
    }
    this.nodeCount++;

    const out: Json = {
      name: node.name,
      type: node.type,
      w: round(node.width),
      h: round(node.height),
    };
    if (!isRoot) {
      out.x = round(node.x);
      out.y = round(node.y);
    }
    if ("opacity" in node && node.opacity < 1) out.opacity = round(node.opacity);

    if (node.type === "INSTANCE") {
      try {
        const main = await node.getMainComponentAsync();
        if (main) {
          out.component =
            main.parent && main.parent.type === "COMPONENT_SET"
              ? main.parent.name
              : main.name;
          if (main.parent && main.parent.type === "COMPONENT_SET") {
            out.variant = main.name;
          }
        }
        const props = node.componentProperties;
        const propsOut: Json = {};
        for (const [key, prop] of Object.entries(props)) {
          propsOut[key.split("#")[0]] = prop.value;
        }
        if (Object.keys(propsOut).length > 0) out.props = propsOut;
      } catch {
        // component metadata is best-effort
      }
    }

    const layout = serializeLayout(node);
    if (layout) out.layout = layout;
    const sizing = serializeSizing(node);
    if (sizing) out.sizing = sizing;

    if ("fills" in node) {
      const fills = await serializePaints(node.fills);
      if (fills) out.fills = fills;
      const fStyle = await styleName(node.fillStyleId);
      if (fStyle) out.fillStyle = fStyle;
    }
    if ("strokes" in node && node.strokes.length > 0) {
      const strokes = await serializePaints(node.strokes);
      if (strokes) {
        out.strokes = strokes;
        if (typeof node.strokeWeight === "number") {
          out.strokeWeight = round(node.strokeWeight);
        }
        if ("strokeAlign" in node) out.strokeAlign = node.strokeAlign;
      }
    }
    const radius = serializeCornerRadius(node);
    if (radius !== undefined) out.cornerRadius = radius;
    const effects = serializeEffects(node);
    if (effects) out.effects = effects;
    const bound = await serializeBoundVariables(node);
    if (bound) out.tokens = bound;

    if (node.type === "TEXT") {
      out.text = await serializeText(node);
      return out;
    }

    // Icons become SVG assets; nodes with photo/image fills get a PNG snapshot.
    if (!isRoot && isIconLike(node)) {
      const path = await this.exportAsset(node, "svg");
      if (path) {
        out.asset = path;
        return out;
      }
    }
    if (hasImageFill(node)) {
      const path = await this.exportAsset(node, "png");
      if (path) out.asset = path;
    }

    if ("children" in node) {
      const children: Json[] = [];
      for (const child of node.children) {
        const c = await this.serialize(child, false);
        if (c) children.push(c);
      }
      if (children.length > 0) out.children = children;
    }
    return out;
  }
}

async function buildPayload(): Promise<Json> {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) {
    throw new Error("Nothing selected — select one or more frames first.");
  }

  const frames: FrameOut[] = [];
  const usedSlugs = new Set<string>();

  for (const root of selection) {
    let slug = slugify(root.name);
    let i = 2;
    while (usedSlugs.has(slug)) slug = `${slugify(root.name)}-${i++}`;
    usedSlugs.add(slug);

    const serializer = new FrameSerializer();
    const tree = await serializer.serialize(root, true);
    const screenshot = await root.exportAsync({
      format: "PNG",
      constraint: { type: "SCALE", value: SCREENSHOT_SCALE },
    });

    frames.push({
      slug,
      name: root.name,
      tree: tree ?? {},
      screenshotB64: figma.base64Encode(screenshot),
      assets: serializer.assets,
      nodeCount: serializer.nodeCount,
      truncated: serializer.truncated,
    });
  }

  return {
    file: figma.root.name,
    page: figma.currentPage.name,
    exportedAt: new Date().toISOString(),
    frames,
  };
}

figma.showUI(__html__, { width: 300, height: 200 });

figma.ui.onmessage = async (msg: { type: string; count?: number }) => {
  if (msg.type === "export") {
    try {
      const payload = await buildPayload();
      figma.ui.postMessage({ type: "payload", payload });
    } catch (e) {
      figma.ui.postMessage({ type: "error", message: String(e) });
    }
  } else if (msg.type === "done") {
    figma.notify(`Exported to Presto (${msg.count} files)`);
  }
};
