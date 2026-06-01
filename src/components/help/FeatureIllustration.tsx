// © 2026 HGUARD Elite by Successpartner10. All rights reserved.
// Unauthorized copying, modification, or distribution is strictly prohibited.
import React from "react";

// Shared global CSS injected once for all illustrations
const GLOBAL_CSS = `
@keyframes fi-slide  { 0%,100%{transform:translateX(-15px)} 50%{transform:translateX(15px)} }
@keyframes fi-pulse  { 0%,100%{opacity:.3} 50%{opacity:1} }
@keyframes fi-rotate { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
@keyframes fi-dash   { from{stroke-dashoffset:40} to{stroke-dashoffset:0} }
@keyframes fi-expand { 0%{r:10;opacity:1} 100%{r:68;opacity:0} }
@keyframes fi-scroll { from{transform:translateX(0)} to{transform:translateX(-96px)} }
@keyframes fi-scan   { 0%,100%{transform:translateY(-18px)} 50%{transform:translateY(18px)} }
@keyframes fi-flash  { 0%,49%{fill:#ef4444;stroke:#ef4444} 50%,100%{fill:#3b82f6;stroke:#3b82f6} }
@keyframes fi-zoom   { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }
@keyframes fi-fill   { 0%,100%{width:120px;fill:#eab308} 50%{width:295px;fill:#ef4444} }
@keyframes fi-wave   { from{stroke-dashoffset:0} to{stroke-dashoffset:-50} }
`;

let cssInjected = false;
function ensureCSS() {
  if (cssInjected || typeof document === "undefined") return;
  const s = document.createElement("style");
  s.textContent = GLOBAL_CSS;
  document.head.appendChild(s);
  cssInjected = true;
}

interface Props { featureId: string; }

