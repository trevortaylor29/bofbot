/// <reference types="vite/client" />

import type { BatchPayload, ProgressEvent } from "./types";

declare global {
  interface Window {
    bofbot: {
      login: (
        email: string,
        password: string
      ) => Promise<
        | { ok: true; user: { email?: string | null; name?: string | null } }
        | { ok: false; error: string }
      >;
      logout: () => Promise<{ ok: boolean }>;
      getSession: () => Promise<{ user?: { email?: string | null } } | null>;
      getPlan: () => Promise<
        | { ok: true; plan: import("./types").PlanPayload }
        | { ok: false; error: string }
      >;
      pickOutputFolder: () => Promise<string | null>;
      getMediaRoot: () => Promise<string>;
      setMediaRoot: (p: string) => Promise<{ ok: boolean }>;
      openDashboard: () => Promise<{ ok: boolean }>;
      openSignup: () => Promise<{ ok: boolean }>;
      openPricing: () => Promise<{ ok: boolean }>;
      openPath: (p: string) => Promise<{ ok: boolean; error?: string }>;
      getRecentBatches: () => Promise<import("./types").RecentBatch[]>;
      deleteAllRecentOutput: () => Promise<
        | { ok: true; removedFolders: number }
        | { ok: false; error: string }
      >;
      pickVideos: () => Promise<string[]>;
      processBatch: (
        payload: BatchPayload
      ) => Promise<{
        ok: boolean;
        error?: string;
        code?: string;
        processed?: number;
        outputDir?: string;
        batchId?: string;
      }>;
      onProgress: (fn: (ev: ProgressEvent) => void) => () => void;
      onPlanSnapshot: (fn: (data: { videosProcessedToday: number }) => void) => () => void;
      downloadAppUpdate: () => Promise<{ ok: boolean; error?: string }>;
      onUpdateAvailable: (
        fn: (data: { version: string; currentVersion: string }) => void
      ) => () => void;
      onUpdateError: (fn: (data: { message: string }) => void) => () => void;
    };
  }
}

export {};
