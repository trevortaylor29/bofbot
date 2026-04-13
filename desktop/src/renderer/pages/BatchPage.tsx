import { useCallback, useMemo, useState } from "react";

import { NOISE_DATA_URI } from "../brand";
import appIcon from "../../../icon.png";
import {
  BANNER_EMOJI_SUFFIX_POOL,
  BANNER_LINE1_CHIPS,
  BANNER_LINE2_CHIPS,
  BANNER_PRICE_STRIKE_PRESETS,
  FULLTEXT_PRESETS,
  TOP_BAR_ACCENT_PALETTE,
  WORKER_BANNER_COLOR_PRESETS,
  lineOptionsFromChips,
  parseBannerPairLines,
  type LineChip,
} from "../presets";
import { PlanBlockModal } from "../components/PlanBlockModal";
import type { BatchPayload, FileWithPath } from "../types";

type Props = {
  onBack: () => void;
  onStart: (payload: BatchPayload) => void;
};

function parseLines(raw: string): string[] {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function pathsFromFileList(files: FileList | null): string[] {
  if (!files?.length) return [];
  const paths: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i] as FileWithPath;
    if (f.path) paths.push(f.path);
  }
  return paths;
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 12 12" fill="none" aria-hidden style={{ width: 11, height: 11 }}>
      <path d="M2 6l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InfoTip({ label, text }: { label: string; text: string }) {
  return (
    <button type="button" className="batch-info-icon" title={text} aria-label={label}>
      i
    </button>
  );
}

