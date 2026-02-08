"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TEMPLATES, INDUSTRIES, type Industry } from "@/lib/templates";
import { UserMenu } from "@/components/auth/UserMenu";
import { Footer } from "@/components/layout/Footer";

export default function TemplatesPage() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<Industry>("all");

  const filtered = activeFilter === "all"
    ? TEMPLATES
    : TEMPLATES.filter((t) => t.industry === activeFilter);

  const handleUseTemplate = (templateId: string) => {
    router.push(`/?template=${templateId}`);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b]">
      {/* Header */}
      <header className="h-14 md:h-[60px] border-b border-white/[0.04] px-4 md:px-6 flex items-center justify-between">
        <div className="flex items-center gap-4 md:gap-8">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="16s" width={28} height={28} className="object-contain" />
          </Link>
          <nav className="flex items-center gap-1">
            <Link
              href="/"
              className="px-2 md:px-3 py-1.5 text-[12px] md:text-[13px] font-medium text-zinc-400 hover:text-zinc-200 rounded-lg transition-colors"
            >
              Home
            </Link>
            <Link
              href="/templates"
              className="px-2 md:px-3 py-1.5 text-[12px] md:text-[13px] font-medium text-zinc-100 bg-white/[0.06] rounded-lg"
            >
              Templates
            </Link>
          </nav>
        </div>
        <UserMenu />
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-10">
        <div className="mb-6 md:mb-8">
          <h1 className="text-xl md:text-2xl font-semibold text-zinc-100 mb-2">Templates</h1>
          <p className="text-[14px] text-zinc-500">
            Start from a professionally designed template. Click to customize with AI.
          </p>
        </div>

        {/* Industry filter pills */}
        <div className="flex gap-2 mb-6 md:mb-8 overflow-x-auto pb-2 scrollbar-hide">
          {INDUSTRIES.map((industry) => (
            <button
              key={industry}
              onClick={() => setActiveFilter(industry)}
              className={`flex-shrink-0 px-3 py-1.5 text-[12px] font-medium rounded-lg transition-colors ${
                activeFilter === industry
                  ? "bg-green-500/20 text-green-400 border border-green-500/30"
                  : "bg-white/[0.03] text-zinc-400 hover:text-zinc-200 border border-white/[0.06] hover:border-white/[0.12]"
              }`}
            >
              {industry === "all" ? "All" : industry.charAt(0).toUpperCase() + industry.slice(1).replace("-", " ")}
            </button>
          ))}
        </div>

        {/* Template grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {filtered.map((template, i) => (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="group relative bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden hover:border-white/[0.12] hover:bg-white/[0.03] transition-all duration-200 cursor-pointer"
              onClick={() => handleUseTemplate(template.id)}
            >
              {/* Gradient placeholder */}
              <div className={`aspect-[16/10] bg-gradient-to-br ${template.gradient} relative`}>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-white/10 flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-white/60" />
                    </div>
                    <p className="text-[11px] text-white/40 font-medium">Click to generate</p>
                  </div>
                </div>
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button className="px-4 py-2 bg-green-500/90 hover:bg-green-500 text-white text-[13px] font-medium rounded-lg transition-colors">
                    Use this template
                  </button>
                </div>
              </div>

              {/* Template info */}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <h3 className="text-[14px] font-medium text-zinc-200">
                    {template.name}
                  </h3>
                  <span className="px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 bg-white/[0.04] rounded">
                    {template.industry}
                  </span>
                </div>
                <p className="text-[12px] text-zinc-500 line-clamp-2">
                  {template.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
