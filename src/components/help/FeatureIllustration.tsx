import { useEffect, useRef } from "react";

type DrawFn = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => void;

// Shared grid — crisp dot grid for SVG/blueprint feel
const grid = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
  const s = 18;
  ctx.fillStyle = "rgba(255,255,255,0.07)";
  for (let x = s; x < w; x += s)
    for (let y = s; y < h; y += s) {
      ctx.beginPath(); ctx.arc(x, y, 0.8, 0, Math.PI * 2); ctx.fill();
    }
};

// Arrow helper
const arrow = (ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) => {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
  const ux = dx / len, uy = dy / len;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2 - ux * 8 - uy * 5, y2 - uy * 8 + ux * 5);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x2 - ux * 8 + uy * 5, y2 - uy * 8 - ux * 5);
  ctx.fill();
};

const drawFns: Record<string, DrawFn> = {
  "thermal-vision": (ctx, w, h, t) => {
    const cx = w / 2 + Math.sin(t) * 55, cy = h / 2 + Math.cos(t * 1.4) * 10;
    // Body silhouette segments
    const segs = [{rx:10,ry:10,dy:-28},{rx:18,ry:22,dy:4},{rx:7,ry:16,dy:12,dx:-16},{rx:7,ry:16,dy:12,dx:16},{rx:9,ry:22,dy:45,dx:-10},{rx:9,ry:22,dy:45,dx:10}];
    segs.forEach(s => {
      const px = cx + (s as any).dx || cx, py = cy + s.dy;
      const hot = `hsl(${30 - s.ry},${"90%"},${"55%"})`;
      ctx.strokeStyle = hot; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(px, py, s.rx, s.ry, 0, 0, Math.PI * 2); ctx.stroke();
    });
    // bounding box
    ctx.strokeStyle = "rgba(255,200,80,0.6)"; ctx.lineWidth = 1.5; ctx.setLineDash([4,3]);
    ctx.strokeRect(cx - 28, cy - 42, 56, 98); ctx.setLineDash([]);
    // temp label
    ctx.fillStyle = "#fbbf24"; ctx.font = "bold 9px monospace";
    ctx.fillText(`36.${(Math.sin(t)*3+7).toFixed(0)}°C`, cx - 20, cy - 50);
    ctx.fillStyle = "#9ca3af"; ctx.font = "8px monospace";
    ctx.fillText("HUMAN HEAT MAP", 10, 18);
  },

  "mesh-tracking": (ctx, w, h, t) => {
    const cams = [{x:50,y:30,c:"#ef4444"},{x:w/2,y:30,c:"#3b82f6"},{x:w-50,y:30,c:"#22c55e"}];
    const tx = w/2 + Math.sin(t) * 110, ty = h/2 + 20;
    let best = cams[0], bd = 9e9;
    cams.forEach(c => { const d = Math.hypot(tx-c.x,ty-c.y); if(d<bd){bd=d;best=c;} });

    cams.forEach(c => {
      const act = c===best;
      ctx.strokeStyle = act ? c.c+"80" : "rgba(255,255,255,0.08)";
      ctx.lineWidth = act ? 1.5 : 1; ctx.setLineDash([4,4]);
      ctx.beginPath(); ctx.moveTo(c.x,c.y); ctx.arc(c.x,c.y,100,0.15*Math.PI,0.85*Math.PI); ctx.closePath(); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = act ? c.c : "#374151";
      ctx.beginPath(); ctx.arc(c.x,c.y,6,0,Math.PI*2); ctx.fill();
    });
    // lock line
    ctx.strokeStyle = best.c; ctx.lineWidth = 1.5; ctx.setLineDash([]);
    arrow(ctx, best.x, best.y, tx, ty);
    // target
    ctx.strokeStyle = best.c; ctx.lineWidth = 2;
    ctx.strokeRect(tx-10,ty-12,20,24);
    ctx.fillStyle = "#ffffff"; ctx.font = "bold 9px monospace";
    ctx.fillText("MESH LOCK", 10, 18);
  },

  "ai-threat-guard": (ctx, w, h, t) => {
    const risk = 70 + Math.sin(t*3)*12;
    const color = risk > 75 ? "#ef4444" : "#f59e0b";
    // pipeline nodes
    const nodes = [{x:60,y:h/2,label:"Motion In",c:"#3b82f6"},{x:w/2,y:h/2,label:"AI Score",c:color},{x:w-60,y:h/2,label:"ALERT",c:"#ef4444"}];
    ctx.lineWidth=1.5; ctx.setLineDash([3,3]);
    ctx.strokeStyle="rgba(255,255,255,0.12)";
    ctx.beginPath(); ctx.moveTo(nodes[0].x,nodes[0].y); ctx.lineTo(nodes[2].x,nodes[2].y); ctx.stroke();
    ctx.setLineDash([]);
    nodes.forEach((n,i) => {
      const pulse = 8 + Math.sin(t*3+i)*5;
      ctx.strokeStyle = n.c+"50"; ctx.lineWidth=1;
      ctx.beginPath(); ctx.arc(n.x,n.y,pulse,0,Math.PI*2); ctx.stroke();
      ctx.fillStyle=n.c; ctx.beginPath(); ctx.arc(n.x,n.y,5,0,Math.PI*2); ctx.fill();
      ctx.fillStyle="#9ca3af"; ctx.font="7px monospace";
      ctx.fillText(n.label, n.x-18, n.y-16);
    });
    ctx.fillStyle=color; ctx.font="bold 9px monospace";
    ctx.fillText(`Risk Index: ${risk.toFixed(0)}% ${risk>75?"[ALERT]":"[OK]"}`, 10, 18);
  },

  "siren-defense": (ctx, w, h, t) => {
    const cx=w/2, cy=h/2;
    const isRed = Math.floor(t*1.8)%2===0;
    const col = isRed ? "#ef4444" : "#3b82f6";
    for(let i=0;i<4;i++){
      const r = ((t*30)+i*25)%110;
      const a = Math.max(0,1-r/110);
      ctx.strokeStyle = `${col}${Math.floor(a*80).toString(16).padStart(2,"0")}`;
      ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke();
    }
    // siren icon
    ctx.fillStyle=col; ctx.beginPath(); ctx.arc(cx,cy,10,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle="#ffffff"; ctx.lineWidth=1.5; ctx.stroke();
    // cone shape
    ctx.strokeStyle=col+"40"; ctx.lineWidth=1; ctx.setLineDash([4,4]);
    ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx-70,cy+55); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+70,cy+55); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle=col; ctx.font="bold 9px monospace";
    ctx.fillText(isRed?"SIREN: ACTIVE":"STROBE: ACTIVE", 10, 18);
  },

  "bridge-mode": (ctx, w, h, t) => {
    // browser frame
    ctx.strokeStyle="rgba(255,255,255,0.2)"; ctx.lineWidth=1.5;
    ctx.strokeRect(20,20,w-40,h-40);
    ctx.fillStyle="rgba(255,255,255,0.05)"; ctx.fillRect(20,20,w-40,16);
    ["#ef4444","#eab308","#22c55e"].forEach((c,i)=>{
      ctx.fillStyle=c; ctx.beginPath(); ctx.arc(30+i*10,28,3,0,Math.PI*2); ctx.fill();
    });
    // pulsing cast frames
    for(let i=0;i<3;i++){
      const off = ((t*1.5+i*2)%6)*10;
      const a = Math.max(0,1-off/60);
      ctx.strokeStyle=`rgba(234,179,8,${a*0.5})`; ctx.lineWidth=1.5;
      ctx.strokeRect(30+off,42+off,w-60-off*2,h-64-off*2);
    }
    ctx.fillStyle="#eab308"; ctx.font="bold 9px monospace";
    ctx.fillText("SCREEN CAST → HGUARD", 30, 17);
  },

  "tactical-night-vision": (ctx, w, h, t) => {
    const div = (Math.sin(t*0.8)*0.5+0.5)*w;
    // dark side
    ctx.fillStyle="#050308"; ctx.fillRect(0,0,div,h);
    ctx.fillStyle="rgba(255,255,255,0.04)";
    ctx.beginPath(); ctx.arc(div*0.5,h/2,18,0,Math.PI*2); ctx.fill();
    // boosted side
    ctx.fillStyle="#091410"; ctx.fillRect(div,0,w-div,h);
    ctx.strokeStyle="#4ade80"; ctx.lineWidth=1.5;
    ctx.strokeRect(div+10,h/2-18,36,36);
    const g=ctx.createRadialGradient(div+28,h/2,2,div+28,h/2,28);
    g.addColorStop(0,"rgba(74,222,128,0.9)"); g.addColorStop(1,"transparent");
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(div+28,h/2,28,0,Math.PI*2); ctx.fill();
    // divider
    ctx.strokeStyle="#ffffff"; ctx.lineWidth=2; ctx.setLineDash([5,4]);
    ctx.beginPath(); ctx.moveTo(div,0); ctx.lineTo(div,h); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle="#9ca3af"; ctx.font="8px monospace";
    ctx.fillText("RAW", 10,18); ctx.fillText("AI BOOSTED",div+8,18);
  },

  "elite-archive": (ctx, w, h, t) => {
    const cw=72, ch=52, gap=12;
    const startX = -cw + ((t*35)%(cw+gap));
    for(let i=0;i<6;i++){
      const x=startX+i*(cw+gap), y=(h-ch)/2;
      if(x+cw<0||x>w) continue;
      ctx.strokeStyle="rgba(255,255,255,0.2)"; ctx.lineWidth=1;
      ctx.strokeRect(x,y,cw,ch);
      // play triangle
      ctx.fillStyle="rgba(255,255,255,0.25)";
      ctx.beginPath(); ctx.moveTo(x+cw/2-5,y+ch/2-7); ctx.lineTo(x+cw/2+7,y+ch/2); ctx.lineTo(x+cw/2-5,y+ch/2+7); ctx.closePath(); ctx.fill();
      ctx.fillStyle="rgba(255,255,255,0.3)"; ctx.font="6px monospace";
      ctx.fillText(`Clip#${(i+Math.floor(t))%99}`,x+4,y+ch-5);
    }
    ctx.fillStyle="rgba(255,255,255,0.4)"; ctx.font="bold 9px monospace";
    ctx.fillText("CLOUD ARCHIVE  →  GOOGLE DRIVE", 10, 18);
  },

  "gatekeeper": (ctx, w, h, t) => {
    const approved = (Math.floor(t/2)%2)===1;
    const gc = approved ? "#22c55e" : "#ef4444";
    // admin
    ctx.fillStyle="#3b82f6"; ctx.beginPath(); ctx.arc(80,h/2,12,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle="#fff"; ctx.lineWidth=1.5; ctx.stroke();
    ctx.fillStyle="#9ca3af"; ctx.font="7px monospace"; ctx.fillText("ADMIN",65,h/2+26);
    // guest
    ctx.fillStyle=gc; ctx.beginPath(); ctx.arc(w-80,h/2,12,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle="#fff"; ctx.lineWidth=1.5; ctx.stroke();
    ctx.fillStyle="#9ca3af"; ctx.fillText(approved?"VIEWER":"LOCKED",w-100,h/2+26);
    // beam
    ctx.strokeStyle=gc+"80"; ctx.lineWidth=2; ctx.setLineDash([6,4]);
    ctx.beginPath(); ctx.moveTo(92,h/2); ctx.bezierCurveTo(w/2,h/2-30+Math.sin(t*4)*15,w/2,h/2+30-Math.sin(t*4)*15,w-92,h/2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle=gc; ctx.font="bold 9px monospace";
    ctx.fillText(approved?"ACCESS APPROVED":"SCANNING KEY…",10,18);
  },

  "ai-zoom-enhance": (ctx, w, h, t) => {
    const zoom = 1+(Math.sin(t)*0.5+0.5)*3;
    const cx=w/2, cy=h/2;
    // original frame guide
    ctx.strokeStyle="rgba(255,255,255,0.1)"; ctx.lineWidth=1; ctx.setLineDash([3,3]);
    ctx.strokeRect(cx-45,cy-55,90,90); ctx.setLineDash([]);
    // zoomed face outline
    ctx.strokeStyle = zoom>2.5?"#f97316":"#ffffff"; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.ellipse(cx,cy,14*zoom,18*zoom,0,0,Math.PI*2); ctx.stroke();
    // eyes
    [-1,1].forEach(s=>{
      ctx.beginPath(); ctx.arc(cx+s*5*zoom,cy-5*zoom,2*zoom,0,Math.PI*2); ctx.fill();
    });
    // zoom label
    ctx.fillStyle = zoom>2.5?"#f97316":"#9ca3af"; ctx.font="bold 9px monospace";
    ctx.fillText(`${zoom.toFixed(1)}× AI UPSCALE`,10,18);
    // corner brackets
    [[cx-46,cy-56],[cx+46,cy-56],[cx-46,cy+34],[cx+46,cy+34]].forEach(([bx,by],i)=>{
      const sx=i%2===0?1:-1, sy=i<2?1:-1;
      ctx.strokeStyle="#f97316"; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(bx,by); ctx.lineTo(bx+sx*8,by); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx,by); ctx.lineTo(bx,by+sy*8); ctx.stroke();
    });
  },

  "noise-isolation": (ctx, w, h, t) => {
    // noisy wave
    ctx.strokeStyle="#ef4444"; ctx.lineWidth=1.5;
    ctx.beginPath();
    for(let x=10;x<w-10;x++){
      const y=38+Math.sin(x*0.12+t)*10+(Math.random()-0.5)*8;
      x===10?ctx.moveTo(x,y):ctx.lineTo(x,y);
    } ctx.stroke();
    // clean wave
    ctx.strokeStyle="#22c55e"; ctx.lineWidth=2;
    ctx.beginPath();
    for(let x=10;x<w-10;x++){
      const y=88+Math.sin(x*0.07+t)*12;
      x===10?ctx.moveTo(x,y):ctx.lineTo(x,y);
    } ctx.stroke();
    // labels
    ctx.fillStyle="#ef4444"; ctx.font="7px monospace"; ctx.fillText("NOISE  (STATIC + WIND)", 10,22);
    ctx.fillStyle="#22c55e"; ctx.fillText("FILTERED  (CLEAN VOICE)", 10,72);
    // filter box
    ctx.strokeStyle="rgba(34,197,94,0.3)"; ctx.lineWidth=1.5; ctx.setLineDash([3,3]);
    ctx.strokeRect(10,60,w-20,42); ctx.setLineDash([]);
  },

  "two-way-talk": (ctx, w, h, t) => {
    const rb=(t*25)%100;
    // radio waves left
    for(let i=0;i<3;i++){
      const r=(rb+i*33)%100;
      const a=Math.max(0,1-r/100);
      ctx.strokeStyle=`rgba(59,130,246,${a*0.6})`; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(65,h/2,r,-0.35*Math.PI,0.35*Math.PI); ctx.stroke();
    }
    // mic icon
    ctx.strokeStyle="#3b82f6"; ctx.lineWidth=2;
    ctx.strokeRect(55,h/2-16,20,24);
    ctx.beginPath(); ctx.arc(65,h/2+8,10,Math.PI,0); ctx.stroke();
    // level bars right
    for(let i=0;i<12;i++){
      const bh=8+Math.abs(Math.sin(t*2.5+i*0.5))*28;
      ctx.fillStyle=`hsl(${210+i*5},80%,${55+i*2}%)`;
      ctx.fillRect(w-80+i*5,h/2+14-bh/2,3.5,bh);
    }
    ctx.fillStyle="#9ca3af"; ctx.font="bold 9px monospace";
    ctx.fillText("TRANSMITTING LIVE AUDIO", 10, 18);
  },

  "drive-quota-control": (ctx, w, h, t) => {
    const pct = 0.5+Math.sin(t)*0.3;
    const bx=30,by=h/2-12,bw=w-60,bh=24;
    // track
    ctx.strokeStyle="rgba(255,255,255,0.15)"; ctx.lineWidth=1.5;
    ctx.strokeRect(bx,by,bw,bh);
    // fill
    ctx.fillStyle=pct>0.78?"#ef4444":"#eab308";
    ctx.fillRect(bx+1,by+1,( bw-2)*pct,bh-2);
    // sweep line at edge
    if(pct>0.78){
      ctx.strokeStyle="#fff"; ctx.lineWidth=2;
      const sx=bx+(bw-2)*pct;
      ctx.beginPath(); ctx.moveTo(sx,by); ctx.lineTo(sx,by+bh); ctx.stroke();
    }
    // ticks
    [0.25,0.5,0.75,1].forEach(p=>{
      ctx.fillStyle="rgba(255,255,255,0.2)"; ctx.fillRect(bx+bw*p-0.5,by+bh,1,6);
      ctx.fillStyle="#9ca3af"; ctx.font="6px monospace";
      ctx.fillText(`${p*100|0}%`,bx+bw*p-6,by+bh+16);
    });
    ctx.fillStyle=pct>0.78?"#ef4444":"#eab308"; ctx.font="bold 9px monospace";
    ctx.fillText(pct>0.78?`FULL — AUTO RECYCLE`:`DRIVE: ${(pct*100)|0}% USED`,10,18);
  },
};

interface Props { featureId: string; }

export const FeatureIllustration = ({ featureId }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const drawFn = drawFns[featureId];
    if (!drawFn) return;

    let animId = 0, t = 0;
    const loop = () => {
      t += 0.04;
      const {width:w, height:h} = canvas;
      ctx.fillStyle = "#090b10";
      ctx.fillRect(0, 0, w, h);
      grid(ctx, w, h);
      ctx.save();
      drawFn(ctx, w, h, t);
      ctx.restore();
      animId = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(animId);
  }, [featureId]);

  return (
    <div className="relative w-full h-36 rounded-[1.5rem] overflow-hidden border border-white/10 bg-[#090b10] my-3">
      <canvas ref={canvasRef} width={420} height={144} className="w-full h-full" />
      <div className="absolute bottom-2 right-3 px-2 py-0.5 bg-black/50 backdrop-blur rounded-lg text-[7px] text-white/30 font-mono tracking-wider">
        Blueprint Simulation
      </div>
    </div>
  );
};
