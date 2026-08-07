# Notes for Next Session

Here is the recommended starting point and next steps for the next session.

## Verification Checklist for Email Diagnosis, Manual & Automated Reminders (v0.15.0)

1. **Verify Admin SMTP Configuration & Diagnostic Test**:
   - Access the Admin Dashboard and go to the **Settings** page.
   - Click the **SMTP & Reminders** tab.
   - Enter your SMTP Host, Port, Username, Password, and From Address (or rely on auto-detected Azure Communication Services credentials).
   - Enter a test recipient email and click **📧 Send Test Email**. Confirm that the green success banner appears with a valid message ID and check your inbox for the test message.

2. **Verify Manual Individual & Batch Reminders**:
   - Open a registration packet dashboard at `/admin/registrations/[id]`.
   - Locate an attendee with incomplete waivers ("Not Started" or "Partial").
   - Click **📧 Send Reminder** on their row. Verify that the button switches to "Sending...", then displays a success notification, and the **Reminder Status** column updates to show *"Sent: [Date] (1 reminder sent)"*.
   - Click **📧 Send All Reminders** in the top action toolbar. Confirm that reminder emails are sent in batch to all incomplete registrants.

3. **Verify Automated Reminder Schedule Display**:
   - In Admin Settings under **SMTP & Reminders**, select an automated schedule timing (e.g. 24 Hours after Registration).
   - Return to `/admin/registrations/[id]` and confirm that for registrants who have not completed their waivers, the **Reminder Status / Scheduled** column displays *"⏰ Scheduled: [Date & Time]"*.
