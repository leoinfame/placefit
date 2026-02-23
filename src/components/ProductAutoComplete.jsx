import React, { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Package, X } from "lucide-react";
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
  const [selectedProduct, setSelectedProduct] = useState(
    selectedProductData?.product_id ? products.find(p => p.id === selectedProductData.product_id) : null
  );
  const [qtd, setQtd] = useState(quantidade);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

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

  const filteredProducts = searchTerm.trim() 
    ? products.filter(p => 
        p.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.cod?.toLowerCase().includes(searchTerm.toLowerCase())
      ).slice(0, 10)
    : [];

  const handleSelectProduct = (product) => {
    setSelectedProduct(product);
    setSearchTerm("");
    setShowDropdown(false);
    if (onSelect) {
      onSelect(product);
    }
  };

  const handleQuantidadeChange = (newQtd) => {
    const valor = parseFloat(newQtd) || 0;
    setQtd(valor);
    if (onQuantidadeChange) {
      onQuantidadeChange(valor);
    }
  };

  const handleInputChange = (value) => {
    setSearchTerm(value);
    setShowDropdown(value.trim().length > 0);
  };

  if (selectedProduct) {
    const preco = userType === 'fabricante' ? parseFloat(selectedProduct.preco_fabricante) : parseFloat(selectedProduct.preco_fornecedor);
    
    return (
      <div className="flex gap-2 items-center p-3 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <Package className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{selectedProduct.cod} - {selectedProduct.nome}</p>
          </div>
        </div>
        <Input
          type="number"
          step="1"
          min="1"
          value={qtd}
          onChange={(e) => handleQuantidadeChange(e.target.value)}
          className="w-20 text-center flex-shrink-0"
          placeholder="Qtd"
        />
        <div className="w-28 text-right flex-shrink-0">
          <p className="text-xs text-gray-500">Unit: R$ {preco.toFixed(2)}</p>
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

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        type="text"
        value={searchTerm}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => searchTerm.trim() && setShowDropdown(true)}
        placeholder="Digite o código ou nome do produto..."
        className="w-full"
      />
      
      {showDropdown && filteredProducts.length > 0 && (
        <div 
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto"
        >
          {filteredProducts.map((product) => (
            <button
              key={product.id}
              onClick={() => handleSelectProduct(product)}
              className="w-full px-4 py-2 text-left hover:bg-blue-50 border-b last:border-b-0 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{product.cod} - {product.nome}</p>
                  <p className="text-xs text-gray-500">{product.und || 'un'}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-green-700 whitespace-nowrap">
                    R$ {(userType === 'fabricante' ? parseFloat(product.preco_fabricante) : parseFloat(product.preco_fornecedor)).toFixed(2)}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
      
      {showDropdown && searchTerm.trim() && filteredProducts.length === 0 && (
        <div 
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center"
        >
          <p className="text-sm text-gray-500">Nenhum produto encontrado</p>
        </div>
      )}
    </div>
  );
}