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
