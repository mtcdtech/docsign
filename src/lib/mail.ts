import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";

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
  // Query DB settings for potential fallbacks
  let dbSettings: Record<string, string> = {};
  try {
    const settings = await prisma.setting.findMany();
    dbSettings = settings.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);
  } catch (err) {
    console.warn("Could not query Setting model for email config fallback:", err);
  }

  let host = process.env.SMTP_HOST || dbSettings["smtp_host"] || "smtp.azurecomm.net";
  let port = parseInt(process.env.SMTP_PORT || dbSettings["smtp_port"] || "587");
  let user = process.env.SMTP_USER || dbSettings["smtp_user"] || "";
  let pass = process.env.SMTP_PASS || dbSettings["smtp_pass"] || "";

  // Auto-configure Azure Communication Services SMTP if Azure credentials are present in env or DB
  const azureClientId = process.env.AZURE_AD_CLIENT_ID || dbSettings["azure_client_id"];
  const azureTenantId = process.env.AZURE_AD_TENANT_ID || dbSettings["azure_tenant_id"];
  const azureClientSecret = process.env.AZURE_AD_CLIENT_SECRET || dbSettings["azure_client_secret"];

  if (azureClientId && azureTenantId && azureClientSecret) {
    host = "smtp.azurecomm.net";
    port = 587;
    user = `${azureClientId}@${azureTenantId}`;
    pass = azureClientSecret;
  }

  const mailFrom = process.env.SMTP_FROM || dbSettings["smtp_from"] || "docsign@mtcd.org";

  if (!host || (!user && host !== "localhost")) {
    console.warn(`SMTP Configuration warning: host="${host}", user="${user}". Email delivery to ${to} may fail if auth is required.`);
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465, false for 587 or others
    auth: user || pass ? {
      user,
      pass,
    } : undefined,
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

  if (host !== "smtp.azurecomm.net" && user) {
    mailOptions.sender = user;
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully to ${to} (Subject: "${subject}") via ${host}:${port}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error(`Failed to send email via SMTP to ${to} (Host: ${host}:${port}, User: ${user}, Subject: "${subject}"):`, error);
    throw error;
  }
}

