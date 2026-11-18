import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
const context = { window: {} };
vm.createContext(context);
vm.runInContext(await read('../public/spl-curriculum.js'), context);
vm.runInContext(await read('../public/spl-legacy.js'), context);
const app = await read('../app.js');
const appData = app.slice(0, app.indexOf("const root=document.getElementById('view-root');"));
assert.ok(appData.length > 0, 'Question data section must be present');
vm.runInContext(appData, context);
const exams = vm.runInContext('exams', context);
const curriculum = context.window.SPL_CURRICULUM;

assert.equal(exams.length, 45, 'expected 45 tests');
assert.equal(exams.reduce((sum, exam) => sum + exam.questions.length, 0), 1125, 'expected 1,125 questions');
assert.deepEqual(
  Object.fromEntries(['Düzey 1', 'Düzey 2', 'Düzey 3'].map(level => [level, exams.filter(exam => exam.level === level).length])),
  { 'Düzey 1': 14, 'Düzey 2': 17, 'Düzey 3': 14 },
);

const allPrompts = [];
for (const level of ['Düzey 1', 'Düzey 2', 'Düzey 3']) {
  const levelExams = exams.filter(exam => exam.level === level);
  assert.equal(levelExams.filter(exam => !exam.paid).length, 1, `${level}: exactly one free test`);
  assert.equal(levelExams[0].paid, false, `${level}: first test must be free`);
  assert.ok(levelExams.slice(1).every(exam => exam.paid), `${level}: all remaining tests must be paid`);
  const expectedSubjects = curriculum.levels[level].map(subject => subject.id);
  const presentSubjects = new Set(levelExams.map(exam => exam.curriculumId));
  assert.deepEqual([...presentSubjects].sort(), [...expectedSubjects].sort(), `${level}: every syllabus subject is represented`);
  for (const exam of levelExams) {
    assert.equal(exam.questions.length, 25, `${exam.id}: exactly 25 questions`);
    assert.ok(exam.curriculumTopics.length, `${exam.id}: must list syllabus subtopics`);
    for (const [index, question] of exam.questions.entries()) {
      assert.equal(question.length, 4, `${exam.id} question ${index + 1}: expected prompt/options/answer/explanation`);
      assert.equal(question[1].length, 4, `${exam.id} question ${index + 1}: expected four options`);
      assert.equal(new Set(question[1]).size, 4, `${exam.id} question ${index + 1}: choices must differ`);
      assert.ok(Number.isInteger(question[2]) && question[2] >= 0 && question[2] < 4, `${exam.id} question ${index + 1}: invalid correct-answer index`);
      assert.ok(typeof question[3] === 'string' && question[3].trim(), `${exam.id} question ${index + 1}: missing feedback`);
      allPrompts.push(question[0]);
    }
  }
}
assert.equal(new Set(allPrompts).size, allPrompts.length, 'question prompts must be unique across the bank');
console.log('SPL curriculum validation passed: 45 tests, 1,125 unique questions, 25 subjects, 3 free tests.');
