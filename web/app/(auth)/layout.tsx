import { AuthChrome } from "@/components/auth-chrome";

/**
 * Login/signup — same visual language as the marketing site (dark + coral).
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthChrome>{children}</AuthChrome>;
}
