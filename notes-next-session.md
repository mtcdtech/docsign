# DocSign - Notes for Next Session

## Most Logical Next Steps
1. Verify the portal-based PDF Form State Preview Modal:
   - Click a submission row on the main dashboard (Recent Submissions).
   - Click a submission row on the templates history card.
   - Verify both modals render as full-screen overlays (not stretched or cut off), scrolling multi-page documents correctly within card boundaries (`maxHeight: 85vh`).
2. Verify SMTP email dispatches:
   - Submit a completed signature form and confirm that the signer and custom email targets receive their copies immediately.
   - Check container logs to verify nodemailer logs indicating `Email sent successfully`.
3. Verify the new dashboard System Audit Log card default-collapsed display and expand/collapse triggers.
4. Verify designer auto-save loops and drag-selection.

## Open Questions & Uncertainties
- None.

## Validation Still Needed
- Verify email copy delivery on the live server.

## Blockers
- None.
