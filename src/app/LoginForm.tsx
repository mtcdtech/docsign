"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

interface LoginFormProps {
  portalTitle: string;
  portalLogo: string;
}

export default function LoginForm({ portalTitle, portalLogo }: LoginFormProps) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  React.useEffect(() => {
    const currentTheme = document.documentElement.getAttribute("data-theme") as "dark" | "light" || "dark";
    setTheme(currentTheme);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem("theme-mode", nextTheme);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError("Invalid username or password credentials.");
      } else {
        router.push("/admin");
        router.refresh();
      }
    } catch (err) {
      setError("An unexpected authentication error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleSSO = () => {
    signIn("authentik", { callbackUrl: "/admin" });
  };

  return (
    <div className="card-glass" style={{ position: "relative" }}>
      {/* Theme Toggle in Top Right */}
      <button
        type="button"
        onClick={toggleTheme}
        className="btn btn-secondary"
        style={{
          position: "absolute",
          top: "16px",
          right: "16px",
          padding: "8px",
          borderRadius: "50%",
          width: "36px",
          height: "36px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "1px solid var(--border-color)",
          background: "transparent",
        }}
        title="Toggle theme mode"
      >
        {theme === "dark" ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text-main)" }}>
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text-main)" }}>
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        )}
      </button>

      <div style={{ textAlign: "center", marginBottom: "28px" }}>
        {portalLogo ? (
          <img
            src={portalLogo}
            alt="Logo"
            style={{ maxHeight: "64px", maxWidth: "100%", objectFit: "contain", marginBottom: "12px", display: "inline-block" }}
          />
        ) : (
          <h1 style={{ fontSize: "28px" }}>{portalTitle}</h1>
        )}
        {portalLogo && <h1 style={{ fontSize: "22px", marginTop: "4px" }}>{portalTitle}</h1>}
        <p style={{ fontSize: "14px" }}>Identity Access Management Portal</p>
      </div>

      <button
        onClick={handleSSO}
        className="btn btn-primary"
        style={{
          width: "100%",
          padding: "14px",
          marginBottom: "20px",
          background: "linear-gradient(135deg, var(--primary-color), var(--primary-hover))",
        }}
      >
        Sign In with Authentik SSO
      </button>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          margin: "20px 0",
          color: "var(--text-muted)",
          fontSize: "12px",
          textTransform: "uppercase",
        }}
      >
        <div style={{ flex: 1, height: "1px", background: "var(--border-color)" }}></div>
        <span style={{ padding: "0 12px" }}>or credentials fallback</span>
        <div style={{ flex: 1, height: "1px", background: "var(--border-color)" }}></div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div className="form-group">
          <label className="form-label">Username</label>
          <input
            type="text"
            className="form-input"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="admin"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Password</label>
          <input
            type="password"
            className="form-input"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        {error && (
          <div
            style={{
              color: "#ef4444",
              fontSize: "13px",
              fontWeight: "bold",
              background: "rgba(239, 68, 68, 0.1)",
              padding: "10px",
              borderRadius: "6px",
              border: "1px solid rgba(239, 68, 68, 0.15)",
            }}
          >
            ⚠️ {error}
          </div>
        )}

        <button
          type="submit"
          className="btn btn-secondary"
          disabled={loading}
          style={{ width: "100%", padding: "12px" }}
        >
          {loading ? "Authenticating..." : "Login"}
        </button>
      </form>
    </div>
  );
}
