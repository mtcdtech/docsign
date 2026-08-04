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
- Implemented Phase D1 & D2 canonical `mtcd_person_id` support (v0.11.0):
  - Prisma Schema: Added `mtcdPersonId String? @unique` to `User` model in [schema.prisma](file:///Users/benny2168/Antigravity/docsign/prisma/schema.prisma).
  - NextAuth Callbacks: Updated `AuthentikProvider.profile()` to forward `mtcdPersonId` and `mtcdPersonIdHistory`. Implemented 3-tier lookup order (1. current PID, 2. PID history migration, 3. email fallback) and PID dual-writing in `signIn` callback in [route.ts](file:///Users/benny2168/Antigravity/docsign/src/app/api/auth/[...nextauth]/route.ts).
  - Backfill Script: Added `scripts/backfill-mtcd-person-ids.ts` for unified user export matching and PID backfills.
- Implemented and pushed a fix (v0.10.25) in NextAuth callbacks to:
  - Populate `session.user.name` and `token.name` with `dbUser.msName || dbUser.name` instead of defaulting to the raw OIDC user name.
  - Preserve display names for reconciled shared Microsoft accounts (e.g. "Praise & Worship Team", "Contemporary Music Team").
  - Prevent role downgrades to `"User"` for legitimate database `Admin`/`OrgLeader` users.
  - Enforce strict access control by blocking logins (returning `false`) for unregistered users or users with `"User"` role.
- Successfully committed, pushed to GitHub, and deployed to production Synology via the Portainer stack.
- Implemented comprehensive Form Designer improvements (v0.10.26 - v0.10.28):
  - Multi-field selection using Shift/Cmd click.
  - Alignment actions (Left, Right, Top, Bottom) and Dimension Matching actions (Width, Height).
  - Distribute actions (Horizontally, Vertically) and whitespace gap spacing actions (Gap H, Gap V).
  - Parallel multi-field dragging and parallel keyboard deletions.
  - Reordered toolbox (Signer Identity fields moved to top).
  - Enforced required constraint on `signer_name` and `signer_email` and added save-validation.
  - Direct sidebar Properties Editor card (deprecating the pop-up modal).
  - Unique system variable ID auto-calculation from Display Name (label) with incrementing unique suffixes (and made strictly read-only to avoid manual duplication).
  - Direct 1.2 page scaling factor alignment to eliminate text field width discrepancies.
- Completed Pre-Flip Checklist for docsign: verified version (v0.11.1), confirmed all 31 privileged users (5 Admin, 26 OrgLeader) are fully linked to Microsoft identities, and confirmed no unlinked shared mailbox grants exist.
- Successfully executed database backfill in production container, populating `mtcdPersonId` for 62 existing users (with 5 expected conflicts handled).

- Completed Form Designer & Public Form Filler Enhancements (v0.12.0 - v0.12.11):
  - Database Schema: Added `emailParent`, `isDraft`, `emailedParent` columns and applied schema push.
  - SMTP: Fixed transporter TLS configuration, removing SSLv3. Added auto-configuration for Azure Communication Services SMTP, routing emails via `smtp.azurecomm.net` using the Entra ID Application ID and Tenant ID credentials if `AZURE_AD_CLIENT_ID` variables are set, preserving `docsign@mtcd.org` as the exact sender. Purged all hardcoded `announcements@mtcd.org` defaults. Added detailed diagnostic logging for SMTP successes and failures to capture target recipient emails and subjects. Integrated system audit logging for all sent email events (signer, custom copies, parent, and leader notifications) to track delivery targets.
  - Designer: Implemented debounced auto-saving, persistent headers status indicator, custom unsaved warning prompt, click-and-drag multi-field selection box with proper pixel unit mappings, canvas background click-to-deselect with a drag completion delay check to avoid race conditions, and onboarding tour.
  - Signer Form: Added db-backed drafts auto-saving, "Reset Form" button with custom confirmation modal. Added server-side GET draft restoring, and synchronous exit saves when clicking "Exit".
  - Admin: Extracted recent submissions to a client component. Moved system audit logs from Admin Settings to a dashboard card component `AuditLogsDashboardClient` (default collapsed) with type filter buttons (All, Logins, Creations & Edits, Deletions) and search bar.
  - Preview Portal: Extracted the preview modal to a shared portal-based `FormPreviewModal` component that breaks out of parent container styles and renders at body root with `maxHeight: "85vh"` boundaries and `overflow: "hidden"` to enable scrolling of multiple pages correctly.

## What is In Progress
- Final verification of v0.12.11 in production environment.

## Known Risks & Assumptions
- **OAuth Callback Domain**: NextAuth and Authentik are configured to work against `https://docsign.server.mtcd.org`. Any local test verification of SSO logins will fail or require mocking.
- **Mac vs. Linux (ARM64 vs. AMD64)**: Local dev is on Apple Silicon (ARM64 macOS), while production target Synology Docker might be AMD64. Build configurations should be mindfully cross-compatible.
