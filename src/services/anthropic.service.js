import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";

const client = new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY,
});

export const createMessage = async (content) => {
    const msg = await client.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 300,
        messages: [
            { role: "user", content }
        ],
    });
    return msg.content[0].text;
};

export default client;
