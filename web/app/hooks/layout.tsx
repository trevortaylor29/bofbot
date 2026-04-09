import { AuthenticatedShell } from "@/components/authenticated-shell";

export default function HooksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthenticatedShell>{children}</AuthenticatedShell>;
}
