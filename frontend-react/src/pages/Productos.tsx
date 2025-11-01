import { useEffect, useMemo, useState } from 'react';
import { Api } from '../lib/api';
import Button from '../ui/Button';
import Alert from '../components/Alert';

type Producto = { id: number; name: string; category_name: string; price: number; stock_quantity: number };

export default function Productos() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '', price: '', image_url: '', category_id: '', stock_quantity: '' });
  const canCreate = useMemo(() => form.name && form.description && form.price && form.category_id && form.image_url, [form]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [prods, cats] = await Promise.all([Api.productos(), Api.categorias()]);
      setProductos(prods);
      setCategorias(cats);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando productos');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!canCreate) return;
    try {
      await Api.crearProducto({
        name: form.name,
        description: form.description,
        price: Number(form.price),
        image_url: form.image_url,
        category_id: Number(form.category_id),
        stock_quantity: Number(form.stock_quantity || '0')
      });
      setForm({ name: '', description: '', price: '', image_url: '', category_id: '', stock_quantity: '' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear el producto');
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Productos</h2>
      <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_0_1px_rgba(255,255,255,0.04),0_0_0_1px_rgba(139,92,246,0.15),0_8px_20px_rgba(34,211,238,0.08)] p-4">
        <form onSubmit={onCreate} className="grid grid-cols-1 md:grid-cols-6 gap-2 mb-4">
          {error && <div className="md:col-span-6"><Alert kind="error" message={error} /></div>}
          <input className="input-modern text-sm" placeholder="Nombre" value={form.name} onChange={(e)=>setForm({...form, name: e.target.value})} />
          <input className="input-modern text-sm md:col-span-2" placeholder="Descripción" value={form.description} onChange={(e)=>setForm({...form, description: e.target.value})} />
          <input className="input-modern text-sm" placeholder="Precio" type="number" step="0.01" value={form.price} onChange={(e)=>setForm({...form, price: e.target.value})} />
          <select className="input-modern text-sm" value={form.category_id} onChange={(e)=>setForm({...form, category_id: e.target.value})}>
            <option value="">Categoría</option>
            {categorias.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input className="input-modern text-sm" placeholder="URL imagen" value={form.image_url} onChange={(e)=>setForm({...form, image_url: e.target.value})} />
          <input className="input-modern text-sm" placeholder="Stock inicial" type="number" value={form.stock_quantity} onChange={(e)=>setForm({...form, stock_quantity: e.target.value})} />
          <Button disabled={!canCreate} className="md:col-span-6">Crear</Button>
        </form>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-8 text-center text-slate-500">Cargando...</div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="text-left text-slate-400">
                <tr>
                  <th className="py-2">Producto</th>
                  <th className="py-2">Categoría</th>
                  <th className="py-2">Venta</th>
                  <th className="py-2">Stock</th>
                </tr>
              </thead>
              <tbody className="text-slate-200">
                {productos.map((p) => (
                  <tr key={p.id} className="border-t border-white/10 hover:bg-white/5">
                    <td className="py-2">{p.name}</td>
                    <td className="py-2">{p.category_name}</td>
                    <td className="py-2">${p.price.toFixed(2)}</td>
                    <td className="py-2">{p.stock_quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}





