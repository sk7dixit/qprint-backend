import OpenAI from 'openai';
import 'dotenv/config';

let openai = null;
if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });
} else {
    console.warn("OPENAI_API_KEY is not set. AI features will fail.");
}

/**
 * Maps a single contiguous string back onto an array of structured text boxes.
 * It does this by splitting the AI's returned text approximately based on
 * the original token/word counts of each box, preserving x, y, and styles.
 */
function mapBackToStructured(originalPages, correctedText) {
    // 1. Flatten all text nodes into a 1D array by reference
    const flatNodes = [];
    originalPages.forEach(p => {
        p.texts.forEach(t => {
            flatNodes.push(t);
        });
    });

    // 2. We need to distribute the `correctedText` roughly back into the `flatNodes`.
    // A simple robust approach: split both into words.
    const originalWords = flatNodes.map(n => n.content.split(/\s+/).length);
    const correctedWordsArray = correctedText.split(/\s+/);

    let currentWordIndex = 0;

    // Create deep copy of pages to avoid mutating original state if error
    const newPages = JSON.parse(JSON.stringify(originalPages));

    newPages.forEach(page => {
        page.texts.forEach(node => {
            // How many words did this node originally have?
            const originalLength = node.content.split(/\s+/).filter(w => w.length > 0).length;

            // If it was empty whitespace, keep it empty
            if (originalLength === 0) return;

            // Grab the next `originalLength` words from the corrected array
            const chunks = correctedWordsArray.slice(currentWordIndex, currentWordIndex + originalLength);
            currentWordIndex += originalLength;

            node.content = chunks.join(" ");
            node.modified = true;
        });
    });

    // If there's leftover text, we just append it to the very last node.
    if (currentWordIndex < correctedWordsArray.length && newPages.length > 0 && newPages[newPages.length - 1].texts.length > 0) {
        const lastPage = newPages[newPages.length - 1];
        const lastNode = lastPage.texts[lastPage.texts.length - 1];
        const leftovers = correctedWordsArray.slice(currentWordIndex).join(" ");
        lastNode.content = lastNode.content + " " + leftovers;
    }

    return newPages;
}

const extractFullText = (pages) => {
    return pages
        .map(p => p.texts.filter(t => !t.isHidden).map(t => t.content).join(" "))
        .join("\n\n");
};

export const processSpellFix = async (pages) => {
    if (!openai) throw new Error("OpenAI not configured");

    const text = extractFullText(pages);
    if (!text.trim()) return pages;

    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            {
                role: "system",
                content: "You are a precise proofreader. Fix spelling and grammar ONLY. Do not change structure, do not add filler, do not add conversational text. Return the corrected text preserving the approximate original word lengths and line breaks."
            },
            { role: "user", content: text }
        ],
        max_tokens: 4000
    });

    const correctedText = response.choices[0].message.content;
    return mapBackToStructured(pages, correctedText);
};

export const processFormatClean = async (pages) => {
    if (!openai) throw new Error("OpenAI not configured");

    const text = extractFullText(pages);
    if (!text.trim()) return pages;

    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            {
                role: "system",
                content: "You are a text normalization tool. Your job is to normalize spacing, fix double spaces, fix broken mid-sentence line breaks, and remove unnecessary invisible OCR symbols. Do NOT restructure the layout, rewrite sentences, or add conversational text. Keep the exact same words, just properly spaced."
            },
            { role: "user", content: text }
        ],
        max_tokens: 4000
    });

    const cleanedText = response.choices[0].message.content;
    return mapBackToStructured(pages, cleanedText);
};
