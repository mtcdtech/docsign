# Notes for Next Session

Here is the recommended starting point and next steps for the next session.

## Verification Checklist for Registrations & Branding (v0.14.0)

1. **Verify Global Settings & Branding**:
   - Access the Admin Dashboard and go to the **Settings** page.
   - Under the **Theming & Logo** tab, upload **App Logo (Light Mode)** and **App Logo (Dark Mode)**. Change your system theme preference and verify that the logo changes dynamically.
   - Go to the **Organization Branding** tab, find an organization, and upload **Light Mode** and **Dark Mode** logos.

2. **Verify Registration Form PCO Setup**:
   - Go to `/admin/registrations` and click **+ Create Registration**.
   - Input a title, slug, select an organization, check multiple templates, and enter a valid **Planning Center Signup ID**.
   - Arrange the templates in order and click **Create Registration**.

3. **Verify PCO Attendees Grid & Live Tracking**:
   - In the registrations table, click on the title of the newly created registration to access the details dashboard: `/admin/registrations/[id]`.
   - Verify that the list table displays registrants fetched from Planning Center, with their names, emails, and form completion checklist statuses showing "Not Started" / "Partial".
   - Submit a test signature sequence using a registrant's email.
   - Re-visit the dashboard, click **🔄 Reload List**, and check that the registrant's status changed to **Completed** or **Partial**, displaying checkmarks on completed forms.
   - Click the **Sync PCO** button on the row to verify manual check-off triggers.

4. **Verify Email Logo Layouts**:
   - Check the sent confirmation emails. Verify that both the **App Logo** and **Organization Logo** render side-by-side inside the dark header block cleanly.

5. **Verify Audit Log Contrast**:
   - Go to the Admin Dashboard and expand the **System Audit Log** card.
   - Confirm that the gray background spans are removed and that the event actions (Login, Create, Delete, Email) display high-contrast bold color coding.
