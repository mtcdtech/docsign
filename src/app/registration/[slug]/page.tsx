import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import RegistrationSignForm from "./RegistrationSignForm";

export const dynamic = "force-dynamic";

interface RegistrationPageProps {
  params: {
    slug: string;
  };
  searchParams: {
    pco_attendee_id?: string;
  };
}

export default async function RegistrationPage({ params, searchParams }: RegistrationPageProps) {
  const { slug } = params;

  const signingRegistration = await prisma.signingRegistration.findUnique({
    where: { slug },
    include: {
      organization: true
    }
  });

  if (!signingRegistration || signingRegistration.isArchived) {
    notFound();
  }

  // Parse template sequence IDs
  let templateIds: string[] = [];
  try {
    templateIds = JSON.parse(signingRegistration.templateIdsJson) as string[];
  } catch (e) {
    console.error("Failed to parse template IDs sequence:", e);
  }

  if (templateIds.length === 0) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh", padding: "20px" }}>
        <div className="card-glass" style={{ maxWidth: "480px", width: "100%", padding: "40px", textAlign: "center" }}>
          <div style={{ fontSize: "48px", marginBottom: "20px" }}>⚠️</div>
          <h2 style={{ fontSize: "20px", fontWeight: "bold", margin: "0 0 10px 0" }}>Empty Signing Registration</h2>
          <p style={{ fontSize: "14px", color: "var(--text-muted)", margin: 0 }}>
            This signing registration packet does not contain any waiver templates. Please contact the administrator.
          </p>
        </div>
      </div>
    );
  }

  // Query templates in this registration
  const templates = await prisma.template.findMany({
    where: {
      id: { in: templateIds },
      isArchived: false
    },
    include: {
      organization: true
    }
  });

  // Sort them to match templateIds sequence order exactly
  const sortedTemplates = templateIds
    .map((id) => templates.find((t) => t.id === id))
    .filter(Boolean) as any[];

  if (sortedTemplates.length === 0) {
    notFound();
  }

  // Query global settings
  let portalTitle = "DocSign Portal";
  let portalLogoLight = "";
  let portalLogoDark = "";
  try {
    const settings = await prisma.setting.findMany();
    const settingsMap = settings.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);
    if (settingsMap["portal_title"]) portalTitle = settingsMap["portal_title"];
    if (settingsMap["portal_logo_light"]) portalLogoLight = settingsMap["portal_logo_light"];
    if (settingsMap["portal_logo_dark"]) portalLogoDark = settingsMap["portal_logo_dark"];
  } catch (e) {}

  return (
    <main style={{ padding: "20px", display: "flex", flexDirection: "column", width: "100%" }}>
      <div style={{ flex: 1 }}>
        <RegistrationSignForm
          registration={signingRegistration}
          templates={sortedTemplates}
          portalTitle={portalTitle}
          portalLogoLight={portalLogoLight}
          portalLogoDark={portalLogoDark}
          orgLogoLight={signingRegistration.organization.logoLight || null}
          orgLogoDark={signingRegistration.organization.logoDark || null}
          pcoAttendeeId={searchParams.pco_attendee_id || null}
        />
      </div>
    </main>
  );
}
