# DocSign - Notes for Next Session

## Most Logical Next Steps
1. Flip `identity_profile.compat_mode` to `false` for webapp slug `docsign` on the Admin Portal.
2. Verify production login flows post-flip:
   - Log in as a Microsoft-linked Admin (e.g. `ben@abraham16.com`). Verify Prisma `dbUser.role === "Admin"`.
   - Log in as a Microsoft-linked OrgLeader. Verify role, organization visibility, and template editing.
   - Log in as `tech@mtcd.org`. Verify it bypasses standard checks and logs in as Admin.
   - Attempt login with a PCO-only user. Verify they are blocked at the Authentik/token step.

## Open Questions & Uncertainties
- None at present.

## Validation Still Needed
- Post-flip verification of Microsoft SSO logins using the canonical `mtcd_person_id` mapping.

## Blockers
- None at present.



