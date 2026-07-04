import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Trash2, Edit2, Plus, X, Check, Copy } from 'lucide-react';

interface Classroom {
    id: string;
    name: string;
    code?: string;
}

interface ManageClassesModalProps {
    classrooms: Classroom[];
    onClose: () => void;
    onUpdate: () => void; // Trigger refresh in parent
}

function generateClassCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluded confusing characters like I, O, 0, 1
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

export default function ManageClassesModal({ classrooms, onClose, onUpdate }: ManageClassesModalProps) {
    const [newClassName, setNewClassName] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const handleAdd = async () => {
        if (!newClassName.trim()) return;
        setLoading(true);
        setErrorMsg(null);

        const generatedCode = generateClassCode();
        const { error } = await supabase.from('classrooms').insert({ 
            name: newClassName,
            code: generatedCode
        });

        if (error) {
            setErrorMsg(error.message);
        } else {
            setNewClassName('');
            onUpdate();
        }
        setLoading(false);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure? This action will fail if students are assigned to this class.")) return;
        setLoading(true);
        setErrorMsg(null);

        const { error } = await supabase.from('classrooms').delete().eq('id', id);

        if (error) {
            if (error.code === '23503') { // Foreign key violation
                setErrorMsg("Cannot delete class: It still has students assigned. Please move or remove students first.");
            } else {
                setErrorMsg(error.message);
            }
        } else {
            onUpdate();
        }
        setLoading(false);
    };

    const startEdit = (c: Classroom) => {
        setEditingId(c.id);
        setEditName(c.name);
    };

    const saveEdit = async () => {
        if (!editName.trim() || !editingId) return;
        setLoading(true);
        setErrorMsg(null);

        const { error } = await supabase.from('classrooms').update({ name: editName }).eq('id', editingId);

        if (error) {
            setErrorMsg(error.message);
        } else {
            setEditingId(null);
            setEditName('');
            onUpdate(); // Refresh parent list
        }
        setLoading(false);
    };

    const handleCopyCode = (id: string, code: string) => {
        navigator.clipboard.writeText(code);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm cursor-default"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6 border-b border-stone-200 flex justify-between items-center bg-stone-50">
                    <h2 className="text-xl font-serif font-bold text-stone-900">Manage Classes</h2>
                    <button onClick={onClose} className="p-1 hover:bg-stone-200 rounded-full transition-colors text-stone-500">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 bg-white space-y-6">
                    {/* Add New */}
                    <div className="flex gap-2">
                        <input
                            type="text"
                            placeholder="New Class Name (e.g. Period 2)"
                            className="flex-1 p-2 border border-stone-300 rounded font-sans focus:ring-2 focus:ring-stone-400 outline-none"
                            value={newClassName}
                            onChange={(e) => setNewClassName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                        />
                        <button
                            onClick={handleAdd}
                            disabled={loading || !newClassName.trim()}
                            className="bg-stone-800 text-white p-2 rounded hover:bg-stone-700 disabled:opacity-50 transition-colors"
                        >
                            <Plus size={20} />
                        </button>
                    </div>

                    {errorMsg && (
                        <div className="text-sm text-red-600 bg-red-50 p-2 rounded border border-red-100">
                            {errorMsg}
                        </div>
                    )}

                    {/* List */}
                    <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                        {classrooms.map(c => (
                            <div key={c.id} className="flex items-center justify-between p-3 bg-stone-50 rounded border border-stone-100 group">
                                {editingId === c.id ? (
                                    <div className="flex items-center gap-2 flex-1">
                                        <input
                                            type="text"
                                            className="flex-1 p-1 border border-stone-300 rounded text-sm min-w-0"
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            autoFocus
                                        />
                                        <button onClick={saveEdit} disabled={loading} className="text-green-600 hover:bg-green-100 p-1 rounded"><Check size={16} /></button>
                                        <button onClick={() => setEditingId(null)} disabled={loading} className="text-stone-500 hover:bg-stone-200 p-1 rounded"><X size={16} /></button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex flex-col flex-1 min-w-0 mr-2">
                                            <span className="font-medium text-stone-700 truncate">{c.name}</span>
                                            {c.code && (
                                                <span className="text-xs text-stone-500 font-mono flex items-center gap-1.5 mt-0.5">
                                                    Code: <span className="font-bold text-stone-700 select-all">{c.code}</span>
                                                    <button 
                                                        onClick={() => handleCopyCode(c.id, c.code!)}
                                                        className="text-stone-400 hover:text-stone-600 transition-colors"
                                                        title="Copy Code"
                                                    >
                                                        {copiedId === c.id ? (
                                                            <span className="text-[10px] text-green-600 font-sans font-semibold">Copied!</span>
                                                        ) : (
                                                            <Copy size={12} />
                                                        )}
                                                    </button>
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => startEdit(c)} className="p-1.5 text-stone-500 hover:text-blue-600 hover:bg-blue-50 rounded" title="Edit">
                                                <Edit2 size={16} />
                                            </button>
                                            <button onClick={() => handleDelete(c.id)} className="p-1.5 text-stone-500 hover:text-red-600 hover:bg-red-50 rounded" title="Delete">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                        {classrooms.length === 0 && (
                            <div className="text-center text-stone-400 italic py-4">No classes found. Add one above!</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
