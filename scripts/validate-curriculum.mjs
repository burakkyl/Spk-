// Soru bankası ve deneme kurgusu doğrulaması (npm test).
// Bankayı yeniden derlemek için: npm run build:bank
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const context = { window: {} };
vm.createContext(context);
vm.runInContext(await read('../public/spl-curriculum.js'), context);
vm.runInContext(await read('../public/spl-bank.js'), context);
const app = await read('../app.js');
const appData = app.slice(0, app.indexOf("const root=document.getElementById('view-root');"));
assert.ok(appData.length > 0, 'app.js deneme kurgusu bölümü bulunamadı');
vm.runInContext(appData, context);
const exams = vm.runInContext('exams', context);
const QUESTIONS_PER_EXAM = vm.runInContext('QUESTIONS_PER_EXAM', context);
const MIN_FRESH = vm.runInContext('MIN_FRESH_FOR_EXTRA_EXAM', context);
const curriculum = context.window.SPL_CURRICULUM;
const bank = context.window.SPL_BANK;
const LEVELS = ['Düzey 1', 'Düzey 2', 'Düzey 3'];
const EXPECTED_SUBJECTS = { 'Düzey 1': 4, 'Düzey 2': 9, 'Düzey 3': 12 };
const MIN_PER_BANK = 25;

const errors = [];
const check = (cond, msg) => { if (!cond) errors.push(msg); };
const norm = text => String(text).toLocaleLowerCase('tr').replace(/\s+/g, ' ').trim();

// 1) Banka: her soru iyi biçimli mi?
const allPrompts = new Map();
let total = 0;
for (const [bankId, items] of Object.entries(bank)) {
  check(items.length >= MIN_PER_BANK, `${bankId}: en az ${MIN_PER_BANK} soru olmalı (şu an ${items.length})`);
  for (const [i, item] of items.entries()) {
    const where = `${bankId}#${i + 1}`;
    const [prompt, options, answer, explanation] = item.q || [];
    total++;
    check(typeof prompt === 'string' && prompt.trim().length >= 10, `${where}: soru kökü eksik/çok kısa`);
    check(Array.isArray(options) && options.length === 4, `${where}: tam 4 seçenek olmalı`);
    if (Array.isArray(options)) {
      check(new Set(options.map(norm)).size === options.length, `${where}: seçenekler birbirinden farklı olmalı`);
      check(options.every(o => typeof o === 'string' && o.trim()), `${where}: boş seçenek var`);
    }
    check(Number.isInteger(answer) && answer >= 0 && answer < 4, `${where}: geçersiz doğru cevap indeksi`);
    check(typeof explanation === 'string' && explanation.trim().length >= 10, `${where}: açıklama eksik`);
    check(!/\bTL TL\b|TL milyon TL/.test(`${prompt} ${options?.join(' ')} ${explanation}`), `${where}: birim yazım hatası (TL TL)`);
    if (item.l) check(item.l.every(level => LEVELS.includes(level)), `${where}: geçersiz düzey etiketi`);
    const key = norm(prompt);
    if (allPrompts.has(key)) errors.push(`${where}: soru kökü tekrar ediyor (${allPrompts.get(key)})`);
    else allPrompts.set(key, where);
  }
}

// 2) Müfredat: her ders bir bankaya bağlı mı?
for (const level of LEVELS) {
  const subjects = curriculum.levels[level] || [];
  check(subjects.length === EXPECTED_SUBJECTS[level], `${level}: ${EXPECTED_SUBJECTS[level]} ders bekleniyordu, ${subjects.length} bulundu`);
  for (const subject of subjects) {
    const bankId = { 'law-narrow': 'law', 'law-broad': 'law' }[subject.bank] || subject.bank;
    const pool = (bank[bankId] || []).filter(item => !item.l || item.l.includes(level));
    check(pool.length >= QUESTIONS_PER_EXAM, `${level} / ${subject.title}: en az ${QUESTIONS_PER_EXAM} soru olmalı (şu an ${pool.length})`);
  }
}

// 3) Denemeler: her düzeyde ilk deneme ücretsiz, her deneme tam ve tekrarsız
for (const level of LEVELS) {
  const levelExams = exams.filter(exam => exam.level === level);
  check(levelExams.length >= EXPECTED_SUBJECTS[level], `${level}: her ders için en az bir deneme olmalı`);
  check(levelExams[0] && levelExams[0].paid === false, `${level}: ilk deneme ücretsiz olmalı`);
  check(levelExams.filter(exam => !exam.paid).length === 1, `${level}: tam olarak bir ücretsiz deneme olmalı`);
  const present = new Set(levelExams.map(exam => exam.curriculumId));
  for (const subject of curriculum.levels[level]) check(present.has(subject.id), `${level}: ${subject.title} için deneme yok`);
  for (const exam of levelExams) {
    check(exam.questions.length >= QUESTIONS_PER_EXAM && exam.questions.length < QUESTIONS_PER_EXAM + MIN_FRESH, `${exam.id}: ${QUESTIONS_PER_EXAM}-${QUESTIONS_PER_EXAM + MIN_FRESH - 1} soru olmalı (şu an ${exam.questions.length})`);
    check(exam.freshCount >= MIN_FRESH, `${exam.id}: en az ${MIN_FRESH} yeni soru içermeli (şu an ${exam.freshCount})`);
    check(new Set(exam.questions.map(q => q[0])).size === exam.questions.length, `${exam.id}: deneme içinde tekrar eden soru var`);
    check(exam.curriculumTopics?.length > 0, `${exam.id}: müfredat alt konuları listelenmeli`);
  }
}
check(new Set(exams.map(exam => exam.id)).size === exams.length, 'deneme kimlikleri benzersiz olmalı');

if (errors.length) {
  console.error(`Doğrulama başarısız (${errors.length} hata):\n- ${errors.slice(0, 60).join('\n- ')}`);
  process.exit(1);
}
const byLevel = LEVELS.map(level => `${level}: ${exams.filter(e => e.level === level).length} deneme`).join(', ');
console.log(`Soru bankası doğrulandı: ${total} benzersiz soru, ${exams.length} deneme (${byLevel}), her düzeyde 1 ücretsiz deneme.`);
