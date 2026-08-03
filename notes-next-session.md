# DocSign - Notes for Next Session

## Most Logical Next Steps
1. Verify SMTP email dispatches:
   - Provide the Azure Communication Services SMTP credentials inside the Portainer environment settings (`AZURE_AD_CLIENT_ID`, `AZURE_AD_TENANT_ID`, `AZURE_AD_CLIENT_SECRET`).
   - Submit a completed signature form and confirm that the signer and custom email targets receive their copies immediately.
   - Confirm that the email is received as coming directly from `docsign@mtcd.org`.
2. Verify the portal-based PDF Form State Preview Modal:
   - Click a submission row on the main dashboard (Recent Submissions).
   - Click a submission row on the templates history card.
   - Verify both modals render as full-screen overlays (not stretched or cut off), scrolling multi-page documents correctly within card boundaries (`maxHeight: 85vh`).
3. Verify the new dashboard System Audit Log card default-collapsed display and expand/collapse triggers.
4. Verify designer auto-save loops and drag-selection.

## Open Questions & Uncertainties
- None.

## Validation Still Needed
- Verify email copy delivery on the live server.

## Blockers
- None.
