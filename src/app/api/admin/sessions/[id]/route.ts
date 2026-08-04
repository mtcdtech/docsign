import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const sessionId = params.id;
    const signingSession = await prisma.signingSession.findUnique({
      where: { id: sessionId },
      include: {
        organization: {
          select: { name: true }
        }
      }
    });

    if (!signingSession) {
      return NextResponse.json({ ok: false, error: "Session not found." }, { status: 404 });
    }

    const user = session.user as any;
    if (user.role !== "Admin") {
      const isLeader = await prisma.organization.findFirst({
        where: {
          id: signingSession.organizationId,
          users: { some: { id: user.id } }
        }
      });
      if (!isLeader) {
        return new NextResponse("Forbidden", { status: 403 });
      }
    }

    return NextResponse.json({ ok: true, session: signingSession });
  } catch (err: any) {
    console.error("Failed to load session:", err);
    return NextResponse.json({ ok: false, error: err.message || "Failed to load session" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const sessionId = params.id;
    const signingSession = await prisma.signingSession.findUnique({ where: { id: sessionId } });
    if (!signingSession) {
      return NextResponse.json({ ok: false, error: "Session not found." }, { status: 404 });
    }

    const user = session.user as any;
    if (user.role !== "Admin") {
      const isLeader = await prisma.organization.findFirst({
        where: {
          id: signingSession.organizationId,
          users: { some: { id: user.id } }
        }
      });
      if (!isLeader) {
        return new NextResponse("Forbidden", { status: 403 });
      }
    }

    const body = await req.json();
    const { title, slug, organizationId, templateIds, isArchived } = body;

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (isArchived !== undefined) updateData.isArchived = isArchived;
    if (templateIds !== undefined && Array.isArray(templateIds)) {
      updateData.templateIdsJson = JSON.stringify(templateIds);
    }

    if (organizationId !== undefined) {
      // If changing organization, check user belongs to target org
      if (user.role !== "Admin") {
        const isLeaderTarget = await prisma.organization.findFirst({
          where: {
            id: organizationId,
            users: { some: { id: user.id } }
          }
        });
        if (!isLeaderTarget) {
          return new NextResponse("Forbidden target organization change", { status: 403 });
        }
      }
      updateData.organizationId = organizationId;
    }

    if (slug !== undefined) {
      const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "");
      // Check slug uniqueness
      const existingTemplate = await prisma.template.findUnique({ where: { slug: cleanSlug } });
      const existingSession = await prisma.signingSession.findFirst({
        where: {
          slug: cleanSlug,
          id: { not: sessionId }
        }
      });

      if (existingTemplate || existingSession) {
        return NextResponse.json({ ok: false, error: "This slug is already taken." }, { status: 400 });
      }
      updateData.slug = cleanSlug;
    }

    const updated = await prisma.signingSession.update({
      where: { id: sessionId },
      data: updateData
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        email: user.email,
        action: `Updated Signing Session: ${updated.title} (id: ${sessionId})`,
        ip: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown",
        userAgent: req.headers.get("user-agent") || "unknown"
      }
    });

    return NextResponse.json({ ok: true, session: updated });
  } catch (err: any) {
    console.error("Failed to update session:", err);
    return NextResponse.json({ ok: false, error: err.message || "Failed to update session" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const sessionId = params.id;
    const signingSession = await prisma.signingSession.findUnique({ where: { id: sessionId } });
    if (!signingSession) {
      return NextResponse.json({ ok: false, error: "Session not found." }, { status: 404 });
    }

    const user = session.user as any;
    if (user.role !== "Admin") {
      const isLeader = await prisma.organization.findFirst({
        where: {
          id: signingSession.organizationId,
          users: { some: { id: user.id } }
        }
      });
      if (!isLeader) {
        return new NextResponse("Forbidden", { status: 403 });
      }
    }

    await prisma.signingSession.delete({ where: { id: sessionId } });

    // Audit log
    await prisma.auditLog.create({
      data: {
        email: user.email,
        action: `Deleted Signing Session: ${signingSession.title} (slug: ${signingSession.slug})`,
        ip: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown",
        userAgent: req.headers.get("user-agent") || "unknown"
      }
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Failed to delete session:", err);
    return NextResponse.json({ ok: false, error: err.message || "Failed to delete session" }, { status: 500 });
  }
}
