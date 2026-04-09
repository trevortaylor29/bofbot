import Link from "next/link";

export default function HooksPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 text-sm text-zinc-400">
      <Link href="/dashboard" className="text-zinc-500 hover:text-zinc-300">
        ← Dashboard
      </Link>
      <h1 className="mt-6 text-xl font-medium text-zinc-100">My hooks</h1>
      <p className="mt-3 text-zinc-500">
        Saved hook library (step 6 in the build plan) will live here.
      </p>
    </div>
  );
}
