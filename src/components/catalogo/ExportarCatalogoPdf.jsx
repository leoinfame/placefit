import React, { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import printCatalogo from '@/components/catalogo/printCatalogo';

export default function ExportarCatalogoPdf({ nome, ready }) {
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();
  const exportPdf = async () => {
    const source = document.getElementById('catalogo-print-area');
    if (!source || !ready || exporting) return;
    // Open while the click is active, before awaiting images or fonts.
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({ title: 'Permita abrir a janela do catálogo', description: 'Libere os pop-ups para exportar o PDF.', variant: 'destructive' });
      return;
    }
    printWindow.opener = null;
    setExporting(true);
    try {
      await printCatalogo(printWindow, source, nome);
    } catch (error) {
      printWindow.close();
      toast({ title: 'Não foi possível exportar o catálogo', description: error.message, variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };
  return (
    <Button onClick={exportPdf} disabled={!ready || exporting} variant="outline" size="sm" className="gap-1.5">
      {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      {exporting ? 'Preparando PDF...' : 'Exportar PDF'}
    </Button>
  );
}