import { prisma } from "./prisma";

interface SyncWaiverToPcoParams {
  template: {
    title: string;
    pcoSignupId: string | null;
    pcoQuestionTitle: string | null;
  };
  signedDoc: {
    id: string;
    signerName: string;
    signerEmail: string;
    pcoAttendeeId: string | null;
  };
  clientIp?: string;
  userAgent?: string;
}

export async function syncWaiverToPco({
  template,
  signedDoc,
  clientIp = "0.0.0.0",
  userAgent = "Internal Sync"
}: SyncWaiverToPcoParams) {
  const appId = process.env.PCO_APPLICATION_ID;
  const secret = process.env.PCO_SECRET;

  if (!appId || !secret) {
    console.warn("PCO Sync Skipped: PCO_APPLICATION_ID or PCO_SECRET env variables not configured.");
    return;
  }

  const signupId = template.pcoSignupId;
  const questionTitle = template.pcoQuestionTitle;

  if (!signupId || !questionTitle) {
    console.warn("PCO Sync Skipped: Template is missing pcoSignupId or pcoQuestionTitle.");
    return;
  }

  try {
    const authHeader = `Basic ${Buffer.from(`${appId}:${secret}`).toString("base64")}`;
    const pcoHeaders = {
      "Authorization": authHeader,
      "Content-Type": "application/vnd.api+json",
      "Accept": "application/vnd.api+json"
    };

    let attendeeId = signedDoc.pcoAttendeeId;

    // Step 1: Attendee Name + Email Lookup if ID is not provided
    if (!attendeeId) {
      console.log(`[PCO Sync] Performing lookup for ${signedDoc.signerName} (${signedDoc.signerEmail}) in Signup ${signupId}...`);
      const url = `https://api.planningcenteronline.com/registrations/v2/signups/${signupId}/attendees?where[email]=${encodeURIComponent(signedDoc.signerEmail)}`;
      const res = await fetch(url, { headers: pcoHeaders });
      
      if (!res.ok) {
        throw new Error(`PCO Attendees lookup query returned HTTP status ${res.status}`);
      }

      const json = await res.json();
      const attendees = json.data || [];

      // Find the attendee matching the signer's name
      const targetNameClean = signedDoc.signerName.toLowerCase().replace(/[^a-z0-9]/g, "");
      const match = attendees.find((att: any) => {
        const first = att.attributes?.first_name || "";
        const last = att.attributes?.last_name || "";
        const fullClean = `${first}${last}`.toLowerCase().replace(/[^a-z0-9]/g, "");
        return fullClean === targetNameClean || 
               targetNameClean.includes(fullClean) || 
               fullClean.includes(targetNameClean);
      });

      if (!match) {
        const errorMsg = `PCO Attendee Lookup Failed: No matching attendee found for "${signedDoc.signerName}" under email "${signedDoc.signerEmail}" in signup ${signupId}.`;
        console.warn(`[PCO Sync] ${errorMsg}`);
        await prisma.auditLog.create({
          data: {
            email: signedDoc.signerEmail,
            action: `PCO Sync Warning: Could not locate attendee in signup ${signupId} matching name "${signedDoc.signerName}"`,
            ip: clientIp,
            userAgent: userAgent
          }
        });
        return;
      }

      attendeeId = match.id;
      console.log(`[PCO Sync] Resolved Attendee ID: ${attendeeId}`);
      
      // Update the SignedDocument row with the resolved attendee ID
      await prisma.signedDocument.update({
        where: { id: signedDoc.id },
        data: { pcoAttendeeId: attendeeId }
      });
    }

    // Step 2: Fetch Attendee Answers & Question Relations
    console.log(`[PCO Sync] Fetching answers for Attendee ${attendeeId}...`);
    const answersUrl = `https://api.planningcenteronline.com/registrations/v2/attendees/${attendeeId}/answers?include=question`;
    const answersRes = await fetch(answersUrl, { headers: pcoHeaders });

    if (!answersRes.ok) {
      throw new Error(`PCO Answers fetch returned HTTP status ${answersRes.status}`);
    }

    const answersJson = await answersRes.json();
    const answers = answersJson.data || [];
    const questions = answersJson.included || [];

    // Find the target answer block
    let targetAnswerId: string | null = null;
    const targetTitleClean = questionTitle.toLowerCase().trim();

    for (const ans of answers) {
      const qRef = ans.relationships?.question?.data;
      if (!qRef) continue;

      const q = questions.find((item: any) => item.type === "Question" && item.id === qRef.id);
      if (q && q.attributes?.title?.toLowerCase().trim() === targetTitleClean) {
        targetAnswerId = ans.id;
        break;
      }
    }

    if (!targetAnswerId) {
      const errorMsg = `PCO Sync Failed: Target custom question "${questionTitle}" not found for attendee ${attendeeId}.`;
      console.warn(`[PCO Sync] ${errorMsg}`);
      await prisma.auditLog.create({
        data: {
          email: signedDoc.signerEmail,
          action: `PCO Sync Warning: Target custom question "${questionTitle}" not configured for attendee ${attendeeId}`,
          ip: clientIp,
          userAgent: userAgent
        }
      });
      return;
    }

    // Step 3: Patch the check off answer in PCO
    console.log(`[PCO Sync] Patching Answer ${targetAnswerId} to 'Yes'...`);
    const patchUrl = `https://api.planningcenteronline.com/registrations/v2/answers/${targetAnswerId}`;
    const patchBody = {
      data: {
        type: "Answer",
        id: targetAnswerId,
        attributes: {
          value: "Yes"
        }
      }
    };

    const patchRes = await fetch(patchUrl, {
      method: "PATCH",
      headers: pcoHeaders,
      body: JSON.stringify(patchBody)
    });

    if (!patchRes.ok) {
      throw new Error(`PCO Answer PATCH returned HTTP status ${patchRes.status}`);
    }

    console.log(`[PCO Sync] Successfully checked off attendee ${attendeeId} in PCO for signup ${signupId}.`);
    await prisma.auditLog.create({
      data: {
        email: signedDoc.signerEmail,
        action: `Checked off attendee in PCO (Attendee: ${attendeeId}, Signup: ${signupId}, Question: "${questionTitle}")`,
        ip: clientIp,
        userAgent: userAgent
      }
    });

  } catch (err: any) {
    console.error("[PCO Sync Error]", err);
    try {
      await prisma.auditLog.create({
        data: {
          email: signedDoc.signerEmail,
          action: `PCO Sync Error: ${err.message || "Unknown error during PCO api sync request"}`,
          ip: clientIp,
          userAgent: userAgent
        }
      });
    } catch (dbErr) {
      console.error("Failed to write PCO Sync error log:", dbErr);
    }
  }
}

