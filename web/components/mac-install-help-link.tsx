"use client";

import Link from "next/link";

type Props = {
  className?: string;
  align?: "left" | "center" | "right";
};

export function MacInstallHelpLink({ className = "", align = "center" }: Props) {
  const alignCls =
    align === "right" ? "text-right" : align === "left" ? "text-left" : "text-center";
  return (
    <Link
      href="/mac-help"
      className={`block text-xs leading-snug text-zinc-500 underline-offset-4 transition hover:text-zinc-300 hover:underline ${alignCls} ${className}`.trim()}
    >
      First time on Mac? See installation guide →
    </Link>
  );
}
