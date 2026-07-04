
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const sbKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(sbUrl, sbKey);

async function testIngest() {
    console.log("Fetching a student...");
    const { data: students } = await supabase.from('students').select('id, name').limit(1);

    if (!students || students.length === 0) {
        console.error("No students found. Run seed_db.js first.");
        return;
    }

    const student = students[0];
    const docId = `doc_${Date.now()}`;

    console.log(`Simulating ingest for ${student.name} (${student.id})...`);

    const payload = {
        student_id: student.id,
        document_id: docId,
        text_content: "The Bridgeview Vista project aims to revolutionize classroom monitoring. By integrating real-time data flow, teachers can see student progress instantly.",
        timestamp: Date.now()
    };

    console.log("Sending payload:", payload);

    try {
        const res = await fetch('http://localhost:3000/api/ingest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        console.log("Response:", res.status, data);

        if (res.ok) {
            console.log("Ingest successful! Check the dashboard (and console for async analysis logs in the server terminal).");
        } else {
            console.error("Ingest failed.");
        }
    } catch (e) {
        console.error("Request failed:", e);
    }
}

testIngest();
