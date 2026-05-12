import type { Metadata } from "next";

import { LegalPageShell } from "@/components/marketing/LegalPageShell";

export const metadata: Metadata = {
  title: "Terms of Service — BofBot",
  description:
    "Terms of Service for BofBot — covering the website, desktop app, and iOS app, including Apple App Store subscriptions, acceptable use, disclaimers, and limitations.",
};

const LAST_UPDATED = "May 12, 2026";

export default function TermsPage() {
  return (
    <LegalPageShell title="Terms of Service" lastUpdated={LAST_UPDATED}>
      <p>
        These Terms of Service (&quot;Terms&quot;) govern your access to and use of BofBot
        (&quot;BofBot,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), including our website,
        desktop application, APIs, and related services (collectively, the &quot;Service&quot;). By
        creating an account, downloading or using the Service, or paying for a subscription, you
        agree to these Terms.
      </p>

      <h2>1. The Service</h2>
      <p>
        BofBot provides tools to help you add overlays and text to your own video files. The
        Service is intended for lawful use with content you have the right to modify and distribute.
        We may update, change, or discontinue features with reasonable notice where practicable.
      </p>

      <h2>2. Accounts and eligibility</h2>
      <p>
        You must provide accurate information when registering. You are responsible for safeguarding
        your credentials and for all activity under your account. You must be at least 18 years old
        (or the age of majority in your jurisdiction) to use the Service.
      </p>

      <h2>3. Video processing and your content</h2>
      <p>
        <strong>
          Video files you process with the BofBot desktop application are handled on your device.
        </strong>{" "}
        We do not upload your source videos to our servers for encoding or storage as part of the
        standard desktop workflow. You remain responsible for your content, including compliance
        with TikTok, TikTok Shop, and any other platform rules.
      </p>

      <h2>4. BofBot iOS App</h2>
      <p>
        Use of the BofBot iOS app is also governed by Apple&apos;s standard End User License
        Agreement (EULA), available at{" "}
        <a
          href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/"
          target="_blank"
          rel="noopener noreferrer"
        >
          apple.com/legal/internet-services/itunes/dev/stdeula
        </a>
        . In the event of any conflict between these Terms and Apple&apos;s EULA with respect to
        the iOS app, Apple&apos;s EULA shall prevail to the extent of that conflict.
      </p>
      <h3>4.1 Subscriptions</h3>
      <p>
        The BofBot iOS app offers an auto-renewing monthly subscription (&quot;Pro&quot;) for
        $24.99/month USD or local equivalent. Payment is charged to your Apple ID account at
        confirmation of purchase. Your subscription automatically renews unless auto-renew is
        turned off at least 24 hours before the end of the current period. Your account will be
        charged for renewal within 24 hours prior to the end of the current period.
      </p>
      <p>
        You may manage or cancel your subscription at any time on your iOS device under{" "}
        <strong>Settings → [your Apple ID] → Subscriptions</strong>.
      </p>
      <h3>4.2 Refunds</h3>
      <p>
        All payments for the iOS app are handled by Apple and are subject to Apple&apos;s refund
        policy. Requests for refunds must be submitted to Apple directly at{" "}
        <a
          href="https://reportaproblem.apple.com/"
          target="_blank"
          rel="noopener noreferrer"
        >
          reportaproblem.apple.com
        </a>
        . We are not able to process refunds for App Store purchases on Apple&apos;s behalf.
      </p>
      <h3>4.3 Acceptable use</h3>
      <p>
        You agree to use the BofBot iOS app only for editing your own original video content or
        content you have the right to use. You are responsible for ensuring your use complies
        with all platform terms (TikTok, etc.) and applicable laws.
      </p>
      <h3>4.4 Termination</h3>
      <p>
        We reserve the right to discontinue the iOS app or any subscription tier at any time,
        with reasonable notice provided through the app or by email. In the event of
        discontinuation of paid features, refunds for unused subscription time will be processed
        through Apple per Apple&apos;s policies.
      </p>

      <h2>5. Third-party platforms (including TikTok)</h2>
      <p>
        <strong>
          We are not affiliated with, endorsed by, or responsible for TikTok, TikTok Shop, or any
          other third-party platform.
        </strong>{" "}
        You are solely responsible for how you use outputs from the Service.{" "}
        <strong>
          We are not liable for any action taken against your TikTok or other social accounts,
          including warnings, restrictions, suspensions, or bans,
        </strong>{" "}
        whether or not related to content edited with BofBot. You use the Service at your own risk
        with respect to platform policies and enforcement.
      </p>

      <h2>6. Fees, billing, and refunds</h2>
      <p>
        Paid plans are billed according to the prices shown at checkout.{" "}
        <strong>
          Payments are processed by Stripe. We do not store your full payment card details on our
          servers;
        </strong>{" "}
        card data is handled subject to Stripe&apos;s terms and privacy policy.
      </p>
      <p>
        <strong>
          Except where required by law, subscription fees are non-refundable after seven (7) days
          from the date of purchase or renewal.
        </strong>{" "}
        If you cancel, you typically retain access until the end of the current billing period.
        Chargebacks or payment disputes may result in suspension of your account.
      </p>

      <h2>7. Acceptable use and termination</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the Service for illegal purposes or to violate others&apos; rights;</li>
        <li>Attempt to probe, scan, or test the vulnerability of our systems without authorization;</li>
        <li>Reverse engineer, circumvent technical limits, or resell access except as we expressly allow;</li>
        <li>Harass our team or other users, or abuse support channels.</li>
      </ul>
      <p>
        <strong>
          We may suspend or terminate your account immediately if we reasonably believe you have
          violated these Terms, abused the Service, engaged in fraud, or created risk or legal
          exposure for us or others.
        </strong>{" "}
        We may also terminate accounts that remain inactive for an extended period, with notice
        where appropriate.
      </p>

      <h2>8. Intellectual property</h2>
      <p>
        BofBot, our branding, and the Service&apos;s software and materials are owned by us or our
        licensors. We grant you a limited, non-exclusive, non-transferable license to use the
        Service for your internal or personal commercial creation of videos, subject to these Terms.
        You retain ownership of your original video content and outputs you create.
      </p>

      <h2>9. Disclaimer of warranties</h2>
      <p>
        <strong>
          THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE,&quot; WITHOUT WARRANTIES OF ANY
          KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING IMPLIED WARRANTIES OF
          MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. WE DO NOT
          WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF HARMFUL COMPONENTS.
        </strong>
      </p>

      <h2>10. Limitation of liability</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT WILL BOFBOT OR ITS SUPPLIERS BE LIABLE
        FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF
        PROFITS, DATA, GOODWILL, OR BUSINESS OPPORTUNITIES, ARISING OUT OF OR RELATED TO THE SERVICE
        OR THESE TERMS, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. OUR AGGREGATE LIABILITY
        FOR ALL CLAIMS RELATING TO THE SERVICE SHALL NOT EXCEED THE GREATER OF (A) THE AMOUNTS YOU
        PAID US FOR THE SERVICE IN THE TWELVE (12) MONTHS BEFORE THE CLAIM OR (B) ONE HUNDRED U.S.
        DOLLARS (US$100), EXCEPT WHERE PROHIBITED BY LAW.
      </p>

      <h2>11. Indemnity</h2>
      <p>
        You will defend, indemnify, and hold harmless BofBot and its affiliates, officers,
        directors, employees, and agents from any claims, damages, losses, and expenses (including
        reasonable attorneys&apos; fees) arising from your use of the Service, your content, or your
        violation of these Terms or applicable law.
      </p>

      <h2>12. Changes</h2>
      <p>
        We may modify these Terms from time to time. We will post the updated Terms on this page
        and update the &quot;Last updated&quot; date. Material changes may be communicated by email or
        in-app notice. Continued use after changes become effective constitutes acceptance.
      </p>

      <h2>13. General</h2>
      <p>
        These Terms constitute the entire agreement between you and BofBot regarding the Service.
        If any provision is unenforceable, the remaining provisions remain in effect. Failure to
        enforce a provision is not a waiver. You may not assign these Terms without our consent; we
        may assign them in connection with a merger, acquisition, or sale of assets.
      </p>

      <h2>14. Contact</h2>
      <p>
        For questions about these Terms, email us at{" "}
        <a href="mailto:aightwhatev@gmail.com?subject=BofBot%20Terms%20Question">
          aightwhatev@gmail.com
        </a>{" "}
        or use our contact form at <a href="/contact">bofbot.com/contact</a>.
      </p>
    </LegalPageShell>
  );
}
