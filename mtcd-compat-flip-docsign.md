# MTCD Compat Flip — docsign

**Scope:** operational runbook, no code changes to docsign.
**Target:** flip `identity_profile.compat_mode` from `true` → `false` on webapp slug `docsign`.
**Depends on:** admin-portal ≥1.7.5, docsign ≥0.11.1.
**Antigravity instances:** 0.

---

## 0. Background

docsign's identity profile:

- `email_source: microsoft.primary`
- `name_source: microsoft.display_name`
- `username_source: microsoft.upn`
- `require_microsoft: true`
- `expose_structured_claim: true`
- `compat_mode: true`

**MS-required.** docsign is essentially an MS-only app — the roles are Admin (`app_docsign_Admin`, 5 members) and OrgLeader (`app_docsign_OrgLeader`, 31 members). All members should be MS-linked because they need signing accounts.

## 1. Readiness

Strong flip candidate — this is docsign's whole authentication model. Post-flip, PCO-only users (which shouldn't exist for this app) get denied at the token step. That's a feature.

docsign's signIn callback (`src/app/api/auth/[...nextauth]/route.ts`) already:
- Rejects unauthorized shared mailboxes (`isSharedMailbox && !isAuthorizedSharedForThisApp` → `return false`)
- Uses `mtcd_person_id` and `mtcd_person_id_history` for user lookup (`prisma.user.findUnique({where: {mtcdPersonId: claimedPid}})`)
- Falls back to email lookup only when pid resolution fails (compat-friendly)
- Reads role from `app_docsign_admin` / `app_docsign_orgleader` groups

## 2. Pre-flip checklist

1. Confirm profile matches above at IAM portal.
2. Version: `https://docsign.server.mtcd.org/` reports `0.11.1` or higher.
3. Confirm all Admin and OrgLeader group members have Microsoft identities.
4. Confirm no authorized shared account grants exist for docsign — if one does, verify that shared mailbox has an MS entry in its identity bundle (would be unusual for a pure-shared account, but check).

## 3. Preflight

```
POST https://admin.server.mtcd.org/iam/api/iam/webapps/docsign/preflight-flip
```

Expected `total_users: ~36` (5 Admin + 31 OrgLeader). Should be all-linked (`unlinked_users: 0`) if the group memberships in Authentik are drawn from real people.

If any user is unlinked, it's almost certainly a stale group membership (someone was added directly by email without a proper IAM link). Remove them from the group or complete the link before flipping.

## 4. Flip

```bash
curl -X POST 'https://admin.server.mtcd.org/iam/api/iam/webapps/docsign/flip-compat' \
  -H 'Content-Type: application/json' \
  --data '{"new_value": false, "reason": "Post-v1.7.5 soak"}' \
  --cookie 'session=<your admin session>'
```

## 5. Post-flip smoke test

1. Log in as MS-linked Admin. Verify Prisma `dbUser.role === "Admin"`, display uses MS name.
2. Log in as MS-linked OrgLeader. Verify role, display, ability to see documents.
3. Attempt log-in with a PCO-only account not in either group. Expected: `require_microsoft: true` blocks at Authentik → error page from Authentik provider, never reaches docsign signIn.
4. Attempt log-in as `tech@mtcd.org` (the `isSystemAdmin` fast-path). Verify still succeeds and lands as Admin.

## 6. Rollback

```bash
curl -X POST 'https://admin.server.mtcd.org/iam/api/iam/webapps/docsign/flip-compat' \
  -H 'Content-Type: application/json' \
  --data '{"new_value": true, "reason": "Rollback"}' \
  --cookie 'session=<your admin session>'
```

## 7. Success criteria

- Preflight `ready: true`.
- Admin, OrgLeader, and tech@mtcd.org all log in successfully post-flip.
- No stalled document workflows in the 24 hours after.
- Any PCO-only login attempt is rejected at Authentik, not at docsign.

## 8. Risk notes

- docsign contains signed documents — a lockout could halt document workflows. Time the flip for a low-activity window (evening) and keep the rollback command handy.
- Verify that the SharePoint output integration doesn't depend on any user context that changes with the flip. It shouldn't (SharePoint auth is app-level, not user-token), but confirm before flipping.
