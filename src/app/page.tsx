"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  Lock,
  Terminal,
  Rocket,
  Zap,
  Activity,
  Code,
  FileCode,
  ChevronRight,
  Check,
  Loader2,
} from "lucide-react";
import { AgentCard } from "@/components/agents/AgentCard";
import { agents } from "@/lib/ai/agents";

type Phase = "input" | "building" | "complete";
type BmadStep = 0 | 1 | 2 | 3;

interface AgentMessage {
  agentId: string;
  message: string;
  timestamp: number;
}

const placeholders = [
  "A secure authentication system with OAuth and MFA...",
  "An encrypted messaging app with end-to-end encryption...",
  "A vulnerability scanner dashboard for web applications...",
  "A zero-trust API gateway with role-based access control...",
];

const quickStarts = [
  { title: "Auth System", description: "OAuth2 + JWT + MFA authentication system" },
  { title: "Secure API", description: "Zero-trust REST API with rate limiting" },
  { title: "Crypto Wallet", description: "Multi-chain cryptocurrency wallet" },
  { title: "Threat Dashboard", description: "Real-time security monitoring dashboard" },
];

const bmadPhases = [
  { key: "B", label: "BUILD", icon: Code, color: "#06b6d4" },
  { key: "M", label: "MEASURE", icon: Activity, color: "#a855f7" },
  { key: "A", label: "ANALYZE", icon: Shield, color: "#22c55e" },
  { key: "D", label: "DEPLOY", icon: Rocket, color: "#f59e0b" },
];

const mockFiles = [
  { name: "src/auth/jwt.ts", type: "file" },
  { name: "src/auth/oauth.ts", type: "file" },
  { name: "src/middleware/security.ts", type: "file" },
  { name: "src/api/routes.ts", type: "file" },
  { name: "tests/security.test.ts", type: "file" },
];

