const TZ = 'America/Detroit';
const SHEET_NAME = 'Sheet1';
const LAST_SIGNUP_DATE = '2027-12-26';
const HEADERS = ['date_iso', 'date_nice', 'name', 'timestamp', 'email', 'token_hash', 'reminder_for', 'calendar_event_id', 'day_before_reminder_for'];

function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || '').toLowerCase();
  if (action === 'list') {
    const body = JSON.stringify(listSignups_());
    const callback = e.parameter.callback;
    if (callback) {
      if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(callback)) {
        return ContentService.createTextOutput('Invalid callback');
      }
      return ContentService.createTextOutput(callback + '(' + body + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
  }
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('MERGE Meal Sign-Ups')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function doPost() {
  return ContentService.createTextOutput(JSON.stringify({
    error: 'Please use the updated signup page.'
  })).setMimeType(ContentService.MimeType.JSON);
}

function fmtDate_(value) {
  return value instanceof Date
    ? Utilities.formatDate(value, TZ, 'yyyy-MM-dd')
    : String(value || '').slice(0, 10);
}

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  } else {
    const headers = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
    if (headers.slice(0, 4).join(',') !== HEADERS.slice(0, 4).join(',')) {
      throw new Error('The spreadsheet columns do not match the expected signup format.');
    }
    for (let column = 4; column < HEADERS.length; column++) {
      if (headers[column] && headers[column] !== HEADERS[column]) {
        throw new Error('Spreadsheet column ' + (column + 1) + ' is already in use.');
      }
      if (!headers[column] && sheet.getLastRow() > 1 &&
          sheet.getRange(2, column + 1, sheet.getLastRow() - 1, 1)
            .getValues().some(row => row[0] !== '')) {
        throw new Error('Spreadsheet column ' + (column + 1) + ' contains existing data.');
      }
    }
    if (headers.slice(4).join(',') !== HEADERS.slice(4).join(',')) {
      sheet.getRange(1, 5, 1, HEADERS.length - 4).setValues([HEADERS.slice(4)]);
    }
  }
  return sheet;
}

function rows_(sheet) {
  const last = sheet.getLastRow();
  return last > 1 ? sheet.getRange(2, 1, last - 1, HEADERS.length).getValues() : [];
}

function listSignups_() {
  const byDate = {};
  rows_(sheet_()).forEach(row => {
    const date = fmtDate_(row[0]);
    if (!date) return;
    const name = String(row[2] || '').trim();
    const time = row[3] instanceof Date ? row[3].getTime() : Date.parse(row[3]) || 0;
    if (!byDate[date] || time >= byDate[date].time) {
      byDate[date] = { date_iso: date, first_name: name.split(/\s+/)[0] || 'Volunteer', time };
    }
  });
  return Object.values(byDate).map(entry => ({
    date_iso: entry.date_iso,
    first_name: entry.first_name
  }));
}

function listSignups() {
  return listSignups_();
}

function secret_() {
  const secret = PropertiesService.getScriptProperties().getProperty('TOKEN_SECRET');
  if (!secret || !/^[0-9a-f]{64,}$/i.test(secret)) {
    throw new Error('The signup service is not configured. Please contact the organizer.');
  }
  return secret;
}

function token_() {
  const value = Utilities.getUuid() + ':' + Utilities.getUuid() + ':' + Date.now();
  return Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(value, secret_())
  ).replace(/=+$/, '');
}

function tokenHash_(token) {
  return Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(String(token), secret_())
  );
}

function details_(details) {
  const date = String(details.date || '');
  const name = String(details.name || '').trim().replace(/\s+/g, ' ');
  const email = String(details.email || '').trim();
  const parsed = new Date(date + 'T12:00:00Z');
  const today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== date || parsed.getUTCDay() !== 0 ||
      date < today || date > LAST_SIGNUP_DATE) {
    throw new Error('Please select an available upcoming Sunday.');
  }
  if (!name || name.length > 120 || /^[=+\-@]/.test(name)) {
    throw new Error('Please enter a valid name.');
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      /^[=+\-@]/.test(email) || /[\r\n]/.test(email)) {
    throw new Error('Please enter a valid email address.');
  }
  return { date, name, email };
}

