import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import path from "path";
import fs from "fs";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    const user = session.user as any;
    const templateId = params.id;

    const template = await prisma.template.findUnique({
      where: { id: templateId }
    });

    if (!template) {
      return NextResponse.json({ ok: false, error: "Template not found." }, { status: 404 });
    }

    // Verify template creation permissions for non-Admin users (OrgLeaders must belong to target org)
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

    const data = await req.formData();
    const file = data.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ ok: false, error: "Missing file upload." }, { status: 400 });
    }

    const templatesDir = path.join(process.cwd(), "public", "uploads", "templates");
    if (!fs.existsSync(templatesDir)) {
      fs.mkdirSync(templatesDir, { recursive: true });
    }

    // Generate new unique filename to prevent browser caching issues
    const newFileId = `${templateId}_${Date.now()}`;
    const newPdfPath = path.join(templatesDir, `${newFileId}.pdf`);
    const originalExt = path.extname(file.name).toLowerCase();

    if (originalExt === ".docx" || originalExt === ".doc") {
      const tempDocxPath = path.join(templatesDir, `${newFileId}${originalExt}`);
      const fileBuffer = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(tempDocxPath, fileBuffer);

      try {
        const { execSync } = require("child_process");
        // Convert to PDF using headless LibreOffice command line
        execSync(`libreoffice --headless --convert-to pdf --outdir "${templatesDir}" "${tempDocxPath}"`, {
          stdio: "ignore",
          timeout: 30000 // 30 seconds max timeout
        });
      } catch (err: any) {
        console.error("LibreOffice conversion failed:", err);
        return NextResponse.json({
          ok: false,
          error: "Failed to convert Word document to PDF. Ensure LibreOffice is installed on the host."
        }, { status: 500 });
      } finally {
        // Remove temporary DOCX/DOC file
        if (fs.existsSync(tempDocxPath)) {
          try { fs.unlinkSync(tempDocxPath); } catch (e) {}
        }
      }
    } else {
      // Standard PDF upload
      const fileBuffer = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(newPdfPath, fileBuffer);
    }

    // Verify new PDF file was written successfully and is non-empty
    if (!fs.existsSync(newPdfPath) || fs.statSync(newPdfPath).size === 0) {
      return NextResponse.json({ ok: false, error: "Uploaded PDF file is invalid or empty." }, { status: 400 });
    }

    // Capture old PDF path before updating
    const oldPdfPath = template.pdfPath;

    // Transactionally update template PDF path AND mark previous signed documents as nullified
    await prisma.$transaction([
      prisma.template.update({
        where: { id: templateId },
        data: { pdfPath: newPdfPath }
      }),
      prisma.signedDocument.updateMany({
        where: { templateId, isDraft: false },
        data: { nullified: true }
      })
    ]);

    // Delete old PDF file ONLY AFTER database update and file creation have succeeded
    if (oldPdfPath && oldPdfPath !== newPdfPath && fs.existsSync(oldPdfPath)) {
      try {
        fs.unlinkSync(oldPdfPath);
      } catch (e) {
        console.error("Failed to delete old template PDF file:", e);
      }
    }

    // Write audit log
    try {
      await prisma.auditLog.create({
        data: {
          email: user.email.toLowerCase(),
          action: `Updated PDF file for template: "${template.title}"`,
        }
      });
    } catch (auditErr) {
      console.error("Failed to write template update PDF audit log:", auditErr);
    }

    const filename = path.basename(newPdfPath);
    const pdfUrl = `/api/download/templates/${filename}`;

    return NextResponse.json({ ok: true, pdfUrl });
  } catch (e: any) {
    console.error("Failed to update template PDF:", e);
    return NextResponse.json({ ok: false, error: e.message || "Failed to update template PDF" }, { status: 500 });
  }
}
