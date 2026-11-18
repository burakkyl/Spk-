const curriculum = window.SPL_CURRICULUM;
const bank = window.SPL_BANK;
if (!curriculum?.levels || !bank) throw new Error('SPL müfredat veya soru bankası yüklenemedi.');
const letters=['A','B','C','D'];
const QUESTIONS_PER_EXAM=25;
const MIN_FRESH_FOR_EXTRA_EXAM=10;
const LEVELS=['Düzey 1','Düzey 2','Düzey 3'];
const bankAliases={'law-narrow':'law','law-broad':'law'};
// Deterministik karıştırma: aynı sürümde denemelerin içeriği cihazdan cihaza değişmez.
function seededShuffle(list,seedText){let h=2166136261;for(const ch of seedText){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}const rand=()=>{h^=h<<13;h^=h>>>17;h^=h<<5;return ((h>>>0)%100000)/100000};const a=list.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function subjectPool(subject,level){
  const items=(bank[bankAliases[subject.bank]||subject.bank]||[]).filter(item=>!item.l||item.l.includes(level));
  // Önce ilgili düzey için yazılmış veya düzeyden bağımsız sorular, ardından diğer düzeylerin soruları.
  const own=items.filter(item=>!item.p||item.p===level),other=items.filter(item=>item.p&&item.p!==level);
  return [...seededShuffle(own,subject.id+'-own'),...seededShuffle(other,subject.id+'-other')].map(item=>item.q);
}
const exams=[];
const uniqueByLevel={};
for(const level of LEVELS){
  const subjects=curriculum.levels[level];
  let levelExamIndex=0;
  const levelPrompts=new Set();
  subjects.forEach((subject,subjectIndex)=>{
    const pool=subjectPool(subject,level);
    pool.forEach(q=>levelPrompts.add(q[0]));
    // 10’dan az yeni soru kalırsa ayrı (çoğu tekrar) bir deneme açmak yerine kalan sorular son denemeye eklenir.
    const remainder=pool.length%QUESTIONS_PER_EXAM;
    const count=Math.max(1,Math.floor(pool.length/QUESTIONS_PER_EXAM)+(remainder>=MIN_FRESH_FOR_EXTRA_EXAM?1:0));
    for(let setIndex=0;setIndex<count;setIndex++){
      const isLast=setIndex===count-1;
      let questions=pool.slice(setIndex*QUESTIONS_PER_EXAM,isLast&&remainder<MIN_FRESH_FOR_EXTRA_EXAM?pool.length:(setIndex+1)*QUESTIONS_PER_EXAM);
      const fresh=questions.length;
      // Son deneme 25’ten kısa kalırsa aynı dersin diğer sorularıyla tamamlanır (deneme içinde tekrar olmaz).
      if(questions.length<QUESTIONS_PER_EXAM){const used=new Set(questions);questions=[...questions,...pool.filter(q=>!used.has(q)).slice(0,QUESTIONS_PER_EXAM-questions.length)]}
      const serial=setIndex+1;
      exams.push({
        id:`${subject.id}-${serial}`,level,
        title:count>1?`${subject.title} · Deneme ${serial}`:subject.title,
        curriculumId:subject.id,curriculumSubject:subject.title,curriculumTopics:subject.topics,
        description:`Müfredat kapsamı: ${subject.topics.join(' · ')}.${fresh<questions.length?` ${questions.length-fresh} soru önceki denemelerden tekrar.`:''}`,
        icon:['◈','⌁','⌖','◉'][subjectIndex%4],paid:levelExamIndex!==0,questions,freshCount:fresh
      });
      levelExamIndex++;
    }
  });
  uniqueByLevel[level]=levelPrompts.size;
}
const totalUniqueQuestions=new Set(Object.values(bank).flat().map(item=>item.q[0])).size;
const paidExamCount=exams.filter(e=>e.paid).length;

const root=document.getElementById('view-root');
const toastEl=document.getElementById('toast');

// ───────────────────────── Ayarlar ─────────────────────────
// Mağaza fiyatı yüklenemediğinde gösterilen liste fiyatları. App Store Connect ve Google Play Console’daki
// fiyatlar da bunlarla AYNI olmalıdır; mağazadan fiyat gelince her zaman mağaza fiyatı gösterilir.
const PLAN_PRICES={weekly:'250 TL',monthly:'550 TL',lifetime:'3.000 TL'};
const PLAN_INFO={
  weekly:{name:'Haftalık',period:'hafta',caption:'1 haftalık otomatik yenilenen abonelik'},
  monthly:{name:'Aylık',period:'ay',caption:'1 aylık otomatik yenilenen abonelik'},
  lifetime:{name:'Ömür boyu',period:'tek seferlik',caption:'Tek seferlik satın alım, yenilenmez'}
};
const SUBSCRIPTION_TERMS='Ödeme, satın alma onaylandığında Apple Kimliği veya Google Play hesabınızdan tahsil edilir. Haftalık ve aylık abonelikler, mevcut dönemin bitiminden en az 24 saat önce iptal edilmedikçe aynı süre ve ücretle otomatik olarak yenilenir; yenileme ücreti dönemin bitiminden önceki 24 saat içinde tahsil edilir. Aboneliğinizi App Store / Google Play hesap ayarlarınızdan yönetebilir ve otomatik yenilemeyi kapatabilirsiniz. Ömür boyu plan tek seferlik ödemedir ve yenilenmez.';
const APP_VERSION=typeof __APP_VERSION__!=='undefined'?__APP_VERSION__:'1.0.0';
const SUPPORT_EMAIL='tburakkayli@gmail.com';
const LEGAL_TITLES={'gizlilik-politikasi':'Gizlilik Politikası','kullanim-kosullari':'Kullanım Koşulları'};
const SECONDS_PER_QUESTION=72;

// ───────────────────────── Durum ─────────────────────────
let view='home';
let selectedLevel=LEVELS.includes(localStorage.getItem('duzey-level'))?localStorage.getItem('duzey-level'):'Düzey 1';
let introExamId=null;
let introMode='learn';
let run=null;
let lastResult=null;
let reviewFilter='wrong';
let navigatorOpen=false;
let selectedPlan='monthly';
let legalDoc='gizlilik-politikasi',legalHtml='',legalBack='about';
let toastTimer,timerHandle;

const STORE_KEY='duzey-progress',RUN_KEY='duzey-active-run';
const emptyProgress=()=>({attempts:0,correct:0,answered:0,completed:0,byExam:{},best:{},history:[]});
const store={
  get(){try{const d=JSON.parse(localStorage.getItem(STORE_KEY));return d?{...emptyProgress(),...d,byExam:d.byExam||{},best:d.best||{},history:d.history||[]}:emptyProgress()}catch{return emptyProgress()}},
  save(data){try{localStorage.setItem(STORE_KEY,JSON.stringify(data))}catch{}}
};
const savedRun={
  get(){try{const r=JSON.parse(localStorage.getItem(RUN_KEY));return r&&Array.isArray(r.questions)&&exams.some(e=>e.id===r.examId)?r:null}catch{return null}},
  save(r){try{localStorage.setItem(RUN_KEY,JSON.stringify({...r,elapsed:elapsedMs(r),resumedAt:null}))}catch{}},
  clear(){try{localStorage.removeItem(RUN_KEY)}catch{}}
};
const deviceTag=(()=>{try{let tag=localStorage.getItem('duzey-device-tag');if(!tag){tag=(crypto.randomUUID?.()||Math.random().toString(36).slice(2)).replaceAll('-','').slice(0,8).toUpperCase();localStorage.setItem('duzey-device-tag',tag)}return tag}catch{return 'GUEST'}})();

// ───────────────────────── Yardımcılar ─────────────────────────
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const examById=id=>exams.find(e=>e.id===id);
const hasFullAccess=()=>Boolean(window.DuzeyBilling?.hasPremium());
const isLocked=exam=>Boolean(exam.paid)&&!hasFullAccess();
const pctOf=(a,b)=>b?Math.round(a/b*100):0;
function elapsedMs(r){return (r.elapsed||0)+(r.resumedAt?Date.now()-r.resumedAt:0)}
function formatDuration(ms){const total=Math.max(0,Math.round(ms/1000)),m=Math.floor(total/60),s=total%60;return m?`${m} dk ${String(s).padStart(2,'0')} sn`:`${s} sn`}
function clock(ms){const total=Math.max(0,Math.floor(ms/1000));return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`}
function shortTitle(exam){return exam.title.replace(/^\d+\.\s*/,'')}
function examNumber(exam){const m=exam.title.match(/Deneme (\d+)$/);return m?Number(m[1]):1}
function subjectTitle(exam){return exam.curriculumSubject.replace(/^\d+\.\s*/,'')}
function scoreTone(p){return p>=70?'good':p>=50?'mid':'low'}
function showToast(message){toastEl.textContent=message;toastEl.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toastEl.classList.remove('show'),3000)}
function ring(p,size=120,label=`${p}%`,sub=''){const tone=scoreTone(p);return `<div class="ring ring-${tone}" style="--p:${p};--size:${size}px"><div class="ring-inner"><strong>${label}</strong>${sub?`<span>${sub}</span>`:''}</div></div>`}
const icons={
  check:'<svg viewBox="0 0 24 24" class="ic"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
  cross:'<svg viewBox="0 0 24 24" class="ic"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  flag:'<svg viewBox="0 0 24 24" class="ic"><path d="M5 21V4h11l-1.5 4L16 12H5"/></svg>',
  clock:'<svg viewBox="0 0 24 24" class="ic"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  lock:'<svg viewBox="0 0 24 24" class="ic"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  play:'<svg viewBox="0 0 24 24" class="ic"><path d="M8 5v14l11-7z"/></svg>',
  back:'<svg viewBox="0 0 24 24" class="ic"><path d="M15 5l-7 7 7 7"/></svg>',
  next:'<svg viewBox="0 0 24 24" class="ic"><path d="m9 5 7 7-7 7"/></svg>',
  grid:'<svg viewBox="0 0 24 24" class="ic"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg>',
  retry:'<svg viewBox="0 0 24 24" class="ic"><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4"/></svg>',
  book:'<svg viewBox="0 0 24 24" class="ic"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5"/></svg>',
  bolt:'<svg viewBox="0 0 24 24" class="ic"><path d="M13 3 5 13h6l-1 8 8-10h-6z"/></svg>',
  star:'<svg viewBox="0 0 24 24" class="ic"><path d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7z"/></svg>'
};

// ───────────────────────── Gezinme ─────────────────────────
function setView(next,{push=true}={}){
  if(view==='quiz'&&next!=='quiz'&&run){pauseRun();run=null}
  view=next;
  if(push)try{history.pushState({view:next},'',`#${next}`)}catch{}
  render();
  try{window.scrollTo(0,0)}catch{}
}
window.addEventListener('popstate',e=>{
  const next=e.state?.view||'home';
  if(document.querySelector('.modal-backdrop'))document.querySelector('.modal-backdrop').remove();
  if(next==='quiz'){if(savedRun.get())resumeRun({push:false});else setView('home',{push:false});return}
  if(view==='quiz'&&run)showToast('İlerlemen kaydedildi. Kaldığın yerden devam edebilirsin.');
  setView(next,{push:false});
});

// ───────────────────────── Kartlar ─────────────────────────
function examStatus(exam,progress){const best=progress.best[exam.id];const times=progress.byExam[exam.id]||0;return {best,times,locked:isLocked(exam)}}
function examCard(exam,progress){
  const {best,times,locked}=examStatus(exam,progress);
  const badge=locked?`<span class="badge badge-lock">${icons.lock} Plus</span>`:exam.paid?'<span class="badge badge-plus">Plus</span>':'<span class="badge badge-free">Ücretsiz</span>';
  const resume=savedRun.get();const resuming=resume?.examId===exam.id&&!resume.practice;
  return `<article class="exam-card ${locked?'is-locked':''}" data-open-exam="${exam.id}" tabindex="0" role="button" aria-label="${esc(exam.title)}">
    <div class="exam-card-top">${badge}<span class="exam-num">${exam.level} · Deneme ${examNumber(exam)}</span></div>
    <h3>${esc(subjectTitle(exam))}</h3>
    <div class="exam-meta"><span>${exam.questions.length} soru</span><span>~${Math.round(exam.questions.length*SECONDS_PER_QUESTION/60)} dk</span>${times?`<span>${times} kez çözüldü</span>`:''}</div>
    ${best!=null?`<div class="best-row"><div class="bar"><i class="tone-${scoreTone(best)}" style="width:${best}%"></i></div><b>En iyi %${best}</b></div>`:'<div class="best-row muted-row">Henüz çözülmedi</div>'}
    <span class="exam-cta">${locked?'Kilidi aç':resuming?'Devam et':times?'Tekrar çöz':'Başla'} ${icons.next}</span>
  </article>`;
}

// ───────────────────────── Ana sayfa ─────────────────────────
function renderHome(){
  const p=store.get();const resume=savedRun.get();const percent=pctOf(p.correct,p.answered);
  const hour=new Date().getHours();const greet=hour<12?'Günaydın':hour<18?'İyi günler':'İyi akşamlar';
  const levelCards=LEVELS.map(level=>{
    const list=exams.filter(e=>e.level===level);const done=list.filter(e=>p.best[e.id]!=null).length;const subjects=curriculum.levels[level].length;
    return `<button class="level-card" data-go-level="${level}"><div class="level-card-head"><span class="level-chip">${level}</span><span class="level-count">${list.length} deneme</span></div><strong>${subjects} ders · ${uniqueByLevel[level]} soru</strong><div class="bar"><i style="width:${pctOf(done,list.length)}%"></i></div><span class="level-foot">${done}/${list.length} deneme çözüldü</span></button>`;
  }).join('');
  const recent=p.history.slice(0,3);
  return `
  <section class="home-hero">
    <div class="home-hero-text">
      <div class="eyebrow light">${new Date().toLocaleDateString('tr-TR',{weekday:'long',day:'numeric',month:'long'})}</div>
      <h1>${greet} 👋</h1>
      <p>SPL lisans sınavına bugün bir deneme daha çözerek hazırlan.</p>
      <div class="hero-actions"><button class="btn btn-light" data-view="exams">${icons.play} Deneme çöz</button>${p.history.length?'<button class="btn btn-ghost-light" data-view="progress">İlerlememi gör</button>':''}</div>
    </div>
    <div class="hero-stats">
      ${ring(percent,112,`%${percent}`,'başarı')}
      <div class="hero-stat-list"><div><strong>${p.completed}</strong><span>deneme</span></div><div><strong>${p.answered}</strong><span>soru</span></div></div>
    </div>
  </section>
  ${resume?resumeCard(resume):''}
  <div class="section-head"><h2>Lisans düzeyleri</h2></div>
  <div class="level-grid">${levelCards}</div>
  <div class="section-head"><h2>Ücretsiz denemeler</h2><button class="link" data-view="exams">Tümünü gör →</button></div>
  <div class="card-grid">${exams.filter(x=>!x.paid).map(e=>examCard(e,p)).join('')}</div>
  ${recent.length?`<div class="section-head"><h2>Son sonuçlar</h2><button class="link" data-view="progress">Tümü →</button></div><div class="history-list">${recent.map(historyRow).join('')}</div>`:''}
  ${hasFullAccess()?'':`<section class="plus-banner"><div><div class="eyebrow">Düzey Plus</div><h3>${paidExamCount} denemenin kilidini aç</h3><p>Üç düzeyin tüm derslerine erişim · haftalık ${planPrice('weekly')}’den başlayan fiyatlarla</p></div><button class="btn btn-primary" data-view="premium">Planları incele</button></section>`}`;
}
function resumeCard(r){const answered=r.answers.filter(a=>a!==null).length;return `<section class="resume-card"><div class="resume-icon">${icons.play}</div><div class="resume-text"><div class="eyebrow">Yarım kalan deneme</div><strong>${esc(r.title)}</strong><span>${r.level} · ${answered}/${r.questions.length} soru yanıtlandı · ${r.mode==='exam'?'Sınav modu':'Öğrenme modu'}</span><div class="bar"><i style="width:${pctOf(answered,r.questions.length)}%"></i></div></div><div class="resume-actions"><button class="btn btn-primary" data-action="resume">Devam et</button><button class="btn btn-text" data-action="discard-run">Sil</button></div></section>`}
function historyRow(h){const p=pctOf(h.correct,h.total);const d=new Date(h.date);return `<div class="history-row"><span class="score-chip tone-${scoreTone(p)}">%${p}</span><div class="history-text"><strong>${esc(h.title)}</strong><span>${h.level} · ${d.toLocaleDateString('tr-TR',{day:'numeric',month:'short'})} · ${h.correct}/${h.total} doğru${h.ms?` · ${formatDuration(h.ms)}`:''}</span></div>${examById(h.examId)?`<button class="btn btn-small" data-open-exam="${h.examId}">Tekrar</button>`:''}</div>`}

// ───────────────────────── Denemeler ─────────────────────────
function renderExams(){
  const p=store.get();const levelExams=exams.filter(e=>e.level===selectedLevel);
  const groups=[];for(const e of levelExams){let g=groups.find(x=>x.id===e.curriculumId);if(!g){g={id:e.curriculumId,title:e.curriculumSubject,topics:e.curriculumTopics,list:[]};groups.push(g)}g.list.push(e)}
  return `
  <section class="page-head"><div><div class="eyebrow">SPL müfredatına göre</div><h1>Denemeler</h1><p>${levelExams.length} deneme · ${uniqueByLevel[selectedLevel]} benzersiz soru. Her düzeyde ilk deneme ücretsizdir.</p></div></section>
  <div class="segmented" role="tablist" aria-label="Düzey seç">${LEVELS.map(level=>`<button role="tab" aria-selected="${selectedLevel===level}" class="${selectedLevel===level?'active':''}" data-level="${level}">${level}</button>`).join('')}</div>
  ${groups.map(g=>`<section class="subject-group"><div class="subject-head"><h2>${esc(g.title)}</h2><p>${g.topics.map(esc).join(' · ')}</p></div><div class="card-grid">${g.list.map(e=>examCard(e,p)).join('')}</div></section>`).join('')}
  <p class="note">Sorular özgün çalışma içeriğidir; resmî SPK/SPL sınav sorusu değildir ve uygulamanın SPK veya SPL ile bağlantısı yoktur.</p>`;
}

// ───────────────────────── Deneme giriş ekranı ─────────────────────────
function openExam(id){
  const exam=examById(id);if(!exam)return;
  if(isLocked(exam)){setView('premium');showToast('Bu deneme Düzey Plus ile açılır.');return}
  introExamId=id;const r=savedRun.get();introMode=r?.examId===id?r.mode:introMode;setView('intro');
}
function renderIntro(){
  const exam=examById(introExamId);if(!exam)return renderExams();
  const p=store.get();const {best,times}=examStatus(exam,p);const r=savedRun.get();const resumable=r&&r.examId===exam.id&&!r.practice;
  const answered=resumable?r.answers.filter(a=>a!==null).length:0;
  const minutes=Math.round(exam.questions.length*SECONDS_PER_QUESTION/60);
  return `
  <button class="back-link" data-view="exams">${icons.back} Denemeler</button>
  <section class="intro-card">
    <div class="intro-head"><span class="level-chip">${exam.level}</span><span class="exam-num">Deneme ${examNumber(exam)}</span></div>
    <h1>${esc(subjectTitle(exam))}</h1>
    <div class="intro-facts"><div><strong>${exam.questions.length}</strong><span>soru</span></div><div><strong>~${minutes}</strong><span>dakika</span></div><div><strong>${best!=null?'%'+best:'—'}</strong><span>en iyi skor</span></div><div><strong>${times}</strong><span>kez çözüldü</span></div></div>
    <div class="topic-chips">${exam.curriculumTopics.map(t=>`<span>${esc(t)}</span>`).join('')}</div>
    ${exam.freshCount<exam.questions.length?`<p class="note left">Bu denemedeki ${exam.questions.length-exam.freshCount} soru aynı dersin önceki denemelerinde de yer alır.</p>`:''}
    <h2 class="intro-sub">Nasıl çözmek istersin?</h2>
    <div class="mode-grid" role="radiogroup">
      <button class="mode-card ${introMode==='learn'?'active':''}" data-mode="learn" role="radio" aria-checked="${introMode==='learn'}"><span class="mode-icon">${icons.book}</span><strong>Öğrenme modu</strong><span>Her sorudan sonra doğru cevabı ve açıklamasını hemen gör.</span></button>
      <button class="mode-card ${introMode==='exam'?'active':''}" data-mode="exam" role="radio" aria-checked="${introMode==='exam'}"><span class="mode-icon">${icons.clock}</span><strong>Sınav modu</strong><span>Gerçek sınav gibi çöz, cevaplarını değiştirebil; sonuçları en sonda gör.</span></button>
    </div>
    <div class="intro-actions">
      ${resumable?`<button class="btn btn-primary btn-lg" data-action="resume">${icons.play} Kaldığın yerden devam et <small>${answered}/${exam.questions.length}</small></button><button class="btn btn-outline btn-lg" data-action="start-exam">Baştan başla</button>`:`<button class="btn btn-primary btn-lg" data-action="start-exam">${icons.play} Denemeye başla</button>`}
    </div>
    <p class="hint-line">İpucu: Klavyede 1–4 (veya A–D) ile seçenek işaretleyebilir, ← → ile sorular arasında gezinebilirsin. İlerlemen otomatik kaydedilir.</p>
  </section>`;
}

// ───────────────────────── Deneme çözme ─────────────────────────
function shuffleOptions(q){const order=[0,1,2,3];for(let i=order.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]]}return [q[0],order.map(i=>q[1][i]),order.indexOf(q[2]),q[3]]}
function startRun({exam,questions,mode,practice=false,title}){
  run={examId:exam.id,title:title||shortTitle(exam),level:exam.level,mode,practice,questions:questions.map(shuffleOptions),answers:questions.map(()=>null),flags:questions.map(()=>false),index:0,elapsed:0,resumedAt:Date.now(),startedAt:Date.now()};
  navigatorOpen=false;savedRun.save(run);setView('quiz');startTimer();
}
function resumeRun(opts={}){const r=savedRun.get();if(!r)return;const exam=examById(r.examId);if(!exam)return;if(isLocked(exam)){setView('premium');return}run={...r,resumedAt:Date.now()};navigatorOpen=false;setView('quiz',opts);startTimer()}
function pauseRun(){if(!run)return;savedRun.save(run);run.elapsed=elapsedMs(run);run.resumedAt=null;stopTimer()}
function startTimer(){stopTimer();timerHandle=setInterval(()=>{const el=document.getElementById('quiz-timer');if(el&&run)el.textContent=clock(elapsedMs(run))},1000)}
function stopTimer(){clearInterval(timerHandle)}
function persist(){if(run)savedRun.save(run)}

