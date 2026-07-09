import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import SignForm from "./SignForm";

export const dynamic = "force-dynamic";

interface SignPageProps {
  params: {
    slug: string;
  };
}

export default async function SignPage({ params }: SignPageProps) {
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
  let portalLogo = "";
  try {
    const settings = await prisma.setting.findMany();
    const settingsMap = settings.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);
    if (settingsMap["portal_title"]) portalTitle = settingsMap["portal_title"];
    if (settingsMap["portal_logo"]) portalLogo = settingsMap["portal_logo"];
  } catch (e) {}

  const pdfUrl = `/api/download/templates/${template.pdfPath.split("/").pop()}`;

  return (
    <main style={{ padding: "20px", display: "flex", flexDirection: "column", width: "100%" }}>
      <div style={{ flex: 1 }}>
        <SignForm template={template} portalTitle={portalTitle} portalLogo={portalLogo} pdfUrl={pdfUrl} />
      </div>
    </main>
  );
}
