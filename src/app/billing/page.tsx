"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Minus, ExternalLink, ChevronDown } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthContext";
import { UserMenu } from "@/components/auth/UserMenu";
import { AuthModal } from "@/components/auth/AuthModal";
import { createClient } from "@/lib/supabase/client";
import { Footer } from "@/components/layout/Footer";

const PLANS = {
  free: {
    name: "Free",
    price: 0,
    credits: 10,
    features: [
      { text: "10 generations/month", included: true },
      { text: "2 sites", included: true },
      { text: "1 live deployment", included: true },
      { text: "Community support", included: true },
      { text: "Custom domains", included: false },
      { text: "GitHub export", included: false },
      { text: "Form submissions", included: false },
      { text: "Priority support", included: false },
    ],
  },
  pro: {
    name: "Pro",
    price: 24,
    credits: 75,
    features: [
      { text: "75 generations/month", included: true },
      { text: "25 sites", included: true },
      { text: "10 live deployments", included: true },
      { text: "Custom domains", included: true },
      { text: "GitHub export", included: true },
      { text: "Form submissions", included: true },
      { text: "Priority support", included: true },
    ],
  },
} as const;

type PlanKey = keyof typeof PLANS;

const FAQ = [
  {
    q: "What counts as a generation?",
    a: "Each message you send that produces or modifies a website counts as one generation. Discussion-mode messages and voice calls that don\u2019t generate code are free.",
  },
  {
    q: "Do unused credits roll over?",
    a: "No. Credits reset at the start of each billing cycle. Use them or lose them.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel from the Manage Subscription portal. You\u2019ll keep Pro access until the end of your current billing period.",
  },
  {
    q: "What happens if I downgrade?",
    a: "Your sites stay live, but you\u2019ll be limited to Free-tier quotas. Extra deployments beyond the free limit won\u2019t be removed, but you can\u2019t create new ones.",
  },
];

interface Subscription {
  plan: string;
  status: string;
  credits_remaining: number;
  credits_reset_at: string | null;
  current_period_end: string | null;
  stripe_customer_id: string | null;
}

export default function BillingPageWrapper() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-green-500/30 border-t-green-500 rounded-full animate-spin" />
      </div>
    }>
      <BillingPage />
    </Suspense>
  );
}

