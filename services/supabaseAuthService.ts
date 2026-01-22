import { supabase } from './supabaseClient';

export const supabaseAuthService = {
    signIn: async (email: string, password: string) => {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (error) throw error;
        return data;
    },

    signUp: async (email: string, password: string, options?: any) => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options // passing options like data: { name: ... }
        });
        if (error) throw error;
        return data;
    },

    signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    },

    getSession: async () => {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        return data.session;
    },

    sendRecoveryCode: async (email: string) => {
        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: { shouldCreateUser: false }
        });
        if (error) throw error;
    },

    verifyRecoveryCode: async (email: string, token: string) => {
        const { data, error } = await supabase.auth.verifyOtp({
            email,
            token,
            type: 'email'
        });
        if (error) throw error;
        return data;
    },

    updatePassword: async (password: string) => {
        const { error } = await supabase.auth.updateUser({
            password
        });
        if (error) throw error;
    },
};
