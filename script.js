// Elite Quiz with menu, lifelines, ladder, Firebase leaderboard
const screens = {
  menu: document.getElementById('screen-menu'),
  settings: document.getElementById('screen-settings'),
  game: document.getElementById('screen-game'),
  result: document.getElementById('screen-result'),
  leaderboard: document.getElementById('screen-leaderboard'),
};

function show(id){
  Object.values(screens).forEach(s=>s.classList.remove('active'));
  screens[id].classList.add('active');
}

const nameInput = document.getElementById('player-name');
const levelSelect = document.getElementById('level');
const qCountSelect = document.getElementById('question-count');
const btnPlay = document.getElementById('btn-play');
const btnLeaderboard = document.getElementById('btn-leaderboard');
const btnSettings = document.getElementById('btn-settings');
const btnSettingsBack = document.getElementById('btn-settings-back');
const btnLBBack = document.getElementById('btn-lb-back');

const themeSelect = document.getElementById('theme-select');
themeSelect.onchange = () => document.documentElement.dataset.theme = themeSelect.value;

// HUD elements
const elQIndex = document.getElementById('q-index');
const elQTotal = document.getElementById('q-total');
const elScore = document.getElementById('score');
const elHudLevel = document.getElementById('hud-level');
const elQuestion = document.getElementById('question');
const elAnswers = document.getElementById('answers');
const elHint = document.getElementById('hint');
const btnNext = document.getElementById('next-btn');
const btnExit = document.getElementById('btn-exit');

// Lifelines
const btn5050 = document.getElementById('ll-5050');
const btnHint = document.getElementById('ll-hint');
const btnSkip = document.getElementById('ll-skip');
const btnReveal = document.getElementById('ll-reveal');

// Ladder
const ladder = document.getElementById('money-ladder');

// Result
const screenResultText = document.getElementById('result-text');
const btnReplay = document.getElementById('btn-replay');
const btnMenu = document.getElementById('btn-menu');

// Leaderboard loads via window.loadLeaderboard() from Firebase module

// Build ladder (10 steps visual)
(function buildLadder(){
  let html = '';
  for(let i=10;i>=1;i--){
    const prize = i*10; // purely cosmetic
    html += `<li data-step="${i}"><span>Bậc ${i}</span><span>${prize} ⭐</span></li>`;
  }
  ladder.innerHTML = html;
})();

// populate levels 1..15
(function initLevels(){
  for(let i=1;i<=15;i++){
    const opt = document.createElement('option');
    opt.value = i; opt.textContent = `Cấp ${i}`;
    levelSelect.appendChild(opt);
  }
})();

// State
let level = 1, qCount = 10;
let bank = 0, idx = 0;
let questions = [], picks = [];
let used5050=false, usedHint=false, usedSkip=false, usedReveal=false;
let locked=false;

function shuffle(arr){ for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]];} return arr; }
function sampleQs(arr, n){
  const copy = arr.map((q,i)=>({...q,_id:i}));
  shuffle(copy);
  return copy.slice(0, Math.min(n, copy.length));
}

async function loadLevel(lv){
  const res = await fetch(`questions/level${lv}.json`, { cache:'no-store' });
  if(!res.ok) throw new Error('Không tải được file câu hỏi.');
  return await res.json();
}

function updateLadderVisual(){
  const step = Math.min(10, idx+1);
  [...ladder.children].forEach(li => li.classList.remove('active'));
  const active = ladder.querySelector(`[data-step="${step}"]`);
  if(active) active.classList.add('active');
}

function renderQuestion(){
  const q = picks[idx];
  elQIndex.textContent = idx+1;
  elQTotal.textContent = picks.length;
  elHudLevel.textContent = level;
  elQuestion.textContent = q.question;
  elAnswers.innerHTML = '';
  elHint.textContent = '';
  btnNext.classList.add('hidden');
  locked = false;

  // shuffle answers but keep a mapping
  const ans = q.answers.map((t,i)=>({t,i}));
  shuffle(ans);
  ans.forEach(({t,i})=>{
    const b = document.createElement('button');
    b.textContent = t;
    b.onclick = () => chooseAnswer(b, i===q.correct, q);
    elAnswers.appendChild(b);
  });

  // lifelines
  btn5050.disabled = used5050;
  btnHint.disabled = usedHint;
  btnSkip.disabled = usedSkip;
  if(idx >= 5 && !usedReveal) btnReveal.classList.remove('locked');
  btnReveal.disabled = usedReveal || (idx < 5);

  updateLadderVisual();
}

