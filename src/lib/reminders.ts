import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/mail";

export function getReminderEmailHtml({
  attendeeName,
  registrationTitle,
  organizationName,
  registrationUrl,
  pendingTemplates,
  portalLogoLight,
  portalLogoDark,
}: {
  attendeeName: string;
  registrationTitle: string;
  organizationName: string;
  registrationUrl: string;
  pendingTemplates: string[];
  portalLogoLight?: string;
  portalLogoDark?: string;
}) {
  const pendingItemsList = pendingTemplates
    .map((t) => `<li style="margin-bottom: 6px; color: #1e293b; font-weight: 500;">${t}</li>`)
    .join("");

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Action Required: Complete Waiver Signature</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f1f5f9; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f1f5f9; padding: 40px 16px;">
      <tr>
        <td align="center">
          <table width="100%" max-width="600" border="0" cellspacing="0" cellpadding="0" style="max-width:600px; background-color:#ffffff; border-radius:16px; overflow:hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);">
            <!-- Header Gradient Banner -->
            <tr>
              <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px 24px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">
                  Reminder: Pending Signature Request
                </h1>
                <p style="color: #94a3b8; margin: 6px 0 0 0; font-size: 14px;">
                  ${organizationName}
                </p>
              </td>
            </tr>

            <!-- Content Container -->
            <tr>
              <td style="padding: 32px 24px; background-color: #ffffff;">
                <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">
                  Dear <strong>${attendeeName}</strong>,
                </p>
                <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
                  This is a friendly reminder that you have incomplete digital waiver document(s) required for <strong>${registrationTitle}</strong>.
                </p>

                ${
                  pendingTemplates.length > 0
                    ? `
                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
                  <span style="font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b;">Pending Forms:</span>
                  <ul style="margin: 10px 0 0 0; padding-left: 20px; font-size: 14px;">
                    ${pendingItemsList}
                  </ul>
                </div>
                `
                    : ""
                }

                <div style="text-align: center; margin: 32px 0 24px 0;">
                  <a href="${registrationUrl}" target="_blank" style="background-color: #2563eb; color: #ffffff; padding: 14px 32px; border-radius: 10px; font-weight: 600; font-size: 15px; text-decoration: none; display: inline-block; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);">
                    Complete Signature Packet &rarr;
                  </a>
                </div>

                <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin: 24px 0 0 0; text-align: center;">
                  If the button above does not work, copy and paste this link into your browser:<br/>
                  <a href="${registrationUrl}" style="color: #2563eb; word-break: break-all;">${registrationUrl}</a>
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background-color: #f8fafc; padding: 20px 24px; border-top: 1px solid #f1f5f9; text-align: center;">
                <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                  Sent via DocSign Portal &bull; Official Digital Signature System
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;
}

export async function sendAttendeeReminder({
  registrationId,
  attendeeEmail,
  attendeeName,
  registrationTitle,
  organizationName,
  registrationSlug,
  pendingTemplates,
  baseUrl,
}: {
  registrationId: string;
  attendeeEmail: string;
  attendeeName: string;
  registrationTitle: string;
  organizationName: string;
  registrationSlug: string;
  pendingTemplates: string[];
  baseUrl: string;
}) {
  const cleanEmail = attendeeEmail.trim().toLowerCase();
  const registrationUrl = `${baseUrl}/registration/${registrationSlug}?email=${encodeURIComponent(cleanEmail)}`;

  const html = getReminderEmailHtml({
    attendeeName: attendeeName || "Registrant",
    registrationTitle,
    organizationName,
    registrationUrl,
    pendingTemplates,
  });

  const subject = `MTCD DocSign - Action Required: Complete Waiver Signature for ${registrationTitle}`;

  // Execute email send
  await sendEmail({
    to: cleanEmail,
    subject,
    html,
  });

  // Upsert RegistrationReminder status in database
  const now = new Date();
  const reminder = await prisma.registrationReminder.upsert({
    where: {
      registrationId_attendeeEmail: {
        registrationId,
        attendeeEmail: cleanEmail,
      },
    },
    update: {
      attendeeName,
      lastSentAt: now,
      sendCount: { increment: 1 },
      status: "Sent",
    },
    create: {
      registrationId,
      attendeeEmail: cleanEmail,
      attendeeName,
      lastSentAt: now,
      sendCount: 1,
      status: "Sent",
    },
  });

  // Log in AuditLog
  try {
    await prisma.auditLog.create({
      data: {
        email: cleanEmail,
        action: `Sent reminder email for registration "${registrationTitle}"`,
      },
    });
  } catch (e) {
    console.error("Failed to log reminder audit log:", e);
  }

  return reminder;
}
