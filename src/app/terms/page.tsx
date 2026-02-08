import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — 16s",
  description: "Terms and conditions for using the 16s AI web design platform.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-zinc-900">
      <div className="max-w-3xl mx-auto py-16 px-4">
        <Link
          href="/"
          className="text-[13px] text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          &larr; Back to 16s
        </Link>

        <h1 className="text-2xl font-semibold text-zinc-100 mt-6 mb-1">
          Terms of Service
        </h1>
        <p className="text-[13px] text-zinc-500 mb-10">
          Last updated: February 2026
        </p>

        <div className="space-y-8 text-[14px] leading-relaxed text-zinc-300">
          <section>
            <h2 className="text-[16px] font-semibold text-zinc-100 mb-3">
              1. Acceptance of Terms
            </h2>
            <p className="text-zinc-400">
              By accessing or using 16s, you agree to be bound by these Terms of
              Service. If you do not agree, do not use the service. You must be
              at least 13 years old to use 16s.
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-zinc-100 mb-3">
              2. Your Account
            </h2>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-400">
              <li>
                You are responsible for maintaining the security of your account
                credentials.
              </li>
              <li>
                Accounts are for individual use only — shared logins are not
                permitted.
              </li>
              <li>
                We may suspend or terminate accounts that violate these terms.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-zinc-100 mb-3">
              3. The Service
            </h2>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-400">
              <li>16s is an AI-powered web design tool.</li>
              <li>
                We provide the platform; you own the websites you create.
              </li>
              <li>
                AI-generated content may not be perfect — you are responsible
                for reviewing all output before publishing.
              </li>
              <li>
                We reserve the right to modify or discontinue features at any
                time.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-zinc-100 mb-3">
              4. Content Ownership
            </h2>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-400">
              <li>
                You own all websites and content you create with 16s.
              </li>
              <li>
                You grant us a limited license to host, display, and process
                your content solely to provide the service.
              </li>
              <li>
                We do not claim ownership of your generated websites.
              </li>
              <li>
                You are responsible for ensuring your content does not violate
                the rights of others.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-zinc-100 mb-3">
              5. Acceptable Use
            </h2>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-400">
              <li>
                Do not generate illegal, harmful, or abusive content.
              </li>
              <li>
                Do not attempt to reverse-engineer the AI system.
              </li>
              <li>
                Do not abuse the API or circumvent rate limits.
              </li>
              <li>
                Do not use 16s to create phishing sites, malware distribution
                pages, or other deceptive content.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-zinc-100 mb-3">
              6. Payments &amp; Refunds
            </h2>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-400">
              <li>
                Free tier: 50 credits per month with limited features.
              </li>
              <li>Paid plans are billed monthly via Stripe.</li>
              <li>
                Credits reset each billing cycle; unused credits do not roll
                over.
              </li>
              <li>
                Refunds are handled on a case-by-case basis. Contact{" "}
                <a
                  href="mailto:hello@try16s.app"
                  className="text-zinc-300 underline hover:text-white"
                >
                  hello@try16s.app
                </a>{" "}
                for refund requests.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-zinc-100 mb-3">
              7. Limitation of Liability
            </h2>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-400">
              <li>
                16s is provided &ldquo;as is&rdquo; without warranties of any
                kind.
              </li>
              <li>
                We are not liable for downtime, data loss, or errors in
                AI-generated output.
              </li>
              <li>
                Our total liability is limited to the amount you have paid us in
                the preceding 12 months.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-zinc-100 mb-3">
              8. Termination
            </h2>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-400">
              <li>You may cancel your account at any time.</li>
              <li>
                We may terminate accounts that violate these terms, with or
                without notice.
              </li>
              <li>
                Upon termination, your data will be deleted within 30 days.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-zinc-100 mb-3">
              9. Contact
            </h2>
            <p className="text-zinc-400">
              Questions about these terms? Email us at{" "}
              <a
                href="mailto:hello@try16s.app"
                className="text-zinc-300 underline hover:text-white"
              >
                hello@try16s.app
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
