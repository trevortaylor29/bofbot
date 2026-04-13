const fs = require("fs");
const path = require("path");

/**
 * @param {string} name
 */
function safeBasename(name) {
  const b = path.basename(name);
  if (!b || b === "." || b === "..") return `video_${Date.now()}.mp4`;
  return b.replace(/[/\\]/g, "_");
}

/**
 * @param {object} opts
 * @param {import('./auth-api.cjs')} opts.authApi createAuthApi instance
 * @param {string} opts.workerBase
 * @param {string} [opts.workerKey]
 * @param {string} opts.mediaRoot absolute
 * @param {string[]} opts.fileAbsolutePaths
 * @param {'banner'|'fulltext'|'mix'} opts.overlayStyle
 * @param {{ text: string, bg_color: string, text_color: string }[]} [opts.bannerLine1Options]
 * @param {{ text: string, bg_color: string, text_color: string }[]} [opts.bannerLine2Options]
 * @param {{ line1_text: string, line2_text: string }[]} [opts.bannerFixedHooks]
 * @param {string[]} [opts.line1EmojiPool]
 * @param {string[]} [opts.line2EmojiPool]
 * @param {{ line1_text: string, line2_text: string }[]} [opts.bannerHooks]
 * @param {{ line1_text: string, line2_text: string, line2_bg_color: string, line2_text_color: string, strike_line_color?: string }[]} [opts.bannerPriceStrikeHooks]
 * @param {{ text: string }[]} [opts.fulltextHooks]
 * @param {{ line1_bg_color: string, line1_text_color: string, line2_bg_color: string, line2_text_color: string }[]} [opts.colorPresets]
 * @param {string} opts.apiBase public site origin for user-facing URLs (no trailing slash)
 * @param {(ev: { current: number, total: number, fileName: string, phase: string }) => void} [opts.onProgress]
 * @param {(usage: { videosProcessedToday?: number }) => void} [opts.onUsageUpdated] after each successful increment
 */
