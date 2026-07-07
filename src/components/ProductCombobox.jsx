import React, { useState, useEffect, useRef, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Search, X, Package } from "lucide-react";

// Seletor unico de produto com busca. Reutilizavel em Vendas, PedidosVenda, etc.
// Resiliente a duas formas de produto: template ({nome, cod}) e SupplierProduct
// enriquecido ({product_name, product_cod}).
export default function ProductCombobox({
  products = [],
  value,
  onSelect,
  placeholder = "Buscar produto por nome, SKU, categoria...",
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const inputRef = useRef(null);
  const boxRef = useRef(null);

  const getLabel = (p) => p?.nome || p?.product_name || p?.cod || p?.product_cod || "";
  const getCod = (p) => p?.cod || p?.product_cod || "";
  const getPrice = (p) => Number(p?.preco ?? p?.preco_fornecedor ?? p?.preco_fabricante ?? 0);

  const selected = value ? products.find((p) => p.id === value) : null;

  useEffect(() => {
    const onClick = (e) => {
      if (
        boxRef.current && !boxRef.current.contains(e.target) &&
        inputRef.current && !inputRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const base = q
      ? products.filter((p) =>
          getLabel(p).toLowerCase().includes(q) ||
          getCod(p).toLowerCase().includes(q) ||
          (p.categoria || "").toLowerCase().includes(q) ||
          (p.subcategoria || "").toLowerCase().includes(q) ||
          (p.fabricante_nome || "").toLowerCase().includes(q)
        )
      : products;
    const sorted = [...base].sort((a, b) => {
      const c = (a.categoria || "").localeCompare(b.categoria || "");
      if (c !== 0) return c;
      return getLabel(a).localeCompare(getLabel(b));
    });
    return sorted.slice(0, 500);
  }, [searchTerm, products]);

  useEffect(() => setHighlight(-1), [filtered]);

  const choose = (p) => {
    if (onSelect) onSelect(p);
    setSearchTerm("");
    setOpen(false);
    setHighlight(-1);
  };

  const onKeyDown = (e) => {
    if (!open || filtered.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((i) => (i + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((i) => (i <= 0 ? filtered.length - 1 : i - 1));
    } else if (e.key === "Enter" && highlight >= 0) {
      e.preventDefault();
      choose(filtered[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  if (selected && !open) {
    return (
      <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
        <Package className="w-4 h-4 text-blue-600 flex-shrink-0" />
        <span className="flex-1 text-sm truncate">
          {getLabel(selected)}{getCod(selected) ? ` (${getCod(selected)})` : ""}
        </span>
        <button
          type="button"
          onClick={() => onSelect && onSelect(null)}
          className="text-gray-400 hover:text-red-600"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const isEmpty = products.length === 0;

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
        <Input
          ref={inputRef}
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={isEmpty ? "Nenhum produto na tabela..." : placeholder}
          className="pl-9"
          disabled={isEmpty}
        />
      </div>

      {open && !isEmpty && (
        <div
          ref={boxRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-72 overflow-y-auto"
        >
          {filtered.map((p, idx) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                choose(p);
              }}
              onMouseEnter={() => setHighlight(idx)}
              className={`w-full px-3 py-2 text-left border-b last:border-b-0 ${
                idx === highlight ? "bg-blue-50" : "hover:bg-blue-50"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  {getCod(p) && (
                    <span className="text-xs font-mono text-gray-500 mr-2">{getCod(p)}</span>
                  )}
                  <span className="text-sm text-gray-900">{getLabel(p)}</span>
                  {p.fabricante_nome && (
                    <span className="block text-xs text-gray-400 truncate">{p.fabricante_nome}</span>
                  )}
                </div>
                <span className="text-sm font-semibold text-green-700 whitespace-nowrap">
                  R$ {getPrice(p).toFixed(2)}
                </span>
              </div>
            </button>
          ))}

          {searchTerm.trim() && filtered.length === 0 && (
            <div className="p-3 text-center text-sm text-gray-500">
              Nenhum produto encontrado para "{searchTerm}"
            </div>
          )}

          {!searchTerm.trim() && products.length > 500 && (
            <div className="p-3 text-center border-t bg-gray-50">
              <p className="text-xs text-gray-400">
                Mostrando os primeiros 500 — digite para filtrar todos os {products.length}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
