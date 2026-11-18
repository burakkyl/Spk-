const curriculum = window.SPL_CURRICULUM;
if (!curriculum?.levels || !curriculum?.seeds) throw new Error('SPL müfredat verisi yüklenemedi.');
const letters=['A','B','C','D'];
const testCounts={
  'Düzey 1':[4,4,3,3],
  'Düzey 2':[2,2,2,2,2,2,2,2,1],
  'Düzey 3':[2,2,1,1,1,1,1,1,1,1,1,1]
};
function createTopicPool(subject,level,required){
  const seeds=curriculum.seeds[subject.bank];
  if(!seeds?.length) throw new Error(`Soru havuzu eksik: ${subject.bank}`);
  const bankAliases={'law-narrow':'law','law-broad':'law'};
  const bankKey=bankAliases[subject.bank]||subject.bank;
  const legacy=(window.SPL_LEGACY_QUESTIONS?.[bankKey]||[])
    .slice()
    .sort((a,b)=>a.level===b.level?0:a.level===level?-1:b.level===level?1:0);
  const selectedLegacy=legacy.slice(0,required).map(item=>{
    if(item.level===level)return item.q;
    return [`${level} · ${item.q[0]}`,item.q[1],item.q[2],item.q[3]];
  });
  const variants=[];
  const frames=[
    (topic,q)=>`${level} sınavına hazırlanan aday, ${topic} kapsamındaki bilgiyi değerlendiriyor. Soru: ${q}`,
    (topic,q)=>`${level} düzeyinde ${topic} konusunda doğru uygulama hangisidir? ${q}`,
    (topic,q)=>`Bir yatırımcı ${topic} başlığında karar verirken şu soruyla karşılaşıyor: ${q}`,
    (topic,q)=>`Bir kurum içi eğitimde ${topic} konusu ele alınıyor. Adayın doğru yanıtlaması gereken soru: ${q}`,
    (topic,q)=>`${level} deneme oturumunda ${topic} bilgisini ölçen soru: ${q}`,
    (topic,q)=>`Bir sermaye piyasası çalışanı ${topic} hakkında müşteriyi bilgilendiriyor. Hangi ifade doğrudur? ${q}`,
    (topic,q)=>`${topic} konulu vaka çalışmasında doğru ilkeyi seçin: ${q}`,
    (topic,q)=>`Sınav adayı ${topic} kapsamındaki mevzuat ve uygulamayı gözden geçiriyor: ${q}`,
    (topic,q)=>`Bir yatırım kuruluşu ${topic} başlığında işlem sürecini inceliyor. Doğru seçenek hangisidir? ${q}`,
    (topic,q)=>`${level} çalışma setinde ${topic} bilgisini uygulamaya yönelik soru: ${q}`,
    (topic,q)=>`Müşteri talebini değerlendiren uzman, ${topic} kapsamında hangi yanıtı vermelidir? ${q}`,
    (topic,q)=>`Bir piyasa katılımcısı ${topic} ile ilgili değerlendirme yapıyor. Doğru yaklaşım hangisidir? ${q}`,
    (topic,q)=>`${topic} konusunda düzenlenen eğitimde aşağıdaki soruya yanıt aranıyor: ${q}`,
    (topic,q)=>`Bir sermaye piyasası işlemi ${topic} kuralları çerçevesinde ele alınıyor: ${q}`,
    (topic,q)=>`${level} yeterlilik çalışmasında ${topic} başlığından sorulan soru: ${q}`,
    (topic,q)=>`Yatırımcı haklarını gözeten bir uzman ${topic} konusunu açıklıyor. Hangi ifade doğrudur? ${q}`,
    (topic,q)=>`${topic} uygulamasını değerlendiren adayın seçmesi gereken doğru yanıt hangisidir? ${q}`,
    (topic,q)=>`Bir finansal kurumun kontrol süreci ${topic} başlığını kapsıyor. Doğru değerlendirme: ${q}`,
    (topic,q)=>`Sınav hazırlık notunda ${topic} konusuyla ilgili şu soru yer alıyor: ${q}`,
    (topic,q)=>`${level} düzeyinde karşılaşılan ${topic} senaryosunu doğru yorumlayın: ${q}`,
    (topic,q)=>`Bir uzman ${topic} hakkında mevzuata uygun bilgi veriyor. Aşağıdaki sorunun yanıtı hangisidir? ${q}`,
    (topic,q)=>`${topic} başlığını tekrar eden öğrenci aşağıdaki soruyu yanıtlıyor: ${q}`,
    (topic,q)=>`Bir işlem öncesi kontrolünde ${topic} ile ilgili hangi bilgi dikkate alınmalıdır? ${q}`,
    (topic,q)=>`${level} sınav pratiğinde ${topic} konusunu ölçen uygulama sorusu: ${q}`
  ];
  for(let round=0;round<25;round++) for(let i=0;i<seeds.length;i++){
    const seed=seeds[i],topic=subject.topics[(i+round)%subject.topics.length];
    const stem=round===0?`${level} · ${topic}: ${seed[1]}`:`${level} · ${frames[(round-1)%frames.length](topic,seed[1])}`;
    variants.push([stem,seed.slice(2,6),0,seed[6]]);
  }
  const generatedNeeded=required-selectedLegacy.length;
  return [...selectedLegacy,...variants.slice(0,generatedNeeded)];
}
const exams=[];
for(const level of ['Düzey 1','Düzey 2','Düzey 3']){
  const subjects=curriculum.levels[level];
  let levelExamIndex=0;
  subjects.forEach((subject,subjectIndex)=>{
    const count=testCounts[level][subjectIndex];
    const pool=createTopicPool(subject,level,count*25);
    for(let setIndex=0;setIndex<count;setIndex++){
      const questions=pool.slice(setIndex*25,(setIndex+1)*25);
      const isFree=levelExamIndex===0;
      const serial=setIndex+1;
      exams.push({
        id:`${subject.id}-${serial}`,level,
        title:count>1?`${subject.title} · Deneme ${serial}`:subject.title,
        curriculumId:subject.id,curriculumSubject:subject.title,curriculumTopics:subject.topics,
        description:`Müfredat kapsamı: ${subject.topics.join(' · ')}. 25 özgün çalışma sorusu.`,
        icon:['◈','⌁','⌖','◉'][subjectIndex%4],paid:!isFree,questions
      });
      levelExamIndex++;
    }
  });
}
if(exams.length!==45||exams.some(e=>e.questions.length!==25))throw new Error('Deneme sayısı veya soru sayısı beklenen müfredata uymuyor.');

