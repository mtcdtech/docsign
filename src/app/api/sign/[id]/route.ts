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
    const { signerName, signerEmail, formData, draftId } = await req.json();

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
          const parts = template.sharepointFolderId.split("/");
          const driveId = parts[0] || "root";
          const folderId = parts.slice(1).join("/") || "root";
          
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

    // 3. Save the Signed Document to Database (Update draft or create new)
    let signedDoc = null;
    if (draftId) {
      try {
        signedDoc = await prisma.signedDocument.update({
          where: { id: draftId },
          data: {
            signerName,
            signerEmail,
            formDataJson: JSON.stringify(formData),
            signedPdfPath: outputPath,
            sharepointUrl: sharepointUrl,
            isDraft: false,
          }
        });
      } catch (err) {
        console.warn("Could not update existing draft during submit:", err);
      }
    }

    if (!signedDoc) {
      signedDoc = await prisma.signedDocument.create({
        data: {
          templateId: template.id,
          signerName,
          signerEmail,
          formDataJson: JSON.stringify(formData),
          signedPdfPath: outputPath,
          sharepointUrl: sharepointUrl,
          isDraft: false,
        }
      });
    }

    // 4. Trigger Email Dispatches
    let emailedUser = false;
    let emailedLeader = false;
    let emailedParent = false;
    const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    // Build recipient groups
    const cleanSignerEmail = signerEmail ? signerEmail.trim().toLowerCase() : "";
    const parentEmailsSet = new Set<string>();
    const customEmailsSet = new Set<string>();
    const leaderEmailsSet = new Set<string>();

    // Parse template fields for custom and parent/guardian email variables
    try {
      const parsedFields = JSON.parse(template.fieldsJson) || [];
      parsedFields.forEach((f: any) => {
        if (formData[f.id]) {
          const val = String(formData[f.id]).trim().toLowerCase();
          if (val && val.includes("@")) {
            if (f.type === "custom_email") {
              customEmailsSet.add(val);
            }
            if (f.type === "custom_email" || f.id === "parent_email") {
              parentEmailsSet.add(val);
            }
          }
        }
      });
    } catch (parseErr) {
      console.error("Failed to parse template fields to check for email variables:", parseErr);
    }

    // Parse leader notification emails
    if (template.emailLeader) {
      if (template.notificationEmails) {
        template.notificationEmails.split(",").forEach(e => {
          const val = e.trim().toLowerCase();
          if (val) leaderEmailsSet.add(val);
        });
      } else {
        // Fall back to default org leaders
        const leaders = template.organization.users.filter(u => u.role === "OrgLeader" || u.role === "Admin");
        leaders.forEach(l => {
          const val = l.email.trim().toLowerCase();
          if (val) leaderEmailsSet.add(val);
        });
      }
    }

    // De-duplicate using hierarchical priority
    const processedEmails = new Set<string>();

    // 1. Signer Email Copy (Highest Priority)
    let targetSignerEmail = "";
    if (template.emailUser && cleanSignerEmail) {
      targetSignerEmail = cleanSignerEmail;
      processedEmails.add(cleanSignerEmail);
    }

    // 2. Parent/Guardian Email Copy
    const targetParentEmails: string[] = [];
    if (template.emailParent) {
      parentEmailsSet.forEach(email => {
        if (!processedEmails.has(email)) {
          targetParentEmails.push(email);
          processedEmails.add(email);
        }
      });
    }

    // 3. Custom Copy Emails
    const targetCustomEmails: string[] = [];
    customEmailsSet.forEach(email => {
      if (!processedEmails.has(email)) {
        targetCustomEmails.push(email);
        processedEmails.add(email);
      }
    });

    // 4. Leader Notification Emails
    const targetLeaderEmails: string[] = [];
    leaderEmailsSet.forEach(email => {
      if (!processedEmails.has(email)) {
        targetLeaderEmails.push(email);
        processedEmails.add(email);
      }
    });

    // Execute sending to Signer
    if (targetSignerEmail) {
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
        
        await sendEmail({
          to: targetSignerEmail,
          subject: `MTCD DocSign - Completed: ${template.title}`,
          html: htmlContent,
          attachmentPath: outputPath,
          attachmentName: `${template.title}_Signed.pdf`
        });

        await prisma.auditLog.create({
          data: {
            email: targetSignerEmail,
            action: `Sent Email Copy to Signer: ${targetSignerEmail} (doc: ${template.title})`,
            ip: clientIp,
            userAgent: userAgent
          }
        });
        emailedUser = true;
      } catch (mailErr) {
        console.error(`Failed to send confirmation email to signer ${targetSignerEmail}:`, mailErr);
      }
    }

    // Execute sending to Parent/Guardian
    if (targetParentEmails.length > 0) {
      try {
        const htmlContent = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; color: #333; line-height: 1.6;">
            <h2>Signed Document Copy</h2>
            <p>Hello,</p>
            <p>A copy of the signed document: <strong>${template.title}</strong> has been attached to this email.</p>
            <p><strong>Signer Name:</strong> ${signerName}</p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;" />
            <p style="font-size: 12px; color: #777;">This is an automated notification from DocSign.</p>
          </div>
        `;
        for (const email of targetParentEmails) {
          try {
            await sendEmail({
              to: email,
              subject: `MTCD DocSign - Parent/Guardian Copy: ${template.title}`,
              html: htmlContent,
              attachmentPath: outputPath,
              attachmentName: `${template.title}_Signed.pdf`
            });

            await prisma.auditLog.create({
              data: {
                email: email,
                action: `Sent Parent/Guardian Email Copy to: ${email} (doc: ${template.title})`,
                ip: clientIp,
                userAgent: userAgent
              }
            });
          } catch (mailErr) {
            console.error(`Failed to send parent email copy to ${email}:`, mailErr);
          }
        }
        emailedParent = true;
      } catch (parentErr) {
        console.error("Failed to process parent email copy dispatch:", parentErr);
      }
    }

    // Execute sending to Custom Copies
    if (targetCustomEmails.length > 0) {
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
        for (const email of targetCustomEmails) {
          try {
            await sendEmail({
              to: email,
              subject: `MTCD DocSign - Copy: ${template.title}`,
              html: htmlContent,
              attachmentPath: outputPath,
              attachmentName: `${template.title}_Signed.pdf`
            });

            await prisma.auditLog.create({
              data: {
                email: email,
                action: `Sent Custom Email Copy to: ${email} (doc: ${template.title})`,
                ip: clientIp,
                userAgent: userAgent
              }
            });
          } catch (customEmailErr) {
            console.error(`Failed to send custom copy email to ${email}:`, customEmailErr);
          }
        }
        emailedUser = true;
      } catch (customErr) {
        console.error("Failed to process custom email copy dispatch:", customErr);
      }
    }

    // Execute sending to Leaders
    if (targetLeaderEmails.length > 0) {
      try {
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
        for (const email of targetLeaderEmails) {
          try {
            await sendEmail({
              to: email,
              subject: `MTCD DocSign - New Signature: ${template.title} - ${signerName}`,
              html: htmlContent,
              attachmentPath: outputPath,
              attachmentName: `${template.title}_${cleanSignerName}.pdf`
            });

            await prisma.auditLog.create({
              data: {
                email: email,
                action: `Sent Leader Notification Email to: ${email} (doc: ${template.title}, signer: ${signerName})`,
                ip: clientIp,
                userAgent: userAgent
              }
            });
          } catch (mailErr) {
            console.error(`Failed to send notification email to leader ${email}:`, mailErr);
          }
        }
        emailedLeader = true;
      } catch (leaderErr) {
        console.error("Failed to send notification email to leaders:", leaderErr);
      }
    }

    // Update email status flags in DB
    await prisma.signedDocument.update({
      where: { id: signedDoc.id },
      data: {
        emailedUser,
        emailedLeader,
        emailedParent,
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
