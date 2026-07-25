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
- Implemented and pushed a fix (v0.10.25) in NextAuth callbacks to:
  - Populate `session.user.name` and `token.name` with `dbUser.msName || dbUser.name` instead of defaulting to the raw OIDC user name.
  - Preserve display names for reconciled shared Microsoft accounts (e.g. "Praise & Worship Team", "Contemporary Music Team").
  - Prevent role downgrades to `"User"` for legitimate database `Admin`/`OrgLeader` users.
  - Enforce strict access control by blocking logins (returning `false`) for unregistered users or users with `"User"` role.
- Successfully committed, pushed to GitHub, and deployed to production Synology via the Portainer stack.
- Implemented comprehensive Form Designer improvements:
  - Multi-field selection using Shift/Cmd click.
  - Alignment actions (Left, Right, Top, Bottom) and Dimension Matching actions (Width, Height).
  - Distribute actions (Horizontally, Vertically) and whitespace gap spacing actions (Gap H, Gap V).
  - Parallel multi-field dragging and parallel keyboard deletions.
  - Reordered toolbox (Signer Identity fields moved to top).
  - Enforced required constraint on `signer_name` and `signer_email` and added save-validation.
  - Direct sidebar Properties Editor card (deprecating the pop-up modal).
  - Unique system variable ID auto-calculation from Display Name (label) with incrementing unique suffixes (and made strictly read-only to avoid manual duplication).
  - Direct 1.2 page scaling factor alignment to eliminate text field width discrepancies.

## What is In Progress
- Live user verification of session display names for shared accounts.
- Live user verification of the new Form Designer alignment/editing features.

## Known Risks & Assumptions
- **OAuth Callback Domain**: NextAuth and Authentik are configured to work against `https://docsign.server.mtcd.org`. Any local test verification of SSO logins will fail or require mocking.
- **Database Schema**: A SQLite local db needs to be initialized via Prisma generate/push.
- **Mac vs. Linux (ARM64 vs. AMD64)**: Local dev is on Apple Silicon (ARM64 macOS), while production target Synology Docker might be AMD64. Build configurations should be mindfully cross-compatible.