function navDot(i){const a=run.answers[i],q=run.questions[i];let cls='';if(a!==null)cls=run.mode==='learn'?(a===q[2]?'is-correct':'is-wrong'):'is-answered';return `<button class="nav-dot ${cls} ${i===run.index?'is-current':''} ${run.flags[i]?'is-flagged':''}" data-goto="${i}" aria-label="Soru ${i+1}">${i+1}</button>`}
function renderQuiz(){
  if(!run)return renderHome();
  const n=run.questions.length,i=run.index,q=run.questions[i],sel=run.answers[i];
  const answeredCount=run.answers.filter(a=>a!==null).length;
  const reveal=run.mode==='learn'&&sel!==null;
  const correct=reveal&&sel===q[2];
  const learnCorrect=run.mode==='learn'?run.answers.filter((a,k)=>a!==null&&a===run.questions[k][2]).length:0;
  const options=q[1].map((opt,k)=>{let cls='';let tag='';
    if(reveal){if(k===q[2]){cls='correct';tag=`<span class="opt-tag good">${icons.check} Doğru cevap</span>`}else if(k===sel){cls='wrong';tag=`<span class="opt-tag bad">${icons.cross} Senin cevabın</span>`}else cls='dim'}
    else if(k===sel)cls='selected';
    return `<button class="option ${cls}" data-answer="${k}" ${reveal?'disabled':''} aria-pressed="${k===sel}"><span class="option-letter">${letters[k]}</span><span class="option-text">${esc(opt)}</span>${tag}</button>`}).join('');
  const isLast=i===n-1;
  return `
  <div class="quiz">
    <header class="quiz-bar">
      <button class="icon-btn" data-action="leave-quiz" aria-label="Denemeden çık">${icons.back}</button>
      <div class="quiz-title"><strong>${esc(run.title)}</strong><span>${run.level} · ${run.mode==='exam'?'Sınav modu':'Öğrenme modu'}${run.practice?' · Tekrar':''}</span></div>
      <span class="timer">${icons.clock}<span id="quiz-timer">${clock(elapsedMs(run))}</span></span>
    </header>
    <div class="quiz-progress"><div class="bar thick"><i style="width:${pctOf(answeredCount,n)}%"></i></div><span>${answeredCount}/${n} yanıtlandı${run.mode==='learn'&&answeredCount?` · ${learnCorrect} doğru`:''}</span></div>
    <div class="quiz-layout">
      <section class="question-card">
        <div class="question-top"><span class="q-count">Soru <b>${i+1}</b> / ${n}</span><button class="flag-btn ${run.flags[i]?'active':''}" data-action="flag" aria-pressed="${run.flags[i]}">${icons.flag} ${run.flags[i]?'İşaretlendi':'Sonra bak'}</button></div>
        <h2 class="question-text">${esc(q[0])}</h2>
        <div class="options">${options}</div>
        ${reveal?`<div class="feedback ${correct?'good':'bad'}"><div class="feedback-title">${correct?`${icons.check} Doğru!`:`${icons.cross} Yanlış — doğru cevap ${letters[q[2]]}`}</div><p>${esc(q[3])}</p></div>`:''}
        <div class="quiz-nav">
          <button class="btn btn-outline" data-action="prev" ${i===0?'disabled':''}>${icons.back} Önceki</button>
          <button class="btn btn-outline nav-toggle" data-action="toggle-nav">${icons.grid} Sorular</button>
          ${isLast?`<button class="btn btn-primary" data-action="finish">Testi bitir</button>`:`<button class="btn ${sel!==null?'btn-primary':'btn-outline'}" data-action="next">${sel===null?'Boş geç':'Sonraki'} ${icons.next}</button>`}
        </div>
        <div class="watermark">Düzey eğitim içeriği · Cihaz ${deviceTag}</div>
      </section>
      <aside class="quiz-side ${navigatorOpen?'open':''}">
        <div class="side-card">
          <div class="side-head"><strong>Soru listesi</strong><button class="icon-btn small nav-close" data-action="toggle-nav" aria-label="Kapat">${icons.cross}</button></div>
          <div class="nav-grid">${run.questions.map((_,k)=>navDot(k)).join('')}</div>
          <div class="legend">${run.mode==='learn'?'<span><i class="lg-correct"></i>Doğru</span><span><i class="lg-wrong"></i>Yanlış</span>':'<span><i class="lg-answered"></i>Yanıtlandı</span>'}<span><i class="lg-empty"></i>Boş</span><span><i class="lg-flag"></i>İşaretli</span></div>
          <button class="btn btn-primary btn-block" data-action="finish">Testi bitir</button>
        </div>
      </aside>
    </div>
  </div>`;
}
function selectAnswer(k){
  if(!run)return;const i=run.index;
  if(run.mode==='learn'&&run.answers[i]!==null)return;
  run.answers[i]=run.mode==='exam'&&run.answers[i]===k?null:k;
  persist();render();
  if(run.mode==='exam'&&run.answers[i]!==null&&i<run.questions.length-1)setTimeout(()=>{if(run&&run.index===i&&view==='quiz'){run.index++;persist();render();scrollQuizTop()}},280);
  else if(run.mode==='learn')document.querySelector('.feedback')?.scrollIntoView?.({behavior:'smooth',block:'nearest'});
}
function scrollQuizTop(){document.querySelector('.quiz')?.scrollIntoView?.({behavior:'smooth',block:'start'})}
function goTo(i){if(!run)return;run.index=Math.max(0,Math.min(run.questions.length-1,i));navigatorOpen=false;persist();render();scrollQuizTop()}
function requestFinish(){
  if(!run)return;const blank=run.answers.filter(a=>a===null).length;const flagged=run.flags.filter(Boolean).length;
  if(!blank&&!flagged){finishRun();return}
  const parts=[];if(blank)parts.push(`<b>${blank}</b> soruyu boş bıraktın`);if(flagged)parts.push(`<b>${flagged}</b> soru “sonra bak” olarak işaretli`);
  showDialog({title:'Testi bitirmek istiyor musun?',body:`<p>${parts.join(' ve ')}. Boş sorular yanlış sayılmaz, ayrıca listelenir.</p>`,confirm:'Testi bitir',cancel:'Sorulara dön',onConfirm:finishRun,onCancel:()=>{const first=run.answers.findIndex(a=>a===null);goTo(first>=0?first:run.flags.findIndex(Boolean))}});
}
function finishRun(){
  if(!run)return;stopTimer();
  const ms=elapsedMs(run);
  const items=run.questions.map((q,i)=>{const a=run.answers[i];return {i,q,selected:a,flag:run.flags[i],status:a===null?'blank':a===q[2]?'correct':'wrong'}});
  const correct=items.filter(x=>x.status==='correct').length,wrong=items.filter(x=>x.status==='wrong').length,blank=items.filter(x=>x.status==='blank').length;
  lastResult={examId:run.examId,title:run.title,level:run.level,mode:run.mode,practice:run.practice,items,correct,wrong,blank,total:items.length,ms};
  if(!run.practice){
    const p=store.get();p.completed++;p.attempts++;p.answered+=items.length;p.correct+=correct;
    p.byExam[run.examId]=(p.byExam[run.examId]||0)+1;
    const pct=pctOf(correct,items.length);const prevBest=p.best[run.examId];p.best[run.examId]=Math.max(prevBest??0,pct);lastResult.newBest=prevBest!=null&&pct>prevBest;
    p.history.unshift({examId:run.examId,title:run.title,level:run.level,date:Date.now(),correct,total:items.length,ms});p.history=p.history.slice(0,50);
    store.save(p);
  }
  savedRun.clear();run=null;
  reviewFilter=wrong?'wrong':blank?'blank':'all';
  setView('result');
}

