# DocSign - Notes for Next Session

## Most Logical Next Steps
1. Verify that attempting to log in with an unregistered account (e.g. `pwteam@mtcd.org` when not present in the database/IAM portal) correctly results in an Access Denied error (blocked login).
2. Sync the user `pwteam@mtcd.org` from the IAM portal (or manually add it to the database with name "Praise & Worship Team" and role "OrgLeader") and confirm:
   - Login succeeds.
   - Display name is shown as "Praise & Worship Team" in the navbar, rather than any individual's name (e.g. Ben Abraham or Mervin Abraham).
3. Verify that `contemporary@mtcd.org` logs in successfully and displays "Contemporary Music Team".

## Open Questions & Uncertainties
- None at present.

## Validation Still Needed
- Live verification of production login flows, name mappings, and access control blocks.

## Blockers
- None at present.


