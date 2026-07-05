import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
    console.log("Received Student DELETION request");
    try {
        const body = await req.json();
        const { student_id } = body;

        if (!student_id) {
            return NextResponse.json(
                { error: "Invalid payload: student_id is required" },
                { status: 400 }
            );
        }

        // 1. Fetch all documents belonging to the student
        const { data: docs, error: docFetchError } = await supabase
            .from('documents')
            .select('id')
            .eq('student_id', student_id);

        if (docFetchError) {
            console.error("Error fetching student documents:", docFetchError);
            return NextResponse.json({ error: docFetchError.message }, { status: 500 });
        }

        const docIds = (docs || []).map(d => d.id);

        if (docIds.length > 0) {
            // 2. Fetch all snapshots linked to these documents
            const { data: snaps, error: snapFetchError } = await supabase
                .from('snapshots')
                .select('id')
                .in('document_id', docIds);

            if (snapFetchError) {
                console.error("Error fetching document snapshots:", snapFetchError);
                return NextResponse.json({ error: snapFetchError.message }, { status: 500 });
            }

            const snapIds = (snaps || []).map(s => s.id);

            if (snapIds.length > 0) {
                // 3. Delete analysis logs linked to these snapshots
                const { error: logsDelError } = await supabase
                    .from('analysis_logs')
                    .delete()
                    .in('snapshot_id', snapIds);

                if (logsDelError) {
                    console.error("Error deleting analysis logs:", logsDelError);
                    return NextResponse.json({ error: logsDelError.message }, { status: 500 });
                }

                // 4. Delete snapshots
                const { error: snapsDelError } = await supabase
                    .from('snapshots')
                    .delete()
                    .in('id', snapIds);

                if (snapsDelError) {
                    console.error("Error deleting snapshots:", snapsDelError);
                    return NextResponse.json({ error: snapsDelError.message }, { status: 500 });
                }
            }

            // 5. Delete documents
            const { error: docsDelError } = await supabase
                .from('documents')
                .delete()
                .in('id', docIds);

            if (docsDelError) {
                console.error("Error deleting documents:", docsDelError);
                return NextResponse.json({ error: docsDelError.message }, { status: 500 });
            }
        }

        // 6. Delete student record
        const { error: studentDelError } = await supabase
            .from('students')
            .delete()
            .eq('id', student_id);

        if (studentDelError) {
            console.error("Error deleting student:", studentDelError);
            return NextResponse.json({ error: studentDelError.message }, { status: 500 });
        }

        console.log(`Student ${student_id} and all related logs successfully deleted.`);
        return NextResponse.json({ status: "success", deleted_student_id: student_id });

    } catch (error: any) {
        console.error("Student deletion error:", error);
        return NextResponse.json(
            { error: error?.message || "Internal server error" },
            { status: 500 }
        );
    }
}