// ───────────────────────── Sonuç ─────────────────────────
function resultMessage(p){if(p>=90)return ['Muhteşem! 🏆','Bu konuya gerçekten hâkimsin.'];if(p>=75)return ['Çok iyi! 🎉','Sınav seviyesine çok yakınsın.'];if(p>=60)return ['İyi gidiyorsun 👍','Birkaç konuyu tekrar edersen hazır olacaksın.'];if(p>=40)return ['Gelişiyorsun 💪','Yanlışlarını inceleyip tekrar dene.'];return ['Pes etmek yok 🌱','Açıklamaları okuyup öğrenme moduyla tekrar çöz.']}
function renderResult(){
  const r=lastResult;if(!r)return renderHome();
  const p=pctOf(r.correct,r.total);const [title,sub]=resultMessage(p);
  const wrongItems=r.items.filter(x=>x.status==='wrong'),blankItems=r.items.filter(x=>x.status==='blank'),flagItems=r.items.filter(x=>x.flag);
  const lists={wrong:wrongItems,blank:blankItems,flag:flagItems,all:r.items};
  const shown=lists[reviewFilter]||r.items;
  const tabs=[['wrong','Yanlışlar',wrongItems.length],['blank','Boşlar',blankItems.length],['flag','İşaretliler',flagItems.length],['all','Tümü',r.items.length]].filter(([id,,c])=>c||id==='all'||id==='wrong');
  const retryCount=wrongItems.length+blankItems.length;
  return `
  <button class="back-link" data-view="exams">${icons.back} Denemeler</button>
  <section class="result-hero tone-bg-${scoreTone(p)}">
    ${ring(p,150,`${r.correct}/${r.total}`,`%${p} başarı`)}
    <div class="result-text">
      <div class="eyebrow">${esc(r.level)} · ${esc(r.title)}${r.practice?' · Tekrar':''}</div>
      <h1>${r.total} sorudan ${r.correct} tanesini bildin!</h1>
      <p class="result-sub"><b>${title}</b> ${sub}</p>
      <div class="result-pills"><span class="pill good">${icons.check} ${r.correct} doğru</span><span class="pill bad">${icons.cross} ${r.wrong} yanlış</span>${r.blank?`<span class="pill neutral">${r.blank} boş</span>`:''}<span class="pill neutral">${icons.clock} ${formatDuration(r.ms)}</span>${r.newBest?'<span class="pill gold">★ Yeni rekor</span>':''}</div>
    </div>
  </section>
  ${wrongItems.length?`<section class="wrong-summary"><strong>Şu soruları yanlış yaptın:</strong><div class="chip-row">${wrongItems.map(x=>`<button class="q-chip bad" data-jump="${x.i}">Soru ${x.i+1}</button>`).join('')}</div>${blankItems.length?`<strong>Boş bıraktıkların:</strong><div class="chip-row">${blankItems.map(x=>`<button class="q-chip neutral" data-jump="${x.i}">Soru ${x.i+1}</button>`).join('')}</div>`:''}</section>`:blankItems.length?`<section class="wrong-summary"><strong>Hiç yanlışın yok! Boş bıraktıkların:</strong><div class="chip-row">${blankItems.map(x=>`<button class="q-chip neutral" data-jump="${x.i}">Soru ${x.i+1}</button>`).join('')}</div></section>`:`<section class="wrong-summary perfect">🎉 Tüm soruları doğru cevapladın. Harika iş!</section>`}
  <div class="result-actions">
    ${retryCount?`<button class="btn btn-primary" data-action="retry-wrong">${icons.retry} Yanlış ve boşları tekrar çöz (${retryCount})</button>`:''}
    ${examById(r.examId)&&!r.practice?`<button class="btn btn-outline" data-action="retry">${icons.retry} Baştan çöz</button>`:''}
    <button class="btn btn-outline" data-view="exams">Diğer denemeler</button>
  </div>
  <section class="review">
    <div class="review-head"><h2>Cevap anahtarı ve açıklamalar</h2><div class="tabs">${tabs.map(([id,label,c])=>`<button class="${reviewFilter===id?'active':''}" data-filter="${id}">${label} <span>${c}</span></button>`).join('')}</div></div>
    ${shown.length?shown.map(reviewItem).join(''):`<div class="empty">${reviewFilter==='wrong'?'Bu denemede yanlışın yok 🎉':'Bu filtrede soru yok.'}</div>`}
  </section>`;
}
function reviewItem(x){
  const [prompt,opts,ans,expl]=x.q;const statusLabel={correct:'Doğru',wrong:'Yanlış',blank:'Boş'}[x.status];
  return `<article class="review-item ${x.status}" id="review-${x.i}">
    <div class="review-top"><span class="q-num">Soru ${x.i+1}</span><span class="status-tag ${x.status}">${x.status==='correct'?icons.check:x.status==='wrong'?icons.cross:''} ${statusLabel}</span>${x.flag?`<span class="status-tag flag">${icons.flag} İşaretli</span>`:''}</div>
    <h3>${esc(prompt)}</h3>
    <ul class="review-options">${opts.map((o,k)=>{const isAns=k===ans,isSel=k===x.selected;return `<li class="${isAns?'ans':''} ${isSel&&!isAns?'sel':''}"><span class="option-letter">${letters[k]}</span><span>${esc(o)}</span>${isAns?`<em class="good">${icons.check} Doğru cevap</em>`:''}${isSel&&!isAns?`<em class="bad">${icons.cross} Senin cevabın</em>`:''}</li>`}).join('')}</ul>
    ${x.status==='blank'?'<p class="blank-note">Bu soruyu boş bıraktın.</p>':''}
    <div class="explain"><strong>Açıklama</strong><p>${esc(expl)}</p></div>
  </article>`;
}

