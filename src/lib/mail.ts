import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";

async function sendViaGraphApi({
  tenantId,
  clientId,
  clientSecret,
  from,
  to,
  subject,
  html,
  attachmentPath,
  attachmentName,
}: {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  attachmentPath?: string;
  attachmentName?: string;
}) {
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const tokenRes = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`Azure AD Auth token request failed (${tokenRes.status}): ${errText}`);
  }

  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;
  if (!accessToken) {
    throw new Error("No access_token returned from Azure AD");
  }

  const attachments: any[] = [];
  if (attachmentPath && fs.existsSync(attachmentPath)) {
    const fileBuffer = fs.readFileSync(attachmentPath);
    attachments.push({
      "@odata.type": "#microsoft.graph.fileAttachment",
      name: attachmentName || path.basename(attachmentPath),
      contentBytes: fileBuffer.toString("base64"),
    });
  }

  const sendMailUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(from)}/sendMail`;
  const payload = {
    message: {
      subject,
      body: {
        contentType: "HTML",
        content: html,
      },
      toRecipients: [
        {
          emailAddress: {
            address: to,
          },
        },
      ],
      attachments: attachments.length > 0 ? attachments : undefined,
    },
    saveToSentItems: "true",
  };

  const graphRes = await fetch(sendMailUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!graphRes.ok) {
    const errorData = await graphRes.json().catch(() => ({}));
    const errorMsg = errorData.error?.message || (await graphRes.text());
    throw new Error(`Microsoft Graph API sendMail failed (${graphRes.status}): ${errorMsg}`);
  }

  console.log(`Email sent successfully via Microsoft Graph API to ${to} from ${from} (Subject: "${subject}")`);
  return { success: true, messageId: `graph-${Date.now()}` };
}

export async function sendEmail({
  to,
  subject,
  html,
  attachmentPath,
  attachmentName,
  smtpHost,
  smtpPort,
  smtpUser,
  smtpPass,
  smtpFrom,
}: {
  to: string;
  subject: string;
  html: string;
  attachmentPath?: string;
  attachmentName?: string;
  smtpHost?: string;
  smtpPort?: string;
  smtpUser?: string;
  smtpPass?: string;
  smtpFrom?: string;
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

  const azureClientId = dbSettings["azure_client_id"] || process.env.AZURE_AD_CLIENT_ID;
  const azureTenantId = dbSettings["azure_tenant_id"] || process.env.AZURE_AD_TENANT_ID;
  const azureClientSecret = dbSettings["azure_client_secret"] || process.env.AZURE_AD_CLIENT_SECRET;

  const mailFrom = smtpFrom || dbSettings["smtp_from"] || process.env.SMTP_FROM || "docsign@mtcd.org";

  // Attempt 1: Try Microsoft Graph API if Azure credentials are present
  if (azureClientId && azureTenantId && azureClientSecret) {
    try {
      console.log(`Attempting email delivery via Microsoft Graph API for sender ${mailFrom}...`);
      const graphResult = await sendViaGraphApi({
        tenantId: azureTenantId,
        clientId: azureClientId,
        clientSecret: azureClientSecret,
        from: mailFrom,
        to,
        subject,
        html,
        attachmentPath,
        attachmentName,
      });
      return graphResult;
    } catch (graphErr: any) {
      console.warn(`Microsoft Graph API delivery attempt failed: ${graphErr.message}. Falling back to standard SMTP...`);
    }
  }

  // Attempt 2: Standard Nodemailer SMTP
  let host = smtpHost || dbSettings["smtp_host"] || process.env.SMTP_HOST || "";
  let port = parseInt(smtpPort || dbSettings["smtp_port"] || process.env.SMTP_PORT || "587");
  let user = smtpUser || dbSettings["smtp_user"] || process.env.SMTP_USER || "";
  let pass = smtpPass || dbSettings["smtp_pass"] || process.env.SMTP_PASS || "";

  if (!host) {
    if (user && user.includes("@") && !user.includes("-")) {
      host = "smtp.office365.com";
    } else {
      host = "smtp.azurecomm.net";
    }
  }

  if (host === "smtp.azurecomm.net" && user && user.includes("@") && !user.split("@")[0].includes("-")) {
    host = "smtp.office365.com";
  }

  if (!host || (!user && host !== "localhost")) {
    console.warn(`SMTP Configuration warning: host="${host}", user="${user}". Email delivery to ${to} may fail if auth is required.`);
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465, false for 587
    auth: user || pass ? {
      user,
      pass,
    } : undefined,
    tls: {
      rejectUnauthorized: false,
      ciphers: "SSLv3",
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
    console.log(`Email sent successfully to ${to} (Subject: "${subject}") via SMTP ${host}:${port}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error(`Failed to send email via SMTP to ${to} (Host: ${host}:${port}, User: ${user}, Subject: "${subject}"):`, error);
    throw error;
  }
}
