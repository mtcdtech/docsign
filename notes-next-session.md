# Notes for Next Session

Here is the recommended starting point and next steps for the next session.

## Next Steps & Verification Checklist
1. **Planning Center Online Environment Setup**:
   - Confirm that `PCO_APPLICATION_ID` and `PCO_SECRET` are added to the stack environment variables on Portainer (or in the local `.env`).
2. **Template Testing**:
   - Log in to the Admin Panel at `https://docsign.server.mtcd.org`.
   - Edit an existing waiver template (or create a new one).
   - Check the **Enable Planning Center Online (PCO) Registrations Sync** checkbox.
   - Enter a valid **PCO Signup ID** (from PCO Registrations) and the **PCO Custom Question Title** (e.g. `"Waiver Signed?"`).
   - Copy the PCO shared link generated in the settings panel.
3. **Submit a test signature**:
   - Access the copied link with `?pco_attendee_id=<test_attendee_id>` appended.
   - Complete the signature.
   - Check the system audit logs in the Admin Dashboard to verify that the PCO sync was triggered, and verify in the PCO Registrations portal that the custom question is automatically checked off as "Yes"!
