import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { Api } from '../lib/api';
import { uploadImageToCloudinary } from '../lib/cloudinary';
import Alert from '../components/Alert';
import Button from '../ui/Button';

type ProductoOption = {
  id: number;
  name: string;
  category_name?: string | null;
  image_url?: string | null;
  precio_final?: number | null;
  price?: number | null;
};

export default function CatalogoAdmin() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [productos, setProductos] = useState<ProductoOption[]>([]);
  const [form, setForm] = useState({
    nombre: '',
    logo_url: '',
    destacado_producto_id: '',
  });

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [config, productosResp] = await Promise.all([
          Api.catalogoConfig(),
          Api.productos({ page: 1, limit: 200, paginated: true }).catch(() => ({})),
        ]);
        if (!mounted) return;
        const cfg: any = config || {};
        const prodsData: any = (productosResp as any).data || productosResp || [];
        const list = Array.isArray(prodsData) ? prodsData : [];
        setProductos(
          list.map((p: any) => ({
            id: Number(p.id),
            name: p.name,
            category_name: p.category_name,
            image_url: p.image_url,
            precio_final: p.precio_final,
            price: p.price,
          }))
        );
        setForm({
          nombre: cfg.nombre || '',
          logo_url: cfg.logo_url || '',
          destacado_producto_id:
            cfg.destacado_producto_id != null ? String(cfg.destacado_producto_id) : '',
        });
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : 'No se pudo cargar el catalogo');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleLogoFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploadingLogo(true);
    try {
      const url = await uploadImageToCloudinary(file);
      setForm((prev) => ({ ...prev, logo_url: url }));
    } catch (e) {
      setUploadError(
        e instanceof Error ? e.message : 'No se pudo subir el logo'
      );
    } finally {
      setUploadingLogo(false);
    }
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      await Api.guardarCatalogoConfig({
        nombre: form.nombre.trim(),
        logo_url: form.logo_url.trim(),
        destacado_producto_id: form.destacado_producto_id
          ? Number(form.destacado_producto_id)
          : null,
        publicado: true,
      });
      setSuccess('Configuracion del catalogo guardada.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el catalogo');
    } finally {
      setSaving(false);
    }
  }

  const destacadoPreview = useMemo(() => {
    const id = Number(form.destacado_producto_id || 0);
    return productos.find((p) => p.id === id) || null;
  }, [form.destacado_producto_id, productos]);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-100">Catalogo</h2>

      <form
        onSubmit={onSave}
        className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_0_1px_rgba(255,255,255,0.04),0_0_0_1px_rgba(139,92,246,0.15),0_8px_20px_rgba(34,211,238,0.08)] p-4 space-y-4"
      >
        {(error || success || uploadError) && (
          <div className="space-y-2">
            {error && <Alert kind="error" message={error} />}
            {uploadError && <Alert kind="error" message={uploadError} />}
            {success && <Alert kind="info" message={success} />}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="text-sm text-slate-300">Datos visibles en el catalogo</div>
            <input
              className="input-modern w-full text-sm"
              placeholder="Nombre de la empresa"
              value={form.nombre}
              onChange={(e) => setForm((prev) => ({ ...prev, nombre: e.target.value }))}
              disabled={loading || saving}
            />
            <div className="space-y-2">
              <input
                type="file"
                accept="image/*"
                className="input-modern w-full text-sm"
                onChange={handleLogoFile}
                disabled={loading || saving}
              />
              <input
                className="input-modern w-full text-sm"
                placeholder="URL del logo"
                value={form.logo_url}
                onChange={(e) => setForm((prev) => ({ ...prev, logo_url: e.target.value }))}
                disabled={loading || saving}
              />
              {uploadingLogo && (
                <div className="text-xs text-slate-400">Subiendo logo...</div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-sm text-slate-300">Producto destacado (hero)</div>
            <select
              className="input-modern w-full text-sm"
              value={form.destacado_producto_id}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, destacado_producto_id: e.target.value }))
              }
              disabled={loading || saving}
            >
              <option value="">Sin destacado</option>
              {productos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.category_name ? ` - ${p.category_name}` : ''}
                </option>
              ))}
            </select>
            {destacadoPreview && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                {destacadoPreview.image_url ? (
                  <img
                    src={destacadoPreview.image_url}
                    alt={destacadoPreview.name}
                    className="h-12 w-12 rounded-lg object-cover"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-lg bg-white/10 flex items-center justify-center text-xs text-slate-400">
                    Sin imagen
                  </div>
                )}
                <div>
                  <div className="text-sm text-slate-100">{destacadoPreview.name}</div>
                  <div className="text-xs text-slate-400">
                    {destacadoPreview.precio_final != null
                      ? `$${destacadoPreview.precio_final.toFixed(2)}`
                      : destacadoPreview.price != null
                      ? `$${destacadoPreview.price.toFixed(2)}`
                      : 'Sin precio'}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="text-xs text-slate-400">
            El catalogo siempre esta visible para clientes bajo el dominio principal.
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={saving || loading}>
              {saving ? 'Guardando...' : 'Guardar configuracion'}
            </Button>
            <button
              type="button"
              className="h-11 rounded-lg bg-emerald-600 text-white px-4 text-sm font-medium disabled:opacity-60"
              onClick={() => {
                const url = `${window.location.origin}/catalogo`;
                window.open(url, '_blank', 'noopener,noreferrer');
              }}
              disabled={saving || loading}
            >
              Emitir catalogo
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
