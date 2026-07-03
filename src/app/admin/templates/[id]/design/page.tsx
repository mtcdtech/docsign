import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import path from "path";
import DesignCanvas from "./DesignCanvas";

export const dynamic = "force-dynamic";

interface DesignTemplatePageProps {
  params: {
    id: string;
  };
}

export default async function DesignTemplatePage({ params }: DesignTemplatePageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/");
  }
  const user = session.user as any;

  const template = await prisma.template.findUnique({
    where: { id: params.id },
    include: { organization: true }
  });

  if (!template) {
    notFound();
  }

  // Verify leader permissions
  if (user.role !== "Admin") {
    const isLeader = await prisma.organization.findFirst({
      where: {
        id: template.organizationId,
        users: { some: { id: user.id } }
      }
    });
    if (!isLeader) {
      redirect("/admin/templates");
    }
  }

  // Resolve static URL path of uploaded PDF file
  const filename = path.basename(template.pdfPath);
  const pdfUrl = `/api/download/templates/${filename}`;

  return (
    <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "24px" }}>Visual PDF Form Designer</h1>
        <p style={{ fontSize: "14px" }}>
          Click anywhere on the PDF pages below to place input/signature fields. Manage property mappings and conditional logic rules in the panels.
        </p>
      </div>

      <DesignCanvas
        templateId={template.id}
        pdfUrl={pdfUrl}
        initialFieldsJson={template.fieldsJson}
        templateTitle={template.title}
      />
    </div>
  );
}
