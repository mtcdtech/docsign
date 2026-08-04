import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import SessionForm from "../SessionForm";

export const dynamic = "force-dynamic";

export default async function NewSessionPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/");
  }
  const user = session.user as any;
  const isGlobalAdmin = user.role === "Admin";

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

  return (
    <div>
      <div style={{ marginBottom: "32px" }}>
        <h1>Create Signing Session</h1>
        <p>Establish a unified signing session containing sequential form templates.</p>
      </div>

      <div style={{ maxWidth: "700px" }}>
        <SessionForm
          organizations={organizations}
          templates={templates}
        />
      </div>
    </div>
  );
}
