import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Api } from '../lib/api';
import Skeleton from '../ui/Skeleton';
import { useClientAuth } from '../context/ClientAuthContext';

type CatalogoConfig = {
  nombre?: string;
  logo_url?: string;
  destacado_producto_id?: number | null;
};

type Categoria = {
  id: number;
  name: string;
  image_url?: string | null;
  description?: string | null;
};

type Producto = {
  id: number;
  category_id: number;
  category_name?: string | null;
  name: string;
  description?: string | null;
  image_url?: string | null;
  price?: number | null;
  precio_final?: number | null;
};

type CatalogoData = {
  config?: CatalogoConfig;
  destacado?: Producto | null;
  categorias?: Categoria[];
  productos?: Producto[];
};

type CarritoItem = {
  item_id: number;
  producto_id: number;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  producto_nombre: string;
  image_url?: string | null;
};

type CarritoData = {
  carrito_id: number;
  items: CarritoItem[];
  total: number;
  total_items: number;
};

export default function CatalogoPublico() {
  const { isAuthenticated } = useClientAuth();
  const [data, setData] = useState<CatalogoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartBusy, setCartBusy] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);
  const [checkoutOk, setCheckoutOk] = useState<string | null>(null);
  const [cart, setCart] = useState<CarritoData | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState(0);
  const productsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await Api.catalogoPublico();
        if (!mounted) return;
        setData(res as CatalogoData);
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

  async function refreshCart() {
    if (!isAuthenticated) {
      setCart(null);
      return;
    }
    try {
      const payload = (await Api.clienteCarrito()) as CarritoData;
      setCart(payload);
    } catch (e: any) {
      setCartError(e?.message || 'No se pudo obtener el carrito');
    }
  }

  useEffect(() => {
    refreshCart();
  }, [isAuthenticated]);

  async function addToCart(productoId: number) {
    if (!isAuthenticated) {
      window.location.href = '/cliente/login';
      return;
    }
    setCartBusy(true);
    setCartError(null);
    setCheckoutOk(null);
    try {
      const payload = (await Api.clienteCarritoAdd({
        producto_id: productoId,
        cantidad: 1,
      })) as CarritoData;
      setCart(payload);
      setCartOpen(true);
    } catch (e: any) {
      setCartError(e?.message || 'No se pudo agregar al carrito');
    } finally {
      setCartBusy(false);
    }
  }

  async function updateCartItem(itemId: number, cantidad: number) {
    setCartBusy(true);
    setCartError(null);
    setCheckoutOk(null);
    try {
      const payload = (await Api.clienteCarritoUpdate(itemId, {
        cantidad,
      })) as CarritoData;
      setCart(payload);
    } catch (e: any) {
      setCartError(e?.message || 'No se pudo actualizar el carrito');
    } finally {
      setCartBusy(false);
    }
  }

  async function removeCartItem(itemId: number) {
    setCartBusy(true);
    setCartError(null);
    setCheckoutOk(null);
    try {
      const payload = (await Api.clienteCarritoRemove(itemId)) as CarritoData;
      setCart(payload);
    } catch (e: any) {
      setCartError(e?.message || 'No se pudo quitar el item');
    } finally {
      setCartBusy(false);
    }
  }

  async function clearCart() {
    setCartBusy(true);
    setCartError(null);
    setCheckoutOk(null);
    try {
      const payload = (await Api.clienteCarritoClear()) as CarritoData;
      setCart(payload);
    } catch (e: any) {
      setCartError(e?.message || 'No se pudo vaciar el carrito');
    } finally {
      setCartBusy(false);
    }
  }

  async function checkout() {
    setCartBusy(true);
    setCartError(null);
    setCheckoutOk(null);
    try {
      const payload: any = await Api.clienteCheckout();
      setCheckoutOk(`Pedido generado correctamente. Venta #${payload?.venta_id}.`);
      await refreshCart();
    } catch (e: any) {
      setCartError(e?.message || 'No se pudo generar el pedido');
    } finally {
      setCartBusy(false);
    }
  }

  const categories = data?.categorias || [];
  const products = data?.productos || [];

  const productsByCategory = useMemo(() => {
    const map = new Map<number, Producto[]>();
    for (const p of products) {
      const list = map.get(p.category_id) || [];
      list.push(p);
      map.set(p.category_id, list);
    }
    return map;
  }, [products]);

  const filteredCategories = useMemo(() => {
    if (!activeCategoryId) return categories;
    return categories.filter((c) => c.id === activeCategoryId);
  }, [categories, activeCategoryId]);

  function selectCategory(id: number) {
    setActiveCategoryId(id);
    setMenuOpen(false);
    if (productsRef.current) {
      productsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  const hasProductsForFilter = useMemo(() => {
    if (!filteredCategories.length) return false;
    return filteredCategories.some((cat) => (productsByCategory.get(cat.id) || []).length > 0);
  }, [filteredCategories, productsByCategory]);

  const config = data?.config || {};

  if (loading) {
    return (
      <div className="catalogo-root">
        <div className="catalogo-ambient" aria-hidden="true">
          <span className="catalogo-orb orb-a" />
          <span className="catalogo-orb orb-b" />
          <span className="catalogo-orb orb-c" />
        </div>
        <div className="catalogo-container">
          <header className="catalogo-header">
            <div className="catalogo-brand">
              <Skeleton className="h-12 w-12" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          </header>
          <main className="catalogo-main">
            <div className="catalogo-hero">
              <div className="space-y-4">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-10 w-72" />
                <Skeleton className="h-4 w-64" />
                <Skeleton className="h-12 w-36" />
              </div>
              <Skeleton className="h-56 w-full" />
            </div>
            <div className="catalogo-chips">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-24" />
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-64" />
              ))}
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="catalogo-root catalogo-error">
        <div>{error}</div>
      </div>
    );
  }

  return (
    <div className="catalogo-root">
      <div className="catalogo-ambient" aria-hidden="true">
        <span className="catalogo-orb orb-a" />
        <span className="catalogo-orb orb-b" />
        <span className="catalogo-orb orb-c" />
      </div>
      <div className="catalogo-container">
        <header className="catalogo-header">
          <div className="catalogo-brand">
            {config.logo_url ? (
              <img
                src={config.logo_url}
                alt={config.nombre || 'Catalogo'}
                className="catalogo-logo"
              />
            ) : (
              <div className="catalogo-logo catalogo-logo-fallback">LOGO</div>
            )}
            <div>
              <div className="catalogo-title">
                {config.nombre || 'Catalogo'}
              </div>
              <div className="catalogo-subtitle">
                Tecnologia lista para entregar hoy
              </div>
            </div>
          </div>

          <div className="catalogo-actions">
            {isAuthenticated ? (
              <>
                <a className="catalogo-link" href="/cliente/portal">
                  Mi portal
                </a>
                <button
                  type="button"
                  className="catalogo-cta"
                  onClick={() => setCartOpen(true)}
                >
                  Carrito ({cart?.total_items || 0})
                </button>
              </>
            ) : (
              <>
                <a className="catalogo-link" href="/cliente/login">
                  Ingresar
                </a>
                <a className="catalogo-cta" href="/cliente/registro">
                  Crear cuenta
                </a>
              </>
            )}
            <button

              type="button"
              className={`catalogo-hamburger ${menuOpen ? 'open' : ''}`}
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-label="Abrir menu de categorias"
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </header>

        <main className="catalogo-main">
          <section className="catalogo-hero">
            <div className="catalogo-hero-text">
              <div className="catalogo-eyebrow">Catalogo premium</div>
              <h1>
                Equipos que se venden solos,
                <span className="catalogo-highlight"> listos para cotizar.</span>
              </h1>
              <p className="catalogo-muted">
                Explora las categorias y compara specs reales. Cada producto muestra el
                precio final y sus detalles clave para decidir rapido.
              </p>
              <div className="catalogo-hero-actions">
                <button
                  type="button"
                  className="catalogo-cta"
                  onClick={() => {
                    if (productsRef.current) {
                      productsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }}
                >
                  Ver novedades
                </button>
                <button
                  type="button"
                  className="catalogo-secondary"
                  onClick={() => selectCategory(0)}
                >
                  Ver todas las categorias
                </button>
              </div>
            </div>
            {data?.destacado && (
              <motion.div
                className="catalogo-hero-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <div className="catalogo-card-label">Producto destacado</div>
                {data.destacado.image_url ? (
                  <img
                    src={data.destacado.image_url}
                    alt={data.destacado.name}
                    className="catalogo-hero-image"
                  />
                ) : (
                  <div className="catalogo-hero-image catalogo-image-fallback">Sin imagen</div>
                )}
                <div className="catalogo-hero-info">
                  <div className="catalogo-hero-name">{data.destacado.name}</div>
                  <div className="catalogo-hero-desc">
                    {data.destacado.description || 'Disenado para vender mas rapido.'}
                  </div>
                  <div className="catalogo-price">
                    ${
                      data.destacado.precio_final != null
                        ? data.destacado.precio_final.toFixed(2)
                        : data.destacado.price != null
                          ? data.destacado.price.toFixed(2)
                          : '0.00'
                    }
                  </div>
                </div>
              </motion.div>
            )}
          </section>

          <div className="catalogo-chips">
            <button
              type="button"
              className={`catalogo-chip ${activeCategoryId === 0 ? 'active' : ''}`}
              onClick={() => selectCategory(0)}
            >
              Todo
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`catalogo-chip ${activeCategoryId === cat.id ? 'active' : ''}`}
                onClick={() => selectCategory(cat.id)}
              >
                {cat.name}
              </button>
            ))}
          </div>

          <div ref={productsRef} className="space-y-10">
            {filteredCategories.map((cat) => {
              const list = productsByCategory.get(cat.id) || [];
              if (!list.length) return null;
              return (
                <section key={cat.id} className="space-y-4">
                  <div className="catalogo-section-title">
                    <div>
                      <div className="catalogo-section-name">{cat.name}</div>
                      {cat.description && (
                        <div className="catalogo-muted text-sm">{cat.description}</div>
                      )}
                    </div>
                    <span className="catalogo-count">{list.length} productos</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {list.map((p, index) => (
                      <motion.article
                        key={p.id}
                        className="catalogo-card"
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, amount: 0.3 }}
                        transition={{ duration: 0.35, delay: index * 0.03 }}
                      >
                        <div className="catalogo-card-image">
                          {p.image_url ? (
                            <img src={p.image_url} alt={p.name} />
                          ) : (
                            <div className="catalogo-image-fallback">Sin imagen</div>
                          )}
                        </div>
                        <div className="catalogo-card-body">
                          <div className="catalogo-card-name">{p.name}</div>
                          {p.description && (
                            <div className="catalogo-card-desc">{p.description}</div>
                          )}
                          <div className="catalogo-card-footer">
                            <div className="catalogo-price">
                              ${
                                p.precio_final != null
                                  ? p.precio_final.toFixed(2)
                                  : p.price != null
                                    ? p.price.toFixed(2)
                                    : '0.00'
                              }
                            </div>
                            <button
                              type="button"
                              className="catalogo-badge"
                              onClick={() => addToCart(p.id)}
                              disabled={cartBusy}
                            >
                              Agregar
                            </button>
                          </div>
                        </div>
                      </motion.article>
                    ))}
                  </div>
                </section>
              );
            })}
            {!filteredCategories.length && (
              <div className="catalogo-empty">No hay productos para esta categoria.</div>
            )}
          </div>
        </main>

        <footer className="catalogo-footer">
          <div>Catalogo publico siempre visible.</div>
          <div>Actualizado desde el ERP.</div>
        </footer>

        {isAuthenticated && (
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="fixed bottom-5 right-5 z-30 rounded-full px-4 py-3 bg-indigo-600 text-white shadow-lg hover:bg-indigo-500"
          >
            Carrito ({cart?.total_items || 0})
          </button>
        )}
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.aside
            className="catalogo-menu"
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            <div className="catalogo-menu-header">
              <div>
                <div className="catalogo-menu-title">Categorias</div>
                <div className="catalogo-muted text-xs">Filtra con un toque</div>
              </div>
              <button
                type="button"
                className="catalogo-menu-close"
                onClick={() => setMenuOpen(false)}
              >
                Cerrar
              </button>
            </div>
            <div className="catalogo-menu-list">
              <button
                type="button"
                className={`catalogo-menu-item ${activeCategoryId === 0 ? 'active' : ''}`}
                onClick={() => selectCategory(0)}
              >
                Todo
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`catalogo-menu-item ${activeCategoryId === cat.id ? 'active' : ''}`}
                  onClick={() => selectCategory(cat.id)}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {cartOpen && (
          <motion.div
            className="fixed inset-0 z-40 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setCartOpen(false)}
          >
            <motion.aside
              className="absolute right-0 top-0 h-full w-full max-w-md bg-slate-950 border-l border-slate-800 p-4 flex flex-col"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Tu carrito</h3>
                <button
                  type="button"
                  className="text-slate-400 hover:text-slate-200"
                  onClick={() => setCartOpen(false)}
                >
                  Cerrar
                </button>
              </div>

              {cartError && (
                <div className="mb-2 rounded border border-red-700 bg-red-950/50 text-red-200 px-2 py-1 text-xs">
                  {cartError}
                </div>
              )}
              {checkoutOk && (
                <div className="mb-2 rounded border border-emerald-700 bg-emerald-950/50 text-emerald-200 px-2 py-1 text-xs">
                  {checkoutOk}
                </div>
              )}

              {!isAuthenticated && (
                <div className="rounded border border-slate-700 bg-slate-900 p-3 text-sm text-slate-300">
                  Inicia sesion para usar el carrito y generar pedidos.
                </div>
              )}

              {isAuthenticated && (
                <>
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                    {(cart?.items || []).length === 0 && (
                      <div className="text-sm text-slate-500 py-8 text-center">Tu carrito esta vacio.</div>
                    )}
                    {(cart?.items || []).map((item) => (
                      <div key={item.item_id} className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                        <div className="text-sm font-medium">{item.producto_nombre}</div>
                        <div className="text-xs text-slate-400 mb-2">${item.precio_unitario.toFixed(2)} c/u</div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="px-2 py-1 text-xs bg-slate-800 rounded"
                            onClick={() => updateCartItem(item.item_id, Math.max(0, item.cantidad - 1))}
                            disabled={cartBusy}
                          >
                            -
                          </button>
                          <span className="text-sm min-w-[20px] text-center">{item.cantidad}</span>
                          <button
                            type="button"
                            className="px-2 py-1 text-xs bg-slate-800 rounded"
                            onClick={() => updateCartItem(item.item_id, item.cantidad + 1)}
                            disabled={cartBusy}
                          >
                            +
                          </button>
                          <span className="ml-auto text-sm">${item.subtotal.toFixed(2)}</span>
                          <button
                            type="button"
                            className="text-xs px-2 py-1 rounded bg-red-800 text-white"
                            onClick={() => removeCartItem(item.item_id)}
                            disabled={cartBusy}
                          >
                            Quitar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-3 border-t border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Total</span>
                      <span className="font-semibold">${Number(cart?.total || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="flex-1 px-3 py-2 rounded bg-slate-800 text-sm"
                        onClick={clearCart}
                        disabled={cartBusy || (cart?.items || []).length === 0}
                      >
                        Vaciar
                      </button>
                      <button
                        type="button"
                        className="flex-1 px-3 py-2 rounded bg-indigo-600 text-sm text-white"
                        onClick={checkout}
                        disabled={cartBusy || (cart?.items || []).length === 0}
                      >
                        {cartBusy ? 'Procesando...' : 'Confirmar pedido'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
