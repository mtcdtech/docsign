import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import path from "path";
import fs from "fs";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const data = await req.formData();
    const title = data.get("title") as string;
    const slug = data.get("slug") as string;
    const organizationId = data.get("organizationId") as string;
    const emailUser = data.get("emailUser") === "true";
    const emailLeader = data.get("emailLeader") === "true";
    const saveSharepoint = data.get("saveSharepoint") === "true";
    const sharepointFolderId = data.get("sharepointFolderId") as string | null;
    const sharepointFolderName = data.get("sharepointFolderName") as string | null;
    const file = data.get("file") as File | null;

    if (!title || !slug || !organizationId) {
      return NextResponse.json({ ok: false, error: "Missing required fields." }, { status: 400 });
    }

    const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");

    // Verify slug uniqueness
    const existing = await prisma.template.findUnique({ where: { slug: cleanSlug } });
    if (existing) {
      return NextResponse.json({ ok: false, error: "This public link slug is already in use." }, { status: 400 });
    }

    if (!file) {
      return NextResponse.json({ ok: false, error: "Missing template file upload." }, { status: 400 });
    }

    const tplId = `tpl_${Date.now()}`;
    const templatesDir = path.join(process.cwd(), "public", "uploads", "templates");
    if (!fs.existsSync(templatesDir)) {
      fs.mkdirSync(templatesDir, { recursive: true });
    }

    const templatePdfPath = path.join(templatesDir, `${tplId}.pdf`);
    const originalExt = path.extname(file.name).toLowerCase();

    if (originalExt === ".docx" || originalExt === ".doc") {
      const tempDocxPath = path.join(templatesDir, `${tplId}${originalExt}`);
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
      fs.writeFileSync(templatePdfPath, fileBuffer);
    }

    // Initial empty fields array mapping
    const initialFieldsJson = JSON.stringify([]);

    const newTemplate = await prisma.template.create({
      data: {
        id: tplId,
        title,
        slug: cleanSlug,
        pdfPath: templatePdfPath,
        fieldsJson: initialFieldsJson,
        emailUser,
        emailLeader,
        saveSharepoint,
        sharepointFolderId,
        sharepointFolderName,
        organizationId,
      },
    });

    return NextResponse.json({ ok: true, templateId: newTemplate.id });
  } catch (e: any) {
    console.error("Failed to create template:", e);
    return NextResponse.json({ ok: false, error: e.message || "Failed to create template" }, { status: 500 });
  }
}
