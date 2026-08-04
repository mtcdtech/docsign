import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { overlayPdf } from "@/lib/pdf";
import { sendEmail } from "@/lib/mail";
import { getMsGraphToken, uploadFileToSharepoint } from "@/lib/sharepoint";
import path from "path";
import fs from "fs";

function getEmailHtml({
  title,
  subtitle,
  bodyText,
  details,
  portalTitle = "MTCD DocSign",
  portalLogo = ""
}: {
  title: string;
  subtitle: string;
  bodyText: string;
  details: { label: string; value: string }[];
  portalTitle?: string;
  portalLogo?: string;
}) {
  const logoHtml = portalLogo 
    ? `<img src="${portalLogo}" alt="${portalTitle}" style="max-height: 48px; max-width: 200px; display: block; margin: 0 auto 12px auto;" />`
    : `<div style="font-size: 24px; font-weight: bold; color: #ffffff; letter-spacing: -0.5px; text-align: center;">✍️ ${portalTitle}</div>`;

  const detailsRows = details
    .map(
      (d) => `
      <tr>
        <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #64748b; font-weight: 600; width: 35%;">${d.label}</td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #1e293b; font-weight: 500;">${d.value}</td>
      </tr>
    `
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
      </head>
      <body style="background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 40px 20px; -webkit-font-smoothing: antialiased;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #1e3a8a, #0f172a); padding: 32px; text-align: center;">
            ${logoHtml}
            <div style="color: rgba(255, 255, 255, 0.8); font-size: 14px; margin-top: 4px; font-weight: 500; text-align: center;">Official Document Dispatch</div>
          </div>
          
          <!-- Content -->
          <div style="padding: 32px 40px;">
            <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #0f172a; letter-spacing: -0.5px;">${subtitle}</h2>
            <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: #475569;">${bodyText}</p>
            
            <!-- Details Table -->
            <table style="width: 100%; border-collapse: collapse; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; margin-bottom: 24px;">
              <tbody>
                ${detailsRows}
              </tbody>
            </table>
            
            <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #64748b;">
              The signed document has been attached to this email as a PDF copy for your record keeping.
            </p>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f8fafc; padding: 24px 40px; border-top: 1px solid #e2e8f0; text-align: center;">
            <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; text-align: center;">${portalTitle}</p>
            <p style="margin: 0 0 12px 0; font-size: 12px; color: #94a3b8; line-height: 1.4; text-align: center;">
              This is an automated notification. Please do not reply directly to this email.
            </p>
            <p style="margin: 0; font-size: 11px; color: #cbd5e1; text-align: center;">
              © ${new Date().getFullYear()} MTCD. All rights reserved.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;
}

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

    // Fetch portal settings for branding
    let portalTitle = "MTCD DocSign";
    let portalLogo = "";
    try {
      const settings = await prisma.setting.findMany();
      const settingsMap = settings.reduce((acc, curr) => {
        acc[curr.key] = curr.value;
        return acc;
      }, {} as Record<string, string>);
      if (settingsMap["portal_title"]) portalTitle = settingsMap["portal_title"];
      if (settingsMap["portal_logo"]) portalLogo = settingsMap["portal_logo"];
    } catch (e) {
      console.error("Failed to query settings for email:", e);
    }

    // Execute sending to Signer
    if (targetSignerEmail) {
      try {
        const htmlContent = getEmailHtml({
          title: `Completed: ${template.title}`,
          subtitle: "Signed Waiver Confirmation",
          bodyText: `Dear ${signerName},<br/><br/>Thank you for completing the document signature. A copy of the signed document has been attached to this email as a PDF for your records.`,
          details: [
            { label: "Document Name", value: template.title },
            { label: "Signer Name", value: signerName },
            { label: "Signer Email", value: signerEmail },
            { label: "Completed On", value: new Date().toLocaleString() }
          ],
          portalTitle,
          portalLogo
        });
        
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
        const htmlContent = getEmailHtml({
          title: `Parent/Guardian Copy: ${template.title}`,
          subtitle: "Parent/Guardian Signature Copy",
          bodyText: `Hello,<br/><br/>A copy of the signed document has been attached to this email. This copy was dispatched to you because your email was provided as the parent/guardian contact.`,
          details: [
            { label: "Document Name", value: template.title },
            { label: "Participant Name", value: signerName },
            { label: "Completed On", value: new Date().toLocaleString() }
          ],
          portalTitle,
          portalLogo
        });
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
        const htmlContent = getEmailHtml({
          title: `Signed Copy: ${template.title}`,
          subtitle: "Signed Document Copy Recipient",
          bodyText: `Hello,<br/><br/>A copy of the signed document has been attached to this email. You have received this copy because you were designated as a custom recipient for completed forms.`,
          details: [
            { label: "Document Name", value: template.title },
            { label: "Signer Name", value: signerName },
            { label: "Signer Email", value: signerEmail },
            { label: "Completed On", value: new Date().toLocaleString() }
          ],
          portalTitle,
          portalLogo
        });
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
        const htmlContent = getEmailHtml({
          title: `New Signature: ${template.title} - ${signerName}`,
          subtitle: "New Signed Waiver Received",
          bodyText: `Hello,<br/><br/>A new signature has been completed for your organization. The finalized PDF document is attached to this email.${sharepointUrl ? `<br/><br/>The file was also automatically uploaded to SharePoint: <a href="${sharepointUrl}">${sharepointUrl}</a>` : ""}`,
          details: [
            { label: "Document Name", value: template.title },
            { label: "Signer Name", value: signerName },
            { label: "Signer Email", value: signerEmail },
            { label: "Submission ID", value: signedDoc.id },
            { label: "Submitted On", value: new Date().toLocaleString() }
          ],
          portalTitle,
          portalLogo
        });
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
