
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function verify() {
    console.log("Starting verification...");

    // 1. Verify Env Vars
    const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const sbKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    if (!sbUrl || !sbKey || !geminiKey) {
        console.error("MISSING ENV VARS:", {
            sbUrl: !!sbUrl,
            sbKey: !!sbKey,
            geminiKey: !!geminiKey
        });
        return;
    }

    // 2. Verify Supabase
    try {
        const supabase = createClient(sbUrl, sbKey);
        const { data, error } = await supabase.from('classrooms').select('count').limit(1);

        if (error) {
            // If table doesn't exist, that's one thing, but connection error is another.
            // 404/PGRST is fine-ish (means connected but schema issue), ENOTFOUND is bad.
            console.error("Supabase Error:", error);
        } else {
            console.log("Supabase Connection: SUCCESS");
        }
    } catch (e) {
        console.error("Supabase Exception:", e);
    }

    // 3. List Models Manually
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`);
        const data = await response.json();
        if (data.models) {
            console.log("AVAILABLE GEMINI MODELS:");
            const gemini = data.models.filter((m: any) => m.name.includes("gemini"));
            gemini.forEach((m: any) => console.log(`- ${m.name} (Supported: ${m.supportedGenerationMethods})`));

            // Try the first one found that supports generateContent
            const candidate = gemini.find((m: any) => m.supportedGenerationMethods?.includes("generateContent"));
            if (candidate) {
                console.log(`\nAuto-testing candidate: ${candidate.name}...`);
                const modelName = candidate.name.replace("models/", "");
                try {
                    const genAI = new GoogleGenerativeAI(geminiKey);
                    const model = genAI.getGenerativeModel({ model: modelName });
                    const result = await model.generateContent("Say 'Auto-Model OK'");
                    console.log(`SUCCESS: ${modelName} works!`);
                } catch (err: any) {
                    console.error(`Auto-test failed: ${err.message}`);
                }
            }
        } else {
            console.error("ListModels Failed:", data);
        }
    } catch (e) {
        console.error("ListModels Exception:", e);
    }

    // 3. Verify Gemini Models
    const models = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro', 'gemini-1.0-pro'];

    for (const modelName of models) {
        try {
            console.log(`Testing model: ${modelName}...`);
            const genAI = new GoogleGenerativeAI(geminiKey);
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent("Say 'OK'");
            console.log(`SUCCESS: ${modelName} works!`);
            console.log("Response:", result.response.text());
            break; // Found one!
        } catch (e: any) {
            console.error(`FAILED: ${modelName} - ${e.message?.split('\n')[0]}`);
        }
    }
}

verify();
