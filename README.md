# Tablo

Tes factures et relevés PDF en Excel propre, sans ressaisie. **100% dans le navigateur.**

**Live : https://tablo-app.vercel.app**

## Idée

Gagnante d'un workflow multi-agents (15 idées, 6 filtres durs : anti-radin, anti-GPT,
anti-plateforme, rétention, anti-cannibalisation, qualité). Le cœur n'est pas l'extraction
d'un fichier (ça, ChatGPT le fait) mais la **mémorisation des fournisseurs récurrents**,
rejouée chaque mois : besoin mensuel + valeur qui s'accumule = rétention réelle.

## Comment ça marche

- `pdf.js` lit le **texte natif** du PDF dans le navigateur (aligné avec la facturation
  électronique obligatoire 2026 : les factures deviennent massivement numériques).
- `extractor.js` applique des heuristiques factures FR : fournisseur, n°, date, HT, TVA
  (déduite TTC−HT, plus fiable que le taux), TTC, devise. Confiance par ligne, cellules
  douteuses signalées et corrigeables.
- Templates fournisseurs en `localStorage` (coût de sortie croissant), export CSV (gratuit)
  et Excel via SheetJS (Pro).

## Pricing

Gratuit : 3 docs/mois, CSV. Pro 9€/mois : batch illimité, fournisseurs mémorisés, Excel.
Pass 4€ : 50 docs ponctuels. Stripe Payment Link + clé localStorage.
> Remplacer `PAY_LINKS` dans `index.html` par les vrais liens Stripe.

## Stack

`index.html` + `extractor.js` statiques. pdf.js et SheetJS via CDN. Zéro backend, zéro upload.

## Limite assumée

MVP scopé aux **PDF à texte natif**. L'OCR de documents scannés (tesseract.js) viendrait
ensuite, en Pro, car il est plus lourd et moins fiable en client-side.
