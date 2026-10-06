// Parametri fiscali e contributivi per l'anno indicato in ANNO.
// Ogni valore riporta la fonte. Aggiornare ogni anno (vedi OPERATIONS.md, "Aggiornamento annuale").

export const ANNO = 2026;
export const AGGIORNATO = '2026-10-06';

// IRPEF: art. 11 TUIR come modificato dalla L. 199/2025 (Legge di Bilancio 2026).
export const IRPEF = {
  scaglioni: [
    { fino: 28000, aliquota: 0.23 },
    { fino: 50000, aliquota: 0.33 },
    { fino: Infinity, aliquota: 0.43 },
  ],
};

// Lavoro dipendente.
export const DIPENDENTE = {
  // Quota IVS a carico del lavoratore (FPLD, aziende generiche).
  inpsAliquota: 0.0919,
  // +1% oltre la prima fascia di retribuzione pensionabile (art. 3-ter DL 384/1992; INPS circ. 6/2026: 56.224 €).
  inpsAliquotaAggiuntiva: 0.01,
  inpsSogliaAggiuntiva: 56224,
  // Massimale contributivo per chi ha il primo contributo dal 1/1/1996 (art. 2 c. 18 L. 335/1995; INPS circ. 6/2026).
  massimale: 122295,
  // Detrazioni art. 13 c.1 TUIR (1.955 € a regime da L. 207/2024 art. 1 c. 2) e c.1.1
  // (+65 € tra 25.000 e 35.000 €, L. 234/2021); invariate dalla L. 199/2025.
  detrazione: {
    fino15000: 1955,
    base: 1910,
    extra15_28: 1190,
    bonus25_35: 65,
  },
  // Taglio del cuneo fiscale strutturale, L. 207/2024 art. 1 cc. 4-9.
  cuneo: {
    sommaNonImponibile: [
      { fino: 8500, perc: 0.071 },
      { fino: 15000, perc: 0.053 },
      { fino: 20000, perc: 0.048 },
    ],
    ulterioreDetrazione: 1000,
    pienaFino: 32000,
    azzeramento: 40000,
  },
  // Trattamento integrativo (ex bonus 100 euro), art. 1 DL 3/2020.
  trattamentoIntegrativo: { importo: 1200, sogliaReddito: 15000, franchigia: 75 },
};

// Addizionali: variano per regione e comune. Valori di default indicativi, modificabili dall'utente.
export const ADDIZIONALI_DEFAULT = { regionale: 0.0173, comunale: 0.008 };

// Regime forfettario: L. 190/2014 art. 1 cc. 54-89.
export const FORFETTARIO = {
  sogliaRicavi: 85000,
  sogliaUscitaImmediata: 100000,
  // 35.000 € per il 2026 (L. 199/2025 art. 1 c. 27, proroga del limite della L. 207/2024);
  // dal 2027 torna a 30.000 € salvo nuova proroga.
  limiteRedditoDipendente: 35000,
  // Limite ordinario (L. 190/2014 c. 57 lett. d-ter), di nuovo in vigore dal 2027 senza proroga.
  limiteRedditoDipendenteOrdinario: 30000,
  impostaOrdinaria: 0.15,
  impostaStartup: 0.05,
  // Allegato 4 L. 190/2014. Codici ATECO 2007: anche dopo l'adozione di ATECO 2025 (1/4/2025) il
  // coefficiente si determina con il codice ATECO 2007 corrispondente, finché non esce la nuova tabella.
  coefficienti: [
    { id: 'professionisti', coeff: 0.78, label: 'Attività professionali, scientifiche, tecniche, sanitarie, istruzione, servizi finanziari e assicurativi', ateco: '64-66, 69-75, 85, 86-88' },
    { id: 'altre', coeff: 0.67, label: 'Altre attività economiche (es. sviluppo software, servizi alla persona, attività artistiche)', ateco: 'tutti i codici non compresi negli altri gruppi' },
    { id: 'commercio', coeff: 0.40, label: 'Commercio all\'ingrosso e al dettaglio', ateco: '45, 46.2-46.9, 47.1-47.7, 47.9' },
    { id: 'ambulante-alimentari', coeff: 0.40, label: 'Commercio ambulante di prodotti alimentari e bevande', ateco: '47.81' },
    { id: 'ambulante-altri', coeff: 0.54, label: 'Commercio ambulante di altri prodotti', ateco: '47.82-47.89' },
    { id: 'alimentari', coeff: 0.40, label: 'Industrie alimentari e delle bevande', ateco: '10-11' },
    { id: 'ristorazione', coeff: 0.40, label: 'Servizi di alloggio e ristorazione', ateco: '55-56' },
    { id: 'intermediari', coeff: 0.62, label: 'Intermediari del commercio', ateco: '46.1' },
    { id: 'costruzioni', coeff: 0.86, label: 'Costruzioni e attività immobiliari', ateco: '41-43, 68' },
  ],
};

// Contributi INPS lavoratori autonomi.
export const INPS = {
  // Gestione Separata, INPS circ. 8/2026.
  gestioneSeparata: {
    aliquota: 0.2607, // professionisti non iscritti ad altre forme (25% IVS + 0,72% + 0,35% ISCRO)
    aliquotaPensionati: 0.24, // pensionati o iscritti ad altre forme obbligatorie
    aliquotaCollaboratori: 0.3372, // collaboratori e autonomi occasionali non iscritti ad altre forme
    minimale: 18808,
    massimale: 122295,
    rivalsa: 0.04,
  },
  // Artigiani e commercianti, INPS circ. 14/2026.
  artigiani: {
    minimale: 18808,
    contributoFisso: 4521.36,
    maternita: 7.44,
    aliquota: 0.24,
    sogliaAggiuntiva: 56224,
    aliquotaOltre: 0.25,
    massimale: 122295,
  },
  commercianti: {
    minimale: 18808,
    contributoFisso: 4611.64,
    maternita: 7.44,
    aliquota: 0.2448,
    sogliaAggiuntiva: 56224,
    aliquotaOltre: 0.2548,
    massimale: 122295,
  },
  // Riduzione contributiva opzionale per i forfettari iscritti ad artigiani/commercianti (L. 190/2014 c. 77).
  riduzioneForfettari: 0.35,
};

// Prestazione occasionale (art. 67 c.1 lett. l TUIR; art. 44 DL 269/2003).
export const OCCASIONALE = {
  ritenuta: 0.2,
  franchigiaInps: 5000,
  quotaLavoratore: 1 / 3,
};

// Imposta di bollo su fatture/ricevute non soggette a IVA (DPR 642/1972).
export const BOLLO = { importo: 2, soglia: 77.47 };

// Aliquote IVA: art. 16 DPR 633/1972 (22% ordinaria) e Tabella A, parti II, II-bis e III (4%, 5%, 10%).
export const IVA = { aliquote: [0.22, 0.10, 0.05, 0.04] };

// Imposta sostitutiva sui finanziamenti a medio-lungo termine: artt. 15-18 DPR 601/1973 (0,25%);
// 2% per i mutui su abitazioni senza i requisiti prima casa (art. 1-bis c. 6 DL 168/2004,
// limitato dal DL 220/2004).
export const MUTUO = { impostaSostitutiva: 0.0025, impostaSostitutivaNoPrimaCasa: 0.02 };

export const RITENUTA_ACCONTO = 0.2;
