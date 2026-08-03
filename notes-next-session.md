# DocSign - Notes for Next Session

## Most Logical Next Steps
1. Deploy v0.12.2 enhancements to production Portainer stack.
2. Verify visual designer auto-save loop in templates dashboard.
3. Validate "first-time help tour" triggers and works on a fresh browser profile.
4. Verify click-and-drag selection bounding box works to select and align multiple fields.
5. Fill out a public signature form:
   - Verify draft is saved to database automatically while typing.
   - Verify "Reset Form" button triggers custom confirmation dialog, deletes draft from DB, clears local state/local storage, and reloads layout fields.
   - Complete form and submit: verify draft is promoted to fully signed document status, and parent emails are dispatched.
6. Verify recent submissions list click-to-preview:
   - Ensure the modal loads successfully.
   - Verify PDF.js renders canvas layers and overlays form data relative coordinates on the page correctly.
7. Verify searchable login and activity logs in Settings Panel.

## Open Questions & Uncertainties
- None.

## Validation Still Needed
- Verify email dispatches to parent copies and confirm SMTP handshake handles Office 365 cleanly under modern TLS.

## Blockers
- None.
