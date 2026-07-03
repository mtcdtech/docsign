import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";

export async function GET(
  _req: Request,
  { params }: { params: { type: string; filename: string } }
) {
  try {
    const { type, filename } = params;

    // Validate type parameter
    if (type !== "templates" && type !== "signed") {
      return new NextResponse("Invalid download type", { status: 400 });
    }

    // Prevent directory traversal
    if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
      return new NextResponse("Invalid file path", { status: 400 });
    }

    const filePath = path.join(process.cwd(), "public", "uploads", type, filename);
    if (!fs.existsSync(filePath)) {
      return new NextResponse("File not found", { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`
      }
    });
  } catch (err: any) {
    return new NextResponse(err.message || "Internal Server Error", { status: 500 });
  }
}
