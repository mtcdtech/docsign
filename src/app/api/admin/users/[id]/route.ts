import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "Admin") {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const { role, roleOverride } = await req.json();

    const updateData: any = {};
    if (role !== undefined) updateData.role = role;
    if (roleOverride !== undefined) updateData.roleOverride = roleOverride;

    const user = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json({ ok: true, user });
  } catch (e: any) {
    console.error("Failed to update user manual override:", e);
    return NextResponse.json(
      { ok: false, error: e.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    // Support delete permission based on either original role or current role
    const originalRole = (session?.user as any)?.originalRole || (session?.user as any)?.role;
    if (originalRole !== "Admin") {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // Do not delete currently logged-in user (checked via originalId)
    const originalId = (session?.user as any)?.originalId || (session?.user as any)?.id;
    if (originalId === params.id) {
      return NextResponse.json({ ok: false, error: "Cannot delete yourself." }, { status: 400 });
    }

    await prisma.user.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Failed to delete user:", e);
    return NextResponse.json(
      { ok: false, error: e.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
