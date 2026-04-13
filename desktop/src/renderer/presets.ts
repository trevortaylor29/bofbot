/** Desktop presets — aligned with worker `DEFAULT_BANNER_COLOR_PRESETS` for /process. */

export type LineChip = {
  id: string;
  /** Plain line text (no emoji); worker appends a random suffix from `BANNER_EMOJI_SUFFIX_POOL` per video. */
  text: string;
  bg_color: string;
  text_color: string;
};

export type FulltextPreset = { id: string; text: string };

/** Toggleable desktop preset → worker `banner_price_strike`. */
export type BannerPriceStrikePreset = {
  id: string;
  line1_text: string;
  line2_text: string;
  line2_bg_color: string;
  line2_text_color: string;
  strike_line_color?: string;
};

export const BANNER_PRICE_STRIKE_PRESETS: BannerPriceStrikePreset[] = [
  {
    id: "ps1",
    line1_text: "FULL PRICE",
    line2_text: "40% OFF 🚨",
    line2_bg_color: "#FF0000",
    line2_text_color: "#FFFFFF",
    strike_line_color: "#FF0000",
  },
];

/** Top bar accent pool (random per video, independent of top line text). */
export const TOP_BAR_ACCENT_PALETTE: { name: string; hex: string }[] = [
  { name: "pink", hex: "#FF69B4" },
  { name: "magenta", hex: "#DD00FF" },
  { name: "orange", hex: "#FF8C00" },
  { name: "red", hex: "#E11D48" },
  { name: "purple", hex: "#7C3AED" },
];

/**
 * Random suffix appended to each banner line per video (must match worker `DEFAULT_BANNER_EMOJI_SUFFIX_POOL`).
 * "" = no emoji for that line on that video.
 */
export const BANNER_EMOJI_SUFFIX_POOL: string[] = [
  "",
  " \u2764\uFE0F",
  " \uD83D\uDE2D",
  " \uD83D\uDEA8",
  " \u2757",
];

export const BANNER_LINE1_CHIPS: LineChip[] = [
  { id: "l1-1", text: "TRIPLE DISCOUNT", bg_color: "#2a2a2a", text_color: "#FFFFFF" },
  { id: "l1-2", text: "40% OFF", bg_color: "#2a2a2a", text_color: "#FFFFFF" },
  { id: "l1-3", text: "LARGE SALE", bg_color: "#2a2a2a", text_color: "#FFFFFF" },
  { id: "l1-4", text: "50% OFF", bg_color: "#2a2a2a", text_color: "#FFFFFF" },
  { id: "l1-5", text: "2x DISCOUNT", bg_color: "#2a2a2a", text_color: "#FFFFFF" },
];

export const BANNER_LINE2_CHIPS: LineChip[] = [
  { id: "l2-1", text: "4 HOURS LEFT", bg_color: "#FFFFFF", text_color: "#000000" },
  { id: "l2-2", text: "CHECK COUPONS", bg_color: "#FFFFFF", text_color: "#000000" },
  { id: "l2-4", text: "ENDS TODAY", bg_color: "#FFFFFF", text_color: "#000000" },
  { id: "l2-5", text: "LAST CHANCE", bg_color: "#FFFFFF", text_color: "#000000" },
];

const BOTTOM_BAR = {
  line2_bg_color: "#FFFFFF",
  line2_text_color: "#000000",
} as const;

export const WORKER_BANNER_COLOR_PRESETS: {
  line1_bg_color: string;
  line1_text_color: string;
  line2_bg_color: string;
  line2_text_color: string;
}[] = [
  { line1_bg_color: "#FF69B4", line1_text_color: "#FFFFFF", ...BOTTOM_BAR },
  { line1_bg_color: "#DD00FF", line1_text_color: "#FFFFFF", ...BOTTOM_BAR },
  { line1_bg_color: "#FF8C00", line1_text_color: "#FFFFFF", ...BOTTOM_BAR },
  { line1_bg_color: "#E11D48", line1_text_color: "#FFFFFF", ...BOTTOM_BAR },
  { line1_bg_color: "#7C3AED", line1_text_color: "#FFFFFF", ...BOTTOM_BAR },
];

export const FULLTEXT_PRESETS: FulltextPreset[] = [
  {
    id: "f1",
    text: "If you waited until today you absolutely won because this is dirt cheap rn with free shipping",
  },
  {
    id: "f2",
    text: "TikTok bullied the price down and now this is on a massive sale with free shipping for the next few hours 😳",
  },
  {
    id: "f3",
    text: "Someone f'd up at TikTok cus this just went on a massive discount with free shipping...",
  },
  {
    id: "f4",
    text: "Anyone else grabbing a boatload of this today since it's a fraction of the price?",
  },
  {
    id: "f5",
    text: "When a company accidentally overproduced their best product so they're VIOLENTLY discounted today 😭",
  },
];

/** Worker `BannerLineOption` — colors are ignored; worker uses `color_presets` for bars. */
export const WORKER_LINE_OPTION_PLACEHOLDER = {
  bg_color: "#171717",
  text_color: "#fafafa",
} as const;

export function lineOptionsFromChips(chips: LineChip[]) {
  return chips.map((c) => ({
    text: c.text,
    bg_color: WORKER_LINE_OPTION_PLACEHOLDER.bg_color,
    text_color: WORKER_LINE_OPTION_PLACEHOLDER.text_color,
  }));
}

/** Custom banner: one `line1 | line2` per line. Lines without `|` are skipped. */
export function parseBannerPairLines(raw: string): { line1_text: string; line2_text: string }[] {
  const out: { line1_text: string; line2_text: string }[] = [];
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    const pipe = t.indexOf("|");
    if (pipe === -1) continue;
    const a = t.slice(0, pipe).trim();
    const b = t.slice(pipe + 1).trim();
    if (!a || !b) continue;
    out.push({ line1_text: a, line2_text: b });
  }
  return out;
}
