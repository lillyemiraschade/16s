import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.string().optional(),
  audience: z.string().optional(),
  techStack: z.string().optional(),
});

// Demo user ID for the no-auth version
const DEMO_USER_ID = "demo-user";

export async function GET() {
  const projects = await prisma.project.findMany({
    where: { userId: DEMO_USER_ID },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(projects);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data = createSchema.parse(body);

    const project = await prisma.project.create({
      data: { ...data, userId: DEMO_USER_ID },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
