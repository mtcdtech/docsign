# Notes for Next Session

Here is the recommended starting point and next steps for the next session.

## Verification Checklist for Combined Signing Sessions

1. **Verify Sessions Administration**:
   - Access the Admin Dashboard and check that the **Sessions** tab appears in the top navigation bar.
   - Go to `/admin/sessions` and click **+ Create Session**.
   - Input a title (e.g. `"Retreat Forms Pack"`), set organization, and select multiple templates.
   - Use the ▲ and ▼ buttons to order them, and click **Create Session**.

2. **Verify Public Sequential Sign Wizard**:
   - Copy the generated session URL.
   - Access the link in a private tab: `https://docsign.server.mtcd.org/session/<slug>?pco_attendee_id=<test_id>`.
   - Go through the signature process of the first form.
   - Check that it submits and automatically routes you to the second form, pre-populating your name and email.
   - Complete the remaining forms and verify that the final success screen displays download buttons for all signed documents.

3. **Verify Audit Trail**:
   - Check the **System Audit Log** to ensure that all submissions are correctly logged and that any PCO integrations associated with the templates were successfully triggered during completion!
