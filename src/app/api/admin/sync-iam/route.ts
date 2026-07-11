import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import https from "https";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user || (session.user as any).role !== "Admin") {
            return new NextResponse("Forbidden", { status: 403 });
        }

        // Fetch IAM users, bypassing SSL verification for local self-signed setups
        const agent = new https.Agent({ rejectUnauthorized: false });
        let res;
        try {
            res = await fetch("http://admin.server.mtcd.org/iam/api/export/docsign-users", {
                // @ts-ignore
                agent
            });
        } catch (e) {
            // Fallback to HTTPS
            res = await fetch("https://admin.server.mtcd.org/iam/api/export/docsign-users", {
                // @ts-ignore
                agent
            });
        }

        if (!res.ok) {
            throw new Error(`IAM API returned status ${res.status}`);
        }

        const iamUsers = await res.json();
        if (!Array.isArray(iamUsers)) {
            throw new Error("Invalid format from IAM API");
        }

        let added = 0;
        let updated = 0;

        // 1. Gather all department names and ensure they exist in the DB as Organizations
        const allDepts = new Set<string>();
        for (const u of iamUsers) {
            if (u.department) {
                u.department.split(" / ").forEach((d: string) => {
                    const cleanD = d.trim();
                    if (cleanD && cleanD !== "General") allDepts.add(cleanD);
                });
            }
        }

        for (const deptName of Array.from(allDepts)) {
            await prisma.organization.upsert({
                where: { name: deptName },
                update: {},
                create: { name: deptName }
            });
        }

        const currentOrgs = await prisma.organization.findMany();

        // 2. Insert/Update users and map their organization links
        for (const u of iamUsers) {
            if (!u.email) continue;
            const emailLower = u.email.toLowerCase();
            const depts = (u.department || "").split(" / ").map((d: string) => d.trim()).filter(Boolean);
            const orgsToConnect = currentOrgs.filter(org => depts.includes(org.name));

            const existing = await prisma.user.findUnique({ where: { email: emailLower } });
            let dbUser;

            if (existing) {
                dbUser = await prisma.user.update({
                    where: { email: emailLower },
                    data: {
                        name: u.name || existing.name,
                        pcoName: u.pco_name || existing.pcoName,
                        msName: u.ms_name || existing.msName,
                        department: u.department || existing.department,
                        role: existing.roleOverride ? existing.role : (u.role || existing.role),
                        rawRole: u.raw_role || existing.rawRole,
                        organizations: {
                            set: orgsToConnect.map(o => ({ id: o.id }))
                        }
                    }
                });
                updated++;
            } else {
                dbUser = await prisma.user.create({
                    data: {
                        email: emailLower,
                        name: u.name || "Unknown",
                        pcoName: u.pco_name,
                        msName: u.ms_name,
                        department: u.department || "General",
                        role: u.role || "User",
                        rawRole: u.raw_role,
                        organizations: {
                            connect: orgsToConnect.map(o => ({ id: o.id }))
                        }
                    }
                });
                added++;
            }
        }

        // 3. Remove users no longer present in IAM, keeping local system admin
        const validEmails = iamUsers.map((u: any) => u.email.toLowerCase()).filter(Boolean);
        let deleted = 0;
        if (validEmails.length > 0) {
            validEmails.push("admin@local.system");
            const delRes = await prisma.user.deleteMany({
                where: {
                    email: { notIn: validEmails }
                }
            });
            deleted = delRes.count;
        }

        return NextResponse.json({ ok: true, added, updated, deleted });
    } catch (e: any) {
        console.error("IAM Sync Error in DocSign:", e);
        return NextResponse.json({ ok: false, error: e.message || "Internal Server Error" }, { status: 500 });
    }
}
