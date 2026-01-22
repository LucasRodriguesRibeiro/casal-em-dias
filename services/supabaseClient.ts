import { createClient } from '@supabase/supabase-js';

// Try to load from environment variables, fallback to hardcoded values
// TODO: Remove hardcoded values once env loading is fixed
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://yebaxexgjndscamcbbnm.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllYmF4ZXhnam5kc2NhbWNiYm5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNjY4MDAsImV4cCI6MjA4MDk0MjgwMH0.UkSoXiYW-3YcdSBpol-QWCGVUPZV8R57r35zbomGZno';

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables. Check .env.local file.');
}

// Log for debugging (remove in production)
console.log('🔧 Supabase initialized:', {
    url: supabaseUrl,
    usingEnv: !!import.meta.env.VITE_SUPABASE_URL
});

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