export default function HomePage() {
  const [phase, setPhase] = useState<Phase>("input");
  const [currentBmadStep, setCurrentBmadStep] = useState<BmadStep>(0);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [userInput, setUserInput] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [agentStates, setAgentStates] = useState<Record<string, "idle" | "thinking" | "working" | "done">>({
    "security-architect": "idle",
    "threat-analyst": "idle",
    "backend-dev": "idle",
    "frontend-dev": "idle",
    "pen-tester": "idle",
  });

  // Rotate placeholder text
  useEffect(() => {
    if (phase !== "input") return;
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % placeholders.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [phase]);

  // Mock build process
  const startBuild = () => {
    setPhase("building");
    setCurrentBmadStep(0);
    setMessages([]);

    const timeline = [
      // BUILD phase
      { delay: 500, agentId: "security-architect", status: "working" as const, message: "Analyzing security requirements..." },
      { delay: 1500, agentId: "security-architect", message: "Designing zero-trust architecture with OAuth2 flow" },
      { delay: 2500, agentId: "backend-dev", status: "working" as const, message: "Setting up secure API endpoints..." },
      { delay: 3500, agentId: "backend-dev", message: "Implementing JWT authentication with refresh tokens" },
      { delay: 4500, agentId: "security-architect", status: "done" as const, message: "Security architecture complete" },
      { delay: 5000, step: 1 }, // Move to MEASURE

      // MEASURE phase
      { delay: 5500, agentId: "threat-analyst", status: "working" as const, message: "Running security metrics..." },
      { delay: 6500, agentId: "threat-analyst", message: "Measuring authentication latency and token validation speed" },
      { delay: 7500, agentId: "backend-dev", status: "done" as const, message: "API implementation complete" },
      { delay: 8000, step: 2 }, // Move to ANALYZE

      // ANALYZE phase
      { delay: 8500, agentId: "pen-tester", status: "working" as const, message: "Performing penetration testing..." },
      { delay: 9500, agentId: "pen-tester", message: "Testing for SQL injection, XSS, CSRF vulnerabilities" },
      { delay: 10500, agentId: "threat-analyst", status: "done" as const, message: "Security metrics collected" },
      { delay: 11000, agentId: "frontend-dev", status: "working" as const, message: "Building secure UI components..." },
      { delay: 12000, agentId: "frontend-dev", message: "Implementing login flow with MFA support" },
      { delay: 13000, agentId: "pen-tester", status: "done" as const, message: "No critical vulnerabilities found" },
      { delay: 13500, step: 3 }, // Move to DEPLOY

      // DEPLOY phase
      { delay: 14000, agentId: "frontend-dev", status: "done" as const, message: "UI components ready" },
      { delay: 14500, message: "Generating production-ready code..." },
      { delay: 15500, message: "Running final security checks..." },
      { delay: 16500, message: "Optimizing bundle size and performance..." },
      { delay: 17500, complete: true },
    ];

    timeline.forEach((event) => {
      setTimeout(() => {
        if ("step" in event && event.step !== undefined) {
          setCurrentBmadStep(event.step as BmadStep);
        } else if ("complete" in event) {
          setPhase("complete");
        } else if ("agentId" in event && event.status) {
          setAgentStates((prev) => ({ ...prev, [event.agentId]: event.status }));
        }

        if ("message" in event && event.message) {
          setMessages((prev) => [
            ...prev,
            {
              agentId: "agentId" in event ? (event.agentId as string) : "system",
              message: event.message,
              timestamp: Date.now(),
            },
          ]);
        }
      }, event.delay);
    });
  };

  const handleQuickStart = (description: string) => {
    setUserInput(description);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="border-b border-border/40 glass sticky top-0 z-50"
      >
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-primary glow" />
            <h1 className="text-2xl font-bold text-glow">16s</h1>
            <span className="text-sm text-muted-foreground hidden sm:inline">AI Security Team</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 bg-accent rounded-full animate-pulse-glow" />
              <span className="text-accent hidden sm:inline">System Online</span>
            </div>
          </div>
        </div>
      </motion.nav>

      <main className="container mx-auto px-4 py-12">
        <AnimatePresence mode="wait">
          {phase === "input" && (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-4xl mx-auto"
            >
              {/* Hero section */}
              <div className="text-center mb-12">
                <motion.h2
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 }}
                  className="text-5xl md:text-6xl font-bold mb-4 text-glow"
                >
                  What do you want to build?
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-xl text-muted-foreground"
                >
                  Describe your app. Our AI security team handles the rest.
                </motion.p>
              </div>

              {/* Input section */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mb-8"
              >
                <div className="glass rounded-lg p-1 glow">
                  <textarea
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder={placeholders[placeholderIndex]}
                    className="w-full bg-background/50 text-foreground rounded-md p-6 min-h-[200px] resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted-foreground/50"
                  />
                </div>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={startBuild}
                  disabled={!userInput.trim()}
                  className="w-full mt-4 px-8 py-4 rounded-lg bg-gradient-to-r from-primary to-secondary text-primary-foreground font-semibold text-lg glow disabled:opacity-50 disabled:cursor-not-allowed hover:glow-purple transition-all flex items-center justify-center gap-2 group"
                >
                  <Zap className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                  Deploy with AI
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </motion.button>
              </motion.div>

              {/* Quick start cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {quickStarts.map((item, idx) => (
                  <motion.button
                    key={item.title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 + idx * 0.1 }}
                    whileHover={{ scale: 1.05, y: -4 }}
                    onClick={() => handleQuickStart(item.description)}
                    className="glass rounded-lg p-4 text-left hover:border-primary/50 transition-all group"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Lock className="w-4 h-4 text-primary group-hover:text-glow" />
                      <h3 className="font-semibold">{item.title}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {phase === "building" && (
            <motion.div
              key="building"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              {/* BMAD Progress */}
              <div className="max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                  {bmadPhases.map((bmadPhase, idx) => {
                    const Icon = bmadPhase.icon;
                    const isActive = idx === currentBmadStep;
                    const isPast = idx < currentBmadStep;

                    return (
                      <div key={bmadPhase.key} className="flex items-center flex-1">
                        <motion.div
                          animate={{
                            scale: isActive ? 1.1 : 1,
                            opacity: isActive || isPast ? 1 : 0.5,
                          }}
                          className="flex flex-col items-center gap-2"
                        >
                          <div
                            className={`w-16 h-16 rounded-lg glass flex items-center justify-center ${
                              isActive ? "glow border-2" : isPast ? "border-2" : ""
                            }`}
                            style={{
                              borderColor: isActive || isPast ? bmadPhase.color : "transparent",
                            }}
                          >
                            <Icon
                              className="w-8 h-8"
                              style={{ color: isActive || isPast ? bmadPhase.color : "#64748b" }}
                            />
                          </div>
                          <div className="text-center">
                            <div className="font-bold text-sm" style={{ color: isActive ? bmadPhase.color : "#64748b" }}>
                              {bmadPhase.key}
                            </div>
                            <div className="text-xs text-muted-foreground">{bmadPhase.label}</div>
                          </div>
                        </motion.div>
                        {idx < bmadPhases.length - 1 && (
                          <div className="flex-1 h-0.5 mx-2 bg-border relative">
                            <motion.div
                              initial={{ width: "0%" }}
                              animate={{ width: idx < currentBmadStep ? "100%" : "0%" }}
                              transition={{ duration: 0.5 }}
                              className="absolute h-full bg-primary glow"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Active agents */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                  {Object.entries(agentStates)
                    .filter(([_, status]) => status !== "idle")
                    .map(([agentId, status]) => {
                      const agent = agents[agentId as keyof typeof agents];
                      return (
                        <AgentCard
                          key={agentId}
                          agent={{
                            id: agent.id,
                            name: agent.name,
                            title: agent.title,
                            avatar: agent.avatar,
                            color: agent.color,
                            status,
                          }}
                        />
                      );
                    })}
                </div>

                {/* Message feed */}
                <div className="glass rounded-lg p-6 max-h-[400px] overflow-y-auto">
                  <div className="flex items-center gap-2 mb-4">
                    <Terminal className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold">Activity Feed</h3>
                  </div>
                  <div className="space-y-3 font-mono text-sm">
                    {messages.map((msg, idx) => {
                      const agent = msg.agentId !== "system" ? agents[msg.agentId as keyof typeof agents] : null;
                      return (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-start gap-3"
                        >
                          {agent && (
                            <div
                              className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold shrink-0"
                              style={{ backgroundColor: `${agent.color}20`, color: agent.color }}
                            >
                              {agent.avatar.slice(0, 2)}
                            </div>
                          )}
                          <div className="flex-1">
                            <span className="text-muted-foreground">{msg.message}</span>
                          </div>
                        </motion.div>
                      );
                    })}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center gap-2 text-primary"
                    >
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processing...</span>
                    </motion.div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {phase === "complete" && (
            <motion.div
              key="complete"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              <div className="text-center mb-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", duration: 0.5 }}
                  className="w-20 h-20 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-4 glow-green"
                >
                  <Check className="w-10 h-10 text-accent" />
                </motion.div>
                <h2 className="text-4xl font-bold mb-2 text-glow">Build Complete!</h2>
                <p className="text-muted-foreground">Your secure application is ready to deploy</p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto mb-8">
                <div className="glass rounded-lg p-6 text-center">
                  <FileCode className="w-8 h-8 text-primary mx-auto mb-2" />
                  <div className="text-3xl font-bold text-primary">{mockFiles.length}</div>
                  <div className="text-sm text-muted-foreground">Files Generated</div>
                </div>
                <div className="glass rounded-lg p-6 text-center">
                  <Shield className="w-8 h-8 text-accent mx-auto mb-2" />
                  <div className="text-3xl font-bold text-accent">12</div>
                  <div className="text-sm text-muted-foreground">Security Checks Passed</div>
                </div>
                <div className="glass rounded-lg p-6 text-center">
                  <Lock className="w-8 h-8 text-accent mx-auto mb-2" />
                  <div className="text-3xl font-bold text-accent">0</div>
                  <div className="text-sm text-muted-foreground">Vulnerabilities</div>
                </div>
              </div>

              {/* Output section */}
              <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* File tree */}
                <div className="glass rounded-lg p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <FileCode className="w-5 h-5 text-primary" />
                    Generated Files
                  </h3>
                  <div className="space-y-2 font-mono text-sm">
                    {mockFiles.map((file, idx) => (
                      <motion.div
                        key={file.name}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="flex items-center gap-2 text-muted-foreground hover:text-primary cursor-pointer transition-colors"
                      >
                        <Code className="w-4 h-4" />
                        <span>{file.name}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Code preview */}
                <div className="lg:col-span-2 glass rounded-lg p-6">
                  <h3 className="font-semibold mb-4">Code Preview</h3>
                  <div className="bg-background/50 rounded p-4 font-mono text-sm overflow-x-auto">
                    <pre className="text-muted-foreground">
{`import { verify } from 'jsonwebtoken';
import { NextRequest } from 'next/server';

export async function authMiddleware(req: NextRequest) {
  const token = req.headers.get('authorization')?.split(' ')[1];

  if (!token) {
    return { error: 'Unauthorized', status: 401 };
  }

  try {
    const payload = verify(token, process.env.JWT_SECRET!);
    return { user: payload };
  } catch (error) {
    return { error: 'Invalid token', status: 401 };
  }
}`}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-center gap-4 max-w-4xl mx-auto">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-8 py-3 rounded-lg glass hover:border-primary/50 transition-all flex items-center gap-2"
                >
                  <FileCode className="w-5 h-5" />
                  Download ZIP
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-8 py-3 rounded-lg bg-gradient-to-r from-primary to-secondary text-primary-foreground font-semibold glow flex items-center gap-2"
                >
                  <Rocket className="w-5 h-5" />
                  Deploy to Vercel
                </motion.button>
              </div>

              {/* Start over */}
              <div className="text-center">
                <button
                  onClick={() => {
                    setPhase("input");
                    setUserInput("");
                    setMessages([]);
                    setCurrentBmadStep(0);
                    setAgentStates({
                      "security-architect": "idle",
                      "threat-analyst": "idle",
                      "backend-dev": "idle",
                      "frontend-dev": "idle",
                      "pen-tester": "idle",
                    });
                  }}
                  className="text-primary hover:text-primary/80 transition-colors text-sm"
                >
                  Start a new project
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