const root=document.getElementById('view-root');
const toast=document.getElementById('toast');
let view='home';
let selectedLevel='Düzey 1';
let activeExam=null;
let questionIndex=0;
let selectedAnswer=null;
let correctInRun=0;
let runAnswers=[];
let toastTimer;
const store={get(){try{return JSON.parse(localStorage.getItem('duzey-progress'))||{attempts:0,correct:0,answered:0,completed:0,byExam:{}}}catch{return {attempts:0,correct:0,answered:0,completed:0,byExam:{}}}},save(data){localStorage.setItem('duzey-progress',JSON.stringify(data))}};
const deviceTag=(()=>{try{let tag=localStorage.getItem('duzey-device-tag');if(!tag){tag=(crypto.randomUUID?.()||Math.random().toString(36).slice(2)).replaceAll('-','').slice(0,8).toUpperCase();localStorage.setItem('duzey-device-tag',tag)}return tag}catch{return 'GUEST'}})();
function showToast(message){toast.textContent=message;toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),3000)}
function setView(next){view=next;document.querySelectorAll('.nav-item[data-view]').forEach(el=>el.classList.toggle('active',el.dataset.view===next));render();window.scrollTo({top:0,behavior:'smooth'})}
function hasFullAccess(){return Boolean(window.DuzeyBilling?.hasPremium())}
function examCard(exam,compact=false){const locked=Boolean(exam.paid)&&!hasFullAccess();const badge=locked?'Premium':exam.paid?'Plus dahil':'Ücretsiz';return `<article class="${compact?'exam-card':'exam-tile'}" ${compact?'data-open-exam="'+exam.id+'"':''}>${compact?`<div class="exam-icon ${locked?'locked-icon':''}">${locked?'▣':exam.icon}</div><div class="exam-meta"><h4>${exam.title}</h4><p>${exam.level} · ${badge} · 25 soru</p></div><div class="exam-stat"><strong>${locked?'Premium':'25 soru'}</strong>${locked?'Planı incele':'~30 dk'}</div><span class="go-icon">›</span>`:`<span class="tile-tag ${locked?'locked-tag':''}">${exam.level} · ${badge}</span><h3>${exam.title}</h3><p>${exam.description}</p><div class="tile-bottom"><span>25 özgün soru · ~30 dk</span><button class="${locked?'locked-button':''}" data-open-exam="${exam.id}">${locked?'Erişim satın al':'Ücretsiz başla'}&nbsp; ↗</button></div>`}</article>`}
function renderHome(){let p=store.get();return `<section class="page-heading"><div><div class="eyebrow">${new Date().toLocaleDateString('tr-TR',{weekday:'long',day:'numeric',month:'long'})}</div><h1>Merhaba, öğrenci 👋</h1><p>Bugün hedeflerine biraz daha yaklaşmaya ne dersin?</p></div><div class="date-chip">● &nbsp;Kendi temponda ilerle</div></section><section class="hero"><div class="hero-copy"><div class="hero-kicker">Sınav gününe bir adım daha yakın</div><h2>Bilgini dene. Hedefine güvenle ilerle.</h2><p>SPK lisanslama konularına yönelik özgün denemelerle bilgini ölç, gelişimini takip et.</p><button class="primary-btn" data-view="exams">Denemelere göz at <span class="arrow">→</span></button></div><div class="hero-art" aria-hidden="true"><svg viewBox="0 0 330 245" fill="none"><path d="M60 240V145l48-36 43 24 74-85 50 33v159H60Z" fill="#2A7253" opacity=".66"/><path d="m81 171 41-37 34 18 73-75 48 27" stroke="#C1DBCB" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="121" cy="134" r="5" fill="#E3F0E7"/><circle cx="156" cy="152" r="5" fill="#E3F0E7"/><circle cx="229" cy="77" r="5" fill="#E3F0E7"/><path d="M83 200h160M83 218h114" stroke="#A2C5AF" stroke-width="2" opacity=".45"/><circle cx="267" cy="37" r="21" fill="#357B5C" opacity=".6"/><path d="M256 37h22M267 26v22" stroke="#C4DCCB" stroke-width="2" stroke-linecap="round"/></svg></div></section><div class="dashboard-grid"><section><div class="section-head"><h3>Her düzeyden 1 ücretsiz deneme</h3><button class="text-link" data-view="exams">Tümünü gör&nbsp; →</button></div><div class="exam-list">${exams.filter(x=>!x.paid).map(x=>examCard(x,true)).join('')}</div></section><aside class="side-stack"><div class="progress-card"><div class="progress-top"><h3>Genel ilerleme</h3><div class="progress-ring"><span>${p.completed?Math.min(99,Math.round(p.correct/Math.max(1,p.answered)*100)):0}%</span></div></div><p>${p.answered?`${p.answered} soru yanıtladın. Bir deneme daha çözerek gelişimini sürdür.`:'İlk denemeni tamamla, ilerlemen burada görünmeye başlasın.'}</p><button class="progress-link" data-view="progress">İstatistikleri görüntüle&nbsp; →</button></div><div class="streak-card"><span class="streak-icon">✦</span><h3>Her gün küçük bir adım</h3><strong>${p.completed} deneme</strong><p>tamamlandı. Düzenli pratik, kalıcı öğrenmeyi destekler.</p></div></aside></div><div class="section-title-row"><div><h3>${exams.length} deneme, ${exams.length*25} özgün soru</h3><p>Her düzeyde ilk deneme ücretsiz; diğer ${exams.length-3} deneme Plus ile açılır.</p></div><button class="text-link" data-view="exams">Hepsini gör&nbsp; →</button></div><div class="exam-grid">${exams.slice(0,6).map(e=>examCard(e)).join('')}</div>`}
function renderExams(){const levels=['Düzey 1','Düzey 2','Düzey 3'];const levelExams=exams.filter(e=>e.level===selectedLevel);return `<section class="page-heading"><div><div class="eyebrow">SPL müfredat başlıklarına göre</div><h1>Denemeler</h1><p>Her deneme, ilgili lisans düzeyinin ders ve alt konu başlıklarına göre düzenlenmiştir. İlk deneme ücretsizdir.</p></div><div class="date-chip">${exams.length} deneme · ${exams.length*25} soru</div></section><div class="level-tabs" role="tablist" aria-label="Düzey seç">${levels.map(level=>`<button role="tab" aria-selected="${selectedLevel===level}" class="level-tab ${selectedLevel===level?'active':''}" data-level="${level}">${level}<span>${exams.filter(e=>e.level===level).length} deneme</span></button>`).join('')}</div><div class="exam-grid">${levelExams.map(e=>examCard(e)).join('')}</div><p class="billing-note" style="margin-top:22px">Her deneme 25 özgün sorudan oluşur. İçerikler resmi SPK sınav sorularının kopyası değildir.</p>`}
function startExam(id){const source=exams.find(e=>e.id===id);if(!source)return;if(source.paid&&!hasFullAccess()){setView('premium');showToast('Bu deneme Düzey Plus planıyla açılır.');return}activeExam={...source,questions:source.questions.map(q=>{const order=[0,1,2,3];for(let i=order.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[order[i],order[j]]=[order[j],order[i]]}return [q[0],order.map(i=>q[1][i]),order.indexOf(q[2]),q[3]]})};questionIndex=0;selectedAnswer=null;correctInRun=0;runAnswers=[];view='quiz';render();window.scrollTo({top:0,behavior:'smooth'})}
function renderQuiz(){let q=activeExam.questions[questionIndex],answered=selectedAnswer!==null,correct=answered&&selectedAnswer===q[2];return `<div class="quiz-wrap"><div class="quiz-top"><button class="back-btn" data-action="leave-quiz">← &nbsp;Denemeler</button><div><div class="quiz-name">${activeExam.level} · ${activeExam.title}</div><div class="quiz-sub">Özgün çalışma denemesi</div></div><span class="date-chip">${questionIndex+1} / 25</span></div><section class="question-card"><div class="quiz-progress-row"><strong>Soru ${String(questionIndex+1).padStart(2,'0')} <span style="font-weight:400;color:#89938c">/ 25</span></strong><span>${Math.round((questionIndex/25)*100)}% tamamlandı</span></div><div class="progress-track"><div class="progress-fill" style="width:${(questionIndex/25)*100}%"></div></div><div class="question-label">${activeExam.level} · Soru ${questionIndex+1}</div><h2 class="question-text">${q[0]}</h2><div class="answers">${q[1].map((a,i)=>{let cls='';if(answered&&i===q[2])cls='correct';else if(answered&&i===selectedAnswer)cls='wrong';return `<button class="answer-option ${cls}" data-answer="${i}" ${answered?'disabled':''}><span class="answer-letter">${letters[i]}</span><span>${a}</span></button>`}).join('')}</div>${answered?`<div class="feedback ${correct?'good':'bad'}"><strong>${correct?'✓ Doğru cevap!':'✕ Bu kez olmadı'}</strong>${q[3]}</div>`:''}<div class="quiz-actions"><span class="hint">${answered?'Geri bildirimi incele, hazır olduğunda devam et.':'En uygun seçeneği işaretle.'}</span><button class="next-btn ${answered?(correct?'good':'bad'):''}" data-action="next-question" ${answered?'':'disabled'}>${questionIndex===24?'Sonucu gör':'Sonraki soru'} <span>→</span></button></div></section><div class="quiz-help">İlerleme bu cihazda otomatik kaydedilir · Üyelik gerekmez <span class="watermark">· Düzey eğitim içeriği · Cihaz ${deviceTag}</span></div></div>`}
function nextQuestion(){if(selectedAnswer===null)return;let q=activeExam.questions[questionIndex];let good=selectedAnswer===q[2];runAnswers.push({question:questionIndex,selected:selectedAnswer,correct:good});if(good)correctInRun++;if(questionIndex===24){finishExam();return}questionIndex++;selectedAnswer=null;render()}
function finishExam(){let p=store.get();p.completed++;p.attempts++;p.answered+=25;p.correct+=correctInRun;p.byExam[activeExam.id]=(p.byExam[activeExam.id]||0)+1;store.save(p);view='result';render()}
function renderResult(){let pct=Math.round(correctInRun/25*100);return `<div class="quiz-wrap"><div class="quiz-top"><button class="back-btn" data-view="home">← &nbsp;Ana sayfa</button><span class="quiz-name">${activeExam.level} · ${activeExam.title}</span></div><section class="result-card"><div class="result-badge">${pct>=60?'✓':'↗'}</div><div class="eyebrow">Deneme tamamlandı</div><h2>${pct>=60?'Güzel iş çıkardın!':'Pratiğe devam et!'}</h2><p>Her deneme, hedeflerine yaklaşmak için yeni bir fırsat.</p><div class="result-score">${pct}<span style="font-size:20px">%</span></div><div class="result-label">başarı oranı</div><div class="result-stats"><div><strong>${correctInRun}</strong><span>Doğru</span></div><div><strong>${25-correctInRun}</strong><span>Yanlış</span></div><div><strong>25</strong><span>Toplam soru</span></div></div><div class="result-actions"><button class="primary-btn" data-action="retry">Tekrar çöz <span>↻</span></button><button class="secondary-btn" data-view="exams">Diğer denemelere bak</button></div></section></div>`}
function renderProgress(){let p=store.get(),percent=p.answered?Math.round(p.correct/p.answered*100):0;return `<section class="page-heading"><div><div class="eyebrow">Kendi gelişimini gör</div><h1>İlerlemem</h1><p>İstatistiklerin sadece bu cihazda saklanır. Hesap açman gerekmez.</p></div></section>${p.completed?`<div class="dashboard-grid"><div class="progress-card"><div class="eyebrow">Genel başarı oranı</div><div style="font:800 34px Manrope;color:var(--green);margin:8px 0">${percent}%</div><div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div><p>Şimdiye kadar ${p.answered} soru yanıtladın; ${p.correct} tanesi doğru.</p></div><div class="streak-card"><span class="streak-icon">✦</span><h3>Tamamlanan deneme</h3><strong>${p.completed}</strong><p>Çözmeye devam et, öğrendiklerin pekişsin.</p></div></div><div class="section-title-row"><div><h3>Denemelere göre</h3><p>Her seviyede pratik yapabilirsin.</p></div></div><div class="exam-list">${exams.filter(e=>(p.byExam[e.id]||0)>0).map(e=>`<div class="exam-card"><div class="exam-icon">${e.icon}</div><div class="exam-meta"><h4>${e.title}</h4><p>${e.level}</p></div><div class="exam-stat"><strong>${p.byExam[e.id]||0} kez</strong>tamamlandı</div></div>`).join('')}</div>`:`<div class="empty-state"><div style="font-size:28px;margin-bottom:10px;color:var(--green)">↗</div><strong style="display:block;color:var(--ink);font:700 15px Manrope;margin-bottom:7px">İlk adımını at</strong>Henüz tamamlanmış denemen yok. Bir deneme çöz; ilerlemen burada kişisel olarak görünsün.<br><button class="primary-btn" data-view="exams" style="margin-top:17px;background:var(--green);color:white">Denemeleri keşfet →</button></div>`}`}
function planPrice(key,fallback){return window.DuzeyBilling?.getPrice(key)||fallback}
function renderPremium(){const nativeReady=Boolean(window.DuzeyBilling?.ready);const access=hasFullAccess();return `<section class="premium-hero"><div class="eyebrow">✦ &nbsp;Düzey Plus</div><h1>${access?'Plus erişimin aktif':'Çalışma planını seç'}</h1><p>Sınav hazırlığını kendi tempona göre sürdür. Üyelik gerekmez; satın alma mağaza hesabınla doğrulanır.</p></section><div class="premium-feature-list"><span>${exams.length} denemenin tamamı</span><span>${exams.length*25} özgün soru</span><span>İlerleme bu cihazda saklanır</span></div><section class="plans"><article class="plan-card"><h3>Haftalık</h3><div class="price">${planPrice('weekly','₺79')} <small>/ hafta</small></div><div class="plan-caption">Kısa süreli çalışma planı</div><div class="plan-divider"></div><p class="benefit"><span>✓</span> Tüm ücretli denemeler</p><p class="benefit"><span>✓</span> Yeni soru setlerine erişim</p><button data-buy="weekly">Haftalık planı seç</button></article><article class="plan-card featured"><span class="popular">EN ÇOK TERCİH EDİLEN</span><h3>Aylık</h3><div class="price">${planPrice('monthly','₺199')} <small>/ ay</small></div><div class="plan-caption">Düzenli hazırlık için ideal</div><div class="plan-divider"></div><p class="benefit"><span>✓</span> Tüm ücretli denemeler</p><p class="benefit"><span>✓</span> Yeni soru setlerine erişim</p><p class="benefit"><span>✓</span> Mağaza hesabından yönetim</p><button data-buy="monthly">Aylık planı seç</button></article><article class="plan-card"><h3>Ömür boyu</h3><div class="price">${planPrice('lifetime','₺1.499')} <small>/ tek sefer</small></div><div class="plan-caption">Bir kez öde, kalıcı erişim</div><div class="plan-divider"></div><p class="benefit"><span>✓</span> Tüm ücretli denemeler</p><p class="benefit"><span>✓</span> Gelecekteki soru setleri</p><p class="benefit"><span>✓</span> Tek seferlik satın alma</p><button data-buy="lifetime">Ömür boyu erişim al</button></article></section><p class="billing-note">${nativeReady?'Fiyat ve ödeme, cihazın App Store / Google Play hesabı üzerinden güvenli biçimde yönetilir.':'Mağaza fiyatları taslak gösterimdir. Gerçek tahsilat için RevenueCat ürünleri/anahtarları ile App Store ve Google Play ürünleri yapılandırılmalıdır.'} Haftalık/aylık abonelik yenileme ve iptal koşulları satın alma ekranında gösterilir.</p><div style="text-align:center"><button class="text-link" data-action="restore">Satın alımları geri yükle</button></div>`}
function render(){const pages={home:renderHome,exams:renderExams,quiz:renderQuiz,result:renderResult,progress:renderProgress,premium:renderPremium};root.innerHTML=(pages[view]||renderHome)();const crumbs={home:'Genel bakış',exams:'Denemeler',quiz:'Deneme çözülüyor',result:'Deneme sonucu',progress:'İlerlemem',premium:'Düzey Plus'};document.getElementById('breadcrumb').innerHTML=`${crumbs[view]||'Genel bakış'} <span>/</span> ${view==='home'?'Bugün öğrenmeye devam et':view==='quiz'?'Cevaplarını değerlendir':view==='premium'?'Planını seç':'Çalışma alanın'}`;const planLabel=document.getElementById('plan-pill-label');if(planLabel)planLabel.textContent=hasFullAccess()?'Düzey Plus':'Ücretsiz plan'}

