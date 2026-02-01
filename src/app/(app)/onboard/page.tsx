"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe,
  Smartphone,
  Server,
  Terminal,
  ArrowRight,
  ArrowLeft,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";

const projectTypes = [
  { id: "web", name: "Web App", icon: Globe, description: "Full-stack web application" },
  { id: "mobile", name: "Mobile App", icon: Smartphone, description: "iOS and Android app" },
  { id: "api", name: "API", icon: Server, description: "RESTful or GraphQL API" },
  { id: "cli", name: "CLI Tool", icon: Terminal, description: "Command-line interface" },
];

const techStack = [
  { id: "react", name: "React" },
  { id: "nextjs", name: "Next.js" },
  { id: "node", name: "Node.js" },
  { id: "python", name: "Python" },
  { id: "typescript", name: "TypeScript" },
  { id: "tailwind", name: "Tailwind CSS" },
  { id: "postgres", name: "PostgreSQL" },
  { id: "mongodb", name: "MongoDB" },
];

export default function OnboardPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    type: "",
    description: "",
    audience: "",
    tech: [] as string[],
  });

  const handleNext = () => {
    if (step < 4) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleCreate = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const data = await response.json();
        router.push(`/project/${data.id}`);
      } else {
        alert("Failed to create project");
      }
    } catch (error) {
      console.error("Create project error:", error);
      alert("An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTech = (techId: string) => {
    setFormData((prev) => ({
      ...prev,
      tech: prev.tech.includes(techId)
        ? prev.tech.filter((t) => t !== techId)
        : [...prev.tech, techId],
    }));
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return formData.type !== "";
      case 2:
        return formData.description.trim() !== "";
      case 3:
        return formData.audience.trim() !== "";
      case 4:
        return formData.tech.length > 0;
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-2">Create New Project</h1>
          <p className="text-muted-foreground">
            Tell us about your project and we'll assemble your AI team
          </p>
        </div>

        <div className="flex items-center justify-center mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center">
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors",
                  step >= i
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {step > i ? <Check className="w-5 h-5" /> : i}
              </div>
              {i < 4 && (
                <div
                  className={cn(
                    "w-16 h-1 mx-2 transition-colors",
                    step > i ? "bg-primary" : "bg-muted"
                  )}
                />
              )}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="bg-card border border-border rounded-lg p-8 mb-6"
          >
            {step === 1 && (
              <div>
                <h2 className="text-2xl font-semibold mb-2">
                  What type of project?
                </h2>
                <p className="text-muted-foreground mb-6">
                  Choose the type that best fits your vision
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {projectTypes.map((type) => {
                    const Icon = type.icon;
                    return (
                      <button
                        key={type.id}
                        onClick={() =>
                          setFormData({ ...formData, type: type.id })
                        }
                        className={cn(
                          "p-6 border-2 rounded-lg text-left transition-all hover:border-primary",
                          formData.type === type.id
                            ? "border-primary bg-primary/5"
                            : "border-border"
                        )}
                      >
                        <Icon className="w-8 h-8 text-primary mb-3" />
                        <h3 className="font-semibold mb-1">{type.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {type.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <h2 className="text-2xl font-semibold mb-2">
                  Describe your project
                </h2>
                <p className="text-muted-foreground mb-6">
                  What do you want to build? Be as detailed as you'd like.
                </p>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="I want to build a platform that allows users to..."
                  rows={8}
                  className="w-full p-4 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>
            )}

            {step === 3 && (
              <div>
                <h2 className="text-2xl font-semibold mb-2">
                  Who is your target audience?
                </h2>
                <p className="text-muted-foreground mb-6">
                  Understanding your users helps us make better decisions
                </p>
                <input
                  type="text"
                  value={formData.audience}
                  onChange={(e) =>
                    setFormData({ ...formData, audience: e.target.value })
                  }
                  placeholder="e.g., Small business owners, developers, students..."
                  className="w-full p-4 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            )}

            {step === 4 && (
              <div>
                <h2 className="text-2xl font-semibold mb-2">
                  Tech preferences
                </h2>
                <p className="text-muted-foreground mb-6">
                  Select the technologies you'd like us to use (optional)
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {techStack.map((tech) => (
                    <button
                      key={tech.id}
                      onClick={() => toggleTech(tech.id)}
                      className={cn(
                        "p-4 border-2 rounded-lg font-medium transition-all hover:border-primary",
                        formData.tech.includes(tech.id)
                          ? "border-primary bg-primary/5"
                          : "border-border"
                      )}
                    >
                      {tech.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center justify-between">
          <button
            onClick={handleBack}
            disabled={step === 1}
            className="flex items-center gap-2 px-6 py-3 border border-border rounded-lg hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          {step < 4 ? (
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={!canProceed() || isLoading}
              className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Creating..." : "Create Project"}
              <Check className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
