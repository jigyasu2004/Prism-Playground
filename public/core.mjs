export const VERSION = '1.0.0';
export const clone = x => structuredClone(x);
export function rng(seed) { let a=hash(String(seed)); return () => {a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;}; }
export function hash(s) { let h=2166136261; for(const c of s) h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0; }
export const int=(r,n)=>Math.floor(r()*n);
export function shuffle(r,a){a=[...a];for(let i=a.length-1;i>0;i--){const j=int(r,i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
export const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function assert(v,m='Invalid action'){if(!v)throw new Error(m);}
export const DIRS=[[0,-1],[1,0],[0,1],[-1,0]];
export const ARROWS=['↑','→','↓','←'];
export function neighbor(p,d,n=5){const x=p%n+DIRS[d][0],y=Math.floor(p/n)+DIRS[d][1];return x<0||y<0||x>=n||y>=n?-1:y*n+x;}
export function bfs(start,key,goal,next,limit=100000){const q=[start],seen=new Map([[key(start),null]]),parents=new Map();let last;
 for(let i=0;i<q.length&&i<limit;i++){const s=q[i],k=key(s);if(goal(s)){last=k;break;}for(const [a,t] of next(s)){const tk=key(t);if(!seen.has(tk)){seen.set(tk,true);parents.set(tk,[k,a]);q.push(t);}}}
 if(last===undefined)return null;const path=[];while(parents.has(last)){const [p,a]=parents.get(last);path.push(a);last=p;}return path.reverse();}
export function inside(p,poly){let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if(((a.y>p.y)!==(b.y>p.y))&&(p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x))c=!c;}return c;}
export function segmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y;const t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
export function validPoints(points){assert(Array.isArray(points)&&points.length>=3&&points.length<=1200,'Draw a closed loop');for(const p of points)assert(Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=600&&p.y>=0&&p.y<=440,'Point outside playfield');}