// ───────────────────────── İlerleme ─────────────────────────
function renderProgress(){
  const p=store.get();const percent=pctOf(p.correct,p.answered);
  if(!p.completed)return `<section class="page-head"><div><div class="eyebrow">Kendi gelişimini gör</div><h1>İlerlemem</h1></div></section><div class="empty big"><div class="empty-icon">${icons.bolt}</div><h3>İlk adımını at</h3><p>Henüz tamamlanmış denemen yok. Bir deneme çöz; başarı oranın, düzey bazında ilerlemen ve geçmiş sonuçların burada görünsün.</p><button class="btn btn-primary" data-view="exams">Denemeleri keşfet</button></div>`;
  const levels=LEVELS.map(level=>{const list=exams.filter(e=>e.level===level);const tried=list.filter(e=>p.best[e.id]!=null);const avg=tried.length?Math.round(tried.reduce((s,e)=>s+p.best[e.id],0)/tried.length):0;return `<div class="level-progress"><div class="lp-head"><strong>${level}</strong><span>${tried.length}/${list.length} deneme</span></div><div class="bar thick"><i class="tone-${scoreTone(avg)}" style="width:${pctOf(tried.length,list.length)}%"></i></div><span class="lp-foot">${tried.length?`Ortalama en iyi skor %${avg}`:'Henüz deneme çözülmedi'}</span></div>`}).join('');
  return `
  <section class="page-head"><div><div class="eyebrow">Kendi gelişimini gör</div><h1>İlerlemem</h1><p>İstatistiklerin yalnızca bu cihazda saklanır.</p></div></section>
  <div class="stats-grid">
    <div class="stat-card big">${ring(percent,104,`%${percent}`,'başarı')}<div><strong>Genel başarı</strong><span>${p.answered} sorudan ${p.correct} doğru</span></div></div>
    <div class="stat-card"><span class="stat-label">Tamamlanan deneme</span><strong class="stat-value">${p.completed}</strong></div>
    <div class="stat-card"><span class="stat-label">Yanıtlanan soru</span><strong class="stat-value">${p.answered}</strong></div>
  </div>
  <div class="section-head"><h2>Düzeylere göre</h2></div>
  <div class="level-progress-grid">${levels}</div>
  <div class="section-head"><h2>Geçmiş sonuçlar</h2></div>
  <div class="history-list">${p.history.length?p.history.slice(0,20).map(historyRow).join(''):'<div class="empty">Kayıtlı sonuç yok.</div>'}</div>`;
}

