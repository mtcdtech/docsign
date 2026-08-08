# DocSign - Change Tracker

## Running Log of Changes

### [2026-07-23] Repository Initialization & Setup
- **Action**: Cloned/pulled the existing repository `docsign` from `mtcdtech/docsign` via HTTPS.
- **Git Branch**: Initialized tracking branch `main`.
- **Memory Files**: Added `current-state.md`, `notes-next-session.md`, and `change-tracker.md` to document the workspace.
- **Verification**: Verified Next.js configuration, Prisma schema, and Portainer deployment script.
- **Status**: Completed.

### [2026-07-23] Authentication Login Flow & Display Name Fixes (v0.10.22)
- **Authentik Provider Flow**: Updated DocSign's Authentik provider `authentication_flow` to the standard `default-authentication-flow` to support both Microsoft and Planning Center logins without OTP verification codes.
- **Name Preservation**: Modified the NextAuth `signIn` callback in `src/app/api/auth/[...nextauth]/route.ts` to use `dbUser.name || user.name`, preventing individual SSO display names from overwriting reconciled shared Microsoft account names in the database.
- **Role Downgrade Fix**: Modified the NextAuth `signIn` callback to check if `dbUser.role` is `Admin` or `OrgLeader` and preserve it rather than downgrading to `User` when Authentik groups are missing.
- **Build Verification**: Ran local verification build `npm run build` which succeeded.
- **Deployment**: Pushed to GitHub and successfully triggered a production stack redeploy on Synology Portainer using `deploy_portainer.py`.
- **Status**: Completed.

### [2026-07-23] Access Control Enforced for Unregistered Users (v0.10.23)
- **Access Control Block**: Updated NextAuth `signIn` callback in `src/app/api/auth/[...nextauth]/route.ts` to deny login (returning `false`) for users who do not exist in the database (indicating they were not explicitly granted access in the central IAM portal) and are not system administrators.
- **Build Verification**: Ran local build `npm run build` which compiled cleanly.
- **Deployment**: Committed, pushed to GitHub, and successfully triggered a stack update on Synology Portainer.
- **Status**: Completed.

### [2026-07-23] Strict Login Block for User Role Users (v0.10.24)
- **Strict Role Block**: Added check to NextAuth `signIn` callback in `src/app/api/auth/[...nextauth]/route.ts` to block login (returning `false`) for any user who resolves to the `"User"` role, even if they already exist in the database (e.g. from previous logins or syncs). Only `"Admin"` and `"OrgLeader"` roles are allowed access.
- **Build Verification**: Verified that local build `npm run build` succeeds.
- **Deployment**: Committed, pushed to GitHub, and deployed stack on Synology Portainer.
- **Status**: Completed.

### [2026-07-24] Session Display Name Mapping Fix for Shared Accounts (v0.10.25)
- **Root Cause Fix**: Updated NextAuth `jwt` and `session` callbacks in `src/app/api/auth/[...nextauth]/route.ts`. Assigned `session.user.name = token.name` and initialized `token.name = dbUser.msName || dbUser.name`. This ensures that even when individual PCO users log into shared accounts, the session display name explicitly reflects the shared account name (e.g. "Praise & Worship Team") rather than the individual's name (e.g. "Mervin Abraham").
- **Build Verification**: Verified that local build `npm run build` compiles cleanly.
- **Deployment**: Committed, pushed to GitHub, and deployed stack update on Synology Portainer.
- **Status**: Completed, pending live verification.

