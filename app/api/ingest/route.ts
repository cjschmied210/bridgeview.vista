import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase";

export async function POST(req: Request) {
    console.log("Received INGEST request");
    try {
        const body = await req.json();
        const { student_id, student_name, document_id, document_title, text_content, timestamp } = body;

        if (!student_id || !document_id || typeof text_content !== "string") {
            return NextResponse.json(
                { error: "Invalid payload" },
                { status: 400 }
            );
        }

        // Check if student exists by ID
        let { data: existingStudent } = await supabase
            .from('students')
            .select('id, name, classroom_id')
            .eq('id', student_id)
            .single();

        let finalStudentId = student_id;
        const studentName = student_name?.trim() || existingStudent?.name || `Student ${student_id.substring(0, 6)}`;

        // Smart name-matching: if not found by ID, check if a student with the same name already exists
        if (!existingStudent && student_name) {
            const { data: studentByName } = await supabase
                .from('students')
                .select('id, name, classroom_id')
                .ilike('name', student_name.trim())
                .maybeSingle();

            if (studentByName) {
                existingStudent = studentByName;
                finalStudentId = studentByName.id;
                console.log(`Smart Match: Merged new document for student name "${studentName}" to existing ID ${finalStudentId}`);
            }
        }

        if (!existingStudent) {
            // Create new student as unassigned (classroom_id: null)
            await supabase.from('students').insert({
                id: finalStudentId,
                name: studentName,
                classroom_id: null,
                last_active: new Date().toISOString()
            });
        } else {
            // Update student name and activity only
            await supabase.from('students').update({
                name: studentName,
                last_active: new Date().toISOString()
            }).eq('id', finalStudentId);
        }

        // Upsert Document with Title
        const { error: docError } = await supabase
            .from('documents')
            .upsert({
                id: document_id,
                student_id: finalStudentId,
                title: document_title || "Untitled Document",
                last_updated: new Date().toISOString()
            }, { onConflict: 'id' });

        if (docError) console.error('Doc upsert error:', docError);

        // Insert Snapshot
        const { data: snapshotData, error: snapError } = await supabase
            .from('snapshots')
            .insert({
                document_id: document_id,
                content: text_content,
                timestamp: timestamp
            })
            .select()
            .single();

        if (snapError) console.error('Snapshot insert error:', snapError);

        console.log("Ingested snapshot for:", finalStudentId);
        const snapshot_id = snapshotData?.id;

        // Trigger Async Analysis (Fire and forget)
        if (snapshot_id) {
            const origin = new URL(req.url).origin;
            fetch(`${origin}/api/analysis`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ document_id, student_id: finalStudentId, snapshot_id })
            }).catch(err => console.error("Async analysis trigger failed:", err));
        }

        return NextResponse.json({ 
            status: "success", 
            student_id: finalStudentId,
            received_at: new Date().toISOString() 
        });
    } catch (error) {
        console.error("Ingest error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
