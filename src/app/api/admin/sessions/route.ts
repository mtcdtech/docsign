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
    let sessions;

    if (user.role === "Admin") {
      sessions = await prisma.signingSession.findMany({
        include: {
          organization: {
            select: { name: true }
          }
        },
        orderBy: { createdAt: "desc" }
      });
    } else {
      // OrgLeader can only view sessions in their organizations
      sessions = await prisma.signingSession.findMany({
        where: {
          organization: {
            users: { some: { id: user.id } }
          }
        },
        include: {
          organization: {
            select: { name: true }
          }
        },
        orderBy: { createdAt: "desc" }
      });
    }

    return NextResponse.json({ ok: true, sessions });
  } catch (err: any) {
    console.error("Failed to load sessions:", err);
    return NextResponse.json({ ok: false, error: err.message || "Failed to load sessions" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const { title, slug, organizationId, templateIds } = body;

    if (!title || !slug || !organizationId || !templateIds || !Array.isArray(templateIds)) {
      return NextResponse.json({ ok: false, error: "Missing required fields." }, { status: 400 });
    }

    const user = session.user as any;
    if (user.role !== "Admin") {
      const isLeader = await prisma.organization.findFirst({
        where: {
          id: organizationId,
          users: { some: { id: user.id } }
        }
      });
      if (!isLeader) {
        return new NextResponse("Forbidden", { status: 403 });
      }
    }

    const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "");

    // Verify slug uniqueness across templates AND sessions!
    const existingTemplate = await prisma.template.findUnique({ where: { slug: cleanSlug } });
    const existingSession = await prisma.signingSession.findUnique({ where: { slug: cleanSlug } });
    if (existingTemplate || existingSession) {
      return NextResponse.json({ ok: false, error: "This slug is already in use by another template or session." }, { status: 400 });
    }

    const signingSession = await prisma.signingSession.create({
      data: {
        title,
        slug: cleanSlug,
        organizationId,
        templateIdsJson: JSON.stringify(templateIds)
      }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        email: user.email,
        action: `Created Signing Session: ${title} (slug: ${cleanSlug})`,
        ip: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown",
        userAgent: req.headers.get("user-agent") || "unknown"
      }
    });

    return NextResponse.json({ ok: true, session: signingSession });
  } catch (err: any) {
    console.error("Failed to create session:", err);
    return NextResponse.json({ ok: false, error: err.message || "Failed to create session" }, { status: 500 });
  }
}
