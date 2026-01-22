import React, { useState } from 'react';
import { Button, Input, Card, PigIcon } from './UIComponents';
import { supabaseAuthService } from '../services/supabaseAuthService';
import { User } from '../types';

interface AuthProps {
  onLogin: (user: User) => void;
}

export const AuthScreen: React.FC<AuthProps> = ({ onLogin }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegistering) {
        if (!formData.name || !formData.email || !formData.password) throw new Error('Por favor, preencha todos os campos.');
        if (formData.password.length < 6) throw new Error('A senha deve ter pelo menos 6 caracteres.');

        await supabaseAuthService.signUp(formData.email, formData.password, {
          data: {
            name: formData.name
          }
        });
        // We might want to update the display name here, but let's stick to basic auth first or add update profile logic
      } else {
        if (!formData.email || !formData.password) throw new Error('Informe seu email e senha.');
        await supabaseAuthService.signIn(formData.email, formData.password);
      }
      // onLogin is likely not needed anymore if we rely on onAuthStateChange in App.tsx, 
      // but keeping it if it triggers UI state changes or just to satisfy props.
      // However, App.tsx will redirect based on user state automatically.
    } catch (err: any) {
      // console.error(err);
      let msg = err.message || 'Ocorreu um erro ao tentar entrar.';
      // Friendly error mapping for Supabase
      if (msg.includes('Invalid login credentials')) {
        msg = 'Email ou senha incorretos.';
      } else if (msg.includes('User already registered')) {
        msg = 'Este email já está cadastrado.';
      } else if (msg.includes('valid email')) {
        msg = 'Digite um email válido.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <div className="flex flex-col items-center gap-3 mb-8 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-600 p-3 rounded-xl shadow-lg shadow-emerald-200">
            <PigIcon className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Casal em Dias</h1>
        </div>
        <p className="text-emerald-700 font-medium text-center">Organize o dinheiro do casal sem brigas.</p>
      </div>

      <Card className="w-full max-w-md shadow-xl border-none animate-slide-up">
        <h2 className="text-2xl font-bold text-center text-slate-800 mb-2">
          {isRegistering ? 'Comece sua jornada' : 'Casal que organiza juntos, vencem juntos'}
        </h2>
        <p className="text-center text-slate-500 mb-6">
          {isRegistering ? 'Crie sua conta em 30 segundos.' : 'Acesse sua conta para continuar.'}
        </p>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 border border-red-100 flex items-center animate-shake">
            <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegistering && (
            <Input
              label="Nome"
              placeholder="Como você quer ser chamado?"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              disabled={loading}
            />
          )}
          <Input
            label="Email"
            type="email"
            placeholder="seu@email.com"
            value={formData.email}
            onChange={e => setFormData({ ...formData, email: e.target.value })}
            disabled={loading}
          />

          <div className="flex flex-col gap-1.5 w-full">
            <label className="text-sm font-medium text-slate-700">Senha</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all shadow-sm text-slate-800 pr-10"
                disabled={loading}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path></svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                )}
              </button>
            </div>
          </div>

          <Button className="w-full h-12 text-base shadow-lg shadow-emerald-100 mt-2 disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none" disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {isRegistering ? 'Criando conta...' : 'Entrando...'}
              </span>
            ) : (isRegistering ? 'Criar minha conta grátis' : 'Entrar no App')}
          </Button>

          <p className="text-xs text-center text-slate-400 mt-2 flex items-center justify-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
            Seus dados são privados e protegidos via SSL.
          </p>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-50">
          <div className="text-center">
            <span className="text-slate-500 text-sm">
              {isRegistering ? 'Já tem uma conta?' : 'Ainda não tem conta?'}
            </span>
            <button
              onClick={() => {
                setIsRegistering(!isRegistering);
                setError('');
                setFormData({ name: '', email: '', password: '' });
                setShowPassword(false);
              }}
              className="block w-full mt-2 py-2 text-sm font-semibold text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
            >
              {isRegistering ? 'Fazer login' : 'Criar grátis em 30 segundos'}
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
};
