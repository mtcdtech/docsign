import type { Metadata } from "next";
import "./globals.css";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "DocSign Portal",
  description: "Self-hosted Digital PDF Signature Platform",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Load custom style configurations from the database
  let primaryColor = "#4f46e5";
  let primaryHover = "#4338ca";
  
  try {
    const settings = await prisma.setting.findMany();
    const settingsMap = settings.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);

    if (settingsMap["primary_color"]) primaryColor = settingsMap["primary_color"];
    if (settingsMap["primary_hover"]) primaryHover = settingsMap["primary_hover"];
  } catch (dbErr) {
    // Falls back to defaults if database is not ready
  }

  // Version number (Printed in the footer for tracking)
  const appVersion = "0.1.2";

  return (
    <html lang="en">
      <head>
        <style
          dangerouslySetInnerHTML={{
            __html: `
              :root {
                --primary-color: ${primaryColor};
                --primary-hover: ${primaryHover};
                --primary-glow: ${primaryColor}26; /* Add alpha hex */
              }
            `,
          }}
        />
      </head>
      <body>
        <div style={{ flex: 1 }}>{children}</div>
        <footer
          style={{
            textAlign: "center",
            padding: "24px",
            fontSize: "12px",
            color: "var(--text-muted)",
            borderTop: "1px solid var(--border-color)",
            marginTop: "auto",
          }}
        >
          <p>© {new Date().getFullYear()} DocSign Portal. All rights reserved.</p>
          <p style={{ marginTop: "4px", fontSize: "11px" }}>
            Version: <strong style={{ color: "var(--text-main)" }}>{appVersion}</strong>
          </p>
        </footer>
      </body>
    </html>
  );
}
