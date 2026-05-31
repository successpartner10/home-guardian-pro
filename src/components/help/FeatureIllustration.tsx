import React from "react";

interface Props {
  featureId: string;
}

export const FeatureIllustration: React.FC<Props> = ({ featureId }) => {
  // Common high-tech SVG components (like a grid background and glow filter)
  const renderDefs = () => (
    <defs>
      {/* Crisp Blueprint Grid Pattern */}
      <pattern id="helpGrid" width="18" height="18" patternUnits="userSpaceOnUse">
        <circle cx="9" cy="9" r="0.8" fill="rgba(255, 255, 255, 0.12)" />
      </pattern>
      {/* High-Tech Vector Neon Glow Filter */}
      <filter id="vectorGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3.5" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );

  const renderGridBg = () => (
    <rect width="100%" height="100%" fill="url(#helpGrid)" />
  );

  // Render highly-scalable, responsive, sexy animated vector SVGs for each feature
  switch (featureId) {
    case "tactical-night-vision":
      return (
        <div className="relative w-full h-36 rounded-[1.5rem] overflow-hidden border border-white/10 bg-[#06080d] my-3">
          <svg className="w-full h-full" viewBox="0 0 420 144" fill="none" xmlns="http://www.w3.org/2000/svg">
            <style>{`
              @keyframes slideDivider {
                0%, 100% { transform: translateX(-20px); }
                50% { transform: translateX(20px); }
              }
              @keyframes pulseGreen {
                0%, 100% { opacity: 0.3; }
                50% { opacity: 1; }
              }
              .divider { animation: slideDivider 6s ease-in-out infinite; }
              .target-box { animation: pulseGreen 2s infinite; }
            `}</style>
            {renderDefs()}
            {renderGridBg()}

            {/* Left Dark Area */}
            <rect x="0" y="0" width="210" height="144" fill="rgba(5, 5, 10, 0.85)" />
            <circle cx="105" cy="72" r="22" fill="rgba(255, 255, 255, 0.02)" stroke="rgba(255, 255, 255, 0.08)" strokeDasharray="3 3" />
            <text x="30" y="30" fill="rgba(255, 255, 255, 0.3)" fontSize="9" fontWeight="bold" fontFamily="monospace">RAW VIEW</text>

            {/* Right Tactical Green Boosted Area */}
            <g clipPath="url(#boostedClip)">
              <rect x="210" y="0" width="210" height="144" fill="rgba(16, 185, 129, 0.04)" />
              {/* Target tracking box */}
              <rect className="target-box" x="290" y="42" width="60" height="60" rx="8" stroke="#10b981" strokeWidth="1.5" filter="url(#vectorGlow)" />
              <line className="target-box" x1="320" y1="30" x2="320" y2="114" stroke="rgba(16, 185, 129, 0.2)" strokeDasharray="3 3" />
              <line className="target-box" x1="260" y1="72" x2="380" y2="72" stroke="rgba(16, 185, 129, 0.2)" strokeDasharray="3 3" />
              <text x="375" y="30" textAnchor="end" fill="#10b981" fontSize="9" fontWeight="bold" fontFamily="monospace" filter="url(#vectorGlow)">NIGHT VISION ENABLED</text>
            </g>

            {/* Scanning Slider Divider Line */}
            <g className="divider">
              <line x1="210" y1="0" x2="210" y2="144" stroke="#ffffff" strokeWidth="2" strokeDasharray="4 4" />
              <polygon points="210,67 205,72 210,77 215,72" fill="#ffffff" />
            </g>
          </svg>
        </div>
      );

    case "thermal-vision":
      return (
        <div className="relative w-full h-36 rounded-[1.5rem] overflow-hidden border border-white/10 bg-[#06080d] my-3">
          <svg className="w-full h-full" viewBox="0 0 420 144" fill="none" xmlns="http://www.w3.org/2000/svg">
            <style>{`
              @keyframes thermalPulse {
                0%, 100% { transform: scale(1) translate(0px, 0px); }
                50% { transform: scale(1.05) translate(4px, -2px); }
              }
              @keyframes tempFlicker {
                0%, 100% { opacity: 0.9; }
                50% { opacity: 0.6; }
              }
              .thermal-figure { animation: thermalPulse 5s ease-in-out infinite; transform-origin: center; }
              .temp-text { animation: tempFlicker 1.5s infinite; }
            `}</style>
            {renderDefs()}
            {renderGridBg()}

            {/* Glowing thermal target body heat signature */}
            <g className="thermal-figure">
              {/* Outer heat gradient rings */}
              <ellipse cx="210" cy="72" rx="34" ry="50" fill="rgba(239, 68, 68, 0.08)" stroke="rgba(239, 68, 68, 0.15)" strokeWidth="1" />
              <ellipse cx="210" cy="72" rx="22" ry="36" fill="rgba(245, 158, 11, 0.15)" stroke="rgba(245, 158, 11, 0.3)" strokeWidth="1.5" />
              
              {/* High heat core */}
              <circle cx="210" cy="50" r="12" fill="#ef4444" filter="url(#vectorGlow)" />
              <ellipse cx="210" cy="80" rx="14" ry="24" fill="#f59e0b" filter="url(#vectorGlow)" />
              <circle cx="210" cy="50" r="6" fill="#fff" />
              
              {/* Tactical Crosshair overlay */}
              <path d="M190 72 H230 M210 52 V92" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
            </g>

            {/* Floating telemetry metrics */}
            <text x="25" y="30" fill="#f59e0b" fontSize="9" fontWeight="black" fontFamily="monospace" filter="url(#vectorGlow)">RECONSTRUCTED THERMAL</text>
            <g className="temp-text" transform="translate(305, 68)">
              <rect x="0" y="0" width="90" height="24" rx="6" fill="rgba(239, 68, 68, 0.15)" stroke="#ef4444" strokeWidth="1" />
              <text x="45" y="15" textAnchor="middle" fill="#ef4444" fontSize="10" fontWeight="bold" fontFamily="monospace" filter="url(#vectorGlow)">36.7°C ACTIVE</text>
            </g>
          </svg>
        </div>
      );

    case "two-way-talk":
      return (
        <div className="relative w-full h-36 rounded-[1.5rem] overflow-hidden border border-white/10 bg-[#06080d] my-3">
          <svg className="w-full h-full" viewBox="0 0 420 144" fill="none" xmlns="http://www.w3.org/2000/svg">
            <style>{`
              @keyframes soundRings {
                0% { r: 12; opacity: 1; }
                100% { r: 64; opacity: 0; }
              }
              @keyframes audioBar {
                0%, 100% { height: 10px; }
                50% { height: 42px; }
              }
              .ring1 { animation: soundRings 2.4s linear infinite; }
              .ring2 { animation: soundRings 2.4s linear infinite 0.8s; }
              .ring3 { animation: soundRings 2.4s linear infinite 1.6s; }
              .bar1 { animation: audioBar 0.8s ease-in-out infinite; }
              .bar2 { animation: audioBar 0.9s ease-in-out infinite 0.15s; }
              .bar3 { animation: audioBar 0.7s ease-in-out infinite 0.3s; }
              .bar4 { animation: audioBar 1.1s ease-in-out infinite 0.05s; }
            `}</style>
            {renderDefs()}
            {renderGridBg()}

            {/* Left Emitter */}
            <g transform="translate(90, 72)">
              <circle cx="0" cy="0" r="16" fill="#3b82f6" filter="url(#vectorGlow)" />
              {/* Pulsing sound waves */}
              <circle className="ring1" cx="0" cy="0" r="16" stroke="#3b82f6" strokeWidth="1.5" fill="none" />
              <circle className="ring2" cx="0" cy="0" r="16" stroke="#3b82f6" strokeWidth="1.5" fill="none" />
              <circle className="ring3" cx="0" cy="0" r="16" stroke="#3b82f6" strokeWidth="1.5" fill="none" />
              {/* Mic vector graphic */}
              <rect x="-5" y="-10" width="10" height="16" rx="5" fill="#fff" />
              <path d="M-9 -2 A9 9 0 0 0 9 -2 M0 7 V12 M-5 12 H5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
            </g>

            {/* Connecting radio beam */}
            <line x1="120" y1="72" x2="270" y2="72" stroke="rgba(59, 130, 246, 0.3)" strokeWidth="2" strokeDasharray="6 6" />

            {/* Right Signal Level Bars */}
            <g transform="translate(300, 72)">
              <rect className="bar1" x="0" y="-5" width="5" height="10" rx="2.5" fill="#3b82f6" transform="translate(0, 0) scale(1, -1)" />
              <rect className="bar2" x="10" y="-5" width="5" height="10" rx="2.5" fill="#60a5fa" transform="translate(0, 0) scale(1, -1)" />
              <rect className="bar3" x="20" y="-5" width="5" height="10" rx="2.5" fill="#93c5fd" transform="translate(0, 0) scale(1, -1)" />
              <rect className="bar4" x="30" y="-5" width="5" height="10" rx="2.5" fill="#3b82f6" transform="translate(0, 0) scale(1, -1)" />
            </g>

            <text x="25" y="30" fill="#3b82f6" fontSize="9" fontWeight="bold" fontFamily="monospace" filter="url(#vectorGlow)">DUPLEX BROADCASTING</text>
          </svg>
        </div>
      );

    case "mesh-tracking":
      return (
        <div className="relative w-full h-36 rounded-[1.5rem] overflow-hidden border border-white/10 bg-[#06080d] my-3">
          <svg className="w-full h-full" viewBox="0 0 420 144" fill="none" xmlns="http://www.w3.org/2000/svg">
            <style>{`
              @keyframes pathTrace {
                0% { stroke-dashoffset: 40; }
                100% { stroke-dashoffset: 0; }
              }
              @keyframes targetLock {
                0%, 100% { transform: translate(0px, 0px); }
                50% { transform: translate(60px, 20px); }
              }
              .flight-path { stroke-dasharray: 6 4; animation: pathTrace 2s linear infinite; }
              .mesh-target { animation: targetLock 6s ease-in-out infinite; }
            `}</style>
            {renderDefs()}
            {renderGridBg()}

            {/* Three Dotted Camera Fields of View */}
            {/* Cam 1 */}
            <path d="M60 20 L20 110 H140 Z" fill="rgba(59, 130, 246, 0.03)" stroke="rgba(59, 130, 246, 0.15)" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx="60" cy="20" r="5" fill="#3b82f6" />

            {/* Cam 2 */}
            <path d="M210 20 L130 110 H290 Z" fill="rgba(16, 185, 129, 0.04)" stroke="rgba(16, 185, 129, 0.3)" strokeWidth="1.5" strokeDasharray="3 3" />
            <circle cx="210" cy="20" r="5" fill="#10b981" />

            {/* Cam 3 */}
            <path d="M360 20 L300 110 H420 Z" fill="rgba(245, 158, 11, 0.03)" stroke="rgba(245, 158, 11, 0.15)" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx="360" cy="20" r="5" fill="#f59e0b" />

            {/* Inter-camera lock handoff beams */}
            <line x1="60" y1="20" x2="210" y2="20" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" strokeDasharray="4 4" />
            <line x1="210" y1="20" x2="360" y2="20" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" strokeDasharray="4 4" />

            {/* Target being tracked */}
            <g className="mesh-target" transform="translate(140, 68)">
              {/* Dotted path tracking trail */}
              <path className="flight-path" d="M -80 0 C -20 20, 20 -20, 80 10" stroke="#10b981" strokeWidth="1.5" fill="none" />
              <rect x="-8" y="-8" width="16" height="16" stroke="#10b981" strokeWidth="1.5" fill="rgba(16, 185, 129, 0.15)" filter="url(#vectorGlow)" />
              {/* Target tag */}
              <text x="12" y="4" fill="#10b981" fontSize="7" fontWeight="bold" fontFamily="monospace">LOCK_02A</text>
            </g>

            <text x="25" y="30" fill="#10b981" fontSize="9" fontWeight="bold" fontFamily="monospace" filter="url(#vectorGlow)">DYNAMIC MESH TRACKING</text>
          </svg>
        </div>
      );

    case "ai-threat-guard":
      return (
        <div className="relative w-full h-36 rounded-[1.5rem] overflow-hidden border border-white/10 bg-[#06080d] my-3">
          <svg className="w-full h-full" viewBox="0 0 420 144" fill="none" xmlns="http://www.w3.org/2000/svg">
            <style>{`
              @keyframes pipelineFlow {
                0% { stroke-dashoffset: 24; }
                100% { stroke-dashoffset: 0; }
              }
              @keyframes threatPulse {
                0%, 100% { transform: scale(1); filter: drop-shadow(0 0 2px #ef4444); }
                50% { transform: scale(1.15); filter: drop-shadow(0 0 8px #ef4444); }
              }
              .pipe-flow { stroke-dasharray: 8 6; animation: pipelineFlow 1.2s linear infinite; }
              .danger-badge { animation: threatPulse 1.5s infinite; }
            `}</style>
            {renderDefs()}
            {renderGridBg()}

            {/* Neural nodes pipeline */}
            <path className="pipe-flow" d="M60 72 H360" stroke="rgba(255, 255, 255, 0.2)" strokeWidth="2.5" />

            {/* Node 1: Input */}
            <g transform="translate(80, 72)">
              <circle cx="0" cy="0" r="14" fill="rgba(59, 130, 246, 0.15)" stroke="#3b82f6" strokeWidth="1.5" />
              <circle cx="0" cy="0" r="6" fill="#3b82f6" filter="url(#vectorGlow)" />
              <text x="0" y="24" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="8" fontWeight="bold" fontFamily="monospace">INPUT</text>
            </g>

            {/* Node 2: Analysis */}
            <g transform="translate(210, 72)">
              <circle cx="0" cy="0" r="18" fill="rgba(245, 158, 11, 0.15)" stroke="#f59e0b" strokeWidth="1.5" />
              <circle cx="0" cy="0" r="8" fill="#f59e0b" filter="url(#vectorGlow)" />
              <text x="0" y="28" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="8" fontWeight="bold" fontFamily="monospace">VECTOR LAB</text>
            </g>

            {/* Node 3: Risk Alert output */}
            <g className="danger-badge" transform="translate(340, 72)">
              <circle cx="0" cy="0" r="16" fill="rgba(239, 68, 68, 0.2)" stroke="#ef4444" strokeWidth="2" />
              <polygon points="0,-7 7,5 -7,5" fill="#ef4444" filter="url(#vectorGlow)" />
              <text x="0" y="26" textAnchor="middle" fill="#ef4444" fontSize="8" fontWeight="bold" fontFamily="monospace">THREAT</text>
            </g>

            <text x="25" y="30" fill="#ef4444" fontSize="9" fontWeight="bold" fontFamily="monospace" filter="url(#vectorGlow)">PREDICTIVE AI SHIELD</text>
          </svg>
        </div>
      );

    case "siren-defense":
      return (
        <div className="relative w-full h-36 rounded-[1.5rem] overflow-hidden border border-white/10 bg-[#06080d] my-3">
          <svg className="w-full h-full" viewBox="0 0 420 144" fill="none" xmlns="http://www.w3.org/2000/svg">
            <style>{`
              @keyframes flashRedBlue {
                0%, 100% { fill: #ef4444; stroke: #ef4444; }
                50% { fill: #3b82f6; stroke: #3b82f6; }
              }
              @keyframes expandWaves {
                0% { r: 10; opacity: 1; stroke-width: 1; }
                100% { r: 70; opacity: 0; stroke-width: 3; }
              }
              .siren-core { animation: flashRedBlue 1s step-end infinite; }
              .sound-wave-expand { animation: expandWaves 1.5s ease-out infinite; }
            `}</style>
            {renderDefs()}
            {renderGridBg()}

            <g transform="translate(210, 72)">
              {/* Expanding alarm waves */}
              <circle className="sound-wave-expand siren-core" cx="0" cy="0" r="10" stroke="#ef4444" fill="none" />
              <circle className="sound-wave-expand siren-core" cx="0" cy="0" r="10" stroke="#ef4444" fill="none" style={{ animationDelay: "0.5s" }} />
              <circle className="sound-wave-expand siren-core" cx="0" cy="0" r="10" stroke="#ef4444" fill="none" style={{ animationDelay: "1s" }} />

              {/* Siren structure */}
              <ellipse cx="0" cy="18" rx="20" ry="6" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.3)" />
              <path d="M-12 18 C-12 -12 12 -12 12 18 Z" className="siren-core" filter="url(#vectorGlow)" />
              <rect x="-4" y="8" width="8" height="10" fill="#fff" />
            </g>

            <text x="25" y="30" fill="#ef4444" fontSize="9" fontWeight="bold" fontFamily="monospace" filter="url(#vectorGlow)">DETERRENCE SIREN ACTIVE</text>
          </svg>
        </div>
      );

    case "bridge-mode":
      return (
        <div className="relative w-full h-36 rounded-[1.5rem] overflow-hidden border border-white/10 bg-[#06080d] my-3">
          <svg className="w-full h-full" viewBox="0 0 420 144" fill="none" xmlns="http://www.w3.org/2000/svg">
            <style>{`
              @keyframes castPills {
                0% { opacity: 0.1; transform: scale(0.9); }
                50% { opacity: 0.5; transform: scale(1.02); }
                100% { opacity: 0.1; transform: scale(0.9); }
              }
              .cast-ring { animation: castPills 4s ease-in-out infinite; transform-origin: center; }
            `}</style>
            {renderDefs()}
            {renderGridBg()}

            {/* Main Mirror Screen */}
            <rect x="50" y="24" width="320" height="96" rx="10" fill="rgba(255, 255, 255, 0.02)" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="1.5" />
            
            {/* Mirror lines */}
            <g className="cast-ring" transform="translate(210, 72)">
              <rect x="-140" y="-36" width="280" height="72" rx="6" stroke="#f59e0b" strokeWidth="1" fill="none" filter="url(#vectorGlow)" />
              <rect x="-130" y="-30" width="260" height="60" rx="4" stroke="#f59e0b" strokeWidth="0.8" strokeDasharray="3 3" fill="none" />
            </g>

            <circle cx="70" cy="38" r="4" fill="#ef4444" />
            <circle cx="82" cy="38" r="4" fill="#f59e0b" />
            <circle cx="94" cy="38" r="4" fill="#10b981" />

            <text x="25" y="30" fill="#f59e0b" fontSize="9" fontWeight="bold" fontFamily="monospace" filter="url(#vectorGlow)">SCREEN CAST STREAMING</text>
          </svg>
        </div>
      );

    case "elite-archive":
      return (
        <div className="relative w-full h-36 rounded-[1.5rem] overflow-hidden border border-white/10 bg-[#06080d] my-3">
          <svg className="w-full h-full" viewBox="0 0 420 144" fill="none" xmlns="http://www.w3.org/2000/svg">
            <style>{`
              @keyframes scrollStrip {
                0% { transform: translateX(0px); }
                100% { transform: translateX(-96px); }
              }
              .film-strip { animation: scrollStrip 5s linear infinite; }
            `}</style>
            {renderDefs()}
            {renderGridBg()}

            {/* Sliding Clip Archive Strip */}
            <g className="film-strip" transform="translate(0, 42)">
              {Array.from({ length: 6 }).map((_, i) => {
                const xOffset = i * 96;
                return (
                  <g key={i} transform={`translate(${xOffset}, 0)`}>
                    <rect x="10" y="4" width="80" height="52" rx="6" fill="rgba(255,255,255,0.02)" stroke="rgba(255, 255, 255, 0.2)" strokeWidth="1.5" />
                    {/* Play triangle */}
                    <polygon points="46,24 46,36 56,30" fill="rgba(255,255,255,0.6)" filter="url(#vectorGlow)" />
                    {/* Telemetry frame index */}
                    <text x="18" y="46" fill="rgba(255,255,255,0.3)" fontSize="6" fontWeight="bold" fontFamily="monospace">CLIP_0{i}</text>
                  </g>
                );
              })}
            </g>

            <text x="25" y="30" fill="rgba(255,255,255,0.5)" fontSize="9" fontWeight="bold" fontFamily="monospace" filter="url(#vectorGlow)">CLOUD ARCHIVE PIPELINE</text>
          </svg>
        </div>
      );

    case "gatekeeper":
      return (
        <div className="relative w-full h-36 rounded-[1.5rem] overflow-hidden border border-white/10 bg-[#06080d] my-3">
          <svg className="w-full h-full" viewBox="0 0 420 144" fill="none" xmlns="http://www.w3.org/2000/svg">
            <style>{`
              @keyframes laserPulse {
                0%, 100% { stroke-dashoffset: 0; stroke: #10b981; }
                50% { stroke-dashoffset: 16; stroke: #3b82f6; }
              }
              .laser-gate { stroke-dasharray: 6 4; animation: laserPulse 1.8s linear infinite; }
            `}</style>
            {renderDefs()}
            {renderGridBg()}

            {/* Left admin control node */}
            <g transform="translate(80, 72)">
              <circle cx="0" cy="0" r="16" fill="rgba(59,130,246,0.15)" stroke="#3b82f6" strokeWidth="1.5" />
              <rect x="-6" y="-6" width="12" height="12" fill="#3b82f6" filter="url(#vectorGlow)" />
              <text x="0" y="26" textAnchor="middle" fill="#3b82f6" fontSize="7" fontWeight="bold" fontFamily="monospace">ADMIN</text>
            </g>

            {/* Connecting laser shield beam */}
            <path className="laser-gate" d="M96 72 Q 210 40, 324 72" stroke="#10b981" strokeWidth="2.5" fill="none" filter="url(#vectorGlow)" />

            {/* Right secured viewer node */}
            <g transform="translate(340, 72)">
              <circle cx="0" cy="0" r="16" fill="rgba(16,185,129,0.15)" stroke="#10b981" strokeWidth="1.5" />
              <circle cx="0" cy="0" r="6" fill="#10b981" filter="url(#vectorGlow)" />
              <text x="0" y="26" textAnchor="middle" fill="#10b981" fontSize="7" fontWeight="bold" fontFamily="monospace">APPROVED</text>
            </g>

            <text x="25" y="30" fill="#10b981" fontSize="9" fontWeight="bold" fontFamily="monospace" filter="url(#vectorGlow)">ACCESS WORKFLOW VERIFIED</text>
          </svg>
        </div>
      );

    case "ai-zoom-enhance":
      return (
        <div className="relative w-full h-36 rounded-[1.5rem] overflow-hidden border border-white/10 bg-[#06080d] my-3">
          <svg className="w-full h-full" viewBox="0 0 420 144" fill="none" xmlns="http://www.w3.org/2000/svg">
            <style>{`
              @keyframes zoomPulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.1); }
              }
              @keyframes scanEnhance {
                0% { transform: translateY(-30px); }
                100% { transform: translateY(30px); }
              }
              .zoom-mesh { animation: zoomPulse 4s ease-in-out infinite; transform-origin: center; }
              .scan-bar { animation: scanEnhance 2s ease-in-out infinite alternate; }
            `}</style>
            {renderDefs()}
            {renderGridBg()}

            <g transform="translate(210, 72)">
              <g className="zoom-mesh">
                {/* Face Targeting Ring Mesh */}
                <ellipse cx="0" cy="0" rx="34" ry="42" stroke="#f57c00" strokeWidth="1.5" fill="rgba(245, 124, 0, 0.05)" filter="url(#vectorGlow)" />
                <path d="M-22 -12 C-14 -20 14 -20 22 -12 M-20 14 C-10 24 10 24 20 14" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
                <circle cx="-10" cy="-6" r="3" fill="#fff" />
                <circle cx="10" cy="-6" r="3" fill="#fff" />
              </g>

              {/* Laser scan lines */}
              <line className="scan-bar" x1="-45" y1="0" x2="45" y2="0" stroke="#f59e0b" strokeWidth="1.5" filter="url(#vectorGlow)" />
            </g>

            {/* Tactical targeting corner brackets */}
            <path d="M170 30 H180 V40 M250 30 H240 V40 M170 114 H180 V104 M250 114 H240 V104" stroke="#f59e0b" strokeWidth="2" />

            <text x="25" y="30" fill="#f59e0b" fontSize="9" fontWeight="bold" fontFamily="monospace" filter="url(#vectorGlow)">UPSCALE: 4.0X RESOLUTION</text>
          </svg>
        </div>
      );

    case "noise-isolation":
      return (
        <div className="relative w-full h-36 rounded-[1.5rem] overflow-hidden border border-white/10 bg-[#06080d] my-3">
          <svg className="w-full h-full" viewBox="0 0 420 144" fill="none" xmlns="http://www.w3.org/2000/svg">
            <style>{`
              @keyframes waveFlow {
                0% { stroke-dashoffset: 0; }
                100% { stroke-dashoffset: -40; }
              }
              .raw-noise { stroke-dasharray: 4 4; }
              .clean-sine { stroke-dasharray: 80; stroke-dashoffset: 0; animation: waveFlow 2s linear infinite; }
            `}</style>
            {renderDefs()}
            {renderGridBg()}

            {/* Top Raw Audio Noise wave */}
            <path className="raw-noise" d="M30 42 Q 70 20, 110 50 T 190 35 T 270 46 T 390 35" stroke="#ef4444" strokeWidth="1.5" fill="none" />
            <path d="M30 42 Q 60 55, 90 28 T 210 46 T 310 32 T 390 42" stroke="#ef4444" strokeWidth="0.8" fill="none" opacity="0.4" />
            <text x="25" y="24" fill="#ef4444" fontSize="7" fontWeight="bold" fontFamily="monospace">RAW AUDIBLE NOISE</text>

            {/* Bottom Clean Voice sine wave */}
            <path className="clean-sine" d="M30 100 Q 75 80, 120 100 T 210 100 T 300 100 T 390 100" stroke="#10b981" strokeWidth="2" fill="none" filter="url(#vectorGlow)" />
            <text x="25" y="80" fill="#10b981" fontSize="7" fontWeight="bold" fontFamily="monospace">ISOLATED VOICE CHANNEL</text>

            <text x="25" y="14" fill="#10b981" fontSize="9" fontWeight="bold" fontFamily="monospace">VOICE NOISE ISOLATION ACTIVE</text>
          </svg>
        </div>
      );

    case "drive-quota-control":
      return (
        <div className="relative w-full h-36 rounded-[1.5rem] overflow-hidden border border-white/10 bg-[#06080d] my-3">
          <svg className="w-full h-full" viewBox="0 0 420 144" fill="none" xmlns="http://www.w3.org/2000/svg">
            <style>{`
              @keyframes fillQuota {
                0%, 100% { width: 140px; fill: #eab308; }
                50% { width: 280px; fill: #ef4444; }
              }
              .quota-bar { animation: fillQuota 6s ease-in-out infinite; }
            `}</style>
            {renderDefs()}
            {renderGridBg()}

            {/* Quota bar container */}
            <rect x="40" y="52" width="340" height="24" rx="8" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
            
            {/* Glowing progress fill */}
            <rect className="quota-bar" x="42" y="54" height="20" rx="6" fill="#eab308" filter="url(#vectorGlow)" />

            <line x1="295" y1="46" x2="295" y2="82" stroke="rgba(239, 68, 68, 0.4)" strokeWidth="1.5" strokeDasharray="3 3" />
            <text x="295" y="40" textAnchor="middle" fill="#ef4444" fontSize="7" fontWeight="black" fontFamily="monospace">90% LIMIT</text>

            <text x="25" y="30" fill="#eab308" fontSize="9" fontWeight="bold" fontFamily="monospace" filter="url(#vectorGlow)">CLOUD FIFO STORAGE QUOTA</text>
          </svg>
        </div>
      );

    case "super-zoom-capture":
      return (
        <div className="relative w-full h-36 rounded-[1.5rem] overflow-hidden border border-white/10 bg-[#06080d] my-3">
          <svg className="w-full h-full" viewBox="0 0 420 144" fill="none" xmlns="http://www.w3.org/2000/svg">
            <style>{`
              @keyframes reticlePulse {
                0%, 100% { transform: scale(1); opacity: 0.8; }
                50% { transform: scale(1.08); opacity: 1; }
              }
              .reticle { animation: reticlePulse 2s ease-in-out infinite; transform-origin: center; }
            `}</style>
            {renderDefs()}
            {renderGridBg()}

            {/* Dotted scope ring */}
            <circle className="reticle" cx="210" cy="72" r="42" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="4 3" fill="none" filter="url(#vectorGlow)" />
            <circle cx="210" cy="72" r="3" fill="#3b82f6" />
            <path d="M210 20 V60 M210 84 V124 M158 72 H202 M218 72 H262" stroke="rgba(59, 130, 246, 0.3)" strokeWidth="1" />

            {/* Zoom brackets */}
            <path d="M158 36 H168 V46 M262 36 H252 V46 M158 108 H168 V98 M262 108 H252 V98" stroke="#3b82f6" strokeWidth="2" />

            <text x="25" y="30" fill="#3b82f6" fontSize="9" fontWeight="bold" fontFamily="monospace" filter="url(#vectorGlow)">AI SUPER ZOOM ACTIVE</text>
          </svg>
        </div>
      );

    case "multi-camera-grid":
      return (
        <div className="relative w-full h-36 rounded-[1.5rem] overflow-hidden border border-white/10 bg-[#06080d] my-3">
          <svg className="w-full h-full" viewBox="0 0 420 144" fill="none" xmlns="http://www.w3.org/2000/svg">
            <style>{`
              @keyframes recPulse {
                0%, 100% { opacity: 0.2; }
                50% { opacity: 1; }
              }
              .rec-badge { animation: recPulse 1.2s infinite; }
            `}</style>
            {renderDefs()}
            {renderGridBg()}

            {/* Responsive grid split lines */}
            <line x1="210" y1="10" x2="210" y2="134" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
            <line x1="20" y1="72" x2="400" y2="72" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />

            {/* Split badges */}
            {/* Top Left */}
            <text x="35" y="32" fill="#fff" opacity="0.3" fontSize="8" fontWeight="bold" fontFamily="monospace">CAM_01</text>
            <circle className="rec-badge" cx="200" cy="28" r="3.5" fill="#ef4444" />

            {/* Top Right */}
            <text x="225" y="32" fill="#fff" opacity="0.3" fontSize="8" fontWeight="bold" fontFamily="monospace">CAM_02</text>
            <circle className="rec-badge" cx="390" cy="28" r="3.5" fill="#ef4444" />

            {/* Bottom Left */}
            <text x="35" y="94" fill="#fff" opacity="0.3" fontSize="8" fontWeight="bold" fontFamily="monospace">CAM_03</text>
            <circle className="rec-badge" cx="200" cy="90" r="3.5" fill="#ef4444" />

            {/* Bottom Right */}
            <text x="225" y="94" fill="#fff" opacity="0.3" fontSize="8" fontWeight="bold" fontFamily="monospace">CAM_04</text>
            <circle className="rec-badge" cx="390" cy="90" r="3.5" fill="#ef4444" />
          </svg>
        </div>
      );

    case "multi-ai-quota":
      return (
        <div className="relative w-full h-36 rounded-[1.5rem] overflow-hidden border border-white/10 bg-[#06080d] my-3">
          <svg className="w-full h-full" viewBox="0 0 420 144" fill="none" xmlns="http://www.w3.org/2000/svg">
            <style>{`
              @keyframes pathDash {
                0% { stroke-dashoffset: 30; }
                100% { stroke-dashoffset: 0; }
              }
              .circuit-flow { stroke-dasharray: 6 4; animation: pathDash 2s linear infinite; }
            `}</style>
            {renderDefs()}
            {renderGridBg()}

            {/* Circuit paths */}
            <path className="circuit-flow" d="M70 72 L180 72 M210 72 L320 72" stroke="#3b82f6" strokeWidth="1.5" filter="url(#vectorGlow)" />
            <path className="circuit-flow" d="M70 72 Q 140 28, 210 50 Q 280 28, 350 72" stroke="#10b981" strokeWidth="1.2" />

            {/* Integrated Chips */}
            {/* Gemini */}
            <g transform="translate(60, 72)">
              <rect x="-24" y="-14" width="48" height="28" rx="4" fill="rgba(16,185,129,0.15)" stroke="#10b981" strokeWidth="1.5" />
              <text x="0" y="4" textAnchor="middle" fill="#10b981" fontSize="7" fontWeight="black" fontFamily="monospace">GEMINI</text>
            </g>

            {/* OpenAI */}
            <g transform="translate(210, 72)">
              <rect x="-24" y="-14" width="48" height="28" rx="4" fill="rgba(59,130,246,0.15)" stroke="#3b82f6" strokeWidth="1.5" />
              <text x="0" y="4" textAnchor="middle" fill="#3b82f6" fontSize="7" fontWeight="black" fontFamily="monospace">OPENAI</text>
            </g>

            {/* Claude */}
            <g transform="translate(360, 72)">
              <rect x="-24" y="-14" width="48" height="28" rx="4" fill="rgba(245,158,11,0.15)" stroke="#f59e0b" strokeWidth="1.5" />
              <text x="0" y="4" textAnchor="middle" fill="#f59e0b" fontSize="7" fontWeight="black" fontFamily="monospace">CLAUDE</text>
            </g>

            <text x="25" y="30" fill="#10b981" fontSize="9" fontWeight="bold" fontFamily="monospace" filter="url(#vectorGlow)">MULTI-PROVIDER QUOTA CHAIN</text>
          </svg>
        </div>
      );

    case "hardware-optical-zoom":
      return (
        <div className="relative w-full h-36 rounded-[1.5rem] overflow-hidden border border-white/10 bg-[#06080d] my-3">
          <svg className="w-full h-full" viewBox="0 0 420 144" fill="none" xmlns="http://www.w3.org/2000/svg">
            <style>{`
              @keyframes lensSlide {
                0%, 100% { transform: translateX(-15px); }
                50% { transform: translateX(25px); }
              }
              .camera-lens { animation: lensSlide 4s ease-in-out infinite; }
            `}</style>
            {renderDefs()}
            {renderGridBg()}

            {/* Camera barrel */}
            <rect x="70" y="46" width="280" height="52" rx="4" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />

            {/* Dotted Lens track */}
            <line x1="100" y1="72" x2="320" y2="72" stroke="rgba(255,255,255,0.1)" strokeWidth="2" strokeDasharray="3 3" />

            {/* Moving optical lens groups */}
            <g className="camera-lens" transform="translate(160, 72)">
              <rect x="-16" y="-22" width="12" height="44" rx="3" fill="#3b82f6" filter="url(#vectorGlow)" opacity="0.75" />
              <rect x="12" y="-18" width="10" height="36" rx="2" fill="#60a5fa" filter="url(#vectorGlow)" opacity="0.6" />
              
              <line x1="-30" y1="-26" x2="-30" y2="26" stroke="#3b82f6" strokeWidth="1.5" />
              <text x="-40" y="-30" fill="#3b82f6" fontSize="7" fontWeight="bold" fontFamily="monospace">OPTICAL GROUP</text>
            </g>

            <text x="25" y="30" fill="#3b82f6" fontSize="9" fontWeight="bold" fontFamily="monospace" filter="url(#vectorGlow)">LENS STAGE NEGOTIATING</text>
          </svg>
        </div>
      );

    default:
      return (
        <div className="relative w-full h-36 rounded-[1.5rem] overflow-hidden border border-white/10 bg-[#06080d] my-3">
          <svg className="w-full h-full" viewBox="0 0 420 144" fill="none" xmlns="http://www.w3.org/2000/svg">
            {renderDefs()}
            {renderGridBg()}
            <circle cx="210" cy="72" r="14" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
          </svg>
        </div>
      );
  }
};
