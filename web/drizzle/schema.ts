import { relations } from "drizzle-orm";
import {
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const userPlanEnum = pgEnum("user_plan", [
  "free",
  "starter",
  "basic",
  "pro",
]);
export const batchStatusEnum = pgEnum("batch_status", [
  "uploading",
  "processing",
  "complete",
  "failed",
]);
export const overlayStyleEnum = pgEnum("overlay_style", ["banner", "fulltext"]);
export const videoStatusEnum = pgEnum("video_status", [
  "pending",
  "processing",
  "complete",
  "failed",
]);
export const hookStyleEnum = pgEnum("hook_style", ["banner", "fulltext"]);

/** Snapshot of hook variants chosen for this batch (worker + history). */
export type BannerHookVariant = { line1Text: string; line2Text: string };
export type FulltextHookVariant = { text: string };
export type HooksSnapshot =
  | { style: "banner"; variants: BannerHookVariant[] }
  | { style: "fulltext"; variants: FulltextHookVariant[] };

/** Auth.js + app: users table (+ OAuth columns). */
export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  passwordHash: text("password_hash"),
  googleId: text("google_id"),
  stripeCustomerId: text("stripe_customer_id"),
  plan: userPlanEnum("plan").notNull().default("free"),
  videosProcessedThisPeriod: integer("videos_processed_this_period")
    .notNull()
    .default(0),
  /** UTC calendar date for `videos_processed_today`; null = no activity this UTC day yet. */
  usageDay: date("usage_day", { mode: "date" }),
  videosProcessedToday: integer("videos_processed_today").notNull().default(0),
  billingPeriodStart: timestamp("billing_period_start", {
    withTimezone: true,
    mode: "date",
  }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  })
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  })
);

export const batches = pgTable("batches", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: batchStatusEnum("status").notNull().default("uploading"),
  overlayStyle: overlayStyleEnum("overlay_style").notNull(),
  hooksSnapshot: jsonb("hooks_snapshot").$type<HooksSnapshot>().notNull(),
  totalVideos: integer("total_videos").notNull().default(0),
  processedVideos: integer("processed_videos").notNull().default(0),
  zipUrl: text("zip_url"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
});

export const videos = pgTable("videos", {
  id: uuid("id").defaultRandom().primaryKey(),
  batchId: uuid("batch_id")
    .notNull()
    .references(() => batches.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  rawMediaPath: text("raw_media_path").notNull(),
  processedMediaPath: text("processed_media_path"),
  status: videoStatusEnum("status").notNull().default("pending"),
  hookTextUsed: text("hook_text_used"),
  colorPresetUsed: text("color_preset_used"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true, mode: "date" }),
});

export const hooks = pgTable("hooks", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  style: hookStyleEnum("style").notNull(),
  line1Text: text("line1_text"),
  line2Text: text("line2_text"),
  fulltext: text("fulltext"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  batches: many(batches),
  videos: many(videos),
  hooks: many(hooks),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const batchesRelations = relations(batches, ({ one, many }) => ({
  user: one(users, { fields: [batches.userId], references: [users.id] }),
  videos: many(videos),
}));

export const videosRelations = relations(videos, ({ one }) => ({
  batch: one(batches, { fields: [videos.batchId], references: [batches.id] }),
  user: one(users, { fields: [videos.userId], references: [users.id] }),
}));

export const hooksRelations = relations(hooks, ({ one }) => ({
  user: one(users, { fields: [hooks.userId], references: [users.id] }),
}));
