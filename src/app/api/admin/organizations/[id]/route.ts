import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Only global admins can edit organization configuration profiles
    const user = session.user as any;
    if (user.role !== "Admin") {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const orgId = params.id;
    const body = await req.json();
    const { logoLight, logoDark } = body;

    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) {
      return NextResponse.json({ ok: false, error: "Organization not found." }, { status: 404 });
    }

    const updateData: any = {};
    if (logoLight !== undefined) updateData.logoLight = logoLight;
    if (logoDark !== undefined) updateData.logoDark = logoDark;

    const updated = await prisma.organization.update({
      where: { id: orgId },
      data: updateData
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        email: user.email,
        action: `Updated Organization Logos: ${updated.name} (id: ${orgId})`,
        ip: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown",
        userAgent: req.headers.get("user-agent") || "unknown"
      }
    });

    return NextResponse.json({ ok: true, organization: updated });
  } catch (err: any) {
    console.error("Failed to update organization:", err);
    return NextResponse.json({ ok: false, error: err.message || "Failed to update organization" }, { status: 500 });
  }
}
