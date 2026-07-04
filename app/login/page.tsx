"use client";

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mode, setMode] = useState<'signin' | 'signup'>('signin');
    const router = useRouter();

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (mode === 'signup') {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                });
                if (error) throw error;
                alert('Sign up successful! You can now sign in.'); // Supabase default is verify email, often disabled for dev
                setMode('signin');
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                router.push('/'); // Redirect to dashboard
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-xl shadow-md max-w-sm w-full border border-stone-200">
                <h1 className="text-3xl font-serif font-bold text-stone-900 mb-2 text-center">Bridgeview Vista</h1>
                <p className="text-stone-500 text-center mb-8">Teacher Login</p>

                <form onSubmit={handleAuth} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-stone-700 mb-1">Email</label>
                        <input
                            type="email"
                            required
                            className="w-full p-2 border border-stone-300 rounded focus:ring-2 focus:ring-stone-400 outline-none"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-stone-700 mb-1">Password</label>
                        <input
                            type="password"
                            required
                            className="w-full p-2 border border-stone-300 rounded focus:ring-2 focus:ring-stone-400 outline-none"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    {error && (
                        <div className="text-red-600 text-sm bg-red-50 p-2 rounded">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-stone-900 text-white py-2 rounded font-medium hover:bg-stone-800 transition-colors disabled:opacity-50"
                    >
                        {loading ? 'Processing...' : mode === 'signin' ? 'Sign In' : 'Sign Up'}
                    </button>
                </form>

                <div className="mt-6 text-center text-sm text-stone-600">
                    {mode === 'signin' ? "Don't have an account? " : "Already have an account? "}
                    <button
                        onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
                        className="font-bold underline hover:text-stone-900"
                    >
                        {mode === 'signin' ? 'Sign Up' : 'Sign In'}
                    </button>
                </div>

                {/* Future Google Auth Button Placeholder */}
                {/* 
                <div className="mt-4 pt-4 border-t border-stone-100">
                    <button className="w-full flex items-center justify-center gap-2 border border-stone-300 p-2 rounded hover:bg-stone-50">
                        <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
                        Sign in with Google
                    </button>
                </div> 
                */}
            </div>
        </div>
    );
}
