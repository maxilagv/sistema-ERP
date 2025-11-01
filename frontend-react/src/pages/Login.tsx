import { FormEvent, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/Logo';
import { BRAND } from '../config/branding';
import TextInput from '../components/TextInput';
import Spinner from '../components/Spinner';
import Alert from '../components/Alert';
import { login } from '../lib/api';
import { saveTokens } from '../lib/storage';
import Button from '../ui/Button';
import AnimatedOrbs from '../ui/AnimatedOrbs';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login: setAuthTokens } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return email.trim().length > 0 && password.trim().length > 0 && !loading;
  }, [email, password, loading]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      const { accessToken, refreshToken } = await login(email, password);
      setAuthTokens(accessToken, refreshToken, remember);
      navigate('/app', { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      setError(msg || 'Usuario o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-neon animate-hue relative overflow-hidden grid-sweep">
      <AnimatedOrbs />
      <div className="absolute inset-0 scanlines pointer-events-none" />
      <div className="w-full max-w-[480px] p-6 sm:p-8">
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_0_1px_rgba(255,255,255,0.04),0_0_0_1px_rgba(139,92,246,0.15),0_8px_20px_rgba(34,211,238,0.08)] p-8 sm:p-10 glow-ring"
        >
          <motion.div className="flex flex-col items-center gap-2" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Logo {...BRAND} />
            <div className="font-display text-xl text-slate-200 tracking-wide">Control total del inventario</div>
          </motion.div>

          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            {error && (
              <Alert kind="error" message={error || 'Usuario o contraseña incorrectos.'} />
            )}

            <TextInput
              label="Email"
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@empresa.com"
              required
            />

            <TextInput
              label="Contraseña"
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <div className="flex items-center justify-between pt-1">
              <label className="inline-flex items-center gap-2 select-none">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                <span className="text-sm text-slate-700">Recordarme</span>
              </label>
              <a className="text-sm text-slate-500 hover:text-slate-700" href="#" onClick={(e)=>e.preventDefault()}>
                ¿Olvidaste la contraseña?
              </a>
            </div>

            <Button type="submit" disabled={!canSubmit}>
              {loading && <Spinner size={16} />}
              <span className="ml-2">{loading ? 'Ingresando...' : 'Ingresar'}</span>
            </Button>

            <div className="pt-2 text-center text-xs text-slate-400">
              <p>Acceso restringido</p>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
