import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import TemplateForm from "../../new/TemplateForm";

export const dynamic = "force-dynamic";

interface EditTemplatePageProps {
  params: {
    id: string;
  };
}

export default async function EditTemplatePage({ params }: EditTemplatePageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/");
  }
  const user = session.user as any;

  const template = await prisma.template.findUnique({
    where: { id: params.id }
  });

  if (!template) {
    notFound();
  }

  // Validate OrgLeader permissions
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

  const organizations = await prisma.organization.findMany({
    orderBy: { name: "asc" }
  });

  return (
    <div>
      <div style={{ marginBottom: "32px" }}>
        <h1>Edit Template Configuration</h1>
        <p>Modify email settings and update target SharePoint folders.</p>
      </div>

      <div style={{ maxWidth: "700px" }}>
        <TemplateForm
          organizations={organizations}
          template={{
            id: template.id,
            title: template.title,
            slug: template.slug,
            emailUser: template.emailUser,
            emailLeader: template.emailLeader,
            saveSharepoint: template.saveSharepoint,
            sharepointFolderId: template.sharepointFolderId,
            sharepointFolderName: template.sharepointFolderName,
            organizationId: template.organizationId,
          }}
        />
      </div>
    </div>
  );
}
