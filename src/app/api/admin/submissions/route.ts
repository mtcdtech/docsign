import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    const user = session.user as any;

    const url = new URL(req.url);
    const templateId = url.searchParams.get("templateId");

    if (!templateId) {
      return NextResponse.json({ error: "Missing templateId" }, { status: 400 });
    }

    // Load template to verify permissions
    const template = await prisma.template.findUnique({
      where: { id: templateId }
    });

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // Validate OrgLeader permissions
    if (user.role !== "Admin") {
      const isLeader = await prisma.organization.findFirst({
        where: {
          id: template.organizationId,
          users: { some: { id: user.id } }
        }
      });
      if (!isLeader) {
        return new NextResponse("Forbidden", { status: 403 });
      }
    }

    const submissions = await prisma.signedDocument.findMany({
      where: { templateId },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({ ok: true, submissions });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
