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

        // Check if student exists
        const { data: existingStudent } = await supabase
            .from('students')
            .select('id, name, classroom_id')
            .eq('id', student_id)
            .single();

        const studentName = student_name?.trim() || existingStudent?.name || `Student ${student_id.substring(0, 6)}`;

        if (!existingStudent) {
            // Create new student as unassigned (classroom_id: null)
            await supabase.from('students').insert({
                id: student_id,
                name: studentName,
                classroom_id: null,
                last_active: new Date().toISOString()
            });
        } else {
            // Update student name and activity only
            await supabase.from('students').update({
                name: studentName,
                last_active: new Date().toISOString()
            }).eq('id', student_id);
        }

        // Upsert Document with Title
        const { error: docError } = await supabase
            .from('documents')
            .upsert({
                id: document_id,
                student_id: student_id,
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

        console.log("Ingested snapshot for:", student_id);
        const snapshot_id = snapshotData?.id;

        // Trigger Async Analysis (Fire and forget)
        if (snapshot_id) {
            const origin = new URL(req.url).origin;
            fetch(`${origin}/api/analysis`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ document_id, student_id, snapshot_id })
            }).catch(err => console.error("Async analysis trigger failed:", err));
        }

        return NextResponse.json({ status: "success", received_at: new Date().toISOString() });
    } catch (error) {
        console.error("Ingest error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
