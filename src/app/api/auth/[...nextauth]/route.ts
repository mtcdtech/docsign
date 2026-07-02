import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import AuthentikProvider from "next-auth/providers/authentik";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  providers: [
    AuthentikProvider({
      clientId: process.env.AUTHENTIK_CLIENT_ID || "",
      clientSecret: process.env.AUTHENTIK_CLIENT_SECRET || "",
      issuer: process.env.AUTHENTIK_ISSUER || "",
      client: {
        id_token_signed_response_alg: "HS256"
      },
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name ?? profile.preferred_username,
          // preferred_username holds the official work email
          email: profile.preferred_username || profile.email,
          image: profile.picture,
          department: profile.attributes?.department || profile.department || (profile.groups && profile.groups.length > 0 ? profile.groups[0] : "General"),
          groups: profile.groups || [],
        }
      }
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text", placeholder: "admin" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        const adminPass = process.env.ADMIN_PASSWORD || "admin";
        if (credentials?.username === "admin" && credentials?.password === adminPass) {
            let user = await prisma.user.findUnique({ where: { email: "admin@local.system" } });
            if (!user) {
               user = await prisma.user.create({
                 data: {
                   email: "admin@local.system",
                   role: "Admin",
                   name: "System Admin",
                   department: "IT"
                 }
               });
            }
            return {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            };
        }
        return null;
      }
    })
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "authentik") {
        if (!user.email) return false;
        const emailLower = user.email.toLowerCase();
        let dbUser = await prisma.user.findUnique({ where: { email: emailLower } });
        
        const authDept = (user as any).department;
        const dbDept = dbUser?.department;
        const authGroups = ((user as any).groups || []).map((g: string) => g.toLowerCase());
        
        const isAuthentikAdmin = authGroups.includes("docsign-admins") || 
                                 authGroups.includes("admins") || 
                                 authGroups.includes("app_docsign_admin");
        
        const isAuthentikOrgLeader = authGroups.includes("app_docsign_orgleader");
        
        // Define if it is a real department
        const isRealDept = (d: string) => d && d !== "General" && !d.toLowerCase().includes("access") && !d.toLowerCase().includes("admin");
        
        let extractedDept = "General";
        if (isRealDept(authDept)) extractedDept = authDept;
        else if (dbDept && dbDept !== "General") extractedDept = dbDept;

        // Calculate target role
        let targetRole = "User";
        if (emailLower === "tech@mtcd.org" || emailLower === "ben@abraham16.com" || isAuthentikAdmin) {
          targetRole = "Admin";
        } else if (isAuthentikOrgLeader) {
          targetRole = "OrgLeader";
        }

        if (!dbUser) {
          dbUser = await prisma.user.create({
            data: {
              email: emailLower,
              role: targetRole,
              name: user.name,
              department: extractedDept
            }
          });
        } else {
          // Existing user: sync roles dynamically from Authentik SSO
          let updatedRole = dbUser.role;
          if (emailLower === "tech@mtcd.org" || emailLower === "ben@abraham16.com" || isAuthentikAdmin) {
            updatedRole = "Admin";
          } else if (isAuthentikOrgLeader) {
            if (dbUser.role !== "Admin") {
              updatedRole = "OrgLeader";
            }
          } else {
            // Downgrade to standard User if access revoked in Authentik, unless they are a hardcoded system superadmin
            if (dbUser.role === "Admin" && (emailLower === "tech@mtcd.org" || emailLower === "ben@abraham16.com")) {
              // preserve
            } else {
              updatedRole = "User";
            }
          }
          
          dbUser = await prisma.user.update({
            where: { id: dbUser.id },
            data: { name: user.name, department: extractedDept, role: updatedRole }
          });
        }
        
        // Sync organization links
        const depts = (extractedDept || "").split(" / ");
        if (depts.length > 0) {
          const syncedOrgs = await prisma.organization.findMany();
          const orgsToConnect = syncedOrgs.filter(org => depts.includes(org.name));
          if (orgsToConnect.length > 0) {
             dbUser = await prisma.user.update({
                where: { id: dbUser.id },
                data: {
                   organizations: {
                      set: orgsToConnect.map(o => ({ id: o.id }))
                   }
                }
             });
          }
        }
        
        (user as any).role = dbUser.role;
        (user as any).id = dbUser.id;
        (user as any).department = dbUser.department || extractedDept;
      }
      return true;
    },
    async jwt({ token, user }) {
        if (user) {
            token.role = (user as any).role;
            token.sub = (user as any).id;
            token.department = (user as any).department;
        }
        // Always refresh role from DB so admin role changes take effect immediately
        if (token.sub || token.email) {
            try {
                let dbUser = await prisma.user.findUnique({ where: { id: token.sub as string } });
                if (!dbUser && token.email) {
                    dbUser = await prisma.user.findUnique({ where: { email: (token.email as string).toLowerCase() } });
                    if (dbUser) {
                        token.sub = dbUser.id;
                    }
                }
                if (dbUser) {
                    token.role = dbUser.role;
                }
            } catch (e) {}
        }
        return token;
    },
    async session({ session, token }) {
        if (session.user) {
            (session.user as any).role = token.role;
            (session.user as any).id = token.sub;
            (session.user as any).department = token.department;
        }
        return session;
    }
  },
  pages: {
    signIn: "/",
  },
  session: { strategy: "jwt" }
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
