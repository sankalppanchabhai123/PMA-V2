import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'path';

// Load .env from the project root (assuming server is in a subfolder)
dotenv.config({
    path: path.resolve(__dirname, '../../.env')
});

// OR if server is at the root level:
// dotenv.config({ 
//     path: path.resolve(process.cwd(), '.env') 
// });

const envSchema = z.object({
    PORT: z.string().optional(),
    CLIENT_URL: z.string().url(),
    SERVER_URL: z.string().url().optional(),
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().min(1),
    JWT_REFRESH_SECRET: z.string().min(1).optional(),
    SESSION_SECRET: z.string().min(1),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GOOGLE_CALLBACK_URL: z.string().url().optional(),
    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),
    GITHUB_CALLBACK_URL: z.string().url().optional(),
});

// Debug: Check if env vars are loaded
console.log('Current directory:', process.cwd());
console.log('CLIENT_URL from env:', process.env.CLIENT_URL);

export const env = envSchema.parse(process.env);