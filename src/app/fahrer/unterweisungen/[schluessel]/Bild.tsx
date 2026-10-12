import type { ReactNode } from "react";

// Einfache Zeichnungen zu den Abschnitten der Unterweisungen (320 × 180, Markenfarben).

const BLAU = "#0F227B";
const GELB = "#FFC947";
const ROT = "#b42318";
const GRUEN = "#2e6b3f";
const GRAU = "#9ca3af";
const HELL = "#e5e7eb";

function T({ x, y, children, g = 14, f = BLAU, b = true, a = "middle" }: { x: number; y: number; children: ReactNode; g?: number; f?: string; b?: boolean; a?: "start" | "middle" | "end" }) {
  return (
    <text x={x} y={y} fontSize={g} fill={f} fontWeight={b ? 700 : 400} textAnchor={a} fontFamily="system-ui, sans-serif">
      {children}
    </text>
  );
}

function Pfeil({ x1, y1, x2, y2, f = ROT, w = 6 }: { x1: number; y1: number; x2: number; y2: number; f?: string; w?: number }) {
  const l = Math.hypot(x2 - x1, y2 - y1);
  const ux = (x2 - x1) / l;
  const uy = (y2 - y1) / l;
  const s = w * 2.2;
  const bx = x2 - ux * s;
  const by = y2 - uy * s;
  return (
    <g>
      <line x1={x1} y1={y1} x2={bx} y2={by} stroke={f} strokeWidth={w} strokeLinecap="round" />
      <polygon points={`${x2},${y2} ${bx - uy * s * 0.7},${by + ux * s * 0.7} ${bx + uy * s * 0.7},${by - ux * s * 0.7}`} fill={f} />
    </g>
  );
}

// LKW von der Seite, Front rechts. Breite 150, Höhe 70 (bei s = 1).
function Lkw({ x, y, s = 1, ladung = true, bordwand = false }: { x: number; y: number; s?: number; ladung?: boolean; bordwand?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="0" y="0" width="105" height="55" rx="3" fill={ladung ? HELL : "#fff"} stroke={BLAU} strokeWidth="3" />
      <path d="M108 15 h25 l15 18 v22 h-40 z" fill={BLAU} />
      <rect x="114" y="20" width="16" height="12" fill="#cfd8ff" />
      <rect x="0" y="55" width="148" height="5" fill={BLAU} />
      {bordwand && <rect x="-14" y="55" width="14" height="4" fill={GRAU} />}
      <circle cx="25" cy="64" r="9" fill="#1f2937" />
      <circle cx="50" cy="64" r="9" fill="#1f2937" />
      <circle cx="125" cy="64" r="9" fill="#1f2937" />
    </g>
  );
}

// LKW von oben, Front rechts. 150 × 46.
function LkwOben({ x, y, s = 1, f = BLAU }: { x: number; y: number; s?: number; f?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="0" y="0" width="112" height="46" rx="3" fill={HELL} stroke={f} strokeWidth="3" />
      <rect x="116" y="4" width="34" height="38" rx="5" fill={f} />
    </g>
  );
}

function Verbot({ x, y, r = 34 }: { x: number; y: number; r?: number }) {
  const d = r * 0.7;
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="none" stroke={ROT} strokeWidth="7" />
      <line x1={x - d} y1={y + d} x2={x + d} y2={y - d} stroke={ROT} strokeWidth="7" />
    </g>
  );
}

function Haken({ x, y, r = 16 }: { x: number; y: number; r?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={GRUEN} />
      <path d={`M${x - r * 0.45} ${y} l${r * 0.3} ${r * 0.35} l${r * 0.55} ${-r * 0.65}`} stroke="#fff" strokeWidth={r * 0.22} fill="none" strokeLinecap="round" />
    </g>
  );
}

function Kreuz({ x, y, r = 16 }: { x: number; y: number; r?: number }) {
  const d = r * 0.4;
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={ROT} />
      <path d={`M${x - d} ${y - d} L${x + d} ${y + d} M${x + d} ${y - d} L${x - d} ${y + d}`} stroke="#fff" strokeWidth={r * 0.22} strokeLinecap="round" />
    </g>
  );
}

// Strichmännchen, Füße bei (x, y).
function Person({ x, y, s = 1, f = BLAU, weste = false }: { x: number; y: number; s?: number; f?: string; weste?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} stroke={f} strokeWidth="5" strokeLinecap="round" fill="none">
      <circle cx="0" cy="-62" r="9" fill={f} stroke="none" />
      <line x1="0" y1="-50" x2="0" y2="-22" stroke={weste ? GELB : f} strokeWidth={weste ? 12 : 5} />
      <line x1="0" y1="-45" x2="-14" y2="-30" />
      <line x1="0" y1="-45" x2="14" y2="-30" />
      <line x1="0" y1="-22" x2="-10" y2="0" />
      <line x1="0" y1="-22" x2="10" y2="0" />
    </g>
  );
}

function Telefon({ x, y, s = 1, children }: { x: number; y: number; s?: number; children?: ReactNode }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="0" y="0" width="62" height="110" rx="10" fill={BLAU} />
      <rect x="5" y="12" width="52" height="84" rx="3" fill="#fff" />
      {children}
    </g>
  );
}

function Uhr({ x, y, r = 30, zeiger = 0 }: { x: number; y: number; r?: number; zeiger?: number }) {
  const w = (zeiger / 12) * 2 * Math.PI;
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="#fff" stroke={BLAU} strokeWidth="4" />
      <line x1={x} y1={y} x2={x} y2={y - r * 0.7} stroke={BLAU} strokeWidth="4" strokeLinecap="round" />
      <line x1={x} y1={y} x2={x + Math.sin(w) * r * 0.5} y2={y - Math.cos(w) * r * 0.5} stroke={BLAU} strokeWidth="4" strokeLinecap="round" />
    </g>
  );
}

