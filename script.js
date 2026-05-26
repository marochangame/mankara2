const START_STONES = 4;
const state = { pits: Array(12).fill(START_STONES), stores: { me: 0, op: 0 }, turn: 'me', last: null, history: [], gameOver: false };
const $ = (id) => document.getElementById(id);
const myRow = $('myRow');
const opponentRow = $('opponentRow');
function cloneState(){ return { pits:[...state.pits], stores:{...state.stores}, turn:state.turn, last:state.last ? {...state.last} : null, gameOver:state.gameOver }; }
function restore(s){ state.pits=[...s.pits]; state.stores={...s.stores}; state.turn=s.turn; state.last=s.last ? {...s.last} : null; state.gameOver=s.gameOver; render(); }
function pitName(i){ return i < 6 ? `自分${i+1}` : `相手${12-i}`; }
function makePit(index){
  const b=document.createElement('button'); b.type='button'; b.className='pit'; b.dataset.index=index;
  b.innerHTML='<div class="pit-label"></div><div class="stones"></div><div class="count"></div>';
  b.addEventListener('click',()=>move(index)); return b;
}
for(let i=11;i>=6;i--) opponentRow.appendChild(makePit(i));
for(let i=0;i<6;i++) myRow.appendChild(makePit(i));
function isOwnPit(index, player){ return player==='me' ? index>=0 && index<=5 : index>=6 && index<=11; }
function opposite(index){ return 11-index; }
function nextPosition(pos, player){
  if(pos.type==='pit'){
    const i=pos.index;
    if(i===5) return player==='me' ? {type:'store', owner:'me'} : {type:'pit', index:6};
    if(i===11) return player==='op' ? {type:'store', owner:'op'} : {type:'pit', index:0};
    return {type:'pit', index:i+1};
  }
  return pos.owner==='me' ? {type:'pit', index:6} : {type:'pit', index:0};
}
function move(index){
  if(state.gameOver) return;
  if(!isOwnPit(index,state.turn) || state.pits[index]===0) return;
  state.history.push(cloneState());
  let stones=state.pits[index]; state.pits[index]=0;
  let pos={type:'pit', index}; let lastPlaced=null;
  while(stones>0){
    pos=nextPosition(pos,state.turn);
    if(pos.type==='store' && pos.owner!==state.turn){ continue; }
    if(pos.type==='store'){ state.stores[pos.owner]++; lastPlaced={...pos}; }
    else { state.pits[pos.index]++; lastPlaced={...pos}; }
    stones--;
  }
  let captured=0;
  if(lastPlaced.type==='pit' && isOwnPit(lastPlaced.index,state.turn) && state.pits[lastPlaced.index]===1){
    const opp=opposite(lastPlaced.index);
    if(state.pits[opp]>0){
      captured=state.pits[opp]+1;
      state.pits[opp]=0; state.pits[lastPlaced.index]=0;
      state.stores[state.turn]+=captured;
    }
  }
  state.last=lastPlaced;
  const ended = checkGameEnd();
  if(!ended){
    if(lastPlaced.type==='store' && lastPlaced.owner===state.turn){
      setMessage('もう一回できます', captured ? `横取り ${captured} 個！さらに続けてOK。` : '最後の石がGETに入りました。');
    }else{
      state.turn = state.turn==='me' ? 'op' : 'me';
      setMessage(state.turn==='me'?'あなたの番':'相手の番', captured ? `横取り ${captured} 個！` : '光っている穴をタップ');
    }
  }
  render();
}
function checkGameEnd(){
  const myEmpty=state.pits.slice(0,6).every(v=>v===0);
  const opEmpty=state.pits.slice(6,12).every(v=>v===0);
  if(!myEmpty && !opEmpty) return false;
  const myRest=state.pits.slice(0,6).reduce((a,b)=>a+b,0);
  const opRest=state.pits.slice(6,12).reduce((a,b)=>a+b,0);
  state.stores.me+=myRest; state.stores.op+=opRest;
  state.pits.fill(0); state.gameOver=true;
  if(state.stores.me>state.stores.op) setMessage('あなたの勝ち！', `${state.stores.me}対${state.stores.op}`);
  else if(state.stores.me<state.stores.op) setMessage('相手の勝ち', `${state.stores.me}対${state.stores.op}`);
  else setMessage('引き分け', `${state.stores.me}対${state.stores.op}`);
  return true;
}
function setMessage(main,sub){ $('messageMain').textContent=main; $('messageSub').textContent=sub; }
function render(){
  $('myStore').textContent=state.stores.me; $('opStore').textContent=state.stores.op;
  $('myStoreMini').textContent=state.stores.me; $('opStoreMini').textContent=state.stores.op;
  $('turnLabel').textContent = state.gameOver ? 'ゲーム終了' : (state.turn==='me' ? 'あなたの番' : '相手の番');
  $('statusCard').classList.toggle('opponent', state.turn==='op' && !state.gameOver);
  document.body.classList.toggle('game-over', state.gameOver);
  document.querySelectorAll('.pit').forEach(p=>{
    const i=Number(p.dataset.index), n=state.pits[i];
    p.querySelector('.pit-label').textContent=pitName(i);
    p.querySelector('.count').textContent=n;
    const stones=p.querySelector('.stones'); stones.innerHTML='';
    for(let k=0;k<Math.min(n,12);k++){ const s=document.createElement('span'); s.className='stone'; stones.appendChild(s); }
    p.classList.toggle('selectable', !state.gameOver && isOwnPit(i,state.turn) && n>0);
    p.classList.toggle('last', !!state.last && state.last.type==='pit' && state.last.index===i);
    p.disabled = state.gameOver || !isOwnPit(i,state.turn) || n===0;
  });
}
function reset(){ state.pits=Array(12).fill(START_STONES); state.stores={me:0,op:0}; state.turn='me'; state.last=null; state.history=[]; state.gameOver=false; setMessage('光っている穴をタップ','最後に置いた穴は白く光ります。横取りした時は表示します。'); render(); }
$('undoBtn').addEventListener('click',()=>{ const prev=state.history.pop(); if(prev) restore(prev); });
$('switchBtn').addEventListener('click',()=>{ if(state.gameOver) return; state.history.push(cloneState()); state.turn=state.turn==='me'?'op':'me'; state.last=null; setMessage(state.turn==='me'?'あなたの番':'相手の番','手番を手動で切り替えました。'); render(); });
$('resetBtn').addEventListener('click',reset);
reset();
