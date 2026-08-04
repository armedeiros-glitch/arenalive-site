(() => {
  'use strict';

  const cleanPaymentHtml = (value) => {
    const html = String(value ?? '');
    if (!/solicita[cç][aã]o de pagamento/i.test(html)) return html;

    let cleaned = html
      .replace(/<div class="declaration">[\s\S]*?<div class="(?:checkline|checks)">[\s\S]*?<\/div>\s*<\/div>/gi, '')
      .replace(/<section class="receipt">[\s\S]*?<\/section>/gi, '')
      .replace(/<footer>Documento gerado pelo Planet Marketing Hub[\s\S]*?<\/footer>/gi, '');

    const compactStyle = `
      <style id="pmh-payment-print-clean">
        .declaration,.receipt,footer{display:none!important}
        .signatures{margin-top:22px!important}
        @media print{
          .page{min-height:auto!important}
          .signatures{margin-top:18px!important}
        }
      </style>`;

    if (!cleaned.includes('pmh-payment-print-clean')) {
      cleaned = cleaned.replace('</head>', `${compactStyle}</head>`);
    }

    return cleaned;
  };

  const nativeOpen = window.open.bind(window);

  window.open = (...args) => {
    const popup = nativeOpen(...args);
    if (!popup) return popup;

    try {
      const proto = popup.Document?.prototype;
      if (proto && !proto.__pmhPaymentPrintClean) {
        const nativeWrite = proto.write;
        const nativeWriteln = proto.writeln;

        proto.write = function (...chunks) {
          return nativeWrite.apply(this, chunks.map(cleanPaymentHtml));
        };

        if (typeof nativeWriteln === 'function') {
          proto.writeln = function (...chunks) {
            return nativeWriteln.apply(this, chunks.map(cleanPaymentHtml));
          };
        }

        Object.defineProperty(proto, '__pmhPaymentPrintClean', {
          value: true,
          configurable: false,
          enumerable: false,
          writable: false,
        });
      }
    } catch {
      // Mantém o comportamento original caso o navegador bloqueie o acesso ao popup.
    }

    return popup;
  };
})();
