"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    <div className="card-glass">
      <div style={{ textAlign: "center", marginBottom: "28px" }}>
        <h1 style={{ fontSize: "28px" }}>DocSign</h1>
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
