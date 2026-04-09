import { eq } from "drizzle-orm";
import Link from "next/link";

import { auth, signOut } from "@/auth";
import { getActorUserId } from "@/lib/actor-user";
import { batches } from "@/drizzle/schema";
import { db } from "@/lib/db";
import { isDbConnectionError } from "@/lib/db-errors";

export default async function DashboardPage() {
  const session = await auth();
  const userId = await getActorUserId();

  let list: (typeof batches.$inferSelect)[] = [];
  let dbUnavailable: string | null = null;

  if (!process.env.DATABASE_URL?.trim()) {
    dbUnavailable =
      "DATABASE_URL is not set. Add it to .env.local and start Postgres.";
  } else {
    try {
      list = await db.query.batches.findMany({
        where: eq(batches.userId, userId),
        orderBy: (b, { desc: d }) => [d(b.createdAt)],
        limit: 40,
      });
    } catch (e) {
      console.error("[dashboard] batches query failed", e);
      if (isDbConnectionError(e)) {
        dbUnavailable =
          "Cannot reach Postgres (connection refused or timed out). Start your database and confirm DATABASE_URL in .env.local.";
      } else {
        dbUnavailable =
          "Could not load batches. Check the terminal for the error and run migrations if the schema is out of date.";
      }
    }
  }

  if (dbUnavailable) {
    return (
      <div className="mx-auto min-h-screen max-w-3xl px-6 py-12">
        <h1 className="text-xl font-semibold text-white">Dashboard</h1>
        <p className="mt-6 rounded-lg border border-amber-900/80 bg-amber-950/40 px-4 py-3 text-sm text-amber-100/95">
          {dbUnavailable}
        </p>
        <ul className="mt-4 list-inside list-disc text-sm text-zinc-500">
          <li>Local: run Postgres (Docker or install) on the host/port in DATABASE_URL</li>
          <li>
            Then: <code className="text-zinc-400">cd web && npm run db:migrate</code>{" "}
            (or <code className="text-zinc-400">npm run db:push</code>)
          </li>
        </ul>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/upload"
            className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-400"
          >
            Try upload (needs DB too)
          </Link>
          <Link
            href="/"
            className="rounded-lg px-4 py-2 text-sm text-zinc-500 hover:text-zinc-300"
          >
            ← Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-6 py-12">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-white">Dashboard</h1>
        <div className="flex items-center gap-3">
          <Link
            href="/upload"
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900"
          >
            Upload videos
          </Link>
          {session?.user ? (
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button
                type="submit"
                className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm text-zinc-300 hover:border-zinc-400"
              >
                Sign out
              </button>
            </form>
          ) : (
            <Link
              href="/login"
              className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm text-zinc-300 hover:border-zinc-400"
            >
              Log in
            </Link>
          )}
        </div>
      </header>
      <p className="mt-6 text-zinc-400">
        {session?.user?.email ? (
          <>
            Signed in as{" "}
            <span className="text-zinc-200">{session.user.email}</span>
          </>
        ) : (
          <span className="text-zinc-500">
            Not signed in — batches use the shared guest workspace until auth is
            turned back on.
          </span>
        )}
      </p>

      <h2 className="mt-10 text-sm font-medium text-zinc-300">
        Recent batches
      </h2>
      {list.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">
          No batches yet.{" "}
          <Link href="/upload" className="text-zinc-300 underline">
            Upload videos
          </Link>
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {list.map((b) => (
            <li key={b.id}>
              <Link
                href={`/batch/${b.id}`}
                className="block rounded-lg border border-zinc-800 px-4 py-3 text-sm hover:border-zinc-600"
              >
                <div className="flex justify-between gap-2 text-zinc-200">
                  <span className="capitalize">{b.status}</span>
                  <span className="text-zinc-500">{b.overlayStyle}</span>
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  {b.processedVideos}/{b.totalVideos} videos ·{" "}
                  {b.createdAt?.toISOString?.().slice(0, 10) ?? ""}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Link
        href="/"
        className="mt-10 inline-block text-sm text-zinc-500 hover:text-zinc-300"
      >
        ← Home
      </Link>
    </div>
  );
}
