import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import fs from "fs";

function deleteLocalFile(filePath: string) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error("Failed to delete local signed PDF file:", err);
  }
}

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

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    const user = session.user as any;

    const url = new URL(req.url);
    const templateId = url.searchParams.get("templateId");
    const submissionId = url.searchParams.get("submissionId");

    if (!templateId && !submissionId) {
      return NextResponse.json({ error: "Missing templateId or submissionId" }, { status: 400 });
    }

    if (submissionId) {
      const doc = await prisma.signedDocument.findUnique({
        where: { id: submissionId },
        include: { template: true }
      });
      if (!doc) {
        return NextResponse.json({ error: "Submission not found" }, { status: 404 });
      }

      // Validate permissions
      if (user.role !== "Admin") {
        const isLeader = await prisma.organization.findFirst({
          where: {
            id: doc.template.organizationId,
            users: { some: { id: user.id } }
          }
        });
        if (!isLeader) {
          return new NextResponse("Forbidden", { status: 403 });
        }
      }

      // Delete file and db row
      deleteLocalFile(doc.signedPdfPath);
      await prisma.signedDocument.delete({ where: { id: submissionId } });
      return NextResponse.json({ ok: true });
    } else {
      // Clear all for templateId
      const template = await prisma.template.findUnique({
        where: { id: templateId! }
      });
      if (!template) {
        return NextResponse.json({ error: "Template not found" }, { status: 404 });
      }

      // Validate permissions
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

      // Find all submissions to delete files
      const docs = await prisma.signedDocument.findMany({
        where: { templateId: templateId! }
      });
      for (const d of docs) {
        deleteLocalFile(d.signedPdfPath);
      }

      await prisma.signedDocument.deleteMany({
        where: { templateId: templateId! }
      });
      return NextResponse.json({ ok: true });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
