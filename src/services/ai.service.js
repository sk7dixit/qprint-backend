import axios from 'axios';

/**
 * AI Service Helper
 * Handles text-based processing tasks from the Editor
 */
export const processAIHelper = async (task, text) => {
    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

    if (!ANTHROPIC_API_KEY) {
        throw new Error("ANTHROPIC_API_KEY not configured");
    }

    let prompt = "";
    if (task === 'spell_fix') {
        prompt = `You are a professional editor. Fix all spelling and grammar mistakes in the following text. 
        Only return the fixed text, nothing else. No explanations.
        
        TEXT:
        ${text}`;
    } else if (task === 'smart_replace') {
        prompt = `You are a data formatting specialist. Standardize dates, currencies, and names in the following text to a professional academic format (e.g., YYYY-MM-DD for dates).
        Only return the transformed text, nothing else.
        
        TEXT:
        ${text}`;
    } else {
        throw new Error(`Unsupported AI task: ${task}`);
    }

    try {
        const response = await axios.post("https://api.anthropic.com/v1/messages", {
            model: "claude-3-haiku-20240307",
            max_tokens: 1024,
            messages: [{ role: "user", content: prompt }],
            system: "You are a helpful assistant that only returns corrected or transformed text without any conversational filler."
        }, {
            headers: {
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json"
            }
        });

        return response.data.content[0].text;
    } catch (error) {
        console.error("AI Service Error:", error.response?.data || error.message);
        throw new Error("AI Processing failed");
    }
};
