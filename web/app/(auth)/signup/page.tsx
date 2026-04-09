import Link from "next/link";

import { SignupForm } from "./ui";

export default function SignupPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold text-white">Sign up</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Already have an account?{" "}
        <Link href="/login" className="text-zinc-200 underline">
          Log in
        </Link>
      </p>
      <div className="mt-8">
        <SignupForm />
      </div>
    </div>
  );
}
