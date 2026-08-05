import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import SignForm from "./SignForm";

export const dynamic = "force-dynamic";

interface SignPageProps {
  params: {
    slug: string;
  };
  searchParams: {
    pco_attendee_id?: string;
  };
}

export default async function SignPage({ params, searchParams }: SignPageProps) {
  const { slug } = params;

  const template = await prisma.template.findUnique({
    where: { slug },
    include: {
      organization: true,
    },
  });

  if (!template) {
    notFound();
  }

  if (template.isArchived) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh", padding: "20px" }}>
        <div className="card-glass" style={{ maxWidth: "480px", width: "100%", padding: "40px", textAlign: "center", display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ fontSize: "48px" }}>📁</div>
          <h2 style={{ margin: 0, fontSize: "22px", fontWeight: "bold" }}>Template Archived</h2>
          <p style={{ margin: 0, fontSize: "14px", color: "var(--text-muted)", lineHeight: "1.6" }}>
            This waiver template has been archived and is no longer accepting public submissions. Please contact the administrator if you believe this is in error.
          </p>
          <a href="/" className="btn btn-secondary" style={{ marginTop: "10px" }}>
            Return Home
          </a>
        </div>
      </div>
    );
  }

  let portalTitle = "DocSign Portal";
  let portalLogoLight = "";
  let portalLogoDark = "";
  let masterLogoLight = "";
  let masterLogoDark = "";
  try {
    const settings = await prisma.setting.findMany();
    const settingsMap = settings.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);
    if (settingsMap["portal_title"]) portalTitle = settingsMap["portal_title"];
    if (settingsMap["portal_logo_light"]) portalLogoLight = settingsMap["portal_logo_light"];
    if (settingsMap["portal_logo_dark"]) portalLogoDark = settingsMap["portal_logo_dark"];
    if (settingsMap["master_logo_light"]) masterLogoLight = settingsMap["master_logo_light"];
    if (settingsMap["master_logo_dark"]) masterLogoDark = settingsMap["master_logo_dark"];
  } catch (e) {}

  const pdfUrl = `/api/download/templates/${template.pdfPath.split("/").pop()}`;

  return (
    <main style={{ padding: "20px", display: "flex", flexDirection: "column", width: "100%" }}>
      <div style={{ flex: 1 }}>
        <SignForm 
          template={template} 
          portalTitle={portalTitle} 
          portalLogoLight={portalLogoLight} 
          portalLogoDark={portalLogoDark} 
          masterLogoLight={masterLogoLight}
          masterLogoDark={masterLogoDark}
          orgLogoLight={template.organization.logoLight || null}
          orgLogoDark={template.organization.logoDark || null}
          pdfUrl={pdfUrl} 
          pcoAttendeeId={searchParams.pco_attendee_id || null} 
        />
      </div>
    </main>
  );
}
