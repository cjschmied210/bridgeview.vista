
const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error("No API KEY");
    process.exit(1);
}

async function check() {
    console.log("Listing models via REST...");
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.models) {
            console.log("Found models:");
            data.models.forEach(m => {
                if (m.supportedGenerationMethods.includes('generateContent')) {
                    console.log(`- ${m.name}`);
                }
            });
        } else {
            console.log("No models in response:", data);
        }
    } catch (e) {
        console.error("Fetch failed:", e);
    }
}

check();
