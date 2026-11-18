// Soru bankasını kaynak dosyalardan derler: public/spl-bank.js
// Kaynaklar: content/legacy-questions.js (eski havuz), spl-curriculum.js seed’leri, content/new/*.js (yeni özgün sorular)
// Yapılanlar: tekrarların ayıklanması, aynı seçenek setli klonların teke indirilmesi, sayısal şablon klonlarının
// sınırlandırılması, yazım hatalarının düzeltilmesi ve yanlış konuya konmuş soruların doğru havuza taşınması.
import { readFile, writeFile } from 'node:fs/promises';
import vm from 'node:vm';
import settlement from '../content/new/settlement.js';
import taxation from '../content/new/taxation.js';
import economics from '../content/new/economics.js';
import commercialLaw from '../content/new/commercial-law.js';
import markets from '../content/new/markets.js';
import instruments2 from '../content/new/instruments-2.js';
import { financialManagement, accounting, valuation } from '../content/new/finance-accounting.js';
import { law, institutions } from '../content/new/law-institutions.js';
import * as supplement from '../content/new/supplement.js';

const read = p => readFile(new URL(p, import.meta.url), 'utf8');
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(await read('../public/spl-curriculum.js'), ctx);
vm.runInContext(await read('../content/legacy-questions.js'), ctx);
const curriculum = ctx.window.SPL_CURRICULUM;
const legacy = ctx.window.SPL_LEGACY_QUESTIONS;

const BROAD = ['Düzey 2', 'Düzey 3'];
const MAX_NUMERIC_CLONES = 3;

const fixText = s => String(s)
  .replace(/(\d[\d.,]*)\s*TL\s+milyon\s+TL/g, '$1 milyon TL')
  .replace(/\bTL\s+TL\b/g, 'TL')
  .replace(/\s{2,}/g, ' ')
  .trim();

const banks = {};
const add = (bank, item) => (banks[bank] ||= []).push(item);
const fromTuple = (t, source) => ({ topic: t[0], levels: t[5] || null, pref: null, source, q: [t[1], t[2], t[3], t[4]] });

// 1) Yeni özgün sorular (öncelikli: tekrar ayıklamada ilk gelen korunur)
const authored = {
  settlement: [...settlement, ...supplement.settlement], taxation: [...taxation, ...supplement.taxation],
  'general-economics': [...economics, ...supplement.economics], 'commercial-law': commercialLaw,
  'financial-markets': markets, 'instruments-2': instruments2, 'financial-management': [...financialManagement, ...supplement.financialManagement],
  'accounting-reporting': accounting, 'finance-math-valuation': valuation, law, 'investment-institutions': institutions,
};
for (const [bank, list] of Object.entries(authored)) list.forEach(t => add(bank, fromTuple(t, 'new')));

// 2) Müfredat seed soruları
for (const [seedBank, seeds] of Object.entries(curriculum.seeds)) {
  const bank = seedBank === 'law-narrow' || seedBank === 'law-broad' ? 'law' : seedBank;
  for (const s of seeds) {
    const broadOnly = seedBank === 'law-broad' && /Kolektif|Gayrimenkul yatırım/.test(s[0]);
    add(bank, { topic: s[0], levels: broadOnly ? BROAD : null, pref: null, source: 'seed', q: [s[1], s.slice(2, 6), 0, s[6]] });
  }
}

// 3) Eski havuz — yanlış konudakiler taşınır
const settlementKeywords = /takas|saklama|kur riski|MKK|kaydi|temerr|teminat/i;
for (const [bank, items] of Object.entries(legacy)) {
  for (const item of items) {
    let target = bank;
    if (bank === 'settlement' && !settlementKeywords.test(item.q[0] + item.q[1].join(' '))) target = 'accounting-reporting';
    if (bank === 'taxation' && /kaldıra/i.test(item.q[0])) target = 'financial-management';
    if (bank === 'settlement' && /Kur riski/.test(item.q[1][item.q[2]])) target = 'instruments-1';
    add(target, { topic: null, levels: null, pref: item.level, source: 'legacy', q: item.q });
  }
}

// 4) Temizlik ve tekrar ayıklama
const norm = s => s.toLocaleLowerCase('tr').replace(/[^a-zçğıöşü0-9 ]/g, '').replace(/\s+/g, ' ').trim();
const stats = {};
const out = {};
for (const [bank, items] of Object.entries(banks)) {
  const seenPrompt = new Set(), seenOptions = new Set(), numericCount = new Map();
  const s = stats[bank] = { input: items.length, duplicatePrompt: 0, sameOptionClone: 0, numericClone: 0, invalid: 0, kept: 0 };
  out[bank] = [];
  for (const item of items) {
    const [prompt, options, answer, explanation] = item.q;
    const q = [fixText(prompt), options.map(fixText), answer, fixText(explanation)];
    if (q[1].length !== 4 || new Set(q[1]).size !== 4 || !(answer >= 0 && answer < 4) || !q[3]) { s.invalid++; continue; }
    const pKey = norm(q[0]);
    if (seenPrompt.has(pKey)) { s.duplicatePrompt++; continue; }
    const oKey = q[1].map(norm).sort().join('|');
    if (seenOptions.has(oKey)) { s.sameOptionClone++; continue; }
    const template = q[0].replace(/[\d.,%]+/g, '#');
    if (template !== q[0]) {
      const c = numericCount.get(template) || 0;
      if (c >= MAX_NUMERIC_CLONES) { s.numericClone++; continue; }
      numericCount.set(template, c + 1);
    }
    seenPrompt.add(pKey); seenOptions.add(oKey);
    const entry = { q };
    if (item.topic) entry.t = item.topic;
    if (item.levels) entry.l = item.levels;
    if (item.pref) entry.p = item.pref;
    entry.s = item.source;
    out[bank].push(entry);
    s.kept++;
  }
}

const header = `// OTOMATİK ÜRETİLDİ — elle düzenlemeyin. Kaynak: content/ ve scripts/build-bank.mjs (npm run build:bank)\n// Sorular özgün çalışma içeriğidir; resmi SPK/SPL sınav sorusu değildir.\n`;
await writeFile(new URL('../public/spl-bank.js', import.meta.url), `${header}window.SPL_BANK = ${JSON.stringify(out)};\n`);
console.table(stats);
console.log('Toplam benzersiz soru:', Object.values(out).reduce((a, b) => a + b.length, 0));
