import {clone,assert} from '../core.mjs';
export function base(seed,difficulty,mode,extra){return {seed,difficulty,mode,status:'playing',moves:0,history:[],message:'Find the exact target.',...extra};}
export function remember(s,keys){s.history.push(Object.fromEntries(keys.map(k=>[k,clone(s[k])])));s.moves++;delete s.hint;}
export function undo(s){assert(s.history.length,'No moves to undo');Object.assign(s,s.history.pop());s.moves++;s.message='Move undone. Total moves still count.';delete s.hint;}
export function puzzleSummary(s){const target=s.targetMoves||1,performance=Math.max(0,Math.min(1,target/Math.max(target,s.moves)));return {score:Math.round(1000*performance),moves:s.moves,accuracy:null,puzzle:true,target,efficient:s.moves<=target,stars:s.moves<=target?3:s.moves<=target*1.6?2:1,metric:`${s.moves} moves`,performance};}
