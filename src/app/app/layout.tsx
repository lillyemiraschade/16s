import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "16s — Dashboard",
};

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
