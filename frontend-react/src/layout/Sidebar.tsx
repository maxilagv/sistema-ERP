import { NavLink } from 'react-router-dom';
import { BarChart3, Boxes, Settings, Users, Package, Home, Tag } from 'lucide-react';
import { motion } from 'framer-motion';

const navItems = [
  { to: '/app/dashboard', label: 'Dashboard', icon: Home },
  { to: '/app/clientes', label: 'Clientes', icon: Users },
  { to: '/app/productos', label: 'Productos', icon: Package },
  { to: '/app/categorias', label: 'Categorías', icon: Tag },
  { to: '/app/stock', label: 'Stock', icon: Boxes },
  { to: '/app/finanzas', label: 'Finanzas', icon: BarChart3 },
  { to: '/app/configuracion', label: 'Configuración', icon: Settings },
];

export default function Sidebar({ collapsed }: { collapsed?: boolean }) {
  return (
    <motion.aside
      animate={{ width: collapsed ? 80 : 256 }}
      transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      className={`h-full bg-white/5 backdrop-blur-md text-slate-200 border-r border-white/10 flex flex-col`}
      style={{ overflow: 'hidden' }}
    >
      <div className="h-16 flex items-center gap-3 px-5 border-b border-white/10">
        <div className="w-9 h-9 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">TC</div>
        {!collapsed && (
          <div>
            <div className="text-sm font-semibold">Tecnocel</div>
            <div className="text-[11px] text-slate-400">v1.0.0</div>
          </div>
        )}
      </div>

      <nav className="p-3 space-y-1 flex-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => [
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm',
              isActive ? 'bg-primary-500/15 text-white border border-primary-500/25' : 'hover:bg-white/10 text-slate-300 hover:text-white',
            ].join(' ')}
          >
            <Icon size={18} />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-slate-800 text-slate-400 text-sm">
        {!collapsed && <div>Acceso restringido</div>}
      </div>
    </motion.aside>
  );
}