### [2026-07-25] Form Designer Enhancements & Scaling Alignments (v0.10.26)
- **Multi-Selection**: Implemented multi-field selection using modifier keys (`Shift`/`Cmd`/`Ctrl`) in [DesignCanvas.tsx](file:///Users/benny2168/Antigravity/docsign/src/app/admin/templates/[id]/design/DesignCanvas.tsx). Highlighted anchor vs secondary fields.
- **Alignment Toolbar**: Added buttons in the sidebar for Align Left, Align Right, Align Top, Align Bottom, Match Width, and Match Height.
- **Parallel Dragging**: Modified drag coordinate calculations so all selected fields drag together in parallel.
- **Embedded Properties Editor**: Removed the modal pop-up for property configuration and placed all inputs directly in the sidebar Properties Editor card. Enables real-time reactive editing of fields.
- **Toolbox Reordering**: Moved Signer fields to the top of the toolbox list.
- **Signer Validation**: Signer name and email are now strictly required to be placed on every template layout before saving.
- **Layout Scale Correction**: Standardized the designer canvas rendering scale to `1.2` to eliminate text input visual discrepancies with live forms.
- **Build Verification**: Next.js production build (`npm run build`) compiles cleanly.
- **Status**: Completed, ready for deployment.

### [2026-07-25] Distribute/Spacing Tools & System Variable ID Auto-Generation (v0.10.27)
- **Distribute & Spacing Actions**: Implemented four layout actions (Distribute Horizontally, Distribute Vertically, Spacing Gap H, Spacing Gap V) in [DesignCanvas.tsx](file:///Users/benny2168/Antigravity/docsign/src/app/admin/templates/[id]/design/DesignCanvas.tsx) for 3 or more selected fields.
- **Variable ID Auto-Calculation**: Enabled automatic conversion of display names (labels) into unique snake_case variable IDs inside `handleUpdateFieldProperty`, automatically appending incrementing numeric suffixes if a duplicate is found in the current layout context.
- **Build Verification**: Local Next.js build compilation (`npm run build`) completed successfully with zero TypeScript, syntax, or compilation warnings.
- **Status**: Completed, ready for deployment.

### [2026-07-25] Read-Only System Variable ID (v0.10.28)
- **Read-Only Constraint**: Made the System Variable ID input card strictly read-only (`readOnly` attribute and styling adjustment) inside [DesignCanvas.tsx](file:///Users/benny2168/Antigravity/docsign/src/app/admin/templates/[id]/design/DesignCanvas.tsx). System Variable IDs are now fully managed automatically by the Display Name auto-calculation logic to prevent naming collisions and duplicate ID errors.
- **Build Verification**: Local Next.js build compilation (`npm run build`) completed successfully with zero TypeScript, syntax, or compilation warnings.
- **Status**: Completed, ready for deployment.

### [2026-07-25] Canonical mtcd_person_id Integration (Phase D1 & D2 - v0.11.0)
- **Prisma Schema (D1.1)**: Added `@unique` optional `mtcdPersonId` column to `User` model in `prisma/schema.prisma`.
- **Auth Profile & 3-Tier Lookup (D1.2 & D1.3)**: Updated `AuthentikProvider.profile()` in `route.ts` to capture `mtcd_person_id` and `mtcd_person_id_history`. Updated `signIn` callback to use 3-tier lookup order (1. current PID, 2. PID history migration, 3. email fallback) and dual-write `mtcdPersonId` when updated.
- **Backfill Script (D2)**: Added `scripts/backfill-mtcd-person-ids.ts` for unified user export PID backfilling.
- **Build Verification**: Local Next.js production build (`npm run build`) completed successfully.
- **Status**: Completed, deployed to production.

### [2026-07-27] OIDC Scope and Shared Mailbox Role Unification (v0.11.1)
- **OIDC Scope**: Added `mtcd_person` to OIDC scopes in `[...nextauth]/route.ts` so `mtcd_person_id` claims arrive from Authentik.
- **Shared Mailbox Auth**: Handled Microsoft shared mailbox detection and role mappings, preventing standard users from getting downgraded and allowing authorized shared accounts access.
- **Status**: Completed, deployed to production.

### [2026-08-02] Pre-Flip Readiness Analysis & Database Backfill (v0.11.1 verification)
- **Preflight Check**: Queried central IAM portal `docsign-users` and `users` exports. Verified all 31 privileged users (5 Admin, 26 OrgLeader) are fully linked to Microsoft identities. Zero unlinked users.
- **Database Backfill**: Successfully executed `backfill-prod.js` inside the production Docker container. Backfilled 62 user records with their correct `mtcdPersonId`s, handling 5 expected duplicate email/alias conflicts safely.
- **Readiness Verdict**: 100% ready for the `compat_mode: false` flip.

### [2026-08-03] Visual Designer & Form Filling Enhancements (v0.12.0)
- **Database Schema**: Modified `SignedDocument` to make `signedPdfPath` optional and added `isDraft` and `emailedParent` boolean fields. Added `emailParent` boolean field to `Template` model. Synchronized schema changes with database.
- **Transporter TLS Fix**: Removed `ciphers: "SSLv3"` cipher suites restriction in `mail.ts` to allow standard TLS 1.2/1.3 handshakes, resolving SMTP failures with Microsoft Office 365.
- **Template Integration Settings**: Added "Email copy to Parent/Guardian" integration option toggle. Updated edit templates page and template CRUD API routes (`POST`/`PATCH`) to support the new field.
- **Form Designer Enhancements**:
  - Implemented auto-saving loop in `DesignCanvas.tsx` that debounces template layout updates and displays auto-save status feedback.
  - Implemented a prominent, floating green status Toast in the top right of the designer canvas to present save states and autohide after 3 seconds.
  - Moved the manual "Save Fields" button to the top of the left sidebar, sticky above the toolbox library.
  - Implemented a custom leave warning dialog that intercepts page transitions or reloads if there are unsaved changes.
  - Implemented click-and-drag selection bounding box highlight (fixed overlay coordinates handler) to select multiple fields in parallel.
  - Added click-to-deselect support when clicking directly on the canvas background.
  - Added an interactive first-time onboarding tutorial step-by-step help tour for toolbox library sections.
- **Public Form Filler & Drafts**:
  - Added debounced drafts saving from the public signer form using new draft management API endpoints (`POST`/`PATCH`/`DELETE` under `/api/sign/[id]/draft`).
  - Added auto-resolution fallback to scan `formDataJson` variables for the signer's name in draft save endpoints, avoiding "Anonymous Draft" logs when a name field has been typed.
  - Added a "Reset Form" button on the signer page with a custom React confirmation modal that clears progress, deletes drafts, and reloads the template layout.
- **Dashboard & History**:
  - Updated admin dashboard to display Drafts in Progress statistics and highlight drafts in the recent submissions list.
  - Removed "Fields Payload" column and the "View Mapped Fields" details element from the templates history table cards.
  - Made history list table rows clickable, triggering a custom modal overlay presenting a detailed metadata preview and list of form responses (works for both drafts and completed documents).
- **Build Verification**: Local Next.js build compilation completed successfully.
- **Status**: Completed, ready for deployment.

### [2026-08-03] Dashboard Previews, Searchable Logs, IAM Sync & Selection Fixes (v0.12.2)
- **Continuous Save Notification**: Rendered a persistent status indicator in the top right header of the template designer (displaying Saved, Saving..., or Unsaved changes) linked to the auto-save loop.
- **Actual Form State Preview Modal**: Built a client-side dynamic preview modal that loads PDF.js dynamically, renders page canvases, and overlays signature images and pre-filled text entries at their correct coordinate percentages.
- **Dashboard Preview Modal & Client Integration**: Extracted the recent submissions table from the dashboard server component into a client component `SubmissionsListClient.tsx`. Mounted the dynamic FormPreviewModal on row-clicks to allow direct inspection of both completed forms and drafts in progress.
- **Move Sync IAM Button**: Removed the Sync IAM button from the main dashboard overview header and integrated it as a primary action next to "Sync Directory" inside the Settings Panel "User Directory" tab.
- **Searchable Audit Logs**: Split the Audit History settings tab into stacked card sections: "User Sign-In Logs" and "Template & System Activity Logs", both searchable via local text filter inputs. Added Prisma audit log creation on template deletion.
- **Fix Drag Selection Box**: Added `px` unit string conversions to CSS positioning parameters (left, top, width, height) of the drag-selection outline overlay, and added `userSelect: "none"` styles to prevent browser text-selection blocks.
- **Next.js Production Build**: Marked `/api/admin/audit` route as dynamic to avoid static pre-generation warnings during webpack phase. Production build compiled cleanly with zero compilation errors.
- **Status**: Completed.

### [2026-08-03] Portal Previews & Dashboard Audit Logs with Type Filters (v0.12.3)
- **Portal Previews**: Extracted the dynamic `FormPreviewModal` into a shared component under `src/components/FormPreviewModal.tsx` and wrapped it in a React Portal (`createPortal(..., document.body)`). This ensures the modal renders at the body root, bypassing any containing block styles (like parent `backdrop-filter: blur` or `transform`) that caused the preview to stretch, distort, or cut off inside iframe or card panels.
- **Form Templates History Modal**: Updated the history preview modal in `TemplatesListClient.tsx` to use the new actual form state `FormPreviewModal` component, rendering the formatted PDF pages with signer variables instead of simple raw text lists.
- **Dashboard Audit Logs**: Relocated system audit logs from the Admin Settings subtab directly into a primary dashboard card component `AuditLogsDashboardClient.tsx`.
- **Event Filter Buttons**: Added quick-filter toggle buttons (All, Logins, Creations & Edits, Deletions) to the dashboard audit trail card, allowing instant log isolation.
- **Status**: Completed.

### [2026-08-03] Selection Drag Fix, Modal Proportions & Collapsed Audit Log (v0.12.4)
- **Selection Drag Race Fix**: Resolved the browser native click-event race condition where releasing a selection drag immediately fired a click on the parent canvas overlay container, resetting selected fields. Introduced a transient `dragJustCompletedRef` flag in [DesignCanvas.tsx](file:///Users/benny2168/Antigravity/docsign/src/app/admin/templates/%5Bid%5D/design/DesignCanvas.tsx) to block canvas overlay click actions immediately after drag releases.
- **Natural Canvas Scaling**: Removed the hardcoded `aspectRatio: "8.5 / 11"` wrapper limit and changed canvas styling to `width: "100%", height: "auto"` inside [FormPreviewModal.tsx](file:///Users/benny2168/Antigravity/docsign/src/components/FormPreviewModal.tsx). This allows the canvas to render with perfect, uncompressed aspect proportions for all PDF page dimensions.
- **Template list History Preview Fix**: Changed the clicked preview row state in [TemplatesListClient.tsx](file:///Users/benny2168/Antigravity/docsign/src/app/admin/templates/TemplatesListClient.tsx) to hold both `submission` and `template` properties, preventing client-side `Cannot read properties of undefined (reading 'pdfPath')` errors when passing arguments to `FormPreviewModal`.
- **Collapsed Audit Log**: Renamed the Audit section to "System Audit Log" and implemented default-collapsed state management inside [AuditLogsDashboardClient.tsx](file:///Users/benny2168/Antigravity/docsign/src/app/admin/AuditLogsDashboardClient.tsx), exposing an interactive expand/collapse toggle header.
- **Status**: Completed.

### [2026-08-03] Preview Modal Scrolling, Exit Save & DB Draft Restoring (v0.12.5)
- **Preview Scrolling**: Fixed cut-off issues inside [FormPreviewModal.tsx](file:///Users/benny2168/Antigravity/docsign/src/components/FormPreviewModal.tsx) by adding `minHeight: 0` style to the scrollable canvas container, forcing standard browser layout engines to render the `overflowY: "auto"` vertical scrollbar cleanly.
- **DB Draft Restoring**: Added a `GET` endpoint in [/api/sign/[id]/draft/route.ts](file:///Users/benny2168/Antigravity/docsign/src/app/api/sign/%5Bid%5D/draft/route.ts) that allows fetching active draft variables from database by `draftId`. Hooked initial mount `useEffect` in [SignForm.tsx](file:///Users/benny2168/Antigravity/docsign/src/app/sign/%5Bslug%5D/SignForm.tsx) to query this API if a `draftId` exists in localStorage, automatically syncing server draft values back to client forms. If the server draft no longer exists (e.g. was deleted or promoted), state parameters and localStorage cache keys are cleanly purged.
- **Exit Auto-Save**: Implemented immediate save action inside [SignForm.tsx](file:///Users/benny2168/Antigravity/docsign/src/app/sign/%5Bslug%5D/SignForm.tsx) which executes instant fetch synchronizations before redirecting when user clicks "✕ Exit", preventing losing keystrokes typed within the 3-second debouncing window.
- **Status**: Completed.

### [2026-08-03] Modal Container Boundaries & SMTP SendAsDenied Fix (v0.12.6)
- **Modal Container Constraints**: Added `maxHeight: "85vh"` and `overflow: "hidden"` to the card-glass element in [FormPreviewModal.tsx](file:///Users/benny2168/Antigravity/docsign/src/components/FormPreviewModal.tsx). This prevents the modal layout from expanding dynamically past viewport limits, forcing the inner grey scroll container to scroll the multiple pages correctly.
- **SMTP SendAsDenied Fix**: Updated default fallback `mailFrom` in [mail.ts](file:///Users/benny2168/Antigravity/docsign/src/lib/mail.ts) to equal the authenticated `SMTP_USER` email address (`announcements@mtcd.org`) rather than a static `"docsign@mtcd.org"` fallback. This resolves SendAsDenied SMTP errors generated by Microsoft's exchange transport rule restrictions.
- **Status**: Completed.

### [2026-08-03] SMTP Sender Header Reversion & Send-on-Behalf Option (v0.12.7)
- **SMTP Sender Reversion**: Changed the default fallback `mailFrom` in [mail.ts](file:///Users/benny2168/Antigravity/docsign/src/lib/mail.ts) back to `"docsign@mtcd.org"` as explicitly required for Azure configuration alignment.
- **SMTP Sender Header**: Added the `sender` configuration option to nodemailer `mailOptions` (bound to `SMTP_USER`), enabling Exchange Online to process mail delivery via Send-on-Behalf or Send-As authorizations correctly and bypass SMTP client SendAsDenied rejections.
- **Status**: Completed.

### [2026-08-03] Azure Communication Services SMTP Dynamic Configuration (v0.12.8)
- **ACS SMTP Auto-Config**: Programmed [mail.ts](file:///Users/benny2168/Antigravity/docsign/src/lib/mail.ts) to detect `AZURE_AD_CLIENT_ID`, `AZURE_AD_TENANT_ID`, and `AZURE_AD_CLIENT_SECRET` environment variables. If present, it automatically redirects SMTP traffic to `smtp.azurecomm.net` on port 587, authenticating via `<client_id>@<tenant_id>` username and client secret password.
- **ACS Envelope Validation**: Omitted setting the SMTP `sender` header when routing through `smtp.azurecomm.net` to avoid malformed header validations (since the ACS login username is not a valid email address), ensuring emails are delivered as pure `docsign@mtcd.org` sender envelopes.
- **Status**: Completed.

### [2026-08-04] Default SMTP Parameters Reversion & Fallbacks Purged (v0.12.9)
- **Announcements Defaults Purged**: Removed all hardcoded `announcements@mtcd.org` and corresponding passwords from fallbacks inside [mail.ts](file:///Users/benny2168/Antigravity/docsign/src/lib/mail.ts).
- **Default Azure Host Configuration**: Set default fallback host to `smtp.azurecomm.net` inside [mail.ts](file:///Users/benny2168/Antigravity/docsign/src/lib/mail.ts) and updated the default environment parameters inside both [docker-compose.portainer.yml](file:///Users/benny2168/Antigravity/docsign/docker-compose.portainer.yml) and [docker-compose.yml](file:///Users/benny2168/Antigravity/docsign/docker-compose.yml) to point to `smtp.azurecomm.net` with empty user and password settings.
- **Status**: Completed.

### [2026-08-04] SMTP Diagnostic Logging Enhancement (v0.12.10)
- **SMTP Detailed Logging**: Expanded nodemailer success and catch block `console` logs inside [mail.ts](file:///Users/benny2168/Antigravity/docsign/src/lib/mail.ts) to explicitly output the target `to` address and email `subject`. This enables auditing exactly which messages are successfully dispatched to users vs leaders in production telemetry.
- **Status**: Completed.

### [2026-08-04] Audit Log Tracking for Email Dispatches (v0.12.11)
- **Email Audit Logs**: Added prisma-backed `AuditLog` entries for every successful email delivery action in [route.ts](file:///Users/benny2168/Antigravity/docsign/src/app/api/sign/%5Bid%5D/route.ts) (including signer copies, custom copy fields, parent/guardian copies, and organization leader notifications), making all sent emails searchable and visible in the dashboard system audit log.
- **Status**: Completed.

### [2026-08-04] Docker Env Passthrough Setup for Custom Credentials (v0.12.12)
- **Compose Passthrough syntax**: Converted key parameters (`AZURE_AD_CLIENT_ID`, `AZURE_AD_TENANT_ID`, `AZURE_AD_CLIENT_SECRET`, `SMTP_USER`, `SMTP_PASS`, `SMTP_HOST`, `SMTP_PORT`, `ADMIN_PASSWORD`) into standard passthrough notation (omitting trailing `=` sign) inside [docker-compose.portainer.yml](file:///Users/benny2168/Antigravity/docsign/docker-compose.portainer.yml) and [docker-compose.yml](file:///Users/benny2168/Antigravity/docsign/docker-compose.yml). This ensures redeploying stack updates via API does not overwrite/reset custom environment variables configured inside the Portainer Stack UI.
- **Status**: Completed.

### [2026-08-04] Hierarchical Email Recipient De-duplication (v0.12.13)
- **Hierarchy-Based De-duplication**: Rebuilt the email trigger dispatches block inside [route.ts](file:///Users/benny2168/Antigravity/docsign/src/app/api/sign/%5Bid%5D/route.ts) to parse all recipients into category lists first, then run a priority-based set filter. This guarantees that each unique email address receives at most one copy of the notification, solving the issue where parent copies and custom fields duplicates were delivered to the same email.
- **Status**: Completed.

### [2026-08-04] Portainer Deploy-Time Local Env Syncing (v0.12.14)
- **Local Env Syncing**: Updated [deploy_portainer.py](file:///Users/benny2168/Antigravity/docsign/deploy_portainer.py) to parse local [.env](file:///Users/benny2168/Antigravity/docsign/.env) variables at deployment execution time. These keys are automatically merged into the stack update API payload sent to Synology Portainer, syncing credentials securely from the user's workspace without manually modifying the Portainer UI.
- **Status**: Completed.

### [2026-08-04] Custom Email Subject Line Phishing/Spam Bypassing (v0.12.15)
- **Spam/Phishing Filter Bypassing**: Re-labeled all email subject headers inside [route.ts](file:///Users/benny2168/Antigravity/docsign/src/app/api/sign/%5Bid%5D/route.ts) with the custom prefix `MTCD DocSign - Completed:`, `MTCD DocSign - Parent/Guardian Copy:`, `MTCD DocSign - Copy:`, and `MTCD DocSign - New Signature:`. This prevents Exchange Online Protection (EOP) spam filters from flagging and dropping external dispatches that match the generic `"Signed Document: "` phishing pattern signatures.
- **Status**: Completed.

### [2026-08-04] System Audit Log Email Category & Contrast Improvement (v0.12.16)
- **Emails Log Filter**: Added a distinct `📧 Emails` button to the Quick Filters block in [AuditLogsDashboardClient.tsx](file:///Users/benny2168/Antigravity/docsign/src/app/admin/AuditLogsDashboardClient.tsx). This filters audit trail rows to display only email dispatch events.
- **Log Contrast Boost**: Increased the background opacity of all action description tags in [AuditLogsDashboardClient.tsx](file:///Users/benny2168/Antigravity/docsign/src/app/admin/AuditLogsDashboardClient.tsx) to `0.18` (from `0.12`) to make them stand out. Programmed a soft cyan tag style specifically for Email events (`bg = "rgba(6, 182, 212, 0.18)"`, `fg = "#22d3ee"`) to make them highly legible.
- **Status**: Completed.

### [2026-08-04] Premium HTML Email Layout Refactoring (v0.12.17)
- **Authentic Card Design**: Replaced basic plain text HTML email blocks in [route.ts](file:///Users/benny2168/Antigravity/docsign/src/app/api/sign/%5Bid%5D/route.ts) with a premium card-based layout featuring a navy blue header gradient, centered dynamic logo branding, and styled tables to present metadata in a clean and highly authentic corporate notice layout.
- **Status**: Completed.

### [2026-08-04] Email Branding Refinement (v0.12.18)
- **Subject Branding & Terminology update**: Replaced header tagline `"Official Document Dispatch"` with `"Waiver Signature"` inside the `getEmailHtml` builder function in [route.ts](file:///Users/benny2168/Antigravity/docsign/src/app/api/sign/%5Bid%5D/route.ts). Replaced the word `"dispatched"` with `"emailed"` in the parent/guardian copy body content to simplify user-facing terminology.
- **Status**: Completed.

### [2026-08-04] Planning Center Online Registrations Integration (v0.12.19)
- **Database Schema Sync**: Run `npx prisma db push` to synchronize new PCO columns (`pcoIntegrationEnabled`, `pcoSignupId`, `pcoQuestionTitle` on `Template`, and `pcoAttendeeId` on `SignedDocument`).
- **PCO Integration UI**: Integrated settings checkboxes, text input fields, and dynamic copyable URLs with merge field parameters (`?pco_attendee_id={{ attendee.id }}`) inside [TemplateForm.tsx](file:///Users/benny2168/Antigravity/docsign/src/app/admin/templates/new/TemplateForm.tsx).
- **PCO Background Sync Client**: Programmed [pco.ts](file:///Users/benny2168/Antigravity/docsign/src/lib/pco.ts) to lookup attendees by email/name, resolve their custom checkboxes, and send authenticated `PATCH` requests to automatically check off waiver requirements on PCO. Integrated the sync trigger in [route.ts](file:///Users/benny2168/Antigravity/docsign/src/app/api/sign/%5Bid%5D/route.ts).
- **Status**: Completed.

### [2026-08-04] Multiple Templates Signing Sessions Feature (v0.13.0)
- **Database Model Addition**: Defined `SigningSession` model in [schema.prisma](file:///Users/benny2168/Antigravity/docsign/prisma/schema.prisma) and linked it to organizations. Generated client and updated SQLite database.
- **Admin Sessions Configuration UI**: Implemented interactive creation and editing of sessions at [page.tsx (new)](file:///Users/benny2168/Antigravity/docsign/src/app/admin/sessions/new/page.tsx) and [page.tsx (edit)](file:///Users/benny2168/Antigravity/docsign/src/app/admin/sessions/%5Bid%5D/edit/page.tsx). Renders [SessionForm.tsx](file:///Users/benny2168/Antigravity/docsign/src/app/admin/sessions/SessionForm.tsx) supporting template checklist filtering, interactive visual list reordering, and auto-slug generation.
- **Sessions Admin Listing**: Rendered list of combined sessions, status tags, search bars, and copyable URL links inside [SessionsListClient.tsx](file:///Users/benny2168/Antigravity/docsign/src/app/admin/sessions/SessionsListClient.tsx). Added "Sessions" nav link to [AdminNavbar.tsx](file:///Users/benny2168/Antigravity/docsign/src/app/admin/AdminNavbar.tsx).
- **Public Sessions Wizard Flow**: Programmed sequential signature transitions inside [SessionSignForm.tsx](file:///Users/benny2168/Antigravity/docsign/src/app/session/%5Bslug%5D/SessionSignForm.tsx), rendering breadcrumb progression indicator, pre-populating matching signer info between steps, and presenting a final download links portal. Added props & callbacks integration to [SignForm.tsx](file:///Users/benny2168/Antigravity/docsign/src/app/sign/%5Bslug%5D/SignForm.tsx).
- **Status**: Completed.

### [2026-08-05] Workspace Header Refactoring, Brand Logos, and iOS Viewport Optimizations (v0.14.6)
- **Unified 2-Row Layout**: Redesigned the signing interface workspace header inside [SignForm.tsx](file:///Users/benny2168/Antigravity/docsign/src/app/sign/[slug]/SignForm.tsx) to follow a clean, space-saving two-row design. Row 1 features portal/master logos, the form title (which expands dynamically without strict width restrictions), organization name, and workspace toggles. Row 2 features centered, responsive step breadcrumbs.
- **Branding & Master Logo Integration**: Retrieved and passed database settings for `master_logo_light` and `master_logo_dark` across the multi-form registration paths so that the master organization logo renders inline on desktop layout grids.
- **iOS Safari Focus-Zoom Resolution**: Implemented dynamic client-side font scaling (`fontSize: Math.max(16, Math.ceil(16 / scale))}px`) on focused text fields inside [SignForm.tsx](file:///Users/benny2168/Antigravity/docsign/src/app/sign/[slug]/SignForm.tsx) to compensate for parent CSS scale transforms. This forces the visual font height to render at exactly `16px` on-screen, preventing native Safari viewport zooms on input clicks.
- **Dynamic Viewport Height (`100dvh`)**: Migrated viewport height units from `100vh` to `100dvh` in [globals.css](file:///Users/benny2168/Antigravity/docsign/src/app/globals.css) and forced the registration wrapper to fill height on mobile. This eliminates empty bottom gaps on iOS viewports during keyboard toggle.
- **Test Page Cleanup**: Removed the residual testing page [page.tsx](file:///Users/benny2168/Antigravity/docsign/src/app/test-nav/page.tsx) and committed its deletion.
- **Deployment**: Bumped application version to `0.14.6` inside [package.json](file:///Users/benny2168/Antigravity/docsign/package.json), built the linux/amd64 Docker image, pushed to Docker Hub, and successfully triggered a production stack redeploy on Synology Portainer.
- **Status**: Completed.

### [2026-08-05] Template PDF Document Replacement in Designer (v0.14.7)
- **Replace PDF/Word API**: Created the endpoint `/api/admin/templates/[id]/pdf` which handles replacement of template source documents. Supports PDF file upload and DOCX/DOC files with LibreOffice conversion. Wipes the old PDF file from local storage and assigns a cache-busting timestamped new PDF file path.
- **Designer UI Integration**: Added `currentPdfUrl` state to [DesignCanvas.tsx](file:///Users/benny2168/Antigravity/docsign/src/app/admin/templates/[id]/design/DesignCanvas.tsx). Built a "Replace PDF File" toolbar button and hidden input in the sidebar actions panel to let users upload a new PDF or Word template file, dynamically reloading PDFJS pages in place while preserving all existing visual layout fields.
- **Status**: Completed.

### [2026-08-07] Email Delivery Diagnosis, Manual Reminders & Automated Reminder Schedules (v0.15.0)
- **Database SMTP Setting Fallbacks**: Updated [mail.ts](file:///Users/benny2168/Antigravity/docsign/src/lib/mail.ts) to query `prisma.setting` fallback values (`smtp_host`, `smtp_port`, `smtp_user`, `smtp_pass`, `smtp_from`) if environment variables are missing, resolving silent delivery failures when container env vars are not set.
- **Admin SMTP Configuration & Connection Test**: Added a dedicated "SMTP & Reminders" tab in Admin Settings ([SettingsForm.tsx](file:///Users/benny2168/Antigravity/docsign/src/app/admin/settings/SettingsForm.tsx)) and created a POST API route ([route.ts](file:///Users/benny2168/Antigravity/docsign/src/app/api/admin/settings/test-email/route.ts)) allowing admins to save SMTP settings and send diagnostic test emails directly from the UI.
- **Manual Individual & Batch Reminders**: Created the reminder email generator and tracking library ([reminders.ts](file:///Users/benny2168/Antigravity/docsign/src/lib/reminders.ts)) and POST API route ([route.ts](file:///Users/benny2168/Antigravity/docsign/src/app/api/admin/registrations/[id]/pco/remind/route.ts)). Added "📧 Send Reminder" buttons on individual rows and a "📧 Send All Reminders" header button on the PCO Registrants Dashboard ([RegistrationDashboardClient.tsx](file:///Users/benny2168/Antigravity/docsign/src/app/admin/registrations/[id]/RegistrationDashboardClient.tsx)).
- **Automated Reminder Schedules & Status Column**: Added `RegistrationReminder` model to [schema.prisma](file:///Users/benny2168/Antigravity/docsign/prisma/schema.prisma) and added `reminder_delay_hours` setting. Rendered a "Reminder Status / Scheduled" table column on the dashboard showing sent timestamps or scheduled send times.
- **Status**: Completed, ready for deployment.

### [2026-08-08] Microsoft Graph API Email Integration & Test Email Trigger Fix (v0.15.4)
- **Microsoft Graph API Email Dispatch**: Programmed `sendViaGraphApi` helper in [mail.ts](file:///Users/benny2168/Antigravity/docsign/src/lib/mail.ts) to send emails via Microsoft Graph API OAuth2 token exchange when Azure credentials (`AZURE_AD_CLIENT_ID`, `AZURE_AD_TENANT_ID`, `AZURE_AD_CLIENT_SECRET`) are available. This completely bypasses Exchange Online SMTP Basic Auth restriction errors (`535 5.7.139`).
- **Independent Test Email Trigger**: Removed automatic `saveSettings(...)` call from `handleTestEmail` in [SettingsForm.tsx](file:///Users/benny2168/Antigravity/docsign/src/app/admin/settings/SettingsForm.tsx). Test email dispatches now send input credentials directly to [/api/admin/settings/test-email](file:///Users/benny2168/Antigravity/docsign/src/app/api/admin/settings/test-email/route.ts) without triggering form submission or global setting saves.
- **Status**: Completed, deployed.





