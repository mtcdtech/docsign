import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import SessionForm from "../../SessionForm";

export const dynamic = "force-dynamic";

interface EditSessionPageProps {
  params: {
    id: string;
  };
}

export default async function EditSessionPage({ params }: EditSessionPageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/");
  }
  const user = session.user as any;
  const isGlobalAdmin = user.role === "Admin";

  const signingSession = await prisma.signingSession.findUnique({
    where: { id: params.id }
  });

  if (!signingSession) {
    notFound();
  }

  // Validate OrgLeader permissions
  if (!isGlobalAdmin) {
    const isLeader = await prisma.organization.findFirst({
      where: {
        id: signingSession.organizationId,
        users: { some: { id: user.id } }
      }
    });
    if (!isLeader) {
      redirect("/admin/sessions");
    }
  }

  let organizations = [];
  let templates = [];

  if (isGlobalAdmin) {
    organizations = await prisma.organization.findMany({
      orderBy: { name: "asc" }
    });
    templates = await prisma.template.findMany({
      where: { isArchived: false },
      select: { id: true, title: true, organizationId: true },
      orderBy: { title: "asc" }
    });
  } else {
    organizations = await prisma.organization.findMany({
      where: {
        users: { some: { id: user.id } }
      },
      orderBy: { name: "asc" }
    });
    const orgIds = organizations.map(o => o.id);
    templates = await prisma.template.findMany({
      where: {
        organizationId: { in: orgIds },
        isArchived: false
      },
      select: { id: true, title: true, organizationId: true },
      orderBy: { title: "asc" }
    });
  }

  let selectedTemplateIds: string[] = [];
  try {
    selectedTemplateIds = JSON.parse(signingSession.templateIdsJson) as string[];
  } catch (e) {
    console.warn(`Failed to parse templateIdsJson for session ${signingSession.id}:`, e);
  }

  return (
    <div>
      <div style={{ marginBottom: "32px" }}>
        <h1>Edit Signing Session</h1>
        <p>Modify session details and organize/sort the templates checklist.</p>
      </div>

      <div style={{ maxWidth: "700px" }}>
        <SessionForm
          organizations={organizations}
          templates={templates}
          session={{
            id: signingSession.id,
            title: signingSession.title,
            slug: signingSession.slug,
            organizationId: signingSession.organizationId,
            templateIds: selectedTemplateIds
          }}
        />
      </div>
    </div>
  );
}
