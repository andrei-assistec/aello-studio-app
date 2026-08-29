import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { logActivity } from '../../services/logger';
import { Loader2, Lock, Mail, AlertCircle } from 'lucide-react';

export const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await signInWithEmailAndPassword(auth, email, password);
      await logActivity({
        action: 'LOGIN',
        resource_type: 'auth',
        details: 'Usuário realizou login com sucesso'
      });
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setError('E-mail ou senha incorretos.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Muitas tentativas falhas. Tente novamente mais tarde.');
      } else {
        setError('Erro ao realizar login. Verifique sua conexão.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center p-4 relative overflow-hidden">
      {/* Elementos Decorativos de Fundo */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-medium/20 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-brand-light/10 rounded-full blur-[120px]" />

      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <img 
            src="/icons/icon-512.png" 
            className="inline-flex w-20 h-20 object-contain rounded-full shadow-2xl mb-4 border border-brand-dark/10" 
            alt="Aello Studio Logo" 
          />
          <h1 className="text-3xl font-display font-bold text-white mb-2">Aello Studio</h1>
          <p className="text-surface-400">Entre com suas credenciais para acessar o painel.</p>
        </div>

        <div className="glass-card p-8 bg-white/5 border-white/10 backdrop-blur-2xl shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-surface-300 mb-2">E-mail Profissional</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white focus:ring-2 focus:ring-brand-medium focus:border-transparent transition-all outline-none"
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-300 mb-2">Senha de Acesso</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white focus:ring-2 focus:ring-brand-medium focus:border-transparent transition-all outline-none"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm animate-shake">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-4 justify-center text-lg font-bold shadow-xl shadow-brand-medium/20 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Autenticando...
                </>
              ) : (
                'Acessar Sistema'
              )}
            </button>
          </form>
        </div>

        <p className="mt-8 text-center text-surface-500 text-sm">
          © 2026 Aello Studio. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
};
