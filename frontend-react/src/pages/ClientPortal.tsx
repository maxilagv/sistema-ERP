import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Button from '../ui/Button';

export default function ClientPortal() {
    const { clearTokens } = useAuth();
    const navigate = useNavigate();

    function handleLogout() {
        clearTokens();
        navigate('/catalogo');
    }

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
            <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="font-bold text-xl tracking-tight">Mi Cuenta</div>
                    <Button onClick={handleLogout} className="bg-slate-800 hover:bg-slate-700 text-slate-200 border-none">
                        Cerrar sesión
                    </Button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="col-span-1 md:col-span-3">
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
                            <h2 className="text-2xl font-semibold mb-2">Bienvenido a tu Portal</h2>
                            <p className="text-slate-400 mb-6">Desde aquí podrás gestionar tus pedidos y ver tu historial.</p>
                            <div className="inline-flex gap-4">
                                <Button onClick={() => navigate('/catalogo')}>
                                    Ir al Catálogo
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Placeholder cards for future functionality */}
                    <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl">
                        <h3 className="text-lg font-medium mb-2">Mis Pedidos</h3>
                        <p className="text-sm text-slate-500">Próximamente podrás ver el estado de tus compras.</p>
                    </div>

                    <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl">
                        <h3 className="text-lg font-medium mb-2">Perfil</h3>
                        <p className="text-sm text-slate-500">Administra tus datos personales y de envío.</p>
                    </div>

                    <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-xl">
                        <h3 className="text-lg font-medium mb-2">Ayuda</h3>
                        <p className="text-sm text-slate-500">Contacta a soporte si tienes dudas.</p>
                    </div>
                </div>
            </main>
        </div>
    );
}
