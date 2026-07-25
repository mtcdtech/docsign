# Docsign — Phase D Steps D1 & D2

**Repo:** `mtcdtech/docsign`
**Stack:** Next.js 14 + NextAuth v4 + Prisma + AuthentikProvider
**Scope:** Add canonical `mtcd_person_id` handling to Docsign so it can consume the claim once the admin portal flips compat mode off. **STOP before D3** — do not flip compat mode.

**Not in scope for this doc:**

- D3 (flipping `docsign` `compat_mode` to `false`, creating the per-app Authentik scope mapping). Deferred to a maintenance window with human approval.
- Anything in `mtcdtech/admin-portal`, `mtcdtech/announcements`, `mtcdtech/av-checklist`, `mtcdtech/prayer-wall`, or `mtcdtech/mtcd-church-wiki`. Other Antigravity instances are working on those in parallel.

---

## Why this is safe to ship today

The admin portal's `docsign` provider still has `compat_mode: True`. Tokens Docsign receives today do NOT contain `mtcd_person_id`. This ticket adds code that reads the claim when it appears and falls back to the existing email-based lookup when it doesn't. Since compat mode is on, tokens are unchanged, the new code path is dormant, and sign-in behavior is identical to today.

Fully reversible: revert the migration + revert the code = back to today's state.

---

## Current auth code you're modifying

**File:** `src/app/api/auth/[...nextauth]/route.ts`

Existing pattern (relevant excerpt):

```typescript
export const authOptions: NextAuthOptions = {
  providers: [
    AuthentikProvider({
      // ...
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name ?? profile.preferred_username,
          email: profile.preferred_username || profile.email,
          image: profile.picture,
          department: profile.attributes?.department || profile.department || (profile.groups?.[0] || "General"),
          groups: profile.groups || [],
        }
      }
    }),
    CredentialsProvider({ /* local admin fallback */ }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "authentik") {
        // ... looks up dbUser by user.email.toLowerCase() ...
      }
    },
    // ...
  },
};
```

Docsign's User model already has `pcoName` and `msName` columns. Good — keep those. Add `mtcdPersonId` alongside.

---

## D1 — Schema + callback

### D1.1 — Prisma schema

**File:** `prisma/schema.prisma`

```diff
 model User {
   id              String         @id @default(cuid())
   email           String         @unique
+  mtcdPersonId    String?        @unique
   name            String?
   pcoName         String?
   msName          String?
   // ... rest unchanged
 }
```

Migration:

```bash
npx prisma migrate dev --name add_mtcd_person_id
# Production:
npx prisma migrate deploy
```

### D1.2 — Profile callback

**File:** `src/app/api/auth/[...nextauth]/route.ts`

Extend the `AuthentikProvider.profile()` return to forward the pid and history when present. During compat mode they're `undefined` — that's fine because the schema column is nullable.

```diff
     AuthentikProvider({
       // ... existing fields ...
       profile(profile) {
         return {
           id: profile.sub,
           name: profile.name ?? profile.preferred_username,
           email: profile.preferred_username || profile.email,
           image: profile.picture,
           department: profile.attributes?.department || profile.department || (profile.groups?.[0] || "General"),
           groups: profile.groups || [],
+          mtcdPersonId: (profile as any).mtcd_person_id ?? null,
+          mtcdPersonIdHistory: (profile as any).mtcd_person_id_history ?? [],
         }
       }
     }),
```

### D1.3 — signIn callback: pid-first lookup

**File:** `src/app/api/auth/[...nextauth]/route.ts`

Modify the existing `signIn` callback's Authentik branch. The 3-tier lookup is: (1) current pid, (2) history fallback, (3) email fallback. Preserve everything the existing callback already does with `department`, `role`, and group-to-role mapping — just replace how `dbUser` is resolved.

