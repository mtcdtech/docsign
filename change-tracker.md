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
