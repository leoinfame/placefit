import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";

const fmtData = (iso) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
};

const fmtPreco = (v) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const STATUS_STYLE = {
  pendente: "bg-yellow-100 text-yellow-700",
  pago: "bg-green-100 text-green-700",
  atrasado: "bg-red-100 text-red-700",
  cancelado: "bg-gray-100 text-gray-600",
  estornado: "bg-gray-100 text-gray-600",
};

export default function FaturasTab({ faturas }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Faturas e pagamentos
        </CardTitle>
      </CardHeader>
      <CardContent>
        {faturas.length === 0 ? (
          <p className="text-gray-500 text-sm">
            Nenhuma fatura gerada ainda. Suas faturas aparecerão aqui.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2 pr-4">Plano</th>
                  <th className="pb-2 pr-4">Referência</th>
                  <th className="pb-2 pr-4">Valor</th>
                  <th className="pb-2 pr-4">Vencimento</th>
                  <th className="pb-2 pr-4">Pagamento</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {faturas.map((f) => (
                  <tr key={f.id} className="border-b last:border-0">
                    <td className="py-3 pr-4 font-medium">{f.plano_nome}</td>
                    <td className="py-3 pr-4 text-gray-600">{f.referencia_mes}</td>
                    <td className="py-3 pr-4">{fmtPreco(f.valor)}</td>
                    <td className="py-3 pr-4 text-gray-600">
                      {fmtData(f.data_vencimento)}
                    </td>
                    <td className="py-3 pr-4 text-gray-600">{fmtData(f.data_pagamento)}</td>
                    <td className="py-3">
                      <Badge className={STATUS_STYLE[f.status] || ""}>
                        {f.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}