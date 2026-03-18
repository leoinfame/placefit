import { useState, useMemo } from "react";

/**
 * Hook para ordenamento de tabelas.
 * @param {Array} data - Array de dados a ordenar
 * @param {string} defaultKey - Campo padrão de ordenação (opcional)
 * @param {string} defaultDir - 'asc' ou 'desc' (padrão: 'asc')
 * @returns {{ sorted, sortKey, sortDir, requestSort, SortIcon }}
 */
export function useSort(data, defaultKey = null, defaultDir = "asc") {
  const [sortKey, setSortKey] = useState(defaultKey);
  const [sortDir, setSortDir] = useState(defaultDir);

  const requestSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv), "pt-BR", { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  return { sorted, sortKey, sortDir, requestSort };
}