async function runBatch(opts) {
  const {
    authApi,
    apiBase,
    workerBase,
    workerKey,
    mediaRoot,
    fileAbsolutePaths,
    overlayStyle,
    bannerLine1Options,
    bannerLine2Options,
    bannerFixedHooks,
    line1EmojiPool,
    line2EmojiPool,
    bannerHooks,
    bannerPriceStrikeHooks,
    fulltextHooks,
    colorPresets,
    onProgress,
    onUsageUpdated,
  } = opts;

  let planRes;
  try {
    planRes = await authApi.getPlan();
  } catch (e) {
    return {
      ok: false,
      error:
        "Internet connection required to verify your subscription.",
      code: "plan_unreachable",
    };
  }

  if (!planRes.ok) {
    if (planRes.error === "not_signed_in") {
      return { ok: false, error: "Not signed in.", code: "not_signed_in" };
    }
    return {
      ok: false,
      error:
        "Internet connection required to verify your subscription.",
      code: "plan_unreachable",
    };
  }

  const { plan, videosProcessedToday, limits } = planRes.plan;
  const maxDay = limits.maxVideosPerDay;
  let used = videosProcessedToday;

  const watermarkText =
    limits.watermark === true ? "bofbot.com" : undefined;
  const priorityProcessing = limits.priorityProcessing === true;

  const batchId = `desk-${Date.now()}`;
  const rawDir = path.join(mediaRoot, "raw", batchId);
  const outDir = path.join(mediaRoot, "out", batchId);
  fs.mkdirSync(rawDir, { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });

  const total = fileAbsolutePaths.length;
  let processed = 0;

  for (let i = 0; i < fileAbsolutePaths.length; i++) {
    const abs = fileAbsolutePaths[i];
    const base = safeBasename(abs);
    const ext = path.extname(base).toLowerCase();
    const vidExt = ext === ".mov" ? ".mov" : ".mp4";
    const stem = path.basename(base, path.extname(base)) || `clip_${i}`;

    if (maxDay !== -1 && used >= maxDay) {
      return {
        ok: false,
        error: `Daily limit reached. Upgrade your plan at ${apiBase}/pricing`,
        code: "daily_limit",
        processed,
        stoppedAt: i,
      };
    }

    onProgress?.({
      current: i + 1,
      total,
      fileName: base,
      phase: "copy",
    });

    const rawRel = `raw/${batchId}/${stem}${vidExt}`;
    const outRel = `out/${batchId}/${stem}${vidExt}`;
    const rawAbs = path.join(mediaRoot, rawRel.split("/").join(path.sep));

    fs.copyFileSync(abs, rawAbs);

    const clipStyle =
      overlayStyle === "mix"
        ? Math.random() < 0.5
          ? "banner"
          : "fulltext"
        : overlayStyle;

    /** @type {Record<string, unknown>} */
    const body = {
      video_rel_path: rawRel.replace(/\\/g, "/"),
      processed_rel_path: outRel.replace(/\\/g, "/"),
      overlay_style: clipStyle,
    };

    if (clipStyle === "banner") {
      const hasMix =
        Array.isArray(bannerLine1Options) &&
        bannerLine1Options.length > 0 &&
        Array.isArray(bannerLine2Options) &&
        bannerLine2Options.length > 0;
      if (hasMix) {
        body.banner_line1_options = bannerLine1Options;
        body.banner_line2_options = bannerLine2Options;
        if (bannerFixedHooks && bannerFixedHooks.length > 0) {
          body.banner_fixed_hooks = bannerFixedHooks;
        }
        if (line1EmojiPool && line1EmojiPool.length > 0) {
          body.line1_emoji_pool = line1EmojiPool;
        }
        if (line2EmojiPool && line2EmojiPool.length > 0) {
          body.line2_emoji_pool = line2EmojiPool;
        }
      } else if (bannerHooks && bannerHooks.length > 0) {
        body.banner_hooks = bannerHooks;
      }
      if (colorPresets && colorPresets.length) {
        body.color_presets = colorPresets;
      }
      if (bannerPriceStrikeHooks && bannerPriceStrikeHooks.length > 0) {
        body.banner_price_strike_hooks = bannerPriceStrikeHooks;
      }
    } else {
      body.fulltext_hooks = fulltextHooks;
    }

    if (watermarkText) body.watermark_text = watermarkText;
    if (priorityProcessing) body.priority_processing = true;

    onProgress?.({
      current: i + 1,
      total,
      fileName: base,
      phase: "processing",
    });

    const headers = { "Content-Type": "application/json" };
    if (workerKey) headers.Authorization = `Bearer ${workerKey}`;

    let wres;
    try {
      wres = await fetch(`${workerBase.replace(/\/$/, "")}/process`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
    } catch {
      return {
        ok: false,
        error: "Video worker unreachable. Is the Python worker running?",
        processed,
      };
    }

    if (!wres.ok) {
      const t = await wres.text().catch(() => "");
      return {
        ok: false,
        error: t.slice(0, 400) || `Worker HTTP ${wres.status}`,
        processed,
      };
    }

    let inc;
    try {
      inc = await authApi.incrementUsage(1);
    } catch {
      return {
        ok: false,
        error:
          "Internet connection required to verify your subscription.",
        code: "plan_unreachable",
        processed: processed + 1,
      };
    }

    if (!inc.ok) {
      return {
        ok: false,
        error:
          "Internet connection required to verify your subscription.",
        code: "plan_unreachable",
        processed: processed + 1,
      };
    }

    used =
      typeof inc.videosProcessedToday === "number"
        ? inc.videosProcessedToday
        : used;
    processed += 1;
    onUsageUpdated?.(inc);

    onProgress?.({
      current: i + 1,
      total,
      fileName: base,
      phase: "done",
    });
  }

  return {
    ok: true,
    processed,
    batchId,
    outputDir: outDir,
  };
}

module.exports = { runBatch, safeBasename };
