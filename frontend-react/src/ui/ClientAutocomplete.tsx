import { useState, useEffect, useRef } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { Api } from '../lib/api';

type Client = {
    id: number;
    nombre: string;
    apellido?: string | null;
    cuit_cuil?: string | null;
    tipo_cliente?: string | null;
    email?: string | null;
};

interface ClientAutocompleteProps {
    value: number | '' | null;
    onChange: (clientId: number | '') => void;
    className?: string;
}

export default function ClientAutocomplete({ value, onChange, className }: ClientAutocompleteProps) {
    const [open, setOpen] = useState(false);
    const [term, setTerm] = useState('');
    const [options, setOptions] = useState<Client[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);

    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Close when clicking outside
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Fetch initial selected client if value exists
    useEffect(() => {
        if (value && typeof value === 'number') {
            if (selectedClient && selectedClient.id === value) {
                // Already have correct client
                const fullName = `${selectedClient.nombre} ${selectedClient.apellido || ''}`.trim();
                if (term !== fullName) setTerm(fullName);
            } else {
                // Need to fetch
                Api.cliente(value)
                    .then((c: any) => {
                        if (c && c.id) {
                            const client = c as Client;
                            setSelectedClient(client);
                            setTerm(`${client.nombre} ${client.apellido || ''}`.trim());
                        }
                    })
                    .catch(() => {
                        // Silent fail or retry
                    });
            }
        } else {
            // Only clear if we really assume control. 
            // If value is cleared externally, we clear.
            if (value === '' || value === null) {
                setSelectedClient(null);
                setTerm('');
            }
        }
    }, [value]);

    // Debounced search
    useEffect(() => {
        const t = term.trim();
        if (!t) {
            setOptions([]);
            return;
        }

        // Check if term matches the currently selected client preventing re-search on selection
        if (selectedClient && (
            t === selectedClient.nombre ||
            t === `${selectedClient.nombre} ${selectedClient.apellido || ''}`.trim()
        )) {
            return;
        }

        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const res = await Api.clientes({ q: t, limit: 20 });
                setOptions((res as Client[]) || []);
                if (!open) setOpen(true);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [term]);

    const handleSelect = (client: Client) => {
        setSelectedClient(client);
        setTerm(`${client.nombre} ${client.apellido || ''}`.trim());
        onChange(client.id);
        setOpen(false);
    };

    const handleClear = () => {
        setSelectedClient(null);
        setTerm('');
        onChange('');
        setOptions([]);
        inputRef.current?.focus();
    };

    return (
        <div className={`relative ${className}`} ref={wrapperRef}>
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    placeholder="Buscar cliente..."
                    className="w-full bg-white/10 border border-white/10 rounded px-2 py-1 text-sm pl-8 pr-8 focus:outline-none focus:border-white/30 transition-colors"
                    value={term}
                    onChange={(e) => {
                        setTerm(e.target.value);
                        if (!open) setOpen(true);
                        if (selectedClient && e.target.value !== `${selectedClient.nombre} ${selectedClient.apellido || ''}`.trim()) {
                            setSelectedClient(null); // Deselect if user modifies name
                            onChange('');
                        }
                    }}
                    onFocus={() => {
                        if (term) setOpen(true);
                    }}
                />
                <Search className="absolute left-2 top-1.5 text-slate-400" size={16} />
                {loading && (
                    <Loader2 className="absolute right-2 top-1.5 text-slate-400 animate-spin" size={16} />
                )}
                {!loading && term && (
                    <button
                        onClick={handleClear}
                        className="absolute right-2 top-1.5 text-slate-400 hover:text-white"
                    >
                        <X size={16} />
                    </button>
                )}
            </div>

            {open && options.length > 0 && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {options.map(client => (
                        <button
                            key={client.id}
                            onClick={() => handleSelect(client)}
                            className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-white/10 border-b border-white/5 last:border-0 transition-colors"
                        >
                            <div className="font-medium">
                                {client.nombre} {client.apellido}
                                {client.cuit_cuil && <span className="text-slate-500 text-xs ml-2">({client.cuit_cuil})</span>}
                            </div>
                            {(client.tipo_cliente || client.email) && (
                                <div className="text-xs text-slate-500">
                                    {client.tipo_cliente} {client.email ? `- ${client.email}` : ''}
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            )}

            {open && term && !loading && options.length === 0 && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-md shadow-lg p-2 text-center text-sm text-slate-400">
                    No se encontraron clientes
                </div>
            )}
        </div>
    );
}
