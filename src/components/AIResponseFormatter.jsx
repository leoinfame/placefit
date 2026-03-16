import React from 'react';

export default function AIResponseFormatter({ content }) {
  // Detectar e formatar tabelas HTML na resposta
  const renderContent = () => {
    // Se já tem HTML de tabela, renderizar como HTML
    if (content.includes('<table') || content.includes('<div')) {
      return (
        <div 
          className="ai-response-html prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: content }}
          style={{
            fontSize: '13px',
            lineHeight: '1.5',
          }}
        />
      );
    }

    // Caso contrário, renderizar como texto com formatação
    return (
      <div className="whitespace-pre-wrap text-sm leading-relaxed">
        {content}
      </div>
    );
  };

  return (
    <div className="w-full">
      {renderContent()}
      <style>{`
        .ai-response-html table {
          width: 100%;
          border-collapse: collapse;
          margin: 12px 0;
          font-size: 12px;
        }

        .ai-response-html th {
          background-color: #f3f4f6;
          border: 1px solid #e5e7eb;
          padding: 8px;
          text-align: left;
          font-weight: 600;
          color: #1f2937;
        }

        .ai-response-html td {
          border: 1px solid #e5e7eb;
          padding: 8px;
          color: #374151;
        }

        .ai-response-html tr:nth-child(even) {
          background-color: #f9fafb;
        }

        .ai-response-html tr:hover {
          background-color: #f3f4f6;
        }

        .ai-response-html strong {
          color: #1f2937;
          font-weight: 600;
        }

        .ai-response-html p {
          margin: 8px 0;
        }

        .ai-response-html h3,
        .ai-response-html h4 {
          margin: 12px 0 6px 0;
          font-weight: 600;
          color: #1f2937;
        }

        .ai-response-html h3 {
          font-size: 14px;
        }

        .ai-response-html h4 {
          font-size: 13px;
        }

        .ai-response-html ul,
        .ai-response-html ol {
          margin: 8px 0;
          padding-left: 20px;
        }

        .ai-response-html li {
          margin: 4px 0;
        }

        .product-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 12px;
          margin: 12px 0;
        }

        .product-card {
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 12px;
          background-color: #ffffff;
        }

        .product-card:hover {
          background-color: #f9fafb;
          border-color: #d1d5db;
        }

        .product-name {
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 6px;
          font-size: 13px;
        }

        .product-detail {
          font-size: 12px;
          color: #6b7280;
          margin: 4px 0;
        }

        .product-price {
          color: #059669;
          font-weight: 600;
          font-size: 13px;
          margin-top: 8px;
        }

        .section-title {
          margin: 16px 0 8px 0;
          font-weight: 700;
          color: #0f172a;
          font-size: 13px;
          border-bottom: 2px solid #3b82f6;
          padding-bottom: 6px;
        }
      `}</style>
    </div>
  );
}