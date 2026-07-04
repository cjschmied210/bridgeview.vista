/**
 * Bridgeview Vista - The Listener
 * 
 * Instructions:
 * 1. Open your Google Doc.
 * 2. Go to Extensions > Apps Script.
 * 3. Paste this code.
 * 4. Update the TARGET_URL with your deployed Next.js API URL (e.g., https://your-project.vercel.app/api/ingest).
 * 5. Save and reload the document.
 */

const TARGET_URL = 'http://localhost:3000/api/ingest'; // Change this for production
const DEBOUNCE_SECONDS = 30;

function onEdit(e) {
  // Note: onEdit cannot make fetch calls directly if they are anonymous.
  // We might need an installable trigger for robust syncing.
  // For the prototype, we'll try a time-driven approach or menu item trigger.
  logChange();
}

function logChange() {
  const doc = DocumentApp.getActiveDocument();
  const body = doc.getBody();
  const text = body.getText();
  const user = Session.getActiveUser().getEmail();
  const docId = doc.getId();

  const payload = {
    student_id: user,
    document_id: docId,
    text_content: text,
    timestamp: new Date().getTime()
  };

  const options = {
    'method' : 'post',
    'contentType': 'application/json',
    'payload' : JSON.stringify(payload),
    'muteHttpExceptions': true
  };

  try {
    UrlFetchApp.fetch(TARGET_URL, options);
    Logger.log('Data sent');
  } catch (err) {
    Logger.log('Error sending data: ' + err);
  }
}

/**
 * Setup installable trigger manually if onEdit restriction applies
 */
function createTimeTrigger() {
  ScriptApp.newTrigger('logChange')
      .timeBased()
      .everyMinutes(1)
      .create();
}
