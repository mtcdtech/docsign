import type { Metadata } from "next";
import "./globals.css";
import { prisma } from "@/lib/prisma";

export async function generateMetadata() {
  let title = "DocSign Portal";
  try {
    const setting = await prisma.setting.findFirst({ where: { key: "portal_title" } });
    if (setting?.value) title = setting.value;
  } catch (e) {}
  return {
    title,
    description: "Self-hosted Digital PDF Signature Platform",
  };
}

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Load custom style configurations from the database
  let primaryColor = "#4f46e5";
  let primaryHover = "#4338ca";
  let portalTitle = "DocSign Portal";
  let portalLogo = "";
  let themeMode = "dark";
  
  try {
    const settings = await prisma.setting.findMany();
    const settingsMap = settings.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);

    if (settingsMap["primary_color"]) primaryColor = settingsMap["primary_color"];
    if (settingsMap["primary_hover"]) primaryHover = settingsMap["primary_hover"];
    if (settingsMap["portal_title"]) portalTitle = settingsMap["portal_title"];
    if (settingsMap["portal_logo"]) portalLogo = settingsMap["portal_logo"];
    if (settingsMap["theme_mode"]) themeMode = settingsMap["theme_mode"];
  } catch (dbErr) {
    // Falls back to defaults if database is not ready
  }

  // Version number (Printed in the footer for tracking)
  const appVersion = "0.10.12";

  return (
    <html lang="en" data-theme={themeMode}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              :root {
                --primary-color: ${primaryColor};
                --primary-hover: ${primaryHover};
                --primary-glow: ${primaryColor}26; /* Add alpha hex */
                --border-focus: ${primaryColor}66; /* Match focus states */
              }
              :root[data-theme="light"] {
                --border-focus: ${primaryColor}4d;
              }
            `,
          }}
        />
        {portalLogo ? (
          <link rel="icon" href={portalLogo} />
        ) : (
          <link rel="icon" href="/favicon.ico" />
        )}
      </head>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var storedTheme = localStorage.getItem('theme-mode');
                  if (storedTheme) {
                    document.documentElement.setAttribute('data-theme', storedTheme);
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", width: "100%" }}>
          <div style={{ flex: "1 0 auto" }}>{children}</div>
          <footer
            style={{
              textAlign: "center",
              padding: "24px",
              fontSize: "12px",
              color: "var(--text-muted)",
              borderTop: "1px solid var(--border-color)",
              flexShrink: 0,
            }}
          >
            <p>© {new Date().getFullYear()} {portalTitle}. All rights reserved.</p>
            <p style={{ marginTop: "4px", fontSize: "11px" }}>
              Version: <strong style={{ color: "var(--text-main)" }}>{appVersion}</strong>
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}
