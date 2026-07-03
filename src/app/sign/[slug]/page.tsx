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