function dateNice_(date) {
  return Utilities.formatDate(new Date(date + 'T12:00:00Z'), 'UTC', 'EEEE, MMMM d, yyyy');
}

function calendarEvent_(entry, id) {
  const coordinator = PropertiesService.getScriptProperties().getProperty('COORDINATOR_EMAIL');
  if (!coordinator || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(coordinator)) {
    throw new Error('Coordinator email is not configured.');
  }
  const attendees = [{ email: entry.email }];
  if (coordinator.toLowerCase() !== entry.email.toLowerCase()) attendees.push({ email: coordinator });
  return {
    id,
    summary: 'MERGE youth group meal',
    description: 'Thank you for providing a meal for MERGE youth group.',
    start: { dateTime: entry.date + 'T17:45:00', timeZone: TZ },
    end: { dateTime: entry.date + 'T18:00:00', timeZone: TZ },
    attendees,
    guestsCanSeeOtherGuests: false,
    visibility: 'private',
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 1440 }] }
  };
}

function calendarNotFound_(error) {
  return /\b404\b|not found/i.test(String(error && error.message));
}

function syncCalendar_(entry, id) {
  const event = calendarEvent_(entry, id);
  try {
    Calendar.Events.get('primary', id);
  } catch (error) {
    if (!calendarNotFound_(error)) throw error;
    Calendar.Events.insert(event, 'primary', { sendUpdates: 'all' });
    return;
  }
  delete event.id;
  Calendar.Events.patch(event, 'primary', id, { sendUpdates: 'all' });
}

function removeCalendar_(id) {
  if (!id) return;
  try {
    Calendar.Events.remove('primary', id, { sendUpdates: 'all' });
  } catch (error) {
    if (!calendarNotFound_(error)) throw error;
  }
}

function authorizeCalendar() {
  Calendar.Events.list('primary', { maxResults: 1 });
}

function sendCalendarInvite_(entry, id) {
  try {
    syncCalendar_(entry, id);
    return true;
  } catch (error) {
    console.error('Calendar invitation failed for event ' + id, error);
    return false;
  }
}

function managementUrl_(token) {
  const url = PropertiesService.getScriptProperties().getProperty('APP_URL');
  if (!url || !/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url)) {
    throw new Error('The signup service URL is not configured. Please contact the organizer.');
  }
  return url + '#manage=' + encodeURIComponent(token);
}

function sendConfirmation_(entry, token) {
  const properties = PropertiesService.getScriptProperties();
  const day = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  if (properties.getProperty('MAIL_LIMIT_DAY') !== day) {
    Object.keys(properties.getProperties())
      .filter(key => key.indexOf('MAIL_COUNT_') === 0)
      .forEach(key => properties.deleteProperty(key));
    properties.setProperty('MAIL_LIMIT_DAY', day);
  }
  const emailKey = 'MAIL_COUNT_' + tokenHash_(entry.email.toLowerCase());
  const totalKey = 'MAIL_COUNT_TOTAL';
  const emailCount = Number(properties.getProperty(emailKey) || 0);
  const totalCount = Number(properties.getProperty(totalKey) || 0);
  if (emailCount >= 10 || totalCount >= 80 || MailApp.getRemainingDailyQuota() < 1) {
    throw new Error('Confirmation email limit reached.');
  }
  const managementUrl = managementUrl_(token);
  properties.setProperty(emailKey, String(emailCount + 1));
  properties.setProperty(totalKey, String(totalCount + 1));
  MailApp.sendEmail({
    to: entry.email,
    subject: 'MERGE meal signup confirmation',
    body: 'Thank you for signing up to provide a MERGE meal on ' + dateNice_(entry.date) +
      '.\n\nUse this private link to change or cancel your signup:\n' + managementUrl +
      '\n\nPlease do not share this link.'
  });
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function findToken_(rows, token) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(String(token || ''))) {
    throw new Error('This management link is invalid or has expired.');
  }
  const hash = tokenHash_(token);
  const index = rows.findIndex(row => row[5] && row[5] === hash);
  if (index < 0) throw new Error('This management link is invalid or has expired.');
  return index;
}

