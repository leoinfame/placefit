import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Search,
  X,
  Package,
  Clock,
  TrendingUp,
  ArrowRight,
  CornerDownLeft,
  ChevronUp,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  searchProducts,
  suggestCorrections,
  highlightMatches,
  tokenize,
} from "@/utils/marketplaceSearch";

const RECENT_KEY = "marketplace_recent_searches";
const MAX_RECENT = 6;
const DEBOUNCE_MS = 150;

export default function MarketplaceSearch({
  products,
  onSelectProduct,
  getProductPrices,
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState([]);
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const debounceTimer = useRef(null);

  // Carregar buscas recentes
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_KEY);
      if (stored) setRecentSearches(JSON.parse(stored));
    } catch (e) {}
  }, []);

  // Debounce
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedQuery(query);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query]);

  // Resultados da busca
  const results = useMemo(() => {
    if (!debouncedQuery.trim()) return [];
    return searchProducts(products, debouncedQuery);
  }, [products, debouncedQuery]);

  // Sugestões "Você quis dizer?"
  const corrections = useMemo(() => {
    if (!debouncedQuery.trim() || results.length > 0) return [];
    return suggestCorrections(products, debouncedQuery);
  }, [products, debouncedQuery, results]);

  // Categorias populares (para chips quando vazio)
  const popularCategories = useMemo(() => {
    const counts = {};
    products.forEach((p) => {
      if (p.categoria) counts[p.categoria] = (counts[p.categoria] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([cat]) => cat);
  }, [products]);

  // Reset highlight quando resultados mudam
  useEffect(() => {
    setHighlightIndex(0);
  }, [debouncedQuery]);

  // Click outside para fechar
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const saveRecentSearch = useCallback((term) => {
    if (!term.trim() || term.trim().length < 2) return;
    setRecentSearches((prev) => {
      const filtered = prev.filter((s) => s.toLowerCase() !== term.toLowerCase());
      const updated = [term, ...filtered].slice(0, MAX_RECENT);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  }, []);

  const handleSelect = useCallback(
    (product) => {
      saveRecentSearch(query);
      onSelectProduct(product);
      setQuery("");
      setDebouncedQuery("");
      setIsOpen(false);
      inputRef.current?.blur();
    },
    [query, onSelectProduct, saveRecentSearch]
  );

  const handleKeyDown = (e) => {
    if (!isOpen) return;
    const max = Math.min(results.length, 10) - 1;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => (i >= max ? 0 : i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => (i <= 0 ? max : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results.length > 0 && results[highlightIndex]) {
        handleSelect(results[highlightIndex]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const clearSearch = () => {
    setQuery("");
    setDebouncedQuery("");
    inputRef.current?.focus();
  };

  const applyCorrection = (corrections) => {
    const tokens = tokenize(query);
    let newQuery = query;
    corrections.forEach((c) => {
      newQuery = newQuery.replace(new RegExp(c.from, "gi"), c.to);
    });
    setQuery(newQuery);
  };

  const hasQuery = debouncedQuery.trim().length > 0;
  const showResults = isOpen && hasQuery;
  const showSuggestions = isOpen && !hasQuery;
  const visibleResults = results.slice(0, 10);

  return (
    <div className="mb-8" ref={containerRef}>
      <div className="max-w-3xl mx-auto">
        <div className="relative">
          {/* Input */}
          <div className="relative">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 z-10 pointer-events-none" />
            <Input
              ref={inputRef}
              placeholder="Busque por nome, código, categoria... (ex: anilha olimpica 5)"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              onKeyDown={handleKeyDown}
              className="w-full pl-14 pr-24 py-6 text-base rounded-2xl border-2 border-gray-200 focus:border-blue-500 shadow-lg hover:shadow-xl transition-all"
              autoComplete="off"
            />
            {query && (
              <button
                onClick={clearSearch}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
                aria-label="Limpar busca"
              >
                <X className="h-5 w-5 text-gray-400" />
              </button>
            )}
          </div>

          {/* Dropdown */}
          {showResults && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 max-h-[480px] overflow-hidden flex flex-col">
              {/* Cabeçalho com contagem */}
              <div className="px-5 py-3 border-b bg-gray-50 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500">
                  {results.length > 0
                    ? `${results.length} ${results.length === 1 ? "resultado" : "resultados"}`
                    : "Nenhum resultado"}
                </span>
                {results.length > 10 && (
                  <span className="text-xs text-gray-400">
                    Mostrando os 10 mais relevantes
                  </span>
                )}
              </div>

              {results.length === 0 ? (
                <div className="p-6">
                  {/* "Você quis dizer?" */}
                  {corrections.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-600 mb-2 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-amber-500" />
                        Você quis dizer:
                      </p>
                      <button
                        onClick={() => applyCorrection(corrections)}
                        className="text-blue-600 hover:text-blue-700 font-medium text-sm underline underline-offset-2"
                      >
                        {corrections.map((c) => c.to).join(" ")}
                      </button>
                    </div>
                  )}
                  <div className="text-center py-4">
                    <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">
                      Nenhum produto encontrado para "{debouncedQuery}"
                    </p>
                    <p className="text-gray-400 text-xs mt-1">
                      Tente buscar por categoria (ex: "anilhas", "halteres") ou
                      pelo código do produto
                    </p>
                  </div>
                </div>
              ) : (
                <div className="overflow-y-auto flex-1">
                  {visibleResults.map((product, index) => {
                    const prices = getProductPrices(product.id);
                    const isHighlighted = index === highlightIndex;
                    return (
                      <button
                        key={product.id}
                        onClick={() => handleSelect(product)}
                        onMouseEnter={() => setHighlightIndex(index)}
                        className={`w-full text-left p-4 border-b last:border-b-0 transition-colors flex items-center gap-4 ${
                          isHighlighted ? "bg-blue-50" : "hover:bg-gray-50"
                        }`}
                      >
                        {/* Foto ou ícone */}
                        <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {product.foto ? (
                            <img
                              src={product.foto}
                              alt={product.nome}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <Package className="w-6 h-6 text-gray-400" />
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p
                            className="font-semibold text-gray-900 text-sm leading-snug"
                            dangerouslySetInnerHTML={{
                              __html: highlightMatches(product.nome, debouncedQuery),
                            }}
                          />
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <Badge variant="outline" className="text-[10px] py-0">
                              {product.cod}
                            </Badge>
                            <Badge variant="secondary" className="text-[10px] py-0">
                              {product.categoria}
                            </Badge>
                            {product.templates?.length > 1 && (
                              <Badge variant="outline" className="text-[10px] py-0">
                                {product.templates.length} pesos
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Preço / status */}
                        <div className="text-right flex-shrink-0">
                          {prices.length > 0 ? (
                            <>
                              <p className="text-xs text-gray-400">
                                {prices.length}{" "}
                                {prices.length === 1 ? "fornecedor" : "fornecedores"}
                              </p>
                              {prices[0].price !== null && (
                                <p className="text-sm font-bold text-green-600">
                                  a partir de R$ {prices[0].price.toFixed(2)}{prices[0].perKg && <span className="text-xs font-medium text-gray-500">/kg</span>}
                                </p>
                              )}
                            </>
                          ) : (
                            <p className="text-xs text-gray-400">Ver detalhes</p>
                          )}
                          <ArrowRight
                            className={`w-4 h-4 mt-1 ml-auto transition-transform ${
                              isHighlighted
                                ? "text-blue-600 translate-x-1"
                                : "text-gray-300"
                            }`}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Rodapé com dica de teclado */}
              <div className="px-5 py-2.5 border-t bg-gray-50 flex items-center justify-between text-[11px] text-gray-400">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-white border rounded text-[10px]">
                      <ChevronUp className="w-3 h-3 inline" />
                      <ChevronDown className="w-3 h-3 inline" />
                    </kbd>
                    navegar
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-white border rounded text-[10px]">
                      <CornerDownLeft className="w-3 h-3 inline" />
                    </kbd>
                    selecionar
                  </span>
                </div>
                <span>ESC para fechar</span>
              </div>
            </div>
          )}

          {/* Sugestões quando vazio (recentes + categorias) */}
          {showSuggestions && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
              {/* Buscas recentes */}
              {recentSearches.length > 0 && (
                <div className="p-4 border-b">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Buscas recentes
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {recentSearches.map((term, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setQuery(term);
                          setIsOpen(true);
                        }}
                        className="px-3 py-1.5 bg-gray-100 hover:bg-blue-50 hover:text-blue-700 rounded-full text-sm transition-colors"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Categorias populares */}
              {popularCategories.length > 0 && (
                <div className="p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5" />
                    Categorias populares
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {popularCategories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => {
                          setQuery(cat);
                          setIsOpen(true);
                        }}
                        className="px-3 py-1.5 bg-gradient-to-r from-blue-50 to-green-50 hover:from-blue-100 hover:to-green-100 text-blue-700 rounded-full text-sm font-medium transition-all border border-blue-100"
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Dica abaixo da busca */}
        <div className="text-center mt-4 text-sm text-gray-500">
          <p>
            🔍 Busque por nome, código SKU ou categoria — tolerante a acentos e
            erros de digitação
          </p>
        </div>
      </div>
    </div>
  );
}