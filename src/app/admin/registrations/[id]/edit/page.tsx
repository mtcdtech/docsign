import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import RegistrationForm from "../../RegistrationForm";

export const dynamic = "force-dynamic";

interface EditRegistrationPageProps {
  params: {
    id: string;
  };
}

export default async function EditRegistrationPage({ params }: EditRegistrationPageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/");
  }
  const user = session.user as any;
  const isGlobalAdmin = user.role === "Admin";

  const signingRegistration = await prisma.signingRegistration.findUnique({
    where: { id: params.id }
  });

  if (!signingRegistration) {
    notFound();
  }

  // Validate OrgLeader permissions
  if (!isGlobalAdmin) {
    const isLeader = await prisma.organization.findFirst({
      where: {
        id: signingRegistration.organizationId,
        users: { some: { id: user.id } }
      }
    });
    if (!isLeader) {
      redirect("/admin/registrations");
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
    selectedTemplateIds = JSON.parse(signingRegistration.templateIdsJson) as string[];
  } catch (e) {
    console.warn(`Failed to parse templateIdsJson for registration ${signingRegistration.id}:`, e);
  }

  return (
    <div>
      <div style={{ marginBottom: "32px" }}>
        <h1>Edit Signing Registration Packet</h1>
        <p>Modify registration details and organize/sort the templates checklist.</p>
      </div>

      <div style={{ maxWidth: "700px" }}>
        <RegistrationForm
          organizations={organizations}
          templates={templates}
          registration={{
            id: signingRegistration.id,
            title: signingRegistration.title,
            slug: signingRegistration.slug,
            organizationId: signingRegistration.organizationId,
            templateIds: selectedTemplateIds,
            pcoSignupId: signingRegistration.pcoSignupId
          }}
        />
      </div>
    </div>
  );
}
