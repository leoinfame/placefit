import React from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * TableHead com suporte a ordenação clicável.
 * Props: sortKey, currentKey, currentDir, onSort, children, className
 */
export default function SortableTableHead({ sortKey, currentKey, currentDir, onSort, children, className, ...props }) {
  const isActive = currentKey === sortKey;

  return (
    <TableHead
      className={cn("cursor-pointer select-none", className)}
      onClick={() => onSort(sortKey)}
      {...props}
    >
      <div className="flex items-center gap-1">
        <span>{children}</span>
        {isActive ? (
          currentDir === "asc"
            ? <ChevronUp className="w-3 h-3 opacity-80" />
            : <ChevronDown className="w-3 h-3 opacity-80" />
        ) : (
          <ChevronsUpDown className="w-3 h-3 opacity-40" />
        )}
      </div>
    </TableHead>
  );
}