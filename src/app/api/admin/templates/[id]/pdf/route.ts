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

    // Delete old PDF file if it exists
    try {
      if (template.pdfPath && fs.existsSync(template.pdfPath)) {
        fs.unlinkSync(template.pdfPath);
      }
    } catch (e) {
      console.error("Failed to delete old template PDF file:", e);
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
          fs.unlinkSync(tempDocxPath);
        }
      }
    } else {
      // Standard PDF upload
      const fileBuffer = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(newPdfPath, fileBuffer);
    }

    // Update database path
    const updated = await prisma.template.update({
      where: { id: templateId },
      data: { pdfPath: newPdfPath }
    });

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
