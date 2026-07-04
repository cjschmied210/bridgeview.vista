import React, { useEffect, useState, useRef } from 'react';
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
    const [currentFrameIndex, setCurrentFrameIndex] = useState<number>(0);
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const playbackTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const fetchHistory = async () => {
            // Join analysis_logs -> snapshots -> documents to check student_id
            // Order chronologically (ascending: true) so frame 0 is the start
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
                .order('created_at', { ascending: true });

            if (error) {
                console.error("Error fetching history:", error);
                setLoading(false);
                return;
            }

            // Filter client-side by checking the deeply joined student_id
            // @ts-ignore
            const studentLogs: ActivityLog[] = (data || [])
                .filter((log: any) => log.snapshots?.documents?.student_id === studentId)
                .map((log: any) => ({
                    id: log.id,
                    created_at: log.created_at,
                    behavior_category: log.behavior_category,
                    ai_feedback: log.ai_feedback,
                    snapshot_content: log.snapshots?.content || ""
                }));

            setHistory(studentLogs);
            // Default to showing the latest snapshot when modal opens
            if (studentLogs.length > 0) {
                setCurrentFrameIndex(studentLogs.length - 1);
            }
            setLoading(false);
        };

        fetchHistory();
    }, [studentId]);

    // Handle playback loop
    useEffect(() => {
        if (isPlaying) {
            playbackTimerRef.current = setInterval(() => {
                setCurrentFrameIndex((prevIndex) => {
                    if (prevIndex >= history.length - 1) {
                        setIsPlaying(false);
                        return prevIndex;
                    }
                    return prevIndex + 1;
                });
            }, 1500); // Progress frame every 1.5s
        } else {
            if (playbackTimerRef.current) {
                clearInterval(playbackTimerRef.current);
            }
        }

        return () => {
            if (playbackTimerRef.current) {
                clearInterval(playbackTimerRef.current);
            }
        };
    }, [isPlaying, history.length]);

    const handlePlayPause = () => {
        if (isPlaying) {
            setIsPlaying(false);
        } else {
            // If we're at the end, restart from the beginning
            if (currentFrameIndex >= history.length - 1) {
                setCurrentFrameIndex(0);
            }
            setIsPlaying(true);
        }
    };

    const handlePrev = () => {
        setIsPlaying(false);
        setCurrentFrameIndex((prev) => Math.max(0, prev - 1));
    };

    const handleNext = () => {
        setIsPlaying(false);
        setCurrentFrameIndex((prev) => Math.min(history.length - 1, prev + 1));
    };

    const activeFrame = history[currentFrameIndex] || null;

    // Helper to get behavior colors for heatmap & status badge
    const getBehaviorClass = (category: string) => {
        switch (category.toLowerCase()) {
            case 'flowing':
                return {
                    badge: 'bg-green-100 text-green-800 border-green-200',
                    heatmap: 'bg-green-500 hover:bg-green-600 focus:ring-green-400'
                };
            case 'distressed':
                return {
                    badge: 'bg-red-100 text-red-800 border-red-200',
                    heatmap: 'bg-red-500 hover:bg-red-600 focus:ring-red-400'
                };
            case 'stalled':
                return {
                    badge: 'bg-amber-100 text-amber-800 border-amber-200',
                    heatmap: 'bg-amber-500 hover:bg-amber-600 focus:ring-amber-400'
                };
            case 'editing':
                return {
                    badge: 'bg-blue-100 text-blue-800 border-blue-200',
                    heatmap: 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-400'
                };
            default:
                return {
                    badge: 'bg-stone-100 text-stone-800 border-stone-200',
                    heatmap: 'bg-stone-400 hover:bg-stone-500 focus:ring-stone-400'
                };
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm cursor-default"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-xl shadow-2xl w-full max-w-3xl h-[85vh] overflow-hidden flex flex-col border border-stone-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-stone-200 flex justify-between items-center bg-stone-50">
                    <div>
                        <h2 className="text-2xl font-serif font-bold text-stone-900">{studentName}</h2>
                        <p className="text-xs text-stone-500 mt-0.5">Session Timeline Reader</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-stone-200 rounded-full transition-colors font-bold text-stone-500"
                    >
                        ✕
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6 bg-stone-50/50 flex flex-col gap-6">
                    {loading ? (
                        <div className="flex-1 flex items-center justify-center text-stone-500 font-medium">
                            Loading session timeline...
                        </div>
                    ) : history.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-stone-400 py-12">
                            <span className="text-4xl mb-2">📝</span>
                            <span className="italic">No writing history recorded for this session yet.</span>
                        </div>
                    ) : (
                        <>
                            {/* Text Viewer Panel */}
                            <div className="flex-1 flex flex-col bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden min-h-[300px]">
                                {/* Viewer Status Header */}
                                <div className="px-4 py-3 bg-stone-50 border-b border-stone-200 flex justify-between items-center text-sm">
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded border text-xs font-bold uppercase tracking-wide
                                            ${getBehaviorClass(activeFrame?.behavior_category || '').badge}`}>
                                            {activeFrame?.behavior_category}
                                        </span>
                                        <span className="text-stone-500 font-mono text-xs">
                                            {activeFrame ? new Date(activeFrame.created_at).toLocaleTimeString() : ''}
                                        </span>
                                    </div>
                                    <span className="text-stone-400 text-xs font-semibold">
                                        Update {currentFrameIndex + 1} of {history.length}
                                    </span>
                                </div>

                                {/* Active Summary Text */}
                                <div className="px-4 py-3 bg-stone-50/50 border-b border-stone-150 text-stone-700 text-sm font-medium italic">
                                    "{activeFrame?.ai_feedback}"
                                </div>

                                {/* Main Text Content */}
                                <div className="flex-1 p-4 font-mono text-sm text-stone-800 whitespace-pre-wrap overflow-y-auto max-h-[35vh]">
                                    {activeFrame?.snapshot_content || <span className="text-stone-400 italic">Document is empty</span>}
                                </div>
                            </div>

                            {/* Heatmap & Timeline Navigator */}
                            <div className="bg-white p-4 rounded-lg border border-stone-200 shadow-sm flex flex-col gap-4">
                                <div>
                                    <h4 className="text-sm font-semibold text-stone-700 mb-2">Activity Timeline Heatmap</h4>
                                    
                                    {/* Heatmap Grid Row */}
                                    <div className="flex items-center gap-1.5 overflow-x-auto py-2 scrollbar-thin">
                                        {history.map((item, index) => {
                                            const active = index === currentFrameIndex;
                                            return (
                                                <button
                                                    key={item.id}
                                                    onClick={() => {
                                                        setIsPlaying(false);
                                                        setCurrentFrameIndex(index);
                                                    }}
                                                    title={`[${new Date(item.created_at).toLocaleTimeString()}] ${item.behavior_category}: ${item.ai_feedback}`}
                                                    className={`w-6 h-6 rounded-md transition-all flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-offset-2
                                                        ${getBehaviorClass(item.behavior_category).heatmap}
                                                        ${active ? 'ring-2 ring-stone-900 ring-offset-1 scale-110 z-10' : 'opacity-85 hover:opacity-100 hover:scale-105'}
                                                    `}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Playback Navigation Controls */}
                                <div className="flex flex-col sm:flex-row items-center gap-4 justify-between pt-2 border-t border-stone-100">
                                    {/* Control Buttons */}
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={handlePrev}
                                            disabled={currentFrameIndex === 0}
                                            title="Previous Frame"
                                            className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 disabled:opacity-50 text-stone-700 font-semibold rounded text-sm transition-colors"
                                        >
                                            ◀ Back
                                        </button>
                                        <button
                                            onClick={handlePlayPause}
                                            className="px-5 py-1.5 bg-stone-900 hover:bg-stone-800 text-white font-semibold rounded text-sm transition-colors shadow-sm flex items-center gap-1.5"
                                        >
                                            {isPlaying ? '⏸ Pause' : '▶ Play'}
                                        </button>
                                        <button
                                            onClick={handleNext}
                                            disabled={currentFrameIndex === history.length - 1}
                                            title="Next Frame"
                                            className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 disabled:opacity-50 text-stone-700 font-semibold rounded text-sm transition-colors"
                                        >
                                            Next ▶
                                        </button>
                                    </div>

                                    {/* Slider input */}
                                    <div className="flex-1 w-full flex items-center gap-3">
                                        <input
                                            type="range"
                                            min={0}
                                            max={history.length - 1}
                                            value={currentFrameIndex}
                                            onChange={(e) => {
                                                setIsPlaying(false);
                                                setCurrentFrameIndex(parseInt(e.target.value, 10));
                                            }}
                                            className="w-full accent-stone-900 h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer"
                                        />
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
