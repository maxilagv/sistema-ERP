export default function Configuracion() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Configuración</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-xl bg-white dark:bg-slate-900 shadow-md p-4">
          <div className="text-sm text-slate-500 mb-2">Datos del negocio</div>
          <div className="space-y-3">
            <input className="h-11 w-full rounded-md border border-slate-200 px-3" placeholder="Nombre" />
            <input className="h-11 w-full rounded-md border border-slate-200 px-3" placeholder="Email" />
            <input className="h-11 w-full rounded-md border border-slate-200 px-3" placeholder="Moneda (ARS/USD)" />
            <button className="h-11 rounded-md bg-indigo-600 text-white px-4">Guardar</button>
          </div>
        </div>
        <div className="rounded-xl bg-white dark:bg-slate-900 shadow-md p-4">
          <div className="text-sm text-slate-500 mb-2">Branding</div>
          <div className="space-y-3">
            <input className="h-11 w-full rounded-md border border-slate-200 px-3" placeholder="URL del logo" />
            <input className="h-11 w-full rounded-md border border-slate-200 px-3" placeholder="Subtítulo" />
            <button className="h-11 rounded-md bg-slate-100 px-4">Previsualizar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

