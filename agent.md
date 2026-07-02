# DocSign - Agent Context & Project Guide

Welcome! This file provides critical context, architecture details, and project rules for the MTCD DocSign workspace. Pre-load this file into your brain whenever you start a conversation in this workspace.

---

## 1. Project Overview

**DocSign** is a self-hosted digital signature web application built for church organizations.
- **Admin/Leaders**: Upload template PDFs, visually place input/signature fields on pages, and configure settings (emails, SharePoint uploads).
- **Public/Members**: Access shared public links, fill out a responsive questionnaire, draw signatures (finger/mouse), and submit.
- **Backend Flow**: Combines form data and signatures, overlays them onto the template PDF via server-side drawing, and uploads/emails the final output.

---

## 2. Technology Stack & Key Files

- **Framework**: Next.js 14 (React 18) with App Router, styled with Vanilla CSS (`src/app/globals.css`).
- **Database**: Prisma ORM with SQLite (`prisma/dev.db`).
- **Auth**: NextAuth with Authentik OAuth 2.0 / OIDC and local admin fallback provider.
- **Integrations**:
  - `pdf-lib`: Server-side PDF manipulation & signature overlay.
  - `pdfjs-dist`: Visual page rendering in the admin builder.
  - `nodemailer`: SMTP email notifications using docassemble or Office 365 credentials.
  - Microsoft Graph REST APIs: Native SharePoint uploads.

---

## 3. Configuration & Env Paths

- **Environment variables**: `.env` (or `.env.local`) contains:
  - `DATABASE_URL="file:./dev.db"`
  - `NEXTAUTH_URL="http://localhost:3656"`
  - `NEXTAUTH_SECRET`
  - `AUTHENTIK_CLIENT_ID`, `AUTHENTIK_CLIENT_SECRET`, `AUTHENTIK_ISSUER`
  - `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID` (MS Graph credentials matching Admin Portal)
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (Mail server credentials)
- **Local API key**: `data/api-key.json` stores the token for role synchronization with the IAM portal.

---

## 4. Key Rules for Development

### Auto-Run
- SafeToAutoRun is **enabled** for all commands. Feel free to run dev servers, git operations, and install packages.
- Always check with the user before switching from development (`dev`) to production (`PRD`).

### Premium UI Standards
- The user is extremely detail-oriented about UI consistency, alignment, readability, spacing, fonts, and dark mode compatibility.
- Use clean layouts, cohesive theme-variable coloring, glassmorphism, and simple micro-animations.

### Versioning & CI/CD Pipeline
- Every change must use semantic versioning (`major.minor.bug`) starting from `0.1.0`.
- The current version is defined in `package.json` and printed dynamically in the footer of the webapp shell (`src/app/layout.tsx`).
- Trigger local-to-production pipeline by bumping the version, pushing to GitHub, and rebuilding/pulling from Portainer.
- Always explicitly print the version number of your changes in the final message.
