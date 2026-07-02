import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
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

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <AdminNavbar user={user} isGlobalAdmin={isGlobalAdmin} />
      <div style={{ flex: 1, padding: "40px 20px", maxWidth: "1200px", width: "100%", margin: "0 auto" }}>
        {children}
      </div>
    </div>
  );
}
