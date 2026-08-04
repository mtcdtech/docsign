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

async function getPcoCredentials() {
  let appId = process.env.PCO_APPLICATION_ID || "";
  let secret = process.env.PCO_SECRET || "";

  try {
    const dbSettings = await prisma.setting.findMany({
      where: {
        key: { in: ["pco_application_id", "pco_secret"] }
      }
    });
    const appSet = dbSettings.find(s => s.key === "pco_application_id");
    const secSet = dbSettings.find(s => s.key === "pco_secret");
    if (appSet?.value) appId = appSet.value;
    if (secSet?.value) secret = secSet.value;
  } catch (e) {
    console.error("Failed to query PCO settings from DB:", e);
  }

  return { appId, secret };
}

export async function syncWaiverToPco({
  template,
  signedDoc,
  clientIp = "0.0.0.0",
  userAgent = "Internal Sync"
}: SyncWaiverToPcoParams) {
  const { appId, secret } = await getPcoCredentials();

  if (!appId || !secret) {
    console.warn("PCO Sync Skipped: PCO_APPLICATION_ID or PCO_SECRET settings not configured.");
    return;
  }

  const signupId = template.pcoSignupId;
  const questionTitle = template.pcoQuestionTitle;

  if (!signupId || !questionTitle) {
    console.warn("PCO Sync Skipped: Template is missing pcoSignupId or pcoQuestionTitle.");
    return;
  }

  try {
    // 1. Look up attendee inside Signup
    const attendeeId = signedDoc.pcoAttendeeId || await findPcoAttendeeId(signupId, signedDoc.signerEmail, signedDoc.signerName, { appId, secret });
    if (!attendeeId) {
      console.warn(`PCO Sync failed: No attendee found matching ${signedDoc.signerEmail} in PCO Signup ${signupId}`);
      await prisma.auditLog.create({
        data: {
          email: signedDoc.signerEmail,
          action: `PCO Sync Failed: No attendee matched (doc: ${template.title})`,
          ip: clientIp,
          userAgent
        }
      });
      return;
    }

    // 2. Look up target question ID
    const questionId = await findPcoQuestionId(signupId, questionTitle, { appId, secret });
    if (!questionId) {
      console.warn(`PCO Sync failed: Question named "${questionTitle}" not found in PCO Signup ${signupId}`);
      await prisma.auditLog.create({
        data: {
          email: signedDoc.signerEmail,
          action: `PCO Sync Failed: Question "${questionTitle}" not found (doc: ${template.title})`,
          ip: clientIp,
          userAgent
        }
      });
      return;
    }

    // 3. Submit checkoff answer (Yes) to Planning Center
    const success = await submitPcoAnswer(attendeeId, questionId, "Yes", { appId, secret });
    if (success) {
      // Persist the matched PCO attendee ID back to the local signed document
      await prisma.signedDocument.update({
        where: { id: signedDoc.id },
        data: { pcoAttendeeId: attendeeId }
      });

      await prisma.auditLog.create({
        data: {
          email: signedDoc.signerEmail,
          action: `PCO Sync Success: Answered "${questionTitle}" for ${signedDoc.signerName} (doc: ${template.title})`,
          ip: clientIp,
          userAgent
        }
      });
      console.log(`PCO Sync Success for doc ID ${signedDoc.id}`);
    } else {
      console.error(`PCO Sync Failed at answer submission phase for doc ID ${signedDoc.id}`);
    }
  } catch (err: any) {
    console.error("Fatal error during PCO Sync handler execution:", err);
  }
}

// Inner helper to match attendee
async function findPcoAttendeeId(signupId: string, email: string, name: string, creds: { appId: string; secret: string }): Promise<string | null> {
  const authHeader = `Basic ${Buffer.from(`${creds.appId}:${creds.secret}`).toString("base64")}`;
  const url = `https://api.planningcenteronline.com/registrations/v2/signups/${signupId}/attendees?per_page=100`;

  try {
    const res = await fetch(url, {
      headers: {
        "Authorization": authHeader,
        "Accept": "application/vnd.api+json"
      }
    });
    if (!res.ok) return null;

    const json = await res.json();
    const data = json.data || [];

    const targetEmail = email.trim().toLowerCase();
    const targetName = name.toLowerCase().replace(/[^a-z0-9]/g, "");

    // 1. Precise match on email
    const matchByEmail = data.find((item: any) => {
      const pcoEmail = item.attributes?.email || "";
      return pcoEmail.trim().toLowerCase() === targetEmail;
    });
    if (matchByEmail) return matchByEmail.id;

    // 2. Fuzzy match on name if email failed
    const matchByName = data.find((item: any) => {
      const first = item.attributes?.first_name || "";
      const last = item.attributes?.last_name || "";
      const pcoName = `${first}${last}`.toLowerCase().replace(/[^a-z0-9]/g, "");
      return pcoName === targetName || pcoName.includes(targetName) || targetName.includes(pcoName);
    });
    if (matchByName) return matchByName.id;

    return null;
  } catch (e) {
    console.error("Error looking up attendee in PCO API:", e);
    return null;
  }
}