// ───────────────────────── Düzey Plus ─────────────────────────
function planPrice(key){return window.DuzeyBilling?.getPrice(key)||PLAN_PRICES[key]}
function renderPremium(){
  const billing=window.DuzeyBilling;const native=Boolean(billing?.native);const ready=Boolean(billing?.ready);const access=hasFullAccess();
  let status='';
  if(!native)status='Satın alma yalnızca App Store veya Google Play’den indirilen uygulamada yapılabilir.';
  else if(!ready)status=`Mağaza ürünleri yüklenemedi. İnternet bağlantını kontrol edip tekrar dene. <button class="link" data-action="reload-billing">Tekrar dene</button>`;
  const plans=[
    {key:'weekly',badge:'',note:'Kısa süreli tekrar için'},
    {key:'monthly',badge:'En popüler',note:'Haftalık plana göre ~%49 tasarruf'},
    {key:'lifetime',badge:'En avantajlı',note:'Bir kez öde, sınırsız kullan'}
  ];
  const canBuy=Boolean(billing?.canPurchase(selectedPlan));
  return `
  <section class="premium-hero">
    <div class="eyebrow light">✦ Düzey Plus</div>
    <h1>${access?'Plus erişimin aktif 🎉':'Sınava tam hazırlan'}</h1>
    <p>${access?'Tüm denemeler açık. Aboneliğini mağaza hesap ayarlarından yönetebilirsin.':'Üç lisans düzeyinin tüm derslerindeki denemelerin kilidini aç.'}</p>
    <ul class="benefits"><li>${icons.check} ${exams.length} denemenin tamamı (${paidExamCount} kilitli deneme)</li><li>${icons.check} ${totalUniqueQuestions} benzersiz soru ve açıklamaları</li><li>${icons.check} Yanlışları tekrar çözme ve ayrıntılı sonuç analizi</li><li>${icons.check} Üyelik yok, reklam yok</li></ul>
  </section>
  ${status?`<p class="status-note">${status}</p>`:''}
  ${access?'':`<div class="plan-list" role="radiogroup" aria-label="Plan seç">${plans.map(pl=>{const info=PLAN_INFO[pl.key];const active=selectedPlan===pl.key;return `<button class="plan ${active?'active':''}" data-plan-select="${pl.key}" role="radio" aria-checked="${active}">${pl.badge?`<span class="plan-badge">${pl.badge}</span>`:''}<span class="radio"></span><span class="plan-main"><strong>${info.name}</strong><span>${pl.note}</span></span><span class="plan-price"><strong>${esc(planPrice(pl.key))}</strong><span>${pl.key==='lifetime'?'tek seferlik':'/ '+info.period}</span></span></button>`}).join('')}</div>
  <button class="btn btn-primary btn-lg btn-block" data-action="purchase" ${canBuy?'':'disabled'}>${canBuy?`${PLAN_INFO[selectedPlan].name} planla devam et · ${esc(planPrice(selectedPlan))}`:native?'Plan şu anda mağazadan yüklenemedi':'Uygulama mağazasından satın alınabilir'}</button>
  <p class="plan-caption">${PLAN_INFO[selectedPlan].caption}.</p>`}
  <p class="terms">${SUBSCRIPTION_TERMS}</p>
  ${legalLinks()}
  <div class="center"><button class="link" data-action="restore">Satın alımları geri yükle</button></div>`;
}
function legalLinks(){return `<div class="legal-links"><button class="link" data-legal="kullanim-kosullari">Kullanım Koşulları (EULA)</button><span>·</span><button class="link" data-legal="gizlilik-politikasi">Gizlilik Politikası</button></div>`}
function purchaseSelected(){
  const plan=selectedPlan;
  if(!window.DuzeyBilling?.canPurchase(plan)){showToast('Bu plan şu anda mağazadan yüklenemedi. Lütfen daha sonra tekrar dene.');return}
  window.DuzeyBilling.purchase(plan).then(()=>render()).catch(err=>{if(err?.userCancelled||err?.code==='1'||/cancel/i.test(err?.message||''))return;showToast('Satın alma tamamlanamadı. Lütfen tekrar dene.')});
}

