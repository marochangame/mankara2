'use strict';
// mankara2_ai_auto_v2: 横取り後は必ず相手ターンへ切り替える修正版

const PIT_COUNT = 6;
const START_STONES = 4;
const PLAYER = 'player';
const AI = 'ai';

let state;
let history = [];
let aiTimer = null;

const els = {
  aiRow: document.getElementById('aiRow'),
  playerRow: document.getElementById('playerRow'),
  aiStore: document.getElementById('aiStore'),
  playerStore: document.getElementById('playerStore'),
  aiScore: document.getElementById('aiScore'),
  playerScore: document.getElementById('playerScore'),
  message: document.getElementById('message'),
  detailText: document.getElementById('detailText'),
  turnBadge: document.getElementById('turnBadge'),
  undoBtn: document.getElementById('undoBtn'),
  toggleTurnBtn: document.getElementById('toggleTurnBtn'),
  resetBtn: document.getElementById('resetBtn'),
  board: document.getElementById('board')
};

function newState() {
  return {
    pits: {
      ai: Array(PIT_COUNT).fill(START_STONES),
      player: Array(PIT_COUNT).fill(START_STONES)
    },
    stores: { ai: 0, player: 0 },
    turn: PLAYER,
    last: null,
    captured: null,
    gameOver: false,
    thinkingPit: null
  };
}

function clone(obj) { return JSON.parse(JSON.stringify(obj)); }
function opponent(side) { return side === PLAYER ? AI : PLAYER; }
function playablePits(side, s = state) { return s.pits[side].map((v, i) => v > 0 ? i : -1).filter(i => i >= 0); }
function sideEmpty(side, s = state) { return s.pits[side].every(v => v === 0); }

function saveHistory() {
  const snap = clone(state);
  snap.thinkingPit = null;
  history.push(snap);
  if (history.length > 80) history.shift();
}

function makePit(side, index) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `pit ${side}`;
  button.dataset.side = side;
  button.dataset.index = String(index);
  button.setAttribute('aria-label', `${side === PLAYER ? 'あなた' : '相手'}の${index + 1}番目の穴`);
  button.addEventListener('click', () => {
    if (side !== PLAYER || state.turn !== PLAYER || state.gameOver || state.pits.player[index] === 0) return;
    move(PLAYER, index, true);
  });
  return button;
}

function buildBoard() {
  els.aiRow.innerHTML = '';
  els.playerRow.innerHTML = '';
  for (let i = 0; i < PIT_COUNT; i++) els.aiRow.appendChild(makePit(AI, i));
  for (let i = 0; i < PIT_COUNT; i++) els.playerRow.appendChild(makePit(PLAYER, i));
}

function stonePositions(n) {
  const positions = [
    [18,18],[42,15],[64,23],[24,42],[50,40],[72,48],[32,66],[58,66],
    [12,60],[78,72],[42,82],[68,14],[18,76],[82,34],[36,30],[56,54]
  ];
  return positions.slice(0, Math.min(n, positions.length));
}

function renderStones(pit, count) {
  const wrap = document.createElement('span');
  wrap.className = 'stones';
  stonePositions(count).forEach(([x, y]) => {
    const s = document.createElement('span');
    s.className = 'stone';
    s.style.left = `${x}%`;
    s.style.top = `${y}%`;
    wrap.appendChild(s);
  });
  pit.appendChild(wrap);
  const num = document.createElement('span');
  num.className = 'pit-count';
  num.textContent = String(count);
  pit.appendChild(num);
}

function render() {
  document.body.classList.toggle('game-over', state.gameOver);
  for (const side of [AI, PLAYER]) {
    const row = side === AI ? els.aiRow : els.playerRow;
    [...row.children].forEach((pit, i) => {
      pit.innerHTML = '';
      const count = state.pits[side][i];
      renderStones(pit, count);
      pit.disabled = side !== PLAYER || state.turn !== PLAYER || count === 0 || state.gameOver;
      pit.classList.toggle('active', side === PLAYER && state.turn === PLAYER && count > 0 && !state.gameOver);
      pit.classList.toggle('last', !!state.last && state.last.side === side && state.last.index === i);
      pit.classList.toggle('capture', !!state.captured && state.captured.side === side && state.captured.index === i);
      pit.classList.toggle('ai-thinking', !!state.thinkingPit && state.thinkingPit.side === side && state.thinkingPit.index === i);
    });
  }
  els.aiStore.textContent = state.stores.ai;
  els.playerStore.textContent = state.stores.player;
  els.aiScore.textContent = state.stores.ai;
  els.playerScore.textContent = state.stores.player;
  els.turnBadge.classList.toggle('ai', state.turn === AI && !state.gameOver);
  els.turnBadge.classList.toggle('end', state.gameOver);
  els.turnBadge.textContent = state.gameOver ? '終了' : (state.turn === PLAYER ? 'あなたの番' : 'AIの番');
  els.undoBtn.disabled = history.length === 0;
  els.toggleTurnBtn.disabled = state.gameOver;
  updateMessage();
}

