import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import fs from "fs";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const templateId = params.id;
    const body = await req.json();
    const { title, emailUser, emailLeader, notificationEmails, saveSharepoint, sharepointFolderId, sharepointFolderName, fieldsJson } = body;

    const template = await prisma.template.findUnique({ where: { id: templateId } });
    if (!template) {
      return NextResponse.json({ ok: false, error: "Template not found." }, { status: 404 });
    }

    // Verify orgleader permissions
    const user = session.user as any;
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

    // Update settings or fieldsJson
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (emailUser !== undefined) updateData.emailUser = emailUser;
    if (emailLeader !== undefined) updateData.emailLeader = emailLeader;
    if (notificationEmails !== undefined) updateData.notificationEmails = notificationEmails;
    if (saveSharepoint !== undefined) updateData.saveSharepoint = saveSharepoint;
    if (sharepointFolderId !== undefined) updateData.sharepointFolderId = sharepointFolderId;
    if (sharepointFolderName !== undefined) updateData.sharepointFolderName = sharepointFolderName;
    if (fieldsJson !== undefined) updateData.fieldsJson = fieldsJson;

    const updated = await prisma.template.update({
      where: { id: templateId },
      data: updateData,
    });

    return NextResponse.json({ ok: true, template: updated });
  } catch (e: any) {
    console.error("Failed to patch template:", e);
    return NextResponse.json({ ok: false, error: e.message || "Failed to update template" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const templateId = params.id;
    const template = await prisma.template.findUnique({ where: { id: templateId } });
    if (!template) {
      return NextResponse.json({ ok: false, error: "Template not found." }, { status: 404 });
    }

    // Validate delete permission
    const user = session.user as any;
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

    // Delete local PDF template file
    try {
      if (fs.existsSync(template.pdfPath)) {
        fs.unlinkSync(template.pdfPath);
      }
    } catch (fsErr) {
      console.error("Failed to delete local template PDF file:", fsErr);
    }

    // Delete from DB (will cascade or fail if references exist; let's delete doc links or let prisma catch it)
    await prisma.signedDocument.deleteMany({ where: { templateId } });
    await prisma.template.delete({ where: { id: templateId } });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Failed to delete template:", e);
    return NextResponse.json({ ok: false, error: e.message || "Failed to delete template" }, { status: 500 });
  }
}
