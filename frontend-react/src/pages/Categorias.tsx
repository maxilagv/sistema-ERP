import { useEffect, useState } from 'react';
import { Api } from '../lib/api';
import { uploadImageToCloudinary } from '../lib/cloudinary';
import Button from '../ui/Button';
import Alert from '../components/Alert';

type Categoria = {
  id: number;
  name: string;
  image_url?: string | null;
  description?: string | null;
  multiplicador_local_1?: number | null;
};

type CategoryForm = {
  name: string;
  image_url: string;
  description: string;
  multiplicador_local_1: string;
};

const emptyForm = {
  name: '',
  image_url: '',
  description: '',
  multiplicador_local_1: '1',
} satisfies CategoryForm;

export default function Categorias() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [editUploadError, setEditUploadError] = useState<string | null>(null);
  const [editUploadingImage, setEditUploadingImage] = useState(false);
  const [form, setForm] = useState<CategoryForm>(emptyForm);
  const [editingCategory, setEditingCategory] = useState<Categoria | null>(null);
  const [editForm, setEditForm] = useState<CategoryForm>(emptyForm);
  const [savingEdit, setSavingEdit] = useState(false);
  const canCreate = Boolean(form.name && form.image_url && Number(form.multiplicador_local_1 || '0') > 0);
  const canSaveEdit = Boolean(
    editForm.name &&
    editForm.image_url &&
    Number(editForm.multiplicador_local_1 || '0') > 0 &&
    !savingEdit
  );

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const cats = await Api.categorias();
      setCategorias(cats);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error cargando categorias');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleImageFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploadingImage(true);
    try {
      const url = await uploadImageToCloudinary(file);
      setForm((prev) => ({ ...prev, image_url: url }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo subir la imagen';
      setUploadError(msg);
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleEditImageFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditUploadError(null);
    setEditUploadingImage(true);
    try {
      const url = await uploadImageToCloudinary(file);
      setEditForm((prev) => ({ ...prev, image_url: url }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo subir la imagen';
      setEditUploadError(msg);
    } finally {
      setEditUploadingImage(false);
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!canCreate) return;
    setError(null);
    try {
      await Api.crearCategoria({
        name: form.name,
        image_url: form.image_url,
        description: form.description || undefined,
        multiplicador_local_1: Number(form.multiplicador_local_1 || '1'),
      });
      setForm(emptyForm);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la categoria');
    }
  }

  function openEdit(categoria: Categoria) {
    setError(null);
    setEditUploadError(null);
    setEditingCategory(categoria);
    setEditForm({
      name: categoria.name || '',
      image_url: categoria.image_url || '',
      description: categoria.description || '',
      multiplicador_local_1: String(categoria.multiplicador_local_1 || 1),
    });
  }

  function closeEdit() {
    if (savingEdit) return;
    setEditingCategory(null);
    setEditForm(emptyForm);
    setEditUploadError(null);
  }

  async function onSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingCategory || !canSaveEdit) return;
    setSavingEdit(true);
    setError(null);
    try {
      await Api.actualizarCategoria(editingCategory.id, {
        name: editForm.name,
        description: editForm.description || undefined,
        image_url: editForm.image_url,
        multiplicador_local_1: Number(editForm.multiplicador_local_1 || '1'),
      });
      setEditingCategory(null);
      setEditForm(emptyForm);
      setEditUploadError(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar la categoria');
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Categorias</h2>
      <div className="rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_0_1px_rgba(255,255,255,0.04),0_0_0_1px_rgba(139,92,246,0.15),0_8px_20px_rgba(34,211,238,0.08)] p-4">
        <form onSubmit={onCreate} className="grid grid-cols-1 md:grid-cols-6 gap-2 mb-4">
          {(error || uploadError) && (
            <div className="md:col-span-6 space-y-1">
              {error && <Alert kind="error" message={error} />}
              {uploadError && <Alert kind="error" message={uploadError} />}
            </div>
          )}
          <input className="input-modern text-sm" placeholder="Nombre" value={form.name} onChange={(e)=>setForm({...form, name: e.target.value})} />
          <input className="input-modern text-sm md:col-span-2" placeholder="Descripcion (opcional)" value={form.description} onChange={(e)=>setForm({...form, description: e.target.value})} />
          <input
            className="input-modern text-sm"
            placeholder="Multiplicador Local 1"
            type="number"
            step="0.0001"
            min="0.0001"
            value={form.multiplicador_local_1}
            onChange={(e)=>setForm({...form, multiplicador_local_1: e.target.value})}
          />
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
              onChange={(e)=>setForm({...form, image_url: e.target.value})}
            />
            {uploadingImage && (
              <span className="text-[11px] text-slate-400">Subiendo imagen a Cloudinary...</span>
            )}
          </div>
          <Button disabled={!canCreate} className="md:col-span-6">Crear categoria</Button>
        </form>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-8 text-center text-slate-500">Cargando...</div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="text-left text-slate-400">
                <tr>
                  <th className="py-2">Nombre</th>
                  <th className="py-2">Imagen</th>
                  <th className="py-2">Descripcion</th>
                  <th className="py-2">Local 1</th>
                  <th className="py-2">Acciones</th>
                </tr>
              </thead>
              <tbody className="text-slate-200">
                {categorias.map((c) => (
                  <tr key={c.id} className="border-t border-white/10 hover:bg-white/5">
                    <td className="py-2">{c.name}</td>
                    <td className="py-2">
                      {c.image_url ? (
                        <img src={c.image_url} alt={c.name} className="h-8 w-8 object-cover rounded" />
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="py-2">{c.description || '-'}</td>
                    <td className="py-2">x{Number(c.multiplicador_local_1 || 1).toFixed(2)}</td>
                    <td className="py-2 space-x-2">
                      <button
                        className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 border border-white/20 text-xs"
                        onClick={() => openEdit(c)}
                      >Editar</button>
                      <button
                        className="px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-200 text-xs"
                        onClick={async () => {
                          if (!window.confirm(`Eliminar categoria ${c.name}? (tambien desactiva productos)`)) return;
                          try {
                            await Api.eliminarCategoria(c.id);
                            await load();
                          } catch (e: any) {
                            setError(e?.message || 'No se pudo eliminar la categoria');
                          }
                        }}
                      >Eliminar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <form
            onSubmit={onSaveEdit}
            className="w-full max-w-xl rounded-xl border border-white/10 bg-slate-950 p-4 shadow-2xl space-y-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500">Editar categoria</div>
                <h3 className="text-lg font-semibold text-slate-100">{editingCategory.name}</h3>
              </div>
              <button
                type="button"
                className="px-3 py-1 rounded bg-white/5 border border-white/10 text-sm text-slate-300 hover:bg-white/10 disabled:opacity-50"
                onClick={closeEdit}
                disabled={savingEdit}
              >
                Cerrar
              </button>
            </div>

            {editUploadError && <Alert kind="error" message={editUploadError} />}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-sm">
                <div className="text-slate-400 mb-1">Nombre</div>
                <input
                  className="input-modern text-sm w-full"
                  value={editForm.name}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </label>
              <label className="text-sm">
                <div className="text-slate-400 mb-1">Multiplicador Local 1</div>
                <input
                  className="input-modern text-sm w-full"
                  type="number"
                  step="0.0001"
                  min="0.0001"
                  value={editForm.multiplicador_local_1}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, multiplicador_local_1: e.target.value }))}
                />
              </label>
              <label className="text-sm md:col-span-2">
                <div className="text-slate-400 mb-1">Descripcion</div>
                <textarea
                  className="input-modern text-sm w-full min-h-24 resize-y"
                  value={editForm.description}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                />
              </label>
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-[auto_1fr] gap-3 items-start">
                <div className="h-20 w-20 rounded overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center text-xs text-slate-500">
                  {editForm.image_url ? (
                    <img src={editForm.image_url} alt={editForm.name} className="h-full w-full object-cover" />
                  ) : (
                    'Sin imagen'
                  )}
                </div>
                <div className="space-y-2">
                  <input
                    type="file"
                    accept="image/*"
                    className="input-modern text-sm w-full"
                    onChange={handleEditImageFileChange}
                    disabled={editUploadingImage || savingEdit}
                  />
                  <input
                    className="input-modern text-sm w-full"
                    placeholder="URL imagen"
                    value={editForm.image_url}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, image_url: e.target.value }))}
                  />
                  {editUploadingImage && (
                    <div className="text-xs text-slate-400">Subiendo imagen a Cloudinary...</div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="px-3 py-2 rounded bg-white/5 border border-white/10 text-sm text-slate-300 hover:bg-white/10 disabled:opacity-50"
                onClick={closeEdit}
                disabled={savingEdit}
              >
                Cancelar
              </button>
              <Button disabled={!canSaveEdit || editUploadingImage}>
                {savingEdit ? 'Guardando...' : 'Guardar cambios'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
