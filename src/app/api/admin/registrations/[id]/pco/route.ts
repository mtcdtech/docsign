import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { getPcoRegistrationAttendees, getPcoQuestions } from "@/lib/pco";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const registrationId = params.id;
    const registration = await prisma.signingRegistration.findUnique({
      where: { id: registrationId }
    });

    if (!registration) {
      return NextResponse.json({ ok: false, error: "Registration not found." }, { status: 404 });
    }

    if (!registration.pcoSignupId) {
      return NextResponse.json({ ok: true, attendees: [], message: "PCO Signup ID is not configured for this registration." });
    }

    // Check OrgLeader access permissions
    const user = session.user as any;
    if (user.role !== "Admin") {
      const isLeader = await prisma.organization.findFirst({
        where: {
          id: registration.organizationId,
          users: { some: { id: user.id } }
        }
      });
      if (!isLeader) {
        return new NextResponse("Forbidden", { status: 403 });
      }
    }

    let pcoAttendees;
    try {
      pcoAttendees = await getPcoRegistrationAttendees(registration.pcoSignupId);
    } catch (apiErr: any) {
      console.error("Failed to fetch PCO integration records:", apiErr);
      return NextResponse.json({ ok: false, error: `PCO API Error: ${apiErr.message || "Connection refused"}` }, { status: 502 });
    }

    // Retrieve active template data for the session
    const templateIds: string[] = JSON.parse(registration.templateIdsJson) || [];
    const templates = await prisma.template.findMany({
      where: { id: { in: templateIds } },
      select: { id: true, title: true, pcoQuestionTitle: true }
    });

    // Query signed document database records for these templates
    const signedDocs = await prisma.signedDocument.findMany({
      where: {
        templateId: { in: templateIds },
        isDraft: false
      },
      select: { templateId: true, signerEmail: true, signerName: true, pcoAttendeeId: true }
    });

    // Map each PCO attendee to their waiver completion state
    const mappedAttendees = pcoAttendees.map((att) => {
      const cleanAttEmail = att.email.trim().toLowerCase();
      const cleanAttName = att.name.toLowerCase().replace(/[^a-z0-9]/g, "");

      const checklist = templates.map((tpl) => {
        // Look up matching signed document
        const hasSignedLocal = signedDocs.some((doc) => {
          if (doc.templateId !== tpl.id) return false;
          if (doc.pcoAttendeeId === att.id) return true;
          
          const cleanDocEmail = doc.signerEmail.trim().toLowerCase();
          if (cleanDocEmail !== cleanAttEmail) return false;

          // Fuzzy clean match on names if emails match
          const dName = doc.signerName.toLowerCase().replace(/[^a-z0-9\s]/g, "");
          const aName = att.name.toLowerCase().replace(/[^a-z0-9\s]/g, "");
          if (dName === aName) return true;

          const dWords = dName.split(/\s+/).filter(Boolean);
          const aWords = aName.split(/\s+/).filter(Boolean);
          if (aWords.length === 0 || dWords.length === 0) return false;

          // Check if last names match, and first name matches or starts with same prefix
          const lastA = aWords[aWords.length - 1];
          const lastD = dWords[dWords.length - 1];
          if (lastA !== lastD) return false;

          const firstA = aWords[0];
          const firstD = dWords[0];
          return firstA === firstD || firstA.startsWith(firstD) || firstD.startsWith(firstA);
        });

        return {
          templateId: tpl.id,
          title: tpl.title,
          pcoQuestionTitle: tpl.pcoQuestionTitle || null,
          signed: hasSignedLocal,
          pcoAnswered: false
        };
      });

      const completedCount = checklist.filter((item) => item.signed).length;
      let status = "Not Started";
      if (completedCount === templates.length) {
        status = "Completed";
      } else if (completedCount > 0) {
        status = `Partial (${completedCount}/${templates.length})`;
      }

      return {
        id: att.id,
        name: att.name,
        email: att.email,
        checklist,
        status
      };
    });

    return NextResponse.json({ ok: true, attendees: mappedAttendees });
  } catch (err: any) {
    console.error("PCO attendees sync route exception:", err);
    return NextResponse.json({ ok: false, error: err.message || "Failed to load attendees list" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const registrationId = params.id;
    const body = await req.json();
    const { email, name } = body;

    if (!email || !name) {
      return NextResponse.json({ ok: false, error: "Missing attendee details." }, { status: 400 });
    }

    const registration = await prisma.signingRegistration.findUnique({
      where: { id: registrationId }
    });
    if (!registration) {
      return NextResponse.json({ ok: false, error: "Registration not found" }, { status: 404 });
    }

    const templateIds: string[] = JSON.parse(registration.templateIdsJson) || [];
    const templates = await prisma.template.findMany({
      where: { id: { in: templateIds } }
    });

    const { syncWaiverToPco } = await import("@/lib/pco");
    let syncedCount = 0;

    for (const tpl of templates) {
      const doc = await prisma.signedDocument.findFirst({
        where: {
          templateId: tpl.id,
          signerEmail: { equals: email.trim() },
          isDraft: false
        }
      });

      if (doc) {
        await syncWaiverToPco({
          template: {
            title: tpl.title,
            pcoSignupId: registration.pcoSignupId,
            pcoQuestionTitle: tpl.pcoQuestionTitle
          },
          signedDoc: {
            id: doc.id,
            signerName: doc.signerName,
            signerEmail: doc.signerEmail,
            pcoAttendeeId: doc.pcoAttendeeId
          },
          clientIp: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown",
          userAgent: req.headers.get("user-agent") || "unknown"
        });
        syncedCount++;
      }
    }

    return NextResponse.json({ ok: true, syncedCount });
  } catch (err: any) {
    console.error("Manual PCO sync route exception:", err);
    return NextResponse.json({ ok: false, error: err.message || "Failed to run sync" }, { status: 500 });
  }
}
