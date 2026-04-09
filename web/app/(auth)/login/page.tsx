import Link from "next/link";
import { Suspense } from "react";

import { LoginForm } from "./ui";

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold text-white">Log in</h1>
      <p className="mt-2 text-sm text-zinc-400">
        New here?{" "}
        <Link href="/signup" className="text-zinc-200 underline">
          Create an account
        </Link>
      </p>
      <div className="mt-8">
        <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
