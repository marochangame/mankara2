(() => {
  "use strict";

  // Board representation:
  // player[0..5] = displayed 自分1..自分6 from left to right.
  // opponent[0..5] = displayed 相手6..相手1 from left to right.
  // Capture opposite mapping is same column: player[i] <-> opponent[i].
  const START = [4,4,4,4,4,4];
  let state;
  let history = [];
  let lastLanding = null;

  const el = {
    playerRow: document.getElementById("playerRow"),
    opponentRow: document.getElementById("opponentRow"),
    playerStore: document.getElementById("playerStore"),
    oppStore: document.getElementById("oppStore"),
    turnBadge: document.getElementById("turnBadge"),
    mainMessage: document.getElementById("mainMessage"),
    subMessage: document.getElementById("subMessage"),
    undoBtn: document.getElementById("undoBtn"),
    switchBtn: document.getElementById("switchBtn"),
    resetBtn: document.getElementById("resetBtn")
  };

  function freshState(){
    return {
      player: START.slice(),
      opponent: START.slice(),
      playerStore: 0,
      opponentStore: 0,
      turn: "player",
      gameOver: false
    };
  }

  function clone(s){
    return {
      player: s.player.slice(),
      opponent: s.opponent.slice(),
      playerStore: s.playerStore,
      opponentStore: s.opponentStore,
      turn: s.turn,
      gameOver: s.gameOver
    };
  }

  // Unified ring. This exact ring is the only distribution engine.
  // Moving direction:
  // player side: 自分1 -> 自分2 -> ... -> 自分6 -> 自分ゴール -> 相手1 -> 相手2 -> ... -> 相手6 -> 自分1
  // opponent side: 相手1 -> 相手2 -> ... -> 相手6 -> 相手ゴール -> 自分1 -> 自分2 -> ... -> 自分6 -> 相手1
  // Because opponent array is displayed 相手6..相手1, 相手1 is opponent[5].
  const playerRing = [
    {side:"player", i:0}, {side:"player", i:1}, {side:"player", i:2},
    {side:"player", i:3}, {side:"player", i:4}, {side:"player", i:5},
    {side:"playerStore"},
    {side:"opponent", i:5}, {side:"opponent", i:4}, {side:"opponent", i:3},
    {side:"opponent", i:2}, {side:"opponent", i:1}, {side:"opponent", i:0}
  ];

  const opponentRing = [
    {side:"opponent", i:5}, {side:"opponent", i:4}, {side:"opponent", i:3},
    {side:"opponent", i:2}, {side:"opponent", i:1}, {side:"opponent", i:0},
    {side:"opponentStore"},
    {side:"player", i:0}, {side:"player", i:1}, {side:"player", i:2},
    {side:"player", i:3}, {side:"player", i:4}, {side:"player", i:5}
  ];

  function samePos(a,b){
    return a && b && a.side === b.side && a.i === b.i;
  }

  function addOne(s, pos){
    if(pos.side === "player") s.player[pos.i]++;
    else if(pos.side === "opponent") s.opponent[pos.i]++;
    else if(pos.side === "playerStore") s.playerStore++;
    else if(pos.side === "opponentStore") s.opponentStore++;
  }

  function countAll(s){
    return s.player.reduce((a,b)=>a+b,0) + s.opponent.reduce((a,b)=>a+b,0) + s.playerStore + s.opponentStore;
  }

  function move(pitIndex){
    if(state.gameOver) return;
    const side = state.turn;
    const holes = side === "player" ? state.player : state.opponent;
    const stones = holes[pitIndex];
    if(stones <= 0) return;

    const beforeTotal = countAll(state);
    history.push(clone(state));
    lastLanding = null;

    const ring = side === "player" ? playerRing : opponentRing;
    const startSide = side;
    const startPos = {side:startSide, i:pitIndex};
    let ringIndex = ring.findIndex(p => samePos(p, startPos));
    if(ringIndex < 0) throw new Error("start position not found");

    holes[pitIndex] = 0;

    let last = null;
    for(let n = 0; n < stones; n++){
      ringIndex = (ringIndex + 1) % ring.length;
      const pos = ring[ringIndex];
      addOne(state, pos);
      last = pos;
    }
    lastLanding = last;

    const capture = applyCaptureIfNeeded(side, last);
    const extraTurn = (side === "player" && last.side === "playerStore") ||
                      (side === "opponent" && last.side === "opponentStore");

    let ended = finishIfSideEmpty();
    if(!ended && !extraTurn){
      state.turn = side === "player" ? "opponent" : "player";
    }

    const afterTotal = countAll(state);
    if(afterTotal !== beforeTotal){
      // This should never happen. Keep the board legal rather than silently losing stones.
      alert(`石数エラーを検出しました。移動前:${beforeTotal} 移動後:${afterTotal}`);
      state = history.pop() || freshState();
      render("石数エラーのため一手戻しました", "配石処理はロールバックされました。");
      return;
    }

    const actor = side === "player" ? "自分" : "相手";
    const pitName = side === "player" ? `自分の${pitIndex+1}番` : `相手の${6-pitIndex}番`;
    let main = `${actor}が${pitName}を選択`;
    let sub = extraTurn ? "ゴールぴったり。もう一回です。" : `${state.turn === "player" ? "あなた" : "相手"}の番です。`;
    if(capture > 0){
      sub = `横取りで${capture}個をゴールへ入れました。` + (extraTurn ? " もう一回です。" : "");
    }
    if(state.gameOver){
      main = "ゲーム終了";
      sub = `自分 ${state.playerStore} 個 ／ 相手 ${state.opponentStore} 個`;
    }
    render(main, sub);
  }

  function applyCaptureIfNeeded(side, last){
    if(!last || last.side !== side || typeof last.i !== "number") return 0;

    const own = side === "player" ? state.player : state.opponent;
    const other = side === "player" ? state.opponent : state.player;
    const storeKey = side === "player" ? "playerStore" : "opponentStore";

    // Strict capture:
    // The last stone must land in an empty own pit, meaning after placement that pit is exactly 1.
    if(own[last.i] !== 1) return 0;

    const oppositeStones = other[last.i];
    if(oppositeStones <= 0) return 0;

    const gained = oppositeStones + 1;
    own[last.i] = 0;
    other[last.i] = 0;
    state[storeKey] += gained;
    return gained;
  }

  function finishIfSideEmpty(){
    const playerEmpty = state.player.every(v => v === 0);
    const opponentEmpty = state.opponent.every(v => v === 0);
    if(!playerEmpty && !opponentEmpty) return false;

    const playerRest = state.player.reduce((a,b)=>a+b,0);
    const opponentRest = state.opponent.reduce((a,b)=>a+b,0);
    state.playerStore += playerRest;
    state.opponentStore += opponentRest;
    state.player = [0,0,0,0,0,0];
    state.opponent = [0,0,0,0,0,0];
    state.gameOver = true;
    return true;
  }

  function stonesHtml(n){
    const max = Math.min(n, 12);
    let html = "";
    for(let i=0;i<max;i++) html += '<span class="stone"></span>';
    return html;
  }

  function pitButton(side, index, value){
    const btn = document.createElement("button");
    btn.className = "pit";
    if(lastLanding && lastLanding.side === side && lastLanding.i === index) btn.classList.add("last");

    const isTurnSide = state.turn === side && !state.gameOver;
    if(isTurnSide && value > 0) btn.classList.add("playable");
    btn.disabled = !isTurnSide || value <= 0;

    const label = side === "player" ? `自分${index+1}` : `相手${6-index}`;
    btn.innerHTML = `<div class="pit-label">${label}</div><div class="stones">${stonesHtml(value)}</div><div class="pit-count">${value}</div>`;
    btn.addEventListener("click", () => move(index));
    return btn;
  }

  function syncInputs(){
    // 手入力エリアは通常プレイ用UIから削除しました。
  }

  function render(main, sub){
    el.playerRow.innerHTML = "";
    el.opponentRow.innerHTML = "";

    state.opponent.forEach((v,i)=> el.opponentRow.appendChild(pitButton("opponent", i, v)));
    state.player.forEach((v,i)=> el.playerRow.appendChild(pitButton("player", i, v)));

    el.playerStore.textContent = state.playerStore;
    el.oppStore.textContent = state.opponentStore;
    el.turnBadge.textContent = state.gameOver ? "終了" : (state.turn === "player" ? "あなたの番" : "相手の番");
    el.mainMessage.textContent = main || (state.turn === "player" ? "下の穴をタップして手を進めます" : "上の穴をタップして相手の手を進めます");
    el.subMessage.textContent = sub || "AI判定なし。まずゲームルールだけを正確に動かす版です。";
    syncInputs();
  }


  el.undoBtn.addEventListener("click", () => {
    if(history.length === 0){
      render("戻せる手がありません", "まだ一手も進んでいません。");
      return;
    }
    state = history.pop();
    lastLanding = null;
    render("一手戻しました", `${state.turn === "player" ? "あなた" : "相手"}の番です。`);
  });

  el.switchBtn.addEventListener("click", () => {
    if(state.gameOver) return;
    history.push(clone(state));
    state.turn = state.turn === "player" ? "opponent" : "player";
    lastLanding = null;
    render("手番を切り替えました", `${state.turn === "player" ? "あなた" : "相手"}の番です。`);
  });

  el.resetBtn.addEventListener("click", () => {
    history.push(clone(state));
    state = freshState();
    lastLanding = null;
    render("リセットしました", "初期配置に戻しました。");
  });

  state = freshState();
  render();
})();