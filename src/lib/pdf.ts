import fs from "fs";
import path from "path";
import { PDFDocument, StandardFonts } from "pdf-lib";

export interface FieldMapping {
  page: number; // 0-indexed page number
  x: number;    // percentage from left
  y: number;    // percentage from top
  width: number;
  height: number;
  fontSize?: number;
}

export interface FormField {
  id: string;
  label: string;
  type: "text" | "date" | "number" | "checkbox" | "signature" | "signer_name" | "signer_email" | "dob" | "age" | "todays_date" | "custom_email";
  required: boolean;
  pdfMapping: FieldMapping;
}

// Generate the finalized signed PDF by overlaying form inputs and signatures onto the template
export async function overlayPdf(
  templatePdfPath: string,
  outputPath: string,
  fields: FormField[],
  formData: Record<string, any>
): Promise<void> {
  if (!fs.existsSync(templatePdfPath)) {
    throw new Error(`Template PDF not found at path: ${templatePdfPath}`);
  }

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Load the template PDF
  const templateBytes = fs.readFileSync(templatePdfPath);
  const pdfDoc = await PDFDocument.load(templateBytes);
  const pages = pdfDoc.getPages();
  
  // Embed Helvetica font for drawing text
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (const field of fields) {
    const val = formData[field.id];
    if (val === undefined || val === null || val === "") {
      continue; // Skip unfilled / hidden conditional fields
    }

    const mapping = field.pdfMapping;
    const pageIndex = mapping.page;
    if (pageIndex < 0 || pageIndex >= pages.length) {
      console.warn(`Skipping field "${field.id}": Page index ${pageIndex} out of bounds.`);
      continue;
    }

    const page = pages[pageIndex];
    const { width: pageWidth, height: pageHeight } = page.getSize();

    // Map screen top-left percentages to PDF bottom-left coordinates
    const drawX = (mapping.x / 100) * pageWidth;
    // Invert Y coordinate because PDF Y goes bottom-up
    const boxHeight = mapping.height || 24;
    const drawY = ((100 - mapping.y) / 100) * pageHeight - boxHeight;

    const fSize = mapping.fontSize || 11;

    if (field.type === "signature") {
      // Signature val is a base64 encoded data URI of PNG image
      if (typeof val === "string" && val.startsWith("data:image/")) {
        try {
          const base64Content = val.split(",")[1];
          const imageBytes = Buffer.from(base64Content, "base64");
          const signatureImage = await pdfDoc.embedPng(imageBytes);

          page.drawImage(signatureImage, {
            x: drawX,
            y: drawY,
            width: mapping.width || 120,
            height: boxHeight,
          });
        } catch (imgErr) {
          console.error(`Failed to embed signature image for field "${field.id}":`, imgErr);
        }
      }
    } else if (field.type === "checkbox") {
      // Draw checkbox marker
      const isChecked = val === true || val === "true" || val === "on";
      if (isChecked) {
        page.drawText("X", {
          x: drawX + 3,
          y: drawY + (boxHeight - (fSize + 2)) / 2 + 1, // center X in checkbox
          size: fSize + 2,
          font,
        });
      }
    } else {
      // Draw normal text
      const textVal = String(val);
      page.drawText(textVal, {
        x: drawX,
        y: drawY + (boxHeight - fSize) / 2, // vertically center text in the box
        size: fSize,
        font,
      });
    }
  }

  // Save the modified PDF to output path
  const signedBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, signedBytes);
}