function Balken({ x, y, w, h = 22, f = BLAU, text, tf = "#fff" }: { x: number; y: number; w: number; h?: number; f?: string; text?: string; tf?: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="4" fill={f} />
      {text && (
        <T x={x + w / 2} y={y + h / 2 + 5} g={13} f={tf}>
          {text}
        </T>
      )}
    </g>
  );
}

function Palette({ x, y, w = 40, h = 40, f = "#c8a16a" }: { x: number; y: number; w?: number; h?: number; f?: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h - 6} fill={f} stroke="#8a6a3a" strokeWidth="2" />
      <rect x={x} y={y + h - 6} width={w} height={6} fill="#8a6a3a" />
    </g>
  );
}

function Feuerloescher({ x, y, s = 1, kg }: { x: number; y: number; s?: number; kg?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="0" y="20" width="44" height="100" rx="14" fill={ROT} />
      <rect x="14" y="6" width="16" height="16" fill="#374151" />
      <path d="M30 10 h22 v8" stroke="#374151" strokeWidth="5" fill="none" />
      <rect x="6" y="50" width="32" height="30" rx="3" fill="#fff" />
      {kg && (
        <T x={22} y={71} g={13} f={ROT}>
          {kg}
        </T>
      )}
    </g>
  );
}

function Plakette({ x, y, r = 22, f = GRUEN, text }: { x: number; y: number; r?: number; f?: string; text: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={f} />
      <circle cx={x} cy={y} r={r - 5} fill="none" stroke="#fff" strokeWidth="2" strokeDasharray="3 3" />
      <T x={x} y={y + 5} g={12} f="#fff">
        {text}
      </T>
    </g>
  );
}

function Karte({ x, y, s = 1, kaputt = false }: { x: number; y: number; s?: number; kaputt?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="0" y="0" width="96" height="60" rx="6" fill="#fff" stroke={BLAU} strokeWidth="3" />
      <rect x="10" y="18" width="20" height="16" rx="2" fill={GELB} />
      <rect x="40" y="16" width="44" height="5" fill={HELL} />
      <rect x="40" y="27" width="34" height="5" fill={HELL} />
      <T x={48} y={52} g={10}>
        FAHRERKARTE
      </T>
      {kaputt && <path d="M60 0 L52 22 L64 34 L56 60" stroke={ROT} strokeWidth="4" fill="none" />}
    </g>
  );
}

function Dokument({ x, y, s = 1, titel }: { x: number; y: number; s?: number; titel?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0 0 h56 l18 18 v92 h-74 z" fill="#fff" stroke={BLAU} strokeWidth="3" />
      <path d="M56 0 v18 h18" fill="none" stroke={BLAU} strokeWidth="3" />
      {[34, 46, 58, 70, 82, 94].map((yy) => (
        <rect key={yy} x="10" y={yy} width={yy % 24 === 10 ? 40 : 54} height="5" fill={HELL} />
      ))}
      {titel && (
        <T x={30} y={28} g={10}>
          {titel}
        </T>
      )}
    </g>
  );
}

function Ameise({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="0" y="30" width="44" height="40" rx="4" fill={GELB} stroke={BLAU} strokeWidth="3" />
      <rect x="44" y="60" width="70" height="8" fill="#374151" />
      <line x1="14" y1="30" x2="-8" y2="-6" stroke={BLAU} strokeWidth="5" strokeLinecap="round" />
      <rect x="-18" y="-12" width="22" height="9" rx="3" fill={BLAU} />
      <circle cx="16" cy="74" r="7" fill="#1f2937" />
      <circle cx="104" cy="72" r="4" fill="#1f2937" />
    </g>
  );
}

function Liste({ x, y, zeilen, g = 13 }: { x: number; y: number; zeilen: string[]; g?: number }) {
  return (
    <g>
      {zeilen.map((z, i) => (
        <g key={z}>
          <Haken x={x} y={y + i * (g + 10)} r={8} />
          <T x={x + 16} y={y + i * (g + 10) + 5} g={g} a="start" b={false} f="#111827">
            {z}
          </T>
        </g>
      ))}
    </g>
  );
}

