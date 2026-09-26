import React, { useState } from 'react';

/**
 * Tela de bloqueio / login. No modo HTTP (supabase_user) exibe e-mail+senha
 * quando `onLogin` é fornecido — melhora o fluxo existente sem tela paralela.
 */
const UserNotRegisteredError = ({
  title = 'Access Restricted',
  message = 'You are not registered to use this application. Please contact the app administrator to request access.',
  onLogin = null,
  loginBusy = false,
  loginError = null,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const showLogin = typeof onLogin === 'function';

  const submit = (event) => {
    event.preventDefault();
    if (!showLogin || loginBusy) return;
    onLogin({ email: email.trim(), password });
  };

  return (
    <div className="flex flex-col items-center justify-center w-full h-full min-h-screen bg-gradient-to-b from-white to-slate-50">
      <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-lg border border-slate-100">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-orange-100">
            <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-4">{title}</h1>
          <p className="text-slate-600 mb-6">
            {message}
          </p>

          {showLogin ? (
            <form onSubmit={submit} className="text-left space-y-4 mb-6">
              <div>
                <label htmlFor="erp-login-email" className="block text-sm font-medium text-slate-700 mb-1">
                  E-mail
                </label>
                <input
                  id="erp-login-email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loginBusy}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>
              <div>
                <label htmlFor="erp-login-password" className="block text-sm font-medium text-slate-700 mb-1">
                  Senha
                </label>
                <input
                  id="erp-login-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loginBusy}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>
              {loginError ? (
                <p className="text-sm text-red-600" role="alert">{loginError}</p>
              ) : null}
              <button
                type="submit"
                disabled={loginBusy}
                className="w-full rounded-md bg-slate-900 text-white py-2.5 font-medium hover:bg-slate-800 disabled:opacity-60"
              >
                {loginBusy ? 'Entrando…' : 'Entrar'}
              </button>
            </form>
          ) : (
            <div className="p-4 bg-slate-50 rounded-md text-sm text-slate-600">
              <p>If you believe this is an error, you can:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Verify you are logged in with the correct account</li>
                <li>Contact the app administrator for access</li>
                <li>Try logging out and back in again</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserNotRegisteredError;
