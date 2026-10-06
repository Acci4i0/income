// Scorporo e aggiunta IVA.

export function scorporaIva(lordo, aliquota) {
  const imponibile = lordo / (1 + aliquota);
  return { imponibile, iva: lordo - imponibile, lordo };
}

export function aggiungiIva(imponibile, aliquota) {
  const iva = imponibile * aliquota;
  return { imponibile, iva, lordo: imponibile + iva };
}