// ───────────────────────── Hakkında ve yasal ─────────────────────────
function openLegal(doc){legalBack=view==='legal'?legalBack:view;legalDoc=doc;legalHtml='<p>Yükleniyor…</p>';setView('legal');fetch(`./legal/${doc}.html`).then(r=>{if(!r.ok)throw new Error(r.status);return r.text()}).then(text=>{const m=new DOMParser().parseFromString(text,'text/html').querySelector('main');legalHtml=m?m.innerHTML:text;if(view==='legal')render()}).catch(()=>{legalHtml='<p>Metin yüklenemedi. İnternet bağlantınızı kontrol edin.</p>';if(view==='legal')render()})}
function renderLegal(){return `<button class="back-link" data-view="${legalBack}">${icons.back} Geri</button><article class="legal-doc">${legalHtml}</article>`}
function renderAbout(){return `
  <section class="page-head"><div><div class="eyebrow">Uygulama hakkında</div><h1>Hakkında</h1><p>Düzey, SPL lisans sınavlarının Düzey 1, Düzey 2 ve Düzey 3 konularına yönelik bağımsız bir çalışma uygulamasıdır.</p></div></section>
  <div class="about-grid">
    <section class="about-card highlight"><h3>Resmî kurumlarla bağlantı yoktur</h3><p>Bu uygulamanın Sermaye Piyasası Kurulu (SPK), Sermaye Piyasası Lisanslama Sicil ve Eğitim Kuruluşu (SPL) veya herhangi bir kamu kurumuyla bağlantısı, ortaklığı ya da onayı yoktur. Sorular özgün çalışma içeriğidir; resmî sınav soruları değildir.</p><p>Resmî sınav duyuruları, müfredat ve mevzuatın güncel metni için:</p><ul><li><a href="https://www.spl.com.tr" target="_blank" rel="noopener">spl.com.tr</a> — sınav takvimi ve konu başlıkları</li><li><a href="https://spk.gov.tr" target="_blank" rel="noopener">spk.gov.tr</a> — kanun, tebliğ ve kurul kararları</li><li><a href="https://www.mevzuat.gov.tr" target="_blank" rel="noopener">mevzuat.gov.tr</a> — kanunların güncel metinleri</li></ul><p class="muted">Mevzuat ve oranlar değişebilir; içerik güncelliği garanti edilmez ve yatırım tavsiyesi değildir.</p></section>
    <section class="about-card"><h3>İçerik</h3><p>${totalUniqueQuestions} benzersiz soru · ${exams.length} deneme</p><p>Düzey 1: ${uniqueByLevel['Düzey 1']} soru · Düzey 2: ${uniqueByLevel['Düzey 2']} soru · Düzey 3: ${uniqueByLevel['Düzey 3']} soru</p><p>Hatalı veya güncelliğini yitirmiş bir soru gördüysen bize bildir: <a href="mailto:${SUPPORT_EMAIL}?subject=D%C3%BCzey%20soru%20bildirimi">${SUPPORT_EMAIL}</a></p></section>
    <section class="about-card"><h3>Gizlilik ve veriler</h3><p>Hesap açılmaz. İlerlemen yalnızca bu cihazda saklanır; reklam ve takip yoktur.</p>${legalLinks()}<button class="btn btn-outline btn-small" data-action="reset-progress">İlerlememi sıfırla</button></section>
    <section class="about-card"><h3>Destek</h3><p>Soru, öneri ve satın alma destek talepleri: <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p><p class="muted">Sürüm ${APP_VERSION}</p><button class="link" data-action="restore">Satın alımları geri yükle</button></section>
  </div>`}

