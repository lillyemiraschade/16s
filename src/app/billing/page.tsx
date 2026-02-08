"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Zap, Crown, Users, ExternalLink, AlertCircle } from "lucide-react";
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
    icon: Zap,
    credits: 50,
    features: ["50 AI generations/month", "3 projects", "1 deployment", "Basic support"],
  },
  pro: {
    name: "Pro",
    price: 20,
    icon: Crown,
    credits: 500,
    features: ["500 AI generations/month", "Unlimited projects", "10 deployments", "Custom domains", "Priority support"],
  },
  team: {
    name: "Team",
    price: 50,
    icon: Users,
    credits: 2000,
    features: ["2000 AI generations/month", "Unlimited projects", "Unlimited deployments", "Team collaboration", "Analytics", "Dedicated support"],
  },
} as const;

type PlanKey = keyof typeof PLANS;

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
  const { user, loading: authLoading, isConfigured } = useAuth();
  const searchParams = useSearchParams();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loadingSub, setLoadingSub] = useState(true);
  const [upgrading, setUpgrading] = useState<PlanKey | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const success = searchParams.get("success") === "true";
  const canceled = searchParams.get("canceled") === "true";

  // Show success/cancel toast
  useEffect(() => {
    if (success) setToast({ type: "success", message: "Subscription activated! Your credits have been updated." });
    if (canceled) setToast({ type: "error", message: "Checkout canceled. No changes were made." });
    if (success || canceled) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success, canceled]);

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
        // No subscription row yet — show as free plan
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

  return (
    <div className="min-h-screen bg-[#0a0a0b]">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-[13px] font-medium shadow-lg ${
          toast.type === "success" ? "bg-green-500/90 text-white" : "bg-red-500/90 text-white"
        }`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <header className="h-14 md:h-[60px] border-b border-white/[0.04] px-4 md:px-6 flex items-center justify-between">
        <div className="flex items-center gap-4 md:gap-8">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="16s" width={28} height={28} className="object-contain" />
          </Link>
          <nav className="flex items-center gap-1">
            <Link href="/" className="px-2 md:px-3 py-1.5 text-[12px] md:text-[13px] font-medium text-zinc-400 hover:text-zinc-200 rounded-lg transition-colors">
              Home
            </Link>
            <Link href="/projects" className="px-2 md:px-3 py-1.5 text-[12px] md:text-[13px] font-medium text-zinc-400 hover:text-zinc-200 rounded-lg transition-colors">
              Projects
            </Link>
            <Link href="/billing" className="px-2 md:px-3 py-1.5 text-[12px] md:text-[13px] font-medium text-zinc-100 bg-white/[0.06] rounded-lg">
              Billing
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          {!user && isConfigured && (
            <button
              onClick={() => setShowAuthModal(true)}
              className="px-2 md:px-3 py-1.5 text-[12px] md:text-[13px] font-medium text-zinc-300 hover:text-white transition-colors"
            >
              Sign in
            </button>
          )}
          <UserMenu />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-10">
        <h1 className="text-xl md:text-2xl font-semibold text-zinc-100 mb-2">Billing</h1>
        <p className="text-[14px] text-zinc-500 mb-8">Manage your plan and usage.</p>

        {/* Current plan summary */}
        {user && subscription && (
          <div className="mb-10 p-5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[13px] text-zinc-500 uppercase tracking-wider font-medium">Current Plan</span>
                  <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full ${
                    currentPlan === "team" ? "bg-purple-500/15 text-purple-400" :
                    currentPlan === "pro" ? "bg-green-500/15 text-green-400" :
                    "bg-zinc-500/15 text-zinc-400"
                  }`}>
                    {PLANS[currentPlan].name}
                  </span>
                  {subscription.status === "past_due" && (
                    <span className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium bg-amber-500/15 text-amber-400 rounded-full">
                      <AlertCircle className="w-3 h-3" /> Past Due
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
                  className={`h-full rounded-full transition-all ${
                    subscription.credits_remaining / PLANS[currentPlan].credits < 0.1
                      ? "bg-red-500"
                      : subscription.credits_remaining / PLANS[currentPlan].credits < 0.3
                      ? "bg-amber-500"
                      : "bg-green-500"
                  }`}
                  style={{ width: `${Math.min(100, (subscription.credits_remaining / PLANS[currentPlan].credits) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Plan cards */}
        <h2 className="text-[16px] font-semibold text-zinc-200 mb-4">
          {user ? "Compare Plans" : "Choose a Plan"}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(Object.entries(PLANS) as [PlanKey, typeof PLANS[PlanKey]][]).map(([key, plan]) => {
            const isCurrent = user && currentPlan === key;
            const isDowngrade = user && (
              (currentPlan === "team") ||
              (currentPlan === "pro" && key === "free")
            );
            const Icon = plan.icon;

            return (
              <div
                key={key}
                className={`relative p-5 rounded-xl border transition-all ${
                  isCurrent
                    ? "bg-green-500/[0.03] border-green-500/20"
                    : "bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12]"
                }`}
              >
                {isCurrent && (
                  <span className="absolute top-3 right-3 px-2 py-0.5 text-[10px] font-semibold text-green-400 bg-green-500/10 rounded-full">
                    CURRENT
                  </span>
                )}
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${
                  key === "team" ? "bg-purple-500/15" :
                  key === "pro" ? "bg-green-500/15" :
                  "bg-zinc-500/15"
                }`}>
                  <Icon className={`w-4.5 h-4.5 ${
                    key === "team" ? "text-purple-400" :
                    key === "pro" ? "text-green-400" :
                    "text-zinc-400"
                  }`} />
                </div>
                <h3 className="text-[16px] font-semibold text-zinc-100 mb-1">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-2xl font-bold text-zinc-100">${plan.price}</span>
                  {plan.price > 0 && <span className="text-[13px] text-zinc-500">/month</span>}
                </div>
                <ul className="space-y-2 mb-5">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-[13px] text-zinc-400">
                      <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                {isCurrent ? (
                  <div className="w-full py-2 text-center text-[13px] font-medium text-zinc-500">
                    Your current plan
                  </div>
                ) : key === "free" ? (
                  <div className="w-full py-2 text-center text-[13px] font-medium text-zinc-600">
                    {user ? "Downgrade via Manage Subscription" : "Sign up to start"}
                  </div>
                ) : isDowngrade && key !== currentPlan ? (
                  <div className="w-full py-2 text-center text-[13px] font-medium text-zinc-600">
                    Change via Manage Subscription
                  </div>
                ) : (
                  <button
                    onClick={() => handleUpgrade(key)}
                    disabled={!!upgrading}
                    className={`w-full py-2.5 text-[13px] font-semibold rounded-lg transition-colors disabled:opacity-50 ${
                      key === "pro"
                        ? "bg-green-500/80 hover:bg-green-500 text-white"
                        : "bg-purple-500/80 hover:bg-purple-500 text-white"
                    }`}
                  >
                    {upgrading === key ? "Redirecting..." : `Upgrade to ${plan.name}`}
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
              className="px-5 py-2.5 text-[14px] font-medium bg-green-500/80 hover:bg-green-500 text-white rounded-lg transition-colors"
            >
              Sign In
            </button>
          </div>
        )}
      </main>

      <Footer />
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
}
