import { useEffect, useMemo, useState } from 'react';
import { Api } from '../lib/api';
import { uploadImageToCloudinary } from '../lib/cloudinary';
import Button from '../ui/Button';
import Alert from '../components/Alert';

type Producto = {
  id: number;
  name: string;
  category_id: number;
  category_name: string;
  description?: string | null;
  image_url?: string | null;
  price: number;
  stock_quantity: number;
  costo_pesos?: number | null;
  costo_dolares?: number | null;
  tipo_cambio?: number | null;
  margen_local?: number | null;
  margen_distribuidor?: number | null;
  price_local?: number | null;
  price_distribuidor?: number | null;
};

type HistorialRow = {
  id: number;
  producto_id: number;
  proveedor_id: number | null;
  proveedor_nombre?: string | null;
  fecha: string;
  costo_pesos: number | null;
  costo_dolares: number | null;
  tipo_cambio: number | null;
  margen_local: number | null;
  margen_distribuidor: number | null;
  precio_local: number | null;
  precio_distribuidor: number | null;
  usuario_nombre?: string | null;
};

type FormState = {
  name: string;
  description: string;
  price: string;
  image_url: string;
  category_id: string;
  stock_quantity: string;
  costo_pesos: string;
  costo_dolares: string;
  tipo_cambio: string;
  margen_local: string; // en %
  margen_distribuidor: string; // en %
};

const emptyForm: FormState = {
  name: '',
  description: '',
  price: '',
  image_url: '',
  category_id: '',
  stock_quantity: '',
  costo_pesos: '',
  costo_dolares: '',
  tipo_cambio: '',
  margen_local: '15',
  margen_distribuidor: '45',
};

