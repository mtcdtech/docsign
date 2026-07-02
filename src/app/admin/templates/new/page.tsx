import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import TemplateForm from "./TemplateForm";

export const dynamic = "force-dynamic";

export default async function NewTemplatePage() {
  const session = await getServerSession(authOptions);
  const user = session!.user as any;

  let organizations = [];

  if (user.role === "Admin") {
    organizations = await prisma.organization.findMany({
      orderBy: { name: "asc" }
    });
  } else {
    // OrgLeader: only see organizations they belong to
    organizations = await prisma.organization.findMany({
      where: {
        users: { some: { id: user.id } }
      },
      orderBy: { name: "asc" }
    });
  }

  // If org leader has no organizations, they can't create templates yet
  if (organizations.length === 0) {
    return (
      <div className="card-glass" style={{ maxWidth: "600px", margin: "40px auto", textAlign: "center" }}>
        <h2>Access Denied</h2>
        <p style={{ marginTop: "12px" }}>
          You are not currently assigned to any church organizations. Please contact an Administrator to sync your departments.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: "32px" }}>
        <h1>Create Form Template</h1>
        <p>Define public URLs, select destination SharePoint folders, and upload PDF base templates.</p>
      </div>

      <div style={{ maxWidth: "700px" }}>
        <TemplateForm organizations={organizations} />
      </div>
    </div>
  );
}