export function BatchPage({ onBack, onStart }: Props) {
  const [overlayStyle, setOverlayStyle] = useState<"banner" | "fulltext" | "mix">("banner");
  const [selectedL1, setSelectedL1] = useState<Set<string>>(() => new Set(BANNER_LINE1_CHIPS.map((c) => c.id)));
  const [selectedL2, setSelectedL2] = useState<Set<string>>(() => new Set(BANNER_LINE2_CHIPS.map((c) => c.id)));
  const [selectedFulltext, setSelectedFulltext] = useState<Set<string>>(() => new Set(["f1"]));
  const [selectedPriceStrike, setSelectedPriceStrike] = useState<Set<string>>(() => new Set());
  const [customBannerPairs, setCustomBannerPairs] = useState("");
  const [customFulltext, setCustomFulltext] = useState("");
  const [filePaths, setFilePaths] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [planModal, setPlanModal] = useState<
    | "internet"
    | "session_expired"
    | "daily_limit"
    | "starter_hooks"
    | "free_custom_hooks"
    | "custom_hooks_limit"
    | null
  >(null);

  const l1ChipsSelected = useMemo(
    () => BANNER_LINE1_CHIPS.filter((c) => selectedL1.has(c.id)),
    [selectedL1]
  );
  const l2ChipsSelected = useMemo(
    () => BANNER_LINE2_CHIPS.filter((c) => selectedL2.has(c.id)),
    [selectedL2]
  );

  const customPairsParsed = useMemo(() => parseBannerPairLines(customBannerPairs), [customBannerPairs]);
  const customPairCount = customPairsParsed.length;
  const customFulltextLineCount = useMemo(
    () => parseLines(customFulltext).length,
    [customFulltext]
  );

  const canMixBanner = selectedL1.size > 0 && selectedL2.size > 0;
  const mixSlotCount = canMixBanner ? selectedL1.size * selectedL2.size : 0;

  const fulltextHooksList = useMemo(() => {
    const hooks: { text: string }[] = [];
    for (const p of FULLTEXT_PRESETS) {
      if (selectedFulltext.has(p.id)) hooks.push({ text: p.text });
    }
    for (const line of parseLines(customFulltext)) {
      hooks.push({ text: line });
    }
    return hooks;
  }, [selectedFulltext, customFulltext]);

  const bannerPriceStrikeHooks = useMemo(() => {
    return BANNER_PRICE_STRIKE_PRESETS.filter((p) => selectedPriceStrike.has(p.id)).map((p) => ({
      line1_text: p.line1_text,
      line2_text: p.line2_text,
      line2_bg_color: p.line2_bg_color,
      line2_text_color: p.line2_text_color,
      ...(p.strike_line_color ? { strike_line_color: p.strike_line_color } : {}),
    }));
  }, [selectedPriceStrike]);

  const bannerSideOk = canMixBanner || customPairCount > 0 || bannerPriceStrikeHooks.length > 0;
  const fulltextValid = fulltextHooksList.length > 0;

  const n = filePaths.length;
  const canProcess =
    n > 0 &&
    (overlayStyle === "banner"
      ? bannerSideOk
      : overlayStyle === "fulltext"
        ? fulltextValid
        : bannerSideOk && fulltextValid);

  const toggleL1 = useCallback((id: string) => {
    setSelectedL1((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleL2 = useCallback((id: string) => {
    setSelectedL2((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleFulltext = useCallback((id: string) => {
    setSelectedFulltext((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const togglePriceStrike = useCallback((id: string) => {
    setSelectedPriceStrike((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const addPaths = useCallback((paths: string[]) => {
    if (!paths.length) return;
    setFilePaths((prev) => {
      const set = new Set(prev);
      for (const p of paths) set.add(p);
      return [...set];
    });
  }, []);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const fromFiles = pathsFromFileList(e.dataTransfer.files);
    if (fromFiles.length) addPaths(fromFiles);
  }

  async function pickFiles() {
    const paths = await window.bofbot.pickVideos();
    addPaths(paths);
  }

  function buildPayload(): BatchPayload | null {
    setError(null);
    if (filePaths.length === 0) {
      setError("Add at least one video.");
      return null;
    }

    const customHookMeta = {
      customBannerPairCount: customPairsParsed.length,
      customFulltextLineCount,
    };

    if (overlayStyle === "banner") {
      const fixed = parseBannerPairLines(customBannerPairs);
      if (!canMixBanner && fixed.length < 1 && bannerPriceStrikeHooks.length < 1) {
        setError(
          "Select at least one top and bottom chip, add custom pairs (top | bottom), or enable a strike layout preset."
        );
        return null;
      }
      const colorPresets = [...WORKER_BANNER_COLOR_PRESETS];
      const emojiPool = [...BANNER_EMOJI_SUFFIX_POOL];
      const strikeField =
        bannerPriceStrikeHooks.length > 0
          ? { bannerPriceStrikeHooks }
          : {};

      if (canMixBanner) {
        return {
          filePaths,
          overlayStyle: "banner",
          bannerLine1Options: lineOptionsFromChips(l1ChipsSelected),
          bannerLine2Options: lineOptionsFromChips(l2ChipsSelected),
          bannerFixedHooks: fixed.length > 0 ? fixed : undefined,
          line1EmojiPool: emojiPool,
          line2EmojiPool: emojiPool,
          colorPresets,
          ...strikeField,
          ...customHookMeta,
        };
      }

      if (fixed.length > 0) {
        return {
          filePaths,
          overlayStyle: "banner",
          bannerHooks: fixed,
          colorPresets,
          ...strikeField,
          ...customHookMeta,
        };
      }

      return {
        filePaths,
        overlayStyle: "banner",
        ...strikeField,
        ...customHookMeta,
      };
    }

    if (overlayStyle === "fulltext") {
      if (fulltextHooksList.length < 1) {
        setError("Select at least one hook.");
        return null;
      }
      return {
        filePaths,
        overlayStyle: "fulltext",
        fulltextHooks: fulltextHooksList,
        ...customHookMeta,
      };
    }

    /* mix */
    const fixedMix = parseBannerPairLines(customBannerPairs);
    if (!canMixBanner && fixedMix.length < 1 && bannerPriceStrikeHooks.length < 1) {
      setError(
        "Mix mode: select top and bottom chips, add custom pairs (top | bottom), or enable a strike layout preset."
      );
      return null;
    }
    if (fulltextHooksList.length < 1) {
      setError("Mix mode: select at least one full text hook.");
      return null;
    }
    const colorPresetsMix = [...WORKER_BANNER_COLOR_PRESETS];
    const emojiPoolMix = [...BANNER_EMOJI_SUFFIX_POOL];
    const strikeFieldMix =
      bannerPriceStrikeHooks.length > 0
        ? { bannerPriceStrikeHooks }
        : {};
    if (canMixBanner) {
      return {
        filePaths,
        overlayStyle: "mix",
        bannerLine1Options: lineOptionsFromChips(l1ChipsSelected),
        bannerLine2Options: lineOptionsFromChips(l2ChipsSelected),
        bannerFixedHooks: fixedMix.length > 0 ? fixedMix : undefined,
        line1EmojiPool: emojiPoolMix,
        line2EmojiPool: emojiPoolMix,
        colorPresets: colorPresetsMix,
        ...strikeFieldMix,
        fulltextHooks: fulltextHooksList,
        ...customHookMeta,
      };
    }
    return {
      filePaths,
      overlayStyle: "mix",
      bannerHooks: fixedMix.length > 0 ? fixedMix : undefined,
      colorPresets: colorPresetsMix,
      ...strikeFieldMix,
      fulltextHooks: fulltextHooksList,
      ...customHookMeta,
    };
  }

  function normalizePlanId(id: string) {
    if (id === "basic") return "starter";
    return id;
  }

  async function onProcess() {
    const p = buildPayload();
    if (!p) return;
    const pr = await window.bofbot.getPlan();
    if (!pr.ok) {
      setPlanModal(pr.error === "not_signed_in" ? "session_expired" : "internet");
      return;
    }
    const { plan, videosProcessedToday, limits } = pr.plan;
    if (limits.maxVideosPerDay !== -1 && videosProcessedToday >= limits.maxVideosPerDay) {
      setPlanModal("daily_limit");
      return;
    }
    const pid = normalizePlanId(plan);
    const customTotal = p.customBannerPairCount + p.customFulltextLineCount;
    const maxC = limits.maxCustomHooks;
    const maxCustomAllowed = maxC === -1 ? Number.POSITIVE_INFINITY : Math.max(0, maxC);
    if (customTotal > maxCustomAllowed) {
      if (pid === "free") setPlanModal("free_custom_hooks");
      else if (pid === "starter") setPlanModal("starter_hooks");
      else setPlanModal("custom_hooks_limit");
      return;
    }
    onStart(p);
  }

  function TopTextChips({
    chips,
    selected,
    onToggle,
  }: {
    chips: LineChip[];
    selected: Set<string>;
    onToggle: (id: string) => void;
  }) {
    return (
      <div style={{ marginBottom: 4 }}>
        <div className="form-label form-label--inline-row">
          <span>Top text</span>
          <span className="batch-palette-dots-inline" aria-hidden>
            {TOP_BAR_ACCENT_PALETTE.map((c) => (
              <span key={c.hex} className="batch-palette-dot" style={{ backgroundColor: c.hex }} title={c.name} />
            ))}
          </span>
          <InfoTip
            label="Top text randomization"
            text="Each video: random top-bar color from the swatches, random line choice from checked chips, and a random emoji suffix on each line (or none) — all independent. Custom pairs use your exact text and are mixed in fairly against random chip picks."
          />
        </div>
        <div className="hook-chip-row">
          {chips.map((c) => {
            const on = selected.has(c.id);
            return (
              <button
                key={c.id}
                type="button"
                className={`hook-chip ${on ? "hook-chip--on" : ""}`}
                onClick={() => onToggle(c.id)}
                title={c.text}
              >
                <span className="hook-chip__check" aria-hidden>
                  <CheckIcon />
                </span>
                <span className="hook-chip__text">{c.text}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  function BottomTextChips({
    chips,
    selected,
    onToggle,
  }: {
    chips: LineChip[];
    selected: Set<string>;
    onToggle: (id: string) => void;
  }) {
    return (
      <div style={{ marginBottom: 4 }}>
        <div className="form-label" style={{ marginBottom: 10 }}>
          Bottom text
        </div>
        <div className="hook-chip-row">
          {chips.map((c) => {
            const on = selected.has(c.id);
            return (
              <button
                key={c.id}
                type="button"
                className={`hook-chip hook-chip--bottom ${on ? "hook-chip--on" : ""}`}
                onClick={() => onToggle(c.id)}
                title={c.text}
              >
                <span className="hook-chip__check" aria-hidden>
                  <CheckIcon />
                </span>
                <span className="hook-chip__text">{c.text}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const hookHint =
    n > 0 && overlayStyle === "banner" && !bannerSideOk
      ? "Pick top and bottom chips, add custom pairs, or enable a strike layout preset."
      : n > 0 && overlayStyle === "fulltext" && !fulltextValid
        ? "Select at least one hook."
        : n > 0 && overlayStyle === "mix" && !bannerSideOk
          ? "Mix mode: configure banner hooks (chips, custom pairs, or strike layout)."
          : n > 0 && overlayStyle === "mix" && !fulltextValid
            ? "Mix mode: select at least one full text hook."
            : null;

  return (
    <div className="batch-page" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div
        className="batch-page__noise"
        aria-hidden
        style={{ backgroundImage: `url("${NOISE_DATA_URI}")` }}
      />

      <header className="app-top-bar app-top-bar--batch">
        <button type="button" className="btn-ghost app-top-bar__batch-back" onClick={onBack}>
          ← Back
        </button>
        <div className="app-top-bar__batch-title">
          <img src={appIcon} alt="" className="app-top-bar__batch-logo" width={28} height={28} />
          <h2 className="font-display" style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0 }}>
            New batch
          </h2>
        </div>
        <span className="app-top-bar__batch-spacer" aria-hidden />
      </header>

      <div className="page-scroll scroll-hoverable batch-page__inner" style={{ flex: 1, minHeight: 0 }}>
        <div
          className="batch-layout"
          style={{
            maxWidth: 720,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: "var(--section-gap)",
          }}
        >
          <div className="batch-section-warm">
            <section className="batch-section">
              <div className="batch-section__head">
                <h3 className="batch-section__title">Overlay style</h3>
                <InfoTip
                  label="Overlay styles"
                  text="Banner: two-line chips. Full text: one block of copy. Mix both: each video randomly uses banner or full text from what you configure below."
                />
              </div>
              <div className="toggle-pair" style={{ flexWrap: "wrap" }}>
                <button
                  type="button"
                  className={`btn-ghost ${overlayStyle === "banner" ? "toggle-pair__btn--active" : ""}`}
                  style={{ flex: "1 1 30%", minWidth: "5.5rem", padding: "0.6rem 0.65rem", fontSize: "0.8rem" }}
                  onClick={() => setOverlayStyle("banner")}
                >
                  Banner
                </button>
                <button
                  type="button"
                  className={`btn-ghost ${overlayStyle === "fulltext" ? "toggle-pair__btn--active" : ""}`}
                  style={{ flex: "1 1 30%", minWidth: "5.5rem", padding: "0.6rem 0.65rem", fontSize: "0.8rem" }}
                  onClick={() => setOverlayStyle("fulltext")}
                >
                  Full text
                </button>
                <button
                  type="button"
                  className={`btn-ghost ${overlayStyle === "mix" ? "toggle-pair__btn--active" : ""}`}
                  style={{ flex: "1 1 30%", minWidth: "5.5rem", padding: "0.6rem 0.65rem", fontSize: "0.8rem" }}
                  onClick={() => setOverlayStyle("mix")}
                >
                  Mix both
                </button>
              </div>
            </section>
          </div>

          {(overlayStyle === "banner" || overlayStyle === "mix") ? (
            <section className="batch-section">
              <div className="batch-section__head">
                <h3 className="batch-section__title">Banner hooks</h3>
                <InfoTip
                  label="Banner hooks details"
                  text="Custom rows use your text exactly (no random emoji). They share probability with random chip combinations based on how many you add."
                />
              </div>
              <p className="batch-section-lead">Top and bottom text are randomly mixed per video.</p>
              <TopTextChips chips={BANNER_LINE1_CHIPS} selected={selectedL1} onToggle={toggleL1} />
              <BottomTextChips chips={BANNER_LINE2_CHIPS} selected={selectedL2} onToggle={toggleL2} />

              <div style={{ marginTop: 14, marginBottom: 2 }}>
                <div className="form-label form-label--inline-row" style={{ marginBottom: 8 }}>
                  <span>Strike layout</span>
                  <InfoTip
                    label="Strike layout preset"
                    text="Optional TikTok-style banner: outlined top line with a strike-through and a red pill below. Each video randomly picks this or your chip combinations (and custom pairs), weighted by how many variants you turn on."
                  />
                </div>
                <div className="hook-chip-row">
                  {BANNER_PRICE_STRIKE_PRESETS.map((p) => {
                    const on = selectedPriceStrike.has(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className={`hook-chip hook-chip--wide ${on ? "hook-chip--on" : ""}`}
                        onClick={() => togglePriceStrike(p.id)}
                        title={`${p.line1_text} / ${p.line2_text}`}
                      >
                        <span className="hook-chip__check" aria-hidden>
                          <CheckIcon />
                        </span>
                        <span className="hook-chip__text">
                          {p.line1_text} · {p.line2_text}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="field" style={{ marginTop: "1rem", marginBottom: 0 }}>
                <div className="form-label form-label--inline-row" style={{ marginBottom: 8 }}>
                  <label htmlFor="batch-custom-banner-pairs" style={{ margin: 0 }}>
                    Custom pairs
                  </label>
                  <InfoTip
                    label="Custom pairs format"
                    text="One pair per line: top | bottom. Lines without | are skipped. Emoji not supported in custom text."
                  />
                </div>
                <textarea
                  id="batch-custom-banner-pairs"
                  value={customBannerPairs}
                  onChange={(e) => setCustomBannerPairs(e.target.value)}
                  rows={3}
                  placeholder={"40% OFF | ENDS TODAY"}
                  className="textarea-branded"
                />
              </div>
            </section>
          ) : null}

          {(overlayStyle === "fulltext" || overlayStyle === "mix") ? (
            <section className="batch-section">
              <div className="batch-section__head">
                <h3 className="batch-section__title">Full text hooks</h3>
                <InfoTip
                  label="Full text hooks"
                  text="Each video picks one random line from checked presets plus any custom lines you add."
                />
              </div>
              <p className="batch-section-lead">One random line per video from your selection.</p>
              <div className="hook-chip-row" style={{ marginBottom: 12 }}>
                {FULLTEXT_PRESETS.map((p) => {
                  const on = selectedFulltext.has(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={`hook-chip hook-chip--wide ${on ? "hook-chip--on" : ""}`}
                      onClick={() => toggleFulltext(p.id)}
                    >
                      <span className="hook-chip__check" aria-hidden>
                        <CheckIcon />
                      </span>
                      <span className="hook-chip__text">
                        {p.text.slice(0, 100)}
                        {p.text.length > 100 ? "…" : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <div className="form-label form-label--inline-row" style={{ marginBottom: 8 }}>
                  <label htmlFor="batch-custom-fulltext" style={{ margin: 0 }}>
                    Custom lines
                  </label>
                  <InfoTip label="Custom full text" text="One variant per line. Emoji not supported in custom text." />
                </div>
                <textarea
                  id="batch-custom-fulltext"
                  value={customFulltext}
                  onChange={(e) => setCustomFulltext(e.target.value)}
                  rows={4}
                  placeholder="Your hook text…"
                  className="textarea-branded"
                />
              </div>
            </section>
          ) : null}

          <section className="batch-section">
            <div className="batch-section__head">
              <h3 className="batch-section__title">Videos</h3>
              <InfoTip label="Videos" text="Drag in files or use Add files — outputs are written when you process the batch." />
            </div>
            <div
              className={`drop-zone ${dragOver ? "drop-zone--active" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
            >
              Drag and drop video files here, or use Add files.
              {n > 0 && <span className="drop-zone__count">{n} video{n === 1 ? "" : "s"} ready</span>}
            </div>
            <button type="button" className="btn-ghost" style={{ marginTop: "0.85rem", width: "100%" }} onClick={pickFiles}>
              Add files…
            </button>
            {n > 0 && (
              <ul className="file-list">
                {filePaths.map((p) => (
                  <li key={p} className="file-list__row">
                    <span className="file-list__path">{p}</span>
                    <button
                      type="button"
                      className="btn-ghost file-list__remove"
                      onClick={() => setFilePaths((prev) => prev.filter((x) => x !== p))}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="batch-section">
            {error && <p style={{ color: "var(--coral)", fontSize: "0.875rem", margin: "0 0 12px" }}>{error}</p>}
            {hookHint && !error && (
              <p style={{ color: "var(--muted)", fontSize: "0.8125rem", margin: "0 0 12px", lineHeight: 1.45 }}>{hookHint}</p>
            )}
            <button
              type="button"
              className="btn-primary btn-primary--large"
              style={{ width: "100%" }}
              disabled={!canProcess}
              title={
                !canProcess
                  ? "Select hooks, custom pairs, or a strike layout preset (and full text in mix mode)."
                  : undefined
              }
              onClick={() => void onProcess()}
            >
              Process batch
            </button>
          </section>
        </div>
      </div>
      {planModal && <PlanBlockModal variant={planModal} onClose={() => setPlanModal(null)} />}
    </div>
  );
}
