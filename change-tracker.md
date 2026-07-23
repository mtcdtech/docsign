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
- **Status**: Completed, pending live verification.

