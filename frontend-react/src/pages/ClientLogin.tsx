import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { clientLogin } from '../lib/api';
import { useClientAuth } from '../context/ClientAuthContext';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Alert from '../components/Alert';

export default function ClientLogin() {
    const navigate = useNavigate();
    const { setTokens } = useClientAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const { accessToken, refreshToken } = await clientLogin(email, password);
            setTokens(accessToken, refreshToken);
            navigate('/cliente/portal');
        } catch (err: any) {
            setError(err.message || 'Error al iniciar sesion');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-slate-100 mb-2">Portal Clientes</h1>
                    <p className="text-slate-400">Ingresa para ver tus pedidos</p>
                </div>

                {error && <Alert kind="error" message={error} className="mb-6" />}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1 ml-1" htmlFor="email">
                            Email
                        </label>
                        <Input
                            id="email"
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="tu@email.com"
                            className="w-full bg-slate-950 border-slate-800 text-slate-200"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1 ml-1" htmlFor="password">
                            Contraseña
                        </label>
                        <Input
                            id="password"
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full bg-slate-950 border-slate-800 text-slate-200"
                        />
                    </div>

                    <Button type="submit" disabled={loading} className="w-full mt-6 py-3 text-base">
                        {loading ? 'Ingresando...' : 'Ingresar'}
                    </Button>
                </form>

                <div className="mt-6 text-center text-sm text-slate-500">
                    ¿No tienes cuenta?{' '}
                    <Link to="/cliente/registro" className="text-indigo-400 hover:text-indigo-300 transition-colors">
                        Regístrate aquí
                    </Link>
                    <div className="mt-4">
                        <Link to="/catalogo" className="text-slate-600 hover:text-slate-500 text-xs">
                            &larr; Volver al catálogo
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