// ───────────────────────── Diyalog ─────────────────────────
function showDialog({title,body,confirm='Tamam',cancel='Vazgeç',danger=false,onConfirm,onCancel}){
  document.querySelector('.modal-backdrop')?.remove();
  const el=document.createElement('div');el.className='modal-backdrop';
  el.innerHTML=`<section class="modal" role="dialog" aria-modal="true" aria-labelledby="dlg-title"><h3 id="dlg-title">${title}</h3>${body}<div class="modal-actions"><button class="btn btn-outline" data-dlg="cancel">${cancel}</button><button class="btn ${danger?'btn-danger':'btn-primary'}" data-dlg="ok">${confirm}</button></div></section>`;
  document.body.append(el);setTimeout(()=>el.classList.add('show'),10);
  el.addEventListener('click',e=>{const b=e.target.closest('[data-dlg]');if(e.target===el||b){el.remove();if(b?.dataset.dlg==='ok')onConfirm?.();else onCancel?.()}});
  el.querySelector('[data-dlg="ok"]').focus();
}

// ───────────────────────── Çizim ─────────────────────────
const CRUMBS={home:'Ana sayfa',exams:'Denemeler',intro:'Deneme',quiz:'Deneme çözülüyor',result:'Deneme sonucu',progress:'İlerlemem',premium:'Düzey Plus',about:'Hakkında',legal:'Yasal'};
function render(){
  const pages={home:renderHome,exams:renderExams,intro:renderIntro,quiz:renderQuiz,result:renderResult,progress:renderProgress,premium:renderPremium,about:renderAbout,legal:renderLegal};
  root.innerHTML=(pages[view]||renderHome)();
  document.body.dataset.screen=view;
  const navCount=document.getElementById('nav-exam-count');if(navCount)navCount.textContent=exams.length;
  const navView={intro:'exams',quiz:'exams',result:'exams',legal:'about'}[view]||view;
  document.querySelectorAll('.nav-item[data-view]').forEach(el=>el.classList.toggle('active',el.dataset.view===navView));
  const crumb=document.getElementById('breadcrumb');if(crumb)crumb.textContent=view==='legal'?(LEGAL_TITLES[legalDoc]||'Yasal'):CRUMBS[view]||'';
  const planLabel=document.getElementById('plan-pill-label');if(planLabel)planLabel.textContent=hasFullAccess()?'Düzey Plus':'Ücretsiz plan';
  const mini=document.getElementById('premium-mini');if(mini)mini.hidden=hasFullAccess();
}

