import Link from "next/link";

export default function Home() {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-10 px-6 py-16">
      <div>
        <h1 className="text-4xl font-semibold tracking-tight text-white">
          BofBot
        </h1>
        <p className="mt-3 text-lg text-zinc-400">
          Burn in TikTok Shop-style text overlays on your product videos — powered
          by BofBot.
        </p>
      </div>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/upload"
            className="rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-200"
          >
            Upload videos
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg border border-zinc-500 px-5 py-2.5 text-sm font-medium text-zinc-100 hover:border-zinc-300"
          >
            Dashboard
          </Link>
        </div>
        <p className="text-xs text-zinc-600">
          No account needed right now — sign in later to keep batches on your
          profile.
        </p>
        <div className="flex flex-wrap gap-4 border-t border-zinc-800 pt-6">
          <Link
            href="/signup"
            className="rounded-lg border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-300 hover:border-zinc-500 hover:text-white"
          >
            Sign up
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-300 hover:border-zinc-500 hover:text-white"
          >
            Log in
          </Link>
          <Link
            href="/pricing"
            className="rounded-lg px-5 py-2.5 text-sm font-medium text-zinc-500 hover:text-zinc-300"
          >
            Pricing
          </Link>
        </div>
      </div>
    </div>
  );
}