function createSignup(details) {
  const entry = details_(details);
  return withLock_(() => {
    const sheet = sheet_();
    const rows = rows_(sheet);
    if (rows.some(row => fmtDate_(row[0]) === entry.date)) {
      throw new Error('That date is already taken. Please choose another Sunday.');
    }
    const token = token_();
    const eventId = Utilities.getUuid().replace(/-/g, '').toLowerCase();
    sheet.appendRow([entry.date, dateNice_(entry.date), entry.name, new Date(),
      entry.email, tokenHash_(token), '', eventId, '']);
    const rowNumber = sheet.getLastRow();
    try {
      sendConfirmation_(entry, token);
    } catch (error) {
      sheet.deleteRow(rowNumber);
      console.error(error);
      throw new Error('We could not send your confirmation email. Your signup was not saved; please try again.');
    }
    return { ok: true, calendarSent: sendCalendarInvite_(entry, eventId) };
  });
}

function getSignup(token) {
  const rows = rows_(sheet_());
  const row = rows[findToken_(rows, token)];
  return { date: fmtDate_(row[0]), name: String(row[2]), email: String(row[4]) };
}

function updateSignup(token, details) {
  const entry = details_(details);
  return withLock_(() => {
    const sheet = sheet_();
    const rows = rows_(sheet);
    const index = findToken_(rows, token);
    if (rows.some((row, i) => i !== index && fmtDate_(row[0]) === entry.date)) {
      throw new Error('That date is already taken. Please choose another Sunday.');
    }
    const nextToken = token_();
    const eventId = rows[index][7] || Utilities.getUuid().replace(/-/g, '').toLowerCase();
    const range = sheet.getRange(index + 2, 1, 1, HEADERS.length);
    range.setValues([[entry.date, dateNice_(entry.date), entry.name, new Date(),
      entry.email, tokenHash_(nextToken), '', eventId, '']]);
    try {
      sendConfirmation_(entry, nextToken);
    } catch (error) {
      range.setValues([rows[index]]);
      console.error(error);
      throw new Error('We could not send the updated confirmation email. Your signup was not changed.');
    }
    return { ok: true, token: nextToken, calendarSent: sendCalendarInvite_(entry, eventId) };
  });
}

function cancelSignup(token) {
  return withLock_(() => {
    const sheet = sheet_();
    const rows = rows_(sheet);
    const index = findToken_(rows, token);
    const row = rows[index];
    try {
      removeCalendar_(row[7]);
    } catch (error) {
      console.error('Calendar cancellation failed for event ' + row[7], error);
      throw new Error('We could not cancel the calendar invitation. Your signup was not canceled; please try again.');
    }
    sheet.deleteRow(index + 2);
    try {
      MailApp.sendEmail({
        to: String(row[4]),
        subject: 'MERGE meal signup canceled',
        body: 'Your MERGE meal signup for ' + dateNice_(fmtDate_(row[0])) + ' has been canceled.'
      });
      return { ok: true, emailSent: true };
    } catch (error) {
      console.error(error);
      return { ok: true, emailSent: false };
    }
  });
}

function sendReminders_() {
  withLock_(() => {
    const sheet = sheet_();
    const targets = [3, 1].map(days => Utilities.formatDate(
      new Date(Date.now() + days * 24 * 60 * 60 * 1000), TZ, 'yyyy-MM-dd'
    ));
    rows_(sheet).forEach((row, index) => {
      const date = fmtDate_(row[0]);
      const reminder = targets.indexOf(date);
      if (reminder < 0 || !row[4] || !row[5] || row[reminder === 0 ? 6 : 8] === date) return;
      try {
        MailApp.sendEmail({
          to: String(row[4]),
          subject: 'Reminder: MERGE meal this Sunday',
          body: 'Thank you for providing a MERGE meal on ' + dateNice_(date) +
            ' from 5:45 to 6:00 PM Eastern.' +
            ' Please use your confirmation email if you need to change or cancel your signup.'
        });
        sheet.getRange(index + 2, reminder === 0 ? 7 : 9).setValue(date);
      } catch (error) {
        console.error('Reminder failed for spreadsheet row ' + (index + 2), error);
      }
    });
  });
}

function installReminderTrigger_() {
  ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === 'sendReminders_')
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger('sendReminders_').timeBased().everyDays(1)
    .atHour(9).inTimezone(TZ).create();
}
