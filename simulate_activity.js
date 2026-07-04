
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const sbKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!sbUrl || !sbKey) {
    console.error("Missing env vars");
    process.exit(1);
}

const supabase = createClient(sbUrl, sbKey);

const statuses = ['flowing', 'editing', 'stalled', 'distressed'];

async function simulate() {
    console.log("Starting simulation... Press Ctrl+C to stop.");

    // Get all students first
    const { data: students, error } = await supabase.from('students').select('id, name');

    if (error || !students || students.length === 0) {
        console.error("No students found to update.", error);
        return;
    }

    while (true) {
        // Pick random student
        const student = students[Math.floor(Math.random() * students.length)];
        // Pick random status
        const newStatus = statuses[Math.floor(Math.random() * statuses.length)];

        console.log(`Updating ${student.name} to ${newStatus}...`);

        await supabase
            .from('students')
            .update({
                status: newStatus,
                last_active: new Date().toISOString()
            })
            .eq('id', student.id);

        // Wait 3 seconds
        await new Promise(r => setTimeout(r, 3000));
    }
}

simulate();