```diff
     async signIn({ user, account, profile }) {
       if (account?.provider === "authentik") {
         if (!user.email) return false;
         const emailLower = user.email.toLowerCase();
-        let dbUser = await prisma.user.findUnique({ where: { email: emailLower } });
+
+        const claimedPid = (user as any).mtcdPersonId as string | null;
+        const claimedHistory = ((user as any).mtcdPersonIdHistory ?? []) as Array<{
+          previous_mtcd_person_id?: string;
+        }>;
+
+        // Lookup order: (1) current pid, (2) any prior pid from history,
+        // (3) email fallback (the only path that works during compat mode).
+        let dbUser = null;
+
+        if (claimedPid) {
+          dbUser = await prisma.user.findUnique({ where: { mtcdPersonId: claimedPid } });
+        }
+
+        if (!dbUser && claimedHistory.length > 0) {
+          const priorPids = claimedHistory
+            .map(h => h?.previous_mtcd_person_id)
+            .filter((p): p is string => typeof p === "string" && p.length > 0);
+          for (const priorPid of priorPids) {
+            dbUser = await prisma.user.findUnique({ where: { mtcdPersonId: priorPid } });
+            if (dbUser) {
+              console.log(`[auth] migrating mtcdPersonId ${priorPid} -> ${claimedPid} for ${dbUser.email}`);
+              break;
+            }
+          }
+        }
+
+        if (!dbUser) {
+          dbUser = await prisma.user.findUnique({ where: { email: emailLower } });
+        }
         
         const authDept = (user as any).department;
         // ... rest of existing callback unchanged (department / role / group logic) ...
```

Then, after the existing code resolves `extractedDept`, `role`, etc. and does the upsert, add a dual-write for the pid:

```diff
         // ... existing upsert / update logic that sets email, name, role, department, pcoName, msName, etc. ...
+
+        // Dual-write pid whenever we learned it and it changed
+        if (claimedPid && dbUser && dbUser.mtcdPersonId !== claimedPid) {
+          try {
+            await prisma.user.update({
+              where: { id: dbUser.id },
+              data: { mtcdPersonId: claimedPid },
+            });
+          } catch (e) {
+            console.error(`[auth] failed to write mtcdPersonId=${claimedPid} for ${dbUser.email}`, e);
+            // Non-fatal — user's login still succeeds
+          }
+        }
+
         return true;
       }
       // ... credentials provider branch unchanged ...
     }
```

**Placement note:** The pid dual-write must happen after Docsign's existing `prisma.user.upsert` or `update` (whichever the current callback uses). If you write pid BEFORE that update, the update may clobber it. Trace the callback flow before inserting.

### D1.4 — TypeScript types

If Docsign has `next-auth.d.ts` type augmentation, add the new field. If not, cast `(user as any).mtcdPersonId` as shown above and move on — this isn't the ticket for type cleanup.

---

## D2 — Backfill script

