# MERGE meal signup backend setup

These files prepare a separate Google Apps Script web app for the existing signup spreadsheet. They do not update the live site or the old deployment automatically. The new app uses the existing first four columns (`date_iso`, `date_nice`, `name`, `timestamp`) and adds `email`, `token_hash`, and `reminder_for` in columns E–G. Back up the sheet first and make sure columns E–G are empty.

1. Open the existing spreadsheet's **Extensions → Apps Script** project. Replace the code in `Code.gs` with the contents of `Code.gs` in this folder. Add an HTML file named `Index` and copy in `Index.html`. Save the project.
2. In **Project Settings → Script Properties**, add `TOKEN_SECRET`. Generate a random secret on your own computer, for example with `openssl rand -hex 32`, and paste its output as the value. Keep it private and do not change it later: changing it invalidates existing management links.
3. Use **Deploy → New deployment → Web app**, execute as yourself, and allow access to anyone. Create a **new deployment**, rather than editing the existing one, so the existing signup continues to work during setup. Authorize the requested spreadsheet and email permissions.
4. Copy the new `/exec` URL. Add a second script property named `APP_URL` with that exact URL. Do not use the old deployment's URL.
5. In the editor, select and run `installReminderTrigger_`, authorizing it if prompted. It creates a daily 9 a.m. Eastern trigger; only signups three days away receive reminders. Apps Script may run the trigger within the selected hour.
6. Open the new `/exec` URL in a private browser window. Test a signup with your own email, verify the confirmation and management link, then change and cancel it. Check the spreadsheet and the Apps Script **Executions** page for errors.
7. Provide the new deployment URL to the site maintainer so the website can be switched over. Once the new site is working, deactivate the **old** deployment in **Deploy → Manage deployments**: its original public list returns full names. Until it is deactivated, first-name privacy is not complete.

Existing signups remain in the sheet, but they have no email or management token. Manage those rows manually; they cannot receive reminders until a volunteer signs up again. Emails are sent from the account that deploys the app and are subject to Google Apps Script email quotas.
