import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface StudentDetailModalProps {
    studentId: string;
    studentName: string;
    onClose: () => void;
}

interface ActivityLog {
    id: string; // analysis_log_id
    created_at: string;
    behavior_category: string;
    ai_feedback: string;
    snapshot_content: string | null;
}

export default function StudentDetailModal({ studentId, studentName, onClose }: StudentDetailModalProps) {
    const [history, setHistory] = useState<ActivityLog[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            // Join analysis_logs -> snapshots -> documents to check student_id
            const { data, error } = await supabase
                .from('analysis_logs')
                .select(`
                    id,
                    created_at,
                    behavior_category,
                    ai_feedback,
                    snapshots (
                        content,
                        documents (
                            student_id
                        )
                    )
                `)
                .order('created_at', { ascending: false });

            if (error) {
                console.error("Error fetching history:", error);
                setLoading(false);
                return;
            }

            // Filter client-side by checking the deeply joined student_id
            // @ts-ignore
            const studentLogs = (data || [])
                .filter((log: any) => log.snapshots?.documents?.student_id === studentId)
                .map((log: any) => ({
                    id: log.id,
                    created_at: log.created_at,
                    behavior_category: log.behavior_category,
                    ai_feedback: log.ai_feedback,
                    snapshot_content: log.snapshots?.content || "No content"
                }));

            setHistory(studentLogs);
            setLoading(false);
        };

        fetchHistory();
    }, [studentId]);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm cursor-default"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6 border-b border-stone-200 flex justify-between items-center bg-stone-50">
                    <h2 className="text-2xl font-serif font-bold text-stone-900">{studentName}</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-stone-200 rounded-full transition-colors font-bold text-stone-500"
                    >
                        ✕
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-stone-50/50">
                    <h3 className="font-bold text-lg mb-4 text-stone-700">Recent Activity</h3>

                    {loading ? (
                        <div className="text-center py-8 text-stone-500">Loading history...</div>
                    ) : history.length === 0 ? (
                        <div className="text-center py-8 text-stone-500 italic">No detailed history available for this session.</div>
                    ) : (
                        <div className="space-y-6">
                            {history.map((item) => (
                                <div key={item.id} className="bg-white p-5 rounded-lg border border-stone-200 shadow-sm">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide
                                                ${item.behavior_category === 'flowing' ? 'bg-green-100 text-green-800' : ''}
                                                ${item.behavior_category === 'distressed' ? 'bg-red-100 text-red-800' : ''}
                                                ${item.behavior_category === 'stalled' ? 'bg-yellow-100 text-yellow-800' : ''}
                                                ${item.behavior_category === 'editing' ? 'bg-blue-100 text-blue-800' : ''}
                                            `}>
                                                {item.behavior_category}
                                            </span>
                                            <span className="text-sm text-stone-400">
                                                {new Date(item.created_at).toLocaleTimeString()}
                                            </span>
                                        </div>
                                    </div>

                                    <p className="text-stone-800 font-medium mb-3">
                                        "{item.ai_feedback}"
                                    </p>

                                    <div className="bg-stone-50 p-3 rounded border border-stone-100 text-sm font-mono text-stone-600 whitespace-pre-wrap max-h-32 overflow-y-auto">
                                        {item.snapshot_content}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
