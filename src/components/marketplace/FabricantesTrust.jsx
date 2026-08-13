import React from "react";
import { Link } from "react-router-dom";
import { Award, MapPin } from "lucide-react";

export default function FabricantesTrust({ fabricantes }) {
  const lista = (fabricantes || []).filter(
    f => f && (f.logomarca || f.empresa || f.full_name)
  );

  if (lista.length === 0) return null;

  return (
    <section className="max-w-7xl mx-auto px-4 py-12">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-1.5 rounded-full text-sm font-semibold mb-3">
          <Award className="w-4 h-4" />
          Fabricantes credenciados
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
          As maiores indústrias fitness do Brasil
        </h2>
        <p className="text-gray-600 mt-2 max-w-2xl mx-auto">
          Mais de {lista.length} fabricantes já fazem parte da PlaceFit, oferecendo seus produtos
          direto da fábrica para revendedores de todo o país.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {lista.map(fab => {
          const nome = fab.empresa || fab.full_name || 'Fabricante';
          return (
            <Link
              key={fab.id}
              to={`/FabricanteCatalogoPublic/${fab.id}`}
              className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col items-center text-center hover:shadow-lg hover:border-blue-300 transition-all duration-300 cursor-pointer"
            >
              <div className="w-16 h-16 flex items-center justify-center mb-3 bg-gray-50 rounded-lg overflow-hidden flex-shrink-0">
                {fab.logomarca ? (
                  <img
                    src={fab.logomarca}
                    alt={nome}
                    className="w-full h-full object-contain"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                ) : (
                  <span className="text-2xl font-bold text-blue-600">
                    {nome[0].toUpperCase()}
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-tight">
                {nome}
              </p>
              {(fab.cidade || fab.estado) && (
                <div className="flex items-center gap-0.5 text-xs text-gray-500 mt-1">
                  <MapPin className="w-3 h-3" />
                  <span className="truncate">{[fab.cidade, fab.estado].filter(Boolean).join(' - ')}</span>
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}