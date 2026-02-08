import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — 16s",
  description: "How 16s handles your data, what we collect, and your rights.",
};

export default function PrivacyPage() {
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
          Privacy Policy
        </h1>
        <p className="text-[13px] text-zinc-500 mb-10">
          Last updated: February 2026
        </p>

        <div className="space-y-8 text-[14px] leading-relaxed text-zinc-300">
          <section>
            <h2 className="text-[16px] font-semibold text-zinc-100 mb-3">
              1. Information We Collect
            </h2>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-400">
              <li>
                Account information (email, name) when you sign up via Google,
                GitHub, or email.
              </li>
              <li>
                Content you create — website projects, chat messages, and
                uploaded images.
              </li>
              <li>
                Usage data such as pages visited, features used, and generation
                count.
              </li>
              <li>
                Payment information processed by Stripe. We never see or store
                your full card number.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-zinc-100 mb-3">
              2. How We Use Your Information
            </h2>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-400">
              <li>To provide, maintain, and improve 16s services.</li>
              <li>To process payments and manage your subscription.</li>
              <li>
                To send transactional emails such as deploy notifications and
                form submission alerts.
              </li>
              <li>
                To analyze usage patterns and improve the product (via PostHog,
                if enabled).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-zinc-100 mb-3">
              3. How We Store Your Data
            </h2>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-400">
              <li>
                Projects and account data are stored in Supabase, a cloud
                database with encryption at rest.
              </li>
              <li>Uploaded images are stored in Vercel Blob Storage.</li>
              <li>Deployed websites are hosted on Vercel.</li>
              <li>We do not sell your data to third parties.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-zinc-100 mb-3">
              4. Third-Party Services
            </h2>
            <p className="text-zinc-400 mb-2">
              16s integrates with the following services to deliver
              functionality:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-400">
              <li>
                <strong className="text-zinc-300">Anthropic</strong> — AI
                generation. Your prompts are sent to Claude for processing.
              </li>
              <li>
                <strong className="text-zinc-300">Supabase</strong> — Database
                and authentication.
              </li>
              <li>
                <strong className="text-zinc-300">Vercel</strong> — Hosting and
                deployment.
              </li>
              <li>
                <strong className="text-zinc-300">Stripe</strong> — Payment
                processing.
              </li>
              <li>
                <strong className="text-zinc-300">PostHog</strong> — Analytics
                (if enabled).
              </li>
              <li>
                <strong className="text-zinc-300">Sentry</strong> — Error
                monitoring (if enabled).
              </li>
              <li>
                <strong className="text-zinc-300">Resend</strong> —
                Transactional email delivery.
              </li>
              <li>
                <strong className="text-zinc-300">GitHub</strong> — Code export
                (if you connect your account).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-zinc-100 mb-3">
              5. Your Rights
            </h2>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-400">
              <li>
                You can delete your account and all associated data at any time.
              </li>
              <li>
                You can export your projects as HTML or push them to GitHub.
              </li>
              <li>
                You can disable email notifications in your account settings.
              </li>
              <li>
                Contact us at{" "}
                <a
                  href="mailto:hello@try16s.app"
                  className="text-zinc-300 underline hover:text-white"
                >
                  hello@try16s.app
                </a>{" "}
                for data requests.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-zinc-100 mb-3">
              6. Cookies
            </h2>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-400">
              <li>
                We use essential cookies for authentication (Supabase session).
              </li>
              <li>Analytics cookies (PostHog) can be disabled.</li>
              <li>We do not use advertising cookies.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold text-zinc-100 mb-3">
              7. Changes to This Policy
            </h2>
            <p className="text-zinc-400">
              We will notify registered users of material changes via email.
              Continued use of 16s after changes are published constitutes
              acceptance of the updated policy.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
