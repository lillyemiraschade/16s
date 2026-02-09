import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

interface SharePageProps {
  params: Promise<{ slug: string }>;
}

async function getProject(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select("name, public_preview")
    .eq("public_slug", slug)
    .eq("is_public", true)
    .single();
  return data;
}

export async function generateMetadata({ params }: SharePageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = await getProject(slug);
  if (!project) {
    return { title: "Project not found — 16s" };
  }
  return {
    title: `${project.name} — Built with 16s`,
    description: "Check out this website built with 16s AI Web Designer",
    openGraph: {
      title: `${project.name} — Built with 16s`,
      description: "Check out this website built with 16s AI Web Designer",
    },
  };
}

export default async function SharePage({ params }: SharePageProps) {
  const { slug } = await params;
  const project = await getProject(slug);

  if (!project || !project.public_preview) {
    notFound();
  }

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0b]">
      <header className="h-10 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-4 flex-shrink-0">
        <span className="text-zinc-400 text-xs">
          Built with{" "}
          <a href="/app" className="text-green-400 hover:underline font-medium">
            16s
          </a>
        </span>
        <div className="flex items-center gap-3">
          <a href="/privacy" className="text-[9px] text-zinc-600 hover:text-zinc-400 transition-colors">Privacy</a>
          <span className="text-[9px] text-zinc-700">&middot;</span>
          <a href="/terms" className="text-[9px] text-zinc-600 hover:text-zinc-400 transition-colors">Terms</a>
          <a
            href="/app"
            className="text-xs text-green-400 hover:text-green-300 hover:underline transition-colors ml-2"
          >
            Build your own &rarr;
          </a>
        </div>
      </header>
      <iframe
        srcDoc={project.public_preview}
        className="flex-1 w-full border-0"
        sandbox="allow-scripts allow-popups"
        title={project.name}
      />
    </div>
  );
}
