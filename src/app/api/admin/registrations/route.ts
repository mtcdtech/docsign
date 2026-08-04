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
    let registrations;

    if (user.role === "Admin") {
      registrations = await prisma.signingRegistration.findMany({
        include: {
          organization: {
            select: { name: true }
          }
        },
        orderBy: { createdAt: "desc" }
      });
    } else {
      // OrgLeader can only view registrations in their organizations
      registrations = await prisma.signingRegistration.findMany({
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

    return NextResponse.json({ ok: true, registrations });
  } catch (err: any) {
    console.error("Failed to load registrations:", err);
    return NextResponse.json({ ok: false, error: err.message || "Failed to load registrations" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const { title, slug, organizationId, templateIds, pcoSignupId } = body;

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

    // Verify slug uniqueness across templates AND registrations!
    const existingTemplate = await prisma.template.findUnique({ where: { slug: cleanSlug } });
    const existingRegistration = await prisma.signingRegistration.findUnique({ where: { slug: cleanSlug } });
    if (existingTemplate || existingRegistration) {
      return NextResponse.json({ ok: false, error: "This slug is already in use by another template or registration." }, { status: 400 });
    }

    const registration = await prisma.signingRegistration.create({
      data: {
        title,
        slug: cleanSlug,
        organizationId,
        templateIdsJson: JSON.stringify(templateIds),
        pcoSignupId: pcoSignupId || null
      }
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        email: user.email,
        action: `Created Signing Registration: ${title} (slug: ${cleanSlug})`,
        ip: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown",
        userAgent: req.headers.get("user-agent") || "unknown"
      }
    });

    return NextResponse.json({ ok: true, registration });
  } catch (err: any) {
    console.error("Failed to create registration:", err);
    return NextResponse.json({ ok: false, error: err.message || "Failed to create registration" }, { status: 500 });
  }
}
