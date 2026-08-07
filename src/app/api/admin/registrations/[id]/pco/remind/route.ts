import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { sendAttendeeReminder } from "@/lib/reminders";
import { getPcoRegistrationAttendees } from "@/lib/pco";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const userRole = (session.user as any).role;
    if (userRole !== "Admin" && userRole !== "OrgLeader") {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const { id } = params;
    const body = await req.json().catch(() => ({}));
    const { attendeeEmail, sendAll } = body;

    // Fetch registration packet details
    const registration = await prisma.signingRegistration.findUnique({
      where: { id },
      include: { organization: true },
    });

    if (!registration) {
      return NextResponse.json({ ok: false, error: "Registration packet not found." }, { status: 404 });
    }

    if (!registration.pcoSignupId) {
      return NextResponse.json({ ok: false, error: "No Planning Center Signup ID connected to this registration packet." }, { status: 400 });
    }

    // Parse template IDs
    let templateIds: string[] = [];
    try {
      templateIds = JSON.parse(registration.templateIdsJson || "[]");
    } catch (e) {
      templateIds = [];
    }

    const templates = await prisma.template.findMany({
      where: { id: { in: templateIds } },
    });

    // Determine host protocol & base URL
    const host = req.headers.get("host") || "localhost:3656";
    const protocol = host.includes("localhost") ? "http" : "https";
    const baseUrl = `${protocol}://${host}`;

    // Fetch live PCO registrants
    let pcoAttendees;
    try {
      pcoAttendees = await getPcoRegistrationAttendees(registration.pcoSignupId);
    } catch (apiErr: any) {
      return NextResponse.json({ ok: false, error: `Failed to query PCO registrants: ${apiErr.message}` }, { status: 500 });
    }

    // Fetch signed documents for this registration's templates
    const signedDocs = await prisma.signedDocument.findMany({
      where: {
        templateId: { in: templateIds },
        isDraft: false,
      },
    });

    // Map attendees with their completed checklist
    const attendeesWithChecklist = pcoAttendees.map((att) => {
      const cleanEmail = att.email ? att.email.trim().toLowerCase() : "";
      const cleanName = att.name ? att.name.trim().toLowerCase() : "";

      const checklist = templates.map((tpl) => {
        const hasSignedDoc = signedDocs.some((sd) => {
          if (sd.templateId !== tpl.id) return false;
          if (sd.pcoAttendeeId && sd.pcoAttendeeId === att.id) return true;
          const sdEmail = sd.signerEmail ? sd.signerEmail.trim().toLowerCase() : "";
          if (cleanEmail && sdEmail === cleanEmail) return true;
          const sdName = sd.signerName ? sd.signerName.trim().toLowerCase() : "";
          if (cleanName && sdName === cleanName) return true;
          return false;
        });

        return {
          templateId: tpl.id,
          title: tpl.title,
          signed: hasSignedDoc,
        };
      });

      const pendingTemplates = checklist.filter((c) => !c.signed).map((c) => c.title);
      const isCompleted = checklist.length > 0 && checklist.every((c) => c.signed);

      return {
        id: att.id,
        name: att.name,
        email: att.email,
        pendingTemplates,
        isCompleted,
      };
    });

    let sentCount = 0;
    const errors: string[] = [];

    if (sendAll) {
      // Send reminders to ALL incomplete attendees
      const incompleteAttendees = attendeesWithChecklist.filter((att) => !att.isCompleted && att.email);
      for (const att of incompleteAttendees) {
        try {
          await sendAttendeeReminder({
            registrationId: registration.id,
            attendeeEmail: att.email,
            attendeeName: att.name,
            registrationTitle: registration.title,
            organizationName: registration.organization?.name || "MTCD",
            registrationSlug: registration.slug,
            pendingTemplates: att.pendingTemplates,
            baseUrl,
          });
          sentCount++;
        } catch (err: any) {
          console.error(`Failed to send reminder email to ${att.email}:`, err);
          errors.push(`${att.email}: ${err.message}`);
        }
      }
    } else if (attendeeEmail) {
      // Send single reminder
      const cleanTarget = attendeeEmail.trim().toLowerCase();
      const targetAttendee = attendeesWithChecklist.find((att) => att.email.trim().toLowerCase() === cleanTarget);

      if (!targetAttendee) {
        return NextResponse.json({ ok: false, error: "Attendee not found in Planning Center registrants list." }, { status: 404 });
      }

      try {
        await sendAttendeeReminder({
          registrationId: registration.id,
          attendeeEmail: targetAttendee.email,
          attendeeName: targetAttendee.name,
          registrationTitle: registration.title,
          organizationName: registration.organization?.name || "MTCD",
          registrationSlug: registration.slug,
          pendingTemplates: targetAttendee.pendingTemplates,
          baseUrl,
        });
        sentCount++;
      } catch (err: any) {
        return NextResponse.json({ ok: false, error: `Failed to send reminder email: ${err.message}` }, { status: 500 });
      }
    } else {
      return NextResponse.json({ ok: false, error: "Must specify attendeeEmail or sendAll: true." }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      sentCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e: any) {
    console.error("Error sending reminder email(s):", e);
    return NextResponse.json({ ok: false, error: e.message || "Internal server error" }, { status: 500 });
  }
}
