
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

async function seed() {
    console.log("Seeding database multi-class structure...");

    // 1. Create Classrooms
    const classes = [
        { name: "Period 1: American Lit" },
        { name: "Period 3: Creative Writing" },
        { name: "Period 4: AP English" }
    ];

    console.log("Upserting classrooms...");
    // We use upsert on 'name' if unique constraint exists, but by default UUID PK is unique.
    // 'classrooms' only has UUID PK. So we search first to avoid duplicates.

    // Clean slate option? No, let's just find or create.
    const createdClasses = [];

    for (const c of classes) {
        // Check if exists
        const { data: existing } = await supabase.from('classrooms').select('*').eq('name', c.name).maybeSingle();

        if (existing) {
            createdClasses.push(existing);
        } else {
            const { data: newClass, error } = await supabase.from('classrooms').insert(c).select().single();
            if (error) {
                console.error("Error creating class:", c.name, error);
            } else {
                createdClasses.push(newClass);
            }
        }
    }

    const p1 = createdClasses.find(c => c.name.includes("Period 1"));
    const p3 = createdClasses.find(c => c.name.includes("Period 3"));
    const p4 = createdClasses.find(c => c.name.includes("Period 4"));

    if (!p1 || !p3 || !p4) {
        console.error("Failed to ensure all classrooms exist.");
        return;
    }

    console.log("Classrooms ready:", createdClasses.map(c => c.name));

    // 2. Upsert Students with assigned classrooms
    // We use specific IDs so simulate scripts can find them easily later.
    const students = [
        { id: "student_alice_1770382711896", name: "Alice Johnson", status: "flowing", classroom_id: p4.id },
        { id: "student_bob_1770382711896", name: "Bob Smith", status: "stalled", classroom_id: p1.id },
        { id: "student_charlie_1770382711896", name: "Charlie Brown", status: "flowing", classroom_id: p3.id },
        { id: "student_diana_1770382711896", name: "Diana Ross", status: "flowing", classroom_id: p4.id },
        { id: "student_ethan_1770382711896", name: "Ethan Hunt", status: "distressed", classroom_id: p1.id },
        { id: "student_frank_1770382711896", name: "Frank Ocean", status: "editing", classroom_id: p3.id },
        { id: "student_grace_1770382711896", name: "Grace Hopper", status: "flowing", classroom_id: p1.id },
    ];

    console.log("Upserting students...");
    for (const s of students) {
        const { error } = await supabase.from('students').upsert({
            id: s.id,
            name: s.name,
            status: s.status,
            classroom_id: s.classroom_id,
            last_active: new Date().toISOString()
        });
        if (error) console.error(`Error adding ${s.name}:`, error);
    }

    console.log("Seeding complete! 3 Classes created with students.");
}

seed();
