import dotenv from "dotenv";
dotenv.config();

export const env = {
    PORT: process.env.PORT || 5000,
    DATABASE_URL: process.env.DATABASE_URL,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
};