export const FeatureIllustration: React.FC<Props> = ({ featureId }) => {
  ensureCSS();
  // Sanitise id prefix so it's safe in CSS url() references
  const p = featureId.replace(/[^a-z0-9]/g, "-");

  const Wrap = ({ children }: { children: React.ReactNode }) => (
    <div className="relative w-full h-36 rounded-[1.5rem] overflow-hidden border border-border bg-[#06080d] my-3">
      <svg className="w-full h-full" viewBox="0 0 420 144" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id={`${p}-grid`} width="18" height="18" patternUnits="userSpaceOnUse">
            <circle cx="9" cy="9" r="0.8" fill="rgba(255,255,255,0.1)" />
          </pattern>
          <filter id={`${p}-glow`} x="-25%" y="-25%" width="150%" height="150%">
            <feGaussianBlur stdDeviation="3" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <rect width="420" height="144" fill={`url(#${p}-grid)`} />
        {children}
      </svg>
      <div className="absolute bottom-2 right-3 px-2 py-0.5 bg-background/50 backdrop-blur rounded-lg text-[7px] text-foreground/30 font-mono tracking-wider">Blueprint</div>
    </div>
  );

  const G = (props: React.SVGProps<SVGGElement> & { filter?: string }) =>
    props.filter ? <g filter={`url(#${p}-glow)`} {...props} /> : <g {...props} />;

  switch (featureId) {

    case "tactical-night-vision": return (
      <Wrap>
        <rect x="0" y="0" width="210" height="144" fill="rgba(5,5,10,.8)" />
        <rect x="210" y="0" width="210" height="144" fill="rgba(16,185,129,.04)" />
        <rect x="290" y="42" width="60" height="60" rx="6" stroke="#10b981" strokeWidth="1.5"
          filter={`url(#${p}-glow)`} style={{ animation:"fi-pulse 2s infinite" }} />
        <line x1="320" y1="18" x2="320" y2="126" stroke="rgba(16,185,129,.2)" strokeDasharray="3 3" />
        <line x1="255" y1="72" x2="385" y2="72" stroke="rgba(16,185,129,.2)" strokeDasharray="3 3" />
        <g style={{ animation:"fi-slide 6s ease-in-out infinite" }}>
          <line x1="210" y1="0" x2="210" y2="144" stroke="#fff" strokeWidth="2" strokeDasharray="4 4" />
          <polygon points="210,67 205,72 210,77 215,72" fill="#fff" />
        </g>
        <text x="24" y="28" fill="rgba(255,255,255,.3)" fontSize="8" fontWeight="bold" fontFamily="monospace">RAW</text>
        <text x="224" y="28" fill="#10b981" fontSize="8" fontWeight="bold" fontFamily="monospace" filter={`url(#${p}-glow)`}>AI NIGHT VISION</text>
      </Wrap>
    );

    case "thermal-vision": return (
      <Wrap>
        <ellipse cx="210" cy="72" rx="34" ry="52" fill="rgba(239,68,68,.07)" stroke="rgba(239,68,68,.15)" strokeWidth="1" />
        <ellipse cx="210" cy="72" rx="22" ry="36" fill="rgba(245,158,11,.15)" stroke="#f59e0b" strokeWidth="1.2"
          filter={`url(#${p}-glow)`} style={{ animation:"fi-pulse 3s ease-in-out infinite" }} />
        <circle cx="210" cy="50" r="12" fill="#ef4444" filter={`url(#${p}-glow)`} />
        <ellipse cx="210" cy="80" rx="14" ry="22" fill="#f59e0b" filter={`url(#${p}-glow)`} />
        <circle cx="210" cy="50" r="5" fill="#fff" />
        <path d="M185 72H235 M210 46V98" stroke="rgba(255,255,255,.4)" strokeWidth="1" />
        <rect x="302" y="60" width="92" height="22" rx="5" fill="rgba(239,68,68,.15)" stroke="#ef4444" strokeWidth="1" />
        <text x="348" y="75" textAnchor="middle" fill="#ef4444" fontSize="9" fontWeight="bold" fontFamily="monospace" filter={`url(#${p}-glow)`}>36.7°C</text>
        <text x="24" y="24" fill="#f59e0b" fontSize="9" fontWeight="bold" fontFamily="monospace" filter={`url(#${p}-glow)`}>THERMAL RECONSTRUCTION</text>
      </Wrap>
    );

    case "two-way-talk": return (
      <Wrap>
        <G filter="yes">
          {[0, 0.7, 1.4].map((delay, i) => (
            <circle key={i} cx="90" cy="72" r="14" stroke="#3b82f6" strokeWidth="1.5" fill="none"
              style={{ animation:`fi-expand 2.1s ease-out ${delay}s infinite` }} />
          ))}
          <circle cx="90" cy="72" r="16" fill="#3b82f6" />
          <rect x="85" y="62" width="10" height="16" rx="5" fill="#fff" />
          <path d="M81 70 A9 9 0 0 0 99 70 M90 79 V85 M85 85 H95" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        </G>
        <line x1="120" y1="72" x2="270" y2="72" stroke="rgba(59,130,246,.3)" strokeWidth="2" strokeDasharray="6 5" />
        {[0,10,20,30,40].map((x, i) => {
          const heights = [18, 32, 24, 40, 14];
          return <rect key={i} x={290+x} y={72-heights[i]/2} width="5" height={heights[i]} rx="2.5" fill="#3b82f6"
            style={{ animation:`fi-pulse ${0.6+i*0.15}s ease-in-out ${i*0.1}s infinite` }} />;
        })}
        <text x="24" y="24" fill="#3b82f6" fontSize="9" fontWeight="bold" fontFamily="monospace" filter={`url(#${p}-glow)`}>DUPLEX BROADCASTING</text>
      </Wrap>
    );

    case "mesh-tracking": return (
      <Wrap>
        <path d="M60 20 L20 120 H140 Z" fill="rgba(59,130,246,.03)" stroke="rgba(59,130,246,.15)" strokeWidth="1" strokeDasharray="3 3" />
        <path d="M210 20 L130 120 H290 Z" fill="rgba(16,185,129,.05)" stroke="#10b981" strokeWidth="1.5" strokeDasharray="3 3" />
        <path d="M360 20 L300 120 H420 Z" fill="rgba(245,158,11,.03)" stroke="rgba(245,158,11,.15)" strokeWidth="1" strokeDasharray="3 3" />
        <circle cx="60" cy="20" r="5" fill="#3b82f6" /><circle cx="210" cy="20" r="5" fill="#10b981" /><circle cx="360" cy="20" r="5" fill="#f59e0b" />
        <line x1="65" y1="20" x2="205" y2="20" stroke="rgba(255,255,255,.1)" strokeWidth="1" strokeDasharray="4 4" />
        <line x1="215" y1="20" x2="355" y2="20" stroke="rgba(255,255,255,.1)" strokeWidth="1" strokeDasharray="4 4" />
        <g style={{ animation:"fi-slide 5s ease-in-out infinite" }}>
          <rect x="192" y="60" width="16" height="16" rx="2" stroke="#10b981" strokeWidth="1.5" fill="rgba(16,185,129,.15)" filter={`url(#${p}-glow)`} />
          <path d="M140 68 C175 48 195 88 250 72" stroke="#10b981" strokeWidth="1.2" strokeDasharray="5 4"
            style={{ animation:"fi-dash 2s linear infinite" }} fill="none" />
        </g>
        <text x="24" y="24" fill="#10b981" fontSize="9" fontWeight="bold" fontFamily="monospace" filter={`url(#${p}-glow)`}>DYNAMIC MESH TRACKING</text>
      </Wrap>
    );

    case "ai-threat-guard": return (
      <Wrap>
        <line x1="60" y1="72" x2="360" y2="72" stroke="rgba(255,255,255,.15)" strokeWidth="2" strokeDasharray="8 5"
          style={{ animation:"fi-dash 1.5s linear infinite" }} />
        {[{x:80,c:"#3b82f6",l:"INPUT"},{x:210,c:"#f59e0b",l:"AI SCORE"},{x:340,c:"#ef4444",l:"THREAT"}].map(({x,c,l})=>(
          <g key={x} transform={`translate(${x},72)`}>
            <circle cx="0" cy="0" r="16" fill={`${c}22`} stroke={c} strokeWidth="1.5" filter={`url(#${p}-glow)`}
              style={{ animation:"fi-pulse 1.8s infinite" }} />
            <circle cx="0" cy="0" r="6" fill={c} />
            <text x="0" y="28" textAnchor="middle" fill="rgba(255,255,255,.4)" fontSize="7" fontWeight="bold" fontFamily="monospace">{l}</text>
          </g>
        ))}
        <text x="24" y="24" fill="#ef4444" fontSize="9" fontWeight="bold" fontFamily="monospace" filter={`url(#${p}-glow)`}>PREDICTIVE AI SHIELD</text>
      </Wrap>
    );

    case "siren-defense": return (
      <Wrap>
        <g transform="translate(210,72)">
          {[0, 0.5, 1].map((d, i) => (
            <circle key={i} cx="0" cy="0" r="10" strokeWidth="2" fill="none"
              style={{ animation:`fi-expand 1.5s ease-out ${d}s infinite`, stroke:"#ef4444" }} />
          ))}
          <path d="M-12 16 C-12-14 12-14 12 16 Z" fill="#ef4444" filter={`url(#${p}-glow)`}
            style={{ animation:"fi-flash 1s step-end infinite" }} />
          <ellipse cx="0" cy="18" rx="18" ry="5" fill="rgba(255,255,255,.15)" stroke="rgba(255,255,255,.3)" />
          <rect x="-4" y="8" width="8" height="10" fill="#fff" />
        </g>
        <text x="24" y="24" fill="#ef4444" fontSize="9" fontWeight="bold" fontFamily="monospace" filter={`url(#${p}-glow)`}>DETERRENCE SIREN ACTIVE</text>
      </Wrap>
    );

    case "bridge-mode": return (
      <Wrap>
        <rect x="40" y="18" width="340" height="108" rx="8" fill="rgba(255,255,255,.02)" stroke="rgba(255,255,255,.15)" strokeWidth="1.5" />
        <rect x="40" y="18" width="340" height="18" fill="rgba(255,255,255,.04)" />
        {["#ef4444","#eab308","#22c55e"].map((c,i)=><circle key={i} cx={56+i*12} cy="27" r="4" fill={c} />)}
        <g style={{ animation:"fi-pulse 3s ease-in-out infinite" }}>
          <rect x="60" y="46" width="300" height="72" rx="5" stroke="#f59e0b" strokeWidth="1.2" fill="none" filter={`url(#${p}-glow)`} />
          <rect x="70" y="52" width="280" height="60" rx="4" stroke="#f59e0b" strokeWidth="0.7" strokeDasharray="3 3" fill="none" />
        </g>
        <text x="24" y="15" fill="#f59e0b" fontSize="9" fontWeight="bold" fontFamily="monospace" filter={`url(#${p}-glow)`}>SCREEN CAST STREAMING</text>
      </Wrap>
    );

    case "elite-archive": return (
      <Wrap>
        <g style={{ animation:"fi-scroll 4s linear infinite" }}>
          {Array.from({length:7}).map((_,i)=>(
            <g key={i} transform={`translate(${i*96},40)`}>
              <rect x="6" y="0" width="80" height="56" rx="5" fill="rgba(255,255,255,.02)" stroke="rgba(255,255,255,.2)" strokeWidth="1.2" />
              <polygon points="42,20 42,36 54,28" fill="rgba(255,255,255,.5)" filter={`url(#${p}-glow)`} />
              <text x="12" y="48" fill="rgba(255,255,255,.25)" fontSize="6" fontWeight="bold" fontFamily="monospace">{`CLIP_0${i}`}</text>
            </g>
          ))}
        </g>
        <text x="24" y="24" fill="rgba(255,255,255,.5)" fontSize="9" fontWeight="bold" fontFamily="monospace">CLOUD ARCHIVE</text>
      </Wrap>
    );

    case "gatekeeper": return (
      <Wrap>
        <g transform="translate(80,72)">
          <circle cx="0" cy="0" r="16" fill="rgba(59,130,246,.15)" stroke="#3b82f6" strokeWidth="1.5" />
          <rect x="-6" y="-6" width="12" height="12" rx="2" fill="#3b82f6" filter={`url(#${p}-glow)`} />
          <text x="0" y="28" textAnchor="middle" fill="#3b82f6" fontSize="7" fontWeight="bold" fontFamily="monospace">ADMIN</text>
        </g>
        <path d="M96 72 Q210 36 324 72" stroke="#10b981" strokeWidth="2" strokeDasharray="6 4" fill="none"
          filter={`url(#${p}-glow)`} style={{ animation:"fi-dash 2s linear infinite" }} />
        <g transform="translate(340,72)">
          <circle cx="0" cy="0" r="16" fill="rgba(16,185,129,.15)" stroke="#10b981" strokeWidth="1.5" />
          <circle cx="0" cy="0" r="6" fill="#10b981" filter={`url(#${p}-glow)`} />
          <text x="0" y="28" textAnchor="middle" fill="#10b981" fontSize="7" fontWeight="bold" fontFamily="monospace">APPROVED</text>
        </g>
        <text x="24" y="24" fill="#10b981" fontSize="9" fontWeight="bold" fontFamily="monospace" filter={`url(#${p}-glow)`}>ACCESS WORKFLOW</text>
      </Wrap>
    );

    case "ai-zoom-enhance": return (
      <Wrap>
        <g transform="translate(210,72)">
          <ellipse cx="0" cy="0" rx="36" ry="44" stroke="#f59e0b" strokeWidth="1.5" fill="rgba(245,124,0,.05)"
            filter={`url(#${p}-glow)`} style={{ animation:"fi-zoom 4s ease-in-out infinite", transformOrigin:"center" }} />
          <path d="M-20-12 C-12-22 12-22 20-12 M-18 14 C-10 24 10 24 18 14" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="-9" cy="-6" r="3" fill="#fff" /><circle cx="9" cy="-6" r="3" fill="#fff" />
          <line x1="-48" y1="0" x2="48" y2="0" stroke="#f59e0b" strokeWidth="1.2"
            filter={`url(#${p}-glow)`} style={{ animation:"fi-scan 2s ease-in-out infinite" }} />
        </g>
        <path d="M162 28H174V40 M258 28H246V40 M162 116H174V104 M258 116H246V104" stroke="#f59e0b" strokeWidth="2" />
        <text x="24" y="24" fill="#f59e0b" fontSize="9" fontWeight="bold" fontFamily="monospace" filter={`url(#${p}-glow)`}>AI 4× UPSCALE</text>
      </Wrap>
    );

    case "noise-isolation": return (
      <Wrap>
        <text x="24" y="18" fill="#ef4444" fontSize="7" fontWeight="bold" fontFamily="monospace">NOISE (STATIC + WIND)</text>
        <path d="M24 38 Q74 18 124 48 T224 36 T324 46 T396 34" stroke="#ef4444" strokeWidth="1.5" fill="none" strokeDasharray="4 3" />
        <text x="24" y="82" fill="#10b981" fontSize="7" fontWeight="bold" fontFamily="monospace">ISOLATED VOICE CHANNEL</text>
        <path d="M24 100 Q99 80 174 100 T324 100 T396 100" stroke="#10b981" strokeWidth="2" fill="none"
          filter={`url(#${p}-glow)`} strokeDasharray="80" style={{ animation:"fi-wave 2s linear infinite" }} />
        <rect x="24" y="88" width="372" height="30" rx="4" stroke="rgba(16,185,129,.2)" strokeWidth="1" strokeDasharray="3 3" fill="none" />
      </Wrap>
    );

    case "drive-quota-control": return (
      <Wrap>
        <rect x="36" y="52" width="348" height="26" rx="8" fill="rgba(255,255,255,.02)" stroke="rgba(255,255,255,.15)" strokeWidth="1.5" />
        <rect x="38" y="54" height="22" rx="6" fill="#eab308" filter={`url(#${p}-glow)`}
          style={{ animation:"fi-fill 6s ease-in-out infinite" }} />
        <line x1="295" y1="44" x2="295" y2="84" stroke="rgba(239,68,68,.5)" strokeWidth="1.5" strokeDasharray="3 3" />
        <text x="295" y="40" textAnchor="middle" fill="#ef4444" fontSize="7" fontWeight="black" fontFamily="monospace">90% LIMIT</text>
        <text x="24" y="28" fill="#eab308" fontSize="9" fontWeight="bold" fontFamily="monospace" filter={`url(#${p}-glow)`}>CLOUD STORAGE QUOTA</text>
      </Wrap>
    );

    case "super-zoom-capture": return (
      <Wrap>
        <circle cx="210" cy="72" r="44" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="4 3" fill="none"
          filter={`url(#${p}-glow)`} style={{ animation:"fi-zoom 2.5s ease-in-out infinite", transformOrigin:"210px 72px" }} />
        <circle cx="210" cy="72" r="3" fill="#3b82f6" />
        <path d="M210 18V64 M210 80V126 M154 72H202 M218 72H266" stroke="rgba(59,130,246,.3)" strokeWidth="1" />
        <path d="M154 34H166V46 M266 34H254V46 M154 110H166V98 M266 110H254V98" stroke="#3b82f6" strokeWidth="2" />
        <text x="24" y="24" fill="#3b82f6" fontSize="9" fontWeight="bold" fontFamily="monospace" filter={`url(#${p}-glow)`}>AI SUPER ZOOM</text>
      </Wrap>
    );

    case "multi-camera-grid": return (
      <Wrap>
        <line x1="210" y1="8" x2="210" y2="136" stroke="rgba(255,255,255,.15)" strokeWidth="1.5" />
        <line x1="20" y1="72" x2="400" y2="72" stroke="rgba(255,255,255,.15)" strokeWidth="1.5" />
        {[{x:35,y:32,cam:"CAM_01",dot:{x:198,y:28}},{x:225,y:32,cam:"CAM_02",dot:{x:388,y:28}},
          {x:35,y:94,cam:"CAM_03",dot:{x:198,y:90}},{x:225,y:94,cam:"CAM_04",dot:{x:388,y:90}}]
          .map(({x,y,cam,dot},i)=>(
            <g key={i}>
              <text x={x} y={y} fill="rgba(255,255,255,.25)" fontSize="8" fontWeight="bold" fontFamily="monospace">{cam}</text>
              <circle cx={dot.x} cy={dot.y} r="4" fill="#ef4444" filter={`url(#${p}-glow)`}
                style={{ animation:`fi-pulse ${1+i*0.2}s infinite` }} />
            </g>
          ))}
        <text x="24" y="10" fill="rgba(255,255,255,.4)" fontSize="9" fontWeight="bold" fontFamily="monospace">MULTI-CAMERA GRID VIEW</text>
      </Wrap>
    );

    case "multi-ai-quota": return (
      <Wrap>
        <path d="M84 72 H180 M240 72 H336" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="6 4"
          style={{ animation:"fi-dash 1.5s linear infinite" }} />
        <path d="M84 72 Q175 30 210 52 Q245 30 336 72" stroke="rgba(16,185,129,.4)" strokeWidth="1.2"
          strokeDasharray="5 4" style={{ animation:"fi-dash 2s linear infinite" }} fill="none" />
        {[{x:72,c:"#10b981",l:"GEMINI"},{x:210,c:"#3b82f6",l:"OPENAI"},{x:348,c:"#f59e0b",l:"GROQ"}].map(({x,c,l})=>(
          <g key={x} transform={`translate(${x},72)`}>
            <rect x="-26" y="-14" width="52" height="28" rx="4" fill={`${c}22`} stroke={c} strokeWidth="1.5" filter={`url(#${p}-glow)`} />
            <text x="0" y="4" textAnchor="middle" fill={c} fontSize="7" fontWeight="black" fontFamily="monospace">{l}</text>
          </g>
        ))}
        <text x="24" y="24" fill="#10b981" fontSize="9" fontWeight="bold" fontFamily="monospace" filter={`url(#${p}-glow)`}>MULTI-AI QUOTA CASCADE</text>
      </Wrap>
    );

    case "hardware-optical-zoom": return (
      <Wrap>
        <rect x="60" y="44" width="300" height="56" rx="4" fill="rgba(255,255,255,.02)" stroke="rgba(255,255,255,.15)" strokeWidth="1.5" />
        <line x1="90" y1="72" x2="330" y2="72" stroke="rgba(255,255,255,.1)" strokeWidth="2" strokeDasharray="3 3" />
        <g style={{ animation:"fi-slide 4s ease-in-out infinite" }}>
          <rect x="174" y="50" width="12" height="44" rx="3" fill="#3b82f6" filter={`url(#${p}-glow)`} opacity="0.8" />
          <rect x="196" y="54" width="10" height="36" rx="2" fill="#60a5fa" opacity="0.6" />
          <line x1="160" y1="44" x2="160" y2="100" stroke="#3b82f6" strokeWidth="1.2" />
          <text x="120" y="40" fill="#3b82f6" fontSize="7" fontWeight="bold" fontFamily="monospace">OPTICAL STAGE</text>
        </g>
        <text x="24" y="28" fill="#3b82f6" fontSize="9" fontWeight="bold" fontFamily="monospace" filter={`url(#${p}-glow)`}>LENS NEGOTIATING</text>
      </Wrap>
    );

    default: return (
      <Wrap>
        <circle cx="210" cy="72" r="18" fill="rgba(255,255,255,.04)" stroke="rgba(255,255,255,.2)" strokeWidth="1.5"
          style={{ animation:"fi-pulse 2s infinite" }} />
      </Wrap>
    );
  }
};