function chooseAnswer(btn, isCorrect, q){
  if(locked) return;
  locked = true;
  const buttons = [...elAnswers.querySelectorAll('button')];
  buttons.forEach(b=>b.disabled=true);

  const correctText = q.answers[q.correct];
  buttons.forEach(b=>{
    if(b.textContent===correctText) b.classList.add('correct');
  });
  if(!isCorrect){ btn.classList.add('wrong'); }

  // scoring
  if(isCorrect){
    bank++; elScore.textContent = bank;
  }
  btnNext.classList.remove('hidden');
}

// Lifelines
btn5050.onclick = ()=>{
  if(used5050) return;
  const q = picks[idx];
  const buttons = [...elAnswers.querySelectorAll('button')];
  const correctText = q.answers[q.correct];
  const wrong = buttons.filter(b=> b.textContent !== correctText);
  shuffle(wrong);
  wrong.slice(0,2).forEach(b=>{ b.disabled=true; b.style.opacity=.6; });
  used5050 = true; btn5050.disabled = true;
};

btnHint.onclick = ()=>{
  if(usedHint) return;
  const q = picks[idx];
  elHint.textContent = q.hint ? `Gợi ý: ${q.hint}` : 'Gợi ý: Loại trừ đáp án thiếu căn cứ.';
  usedHint = true; btnHint.disabled = true;
};

btnSkip.onclick = ()=>{
  if(usedSkip) return;
  usedSkip = true; btnSkip.disabled = true;
  nextQuestion();
};

btnReveal.onclick = ()=>{
  if(usedReveal || idx < 5) return;
  const q = picks[idx];
  const buttons = [...elAnswers.querySelectorAll('button')];
  const correctText = q.answers[q.correct];
  buttons.forEach(b=>{
    if(b.textContent===correctText) b.classList.add('correct');
    else { b.disabled = true; b.style.opacity=.6; }
  });
  usedReveal = true; btnReveal.disabled = true;
  btnNext.classList.remove('hidden');
};

function nextQuestion(){
  idx++;
  if(idx < picks.length){
    renderQuestion();
  }else{
    endGame();
  }
}

btnNext.onclick = nextQuestion;
btnExit.onclick = ()=> show('menu');

function endGame(){
  const name = (nameInput.value || 'Người chơi').trim();
  screens.result.querySelector('#result-text').textContent =
    `${name} đạt ${bank}/${picks.length} điểm ở Cấp ${level}.`;
  show('result');
  if(window.addScore) window.addScore(name, bank, level).then(()=>{
    if(window.loadLeaderboard) setTimeout(window.loadLeaderboard, 1200);
  });
}

// Navigation
btnPlay.onclick = async ()=>{
  level = Number(levelSelect.value || 1);
  qCount = Number(qCountSelect.value || 10);
  bank = 0; idx = 0; elScore.textContent = '0';
  used5050=usedHint=usedSkip=usedReveal=false;
  try{
    const all = await loadLevel(level);
    picks = sampleQs(all, qCount);
    if(!picks.length) return alert('File câu hỏi trống.');
  }catch(e){ return alert('Không tải được câu hỏi.'); }
  show('game');
  renderQuestion();
};

btnLeaderboard.onclick = ()=>{
  show('leaderboard');
  if(window.loadLeaderboard) window.loadLeaderboard();
};
btnSettings.onclick = ()=> show('settings');
btnSettingsBack.onclick = ()=> show('menu');
btnLBBack.onclick = ()=> show('menu');
btnReplay.onclick = ()=> btnPlay.click();
btnMenu.onclick = ()=> show('menu');
