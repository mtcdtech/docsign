import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { sendEmail } from "@/lib/mail";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "Admin") {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const testRecipient = body.email || session.user.email;

    if (!testRecipient) {
      return NextResponse.json({ ok: false, error: "Test email recipient is required." }, { status: 400 });
    }

    const res = await sendEmail({
      to: testRecipient,
      subject: "MTCD DocSign - Test Email Delivery Check",
      html: `
        <div style="font-family: sans-serif; padding: 24px; max-width: 500px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #2563eb; margin-top: 0;">✓ Email Delivery Test Successful</h2>
          <p style="color: #334155;">
            This test email confirms that your DocSign SMTP mail server configuration is active and working properly.
          </p>
          <p style="color: #64748b; font-size: 13px;">
            Sent to: <strong>${testRecipient}</strong><br/>
            Timestamp: ${new Date().toLocaleString()}
          </p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true, messageId: res.messageId, recipient: testRecipient });
  } catch (err: any) {
    console.error("Test email connection exception:", err);
    return NextResponse.json({ ok: false, error: err.message || "Failed to send test email." }, { status: 500 });
  }
}
