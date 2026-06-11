// Tablo — moteur d'extraction de factures FR à partir du texte natif d'un PDF.
// 100% client-side. Le texte est fourni par pdf.js, jamais envoyé à un serveur.

// Colonnes standard du tableau de sortie
export const FIELDS = [
  { key:'fournisseur', label:'Fournisseur' },
  { key:'numero',      label:'N° facture' },
  { key:'date',        label:'Date' },
  { key:'ht',          label:'Montant HT' },
  { key:'tva',         label:'TVA' },
  { key:'ttc',         label:'Montant TTC' },
  { key:'devise',      label:'Devise' },
];

const MONTHS = {janvier:1,février:2,fevrier:2,mars:3,avril:4,mai:5,juin:6,juillet:7,août:8,aout:8,septembre:9,octobre:10,novembre:11,décembre:12,decembre:12};

function num(s){
  if (s==null) return null;
  // "2 480,55" / "1.960,27" / "396.00" -> 2480.55
  let t = String(s).replace(/[^\d.,\-]/g,'').trim();
  if (!t) return null;
  // si virgule décimale française
  if (/,\d{1,2}$/.test(t)) t = t.replace(/\./g,'').replace(/\s/g,'').replace(',', '.');
  else t = t.replace(/[,\s]/g,'');
  const v = parseFloat(t);
  return isNaN(v) ? null : v;
}
function fmtNum(v){
  if (v==null || isNaN(v)) return '';
  return v.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2});
}

// cherche un montant à droite d'un libellé (sur la même "ligne" reconstruite)
function amountAfter(text, labels){
  for (const lab of labels){
    const re = new RegExp(lab + '[^\\d\\-]{0,30}([\\-]?\\d[\\d .,]*\\d|\\d)', 'i');
    const m = text.match(re);
    if (m) { const v = num(m[1]); if (v!=null) return v; }
  }
  return null;
}

function findDate(text){
  let m = text.match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
  if (m){
    let [_,d,mo,y]=m; if (y.length===2) y='20'+y;
    return `${d.padStart(2,'0')}/${mo.padStart(2,'0')}/${y}`;
  }
  m = text.match(/(\d{1,2})\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+(\d{4})/i);
  if (m){ const mo=MONTHS[m[2].toLowerCase()]; return `${m[1].padStart(2,'0')}/${String(mo).padStart(2,'0')}/${m[3]}`; }
  return '';
}

function findNumero(text){
  // le numéro capturé doit contenir au moins un chiffre (sinon on attrape le mot "Facture")
  const m = text.match(/(?:facture|invoice|n[°o]|num[ée]ro|r[ée]f[ée]rence|ref)\s*(?:de facture)?\s*[:#nN°o]*\s*((?=[A-Za-z0-9\-\/_.]*\d)[A-Za-z0-9][A-Za-z0-9\-\/_.]{3,})/i);
  if (m) return m[1].replace(/[.,;]$/,'');
  return '';
}

// le fournisseur : généralement en haut, en MAJ ou avec forme juridique
function findFournisseur(lines){
  for (const l of lines.slice(0,8)){
    const t = l.trim();
    if (!t || t.length<3) continue;
    if (/facture|invoice|relev[ée]|devis|bon de/i.test(t)) continue;
    if (/(SAS|SARL|SA|EURL|SASU|GmbH|Ltd|Inc|Services|Europe)\b/.test(t)) return clean(t);
    if (/^[A-ZÀ-Ü][A-ZÀ-Ü &'.\-]{2,}$/.test(t) && t.length<45) return clean(t);
  }
  // fallback : 1re ligne non vide
  const first = lines.find(l=>l.trim().length>2);
  return first ? clean(first.trim()) : '';
}
function clean(s){ return s.replace(/\s{2,}/g,' ').replace(/[•|]/g,'').trim().slice(0,60); }

function findDevise(text){
  if (/€|EUR/i.test(text)) return 'EUR';
  if (/\$|USD/.test(text)) return 'USD';
  if (/£|GBP/i.test(text)) return 'GBP';
  return 'EUR';
}

// extrait un enregistrement depuis le texte d'un PDF (joint multi-pages)
export function extractInvoice(rawText, lines){
  const text = rawText.replace(/ /g,' ');
  const ttc = amountAfter(text, ['total\\s*ttc','montant\\s*ttc','net\\s*[àa]\\s*payer','total\\s*amount','amount\\s*due','total\\s*t\\.t\\.c']);
  const ht  = amountAfter(text, ['total\\s*ht','montant\\s*ht','total\\s*h\\.t','sous[- ]total','subtotal']);
  // TVA : la déduction HT/TTC est plus fiable que le regex (qui confond avec le taux "20%")
  let tva = null;
  if (ht!=null && ttc!=null) tva = Math.round((ttc-ht)*100)/100;
  else tva = amountAfter(text, ['montant\\s*(?:de\\s*)?(?:la\\s*)?tva','t\\.v\\.a\\.?\\s*[:=]','vat\\s*[:=]']);
  return {
    fournisseur: findFournisseur(lines),
    numero: findNumero(text),
    date: findDate(text),
    ht: ht!=null ? fmtNum(ht) : '',
    tva: tva!=null ? fmtNum(tva) : '',
    ttc: ttc!=null ? fmtNum(ttc) : '',
    devise: findDevise(text),
    _confidence: confidence({ttc,ht,date:findDate(text)}),
  };
}

function confidence(f){
  let c=0; if(f.ttc!=null)c+=2; if(f.ht!=null)c++; if(f.date)c++;
  return c>=3 ? 'high' : c>=2 ? 'medium' : 'low';
}

// reconstruit des "lignes" à partir des items texte de pdf.js (avec coordonnées Y)
export function itemsToLines(items){
  const rows = new Map();
  for (const it of items){
    const y = Math.round(it.y/3)*3;
    if (!rows.has(y)) rows.set(y, []);
    rows.get(y).push(it);
  }
  // y croissant = haut de page vers le bas (y = hauteur - coordonnée PDF)
  return [...rows.entries()].sort((a,b)=>a[0]-b[0])
    .map(([y,its])=> its.sort((a,b)=>a.x-b.x).map(i=>i.str).join(' ').trim());
}

// applique un template (mapping/renommage de colonnes) à un enregistrement
export function applyTemplate(record, template){
  if (!template) return record;
  const out = { ...record };
  if (template.fournisseur) out.fournisseur = template.fournisseur;
  return out;
}

// signature d'un fournisseur pour reconnaître un document récurrent
export function vendorKey(record){
  return (record.fournisseur||'').toLowerCase().replace(/[^a-zà-ü0-9]/g,'').slice(0,24) || null;
}

export { fmtNum, num };
