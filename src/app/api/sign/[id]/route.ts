import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { overlayPdf } from "@/lib/pdf";
import { sendEmail } from "@/lib/mail";
import { getMsGraphToken, uploadFileToSharepoint } from "@/lib/sharepoint";
import path from "path";
import fs from "fs";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const templateId = params.id;
    const { signerName, signerEmail, formData } = await req.json();

    if (!signerName || !signerEmail || !formData) {
      return NextResponse.json({ error: "Missing required submission fields." }, { status: 400 });
    }

    const template = await prisma.template.findUnique({
      where: { id: templateId },
      include: {
        organization: {
          include: {
            users: true
          }
        }
      }
    });

    if (!template) {
      return NextResponse.json({ error: "Template not found." }, { status: 404 });
    }

    // Generate output file names and paths
    const cleanSignerName = signerName.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const documentId = `${template.slug}_${cleanSignerName}_${Date.now()}`;
    const outputFilename = `${documentId}.pdf`;
    
    // Paths within public/uploads for local storage and retrieval
    const uploadsDir = path.join(process.cwd(), "public", "uploads", "signed");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const outputPath = path.join(uploadsDir, outputFilename);

    // 1. Overlay inputs and signature drawings onto the PDF template
    const fields = JSON.parse(template.fieldsJson);
    await overlayPdf(template.pdfPath, outputPath, fields, formData);

    const relativePdfUrl = `/api/download/signed/${outputFilename}`;

    // 2. Perform SharePoint Upload if configured
    let sharepointUrl: string | null = null;
    let uploadSuccess = false;

    if (template.saveSharepoint) {
      if (template.sharepointFolderId && template.sharepointFolderId.trim() !== "") {
        try {
          const token = await getMsGraphToken();
          const driveId = template.sharepointFolderId.split("/")[0] || "root";
          const folderId = template.sharepointFolderId.split("/")[1] || "root";
          
          sharepointUrl = await uploadFileToSharepoint(
            token,
            driveId,
            folderId,
            outputPath,
            outputFilename
          );
          uploadSuccess = true;
        } catch (spErr) {
          console.error("Failed to upload document to SharePoint during sign callback:", spErr);
        }
      } else {
        console.warn("SharePoint upload skipped: saveSharepoint is enabled but sharepointFolderId is empty or not configured.");
      }
    }

    // 3. Save the Signed Document to Database
    const signedDoc = await prisma.signedDocument.create({
      data: {
        templateId: template.id,
        signerName,
        signerEmail,
        formDataJson: JSON.stringify(formData),
        signedPdfPath: outputPath,
        sharepointUrl: sharepointUrl,
      }
    });

    // 4. Trigger Email Dispatches
    let emailedUser = false;
    let emailedLeader = false;

    // Email to signer
    if (template.emailUser) {
      try {
        const htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; color: #333; line-height: 1.6;">
            <h2>Signed Document Confirmation</h2>
            <p>Dear ${signerName},</p>
            <p>Thank you for signing the document: <strong>${template.title}</strong>.</p>
            <p>A copy of your signed document has been attached to this email for your records.</p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;" />
            <p style="font-size: 12px; color: #777;">This is an automated notification from DocSign.</p>
          </div>
        `;
        
        // Send email to signer
        await sendEmail({
          to: signerEmail,
          subject: `Signed Document: ${template.title}`,
          html: htmlContent,
          attachmentPath: outputPath,
          attachmentName: `${template.title}_Signed.pdf`
        });

        // Collect and email any custom_email fields (e.g. parent_email)
        const customEmails: string[] = [];
        try {
          const parsedFields = JSON.parse(template.fieldsJson) || [];
          parsedFields.forEach((f: any) => {
            if (f.type === "custom_email" && formData[f.id]) {
              const emailVal = String(formData[f.id]).trim();
              if (emailVal && emailVal.includes("@") && !customEmails.includes(emailVal)) {
                customEmails.push(emailVal);
              }
            }
          });
        } catch (parseErr) {
          console.error("Failed to parse template fields to check for custom email variables:", parseErr);
        }

        for (const email of customEmails) {
          try {
            await sendEmail({
              to: email,
              subject: `Signed Document Copy: ${template.title}`,
              html: htmlContent,
              attachmentPath: outputPath,
              attachmentName: `${template.title}_Signed.pdf`
            });
          } catch (customEmailErr) {
            console.error(`Failed to send custom copy email to ${email}:`, customEmailErr);
          }
        }

        emailedUser = true;
      } catch (mailErr) {
        console.error(`Failed to send confirmation email to signer ${signerEmail}:`, mailErr);
      }
    }

    // Email to organization leaders or custom lists
    if (template.emailLeader) {
      try {
        let recipientEmails: string[] = [];
        if (template.notificationEmails) {
          recipientEmails = template.notificationEmails.split(",").map(e => e.trim()).filter(Boolean);
        } else {
          // Fall back to default org leaders
          const leaders = template.organization.users.filter(u => u.role === "OrgLeader" || u.role === "Admin");
          recipientEmails = leaders.map(l => l.email).filter(Boolean);
        }

        if (recipientEmails.length > 0) {
          const htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; color: #333; line-height: 1.6;">
              <h2>New Signed Document Received</h2>
              <p>Hello,</p>
              <p>A new document has been signed for your organization: <strong>${template.title}</strong>.</p>
              <p><strong>Signer Name:</strong> ${signerName}<br/>
                 <strong>Signer Email:</strong> ${signerEmail}</p>
              <p>The finalized signed document is attached to this email.</p>
              ${sharepointUrl ? `<p>The file was also uploaded to SharePoint: <a href="${sharepointUrl}">${sharepointUrl}</a></p>` : ""}
            </div>
          `;
          for (const email of recipientEmails) {
            try {
              await sendEmail({
                to: email,
                subject: `New Signature: ${template.title} - ${signerName}`,
                html: htmlContent,
                attachmentPath: outputPath,
                attachmentName: `${template.title}_${cleanSignerName}.pdf`
              });
            } catch (mailErr) {
              console.error(`Failed to send notification email to leader ${email}:`, mailErr);
            }
          }
          emailedLeader = true;
        }
      } catch (mailErr) {
        console.error("Failed to send notification email to leaders:", mailErr);
      }
    }

    // Update email status flags in DB
    await prisma.signedDocument.update({
      where: { id: signedDoc.id },
      data: {
        emailedUser,
        emailedLeader,
      }
    });

    return NextResponse.json({
      ok: true,
      signedDocumentId: signedDoc.id,
      pdfUrl: relativePdfUrl,
      sharepointUrl,
    });
  } catch (e: any) {
    console.error("Error signing template:", e);
    return NextResponse.json({ ok: false, error: e.message || "Internal Server Error" }, { status: 500 });
  }
}