**File:** `scripts/backfill-mtcd-person-ids.ts` (new file — Docsign doesn't have a `scripts/` dir yet, create it)

```typescript
/**
 * Backfill mtcdPersonId onto existing Docsign users by matching email
 * against the MTCD admin portal's unified users export.
 *
 * Usage:
 *   npx tsx scripts/backfill-mtcd-person-ids.ts --dry-run
 *   npx tsx scripts/backfill-mtcd-person-ids.ts --apply
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ADMIN_EXPORT_URL =
  process.env.MTCD_ADMIN_EXPORT_URL ??
  "https://admin.server.mtcd.org/api/export/users";

type UnifiedPerson = {
  pk?: number;
  mtcd_person_id?: string;
  email?: string;
  ms_email?: string;
  pco_email?: string;
  cc_email?: string;
  emails?: string[];
  name?: string;
};

async function main() {
  const mode = process.argv.includes("--apply") ? "apply" : "dry-run";
  console.log(`[backfill] mode=${mode}`);

  const res = await fetch(ADMIN_EXPORT_URL);
  if (!res.ok) {
    console.error(`[backfill] admin export returned ${res.status}`);
    process.exit(1);
  }
  const body = (await res.json()) as { users?: UnifiedPerson[] } | UnifiedPerson[];
  const people: UnifiedPerson[] = Array.isArray(body) ? body : body.users ?? [];
  console.log(`[backfill] fetched ${people.length} unified people`);

  // Build email → pid map
  const emailToPid = new Map<string, string>();
  for (const p of people) {
    if (!p.mtcd_person_id) continue;
    const emails = new Set<string>();
    if (p.email) emails.add(p.email.toLowerCase());
    if (p.ms_email) emails.add(p.ms_email.toLowerCase());
    if (p.pco_email) emails.add(p.pco_email.toLowerCase());
    if (p.cc_email) emails.add(p.cc_email.toLowerCase());
    for (const e of p.emails ?? []) emails.add(e.toLowerCase());
    for (const e of emails) {
      if (!emailToPid.has(e)) emailToPid.set(e, p.mtcd_person_id);
    }
  }
  console.log(`[backfill] email→pid map: ${emailToPid.size} entries`);

  const dbUsers = await prisma.user.findMany({
    select: { id: true, email: true, mtcdPersonId: true },
  });

  const plan: Array<{ id: string; email: string; from: string | null; to: string }> = [];
  let alreadyCorrect = 0;
  let noMatch = 0;

  for (const u of dbUsers) {
    if (!u.email) { noMatch++; continue; }
    const pid = emailToPid.get(u.email.toLowerCase());
    if (!pid) { noMatch++; continue; }
    if (u.mtcdPersonId === pid) { alreadyCorrect++; continue; }
    plan.push({ id: u.id, email: u.email, from: u.mtcdPersonId, to: pid });
  }

  console.log(`[backfill] plan=${plan.length}, alreadyCorrect=${alreadyCorrect}, noMatch=${noMatch}`);

  if (mode === "dry-run") {
    for (const p of plan.slice(0, 20)) {
      console.log(`  ${p.email}: ${p.from ?? "(null)"} -> ${p.to}`);
    }
    console.log("[backfill] rerun with --apply to persist");
    return;
  }

  let applied = 0;
  const failures: Array<{ email: string; error: string }> = [];
  for (const p of plan) {
    try {
      await prisma.user.update({ where: { id: p.id }, data: { mtcdPersonId: p.to } });
      applied++;
    } catch (e) {
      failures.push({ email: p.email, error: String(e) });
    }
  }
  console.log(`[backfill] applied=${applied}, failures=${failures.length}`);
  for (const f of failures.slice(0, 20)) console.log(`  FAIL ${f.email}: ${f.error}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
```

Verify the admin export shape first:

```bash
curl -sk https://admin.server.mtcd.org/api/export/users | jq '. | if type == "array" then .[0] else .users[0] end'
```

Adjust the `UnifiedPerson` type / email extraction if the actual shape differs.

Execution order after D1 deploys:

1. `npx tsx scripts/backfill-mtcd-person-ids.ts --dry-run`
2. Review; expect ≥ 80% match rate
3. `npx tsx scripts/backfill-mtcd-person-ids.ts --apply`
4. DB spot-check: `SELECT COUNT(*), COUNT("mtcdPersonId") FROM "User";`

---

## Acceptance criteria

1. Prisma migration applied on dev + prod. No drift warnings.
2. Existing test suite passes.
3. Manual sign-in as yourself succeeds. Docsign UX unchanged.
4. Local admin credentials login still works (do not touch the `CredentialsProvider` branch).
5. Dry-run matches ≥ 80% of Docsign users.
6. Apply completes with zero failures.
7. Post-backfill: `COUNT(mtcdPersonId)` close to total active users.
8. Post-backfill sign-in as yourself still succeeds; server log shows the email-fallback path (because compat mode is still on, no pid in the token).

---

## What NOT to do

- Do not POST to `https://admin.server.mtcd.org/api/webapps/docsign/identity_profile`. That's D3.
- Do not create `mtcd_app_docsign_identity` scope mapping in Authentik. That's D3.
- Do not remove or modify the `pcoName` / `msName` columns. Even though `mtcd_identity_bundle` will eventually supersede them, they're used by SharePoint output formatting today.
- Do not touch the `CredentialsProvider` local admin login path.