export interface PcoAttendee {
  id: string;
  name: string;
  email: string;
  answers: { questionId: string; value: string | null }[];
}

export async function getPcoRegistrationAttendees(signupId: string): Promise<PcoAttendee[]> {
  const appId = process.env.PCO_APPLICATION_ID;
  const secret = process.env.PCO_SECRET;

  if (!appId || !secret) {
    throw new Error("PCO_APPLICATION_ID or PCO_SECRET env variables not configured.");
  }

  const authHeader = `Basic ${Buffer.from(`${appId}:${secret}`).toString("base64")}`;
  const pcoHeaders = {
    "Authorization": authHeader,
    "Accept": "application/vnd.api+json"
  };

  // Fetch up to 100 attendees registered for that signup, including answers
  const url = `https://api.planningcenteronline.com/registrations/v2/signups/${signupId}/attendees?per_page=100&include=answers`;
  const res = await fetch(url, { headers: pcoHeaders });
  
  if (!res.ok) {
    throw new Error(`PCO API request returned HTTP status ${res.status}`);
  }

  const json = await res.json();
  const data = json.data || [];
  const included = json.included || [];

  return data.map((att: any) => {
    const first = att.attributes?.first_name || "";
    const last = att.attributes?.last_name || "";
    const email = att.attributes?.email || "";
    
    // Resolve answers relationships
    const answerRefs = att.relationships?.answers?.data || [];
    const answers = answerRefs.map((ref: any) => {
      const match = included.find((item: any) => item.type === "Answer" && item.id === ref.id);
      const questionId = match?.relationships?.question?.data?.id || "";
      const value = match?.attributes?.value || null;
      return { questionId, value };
    });

    return {
      id: att.id,
      name: `${first} ${last}`.trim(),
      email: email.trim().toLowerCase(),
      answers
    };
  });
}

export async function getPcoQuestions(signupId: string): Promise<{ id: string; title: string }[]> {
  const appId = process.env.PCO_APPLICATION_ID;
  const secret = process.env.PCO_SECRET;

  if (!appId || !secret) {
    throw new Error("PCO_APPLICATION_ID or PCO_SECRET env variables not configured.");
  }

  const authHeader = `Basic ${Buffer.from(`${appId}:${secret}`).toString("base64")}`;
  const pcoHeaders = {
    "Authorization": authHeader,
    "Accept": "application/vnd.api+json"
  };

  const url = `https://api.planningcenteronline.com/registrations/v2/signups/${signupId}/questions`;
  const res = await fetch(url, { headers: pcoHeaders });
  
  if (!res.ok) {
    throw new Error(`PCO Questions API returned HTTP ${res.status}`);
  }

  const json = await res.json();
  const data = json.data || [];
  return data.map((q: any) => ({
    id: q.id,
    title: q.attributes?.title || ""
  }));
}

