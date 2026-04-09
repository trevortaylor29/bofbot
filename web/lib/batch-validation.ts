import type {
  BannerHookVariant,
  FulltextHookVariant,
  HooksSnapshot,
} from "@/drizzle/schema";

export const MAX_UPLOAD_FILES = 40;
export const MAX_HOOK_VARIANTS = 30;

export type CreateBatchFile = { name: string; contentType?: string };

export type CreateBatchBody = {
  overlayStyle: "banner" | "fulltext";
  hooks: unknown;
  files: CreateBatchFile[];
};

function normalizeExt(name: string): ".mp4" | ".mov" | null {
  const m = name.trim().toLowerCase().match(/\.(mp4|mov)$/);
  if (!m) return null;
  return m[1] === "mov" ? ".mov" : ".mp4";
}

export function contentTypeForFile(
  name: string,
  explicit?: string
): string | null {
  const ext = normalizeExt(name);
  if (!ext) return null;
  if (explicit?.trim()) {
    const t = explicit.trim().toLowerCase();
    if (
      t === "video/mp4" ||
      t === "video/quicktime" ||
      t === "video/x-m4v"
    ) {
      return t;
    }
  }
  return ext === ".mov" ? "video/quicktime" : "video/mp4";
}

export function parseHooksSnapshot(
  overlayStyle: "banner" | "fulltext",
  hooks: unknown
): { ok: true; snapshot: HooksSnapshot } | { ok: false; error: string } {
  if (!Array.isArray(hooks) || hooks.length === 0) {
    return { ok: false, error: "Add at least one hook variation." };
  }
  if (hooks.length > MAX_HOOK_VARIANTS) {
    return {
      ok: false,
      error: `At most ${MAX_HOOK_VARIANTS} hook variations.`,
    };
  }

  if (overlayStyle === "banner") {
    const variants: BannerHookVariant[] = [];
    for (const item of hooks) {
      if (!item || typeof item !== "object") {
        return { ok: false, error: "Invalid banner hook entry." };
      }
      const o = item as Record<string, unknown>;
      const line1 = String(o.line1Text ?? "").trim();
      const line2 = String(o.line2Text ?? "").trim();
      if (!line1 || !line2) {
        return {
          ok: false,
          error: "Each banner variation needs line 1 and line 2 text.",
        };
      }
      variants.push({ line1Text: line1, line2Text: line2 });
    }
    return { ok: true, snapshot: { style: "banner", variants } };
  }

  const variants: FulltextHookVariant[] = [];
  for (const item of hooks) {
    if (!item || typeof item !== "object") {
      return { ok: false, error: "Invalid fulltext hook entry." };
    }
    const o = item as Record<string, unknown>;
    const text = String(o.text ?? "").trim();
    if (!text) {
      return { ok: false, error: "Each fulltext variation needs text." };
    }
    variants.push({ text });
  }
  return { ok: true, snapshot: { style: "fulltext", variants } };
}

export function validateFiles(
  files: CreateBatchFile[]
): { ok: true } | { ok: false; error: string } {
  if (!Array.isArray(files) || files.length === 0) {
    return { ok: false, error: "Add at least one video file." };
  }
  if (files.length > MAX_UPLOAD_FILES) {
    return {
      ok: false,
      error: `At most ${MAX_UPLOAD_FILES} videos per batch.`,
    };
  }
  for (const f of files) {
    if (!f?.name || typeof f.name !== "string") {
      return { ok: false, error: "Each file needs a name." };
    }
    if (!normalizeExt(f.name)) {
      return {
        ok: false,
        error: "Only .mp4 and .mov files are allowed.",
      };
    }
    if (contentTypeForFile(f.name, f.contentType) === null) {
      return { ok: false, error: "Invalid video content type." };
    }
  }
  return { ok: true };
}
