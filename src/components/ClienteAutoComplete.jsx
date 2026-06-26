import React, { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { User, MapPin } from "lucide-react";

/**
 * Busca inteligente de cliente: encontra por nome (qualquer parte), CNPJ/CPF ou cidade.
 */
export default function ClienteAutoComplete({ clientes = [], value, onSelect, placeholder = "Buscar cliente por nome, CNPJ ou cidade..." }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Sincronizar label quando value mudar externamente
  useEffect(() => {
    if (!value) { setSearch(""); return; }
    const c = clientes.find(c => c.id === value);
    if (c) setSearch(c.nome);
  }, [value, clientes]);

  useEffect(() => {
    const handler = (e) => {
      if (!dropdownRef.current?.contains(e.target) && !inputRef.current?.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const normalize = (s) => (s || "").toLowerCase().replace(/[.\-/\s]/g, "");

  const filtered = search.trim().length === 0
    ? clientes.slice(0, 12)
    : clientes.filter(c => {
        const q = normalize(search);
        return (
          normalize(c.nome).includes(q) ||
          normalize(c.cpf_cnpj).includes(q) ||
          normalize(c.cidade).includes(q) ||
          normalize(c.email).includes(q)
        );
      }).slice(0, 12);

  const handleSelect = (cliente) => {
    setSearch(cliente.nome);
    setOpen(false);
    onSelect(cliente.id);
  };

  const handleClear = () => {
    setSearch("");
    setOpen(true);
    onSelect("");
    inputRef.current?.focus();
  };

  const highlightMatch = (text, query) => {
    if (!query.trim()) return text;
    const idx = (text || "").toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-yellow-200 text-yellow-900 rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
        {text.slice(idx + query.length)}
      </>
    );
  };

  return (
    <div className="relative">
      <div className="relative">
        <User className="absolute left-3 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
        <Input
          ref={inputRef}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="pl-9 pr-8"
        />
        {search && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-2 text-gray-400 hover:text-gray-600 text-lg leading-none"
          >×</button>
        )}
      </div>

      {open && filtered.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-72 overflow-y-auto"
        >
          {filtered.map((cliente) => (
            <button
              key={cliente.id}
              type="button"
              onMouseDown={() => handleSelect(cliente)}
              className="w-full text-left px-4 py-2.5 hover:bg-blue-50 border-b last:border-b-0 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {highlightMatch(cliente.nome, search)}
                  </p>
                  <div className="flex flex-wrap gap-x-3 mt-0.5">
                    {cliente.cpf_cnpj && (
                      <span className="text-xs text-gray-500">{highlightMatch(cliente.cpf_cnpj, search)}</span>
                    )}
                    {cliente.telefone && (
                      <span className="text-xs text-gray-400">{cliente.telefone}</span>
                    )}
                  </div>
                </div>
                {cliente.cidade && (
                  <div className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
                    <MapPin className="w-3 h-3" />
                    <span>{highlightMatch(cliente.cidade, search)}{cliente.estado ? `/${cliente.estado}` : ""}</span>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {open && search.trim().length > 0 && filtered.length === 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl p-4 text-center"
        >
          <p className="text-sm text-gray-500">Nenhum cliente encontrado para "<strong>{search}</strong>"</p>
        </div>
      )}

      {open && clientes.length === 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl p-4 text-center"
        >
          <User className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500 mb-1">Nenhum cliente cadastrado</p>
          <p className="text-xs text-gray-400">Cadastre clientes na página de Clientes para usá-los aqui.</p>
        </div>
      )}
    </div>
  );
}