document.addEventListener('click',e=>{let viewTarget=e.target.closest('[data-view]');if(viewTarget){setView(viewTarget.dataset.view);return}let levelTab=e.target.closest('[data-level]');if(levelTab){selectedLevel=levelTab.dataset.level;render();return}let open=e.target.closest('[data-open-exam]');if(open){startExam(open.dataset.openExam);return}let answer=e.target.closest('[data-answer]');if(answer&&selectedAnswer===null){selectedAnswer=Number(answer.dataset.answer);if(selectedAnswer===activeExam.questions[questionIndex][2])correctInRun++;render();return}let action=e.target.closest('[data-action]')?.dataset.action;if(action==='next-question'){// The tally is handled at nextQuestion; undo the immediate display-only increment.
if(selectedAnswer===activeExam.questions[questionIndex][2])correctInRun--;nextQuestion();return}if(action==='leave-quiz'){view='exams';render();return}if(action==='retry'){startExam(activeExam.id);return}if(action==='restore'){window.DuzeyBilling?.restore().catch(()=>showToast('Satın alma geri yüklenemedi.'));return}if(action==='confirm-purchase'){const plan=e.target.closest('[data-plan]')?.dataset.plan;document.querySelector('.modal-backdrop')?.remove();window.DuzeyBilling?.purchase(plan).catch(()=>showToast('Satın alma tamamlanamadı.'));return}let buy=e.target.closest('[data-buy]');if(buy)showPurchaseModal(buy.dataset.buy)});
function showPurchaseModal(plan){const names={weekly:'Haftalık',monthly:'Aylık',lifetime:'Ömür boyu'};const ready=Boolean(window.DuzeyBilling?.canPurchase(plan));let backdrop=document.createElement('div');backdrop.className='modal-backdrop';backdrop.innerHTML=`<section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="eyebrow">${ready?'MAĞAZA SATIN ALMASI':'SATIN ALMA KURULUMU'}</div><h3 id="modal-title">${names[plan]||'Düzey Plus'} planı</h3><p>${ready?'Ödeme, App Store veya Google Play’in güvenli satın alma penceresinde tamamlanır. Abonelikler ilgili mağaza hesabından yönetilir.':'Bu uygulama sürümü satın alma akışına hazır; mağazada tahsilatın çalışması için RevenueCat API anahtarları ve haftalık/aylık/ömür boyu ürünleri ilgili mağazalarda tanımlanmalıdır.'}</p><p>Satın alma için kullanıcı hesabı açılmaz. Satın alma ve geri yükleme mağaza hesabı üzerinden yapılır.</p><div class="modal-actions"><button class="secondary-btn" data-close-modal>Kapat</button><button class="primary-btn" data-action="confirm-purchase" data-plan="${plan}" ${ready?'':'disabled'}>${ready?'Mağazadan devam et':'Kurulum bekleniyor'}</button></div></section>`;document.body.append(backdrop);backdrop.addEventListener('click',e=>{if(e.target===backdrop||e.target.closest('[data-close-modal]'))backdrop.remove()})}

document.addEventListener('duzey-billing-changed',()=>render());
['copy','cut','contextmenu','dragstart'].forEach(type=>document.addEventListener(type,event=>{if(event.target.closest?.('.question-card'))event.preventDefault()}));
render();
if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(()=>{});
