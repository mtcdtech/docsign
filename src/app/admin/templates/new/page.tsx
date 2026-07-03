import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import TemplateForm from "./TemplateForm";

export const dynamic = "force-dynamic";

export default async function NewTemplatePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/");
  }
  const user = session.user as any;

  let organizations = [];

  if (user.role === "Admin") {
    organizations = await prisma.organization.findMany({
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      },
      orderBy: { name: "asc" }
    });
  } else {
    // OrgLeader: only see organizations they belong to
    organizations = await prisma.organization.findMany({
      where: {
        users: { some: { id: user.id } }
      },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      },
      orderBy: { name: "asc" }
    });
  }

  // If org leader has no organizations, they can't create templates yet
  if (organizations.length === 0) {
    if (user.role === "Admin") {
      return (
        <div className="card-glass" style={{ maxWidth: "600px", margin: "40px auto", textAlign: "center" }}>
          <h2>No Organizations Found</h2>
          <p style={{ marginTop: "12px", marginBottom: "20px" }}>
            There are no church organizations in the database yet. As an Administrator, please synchronize with the IAM registry first.
          </p>
          <a href="/admin" className="btn btn-primary" style={{ display: "inline-block", width: "auto" }}>
            Go to Dashboard & Sync IAM
          </a>
        </div>
      );
    }

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
