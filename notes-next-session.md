# DocSign - Notes for Next Session

## Most Logical Next Steps
1. Verify that attempting to log in with an unregistered account (e.g. `pwteam@mtcd.org` when not present in the database/IAM portal) correctly results in an Access Denied error (blocked login).
2. Sync the user `pwteam@mtcd.org` from the IAM portal (or manually add it to the database with name "Praise & Worship Team" and role "OrgLeader") and confirm:
   - Login succeeds.
   - Display name is shown as "Praise & Worship Team" in the navbar, rather than any individual's name (e.g. Ben Abraham or Mervin Abraham).
3. Verify that `contemporary@mtcd.org` logs in successfully and displays "Contemporary Music Team".
4. Deploy the latest version (`v0.10.28`) with the new Form Designer alignment, spacing, distribution, and sidebar properties editor.
5. Verify on production:
   - Reordered toolbox: Signer Name/Email fields appear at the top.
   - Properties Editor: Selecting a field expands the sidebar Properties Editor card (without pop-up modal). Editing fields live updates the canvas immediately.
   - Unique System ID generation: Editing the Display Name of a field reactively updates the System Variable ID (slugified/snake_cased), and appends incrementing suffixes if duplicates are detected. The Variable ID must be strictly read-only and non-editable.
   - Multi-field: Shift-clicking multiple fields enables alignment toolbar. Verify Align Left, Align Right, Align Top, Align Bottom, Match Width, and Match Height operations.
   - Spacing & Distribution: Select 3 or more fields and verify Distribute Horiz, Distribute Vert, Spacing Gap H, and Spacing Gap V adjust layouts properly.
   - Parallel Dragging: Moving a field in a multi-selection drags all selected fields together.
   - Signer validation: Attempt to save a template layout without Signer Name/Email variables. Ensure it blocks and displays a dialog specifying missing fields.

## Open Questions & Uncertainties
- None at present.

## Validation Still Needed
- Live verification of production login flows, name mappings, access control blocks, and visual Form Designer alignment features.

## Blockers
- None at present.


