/**
 * aiService.js
 * Backend-only service for communicating with Cloudflare Workers AI.
 */

export async function callAI(task, text) {
    if (!text || text.length > 20480) { // Safety: 20KB limit
        throw new Error("Input text is too long or empty.");
    }

    try {
        const response = await fetch(
            "https://qprint-ai.shashwatdixit22.workers.dev",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    task,   // "smart_replace" | "spell_fix"
                    text    // extracted text ONLY
                })
            }
        );

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`AI service failed: ${errorData.message || response.statusText}`);
        }

        const data = await response.json();
        return data.result;
    } catch (err) {
        console.error("AI Service Error:", err);
        throw err;
    }
}
