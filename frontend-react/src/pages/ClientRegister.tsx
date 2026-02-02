import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { clientRegister } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Alert from '../components/Alert';

export default function ClientRegister() {
    const navigate = useNavigate();
    const { setTokens } = useAuth();
    const [formData, setFormData] = useState({
        nombre: '',
        apellido: '',
        email: '',
        telefono: '',
        password: '',
        confirmPassword: '',
    });
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (formData.password !== formData.confirmPassword) {
            setError('Las contraseñas no coinciden');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const { accessToken, refreshToken } = await clientRegister({
                nombre: formData.nombre,
                apellido: formData.apellido,
                email: formData.email,
                password: formData.password,
                telefono: formData.telefono
            });
            setTokens(accessToken, refreshToken);
            navigate('/cliente/portal');
        } catch (err: any) {
            setError(err.message || 'Error al registrarse');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-slate-100 mb-2">Crear cuenta</h1>
                    <p className="text-slate-400">Únete para gestionar tus pedidos</p>
                </div>

                {error && <Alert kind="error" message={error} className="mb-6" />}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1 ml-1" htmlFor="nombre">
                                Nombre
                            </label>
                            <Input
                                id="nombre"
                                name="nombre"
                                required
                                value={formData.nombre}
                                onChange={handleChange}
                                placeholder="Nombre"
                                className="w-full bg-slate-950 border-slate-800 text-slate-200"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1 ml-1" htmlFor="apellido">
                                Apellido
                            </label>
                            <Input
                                id="apellido"
                                name="apellido"
                                value={formData.apellido}
                                onChange={handleChange}
                                placeholder="Apellido"
                                className="w-full bg-slate-950 border-slate-800 text-slate-200"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1 ml-1" htmlFor="email">
                            Email
                        </label>
                        <Input
                            id="email"
                            name="email"
                            type="email"
                            required
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="tu@email.com"
                            className="w-full bg-slate-950 border-slate-800 text-slate-200"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1 ml-1" htmlFor="telefono">
                            Teléfono
                        </label>
                        <Input
                            id="telefono"
                            name="telefono"
                            type="tel"
                            value={formData.telefono}
                            onChange={handleChange}
                            placeholder="+54 ..."
                            className="w-full bg-slate-950 border-slate-800 text-slate-200"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1 ml-1" htmlFor="password">
                                Contraseña
                            </label>
                            <Input
                                id="password"
                                name="password"
                                type="password"
                                required
                                value={formData.password}
                                onChange={handleChange}
                                placeholder="Mínimo 6 caracteres"
                                className="w-full bg-slate-950 border-slate-800 text-slate-200"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1 ml-1" htmlFor="confirmPassword">
                                Confirmar
                            </label>
                            <Input
                                id="confirmPassword"
                                name="confirmPassword"
                                type="password"
                                required
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                placeholder="Repetir contraseña"
                                className="w-full bg-slate-950 border-slate-800 text-slate-200"
                            />
                        </div>
                    </div>

                    <Button type="submit" disabled={loading} className="w-full mt-6 py-3 text-base">
                        {loading ? 'Registrando...' : 'Crear cuenta'}
                    </Button>
                </form>

                <div className="mt-6 text-center text-sm text-slate-500">
                    ¿Ya tienes cuenta?{' '}
                    <Link to="/cliente/login" className="text-indigo-400 hover:text-indigo-300 transition-colors">
                        Inicia sesión
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