function BillingPage() {
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loadingSub, setLoadingSub] = useState(true);
  const [upgrading, setUpgrading] = useState<PlanKey | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const success = searchParams.get("success") === "true";
  const canceled = searchParams.get("canceled") === "true";

  // Fetch subscription
  useEffect(() => {
    if (authLoading) return;
    if (!user) { setLoadingSub(false); return; }

    const supabase = createClient();
    if (!supabase) { setLoadingSub(false); return; }

    (async () => {
      try {
        const { data, error } = await supabase
          .from("subscriptions")
          .select("plan, status, credits_remaining, credits_reset_at, current_period_end, stripe_customer_id")
          .eq("user_id", user.id)
          .single();
        if (error) throw error;
        setSubscription(data ?? null);
      } catch {
        setSubscription(null);
      } finally {
        setLoadingSub(false);
      }
    })();
  }, [authLoading, user]);

  const currentPlan = (subscription?.plan as PlanKey) || "free";

  const handleUpgrade = async (plan: PlanKey) => {
    if (!user) { setShowAuthModal(true); return; }
    setUpgrading(plan);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setToast({ type: "error", message: data.error || "Failed to start checkout" });
      }
    } catch {
      setToast({ type: "error", message: "Something went wrong. Please try again." });
    } finally {
      setUpgrading(null);
    }
  };

  const handleManage = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setToast({ type: "error", message: data.error || "Failed to open billing portal" });
      }
    } catch {
      setToast({ type: "error", message: "Something went wrong. Please try again." });
    } finally {
      setPortalLoading(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  if (authLoading || loadingSub) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-green-500/30 border-t-green-500 rounded-full animate-spin" />
      </div>
    );
  }

  const usageRatio = subscription ? subscription.credits_remaining / PLANS[currentPlan].credits : 1;

  return (
    <div className="min-h-screen bg-[#0a0a0b]">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-[13px] font-medium shadow-lg ${
          toast.type === "success" ? "bg-green-500/90 text-white" : "bg-zinc-700 text-zinc-200"
        }`}>
          {toast.message}
        </div>
      )}

      {/* Success/Cancel banners */}
      {success && (
        <div className="bg-green-500/10 border-b border-green-500/20 px-4 py-3 text-center text-[13px] font-medium text-green-400">
          &#10003; Welcome to Pro! Your credits have been updated.
        </div>
      )}
      {canceled && (
        <div className="bg-zinc-800/50 border-b border-zinc-700/30 px-4 py-3 text-center text-[13px] font-medium text-zinc-400">
          Checkout canceled. No charges were made.
        </div>
      )}

      {/* Header */}
      <header className="h-14 border-b border-white/[0.04] px-4 md:px-6 flex items-center justify-between">
        <div className="flex items-center gap-4 md:gap-8">
          <Link href="/">
            <Image src="/logo.png" alt="16s" width={26} height={26} className="object-contain" />
          </Link>
          <nav className="flex items-center gap-0.5">
            <Link href="/" className="px-2.5 py-1.5 text-[12px] md:text-[13px] font-medium text-zinc-400 hover:text-zinc-200 rounded-lg transition-colors">
              Home
            </Link>
            <Link href="/projects" className="px-2.5 py-1.5 text-[12px] md:text-[13px] font-medium text-zinc-400 hover:text-zinc-200 rounded-lg transition-colors">
              Projects
            </Link>
            <Link href="/billing" className="px-2.5 py-1.5 text-[12px] md:text-[13px] font-medium text-zinc-100 bg-white/[0.06] rounded-lg">
              Billing
            </Link>
          </nav>
        </div>
        <UserMenu />
      </header>

      <main className="max-w-3xl mx-auto px-4 md:px-6 py-6 md:py-10">
        <h1 className="text-xl md:text-2xl font-semibold text-zinc-100 mb-2">Billing</h1>
        <p className="text-[14px] text-zinc-500 mb-8">Manage your plan and usage.</p>

        {/* Out of credits alert */}
        {user && currentPlan === "free" && subscription && subscription.credits_remaining <= 0 && (
          <div className="mb-6 p-4 rounded-xl bg-white/[0.04] border border-white/[0.06] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <span className="text-[13px] font-medium text-zinc-300">
              You&apos;ve used all your credits. Upgrade to continue building.
            </span>
            <button
              onClick={() => handleUpgrade("pro")}
              disabled={!!upgrading}
              className="px-4 py-2 text-[13px] font-semibold bg-green-500 hover:bg-green-400 text-black rounded-lg transition-colors disabled:opacity-50 shrink-0"
            >
              {upgrading === "pro" ? "Redirecting..." : "Upgrade to Pro \u2192"}
            </button>
          </div>
        )}

        {/* Current plan summary */}
        {user && subscription && (
          <div className="mb-10 p-5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[13px] text-zinc-500 uppercase tracking-wider font-medium">Current Plan</span>
                  <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full ${
                    currentPlan === "pro" ? "bg-green-500/15 text-green-400" : "bg-zinc-500/15 text-zinc-400"
                  }`}>
                    {PLANS[currentPlan].name}
                  </span>
                  {subscription.status === "past_due" && (
                    <span className="px-2 py-0.5 text-[11px] font-medium bg-zinc-500/15 text-zinc-400 rounded-full">
                      Past Due
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-3 mt-2">
                  <span className="text-3xl font-bold text-zinc-100">{subscription.credits_remaining}</span>
                  <span className="text-[13px] text-zinc-500">/ {PLANS[currentPlan].credits} credits remaining</span>
                </div>
                {subscription.credits_reset_at && (
                  <p className="text-[12px] text-zinc-600 mt-1">
                    Resets {formatDate(subscription.credits_reset_at)}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {subscription.stripe_customer_id && (
                  <button
                    onClick={handleManage}
                    disabled={portalLoading}
                    className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium text-zinc-300 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] rounded-lg transition-colors disabled:opacity-50"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    {portalLoading ? "Opening..." : "Manage Subscription"}
                  </button>
                )}
              </div>
            </div>
            {/* Usage bar */}
            <div className="mt-4">
              <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${usageRatio < 0.1 ? "bg-red-500" : "bg-green-500"}`}
                  style={{ width: `${Math.min(100, usageRatio * 100)}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Plan cards — two columns centered */}
        <h2 className="text-[16px] font-semibold text-zinc-200 mb-4">
          {user ? "Compare Plans" : "Choose a Plan"}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
          {(Object.entries(PLANS) as [PlanKey, typeof PLANS[PlanKey]][]).map(([key, plan]) => {
            const isCurrent = user && currentPlan === key;
            const isDowngrade = user && currentPlan === "pro" && key === "free";

            return (
              <div
                key={key}
                className={`relative p-5 rounded-xl border transition-all ${
                  isCurrent
                    ? "bg-white/[0.02] border-zinc-600"
                    : "bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12]"
                }`}
              >
                {isCurrent && (
                  <span className="absolute top-3 right-3 text-[11px] font-medium text-zinc-500">
                    Your current plan
                  </span>
                )}
                <h3 className="text-[16px] font-semibold text-zinc-100 mb-1">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-5">
                  <span className="text-2xl font-bold text-zinc-100">${plan.price}</span>
                  {plan.price > 0 && <span className="text-[13px] text-zinc-500">/month</span>}
                </div>
                <ul className="space-y-2.5 mb-5">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-[13px]">
                      {feature.included ? (
                        <Check className={`w-4 h-4 mt-0.5 shrink-0 ${key === "pro" ? "text-green-500" : "text-zinc-500"}`} />
                      ) : (
                        <Minus className="w-4 h-4 mt-0.5 shrink-0 text-zinc-700" />
                      )}
                      <span className={feature.included ? "text-zinc-400" : "text-zinc-600"}>
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <div className="w-full py-2.5 text-center text-[13px] font-medium text-zinc-600 border border-white/[0.06] rounded-lg">
                    Current plan
                  </div>
                ) : key === "free" ? (
                  <div className="w-full py-2.5 text-center text-[13px] font-medium text-zinc-600">
                    {user ? (isDowngrade ? "Downgrade via Manage Subscription" : "") : "Sign up to start"}
                  </div>
                ) : (
                  <button
                    onClick={() => handleUpgrade(key)}
                    disabled={!!upgrading}
                    className="w-full py-2.5 text-[13px] font-semibold rounded-lg transition-colors disabled:opacity-50 bg-green-500 hover:bg-green-400 text-black"
                  >
                    {upgrading === key ? "Redirecting..." : "Upgrade to Pro"}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Not signed in */}
        {!user && (
          <div className="mt-8 text-center">
            <p className="text-[14px] text-zinc-500 mb-4">Sign in to view your plan and manage billing.</p>
            <button
              onClick={() => setShowAuthModal(true)}
              className="px-5 py-2.5 text-[14px] font-medium bg-green-500 hover:bg-green-400 text-black rounded-lg transition-colors"
            >
              Sign In
            </button>
          </div>
        )}

        {/* FAQ */}
        <div className="mt-12">
          <h2 className="text-[16px] font-semibold text-zinc-200 mb-4">Frequently Asked Questions</h2>
          <div className="space-y-2">
            {FAQ.map((item, idx) => (
              <div
                key={idx}
                className="rounded-xl bg-white/[0.02] border border-white/[0.06]"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full flex items-center justify-between px-4 py-3.5 text-left"
                >
                  <span className="text-[13px] font-medium text-zinc-300">{item.q}</span>
                  <ChevronDown className={`w-4 h-4 text-zinc-600 shrink-0 ml-4 transition-transform ${openFaq === idx ? "rotate-180" : ""}`} />
                </button>
                {openFaq === idx && (
                  <div className="px-4 pb-3.5 -mt-1">
                    <p className="text-[13px] text-zinc-500 leading-relaxed">{item.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

      </main>

      <Footer />
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
}
