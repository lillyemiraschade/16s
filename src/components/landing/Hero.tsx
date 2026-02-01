"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const agents = [
  { name: "PO", color: "bg-purple-500", label: "Product Owner" },
  { name: "UX", color: "bg-blue-500", label: "UX Designer" },
  { name: "BE", color: "bg-green-500", label: "Backend Dev" },
  { name: "FE", color: "bg-orange-500", label: "Frontend Dev" },
  { name: "QA", color: "bg-pink-500", label: "QA Engineer" },
];

export function Hero() {
  return (
    <section className="container mx-auto px-4 py-24 md:py-32">
      <div className="flex flex-col items-center text-center space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-4"
        >
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
            Build Software with Your{" "}
            <span className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 bg-clip-text text-transparent">
              AI Team
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
            Five specialized AI agents collaborate seamlessly to turn your ideas
            into production-ready software
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex flex-wrap items-center justify-center gap-4"
        >
          <Link
            href="/signup"
            className="px-8 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
          >
            Start Building
          </Link>
          <Link
            href="#"
            className="px-8 py-3 rounded-lg border border-border font-medium hover:bg-accent transition-colors"
          >
            Watch Demo
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="flex items-center gap-4 mt-12"
        >
          {agents.map((agent, index) => (
            <motion.div
              key={agent.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 + index * 0.1 }}
              className="relative group"
            >
              <motion.div
                animate={{
                  y: [0, -10, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: index * 0.2,
                }}
                className={`w-16 h-16 rounded-full ${agent.color} flex items-center justify-center text-white font-bold text-lg shadow-lg`}
              >
                {agent.name}
              </motion.div>
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap text-xs text-muted-foreground">
                {agent.label}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