const BILDER: Record<string, ReactNode> = {
  // Arbeitsschutz
  melden: (
    <>
      <polygon points="90,30 150,140 30,140" fill={GELB} stroke={BLAU} strokeWidth="5" strokeLinejoin="round" />
      <T x={90} y={128} g={60}>
        !
      </T>
      <Pfeil x1={165} y1={90} x2={205} y2={90} f={BLAU} />
      <Telefon x={225} y={35} s={0.95}>
        <T x={31} y={60} g={14}>
          melden
        </T>
      </Telefon>
    </>
  ),
  notruf: (
    <>
      <Telefon x={70} y={30}>
        <T x={31} y={68} g={26} f={ROT}>
          112
        </T>
      </Telefon>
      <T x={215} y={70} g={18}>
        Rettung &amp;
      </T>
      <T x={215} y={92} g={18}>
        Feuerwehr: 112
      </T>
      <T x={215} y={128} g={15} f="#374151" b={false}>
        Polizei: 110
      </T>
    </>
  ),
  w_fragen: (
    <>
      {["Wo?", "Was?", "Wie viele?", "Welche Verletzungen?", "Warten!"].map((w, i) => (
        <g key={w}>
          <rect x={i % 2 === 0 ? 20 : 170} y={14 + Math.floor(i / 2) * 40} width={i === 4 ? 280 : 130} height={32} rx={16} fill={i === 4 ? GELB : BLAU} />
          <T x={i === 4 ? 160 : i % 2 === 0 ? 85 : 235} y={35 + Math.floor(i / 2) * 40} g={i === 3 ? 11 : 14} f={i === 4 ? BLAU : "#fff"}>
            {w}
          </T>
        </g>
      ))}
      <T x={160} y={150} g={14} b={false} f="#374151">
        nicht selbst auflegen
      </T>
    </>
  ),
  eigenschutz: (
    <>
      <Person x={90} y={150} s={1.4} weste />
      <polygon points="230,70 270,140 190,140" fill="none" stroke={ROT} strokeWidth="9" strokeLinejoin="round" />
      <T x={160} y={30} g={16}>
        1. Weste · 2. Absichern · 3. Helfen
      </T>
    </>
  ),
  verbandbuch: (
    <>
      <rect x="60" y="40" width="100" height="120" rx="6" fill={BLAU} />
      <rect x="72" y="52" width="76" height="96" rx="3" fill="#fff" />
      <path d="M110 70 v40 M90 90 h40" stroke={ROT} strokeWidth="10" />
      <T x={110} y={136} g={11}>
        Verbandbuch
      </T>
      <rect x="190" y="80" width="90" height="34" rx="17" fill="#f2c69b" transform="rotate(-20 235 97)" />
      <rect x="220" y="82" width="30" height="30" fill="#e8b07a" transform="rotate(-20 235 97)" />
    </>
  ),
  promille: (
    <>
      <Uhr x={80} y={90} r={50} zeiger={2} />
      <T x={210} y={80} g={30}>
        0,1 ‰
      </T>
      <T x={210} y={110} g={16} b={false} f="#374151">
        pro Stunde
      </T>
    </>
  ),
  kaffee: (
    <>
      <path d="M70 60 h80 v50 a30 30 0 0 1 -30 30 h-20 a30 30 0 0 1 -30 -30 z" fill="#fff" stroke={BLAU} strokeWidth="5" />
      <path d="M150 75 a15 15 0 0 1 0 30" fill="none" stroke={BLAU} strokeWidth="5" />
      <path d="M92 50 q-8 -12 0 -24 M112 50 q-8 -12 0 -24" stroke={GRAU} strokeWidth="4" fill="none" />
      <Verbot x={110} y={95} r={62} />
      <Uhr x={250} y={90} r={36} zeiger={5} />
      <T x={250} y={150} g={14}>
        nur Zeit hilft
      </T>
    </>
  ),
  heben: (
    <>
      <g stroke={BLAU} strokeWidth="6" strokeLinecap="round" fill="none">
        <circle cx="80" cy="50" r="10" fill={BLAU} />
        <line x1="80" y1="62" x2="80" y2="100" />
        <path d="M80 100 l-18 18 l8 28 M80 100 l18 18 l-8 28" />
        <line x1="80" y1="72" x2="104" y2="112" />
      </g>
      <rect x="92" y="108" width="40" height="34" fill="#c8a16a" stroke="#8a6a3a" strokeWidth="2" />
      <Haken x={80} y={20} r={13} />
      <g stroke={GRAU} strokeWidth="6" strokeLinecap="round" fill="none">
        <circle cx="250" cy="70" r="10" fill={GRAU} />
        <path d="M240 78 Q210 90 200 120" />
        <path d="M232 108 l0 38 M232 108 l12 38" />
        <line x1="215" y1="100" x2="200" y2="130" />
      </g>
      <rect x="180" y="126" width="40" height="22" fill="#e5d5bd" stroke={GRAU} strokeWidth="2" />
      <Kreuz x={265} y={30} r={13} />
    </>
  ),
  aussteigen: (
    <>
      <rect x="150" y="20" width="110" height="130" rx="8" fill={BLAU} />
      <rect x="164" y="34" width="60" height="44" fill="#cfd8ff" />
      <rect x="160" y="100" width="40" height="6" fill={GRAU} />
      <rect x="160" y="130" width="40" height="6" fill={GRAU} />
      <rect x="235" y="40" width="6" height="70" fill={GELB} />
      <g stroke={GELB} strokeWidth="5" strokeLinecap="round" fill="none">
        <circle cx="130" cy="58" r="9" fill={GELB} stroke="none" />
        <line x1="130" y1="68" x2="130" y2="100" />
        <line x1="130" y1="76" x2="165" y2="66" />
        <path d="M130 100 l26 2 M130 100 l6 34" />
      </g>
      <T x={70} y={80} g={30}>
        3
      </T>
      <T x={70} y={102} g={13}>
        Punkte
      </T>
    </>
  ),
  feuerloescher: (
    <>
      <Feuerloescher x={90} y={30} />
      <Plakette x={210} y={70} text="2027" />
      <T x={210} y={125} g={14}>
        Prüfplakette
      </T>
      <T x={210} y={145} g={14}>
        gültig?
      </T>
    </>
  ),

  // Abfahrtskontrolle
  rundgang: (
    <>
      <LkwOben x={85} y={67} />
      <ellipse cx="160" cy="90" rx="135" ry="70" fill="none" stroke={GELB} strokeWidth="5" strokeDasharray="10 8" />
      <Pfeil x1={40} y1={60} x2={60} y2={38} f={GELB} w={5} />
      {[
        [40, 110],
        [160, 22],
        [285, 90],
        [160, 158],
      ].map(([x, y]) => (
        <Haken key={`${x}${y}`} x={x} y={y} r={11} />
      ))}
    </>
  ),
  tacho_hammer: (
    <>
      <rect x="40" y="50" width="240" height="80" rx="8" fill="#1f2937" />
      <rect x="54" y="64" width="150" height="52" rx="3" fill="#a7f3d0" />
      <g transform="translate(110 72)">
        <path d="M0 0 h28 v12 h-28 z" fill="#1f2937" />
        <rect x="11" y="12" width="7" height="26" fill="#1f2937" />
      </g>
      <T x={240} y={97} g={14} f="#fff">
        Arbeit
      </T>
    </>
  ),
  verantwortung: (
    <>
      <Lkw x={130} y={60} />
      <Person x={70} y={140} s={1.2} />
      <Haken x={180} y={40} r={14} />
      <T x={70} y={30} g={14}>
        § 23 StVO
      </T>
    </>
  ),
  stopp: (
    <>
      <polygon points="120,20 170,20 205,55 205,105 170,140 120,140 85,105 85,55" fill={ROT} />
      <T x={145} y={90} g={26} f="#fff">
        STOPP
      </T>
      <Telefon x={235} y={40} s={0.8}>
        <T x={31} y={58} g={12}>
          Dispo
        </T>
      </Telefon>
    </>
  ),
  app: (
    <>
      <Telefon x={128} y={20} s={1.3}>
        <Liste x={14} y={26} zeilen={["Reifen", "Licht", "Ladung"]} g={8} />
        <rect x="10" y="80" width="42" height="10" rx="2" fill={GELB} />
      </Telefon>
    </>
  ),
  foto: (
    <>
      <Telefon x={70} y={30}>
        <rect x="10" y="22" width="42" height="34" fill={HELL} />
        <path d="M14 52 l10 -14 l8 8 l6 -6 l10 12 z" fill={GRAU} />
        <T x={31} y={78} g={10} f={ROT}>
          Mangel
        </T>
      </Telefon>
      <Pfeil x1={150} y1={85} x2={200} y2={85} f={BLAU} />
      <Person x={245} y={140} s={1.1} />
      <T x={245} y={162} g={12}>
        Verkehrsleiter
      </T>
    </>
  ),
  anleitung: (
    <>
      <path d="M160 40 q-50 -14 -100 0 v110 q50 -14 100 0 z" fill="#fff" stroke={BLAU} strokeWidth="4" />
      <path d="M160 40 q50 -14 100 0 v110 q-50 -14 -100 0 z" fill="#fff" stroke={BLAU} strokeWidth="4" />
      <T x={110} y={80} g={12}>
        Reifendruck
      </T>
      <T x={110} y={100} g={12}>
        Öl · Kühlmittel
      </T>
      <T x={210} y={92} g={12}>
        Betriebs-
      </T>
      <T x={210} y={108} g={12}>
        anleitung
      </T>
    </>
  ),
  warnleuchte: (
    <>
      <rect x="40" y="40" width="240" height="100" rx="50" fill="#1f2937" />
      <circle cx="120" cy="90" r="30" fill="none" stroke="#4b5563" strokeWidth="4" />
      <circle cx="210" cy="90" r="22" fill={ROT} />
      <T x={210} y={99} g={26} f="#fff">
        !
      </T>
    </>
  ),
  assistenz: (
    <>
      <Lkw x={30} y={70} />
      {[30, 55, 80].map((r) => (
        <path key={r} d={`M190 ${100 - r * 0.6} a${r} ${r} 0 0 1 0 ${r * 1.2}`} fill="none" stroke={GELB} strokeWidth="5" transform={`translate(${r * 0.3} 0)`} />
      ))}
      <T x={260} y={40} g={13}>
        ABS · ESP
      </T>
      <T x={260} y={160} g={13}>
        nicht abschalten
      </T>
    </>
  ),

  // Ladungssicherung
  kraefte_vorn: (
    <>
      <Lkw x={60} y={70} />
      <Palette x={110} y={86} />
      <Pfeil x1={150} y1={56} x2={240} y2={56} w={8} />
      <T x={268} y={62} g={22} f={ROT}>
        80 %
      </T>
      <Pfeil x1={110} y1={56} x2={40} y2={56} f={GELB} w={6} />
      <T x={30} y={40} g={16}>
        50 %
      </T>
      <T x={160} y={170} g={13} f="#374151" b={false}>
        Bremsen nach vorn · Anfahren nach hinten
      </T>
    </>
  ),
  kraefte_seite: (
    <>
      <LkwOben x={85} y={67} />
      <rect x="130" y="76" width="36" height="28" fill="#c8a16a" stroke="#8a6a3a" strokeWidth="2" />
      <Pfeil x1={148} y1={64} x2={148} y2={18} w={7} />
      <Pfeil x1={148} y1={116} x2={148} y2={162} w={7} />
      <T x={200} y={34} g={18} f={ROT}>
        50 %
      </T>
      <T x={200} y={158} g={18} f={ROT}>
        50 %
      </T>
      <T x={55} y={34} g={13} f="#374151" b={false}>
        Kurve
      </T>
    </>
  ),
  antirutsch: (
    <>
      <rect x="50" y="130" width="220" height="10" fill={GRAU} />
      <rect x="110" y="122" width="100" height="8" fill="#111827" />
      <Palette x={110} y={60} w={100} h={62} />
      <T x={160} y={164} g={14}>
        Antirutschmatte
      </T>
      <Haken x={250} y={60} r={16} />
    </>
  ),
  formschluss: (
    <>
      <rect x="40" y="40" width="240" height="100" fill="none" stroke={BLAU} strokeWidth="4" />
      <rect x="280" y="40" width="8" height="100" fill={BLAU} />
      {[0, 1, 2].map((i) => (
        <rect key={i} x={208 - i * 70} y={50} width={70} height={80} fill="#c8a16a" stroke="#8a6a3a" strokeWidth="2" />
      ))}
      <rect x="62" y="50" width="6" height="80" fill={GELB} />
      <T x={160} y={30} g={13}>
        Stirnwand →
      </T>
      <T x={54} y={160} g={12}>
        Klemmstange
      </T>
    </>
  ),
  gurt_defekt: (
    <>
      <rect x="30" y="80" width="260" height="24" fill="#f59e0b" />
      <path d="M150 80 l12 12 l-8 12" stroke="#fff" strokeWidth="6" fill="none" />
      <Verbot x={156} y={92} r={50} />
      <T x={160} y={30} g={14}>
        Schnitt · Riss · kein Etikett
      </T>
    </>
  ),
  etikett: (
    <>
      <rect x="20" y="78" width="80" height="24" fill="#f59e0b" />
      <rect x="100" y="40" width="190" height="100" rx="6" fill="#2563eb" />
      <T x={195} y={78} g={20} f="#fff">
        LC 2500 daN
      </T>
      <T x={195} y={112} g={20} f="#fff">
        STF 500 daN
      </T>
    </>
  ),
  kantenschutz: (
    <>
      <rect x="80" y="60" width="140" height="90" fill="#c8a16a" stroke="#8a6a3a" strokeWidth="2" />
      <path d="M60 160 L80 60 L220 60 L240 160" fill="none" stroke="#f59e0b" strokeWidth="10" />
      <path d="M70 72 h22 v-22" fill="none" stroke={GELB} strokeWidth="12" transform="translate(4 0)" />
      <path d="M208 50 v22 h22" fill="none" stroke={GELB} strokeWidth="12" transform="translate(-4 0)" />
      <T x={160} y={34} g={14}>
        Kantenschutz
      </T>
    </>
  ),
  verlader_fahrer: (
    <>
      <Person x={70} y={130} s={1.2} f={GRAU} />
      <T x={70} y={156} g={13}>
        Verlader
      </T>
      <T x={70} y={30} g={11} b={false} f="#374151">
        beförderungssicher
      </T>
      <Person x={250} y={130} s={1.2} />
      <T x={250} y={156} g={13}>
        Fahrer
      </T>
      <T x={250} y={30} g={11} b={false} f="#374151">
        verkehrssicher
      </T>
      <Palette x={140} y={86} />
    </>
  ),
  material: (
    <>
      <rect x="30" y="30" width="80" height="16" fill="#f59e0b" />
      <rect x="30" y="56" width="80" height="16" fill="#f59e0b" />
      <T x={140} y={58} g={18} a="start">
        8 × Zurrgurt
      </T>
      <rect x="30" y="92" width="100" height="10" rx="5" fill={GRAU} />
      <T x={140} y={102} g={18} a="start">
        3 × Klemmstange
      </T>
      <path d="M30 130 h22 v22" fill="none" stroke={GELB} strokeWidth="10" />
      <T x={140} y={146} g={18} a="start">
        10 × Kantenschutz
      </T>
    </>
  ),
  nachpruefen: (
    <>
      <path d="M20 140 C90 140 90 50 160 50 S230 140 300 140" fill="none" stroke={GRAU} strokeWidth="14" />
      <path d="M20 140 C90 140 90 50 160 50 S230 140 300 140" fill="none" stroke="#fff" strokeWidth="2" strokeDasharray="10 10" />
      <Haken x={70} y={110} r={14} />
      <Haken x={160} y={30} r={14} />
      <Haken x={260} y={110} r={14} />
      <T x={160} y={172} g={13} f="#374151" b={false}>
        nach den ersten km · nach jedem Stopp
      </T>
    </>
  ),

  // Tacho
  lenkzeit_tag: (
    <>
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={i} x={30 + i * 22} y={70} width={20} height={40} fill={i < 9 ? BLAU : HELL} />
      ))}
      <T x={130} y={58} g={18}>
        max. 9 Stunden
      </T>
      <T x={30} y={130} g={12} a="start" b={false} f="#374151">
        1 Kästchen = 1 Stunde
      </T>
    </>
  ),
  woche_10h: (
    <>
      {["Mo", "Di", "Mi", "Do", "Fr", "Sa"].map((t, i) => {
        const h = i === 1 || i === 3 ? 10 : 9;
        return (
          <g key={t}>
            <rect x={40 + i * 44} y={150 - h * 11} width={32} height={h * 11} fill={h === 10 ? GELB : BLAU} />
            <T x={56 + i * 44} y={168} g={12}>
              {t}
            </T>
            <T x={56 + i * 44} y={142 - h * 11} g={12}>
              {h}
            </T>
          </g>
        );
      })}
    </>
  ),
  doppelwoche: (
    <>
      <Balken x={30} y={50} w={56 * 4.5} text="Woche 1: max. 56 h" />
      <Balken x={30} y={84} w={34 * 4.5} f={GELB} text="Woche 2: 34 h" tf={BLAU} />
      <T x={160} y={150} g={18}>
        zusammen max. 90 h
      </T>
    </>
  ),
  pause: (
    <>
      <Balken x={20} y={70} w={200} text="4,5 h lenken" />
      <Balken x={224} y={70} w={76} f={GELB} text="45 min" tf={BLAU} />
      <T x={262} y={56} g={13}>
        Pause
      </T>
    </>
  ),
  pause_teilen: (
    <>
      <Balken x={20} y={50} w={80} text="lenken" />
      <Balken x={104} y={50} w={34} f={GELB} text="15" tf={BLAU} />
      <Balken x={142} y={50} w={96} text="lenken" />
      <Balken x={242} y={50} w={58} f={GELB} text="30" tf={BLAU} />
      <Haken x={290} y={30} r={12} />
      <Balken x={20} y={118} w={80} text="lenken" f={GRAU} />
      <Balken x={104} y={118} w={58} f={HELL} text="30" tf="#374151" />
      <Balken x={166} y={118} w={72} text="lenken" f={GRAU} />
      <Balken x={242} y={118} w={34} f={HELL} text="15" tf="#374151" />
      <Kreuz x={290} y={104} r={12} />
    </>
  ),
  ruhezeit: (
    <>
      <path d="M90 40 a50 50 0 1 0 50 70 a40 40 0 1 1 -50 -70 z" fill={BLAU} />
      <T x={230} y={80} g={30}>
        11 h
      </T>
      <T x={230} y={110} g={14} b={false} f="#374151">
        3 × pro Woche 9 h
      </T>
      <T x={230} y={140} g={14} b={false} f="#374151">
        Woche: 45 h
      </T>
    </>
  ),
  auslesen: (
    <>
      <Karte x={30} y={50} />
      <T x={78} y={140} g={18}>
        alle 28 Tage
      </T>
      <LkwOben x={190} y={64} s={0.7} />
      <T x={243} y={140} g={18}>
        alle 90 Tage
      </T>
    </>
  ),
  nachtrag: (
    <>
      <rect x="40" y="40" width="240" height="100" rx="8" fill="#1f2937" />
      <rect x="54" y="54" width="212" height="72" rx="3" fill="#a7f3d0" />
      <T x={160} y={84} g={16} f="#1f2937">
        Manueller Nachtrag
      </T>
      <T x={160} y={110} g={13} f="#1f2937" b={false}>
        Werkstatt · Büro · Urlaub
      </T>
    </>
  ),
  karte_defekt: (
    <>
      <Karte x={30} y={56} kaputt />
      <Pfeil x1={140} y1={86} x2={180} y2={86} f={BLAU} />
      <rect x="200" y="30" width="70" height="120" fill="#fff" stroke={BLAU} strokeWidth="3" />
      {[50, 62, 74, 86].map((y) => (
        <rect key={y} x="210" y={y} width="50" height="5" fill={HELL} />
      ))}
      <path d="M210 130 q10 -14 20 0 t20 0" stroke={BLAU} strokeWidth="3" fill="none" />
      <T x={235} y={168} g={12}>
        Ausdruck + Unterschrift
      </T>
    </>
  ),
  abgleich: (
    <>
      <rect x="20" y="60" width="110" height="60" rx="6" fill="#1f2937" />
      <T x={75} y={96} g={16} f="#a7f3d0">
        Tacho
      </T>
      <T x={160} y={100} g={34}>
        =
      </T>
      <Telefon x={210} y={36} s={0.9}>
        <T x={31} y={58} g={11}>
          Zeiten
        </T>
      </Telefon>
    </>
  ),

  // Gefahrgut
  adr_ohne: (
    <>
      <rect x="20" y="50" width="110" height="70" rx="8" fill={BLAU} />
      <T x={75} y={92} g={24} f="#fff">
        1000
      </T>
      <T x={75} y={140} g={13}>
        Punkte-Regel
      </T>
      <T x={168} y={92} g={16} b={false} f="#374151">
        oder
      </T>
      <g transform="translate(250 85) rotate(45)">
        <rect x="-35" y="-35" width="70" height="70" fill="#fff" stroke="#111827" strokeWidth="2" />
        <rect x="-35" y="-35" width="70" height="20" fill="#111827" />
        <rect x="-35" y="15" width="70" height="20" fill="#111827" />
      </g>
      <T x={250} y={160} g={13}>
        LQ
      </T>
    </>
  ),
  punkte_grenze: (
    <>
      <path d="M60 140 a100 100 0 0 1 200 0" fill="none" stroke={HELL} strokeWidth="24" />
      <path d="M60 140 a100 100 0 0 1 170 -70" fill="none" stroke={GRUEN} strokeWidth="24" />
      <path d="M230 70 a100 100 0 0 1 30 70" fill="none" stroke={ROT} strokeWidth="24" />
      <line x1="160" y1="140" x2="245" y2="100" stroke={BLAU} strokeWidth="6" strokeLinecap="round" />
      <circle cx="160" cy="140" r="9" fill={BLAU} />
      <T x={250} y={40} g={16} f={ROT}>
        über 1000
      </T>
      <T x={160} y={170} g={13}>
        ohne ADR-Schein verboten
      </T>
    </>
  ),
  punkte_rechnung: (
    <>
      {[
        ["Kategorie 1", "× 50"],
        ["Kategorie 2", "× 3"],
        ["Kategorie 3", "× 1"],
      ].map(([k, f], i) => (
        <g key={k}>
          <rect x="40" y={30 + i * 42} width="240" height="34" rx="6" fill={i === 1 ? GELB : HELL} />
          <T x={60} y={53 + i * 42} g={16} a="start">
            {k}
          </T>
          <T x={260} y={53 + i * 42} g={18} a="end">
            {f}
          </T>
        </g>
      ))}
      <T x={160} y={172} g={13} f="#374151" b={false}>
        Summe höchstens 1000
      </T>
    </>
  ),
  undicht: (
    <>
      <rect x="90" y="40" width="110" height="90" fill="#c8a16a" stroke="#8a6a3a" strokeWidth="3" />
      <path d="M150 130 q6 14 0 20 q-6 -6 0 -20 z M170 132 q6 14 0 20 q-6 -6 0 -20 z" fill="#2563eb" />
      <ellipse cx="160" cy="160" rx="40" ry="6" fill="#93c5fd" />
      <Kreuz x={240} y={60} r={20} />
    </>
  ),
  papier: (
    <>
      <Dokument x={80} y={30} s={1.2} titel="Papier" />
      <Dokument x={190} y={40} titel="Weisung" />
    </>
  ),
  feuerloescher_2kg: (
    <>
      <Feuerloescher x={120} y={30} kg="2 kg" />
      <T x={240} y={90} g={22}>
        A B C
      </T>
    </>
  ),
  lq_raute: (
    <>
      <g transform="translate(160 90) rotate(45)">
        <rect x="-55" y="-55" width="110" height="110" fill="#fff" stroke="#111827" strokeWidth="2" />
        <rect x="-55" y="-55" width="110" height="30" fill="#111827" />
        <rect x="-55" y="25" width="110" height="30" fill="#111827" />
      </g>
      <T x={290} y={95} g={13}>
        ≥ 100 mm
      </T>
    </>
  ),
  lq_30kg: (
    <>
      <rect x="110" y="60" width="100" height="70" fill="#c8a16a" stroke="#8a6a3a" strokeWidth="3" />
      <g transform="translate(160 95) rotate(45) scale(0.3)">
        <rect x="-55" y="-55" width="110" height="110" fill="#fff" stroke="#111827" strokeWidth="4" />
        <rect x="-55" y="-55" width="110" height="30" fill="#111827" />
        <rect x="-55" y="25" width="110" height="30" fill="#111827" />
      </g>
      <rect x="90" y="134" width="140" height="14" rx="4" fill={GRAU} />
      <T x={160} y={40} g={22}>
        max. 30 kg
      </T>
    </>
  ),
  rauchverbot: (
    <>
      <rect x="100" y="84" width="110" height="18" fill="#fff" stroke="#374151" strokeWidth="2" />
      <rect x="190" y="84" width="20" height="18" fill="#f59e0b" />
      <path d="M220 80 q10 -14 0 -28" stroke={GRAU} strokeWidth="4" fill="none" />
      <Verbot x={160} y={92} r={70} />
    </>
  ),
  gefahrgut_unfall: (
    <>
      <Person x={60} y={150} s={1.2} weste />
      <polygon points="150,90 180,140 120,140" fill="none" stroke={ROT} strokeWidth="7" strokeLinejoin="round" />
      <Telefon x={220} y={40} s={0.9}>
        <T x={31} y={60} g={20} f={ROT}>
          112
        </T>
      </Telefon>
      <T x={160} y={30} g={14}>
        Abstand · Motor aus · Notruf
      </T>
    </>
  ),

  // Ladebordwand & Ameise
  lbw: (
    <>
      <Lkw x={110} y={60} bordwand />
      <rect x="70" y="115" width="40" height="5" fill={GRAU} />
      <Person x={55} y={150} s={1.1} />
      <Haken x={55} y={50} r={14} />
      <T x={200} y={160} g={12}>
        nur unterwiesen &amp; beauftragt
      </T>
    </>
  ),
  lbw_pruefen: (
    <>
      <Lkw x={130} y={60} bordwand />
      <Plakette x={70} y={70} text="UVV" />
      <T x={70} y={120} g={12}>
        Hydraulik
      </T>
      <T x={70} y={138} g={12}>
        Bedienung
      </T>
    </>
  ),
  lbw_springen: (
    <>
      <rect x="40" y="90" width="120" height="8" fill={GRAU} />
      <g stroke={BLAU} strokeWidth="5" strokeLinecap="round" fill="none">
        <circle cx="200" cy="40" r="9" fill={BLAU} stroke="none" />
        <path d="M200 50 v26 M200 58 l-16 -12 M200 58 l16 -12 M200 76 l-14 18 M200 76 l14 14" />
      </g>
      <path d="M150 70 q30 -50 50 -20" stroke={GRAU} strokeDasharray="6 6" strokeWidth="3" fill="none" />
      <Verbot x={200} y={70} r={56} />
      <rect x="30" y="150" width="260" height="6" fill={GRAU} />
    </>
  ),
  lbw_gefahr: (
    <>
      <Lkw x={150} y={40} bordwand />
      <rect x="60" y="96" width="90" height="8" fill={GRAU} />
      <pattern id="schraffur" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="14" height="14" fill={GELB} />
        <rect width="7" height="14" fill="#111827" />
      </pattern>
      <rect x="50" y="110" width="110" height="40" fill="url(#schraffur)" opacity="0.85" />
      <T x={105} y={172} g={13} f={ROT}>
        Gefahrenbereich frei!
      </T>
    </>
  ),
  lbw_oel: (
    <>
      <Lkw x={130} y={50} bordwand />
      <path d="M105 116 q6 14 0 20 q-6 -6 0 -20 z" fill="#78350f" />
      <ellipse cx="105" cy="150" rx="26" ry="5" fill="#a16207" />
      <polygon points="40,40 70,40 85,55 85,85 70,100 40,100 25,85 25,55" fill={ROT} />
      <T x={55} y={76} g={11} f="#fff">
        STOPP
      </T>
    </>
  ),
  ameise_18: (
    <>
      <Ameise x={60} y={70} />
      <circle cx="240" cy="80" r="44" fill={BLAU} />
      <T x={240} y={92} g={32} f="#fff">
        18+
      </T>
    </>
  ),
  ameise_pruefen: (
    <>
      <Ameise x={40} y={70} s={0.9} />
      <Liste x={180} y={44} zeilen={["Schäden", "Heben/Senken", "Fahren", "Not-Aus", "Batterie"]} g={12} />
    </>
  ),
  ameise_1200: (
    <>
      <Ameise x={50} y={60} />
      <Palette x={110} y={84} w={60} h={40} />
      <T x={240} y={100} g={26}>
        1200 kg
      </T>
      <T x={240} y={124} g={13} b={false} f="#374151">
        höchstens
      </T>
    </>
  ),
  ameise_mitfahren: (
    <>
      <Ameise x={60} y={70} />
      <Person x={150} y={136} s={0.9} />
      <Verbot x={140} y={100} r={60} />
    </>
  ),
  ameise_ziehen: (
    <>
      <Ameise x={150} y={70} s={0.9} />
      <line x1="40" y1="130" x2="150" y2="130" stroke="#374151" strokeWidth="4" strokeDasharray="8 6" />
      <rect x="10" y="100" width="40" height="40" fill={HELL} stroke={GRAU} strokeWidth="3" />
      <Verbot x={100} y={120} r={34} />
    </>
  ),

  // Straßenverkehr
  handy: (
    <>
      <Telefon x={130} y={36} s={0.9} />
      <Verbot x={158} y={86} r={66} />
    </>
  ),
  muedigkeit: (
    <>
      <path d="M50 80 q60 50 120 0" stroke={BLAU} strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M70 96 l-10 16 M95 104 l-4 18 M125 104 l4 18 M150 96 l10 16" stroke={BLAU} strokeWidth="5" strokeLinecap="round" />
      <T x={210} y={70} g={22}>
        Z
      </T>
      <T x={235} y={50} g={28}>
        Z
      </T>
      <T x={265} y={30} g={34}>
        Z
      </T>
      <T x={110} y={150} g={15}>
        anhalten · Pause
      </T>
    </>
  ),
  abstand: (
    <>
      <rect x="10" y="120" width="300" height="4" fill={GRAU} />
      <Lkw x={10} y={56} s={0.6} />
      <Lkw x={210} y={56} s={0.6} />
      <Pfeil x1={110} y1={100} x2={205} y2={100} f={GELB} w={5} />
      <Pfeil x1={205} y1={100} x2={110} y2={100} f={GELB} w={5} />
      <T x={158} y={90} g={20}>
        50 m
      </T>
      <rect x="106" y="120" width="6" height="30" fill="#fff" stroke="#111827" strokeWidth="2" />
      <rect x="206" y="120" width="6" height="30" fill="#fff" stroke="#111827" strokeWidth="2" />
      <T x={160} y={172} g={12} f="#374151" b={false}>
        Leitpfosten zu Leitpfosten
      </T>
    </>
  ),
  abbiegen: (
    <>
      <rect x="0" y="40" width="320" height="60" fill={HELL} />
      <rect x="200" y="100" width="60" height="80" fill={HELL} />
      <rect x="0" y="100" width="200" height="12" fill="#fca5a5" />
      <LkwOben x={60} y={48} s={0.8} />
      <path d="M200 70 q30 0 30 40" stroke={BLAU} strokeWidth="4" fill="none" strokeDasharray="6 6" />
      <circle cx="150" cy="106" r="7" fill={ROT} />
      <T x={120} y={150} g={16}>
        Schritttempo
      </T>
      <T x={120} y={170} g={12} b={false} f="#374151">
        Radfahrer rechts!
      </T>
    </>
  ),
  rettungsgasse: (
    <>
      {[0, 1, 2].map((s) => (
        <g key={s}>
          {[0, 1, 2].map((i) => (
            <rect key={i} x={s === 0 ? 60 : s === 1 ? 170 : 225} y={20 + i * 52} width={30} height={42} rx="4" fill={BLAU} />
          ))}
        </g>
      ))}
      <rect x="105" y="10" width="50" height="160" fill={GELB} opacity="0.5" />
      <Pfeil x1={130} y1={160} x2={130} y2={24} f={ROT} w={5} />
      <T x={130} y={176} g={11}>
        Gasse
      </T>
    </>
  ),
  toter_winkel: (
    <>
      <LkwOben x={100} y={67} />
      <path d="M216 113 L260 175 L160 175 L190 113 z" fill={ROT} opacity="0.35" />
      <path d="M100 113 L40 175 L130 175 z" fill={ROT} opacity="0.2" />
      <circle cx="210" cy="150" r="8" fill={ROT} />
      <T x={70} y={40} g={14}>
        Toter Winkel
      </T>
    </>
  ),
  warndreieck: (
    <>
      <rect x="10" y="130" width="300" height="4" fill={GRAU} />
      <Lkw x={250} y={88} s={0.4} />
      {[
        [200, "50 m", "Ort"],
        [130, "100 m", "Land"],
        [40, "200 m", "Autobahn"],
      ].map(([x, d, w]) => (
        <g key={w as string}>
          <polygon points={`${x},96 ${(x as number) + 16},124 ${(x as number) - 16},124`} fill="none" stroke={ROT} strokeWidth="5" strokeLinejoin="round" />
          <T x={x as number} y={80} g={14}>
            {d}
          </T>
          <T x={x as number} y={154} g={11} b={false} f="#374151">
            {w}
          </T>
        </g>
      ))}
    </>
  ),
  warnweste: (
    <>
      <path d="M110 40 l-30 20 l10 100 h140 l10 -100 l-30 -20 l-20 30 h-60 z" fill={GELB} stroke="#a16207" strokeWidth="3" />
      <rect x="92" y="100" width="136" height="12" fill="#e5e7eb" />
      <rect x="92" y="126" width="136" height="12" fill="#e5e7eb" />
      <T x={160} y={30} g={14}>
        erst Weste, dann raus
      </T>
    </>
  ),
  schuld: (
    <>
      <Dokument x={110} y={30} s={1.2} titel="Schuld" />
      <Verbot x={154} y={96} r={60} />
    </>
  ),
  reden: (
    <>
      <path d="M40 40 h120 a14 14 0 0 1 14 14 v40 a14 14 0 0 1 -14 14 h-80 l-20 20 v-20 h-20 a14 14 0 0 1 -14 -14 v-40 a14 14 0 0 1 14 -14 z" fill={BLAU} />
      <path d="M170 80 h110 a14 14 0 0 1 14 14 v36 a14 14 0 0 1 -14 14 h-20 v20 l-20 -20 h-70 a14 14 0 0 1 -14 -14 v-36 a14 14 0 0 1 14 -14 z" fill={GELB} />
      <T x={100} y={80} g={15} f="#fff">
        Reden hilft
      </T>
      <T x={225} y={118} g={13}>
        BG Verkehr
      </T>
    </>
  ),
};

export function Bild({ name, titel }: { name?: string; titel: string }) {
  const inhalt = name ? BILDER[name] : undefined;
  if (!inhalt) return null;
  return (
    <svg viewBox="0 0 320 180" role="img" aria-label={titel} className="h-auto w-full rounded-xl bg-grund">
      {inhalt}
    </svg>
  );
}

export const BILD_NAMEN = Object.keys(BILDER);
