import React, { useState, useEffect, useRef, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Package, X, Search, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ProductAutoComplete({
  products,
  onSelect,
  onRemove,
  quantidade = 1,
  onQuantidadeChange,
  subtotal = 0,
  userType,
  autoFocus = false,
  selectedProductData = null
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [qtd, setQtd] = useState(quantidade);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  const selectedProduct = selectedProductData?.product_id
    ? products.find(p => p.id === selectedProductData.product_id) || null
    : null;

  useEffect(() => {
    if (autoFocus && inputRef.current && !selectedProduct) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [autoFocus, selectedProduct]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) &&
          inputRef.current && !inputRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const q = searchTerm.toLowerCase();
    return products.filter(p =>
      p.nome?.toLowerCase().includes(q) ||
      p.cod?.toLowerCase().includes(q) ||
      p.categoria?.toLowerCase().includes(q) ||
      p.subcategoria?.toLowerCase().includes(q)
    ).slice(0, 12);
  }, [searchTerm, products]);

  // Reset highlight when results change
  useEffect(() => {
    setHighlightIndex(-1);
  }, [filteredProducts]);

  const handleSelectProduct = (product) => {
    setSearchTerm("");
    setShowDropdown(false);
    setHighlightIndex(-1);
    if (onSelect) onSelect(product);
  };

  const handleKeyDown = (e) => {
    if (!showDropdown || filteredProducts.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex(prev => (prev + 1) % filteredProducts.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex(prev => prev <= 0 ? filteredProducts.length - 1 : prev - 1);
    } else if (e.key === "Enter" && highlightIndex >= 0) {
      e.preventDefault();
      handleSelectProduct(filteredProducts[highlightIndex]);
    } else if (e.key === "Escape") {
      setShowDropdown(false);
      setHighlightIndex(-1);
    }
  };

  const handleQuantidadeChange = (newQtd) => {
    const valor = parseFloat(newQtd) || 0;
    setQtd(valor);
    if (onQuantidadeChange) onQuantidadeChange(valor);
  };

  const getPreco = (product) => {
    return userType === 'fabricante'
      ? parseFloat(product.preco_fabricante || product.preco_fornecedor || 0)
      : parseFloat(product.preco_fornecedor || 0);
  };

  if (selectedProduct) {
    const currentNome = selectedProductData?.nome ?? selectedProduct.nome;
    const currentPreco = selectedProductData?.preco_unitario ??
      getPreco(selectedProduct);

    const dispatchOverride = (overrides) => {
      if (onSelect) onSelect({
        ...selectedProduct,
        _override: true,
        preco_fornecedor: currentPreco,
        preco_fabricante: currentPreco,
        nome: currentNome,
        ...overrides
      });
    };

    return (
      <div className="flex flex-wrap gap-2 items-center p-3 bg-blue-50 rounded-lg border border-blue-200">
        <Package className="w-4 h-4 text-blue-600 flex-shrink-0" />
        <Input
          value={currentNome}
          onChange={(e) => dispatchOverride({ nome: e.target.value })}
          className="flex-1 min-w-[120px] h-8 text-sm bg-white"
          placeholder="Nome do produto"
        />
        <Input
          type="number"
          step="0.01"
          min="0"
          value={currentPreco}
          onChange={(e) => {
            const novoPreco = parseFloat(e.target.value) || 0;
            dispatchOverride({ preco_fornecedor: novoPreco, preco_fabricante: novoPreco });
          }}
          className="w-28 h-8 text-sm text-right bg-white flex-shrink-0"
          placeholder="Preço unit."
        />
        <Input
          type="number"
          step="1"
          min="1"
          value={qtd}
          onChange={(e) => handleQuantidadeChange(e.target.value)}
          className="w-20 h-8 text-center flex-shrink-0 bg-white"
          placeholder="Qtd"
        />
        <div className="w-24 text-right flex-shrink-0">
          <p className="text-sm font-bold text-green-700">R$ {subtotal.toFixed(2)}</p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onRemove}
          className="hover:bg-red-100 hover:text-red-700 flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </Button>
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
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          onKeyDown={handleKeyDown}
          placeholder={isEmpty
            ? "Nenhum produto disponível na sua tabela..."
            : "Buscar por nome, SKU, categoria... (use ↑↓ e Enter)"
          }
          className={`pl-9 ${isEmpty ? 'bg-gray-50 text-gray-400' : ''}`}
          disabled={isEmpty}
        />
      </div>

      {showDropdown && !isEmpty && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-72 overflow-y-auto"
        >
          {filteredProducts.map((product, idx) => {
            const preco = getPreco(product);
            return (
              <button
                key={product.id}
                onMouseDown={(e) => { e.preventDefault(); handleSelectProduct(product); }}
                onMouseEnter={() => setHighlightIndex(idx)}
                className={`w-full px-4 py-2.5 text-left border-b last:border-b-0 transition-colors ${
                  idx === highlightIndex ? 'bg-blue-50' : 'hover:bg-blue-50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-mono font-semibold text-gray-700">{product.cod}</span>
                      {product.categoria && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                          {product.categoria}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-900 truncate mt-0.5">{product.nome}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400">{product.und || 'un'}</span>
                      {product.peso_kg && (
                        <span className="text-xs text-gray-400">{product.peso_kg}kg</span>
                      )}
                      {product.fabricante_nome && (
                        <span className="text-xs text-gray-400 truncate">{product.fabricante_nome}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-green-700 whitespace-nowrap">
                      R$ {preco.toFixed(2)}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}

          {showDropdown && searchTerm.trim() && filteredProducts.length === 0 && (
            <div className="p-4 text-center">
              <p className="text-sm text-gray-500">
                Nenhum produto encontrado para "<strong>{searchTerm}</strong>"
              </p>
            </div>
          )}

          {showDropdown && !searchTerm.trim() && (
            <div className="p-4 text-center">
              <p className="text-sm text-gray-400">Digite para buscar produtos...</p>
            </div>
          )}
        </div>
      )}

      {isEmpty && (
        <div className="mt-1 flex items-center gap-2 text-xs text-amber-600">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>Você precisa adicionar produtos à sua tabela primeiro. Acesse o <strong>Catálogo Geral</strong>.</span>
        </div>
      )}
    </div>
  );
}