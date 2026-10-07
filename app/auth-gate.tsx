import { useEffect, useState, type FormEvent } from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  type User,
} from 'firebase/auth';
import { Anchor } from 'lucide-react';
import Tower from './tower';
import {
  firebaseConfigured,
  missingFirebaseConfig,
  requireAuth,
} from './firebase-client';

function readableAuthError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes('auth/invalid-credential')) return 'E-mail ou senha inválidos.';
  if (raw.includes('auth/too-many-requests')) return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  if (raw.includes('auth/popup-closed-by-user')) return 'Login cancelado.';
  if (raw.includes('auth/operation-not-allowed')) return 'Este método de login ainda não está habilitado no Firebase Authentication.';
  if (raw.includes('auth/unauthorized-domain')) return 'O domínio do GitHub Pages precisa ser adicionado aos domínios autorizados do Firebase Authentication.';
  return raw.replace(/^Firebase:\s*/i, '');
}

export default function AuthGate() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!firebaseConfigured) {
      setChecking(false);
      return;
    }
    return onAuthStateChanged(requireAuth(), (next) => {
      setUser(next);
      setChecking(false);
    });
  }, []);

  async function emailLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      await signInWithEmailAndPassword(
        requireAuth(),
        String(data.get('email') || '').trim(),
        String(data.get('password') || ''),
      );
    } catch (e) {
      setError(readableAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  async function googleLogin() {
    setBusy(true);
    setError('');
    try {
      await signInWithPopup(requireAuth(), new GoogleAuthProvider());
    } catch (e) {
      setError(readableAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  if (checking) {
    return <div className="loading"><Anchor size={42}/><h1>DDS Control Tower</h1><p>Validando acesso...</p></div>;
  }

  if (!firebaseConfigured) {
    return <div className="login-page"><section className="login-card"><Anchor size={38}/><h1>DDS Control Tower</h1><p>O frontend já está pronto para o GitHub Pages, mas o Firebase ainda não foi configurado.</p><div className="alert danger">Variáveis ausentes: {missingFirebaseConfig.map((key) => `VITE_FIREBASE_${key.replace(/[A-Z]/g, (m) => '_' + m).toUpperCase()}`).join(', ')}</div><p className="meta">Preencha as Repository Variables no GitHub conforme o arquivo GUIA-PUBLICACAO.md.</p></section></div>;
  }

  if (user) return <Tower/>;

  return <div className="login-page"><section className="login-card"><Anchor size={38}/><div><div className="eyebrow">ACESSO RESTRITO</div><h1>DDS Control Tower</h1><p>Entre com uma conta autorizada no Firebase.</p></div>{error && <div className="alert danger" role="alert">{error}</div>}<form onSubmit={emailLogin}><label className="field"><span>E-mail</span><input name="email" type="email" autoComplete="email" required/></label><label className="field"><span>Senha</span><input name="password" type="password" autoComplete="current-password" required/></label><button className="primary" disabled={busy}>{busy ? 'Entrando...' : 'Entrar'}</button></form><div className="login-divider"><span>ou</span></div><button onClick={googleLogin} disabled={busy}>Entrar com Google</button><small>Você pode habilitar apenas o método de login que utilizar no Firebase Authentication.</small></section></div>;
}