// Inner helper to locate check-off question ID
async function findPcoQuestionId(signupId: string, title: string, creds: { appId: string; secret: string }): Promise<string | null> {
  const authHeader = `Basic ${Buffer.from(`${creds.appId}:${creds.secret}`).toString("base64")}`;
  const url = `https://api.planningcenteronline.com/registrations/v2/signups/${signupId}/questions`;

  try {
    const res = await fetch(url, {
      headers: {
        "Authorization": authHeader,
        "Accept": "application/vnd.api+json"
      }
    });
    if (!res.ok) return null;

    const json = await res.json();
    const data = json.data || [];

    const targetTitle = title.trim().toLowerCase();
    const match = data.find((item: any) => {
      const pcoTitle = item.attributes?.title || "";
      return pcoTitle.trim().toLowerCase() === targetTitle;
    });

    return match ? match.id : null;
  } catch (e) {
    console.error("Error finding question in PCO API:", e);
    return null;
  }
}

// Inner helper to submit answer payload
async function submitPcoAnswer(attendeeId: string, questionId: string, value: string, creds: { appId: string; secret: string }): Promise<boolean> {
  const authHeader = `Basic ${Buffer.from(`${creds.appId}:${creds.secret}`).toString("base64")}`;
  const url = "https://api.planningcenteronline.com/registrations/v2/answers";

  const payload = {
    data: {
      type: "Answer",
      attributes: {
        value: value
      },
      relationships: {
        attendee: {
          data: {
            type: "Attendee",
            id: attendeeId
          }
        },
        question: {
          data: {
            type: "Question",
            id: questionId
          }
        }
      }
    }
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": authHeader,
        "Content-Type": "application/json",
        "Accept": "application/vnd.api+json"
      },
      body: JSON.stringify(payload)
    });
    return res.ok;
  } catch (e) {
    console.error("Error submitting answer to PCO API:", e);
    return false;
  }
}

export interface PcoAttendee {
  id: string;
  name: string;
  email: string;
  answers: { questionId: string; value: string | null }[];
}

export async function getPcoRegistrationAttendees(signupId: string): Promise<PcoAttendee[]> {
  const { appId, secret } = await getPcoCredentials();

  if (!appId || !secret) {
    throw new Error("PCO_APPLICATION_ID or PCO_SECRET settings not configured.");
  }

  const authHeader = `Basic ${Buffer.from(`${appId}:${secret}`).toString("base64")}`;
  const pcoHeaders = {
    "Authorization": authHeader,
    "Accept": "application/vnd.api+json"
  };

  // Fetch up to 100 attendees registered for that signup, including person
  const url = `https://api.planningcenteronline.com/registrations/v2/signups/${signupId}/attendees?per_page=100&include=person`;
  const res = await fetch(url, { headers: pcoHeaders });
  
  if (!res.ok) {
    throw new Error(`PCO API request returned HTTP status ${res.status}`);
  }

  const json = await res.json();
  const data = json.data || [];

  // Extract unique person IDs
  const personIds: string[] = [];
  const attendeePersonMap = new Map<string, string>(); // attendeeId -> personId

  data.forEach((att: any) => {
    const personId = att.relationships?.person?.data?.id;
    if (personId) {
      personIds.push(personId);
      attendeePersonMap.set(att.id, personId);
    }
  });

  const personInfoMap = new Map<string, { name: string; email: string }>();

  // Batch query person info from People API if we have any person IDs
  if (personIds.length > 0) {
    const peopleUrl = `https://api.planningcenteronline.com/people/v2/people?where[id]=${personIds.join(",")}&include=emails&per_page=100`;
    const peopleRes = await fetch(peopleUrl, { headers: pcoHeaders });
    if (peopleRes.ok) {
      const peopleJson = await peopleRes.json();
      const peopleData = peopleJson.data || [];
      const peopleIncluded = peopleJson.included || [];

      peopleData.forEach((person: any) => {
        const first = person.attributes?.first_name || "";
        const last = person.attributes?.last_name || "";
        const fullName = person.attributes?.name || `${first} ${last}`.trim();
        
        // Find emails for this person in included
        const emailRefs = person.relationships?.emails?.data || [];
        let emailAddress = "";

        for (const ref of emailRefs) {
          const emailObj = peopleIncluded.find((item: any) => item.type === "Email" && item.id === ref.id);
          if (emailObj?.attributes?.address) {
            emailAddress = emailObj.attributes.address;
            if (emailObj.attributes.primary) {
              break; // Stop at primary email
            }
          }
        }

        personInfoMap.set(person.id, {
          name: fullName,
          email: emailAddress.trim().toLowerCase()
        });
      });
    }
  }

  return data.map((att: any) => {
    const personId = attendeePersonMap.get(att.id);
    const info = personId ? personInfoMap.get(personId) : null;

    return {
      id: att.id,
      name: info?.name || "Unknown Name",
      email: info?.email || "",
      answers: []
    };
  });
}

export async function getPcoQuestions(signupId: string): Promise<{ id: string; title: string }[]> {
  const { appId, secret } = await getPcoCredentials();

  if (!appId || !secret) {
    throw new Error("PCO_APPLICATION_ID or PCO_SECRET settings not configured.");
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
