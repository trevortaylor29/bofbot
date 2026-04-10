import type { Metadata } from "next";

import { LegalPageShell } from "@/components/marketing/LegalPageShell";

export const metadata: Metadata = {
  title: "Privacy Policy — BofBot",
  description:
    "How BofBot collects, uses, and protects your information — email, payments via Stripe, and local video processing.",
};

const LAST_UPDATED = "April 8, 2026";

export default function PrivacyPage() {
  return (
    <LegalPageShell title="Privacy Policy" lastUpdated={LAST_UPDATED}>
      <p>
        This Privacy Policy describes how BofBot (&quot;BofBot,&quot; &quot;we,&quot; &quot;us,&quot; or
        &quot;our&quot;) collects, uses, and shares information when you use our website, desktop
        application, and related services (collectively, the &quot;Service&quot;). By using the
        Service, you agree to this policy.
      </p>

      <h2>1. Information we collect</h2>
      <p>
        <strong>Account information.</strong> When you register or log in, we collect your email
        address and credentials (e.g., password hash) necessary to operate your account.
      </p>
      <p>
        <strong>Payment information.</strong> When you subscribe to a paid plan,{" "}
        <strong>
          payments are processed by Stripe. We do not receive or store your full payment card number
          on our servers.
        </strong>{" "}
        Stripe collects and processes card details according to its own privacy policy. We may
        receive limited billing metadata from Stripe (such as subscription status, customer ID, and
        last four digits of a card) to manage your account.
      </p>
      <p>
        <strong>Usage and technical data.</strong> We may collect basic technical information such
        as IP address, browser or app version, device type, and log data when you use our website or
        authenticate — for example, to secure accounts, prevent abuse, and improve reliability.
      </p>
      <p>
        <strong>Video content.</strong>{" "}
        <strong>
          The BofBot desktop application processes your video files on your computer. We do not
          upload your source videos to our servers for processing in the standard desktop workflow.
        </strong>{" "}
        We may still process limited personal data you send to our servers (such as account and
        subscription verification) as described below.
      </p>

      <h2>2. How we use information</h2>
      <ul>
        <li>Provide, maintain, and improve the Service;</li>
        <li>Create and manage your account and authenticate you;</li>
        <li>Process subscriptions and communicate about billing (via Stripe and our systems);</li>
        <li>Verify subscription status when you use online features;</li>
        <li>Detect, prevent, and respond to fraud, abuse, or security issues;</li>
        <li>Comply with legal obligations and enforce our Terms of Service;</li>
        <li>Send service-related messages (we do not sell your email for third-party marketing).</li>
      </ul>

      <h2>3. How we share information</h2>
      <p>We may share information with:</p>
      <ul>
        <li>
          <strong>Stripe</strong> — for payment processing and subscription management;
        </li>
        <li>
          <strong>Hosting and infrastructure providers</strong> — to run our website, APIs, and
          databases;
        </li>
        <li>
          <strong>Professional advisors</strong> — where required (e.g., auditors, lawyers);
        </li>
        <li>
          <strong>Authorities</strong> — when required by law, subpoena, or to protect rights and
          safety.
        </li>
      </ul>
      <p>We do not sell your personal information as that term is defined under applicable U.S. state laws.</p>

      <h2>4. Cookies and similar technologies</h2>
      <p>
        Our website may use cookies or similar technologies for session management, security, and
        analytics. You can control cookies through your browser settings.
      </p>

      <h2>5. Data retention</h2>
      <p>
        We retain account and billing-related information for as long as your account is active and
        for a reasonable period afterward to resolve disputes, enforce agreements, and meet legal
        requirements. Stripe retains payment data according to its policies.
      </p>

      <h2>6. Security</h2>
      <p>
        We use commercially reasonable technical and organizational measures to protect information.
        No method of transmission or storage is 100% secure; we cannot guarantee absolute security.
      </p>

      <h2>7. Your rights and choices</h2>
      <p>
        Depending on where you live, you may have rights to access, correct, delete, or export
        certain personal data, or to object to or restrict certain processing. To exercise these
        rights, contact us using the information below. You may also unsubscribe from non-essential
        emails using the link in those messages.
      </p>

      <h2>8. Children</h2>
      <p>
        The Service is not directed to children under 13 (or 16 where applicable). We do not
        knowingly collect personal information from children. If you believe we have, contact us and
        we will delete it.
      </p>

      <h2>9. International users</h2>
      <p>
        If you access the Service from outside the United States, your information may be
        processed in the United States or other countries where we or our providers operate, which
        may have different data protection laws than your country.
      </p>

      <h2>10. Third-party services and TikTok</h2>
      <p>
        Our Service may help you prepare content for platforms such as TikTok.{" "}
        <strong>We are not responsible for TikTok&apos;s or any other platform&apos;s privacy practices
        or enforcement actions.</strong> Review each platform&apos;s policies before posting.
      </p>

      <h2>11. Changes to this policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We will post the new version on this
        page and update the &quot;Last updated&quot; date. For material changes, we may provide
        additional notice (e.g., email or in-app).
      </p>

      <h2>12. Contact</h2>
      <p>
        For privacy questions or requests, contact us through the channels listed on our website or
        your account dashboard.
      </p>
    </LegalPageShell>
  );
}
