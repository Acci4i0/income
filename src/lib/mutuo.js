// Ammortamento alla francese (rata costante), rate mensili.

export function rataMensile(capitale, tassoAnnuo, anni) {
  const n = Math.round(anni * 12);
  if (n <= 0) return 0;
  const i = tassoAnnuo / 12;
  if (i === 0) return capitale / n;
  return capitale * i / (1 - Math.pow(1 + i, -n));
}

export function calcolaMutuo({ capitale, tassoAnnuo, anni, redditoMensile = 0 }) {
  const rata = rataMensile(capitale, tassoAnnuo, anni);
  const n = Math.round(anni * 12);
  const i = tassoAnnuo / 12;
  const piano = [];
  let residuo = capitale;
  let anno = { anno: 1, capitale: 0, interessi: 0, residuo: capitale };
  for (let m = 1; m <= n; m++) {
    const interessi = residuo * i;
    const quotaCapitale = Math.min(rata - interessi, residuo);
    residuo = Math.max(0, residuo - quotaCapitale);
    anno.capitale += quotaCapitale;
    anno.interessi += interessi;
    if (m % 12 === 0 || m === n) {
      anno.residuo = residuo;
      piano.push(anno);
      anno = { anno: anno.anno + 1, capitale: 0, interessi: 0, residuo };
    }
  }
  const totalePagato = rata * n;
  return {
    rata,
    rate: n,
    totalePagato,
    totaleInteressi: totalePagato - capitale,
    rapportoRataReddito: redditoMensile > 0 ? rata / redditoMensile : null,
    piano,
  };
}
