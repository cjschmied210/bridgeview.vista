import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase";
import { model } from "@/lib/gemini";

export async function POST(req: Request) {
    console.log("Received ANALYSIS request");
    try {
        const { document_id, student_id, snapshot_id } = await req.json();

        if (!document_id || !student_id) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // 1. Fetch the TWO most recent snapshots
        const { data: snapshots, error: fetchError } = await supabase
            .from("snapshots")
            .select("id, content, timestamp")
            .eq("document_id", document_id)
            .order("timestamp", { ascending: false })
            .limit(2);

        if (fetchError || !snapshots || snapshots.length === 0) {
            return NextResponse.json({ error: "No snapshots found" }, { status: 404 });
        }

        const currentContent = snapshots[0].content;
        const previousContent = snapshots.length > 1 ? snapshots[1].content : "";

        const currentTimestamp = snapshots[0].timestamp;
        const previousTimestamp = snapshots.length > 1 ? snapshots[1].timestamp : currentTimestamp;
        const timeDiffMs = currentTimestamp - previousTimestamp;
        const timeDiffSeconds = Math.floor(timeDiffMs / 1000);

        const currentLen = currentContent.length;
        const prevLen = previousContent.length;
        const charDiff = currentLen - prevLen;

        // Smart Paste Detection: flag if character difference exceeds 300 characters in a single sync
        const isPaste = charDiff > 300 && snapshots.length > 1;

        // 2. Construct Prompt with Metrics
        const prompt = `
      You are an expert writing coach observing a student's drafting process in real-time.
      
      METRICS:
      - Time Elapsed since last snapshot: ${timeDiffSeconds} seconds
      - Content Length Change: ${charDiff > 0 ? '+' : ''}${charDiff} characters
      
      PREVIOUS DRAFT:
      """${previousContent}"""
      
      CURRENT DRAFT:
      """${currentContent}"""
      
      ANALYZE the student's progress based on the changes and metrics.
      
      Definitions:
      - "Flowing": High volume of new, substantive text added. The student is "in the zone".
      - "Editing": Text length is stable or slightly growing; focus is on refining words, grammar, or sentence structure.
      - "Stalled": Minimal or zero change in content AND Time Elapsed > 60 seconds. The student might be stuck or distracted.
      - "Distressed": Large deletions (> 20% of content removed) WITHOUT replacement, or chaotic/repetitive typing. The student might be frustrated.
      
      Output JSON format ONLY:
      {
        "status": "Flowing" | "Editing" | "Stalled" | "Distressed",
        "summary": "A concise, teacher-facing summary of exactly what changed (e.g. 'Wrote a new intro regarding X', 'Fixed grammar in 2nd paragraph', 'Deleted entire section on Y').",
        "intervention_suggested": boolean (true if status is Stalled or Distressed)
      }
    `;

        // 3. Call Gemini or execute Paste Detection rules
        let analysis = {
            status: "flowing",
            summary: "Active writing session.",
            intervention_suggested: false
        };

        if (isPaste) {
            analysis = {
                status: "distressed",
                summary: `⚠️ Paste event: added ${charDiff} characters instantly.`,
                intervention_suggested: true
            };
        } else {
            try {
                const result = await model.generateContent(prompt);
                const response = await result.response;
                const text = response.text();

                // Clean JSON markdown if present
                const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
                analysis = JSON.parse(cleanJson);
            } catch (geminiError) {
                console.warn("Gemini analysis failed, running rules-based fallback:", geminiError);
                
                // Basic metric rules-based analysis fallback
                let status = 'flowing';
                let summary = 'Active writing process.';
                let intervention = false;

                if (charDiff > 20) {
                    status = 'flowing';
                    summary = `Writing: added ${charDiff} characters.`;
                } else if (charDiff < -100) {
                    status = 'distressed';
                    summary = `Large deletion: removed ${Math.abs(charDiff)} characters.`;
                    intervention = true;
                } else if (Math.abs(charDiff) <= 20) {
                    if (timeDiffSeconds > 60) {
                        status = 'stalled';
                        summary = `Stalled: no activity for ${timeDiffSeconds} seconds.`;
                        intervention = true;
                    } else {
                        status = 'editing';
                        summary = 'Editing and refining content.';
                    }
                }

                analysis = {
                    status: status,
                    summary: summary + " (Fallback)",
                    intervention_suggested: intervention
                };
            }
        }

        // 4. Update Database
        // Log analysis
        await supabase.from("analysis_logs").insert({
            snapshot_id: snapshot_id || snapshots[0].id,
            behavior_category: analysis.status.toLowerCase(),
            ai_feedback: analysis.summary
        });

        // Update Student Status
        await supabase.from("students").update({
            status: analysis.status.toLowerCase(),
            last_active: new Date().toISOString()
        }).eq("id", student_id);

        return NextResponse.json({ success: true, analysis });

    } catch (error) {
        console.error("Analysis Error:", error);
        return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
    }
}
