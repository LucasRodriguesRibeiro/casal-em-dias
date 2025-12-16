import React, { useState } from 'react';
import { Button, Input, Card, PigIcon } from './UIComponents';
import { authService, User } from '../services/authService';

interface AuthProps {
  onLogin: (user: User) => void;
}

export const AuthScreen: React.FC<AuthProps> = ({ onLogin }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      let user;
      if (isRegistering) {
        if (!formData.name || !formData.email || !formData.password) throw new Error('Preencha todos os campos.');
        user = await authService.register(formData.name, formData.email, formData.password);
      } else {
        if (!formData.email || !formData.password) throw new Error('Preencha email e senha.');
        user = await authService.login(formData.email, formData.password);
      }
      onLogin(user);
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro.');
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-emerald-600 p-3 rounded-xl shadow-lg shadow-emerald-200">
          <PigIcon className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Casal em Dias</h1>
      </div>

      <Card className="w-full max-w-md shadow-xl border-none">
        <h2 className="text-2xl font-bold text-center text-slate-800 mb-2">
          {isRegistering ? 'Criar Conta' : 'Bem-vindo de volta'}
        </h2>
        <p className="text-center text-slate-500 mb-6">
          {isRegistering ? 'Comece a organizar suas finanças hoje.' : 'Entre para acessar seus dados.'}
        </p>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 border border-red-100 flex items-center">
            <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegistering && (
            <Input
              label="Nome"
              placeholder="Seu nome"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
            />
          )}
          <Input
            label="Email"
            type="email"
            placeholder="seu@email.com"
            value={formData.email}
            onChange={e => setFormData({ ...formData, email: e.target.value })}
          />
          <Input
            label="Senha"
            type="password"
            placeholder="••••••••"
            value={formData.password}
            onChange={e => setFormData({ ...formData, password: e.target.value })}
          />

          <Button className="w-full h-11 text-base shadow-emerald-200" disabled={loading}>
            {loading ? 'Carregando...' : (isRegistering ? 'Cadastrar' : 'Entrar')}
          </Button>
        </form>



        <div className="mt-6 text-center text-sm">
          <span className="text-slate-500">
            {isRegistering ? 'Já tem uma conta?' : 'Ainda não tem conta?'}
          </span>
          <button
            onClick={() => {
              setIsRegistering(!isRegistering);
              setError('');
              setFormData({ name: '', email: '', password: '' });
            }}
            className="ml-1 font-medium text-emerald-600 hover:text-emerald-700 hover:underline"
          >
            {isRegistering ? 'Fazer Login' : 'Cadastre-se'}
          </button>
        </div>
      </Card>
    </div>
  );
};
