"use client";

import { motion } from "framer-motion";
import { MessageSquare, Users, Rocket } from "lucide-react";

const steps = [
  {
    number: "01",
    title: "Describe Your Vision",
    description:
      "Tell us what you want to build. Our AI understands your requirements and creates a project plan.",
    icon: MessageSquare,
  },
  {
    number: "02",
    title: "AI Team Collaborates",
    description:
      "Five specialized agents work together - from design to implementation to testing - just like a real team.",
    icon: Users,
  },
  {
    number: "03",
    title: "Ship Your Product",
    description:
      "Get production-ready code with tests, documentation, and best practices built in. Download and deploy.",
    icon: Rocket,
  },
];

export function HowItWorks() {
  return (
    <section className="container mx-auto px-4 py-24 bg-muted/30">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          From idea to production in three simple steps
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="relative"
            >
              <div className="bg-card border border-border rounded-lg p-8 h-full hover:shadow-lg transition-shadow">
                <div className="flex items-start gap-4 mb-4">
                  <span className="text-5xl font-bold text-primary/20">
                    {step.number}
                  </span>
                  <div className="p-3 rounded-lg bg-primary/10 text-primary">
                    <Icon className="w-6 h-6" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                <p className="text-muted-foreground">{step.description}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
