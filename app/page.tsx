"use client";

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import StudentCard from '@/components/StudentCard';
import StudentDetailModal from '@/components/StudentDetailModal';
import ManageClassesModal from '@/components/ManageClassesModal';
import { Settings, LogOut } from 'lucide-react';

interface Student {
    id: string;
    name: string;
    status: 'flowing' | 'editing' | 'stalled' | 'distressed';
    last_active: string;
    summary?: string;
    classroom_id?: string;
    active_document_title?: string;
}

interface Classroom {
    id: string;
    name: string;
}

export default function Home() {
    const [students, setStudents] = useState<Student[]>([]);
    const [classrooms, setClassrooms] = useState<Classroom[]>([]);
    const [selectedClassroom, setSelectedClassroom] = useState<string>(''); // Default to empty string (Unassigned)
    const [loading, setLoading] = useState(true);
    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
    const [feed, setFeed] = useState<{ id: string; message: string; time: string }[]>([]);
    const [showManageClasses, setShowManageClasses] = useState(false);
    const router = useRouter();

    const loadClassrooms = useCallback(async () => {
        const { data: classData, error: classError } = await supabase
            .from('classrooms')
            .select('*')
            .order('name');

        if (classError) console.error('Error fetching classrooms:', classError);

        if (classData) {
            setClassrooms(classData);
            // Default selection to empty string (Unassigned) if deleted
            if (selectedClassroom && !classData.find(c => c.id === selectedClassroom)) {
                setSelectedClassroom('');
            }
        }
    }, [selectedClassroom]);

    useEffect(() => {
        const checkAuthAndLoad = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.push('/login');
                return;
            }

            try {
                // 1. Fetch Classrooms
                await loadClassrooms();

                // 2. Fetch Students with their documents
                const { data: studentData, error: studentError } = await supabase
                    .from('students')
                    .select(`
                        *,
                        documents (
                            id,
                            title,
                            last_updated
                        )
                    `)
                    .order('name');

                if (studentError) {
                    console.error('Error fetching students:', studentError);
                } else if (studentData) {
                    const formattedStudents = studentData.map((student: any) => {
                        const docs = student.documents || [];
                        let activeDocTitle = undefined;
                        if (docs.length > 0) {
                            const sortedDocs = [...docs].sort((a, b) => new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime());
                            activeDocTitle = sortedDocs[0].title;
                        }
                        return {
                            id: student.id,
                            name: student.name,
                            status: student.status,
                            last_active: student.last_active,
                            classroom_id: student.classroom_id,
                            summary: student.summary,
                            active_document_title: activeDocTitle
                        };
                    });
                    setStudents(formattedStudents as Student[]);
                }
            } catch (err) {
                console.error('Unexpected error:', err);
            } finally {
                setLoading(false);
            }
        };

        checkAuthAndLoad();

        // Realtime Subscription
        const channel = supabase
            .channel('dashboard-realtime')
            .on(
                'postgres_changes',
                {
                    event: '*', // Listen to INSERTs, UPDATEs, and DELETEs
                    schema: 'public',
                    table: 'students',
                },
                (payload: any) => {
                    if (payload.eventType === 'DELETE') {
                        setStudents((prev) => prev.filter((s) => s.id !== payload.old.id));
                        return;
                    }

                    const newStudent = payload.new as Student;
                    setStudents((prev) => {
                        const exists = prev.some((s) => s.id === newStudent.id);
                        if (exists) {
                            return prev.map((s) => 
                                s.id === newStudent.id 
                                    ? { ...s, ...newStudent, summary: s.summary } // Preserve summary until analysis_logs update
                                    : s
                            );
                        } else {
                            return [...prev, newStudent];
                        }
                    });

                    // Add to Live Feed
                    const time = new Date().toLocaleTimeString();
                    const statusMsg = payload.eventType === 'INSERT' 
                        ? `${newStudent.name} joined the monitor`
                        : `${newStudent.name} is now ${newStudent.status}`;

                    setFeed((prev) => [
                        {
                            id: Date.now().toString(),
                            message: statusMsg,
                            time,
                        },
                        ...prev.slice(0, 9)
                    ]);
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'analysis_logs',
                },
                async (payload: any) => {
                    const newLog = payload.new;
                    const { data: snapshot } = await supabase
                        .from('snapshots')
                        .select('document_id')
                        .eq('id', newLog.snapshot_id)
                        .single();

                    if (!snapshot) return;

                    const { data: doc } = await supabase
                        .from('documents')
                        .select('student_id, title')
                        .eq('id', snapshot.document_id)
                        .single();

                    if (!doc) return;

                    const studentId = doc.student_id;
                    setStudents((prev) =>
                        prev.map((s) => (s.id === studentId ? { 
                            ...s, 
                            summary: newLog.ai_feedback,
                            active_document_title: doc.title || "Untitled Document"
                        } : s))
                    );
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const handleAssignClass = async (studentId: string, classroomId: string | null) => {
        // Optimistically update UI
        setStudents((prev) =>
            prev.map((s) => (s.id === studentId ? { ...s, classroom_id: classroomId || undefined } : s))
        );

        // Update database
        const { error } = await supabase
            .from('students')
            .update({ classroom_id: classroomId })
            .eq('id', studentId);

        if (error) {
            console.error("Failed to assign student to class:", error);
            // Fetch students again to revert state on error
            const { data } = await supabase.from('students').select('*').order('name');
            if (data) setStudents(data as Student[]);
        }
    };

    // Filter students by selected classroom
    const visibleStudents = students.filter(s =>
        selectedClassroom ? s.classroom_id === selectedClassroom : !s.classroom_id
    );

    // Find name for header
    const currentClassName = selectedClassroom 
        ? (classrooms.find(c => c.id === selectedClassroom)?.name || "Classroom") 
        : "Unassigned Students";

    return (
        <main className="min-h-screen p-8 max-w-7xl mx-auto">
            <header className="mb-8 border-b border-stone-200 pb-6 flex justify-between items-end">
                <div>
                    <h1 className="text-4xl font-serif font-bold text-stone-900 mb-2">Bridgeview Vista</h1>
                    <p className="text-stone-600 font-sans">Classroom Monitor • {currentClassName}</p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowManageClasses(true)}
                        className="p-2 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded border border-stone-200 transition-colors"
                        title="Manage Classes"
                    >
                        <Settings size={20} />
                    </button>
                    <button
                        onClick={async () => {
                            await supabase.auth.signOut();
                            router.push('/login');
                        }}
                        className="p-2 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded border border-stone-200 transition-colors"
                        title="Log Out"
                    >
                        <LogOut size={20} />
                    </button>
                </div>
            </header>

            {/* Visual Classroom Tabs */}
            <div className="mb-8 bg-stone-100/50 p-4 rounded-xl border border-stone-200">
                <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-3">
                    Class Filter:
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => setSelectedClassroom('')}
                        className={`px-4 py-2.5 rounded-lg border text-sm font-semibold transition-all ${
                            selectedClassroom === '' 
                            ? 'bg-stone-900 text-white border-stone-900 shadow-md scale-102' 
                            : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50 hover:border-stone-300'
                        }`}
                    >
                        📁 Unassigned Students ({students.filter(s => !s.classroom_id).length})
                    </button>
                    {classrooms.map(c => (
                        <button
                            key={c.id}
                            onClick={() => setSelectedClassroom(c.id)}
                            className={`px-4 py-2.5 rounded-lg border text-sm font-semibold transition-all ${
                                selectedClassroom === c.id 
                                ? 'bg-stone-900 text-white border-stone-900 shadow-md scale-102' 
                                : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50 hover:border-stone-300'
                            }`}
                        >
                            🏫 {c.name} ({students.filter(s => s.classroom_id === c.id).length})
                        </button>
                    ))}
                </div>
            </div>

            {showManageClasses && (
                <ManageClassesModal
                    classrooms={classrooms}
                    onClose={() => setShowManageClasses(false)}
                    onUpdate={loadClassrooms}
                />
            )}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-3">
                    <div className="bg-white rounded-xl shadow-sm border border-stone-100 p-6 min-h-[500px]">
                        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            {currentClassName}
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {loading ? (
                                <p className="text-stone-500">Loading classroom data...</p>
                            ) : visibleStudents.length === 0 ? (
                                <p className="text-stone-500 italic">No students found in this view.</p>
                            ) : (
                                visibleStudents.map((student) => (
                                    <StudentCard
                                        key={student.id}
                                        id={student.id}
                                        name={student.name}
                                        status={student.status}
                                        lastEvent={new Date(student.last_active).toLocaleTimeString()}
                                        summary={student.summary}
                                        activeDocumentTitle={student.active_document_title}
                                        classrooms={classrooms}
                                        onAssignClass={handleAssignClass}
                                        onClick={() => setSelectedStudent(student)}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-1">
                    <div className="bg-stone-100 rounded-xl p-6 h-full border border-stone-200">
                        <h3 className="font-serif font-bold text-lg mb-4 text-stone-800">Live Feed</h3>
                        <div className="space-y-4">
                            {feed.length === 0 ? (
                                <div className="text-sm text-stone-600 italic">No events yet.</div>
                            ) : (
                                feed.map((item) => (
                                    <div key={item.id} className="text-sm border-b border-stone-200 pb-2 last:border-0">
                                        <div className="font-semibold text-stone-800">{item.message}</div>
                                        <div className="text-xs text-stone-500">{item.time}</div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {selectedStudent && (
                <StudentDetailModal
                    studentId={selectedStudent.id}
                    studentName={selectedStudent.name}
                    onClose={() => setSelectedStudent(null)}
                />
            )}
        </main>
    );
}
