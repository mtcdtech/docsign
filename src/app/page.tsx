import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getServerSession(authOptions);

  // If already logged in, redirect to Admin dashboard
  if (session?.user) {
    redirect("/admin");
  }

  let portalTitle = "DocSign";
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
    <main
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "80vh",
        padding: "20px",
      }}
    >
      <div style={{ width: "100%", maxWidth: "420px" }}>
        <LoginForm portalTitle={portalTitle} portalLogo={portalLogo} />
      </div>
    </main>
  );
}
