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
  const host = process.env.SMTP_HOST || "smtp.office365.com";
  const port = parseInt(process.env.SMTP_PORT || "587");
  // Default fallback user/pass to the Office 365 account from the other app
  const user = process.env.SMTP_USER || "announcements@mtcd.org";
  const pass = process.env.SMTP_PASS || "T#613178294935us";
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
      ciphers: "SSLv3",
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

  const mailOptions = {
    from: `"DocSign Portal" <${mailFrom}>`,
    to,
    subject,
    html,
    attachments,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Failed to send email via SMTP:", error);
    throw error;
  }
}
