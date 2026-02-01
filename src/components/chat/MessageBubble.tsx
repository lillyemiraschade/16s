import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  message: {
    role: "user" | "assistant";
    content: string;
    agent?: string;
  };
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "flex flex-col gap-1",
        isUser ? "items-end" : "items-start"
      )}
    >
      {message.agent && (
        <span className="text-xs text-muted-foreground px-2">
          {message.agent}
        </span>
      )}

      <div
        className={cn(
          "max-w-[80%] rounded-lg px-4 py-3 break-words",
          isUser
            ? "bg-purple-600 text-white"
            : "bg-card border border-border text-foreground"
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>
    </motion.div>
  );
}
