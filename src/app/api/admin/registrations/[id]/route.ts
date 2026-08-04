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

    const registrationId = params.id;
    const registration = await prisma.signingRegistration.findUnique({
      where: { id: registrationId },
      include: {
        organization: {
          select: { name: true }
        }
      }
    });

    if (!registration) {
      return NextResponse.json({ ok: false, error: "Registration not found." }, { status: 404 });
    }

    const user = session.user as any;
    if (user.role !== "Admin") {
      const isLeader = await prisma.organization.findFirst({
        where: {
          id: registration.organizationId,
          users: { some: { id: user.id } }
        }
      });
      if (!isLeader) {
        return new NextResponse("Forbidden", { status: 403 });
      }
    }

    return NextResponse.json({ ok: true, registration });
  } catch (err: any) {
    console.error("Failed to load registration:", err);
    return NextResponse.json({ ok: false, error: err.message || "Failed to load registration" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const registrationId = params.id;
    const registration = await prisma.signingRegistration.findUnique({ where: { id: registrationId } });
    if (!registration) {
      return NextResponse.json({ ok: false, error: "Registration not found." }, { status: 404 });
    }

    const user = session.user as any;
    if (user.role !== "Admin") {
      const isLeader = await prisma.organization.findFirst({
        where: {
          id: registration.organizationId,
          users: { some: { id: user.id } }
        }
      });
      if (!isLeader) {
        return new NextResponse("Forbidden", { status: 403 });
      }
    }

    const body = await req.json();
    const { title, slug, organizationId, templateIds, pcoSignupId, isArchived } = body;

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (isArchived !== undefined) updateData.isArchived = isArchived;
    if (pcoSignupId !== undefined) updateData.pcoSignupId = pcoSignupId || null;
    if (templateIds !== undefined && Array.isArray(templateIds)) {
      updateData.templateIdsJson = JSON.stringify(templateIds);
    }

    if (organizationId !== undefined) {
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
      const existingRegistration = await prisma.signingRegistration.findFirst({
        where: {
          slug: cleanSlug,
          id: { not: registrationId }
        }
      });

      if (existingTemplate || existingRegistration) {
        return NextResponse.json({ ok: false, error: "This slug is already taken." }, { status: 400 });
      }
      updateData.slug = cleanSlug;
    }

    const updated = await prisma.signingRegistration.update({
      where: { id: registrationId },
      data: updateData
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        email: user.email,
        action: `Updated Signing Registration: ${updated.title} (id: ${registrationId})`,
        ip: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown",
        userAgent: req.headers.get("user-agent") || "unknown"
      }
    });

    return NextResponse.json({ ok: true, registration: updated });
  } catch (err: any) {
    console.error("Failed to update registration:", err);
    return NextResponse.json({ ok: false, error: err.message || "Failed to update registration" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const registrationId = params.id;
    const registration = await prisma.signingRegistration.findUnique({ where: { id: registrationId } });
    if (!registration) {
      return NextResponse.json({ ok: false, error: "Registration not found." }, { status: 404 });
    }

    const user = session.user as any;
    if (user.role !== "Admin") {
      const isLeader = await prisma.organization.findFirst({
        where: {
          id: registration.organizationId,
          users: { some: { id: user.id } }
        }
      });
      if (!isLeader) {
        return new NextResponse("Forbidden", { status: 403 });
      }
    }

    await prisma.signingRegistration.delete({ where: { id: registrationId } });

    // Audit log
    await prisma.auditLog.create({
      data: {
        email: user.email,
        action: `Deleted Signing Registration: ${registration.title} (slug: ${registration.slug})`,
        ip: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown",
        userAgent: req.headers.get("user-agent") || "unknown"
      }
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Failed to delete registration:", err);
    return NextResponse.json({ ok: false, error: err.message || "Failed to delete registration" }, { status: 500 });
  }
}
