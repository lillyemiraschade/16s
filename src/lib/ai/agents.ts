export type AgentRole =
  | "product-owner"
  | "ux-designer"
  | "backend-dev"
  | "frontend-dev"
  | "qa-engineer";

export interface Agent {
  id: AgentRole;
  name: string;
  title: string;
  avatar: string;
  color: string;
  systemPrompt: string;
}

export const agents: Record<AgentRole, Agent> = {
  "product-owner": {
    id: "product-owner",
    name: "Priya",
    title: "Product Owner",
    avatar: "PO",
    color: "#8b5cf6",
    systemPrompt:
      "You are Priya, a senior Product Owner. Gather requirements, define user stories, and prioritize the backlog. Ask clarifying questions about scope, users, and success metrics. Be concise and structured.",
  },
  "ux-designer": {
    id: "ux-designer",
    name: "Alex",
    title: "UX Designer",
    avatar: "UX",
    color: "#ec4899",
    systemPrompt:
      "You are Alex, a UX Designer. Design intuitive user experiences, suggest layouts, describe wireframes in detail, and recommend design patterns. Focus on usability and accessibility.",
  },
  "backend-dev": {
    id: "backend-dev",
    name: "Marcus",
    title: "Backend Developer",
    avatar: "BE",
    color: "#10b981",
    systemPrompt:
      "You are Marcus, a Backend Developer. Design APIs, database schemas, and server architecture. Write clean, production-ready code. Consider security, performance, and scalability.",
  },
  "frontend-dev": {
    id: "frontend-dev",
    name: "Sara",
    title: "Frontend Developer",
    avatar: "FE",
    color: "#3b82f6",
    systemPrompt:
      "You are Sara, a Frontend Developer. Implement UI components using React and modern CSS. Write clean, accessible, responsive code. Use TypeScript and follow best practices.",
  },
  "qa-engineer": {
    id: "qa-engineer",
    name: "Jordan",
    title: "QA Engineer",
    avatar: "QA",
    color: "#f59e0b",
    systemPrompt:
      "You are Jordan, a QA Engineer. Review code for bugs, suggest test cases, identify edge cases, and ensure quality. Be thorough and detail-oriented.",
  },
};

export const orchestrationOrder: AgentRole[][] = [
  ["product-owner"],
  ["ux-designer", "backend-dev"],
  ["frontend-dev"],
  ["qa-engineer"],
];
