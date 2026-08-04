import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import RegistrationDashboardClient from "./RegistrationDashboardClient";

export const dynamic = "force-dynamic";

interface RegistrationDashboardProps {
  params: {
    id: string;
  };
}

export default async function RegistrationDashboardPage({ params }: RegistrationDashboardProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/");
  }
  const user = session.user as any;
  const isGlobalAdmin = user.role === "Admin";

  const registration = await prisma.signingRegistration.findUnique({
    where: { id: params.id },
    include: {
      organization: {
        select: { name: true }
      }
    }
  });

  if (!registration) {
    notFound();
  }

  // Validate OrgLeader permissions
  if (!isGlobalAdmin) {
    const isLeader = await prisma.organization.findFirst({
      where: {
        id: registration.organizationId,
        users: { some: { id: user.id } }
      }
    });
    if (!isLeader) {
      redirect("/admin/registrations");
    }
  }

  // Parse template IDs
  let templateIds: string[] = [];
  try {
    templateIds = JSON.parse(registration.templateIdsJson) as string[];
  } catch (e) {
    console.error("Failed to parse template ids:", e);
  }

  const templates = await prisma.template.findMany({
    where: { id: { in: templateIds } },
    select: { id: true, title: true, pcoQuestionTitle: true }
  });

  // Re-sort templates to match selected template sequence order
  const sortedTemplates = templateIds
    .map((id) => templates.find((t) => t.id === id))
    .filter(Boolean) as typeof templates;

  return (
    <div>
      <RegistrationDashboardClient
        registration={{
          id: registration.id,
          title: registration.title,
          slug: registration.slug,
          organizationName: registration.organization.name,
          pcoSignupId: registration.pcoSignupId
        }}
        templates={sortedTemplates}
      />
    </div>
  );
}
