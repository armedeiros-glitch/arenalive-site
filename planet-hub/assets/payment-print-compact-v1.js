(() => {
  'use strict';

  const nativeOpen = window.open.bind(window);
  const compactStyle = `
    <style id="pmh-payment-print-compact">
      @page{size:A4;margin:8mm}
      @media print{
        html,body{width:210mm!important;margin:0!important;font-size:9.5px!important;line-height:1.24!important}
        body{background:#fff!important}
        .toolbar{display:none!important}
        .page{width:auto!important;min-height:auto!important;margin:0!important;padding:0!important;box-shadow:none!important}
        .header{gap:10px!important;padding-bottom:6px!important;border-bottom-width:2px!important}
        .mark{width:34px!important;height:34px!important;border-radius:8px!important;font-size:18px!important}
        .brand{gap:8px!important}.brand strong{font-size:14px!important}.brand span{margin-top:1px!important;font-size:7.5px!important}
        .meta strong,.doc-meta strong{font-size:10px!important}.meta span,.doc-meta span{margin-top:1px!important;font-size:7.5px!important}
        h1{margin:8px 0 1px!important;font-size:17px!important}.subtitle{margin:0 0 5px!important;font-size:8.5px!important}
        .section{margin-top:5px!important;border-radius:6px!important;break-inside:avoid!important}
        .section h2{padding:4px 7px!important;font-size:8px!important}
        .grid{display:grid!important;grid-template-columns:1fr 1fr!important}
        .field{min-height:0!important;padding:4px 6px!important;border-right:1px solid #e6ddd8!important;border-bottom:1px solid #e6ddd8!important}
        .field:nth-child(2n){border-right:0!important}.field.full{grid-column:1/-1!important;border-right:0!important}
        .field label{margin-bottom:1px!important;font-size:7px!important}.field strong{font-size:9.5px!important}.field span{font-size:8.5px!important;line-height:1.22!important}
        .amount{padding:6px!important;border-width:1.5px!important}.amount label{font-size:7.5px!important}.amount strong{margin-top:1px!important;font-size:18px!important}
        .declaration{margin-top:5px!important;padding:6px!important;border-radius:6px!important;font-size:8.5px!important;line-height:1.25!important;break-inside:avoid!important}
        .checks,.checkline{display:flex!important;gap:9px!important;margin-top:4px!important;font-size:7.5px!important;flex-wrap:wrap!important}
        .checks span::before,.checkline span::before{margin-right:3px!important;font-size:9px!important}
        .signatures{display:grid!important;grid-template-columns:1fr 1fr!important;gap:22px!important;margin-top:17px!important;break-inside:avoid!important}
        .signature{padding-top:3px!important}.signature strong{font-size:8.5px!important}.signature span{margin-top:1px!important;font-size:7px!important}
        .receipt{margin-top:14px!important;padding-top:5px!important;break-inside:avoid!important}
        .receipt h3{margin:0 0 3px!important;font-size:8.5px!important}.receipt-grid{display:grid!important;grid-template-columns:1fr 1fr!important;gap:12px!important}
        .receipt-line{min-height:19px!important;padding-top:8px!important;font-size:7px!important}
        footer{margin-top:5px!important;padding-top:3px!important;font-size:6.5px!important}
      }
      @media screen and (max-width:850px){.page{width:100%;min-height:0;margin:0;padding:24px}.grid,.signatures,.receipt-grid{grid-template-columns:1fr}.field{border-right:0}.toolbar{position:static}}
    </style>`;

  const injectCompactStyle = (html) => {
    if (typeof html !== 'string' || !/<html/i.test(html)) return html;
    const isPaymentDocument = /solicita[cç][aã]o de pagamento/i.test(html)
      || /preparando a solicita[cç][aã]o/i.test(html)
      || /salvando os dados e preparando a impress[aã]o/i.test(html);
    if (!isPaymentDocument || html.includes('pmh-payment-print-compact')) return html;
    return html.includes('</head>')
      ? html.replace('</head>', `${compactStyle}</head>`)
      : `${compactStyle}${html}`;
  };

  const installWriteHook = (popup) => {
    try {
      const doc = popup.document;
      const nativeWrite = doc.write.bind(doc);
      doc.write = (...parts) => nativeWrite(...parts.map(injectCompactStyle));
    } catch {
      // Pop-up indisponível ou já fechado.
    }
  };

  window.open = (...args) => {
    const popup = nativeOpen(...args);
    if (!popup) return popup;
    try {
      const doc = popup.document;
      const nativeDocumentOpen = doc.open.bind(doc);
      doc.open = (...openArgs) => {
        const result = nativeDocumentOpen(...openArgs);
        installWriteHook(popup);
        return result;
      };
      installWriteHook(popup);
    } catch {
      // Mantém o comportamento nativo quando o navegador bloquear o acesso.
    }
    return popup;
  };
})();
