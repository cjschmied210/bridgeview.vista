
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function verify() {
    console.log("Checking analysis logs...");
    const { data, error } = await supabase
        .from('analysis_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error("Error:", error);
        return;
    }

    if (data.length === 0) {
        console.log("No analysis logs found.");
    } else {
        console.log(`Found ${data.length} logs.`);
        data.forEach(log => {
            console.log(`- [${log.created_at}] ${log.behavior_category}: ${log.ai_feedback}`);
        });
    }
}

verify();
