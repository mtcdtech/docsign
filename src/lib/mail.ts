import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";

export async function sendEmail({
  to,
  subject,
  html,
  attachmentPath,
  attachmentName,
}: {
  to: string;
  subject: string;
  html: string;
  attachmentPath?: string;
  attachmentName?: string;
}) {
  let host = process.env.SMTP_HOST || "smtp.azurecomm.net";
  let port = parseInt(process.env.SMTP_PORT || "587");
  let user = process.env.SMTP_USER || "";
  let pass = process.env.SMTP_PASS || "";

  // Auto-configure Azure Communication Services SMTP if Azure credentials are present
  const azureClientId = process.env.AZURE_AD_CLIENT_ID;
  const azureTenantId = process.env.AZURE_AD_TENANT_ID;
  const azureClientSecret = process.env.AZURE_AD_CLIENT_SECRET;

  if (azureClientId && azureTenantId && azureClientSecret) {
    host = "smtp.azurecomm.net";
    port = 587;
    user = `${azureClientId}@${azureTenantId}`;
    pass = azureClientSecret;
  }

  const mailFrom = process.env.SMTP_FROM || "docsign@mtcd.org";

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465, false for 587 or others
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  const attachments = [];
  if (attachmentPath && fs.existsSync(attachmentPath)) {
    attachments.push({
      filename: attachmentName || path.basename(attachmentPath),
      path: attachmentPath,
    });
  }

  const mailOptions: any = {
    from: `"DocSign Portal" <${mailFrom}>`,
    to,
    subject,
    html,
    attachments,
  };

  if (host !== "smtp.azurecomm.net") {
    mailOptions.sender = user;
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully to ${to} (Subject: "${subject}"): ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`Failed to send email via SMTP to ${to} (Subject: "${subject}"):`, error);
    throw error;
  }
}
