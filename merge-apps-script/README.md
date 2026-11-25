# MERGE meal signup backend setup

These files prepare a separate Google Apps Script web app for the existing signup spreadsheet. They do not update the live site or the old deployment automatically. The new app uses the existing first four columns (`date_iso`, `date_nice`, `name`, `timestamp`) and adds fields in columns E–I. Back up the sheet first and make sure columns E–I are empty.

1. Open the existing spreadsheet's **Extensions → Apps Script** project. Replace the code in `Code.gs` with the contents of `Code.gs` in this folder. Add an HTML file named `Index` and copy in `Index.html`. Save the project.
2. In **Project Settings → Script Properties**, add `TOKEN_SECRET`. Generate a random secret on your own computer, for example with `openssl rand -hex 32`, and paste its output as the value. Keep it private and do not change it later: changing it invalidates existing management links.
3. Use **Deploy → New deployment → Web app**, execute as yourself, and allow access to anyone. Create a **new deployment**, rather than editing the existing one, so the existing signup continues to work during setup. Authorize the requested spreadsheet and email permissions.
4. Copy the new `/exec` URL. Add a second script property named `APP_URL` with that exact URL. Do not use the old deployment's URL.
5. In the editor, select and run `installReminderTrigger_`, authorizing it if prompted. It creates a daily 9 a.m. Eastern trigger; only signups three days away receive reminders. Apps Script may run the trigger within the selected hour.
6. Open the new `/exec` URL in a private browser window. Test a signup with your own email, verify the confirmation and management link, then change and cancel it. Check the spreadsheet and the Apps Script **Executions** page for errors.
7. Provide the new deployment URL to the site maintainer so the website can be switched over. Once the new site is working, deactivate the **old** deployment in **Deploy → Manage deployments**: its original public list returns full names. Until it is deactivated, first-name privacy is not complete.

Existing signups remain in the sheet, but they have no email or management token. Manage those rows manually; they cannot receive reminders until a volunteer signs up again. Emails are sent from the account that deploys the app and are subject to Google Apps Script email quotas.

## Calendar invitations

Back up the spreadsheet and make sure columns H and I are empty. In the existing Apps Script project:

1. Copy the updated `Code.gs` and `Index.html` into the project and save. Leave the existing `TOKEN_SECRET` and `APP_URL` properties unchanged.
2. Under **Services**, add **Google Calendar API**. If the project uses a standard Google Cloud project, enable the Google Calendar API there as well.
3. Add a script property named `COORDINATOR_EMAIL` containing the coordinator's email address.
4. Select and run `authorizeCalendar`, and grant the requested calendar permissions. Events are created on the script owner's primary calendar.
5. In **Deploy → Manage deployments**, edit the active web app, select **New version**, and deploy. Test a new signup, a date change, and cancellation using test email addresses. Confirm invitations and updates arrive for both guests.

New signups create a private 5:45–6:00 PM Eastern event and invite both the volunteer and coordinator. Google Calendar controls whether guests automatically see invitations on their calendars; they may need to accept them. The 24-hour event reminder is for the organizer only, because Google Calendar reminders are private to each user. The existing email trigger also sends volunteers a separate Saturday reminder in addition to Thursday's. Existing signups aren't automatically invited; updating one through its management link creates an invitation.

If a calendar invitation fails, the signup remains saved and the form reports the problem. The organizer should check **Executions** and calendar permissions; saving the signup again using its management link retries the invitation. A cancellation is not processed if its calendar event cannot be canceled. Calendar notifications and reminder emails are subject to Google's limits.

## Updating the signup form

After changing `Index.html`, copy its current contents into the Apps Script `Index` file and save. In **Deploy → Manage deployments**, edit the existing new web app deployment, choose **New version**, and deploy. This preserves the `/exec` URL and existing management links. To enable date selection from the calendar, deploy the version containing the `date` parameter handling.
