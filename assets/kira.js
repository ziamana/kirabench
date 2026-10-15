// Sprite de Kira (pixel art 32x32), généré en SVG. Partagé par toutes les pages.
(function(){
const N = 32;
const PAL = Object.assign({K:"#031a0d",H:"#1f8a4c",h:"#2fbf6a",S:"#c9ffd9",s:"#93e3ae",G:"#39ff88",W:"#f0fff4",E:"#04110a",
             B:"#ffb3c7",M:"#0b3b20",C:"#145c34",c:"#0e4527",L:"#39ff88",D:"#9fe8ff"}, window.KIRA_PAL || {});
const grid = () => Array.from({length:N}, () => Array(N).fill(null));
const inE = (x,y,cx,cy,rx,ry) => ((x+.5-cx)/rx)**2 + ((y+.5-cy)/ry)**2 <= 1;
function ell(g,cx,cy,rx,ry,c,ok){ for(let y=0;y<N;y++)for(let x=0;x<N;x++) if(inE(x,y,cx,cy,rx,ry)&&(!ok||ok(x,y,g[y][x]))) g[y][x]=c; }
function rect(g,x0,y0,x1,y1,c){ for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++) g[y][x]=c; }
function put(g,pts,c){ pts.forEach(([x,y]) => { if(x>=0&&y>=0&&x<N&&y<N) g[y][x]=c; }); }

function base(){
  const g = grid();
  ell(g,16,13.5,11,11,"H");                 // cheveux (arrière)
  rect(g,5,13,26,24,"H");                   // cheveux longs
  ell(g,16,33,14.5,8.6,"C");                // sweat
  rect(g,13,20,18,25,"s");                  // cou
  ell(g,16,14,8,9,"S");                     // visage
  for(let y=0;y<N;y++)for(let x=21;x<N;x++) if(g[y][x]==="S") g[y][x]="s";   // ombre côté droit
  const fr = [12,11,10,9,8,9,8,7,8,9,8,7,8,9,10,12];                         // frange
  for(let x=8;x<=23;x++) for(let y=3;y<=fr[x-8];y++) if(inE(x,y,16,13.5,11,11)) g[y][x]="H";
  put(g,[[11,5],[12,4],[13,4],[14,4],[18,5],[19,5]],"h");                    // reflets
  for(let y=24;y<N;y++)for(let x=0;x<N;x++) if(g[y][x]==="C"&&x>=23) g[y][x]="c";
  put(g,[[12,25],[13,26],[19,25],[18,26]],"c");                             // capuche
  put(g,[[13,27],[14,28],[13,29]],"L"); put(g,[[16,29],[17,29],[18,29]],"L"); // >_
  // lunettes
  for(const x0 of [9,17]){ const x1=x0+5;
    for(let x=x0;x<=x1;x++){ g[12][x]="G"; g[16][x]="G"; }
    for(let y=12;y<=16;y++){ g[y][x0]="G"; g[y][x1]="G"; }
    rect(g,x0+1,13,x1-1,15,"S"); }
  put(g,[[15,13],[16,13],[8,13],[23,13]],"G");
  put(g,[[9,18],[10,18],[21,18],[22,18]],"B");
  put(g,[[16,17]],"s");
  return g;
}
const eyes = (g,dx=0,dy=0,small=false) => { for(const x of [11,19]){ const p=[[x+dx,14+dy],[x+1+dx,14+dy]]; if(!small) p.push([x+dx,15+dy],[x+1+dx,15+dy]); put(g,p,"E"); } put(g,[[13,13],[21,13]],"W"); };
const brows = (g,l,r) => { put(g,[[10,l],[11,l],[12,l]],"K"); put(g,[[19,r],[20,r],[21,r]],"K"); };

const EXPR = {
  neutre:   g => { eyes(g); brows(g,11,11); },
  surprise: g => { eyes(g,0,0,true); brows(g,10,10); put(g,[[28,2],[28,3],[28,4],[28,5],[28,7]],"L"); },
  reflexion:g => { eyes(g,-1,-1); brows(g,10,11); put(g,[[27,1],[28,1],[29,2],[28,3],[27,4],[27,6]],"L"); },
  verdict:  g => { eyes(g); put(g,[[10,13],[11,13],[18,13],[19,13]],"W"); brows(g,11,10); put(g,[[27,5],[28,6],[29,5],[30,4],[31,3]],"L"); },
  echec:    g => { eyes(g,0,1,true); put(g,[[10,11],[11,10],[12,10],[21,11],[20,10],[19,10]],"K"); put(g,[[24,8],[24,9],[23,10],[24,10],[25,10],[24,11]],"D"); }
};
const MOUTH = {
  neutre:   {c:[[15,20],[16,20]], o:[[15,19],[16,19],[14,20],[17,20],[15,21],[16,21]], oi:[[15,20],[16,20]]},
  surprise: {c:[[15,19],[16,19],[14,20],[17,20],[15,21],[16,21]], ci:[[15,20],[16,20]]},
  reflexion:{c:[[17,20],[18,20]]},
  verdict:  {c:[[13,19],[14,20],[15,20],[16,20],[17,20],[18,19]]},
  echec:    {c:[[14,21],[15,20],[16,20],[17,21]]}
};

function outline(g){
  const o = g.map(r => r.slice());
  for(let y=0;y<N;y++)for(let x=0;x<N;x++) if(!g[y][x]){
    const n = [[1,0],[-1,0],[0,1],[0,-1]].some(([a,b]) => g[y+b]&&g[y+b][x+a]&&!"L".includes(g[y+b][x+a]));
    if(n) o[y][x] = "K";
  }
  return o;
}
function rects(g){ let s=""; g.forEach((r,y)=>r.forEach((c,x)=>{ if(c) s+=`<rect x="${x}" y="${y}" width="1.02" height="1.02" fill="${PAL[c]}"/>`; })); return s; }
function sprite(e="neutre", pad=2){
  const g = base(); EXPR[e](g); const m = MOUTH[e];
  put(g,m.c,"M"); if(m.ci) put(g,m.ci,"E");
  const body = rects(outline(g));
  let anim = "";
  if (m.o){ const gc=grid(); put(gc,m.c,"S"); const go=grid(); put(go,m.o,"M"); put(go,m.oi,"E");
            anim = `<g class="mo">${rects(gc)}${rects(go)}</g>`; }
  const blink = `<g class="blink">${rects((()=>{const b=grid(); for(const x0 of [10,18]) rect(b,x0,13,x0+3,15,"S"); for(const x0 of [10,18]) rect(b,x0,15,x0+3,15,"K"); return b;})())}</g>`;
  return `<svg class="px" viewBox="${-pad} ${-pad} ${N+2*pad} ${N+2*pad}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">${body}${anim}${e==="neutre"?blink:""}</svg>`;
}

window.KiraSprite = sprite;
})();
