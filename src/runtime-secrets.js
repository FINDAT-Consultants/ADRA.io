import 'dotenv/config';
import { bootstrapOpenAIFromSupabaseVault } from './supabase.js';

// Load the OpenAI key before agent runners execute. The key is never sent to browser code.
export const runtimeOpenAISecretStatus=await bootstrapOpenAIFromSupabaseVault();
