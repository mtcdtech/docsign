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
