import { NextResponse } from "next/server";
import JSZip from "jszip";
import { prisma } from "@/lib/db";

// Demo user ID for the no-auth version
const DEMO_USER_ID = "demo-user";

export async function POST(req: Request) {
  try {
    const { projectId } = await req.json();

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: DEMO_USER_ID },
      include: { codeFiles: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const zip = new JSZip();
    for (const file of project.codeFiles) {
      zip.file(file.path, file.content);
    }

    const buffer = await zip.generateAsync({ type: "blob" });

    return new Response(buffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${project.name}.zip"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
