/** Preset hooks for “Use presets” mode — matches pipeline banner / fulltext styles. */

export type BannerPreset = {
  id: string;
  line1Text: string;
  line2Text: string;
  line1Bg: string;
  line1Fg: string;
  line2Bg: string;
  line2Fg: string;
};

export type FulltextPreset = {
  id: string;
  text: string;
};

export const BANNER_PRESETS: BannerPreset[] = [
  {
    id: "b1",
    line1Text: "TRIPLE DISCOUNT ❤️",
    line2Text: "4 HOURS LEFT 😭😭",
    line1Bg: "#FF69B4",
    line1Fg: "#FFFFFF",
    line2Bg: "#FF0000",
    line2Fg: "#FFFFFF",
  },
  {
    id: "b2",
    line1Text: "40% OFF ❤️",
    line2Text: "4 HOURS LEFT 😭😭",
    line1Bg: "#DD00FF",
    line1Fg: "#FFFFFF",
    line2Bg: "#FF0000",
    line2Fg: "#FFFFFF",
  },
  {
    id: "b3",
    line1Text: "LARGE SALE❗",
    line2Text: "4 HOURS LEFT 😭😭",
    line1Bg: "#FF8C00",
    line1Fg: "#FFFFFF",
    line2Bg: "#FF0000",
    line2Fg: "#FFFFFF",
  },
  {
    id: "b4",
    line1Text: "TRIPLE DISCOUNT",
    line2Text: "ENDS TODAY 🚨",
    line1Bg: "#FF0000",
    line1Fg: "#FFFFFF",
    line2Bg: "#FFFFFF",
    line2Fg: "#000000",
  },
  {
    id: "b5",
    line1Text: "2x DISCOUNT 🚨",
    line2Text: "ENDS TODAY",
    line1Bg: "#FF0000",
    line1Fg: "#FFFFFF",
    line2Bg: "#FFFFFF",
    line2Fg: "#000000",
  },
  {
    id: "b6",
    line1Text: "40% OFF",
    line2Text: "ENDS TODAY 🚨",
    line1Bg: "#FF0000",
    line1Fg: "#FFFFFF",
    line2Bg: "#FFFFFF",
    line2Fg: "#000000",
  },
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
    text: "Anyone else grabbing a boatload of these today since it's a fraction of the price?",
  },
  {
    id: "f4",
    text: "This deal is not going to last — grab it before the sale ends tonight",
  },
];

export const BANNER_CUSTOM_PLACEHOLDER = `40% OFF | 4 HOURS LEFT
TRIPLE DISCOUNT | ENDS TODAY
LARGE SALE | 3 HOURS LEFT`;

export const FULLTEXT_CUSTOM_PLACEHOLDER = `TikTok bullied the price down and now this is on a massive sale
If you waited until today you absolutely won because this is dirt cheap rn`;

/**
 * Removes emoji and common emoji-sequence code points from custom hook text.
 * Preset cards are unchanged; only strings from the custom textarea go through this.
 */
export function stripEmojisFromHookText(s: string): string {
  let t = s;
  // Tag sequences (U+E0020…U+E007F)
  t = t.replace(/\uE0020[\uE0020-\uE007E]+\uE007F/g, "");
  // Skin tone modifiers
  t = t.replace(/[\u{1F3FB}-\u{1F3FF}]/gu, "");
  // ZWJ + emoji presentation selector (often in multi-codepoint emoji)
  t = t.replace(/\u200D/g, "");
  t = t.replace(/\uFE0F/g, "");
  // Regional indicator symbols (flags and orphans)
  t = t.replace(/[\u{1F1E6}-\u{1F1FF}]{2}/gu, "");
  t = t.replace(/[\u{1F1E6}-\u{1F1FF}]/gu, "");
  // Remaining emoji / pictographics
  t = t.replace(/\p{Extended_Pictographic}/gu, "");
  // Other variation selectors
  t = t.replace(/[\uFE00-\uFE0F]/g, "");
  return t.replace(/\s+/g, " ").trim();
}

export function parseCustomBannerLines(raw: string): { line1Text: string; line2Text: string }[] {
  const out: { line1Text: string; line2Text: string }[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    const pipe = t.indexOf("|");
    if (pipe < 0) continue;
    const line1Text = stripEmojisFromHookText(t.slice(0, pipe).trim());
    const line2Text = stripEmojisFromHookText(t.slice(pipe + 1).trim());
    if (line1Text && line2Text) {
      out.push({ line1Text, line2Text });
    }
  }
  return out;
}

export function parseCustomFulltextLines(raw: string): { text: string }[] {
  const out: { text: string }[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const text = stripEmojisFromHookText(line.trim());
    if (text) out.push({ text });
  }
  return out;
}
