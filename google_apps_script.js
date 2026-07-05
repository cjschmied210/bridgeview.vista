/**
 * BRIDGEVIEW VISTA - STUDENT SENDER SCRIPT
 * 
 * Instructions:
 * 1. Open a Google Doc.
 * 2. Go to Extensions > Apps Script.
 * 3. Paste this code, replacing any existing code.
 * 4. Update the `API_ENDPOINT` variable below with your Vercel URL (once deployed).
 * 5. Save and Reload the Google Doc.
 * 6. Content -> Bridgeview Vista -> Start Monitoring
 */

// TODO: Replace with your actual deployed Vercel URL (e.g., https://your-project.vercel.app/api/ingest)
// Localhost DOES NOT work with Google Apps Script.
const API_ENDPOINT = "https://bridgeview-vista.vercel.app/api/ingest";

// Retrieve or generate consistent Student ID and name
function getStudentInfo() {
    const props = PropertiesService.getDocumentProperties();
    let studentId = props.getProperty("STUDENT_ID");
    let studentName = props.getProperty("STUDENT_NAME");

    if (!studentId) {
        studentId = "student_" + Math.random().toString(36).substr(2, 9);
        props.setProperty("STUDENT_ID", studentId);
    }

    const ui = DocumentApp.getUi();

    if (!studentName) {
        const response = ui.prompt("Student Registration", "Please enter your full name:", ui.ButtonSet.OK_CANCEL);
        if (response.getSelectedButton() !== ui.Button.OK || !response.getResponseText().trim()) {
            throw new Error("Student name is required to start monitoring.");
        }
        studentName = response.getResponseText().trim();
        props.setProperty("STUDENT_NAME", studentName);
    }

    return {
        studentId: studentId,
        studentName: studentName
    };
}

function onOpen() {
    DocumentApp.getUi()
        .createMenu('📝 Classroom Monitor')
        .addItem('▶️ Start Monitoring', 'startMonitoring')
        .addItem('⏹️ Stop Monitoring', 'stopMonitoring')
        .addSeparator()
        .addItem('🔄 Force Sync Now', 'syncToDashboardManual')
        .addToUi();
}

function startMonitoring() {
    const ui = DocumentApp.getUi();

    // Check if trigger exists
    const triggers = ScriptApp.getProjectTriggers();
    for (let t of triggers) {
        if (t.getHandlerFunction() === 'syncToDashboard') {
            ui.alert('Monitoring is already active.');
            return;
        }
    }

    try {
        // Prompts student if info is missing
        const info = getStudentInfo();

        ui.alert(`Connecting as "${info.studentName}"...`);

        // Perform initial sync validation
        const success = syncToDashboardInternal();
        if (!success) {
            ui.alert('Connection Failed: Could not connect to the classroom server.');
            return;
        }

        // Create a time-based trigger to run every 1 minute
        ScriptApp.newTrigger('syncToDashboard')
            .timeBased()
            .everyMinutes(1)
            .create();

        ui.alert(`Successfully connected!\nMonitoring started. Your progress will be sent to the teacher dashboard every minute.`);
    } catch (e) {
        ui.alert(`Error: ${e.message}`);
    }
}

function stopMonitoring() {
    const triggers = ScriptApp.getProjectTriggers();
    for (let t of triggers) {
        if (t.getHandlerFunction() === 'syncToDashboard') {
            ScriptApp.deleteTrigger(t);
        }
    }
    DocumentApp.getUi().alert('Monitoring stopped.');
}

function syncToDashboardManual() {
    try {
        const success = syncToDashboardInternal();
        if (success) {
            DocumentApp.getUi().alert('Sync successful!');
        } else {
            DocumentApp.getUi().alert('Sync failed.');
        }
    } catch (e) {
        DocumentApp.getUi().alert(`Sync failed: ${e.message}`);
    }
}

// Background trigger handler (must not interact with DocumentApp UI)
function syncToDashboard() {
    syncToDashboardInternal();
}

function syncToDashboardInternal() {
    const props = PropertiesService.getDocumentProperties();
    const studentId = props.getProperty("STUDENT_ID");
    const studentName = props.getProperty("STUDENT_NAME");

    if (!studentId || !studentName) {
        console.error("Missing student registration info");
        return false;
    }

    try {
        const doc = DocumentApp.getActiveDocument();
        const body = doc.getBody();
        const text = body.getText();
        const docId = doc.getId();
        const docTitle = doc.getName();

        // --- ADAPTIVE SYNCING LOGIC ---
        const lastContent = props.getProperty("LAST_SYNC_CONTENT") || "";
        let stallCount = parseInt(props.getProperty("STALL_COUNT") || "0", 10);

        if (text === lastContent) {
            stallCount++;
            props.setProperty("STALL_COUNT", stallCount.toString());

            // If stalled for over 3 minutes, throttle updates to once every 5 minutes (5 cycles)
            if (stallCount > 3 && (stallCount - 3) % 5 !== 0) {
                console.log(`Adaptive Sync: Skipping send (stalled for ${stallCount} minutes)`);
                return true; 
            }
        } else {
            // Text changed! Reset stall counter
            stallCount = 0;
            props.setProperty("STALL_COUNT", "0");
            props.setProperty("LAST_SYNC_CONTENT", text);
        }
        // ------------------------------

        // Construct Payload
        const payload = {
            student_id: studentId,
            student_name: studentName,
            document_id: docId,
            document_title: docTitle,
            text_content: text,
            timestamp: Date.now()
        };

        // Send to Dashboard
        const options = {
            method: 'post',
            contentType: 'application/json',
            payload: JSON.stringify(payload),
            muteHttpExceptions: true
        };

        const response = UrlFetchApp.fetch(API_ENDPOINT, options);
        const code = response.getResponseCode();

        console.log(`Sync status: ${code}`, response.getContentText());

        return code === 200 || code === 201;
    } catch (e) {
        console.error("Sync failed", e);
        return false;
    }
}