// ───────────────────────── Olaylar ─────────────────────────
document.addEventListener('click',e=>{
  const t=e.target;
  const viewTarget=t.closest('[data-view]');if(viewTarget){setView(viewTarget.dataset.view);return}
  const legal=t.closest('[data-legal]');if(legal){openLegal(legal.dataset.legal);return}
  const goLevel=t.closest('[data-go-level]');if(goLevel){selectedLevel=goLevel.dataset.goLevel;localStorage.setItem('duzey-level',selectedLevel);setView('exams');return}
  const level=t.closest('[data-level]');if(level){selectedLevel=level.dataset.level;localStorage.setItem('duzey-level',selectedLevel);render();return}
  const open=t.closest('[data-open-exam]');if(open){openExam(open.dataset.openExam);return}
  const mode=t.closest('[data-mode]');if(mode){introMode=mode.dataset.mode;render();return}
  const answer=t.closest('[data-answer]');if(answer){selectAnswer(Number(answer.dataset.answer));return}
  const go=t.closest('[data-goto]');if(go){goTo(Number(go.dataset.goto));return}
  const filter=t.closest('[data-filter]');if(filter){reviewFilter=filter.dataset.filter;render();document.querySelector('.review')?.scrollIntoView?.({behavior:'smooth',block:'start'});return}
  const jump=t.closest('[data-jump]');if(jump){const id=Number(jump.dataset.jump);const item=lastResult?.items[id];if(item&&!document.getElementById(`review-${id}`)){reviewFilter='all';render()}const el=document.getElementById(`review-${id}`);el?.scrollIntoView?.({behavior:'smooth',block:'start'});el?.classList.add('pulse');setTimeout(()=>el?.classList.remove('pulse'),1200);return}
  const planSel=t.closest('[data-plan-select]');if(planSel){selectedPlan=planSel.dataset.planSelect;render();return}
  const action=t.closest('[data-action]')?.dataset.action;if(!action)return;
  switch(action){
    case 'start-exam':{const exam=examById(introExamId);if(exam)startRun({exam,questions:exam.questions,mode:introMode});break}
    case 'resume':resumeRun();break;
    case 'discard-run':showDialog({title:'Yarım kalan deneme silinsin mi?',body:'<p>Bu denemedeki cevapların silinecek.</p>',confirm:'Sil',danger:true,onConfirm:()=>{savedRun.clear();render()}});break;
    case 'prev':goTo(run.index-1);break;
    case 'next':goTo(run.index+1);break;
    case 'flag':run.flags[run.index]=!run.flags[run.index];persist();render();break;
    case 'toggle-nav':navigatorOpen=!navigatorOpen;render();break;
    case 'finish':requestFinish();break;
    case 'leave-quiz':showToast('İlerlemen kaydedildi. Kaldığın yerden devam edebilirsin.');setView('exams');break;
    case 'retry':{const exam=examById(lastResult?.examId);if(exam){introExamId=exam.id;introMode=lastResult.mode;setView('intro')}break}
    case 'retry-wrong':{const exam=examById(lastResult?.examId);if(!exam)break;const qs=lastResult.items.filter(x=>x.status!=='correct').map(x=>[x.q[0],x.q[1],x.q[2],x.q[3]]);startRun({exam,questions:qs,mode:'learn',practice:true,title:`${lastResult.title.replace(/ · Yanlışlarım$/,'')} · Yanlışlarım`});break}
    case 'purchase':purchaseSelected();break;
    case 'restore':if(!window.DuzeyBilling?.native){showToast('Geri yükleme yalnızca mağazadan indirilen uygulamada yapılabilir.');break}window.DuzeyBilling.restore().then(()=>{showToast(hasFullAccess()?'Satın alımların geri yüklendi.':'Bu mağaza hesabında aktif bir satın alım bulunamadı.');render()}).catch(()=>showToast('Satın alımlar geri yüklenemedi. Lütfen tekrar dene.'));break;
    case 'reload-billing':window.DuzeyBilling?.reload?.();showToast('Mağaza ürünleri yeniden yükleniyor…');break;
    case 'reset-progress':showDialog({title:'İlerleme sıfırlansın mı?',body:'<p>Bu cihazdaki tüm deneme sonuçların, istatistiklerin ve yarım kalan denemen silinecek.</p>',confirm:'Sıfırla',danger:true,onConfirm:()=>{localStorage.removeItem(STORE_KEY);savedRun.clear();showToast('İlerleme kayıtların silindi.');render()}});break;
  }
});
document.addEventListener('keydown',e=>{
  if(e.target.closest?.('input,textarea')||e.metaKey||e.ctrlKey||e.altKey)return;
  if(document.querySelector('.modal-backdrop')){if(e.key==='Escape')document.querySelector('[data-dlg="cancel"]')?.click();return}
  if(e.key==='Enter'){const card=e.target.closest?.('[data-open-exam]');if(card&&card.tagName!=='BUTTON'){openExam(card.dataset.openExam);return}}
  if(view!=='quiz'||!run)return;
  const k=e.key.toLowerCase();if(k==='enter'&&e.target.closest?.('button'))return;const map={'1':0,'2':1,'3':2,'4':3,a:0,b:1,c:2,d:3};
  if(k in map){e.preventDefault();selectAnswer(map[k])}
  else if(k==='arrowright'||(k==='enter'&&run.answers[run.index]!==null)){e.preventDefault();if(run.index<run.questions.length-1)goTo(run.index+1);else requestFinish()}
  else if(k==='arrowleft'){e.preventDefault();goTo(run.index-1)}
  else if(k==='f'){run.flags[run.index]=!run.flags[run.index];persist();render()}
});
document.addEventListener('visibilitychange',()=>{if(!run)return;if(document.hidden){savedRun.save(run);run.elapsed=elapsedMs(run);run.resumedAt=null}else if(view==='quiz'&&!run.resumedAt){run.resumedAt=Date.now()}});
document.addEventListener('duzey-billing-changed',()=>{if(view!=='quiz')render()});
['copy','cut','contextmenu','dragstart'].forEach(type=>document.addEventListener(type,event=>{if(event.target.closest?.('.question-card,.review-item'))event.preventDefault()}));

try{history.replaceState({view:'home'},'','#home')}catch{}
render();
if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(()=>{});