function updateMessage() {
  if (state.gameOver) {
    if (state.stores.player > state.stores.ai) els.message.textContent = 'あなたの勝ち！';
    else if (state.stores.player < state.stores.ai) els.message.textContent = 'AIの勝ち';
    else els.message.textContent = '引き分け';
    els.detailText.textContent = `最終結果：相手 ${state.stores.ai} ／ あなた ${state.stores.player}`;
    return;
  }
  if (state.turn === AI) {
    els.message.textContent = state.thinkingPit ? 'AIが選びました' : 'AIが考え中…';
    els.detailText.textContent = '相手の番は自動で進みます。あなたは待つだけでOK。';
  } else {
    els.message.textContent = '光っている穴をタップ';
    if (state.captured && state.captured.by === AI) {
      els.detailText.textContent = 'AIの横取り後なので、あなたの番です。';
    } else if (state.captured && state.captured.by === PLAYER) {
      els.detailText.textContent = 'あなたの横取り後なので、AIの番に切り替わります。';
    } else {
      els.detailText.textContent = '相手の番になると、AIが自動で次の手を選びます。';
    }
  }
}

function nextPosition(pos, mover) {
  if (pos.type === 'pit') {
    if (pos.side === PLAYER) {
      if (pos.index < PIT_COUNT - 1) return { type:'pit', side:PLAYER, index:pos.index + 1 };
      return { type:'store', side:PLAYER };
    }
    if (pos.index > 0) return { type:'pit', side:AI, index:pos.index - 1 };
    return { type:'store', side:AI };
  }
  if (pos.side === PLAYER) return { type:'pit', side:AI, index:PIT_COUNT - 1 };
  return { type:'pit', side:PLAYER, index:0 };
}

function sow(s, side, index) {
  let stones = s.pits[side][index];
  s.pits[side][index] = 0;
  let pos = { type:'pit', side, index };
  let last = null;
  while (stones > 0) {
    pos = nextPosition(pos, side);
    if (pos.type === 'store' && pos.side !== side) continue;
    if (pos.type === 'store') s.stores[pos.side] += 1;
    else s.pits[pos.side][pos.index] += 1;
    last = clone(pos);
    stones--;
  }
  return last;
}

function finishIfNeeded(s) {
  if (!sideEmpty(PLAYER, s) && !sideEmpty(AI, s)) return false;
  for (const side of [PLAYER, AI]) {
    const rest = s.pits[side].reduce((a, b) => a + b, 0);
    s.stores[side] += rest;
    s.pits[side] = Array(PIT_COUNT).fill(0);
  }
  s.gameOver = true;
  return true;
}

function applyMove(s, side, index) {
  s.last = null;
  s.captured = null;
  s.thinkingPit = null;
  const last = sow(s, side, index);
  s.last = last;

  let didCapture = false;
  if (last && last.type === 'pit' && last.side === side && s.pits[side][last.index] === 1) {
    const opp = opponent(side);
    const oppIndex = PIT_COUNT - 1 - last.index;
    const captured = s.pits[opp][oppIndex];
    if (captured > 0) {
      s.pits[opp][oppIndex] = 0;
      s.pits[side][last.index] = 0;
      s.stores[side] += captured + 1;
      s.captured = { side: opp, index: oppIndex, amount: captured + 1, by: side };
      didCapture = true;
    }
  }

  if (!finishIfNeeded(s)) {
    // 重要：横取りが成立した手はそこで終了。再手番にはしない。
    // 再手番になるのは「最後の石が自分のGET欄に入った時」だけ。
    const getsExtraTurn = !didCapture && last && last.type === 'store' && last.side === side;
    s.turn = getsExtraTurn ? side : opponent(side);
    if (playablePits(s.turn, s).length === 0) s.turn = opponent(s.turn);
  }
  return s;
}

function move(side, index, human) {
  if (state.gameOver || state.turn !== side || state.pits[side][index] <= 0) return;
  if (human) saveHistory();
  else saveHistory();
  state = applyMove(state, side, index);
  render();
  if (state.captured) {
    const who = side === PLAYER ? 'あなた' : 'AI';
    els.message.textContent = `${who}が${state.captured.amount}個ゲット！`;
  }
  scheduleAI();
}

function evaluateMove(side, index) {
  const sim = applyMove(clone(state), side, index);
  const scoreDiff = sim.stores[AI] - sim.stores[PLAYER];
  const extra = sim.turn === AI && !sim.gameOver ? 5 : 0;
  const capture = sim.captured && sim.captured.side === PLAYER ? sim.captured.amount * 3 : 0;
  const keepOptions = playablePits(AI, sim).length * 0.15;
  return scoreDiff * 2 + extra + capture + keepOptions;
}

function chooseAiMove() {
  const choices = playablePits(AI);
  if (choices.length === 0) return null;
  let best = choices[0];
  let bestScore = -Infinity;
  for (const i of choices) {
    const score = evaluateMove(AI, i);
    if (score > bestScore) { bestScore = score; best = i; }
  }
  return best;
}

function scheduleAI() {
  clearTimeout(aiTimer);
  if (state.gameOver || state.turn !== AI) return;
  const choice = chooseAiMove();
  if (choice == null) return;
  state.thinkingPit = { side:AI, index:choice };
  render();
  aiTimer = setTimeout(() => move(AI, choice, false), 720);
}

els.undoBtn.addEventListener('click', () => {
  clearTimeout(aiTimer);
  if (!history.length) return;
  state = history.pop();
  state.thinkingPit = null;
  render();
  scheduleAI();
});

els.toggleTurnBtn.addEventListener('click', () => {
  clearTimeout(aiTimer);
  if (state.gameOver) return;
  saveHistory();
  state.turn = opponent(state.turn);
  state.thinkingPit = null;
  render();
  scheduleAI();
});

els.resetBtn.addEventListener('click', () => {
  clearTimeout(aiTimer);
  history = [];
  state = newState();
  render();
});

buildBoard();
state = newState();
render();