export default function Productos() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<FormState>(emptyForm);

  const [historialProducto, setHistorialProducto] = useState<Producto | null>(null);
  const [historial, setHistorial] = useState<HistorialRow[]>([]);
  const [historialLoading, setHistorialLoading] = useState(false);
  const [historialError, setHistorialError] = useState<string | null>(null);

  const [lastCostoEdit, setLastCostoEdit] = useState<'pesos' | 'dolares' | null>(null);

  const costoPesosNumber = useMemo(
    () => Number(form.costo_pesos || '0') || 0,
    [form.costo_pesos]
  );
  const costoDolaresNumber = useMemo(
    () => Number(form.costo_dolares || '0') || 0,
    [form.costo_dolares]
  );
  const tipoCambioNumber = useMemo(
    () => (form.tipo_cambio ? Number(form.tipo_cambio) || 0 : 0),
    [form.tipo_cambio]
  );
  const margenLocalNumber = useMemo(
    () => (form.margen_local ? Number(form.margen_local) / 100 : 0.15),
    [form.margen_local]
  );
  const margenDistribuidorNumber = useMemo(
    () => (form.margen_distribuidor ? Number(form.margen_distribuidor) / 100 : 0.45),
    [form.margen_distribuidor]
  );

  const precioLocalCalc = useMemo(() => {
    if (costoPesosNumber > 0) return costoPesosNumber * (1 + margenLocalNumber);
    return 0;
  }, [costoPesosNumber, margenLocalNumber]);

  const precioDistribuidorCalc = useMemo(() => {
    if (costoPesosNumber > 0) return costoPesosNumber * (1 + margenDistribuidorNumber);
    return 0;
  }, [costoPesosNumber, margenDistribuidorNumber]);

  const canCreate = useMemo(() => {
    const hasCore =
      form.name &&
      form.description &&
      form.category_id &&
      form.image_url;
    const hasAnyCost =
      (form.costo_pesos && Number(form.costo_pesos || '0') > 0) ||
      (form.costo_dolares && Number(form.costo_dolares || '0') > 0);
    return Boolean(hasCore && hasAnyCost);
  }, [form]);

  useEffect(() => {
    if (!tipoCambioNumber || tipoCambioNumber <= 0 || !lastCostoEdit) return;

    if (lastCostoEdit === 'dolares' && costoDolaresNumber > 0) {
      const nuevoPesos = Number((costoDolaresNumber * tipoCambioNumber).toFixed(2));
      const actualPesos = Number(form.costo_pesos || '0') || 0;
      if (!Number.isNaN(nuevoPesos) && nuevoPesos !== actualPesos) {
        setForm((prev) => ({ ...prev, costo_pesos: String(nuevoPesos) }));
      }
    } else if (lastCostoEdit === 'pesos' && costoPesosNumber > 0) {
      const nuevoDolares = Number((costoPesosNumber / tipoCambioNumber).toFixed(2));
      const actualDolares = Number(form.costo_dolares || '0') || 0;
      if (!Number.isNaN(nuevoDolares) && nuevoDolares !== actualDolares) {
        setForm((prev) => ({ ...prev, costo_dolares: String(nuevoDolares) }));
      }
    }
  }, [tipoCambioNumber, lastCostoEdit, costoPesosNumber, costoDolaresNumber, form.costo_pesos, form.costo_dolares]);

  const filteredProductos = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return productos;
    return productos.filter((p) => p.name.toLowerCase().includes(q));
  }, [productos, search]);

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

  useEffect(() => {
    load();
  }, []);

  async function handleImageFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploadingImage(true);
    try {
      const url = await uploadImageToCloudinary(file);
      setForm((prev) => ({ ...prev, image_url: url }));
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : 'No se pudo subir la imagen';
      setUploadError(msg);
    } finally {
      setUploadingImage(false);
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!canCreate) return;
    try {
      await Api.crearProducto({
        name: form.name,
        description: form.description,
        price: precioLocalCalc > 0 ? precioLocalCalc : undefined,
        image_url: form.image_url,
        category_id: Number(form.category_id),
        stock_quantity: Number(form.stock_quantity || '0'),
        precio_costo_pesos: costoPesosNumber || undefined,
        precio_costo_dolares: costoDolaresNumber || undefined,
        tipo_cambio: tipoCambioNumber || undefined,
        margen_local: margenLocalNumber,
        margen_distribuidor: margenDistribuidorNumber,
      });
      setForm(emptyForm);
      await load();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'No se pudo crear el producto'
      );
    }
  }

  async function cargarHistorial(p: Producto) {
    setHistorialProducto(p);
    setHistorial([]);
    setHistorialError(null);
    setHistorialLoading(true);
    try {
      const rows = await Api.productoHistorial(p.id);
      setHistorial(rows as HistorialRow[]);
    } catch (e) {
      setHistorialError(
        e instanceof Error
          ? e.message
          : 'No se pudo cargar el historial de precios'
      );
    } finally {
      setHistorialLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
        Productos
      </h2>
      <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_0_1px_rgba(255,255,255,0.04),0_0_0_1px_rgba(139,92,246,0.15),0_8px_20px_rgba(34,211,238,0.08)] p-4 space-y-4">
        <form
          onSubmit={onCreate}
          className="grid grid-cols-1 md:grid-cols-6 gap-2 mb-4"
        >
          {(error || uploadError) && (
            <div className="md:col-span-6 space-y-1">
              {error && <Alert kind="error" message={error} />}
              {uploadError && <Alert kind="error" message={uploadError} />}
            </div>
          )}
          <input
            className="input-modern text-sm"
            placeholder="Nombre"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            className="input-modern text-sm md:col-span-2"
            placeholder="Descripción"
            value={form.description}
            onChange={(e) =>
              setForm({ ...form, description: e.target.value })
            }
          />
          <input
            className="input-modern text-sm"
            placeholder="Precio venta base (calculado)"
            type="number"
            step="0.01"
            value={precioLocalCalc.toFixed(2)}
            readOnly
          />
          <select
            className="input-modern text-sm"
            value={form.category_id}
            onChange={(e) => setForm({ ...form, category_id: e.target.value })}
          >
            <option value="">Categoría</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="md:col-span-2 flex flex-col gap-1">
            <input
              type="file"
              accept="image/*"
              className="input-modern text-sm"
              onChange={handleImageFileChange}
            />
            <input
              className="input-modern text-xs"
              placeholder="URL imagen (se completa al subir)"
              value={form.image_url}
              onChange={(e) =>
                setForm({ ...form, image_url: e.target.value })
              }
            />
            {uploadingImage && (
              <span className="text-[11px] text-slate-400">
                Subiendo imagen a Cloudinary...
              </span>
            )}
          </div>
          <input
            className="input-modern text-sm"
            placeholder="Costo en pesos"
            type="number"
            step="0.01"
            value={form.costo_pesos}
            onChange={(e) =>
              setForm((prev) => {
                setLastCostoEdit('pesos');
                return { ...prev, costo_pesos: e.target.value };
              })
            }
          />
          <input
            className="input-modern text-sm"
            placeholder="Costo en dólares"
            type="number"
            step="0.01"
            value={form.costo_dolares}
            onChange={(e) =>
              setForm((prev) => {
                setLastCostoEdit('dolares');
                return { ...prev, costo_dolares: e.target.value };
              })
            }
          />
          <input
            className="input-modern text-sm"
            placeholder="Tipo de cambio"
            type="number"
            step="0.0001"
            value={form.tipo_cambio}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, tipo_cambio: e.target.value }))
            }
          />
          <input
            className="input-modern text-sm"
            placeholder="% margen local"
            type="number"
            step="0.01"
            value={form.margen_local}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, margen_local: e.target.value }))
            }
          />
          <input
            className="input-modern text-sm"
            placeholder="% margen distribuidor"
            type="number"
            step="0.01"
            value={form.margen_distribuidor}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                margen_distribuidor: e.target.value,
              }))
            }
          />
          <input
            className="input-modern text-sm"
            placeholder="Stock inicial"
            type="number"
            value={form.stock_quantity}
            onChange={(e) =>
              setForm({ ...form, stock_quantity: e.target.value })
            }
          />
          <div className="md:col-span-2 flex flex-col gap-1 text-xs text-slate-300">
            <div>
              Precio local estimado:{' '}
              <span className="font-semibold">
                ${precioLocalCalc.toFixed(2)}
              </span>
            </div>
            <div>
              Precio distribuidor estimado:{' '}
              <span className="font-semibold">
                ${precioDistribuidorCalc.toFixed(2)}
              </span>
            </div>
          </div>
          <Button disabled={!canCreate} className="md:col-span-6">
            Crear
          </Button>
        </form>

        <div className="flex justify-end mb-3">
          <div className="flex items-center gap-2 w-full max-w-xs">
            <span className="text-slate-400 text-sm whitespace-nowrap">
              Buscar:
            </span>
            <input
              className="input-modern text-sm w-full"
              placeholder="Nombre de producto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-8 text-center text-slate-500">Cargando...</div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="text-left text-slate-400">
                <tr>
                  <th className="py-2">Producto</th>
                  <th className="py-2">Categoría</th>
                  <th className="py-2">Costo $</th>
                  <th className="py-2">Local $</th>
                  <th className="py-2">Distribuidor $</th>
                  <th className="py-2">Venta base</th>
                  <th className="py-2">Stock</th>
                  <th className="py-2">Acciones</th>
                </tr>
              </thead>
              <tbody className="text-slate-200">
                {filteredProductos.length === 0 && productos.length > 0 && (
                  <tr>
                    <td className="py-2 text-slate-400" colSpan={8}>
                      Sin productos que coincidan con la búsqueda
                    </td>
                  </tr>
                )}
                {filteredProductos.map((p) => (
                  <tr
                    key={p.id}
                    className="border-t border-white/10 hover:bg-white/5"
                  >
                    <td className="py-2">{p.name}</td>
                    <td className="py-2">{p.category_name}</td>
                    <td className="py-2">
                      {p.costo_pesos != null
                        ? `$${p.costo_pesos.toFixed(2)}`
                        : '-'}
                    </td>
                    <td className="py-2">
                      {p.price_local != null
                        ? `$${p.price_local.toFixed(2)}`
                        : '-'}
                    </td>
                    <td className="py-2">
                      {p.price_distribuidor != null
                        ? `$${p.price_distribuidor.toFixed(2)}`
                        : '-'}
                    </td>
                    <td className="py-2">${p.price.toFixed(2)}</td>
                    <td className="py-2">{p.stock_quantity}</td>
                    <td className="py-2 space-x-2">
                      <button
                        className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 border border-white/20 text-xs"
                        onClick={async () => {
                          const nuevoNombre =
                            window.prompt(`Nombre de ${p.name}`, p.name) ??
                            p.name;
                          const nuevaDesc =
                            window.prompt(
                              'Descripción',
                              String(p.description ?? '')
                            ) ?? String(p.description ?? '');
                          const nuevoPrecioStr = window.prompt(
                            'Precio de venta',
                            String(p.price)
                          );
                          if (nuevoPrecioStr == null) return;
                          const nuevoPrecio = Number(nuevoPrecioStr);
                          if (
                            !Number.isFinite(nuevoPrecio) ||
                            nuevoPrecio <= 0
                          ) {
                            setError('Precio inválido');
                            return;
                          }
                          const nuevoStockStr = window.prompt(
                            'Stock disponible',
                            String(p.stock_quantity)
                          );
                          if (nuevoStockStr == null) return;
                          const nuevoStock = Number(nuevoStockStr);
                          if (
                            !Number.isFinite(nuevoStock) ||
                            nuevoStock < 0
                          ) {
                            setError('Stock inválido');
                            return;
                          }
                          setError(null);
                          try {
                            await Api.actualizarProducto(p.id, {
                              name: nuevoNombre,
                              description: nuevaDesc,
                              price: nuevoPrecio,
                              image_url: p.image_url ?? '',
                              category_id: p.category_id ?? 0,
                              stock_quantity: nuevoStock,
                            });
                            await load();
                          } catch (e: any) {
                            if (e && e.code === 'APPROVAL_REQUIRED') {
                              setError(
                                `Se solicitó aprobación #${
                                  e.aprobacionId || ''
                                }${e.regla ? ` (${e.regla})` : ''}`
                              );
                            } else {
                              setError(
                                e instanceof Error
                                  ? e.message
                                  : 'No se pudo actualizar el producto'
                              );
                            }
                          }
                        }}
                      >
                        Editar
                      </button>
                      <button
                        className="px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-200 text-xs"
                        onClick={async () => {
                          if (!window.confirm(`Eliminar producto ${p.name}?`))
                            return;
                          try {
                            await Api.eliminarProducto(p.id);
                            await load();
                          } catch (e: any) {
                            setError(e?.message || 'No se pudo eliminar');
                          }
                        }}
                      >
                        Eliminar
                      </button>
                      <button
                        className="px-2 py-1 rounded bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/30 text-sky-200 text-xs"
                        onClick={() => cargarHistorial(p)}
                      >
                        Historial
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {historialProducto && (
          <div className="mt-6 border-t border-white/10 pt-4 space-y-2">
            <div className="text-sm font-medium text-slate-200">
              Historial de precios para {historialProducto.name}
            </div>
            {historialLoading ? (
              <div className="text-xs text-slate-400">
                Cargando historial...
              </div>
            ) : historialError ? (
              <Alert kind="error" message={historialError} />
            ) : historial.length === 0 ? (
              <div className="text-xs text-slate-400">
                Sin historial registrado.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs md:text-sm">
                  <thead className="text-left text-slate-400">
                    <tr>
                      <th className="py-1 pr-2">Fecha</th>
                      <th className="py-1 pr-2">Proveedor</th>
                      <th className="py-1 pr-2">Costo ARS</th>
                      <th className="py-1 pr-2">Costo USD</th>
                      <th className="py-1 pr-2">TC</th>
                      <th className="py-1 pr-2">% Local</th>
                      <th className="py-1 pr-2">% Dist.</th>
                      <th className="py-1 pr-2">Local ARS</th>
                      <th className="py-1 pr-2">Dist. ARS</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-200">
                    {historial.map((h) => (
                      <tr
                        key={h.id}
                        className="border-t border-white/10 hover:bg-white/5"
                      >
                        <td className="py-1 pr-2">
                          {h.fecha
                            ? new Date(h.fecha).toLocaleString()
                            : '-'}
                        </td>
                        <td className="py-1 pr-2">
                          {h.proveedor_nombre || '-'}
                        </td>
                        <td className="py-1 pr-2">
                          {h.costo_pesos != null
                            ? `$${h.costo_pesos.toFixed(2)}`
                            : '-'}
                        </td>
                        <td className="py-1 pr-2">
                          {h.costo_dolares != null
                            ? `$${h.costo_dolares.toFixed(2)}`
                            : '-'}
                        </td>
                        <td className="py-1 pr-2">
                          {h.tipo_cambio != null
                            ? h.tipo_cambio.toFixed(2)
                            : '-'}
                        </td>
                        <td className="py-1 pr-2">
                          {h.margen_local != null
                            ? `${(h.margen_local * 100).toFixed(1)}%`
                            : '-'}
                        </td>
                        <td className="py-1 pr-2">
                          {h.margen_distribuidor != null
                            ? `${(h.margen_distribuidor * 100).toFixed(1)}%`
                            : '-'}
                        </td>
                        <td className="py-1 pr-2">
                          {h.precio_local != null
                            ? `$${h.precio_local.toFixed(2)}`
                            : '-'}
                        </td>
                        <td className="py-1 pr-2">
                          {h.precio_distribuidor != null
                            ? `$${h.precio_distribuidor.toFixed(2)}`
                            : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
