export type PlanLimits = {
  maxVideosPerDay: number;
  maxCustomHooks: number;
  watermark: boolean;
  priorityProcessing: boolean;
};

export type PlanPayload = {
  plan: string;
  videosProcessedToday: number;
  limits: PlanLimits;
};

export type BannerLineOptionPayload = {
  text: string;
  bg_color: string;
  text_color: string;
};

export type BannerPriceStrikeHookPayload = {
  line1_text: string;
  line2_text: string;
  line2_bg_color: string;
  line2_text_color: string;
  strike_line_color?: string;
};

export type BatchPayload = {
  filePaths: string[];
  /** `mix`: each video randomly uses banner or full text from the configured pools. */
  overlayStyle: "banner" | "fulltext" | "mix";
  /**
   * Random mix mode: worker picks random top line, random bottom line, random top color,
   * random emoji suffix per line (including none), each video. Optional fixed pairs from custom field.
   */
  bannerLine1Options?: BannerLineOptionPayload[];
  bannerLine2Options?: BannerLineOptionPayload[];
  bannerFixedHooks?: { line1_text: string; line2_text: string }[];
  line1EmojiPool?: string[];
  line2EmojiPool?: string[];
  /** Legacy: only fixed pairs (e.g. custom-only batch with no chip pools). */
  bannerHooks?: { line1_text: string; line2_text: string }[];
  /** Weighted random vs chip mix / custom pairs when banner clip is chosen. */
  bannerPriceStrikeHooks?: BannerPriceStrikeHookPayload[];
  fulltextHooks?: { text: string }[];
  colorPresets?: {
    line1_bg_color: string;
    line1_text_color: string;
    line2_bg_color: string;
    line2_text_color: string;
  }[];
  /** Custom textarea lines only (for Starter 5-custom-hook enforcement). */
  customBannerPairCount: number;
  customFulltextLineCount: number;
};

export type ProgressEvent = {
  current: number;
  total: number;
  fileName: string;
  phase: string;
};

export interface FileWithPath extends File {
  path?: string;
}

/** Persisted in main-process store (last 5 completed batches). */
export type RecentBatch = {
  id: string;
  completedAt: number;
  videoCount: number;
  outputDir: string;
};
