import { AuthenticatedShell } from "@/components/authenticated-shell";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthenticatedShell>{children}</AuthenticatedShell>;
}
