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

  // 1. First check explicit DB settings or explicit SMTP environment variables
  let host = dbSettings["smtp_host"] || process.env.SMTP_HOST || "";
  let port = parseInt(dbSettings["smtp_port"] || process.env.SMTP_PORT || "587");
  let user = dbSettings["smtp_user"] || process.env.SMTP_USER || "";
  let pass = dbSettings["smtp_pass"] || process.env.SMTP_PASS || "";

  // 2. Only if explicit SMTP credentials are NOT provided, check Azure Communication Services auto-config
  const azureClientId = dbSettings["azure_client_id"] || process.env.AZURE_AD_CLIENT_ID;
  const azureTenantId = dbSettings["azure_tenant_id"] || process.env.AZURE_AD_TENANT_ID;
  const azureClientSecret = dbSettings["azure_client_secret"] || process.env.AZURE_AD_CLIENT_SECRET;

  if (!user && azureClientId && azureTenantId && azureClientSecret) {
    host = "smtp.azurecomm.net";
    port = 587;
    user = `${azureClientId}@${azureTenantId}`;
    pass = azureClientSecret;
  }

  // 3. Fallbacks for Microsoft 365 Exchange Online vs Azure ACS
  if (!host) {
    if (user && user.includes("@") && !user.includes("-")) {
      host = "smtp.office365.com";
    } else {
      host = "smtp.azurecomm.net";
    }
  }

  // If host is set to smtp.azurecomm.net but user is an Office 365 email (like docsign@mtcd.org), route to Office 365
  if (host === "smtp.azurecomm.net" && user && !user.includes("@")) {
    // missing tenant ID in user format
  } else if (host === "smtp.azurecomm.net" && user && user.includes("@") && !user.split("@")[0].includes("-")) {
    // User is a standard email address like docsign@mtcd.org, not an Azure App ID (uuid@uuid)
    host = "smtp.office365.com";
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

