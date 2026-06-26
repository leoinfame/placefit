import React from "react";

export default function PreviewGrid({ previewData, user, colors }) {
  if (!previewData || previewData.length === 0) return null;

  // Agrupar por categoria
  const categorias = {};
  previewData.forEach(item => {
    const cat = item.categoria || 'Outros';
    if (!categorias[cat]) categorias[cat] = [];
    categorias[cat].push(item);
  });

  const c = colors || {
    primary: '#1e3a5f', primaryDark: '#0f172a', secondary: '#1e40af',
    light: '#eff6ff', lightBorder: '#bfdbfe', textOnPrimary: '#ffffff', textAccent: '#1e40af'
  };

  const gradient = `linear-gradient(135deg, ${c.primaryDark} 0%, ${c.primary} 50%, ${c.secondary} 100%)`;

  return (
    <div className="space-y-5">
      {/* Header da empresa */}
      <div
        className="flex items-center gap-4 rounded-2xl p-5 shadow-md"
        style={{ background: gradient }}
      >
        {user?.logomarca ? (
          <img
            src={user.logomarca}
            alt="Logo"
            className="w-14 h-14 object-contain bg-white rounded-lg p-1 flex-shrink-0"
          />
        ) : (
          <div className="w-14 h-14 bg-white/15 rounded-lg flex items-center justify-center text-2xl flex-shrink-0">
            🏋️
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p
            className="text-xs font-semibold uppercase tracking-widest mb-1"
            style={{ color: c.textOnPrimary }}
          >
            {user?.empresa || user?.full_name}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {user?.whatsapp && (
              <span className="text-xs" style={{ color: c.light }}>📱 {user.whatsapp}</span>
            )}
            {user?.email && (
              <span className="text-xs" style={{ color: c.light }}>✉ {user.email}</span>
            )}
            {user?.site && (
              <span className="text-xs" style={{ color: c.light }}>🌐 {user.site}</span>
            )}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p
            className="text-sm font-extrabold uppercase tracking-wide leading-tight"
            style={{ color: c.textOnPrimary }}
          >
            Tabela de<br/>Preços
          </p>
          <p className="text-xs mt-1" style={{ color: c.light }}>
            {new Date().toLocaleDateString('pt-BR')}
          </p>
        </div>
      </div>

      {/* Grid de produtos por categoria */}
      {Object.entries(categorias).map(([cat, itens]) => (
        <div key={cat}>
          {/* Cabeçalho da categoria */}
          <div className="flex items-center gap-2 mb-3 px-1">
            <div
              className="w-1 h-6 rounded-full"
              style={{ background: c.secondary }}
            />
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">
              {cat}
            </h3>
            <span className="ml-auto text-xs text-gray-400 font-medium">
              {itens.length} {itens.length === 1 ? 'item' : 'itens'}
            </span>
          </div>

          {/* Grid de cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {itens.map((item, i) => (
              <div
                key={i}
                className="bg-white border border-gray-200 rounded-xl p-3 hover:shadow-md transition-shadow flex flex-col justify-between min-h-[110px]"
              >
                {/* Topo: código + nome */}
                <div>
                  {item.cod && (
                    <span
                      className="inline-block text-[10px] font-mono text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded mb-1.5"
                    >
                      {item.cod}
                    </span>
                  )}
                  <p className="text-sm font-semibold text-gray-800 leading-snug line-clamp-2">
                    {item.nome}
                  </p>
                </div>

                {/* Meio: espec/pesos + und */}
                <div className="flex items-center gap-2 my-2">
                  {item.isWeightGrouped && item.pesosDisponiveis && (
                    <span className="text-[11px] text-gray-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
                      {item.pesosDisponiveis}
                    </span>
                  )}
                  {!item.isWeightGrouped && item.peso && (
                    <span className="text-[11px] text-gray-600 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full">
                      {item.peso}
                    </span>
                  )}
                  <span className="text-[10px] text-gray-400 uppercase tracking-wide">
                    {item.und || 'peça'}
                  </span>
                </div>

                {/* Preço */}
                <div className="flex items-end justify-between">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wide">
                    {item.isWeightGrouped ? 'Preço por kg' : 'Preço'}
                  </span>
                  <span className="text-base font-bold text-green-600">
                    {item.precoFormatado}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Rodapé */}
      <div className="border-t border-gray-200 pt-3">
        <p className="text-xs text-gray-500">
          ⚠️ Tabela sujeita a alterações sem aviso prévio. Consulte disponibilidade antes do pedido.
        </p>
      </div>
    </div>
  );
}