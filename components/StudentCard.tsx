import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface StudentCardProps {
    id: string;
    name: string;
    status: 'flowing' | 'editing' | 'stalled' | 'distressed';
    lastEvent?: string;
    summary?: string;
    activeDocumentTitle?: string;
    onClick?: () => void;
    classrooms?: { id: string; name: string }[];
    onAssignClass?: (studentId: string, classroomId: string | null) => void;
    onDeleteStudent?: (studentId: string) => void;
}

const statusColors = {
    flowing: 'bg-green-50 border-green-200 text-green-900',
    editing: 'bg-blue-50 border-blue-200 text-blue-900',
    stalled: 'bg-yellow-50 border-yellow-200 text-yellow-900',
    distressed: 'bg-red-50 border-red-200 text-red-900',
};

export default function StudentCard({ id, name, status, lastEvent, summary, activeDocumentTitle, onClick, classrooms = [], onAssignClass, onDeleteStudent }: StudentCardProps) {
    const [menuOpen, setMenuOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setMenuOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleMenu = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent opening the student detail modal
        setMenuOpen(!menuOpen);
    };

    const handleSelectClass = (e: React.MouseEvent, classroomId: string | null) => {
        e.stopPropagation(); // Prevent opening the student detail modal
        setMenuOpen(false);
        if (onAssignClass) {
            onAssignClass(id, classroomId);
        }
    };

    return (
        <div
            onClick={onClick}
            className={`p-4 rounded-lg border shadow-sm transition-all cursor-pointer hover:shadow-md hover:scale-[1.01] flex flex-col justify-between min-h-[160px] relative ${statusColors[status]}`}
        >
            <div>
                <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-lg leading-tight truncate mr-2">{name}</h3>
                    <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-white/60 shadow-sm shrink-0">
                        {status}
                    </span>
                </div>
                <p className="text-[10px] opacity-75 mb-2">
                    Last active: {lastEvent || "No recent activity"}
                </p>
                {activeDocumentTitle && (
                    <p className="text-[10px] font-semibold opacity-90 truncate max-w-full" title={activeDocumentTitle}>
                        📄 {activeDocumentTitle}
                    </p>
                )}
                {summary && (
                    <div className="mt-2 text-xs italic bg-white/40 p-2 rounded border border-black/5 line-clamp-3">
                        "{summary}"
                    </div>
                )}
            </div>

            {/* Class Assignment Dropdown */}
            <div className="mt-4 pt-3 border-t border-black/5 flex justify-end" ref={dropdownRef}>
                <button
                    onClick={toggleMenu}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded bg-white/60 hover:bg-white/80 active:scale-95 shadow-sm border border-black/5 transition-all text-stone-700"
                >
                    Assign Class <ChevronDown size={12} />
                </button>

                {menuOpen && (
                    <div className="absolute right-4 bottom-12 z-10 w-48 py-1 bg-white/95 backdrop-blur-sm border border-stone-200 shadow-xl rounded-lg overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150">
                        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-400 border-b border-stone-100">
                            Move student to:
                        </div>
                        <button
                            onClick={(e) => handleSelectClass(e, null)}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-stone-50 transition-colors font-medium text-red-600"
                        >
                            📁 Unassigned
                        </button>
                        {classrooms.map((c) => (
                            <button
                                key={c.id}
                                onClick={(e) => handleSelectClass(e, c.id)}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-stone-50 transition-colors font-medium text-stone-700 truncate"
                            >
                                🏫 {c.name}
                            </button>
                        ))}
                        {onDeleteStudent && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setMenuOpen(false);
                                    if (window.confirm(`Are you sure you want to delete ${name} and all their history? This cannot be undone.`)) {
                                        onDeleteStudent(id);
                                    }
                                }}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-red-50 hover:text-red-750 text-red-600 transition-colors font-semibold border-t border-stone-150 flex items-center gap-1"
                            >
                                🗑️ Delete Student
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
