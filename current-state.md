# DocSign - Current State

## Architecture Direction
- **Framework**: Next.js 14 (React 18) with App Router.
- **Database**: Prisma ORM with SQLite (`prisma/dev.db`).
- **Auth**: NextAuth with Authentik OAuth 2.0 / OIDC and credentials-based local admin fallback.
- **Key Integrations**:
  - `pdf-lib` for server-side PDF manipulation & signature overlay.
  - `pdfjs-dist` for visual page rendering in the admin builder.
  - `nodemailer` for SMTP email notifications.
  - Microsoft Graph REST APIs for SharePoint uploads.
- **Deployment**: Synology Docker container behind reverse proxy (Nginx SSL) at `https://docsign.server.mtcd.org`. Exposed via port `3656` in container.

## Active Branch & Deployment Context
- **Active Branch**: `main` (Git repository newly initialized and connected to origin remote `https://github.com/mtcdtech/docsign.git`).
- **Deployment Mode**: **Deploy First** (configured in `.agents/rules/project-test-mode.md`). The project does not support reliable local end-to-end validation due to Authentik OAuth/OIDC callbacks, MS Graph OAuth, and email dependencies.

## What is Currently Working
- The repository has been successfully pulled/cloned, checked out to `main` branch, and inspected.
- Verified and compiled Next.js build locally (`npm run build`).
- Switched the Authentik DocSign provider authentication flow to the standard `default-authentication-flow` to support both Microsoft and Planning Center logins without OTP verification codes.
- Implemented and pushed a fix (v0.10.23) in the NextAuth `signIn` callback to:
  - Preserve display names for reconciled shared Microsoft accounts (`dbUser.name` instead of individual OIDC `user.name`).
  - Prevent role downgrades to `"User"` for legitimate database `Admin`/`OrgLeader` users lacking corresponding Authentik OIDC groups.
  - Enforce access control by blocking logins (returning `false`) for users who do not exist in the database and are not system administrators.
- Successfully committed, pushed to GitHub, and deployed to production Synology via the Portainer stack.

## What is In Progress
- Verification of the new authentication and access control behavior in production.

## Known Risks & Assumptions
- **OAuth Callback Domain**: NextAuth and Authentik are configured to work against `https://docsign.server.mtcd.org`. Any local test verification of SSO logins will fail or require mocking.
- **Database Schema**: A SQLite local db needs to be initialized via Prisma generate/push.
- **Mac vs. Linux (ARM64 vs. AMD64)**: Local dev is on Apple Silicon (ARM64 macOS), while production target Synology Docker might be AMD64. Build configurations should be mindfully cross-compatible.
