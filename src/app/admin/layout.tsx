import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AdminNavbar from "./AdminNavbar";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  // Secure admin portal - redirect to login if not authenticated
  if (!session?.user) {
    redirect("/");
  }

  const user = session.user as any;
  const isGlobalAdmin = user.role === "Admin";

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

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
      <AdminNavbar user={user} isGlobalAdmin={isGlobalAdmin} portalTitle={portalTitle} portalLogo={portalLogo} />
      <div style={{ flex: 1, padding: "40px 20px", maxWidth: "1200px", width: "100%", margin: "0 auto" }}>
        {children}
      </div>
    </div>
  );
}
