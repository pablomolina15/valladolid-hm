import { useState, useEffect, useMemo } from "react";

const STRAVA_CLIENT_ID = "253017";
const STRAVA_REDIRECT = "https://valladolid-hm-zuqu.vercel.app";
const STRAVA_SCOPE = "activity:read_all";

function stravaAuthUrl() {
  return `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&redirect_uri=${encodeURIComponent(STRAVA_REDIRECT)}&response_type=code&scope=${STRAVA_SCOPE}`;
}
async function exchangeToken(code) { const r = await fetch(`/api/strava?action=token&code=${code}`); return r.json(); }
async function fetchStravaActivities(at) { const r = await fetch(`/api/strava?action=activities&access_token=${at}`); return r.json(); }
async function refreshStravaToken(rt) { const r = await fetch(`/api/strava?action=refresh&refresh_token=${rt}`); return r.json(); }

function secondsToTime(s) {
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = Math.floor(s%60);
  if (h > 0) return `${h}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
  return `${m}:${String(sec).padStart(2,"0")}`;
}
function speedToPace(mps) {
  if (!mps) return "—";
  const s = 1000/mps, m = Math.floor(s/60), sec = Math.floor(s%60);
  return `${m}:${String(sec).padStart(2,"0")}`;
}
const RUN_TYPES = ["Run","TrailRun","VirtualRun"];
const BIKE_TYPES = ["Ride","VirtualRide","EBikeRide"];
const SWIM_TYPES = ["Swim"];
function activityCategory(act) {
  if (RUN_TYPES.includes(act.type)) return "run";
  if (BIKE_TYPES.includes(act.type)) return "bike";
  if (SWIM_TYPES.includes(act.type)) return "swim";
  return "other";
}
function planDayAcceptsCategory(session, cat) {
  if (cat==="run") return ["easy","long","series","race"].includes(session.type);
  if (cat==="bike") return session.type==="bike";
  if (cat==="swim") return session.type==="swim";
  return false;
}
function buildActualFromActivity(act) {
  const cat = activityCategory(act);
  return {
    distance: (act.distance/1000).toFixed(2),
    duration: secondsToTime(act.moving_time),
    pace: cat==="run" ? speedToPace(act.average_speed) : "",
    stravaId: act.id, stravaName: act.name,
    stravaDate: act.start_date_local?.split("T")[0],
    fromStrava: true, notes: "", gymWeights: {},
  };
}
function matchActivitiesToPlan(activities, plan) {
  const updated = plan.map(d=>({...d}));
  const unassigned = [], usedIds = new Set();
  activities.forEach(act => {
    const cat = activityCategory(act);
    if (cat==="other") return;
    const actDate = act.start_date_local?.split("T")[0];
    if (!actDate) return;
    if (updated.find(d=>d.actual?.stravaId===act.id)) { usedIds.add(act.id); return; }
    const idx = updated.findIndex(d=>d.date===actDate && planDayAcceptsCategory(d.session,cat) && !d.actual?.stravaId);
    if (idx!==-1) { updated[idx]={...updated[idx],completed:true,actual:buildActualFromActivity(act)}; usedIds.add(act.id); }
    else if (!usedIds.has(act.id)) { unassigned.push(act); usedIds.add(act.id); }
  });
  return { matched: updated, unassigned };
}

// ============================================================
// SWIM SESSIONS — varied, HM-useful, end Sept 3
// ============================================================
const swimSessions = [
  // Weeks 1-3: Base aerobic
  { label:"400m calentamiento + 8x100m (desc 15s) + 200m enfriamiento", distanceM:1800, detail:"Ritmo cómodo todo. Crol. Foco en técnica de brazada y respiración bilateral." },
  { label:"200m cal + 6x150m (desc 20s) + 4x50m sprint (desc 30s) + 200m enf", distanceM:2000, detail:"Los 150m a ritmo medio, los 50m a tope. Trabaja la potencia aeróbica." },
  { label:"300m cal + 10x100m alternando ritmo (1 suave/1 fuerte) + 200m enf", distanceM:2500, detail:"Fartlek en agua. Similar al trabajo de series en pista pero sin impacto." },
  // Weeks 4-6
  { label:"500m continuo + 8x100m (desc 15s) + 200m enf", distanceM:2100, detail:"El 500m continuo trabaja resistencia aeróbica base. Mantén ritmo uniforme." },
  { label:"200m cal + 4x200m (desc 25s) + 4x50m (desc 20s) + 200m enf", distanceM:2000, detail:"Los 200m a ritmo de umbral. Equivalente al tempo en tierra." },
  { label:"400m cal + 12x100m (desc 15s) + 200m enf", distanceM:2800, detail:"Volumen alto, ritmo controlado. Semana de carga: aguanta el volumen sin forzar." },
  // Weeks 7-9
  { label:"300m cal + 3x400m (desc 45s) + 200m enf", distanceM:2300, detail:"Los 400m a ritmo sostenido. Trabaja la capacidad aeróbica como en los rodajes largos." },
  { label:"200m cal + 6x200m (desc 25s) + 200m enf", distanceM:1800, detail:"Series medias a ritmo fuerte. Equivalente a un entrenamiento de umbral." },
  { label:"SEMANA 9: SIN BICI — natación extra", label:"400m cal + 2x(5x100m desc 15s) + 200m enf", distanceM:2700, detail:"Dos bloques de series cortas. Buena sesión de calidad sin impacto articular." },
  // Weeks 10-12
  { label:"300m cal + 1000m continuo + 200m enf", distanceM:1500, detail:"Semana recuperación. El 1000m continuo a ritmo fácil, sin pausa. Foco en eficiencia." },
  { label:"200m cal + 8x150m (desc 20s) + 200m enf", distanceM:2600, detail:"Series medias progresivas: cada 150m un poco más rápido que el anterior." },
  { label:"400m cal + 4x300m (desc 35s) + 200m enf", distanceM:2800, detail:"Bloques largos aeróbicos. Mantén técnica aunque notes el cansancio." },
  // Weeks 13-14 (last swim before Sept 3 cutoff)
  { label:"300m cal + 10x100m (desc 12s) + 200m enf", distanceM:2500, detail:"Series cortas con poco descanso. Trabajo de resistencia a la fatiga." },
  { label:"ÚLTIMA SEMANA NATACIÓN — 200m cal + 600m continuo + 4x100m (desc 15s) + 200m enf", distanceM:2100, detail:"Última sesión de natación. Disfrútala, ha sido una gran herramienta de recuperación activa." },
];

// ============================================================
// BIKE SESSIONS — varied, HM-useful
// ============================================================
const bikeSessions = [
  // Base: aerobic base, Zone 2
  { label:"Rodaje base Z2", distance:50, detail:"50km ritmo cómodo Z2 (FC 125–140). Cadencia alta 85-90rpm. Base aeróbica sin fatiga residual.", duration:"1h45–2h" },
  { label:"Fartlek en bici", distance:55, detail:"55km: 10km cal + 5x5min fuerte (FC 160+) desc 5min + 10km enf. Trabaja el sistema aeróbico-anaeróbico.", duration:"1h50–2h10" },
  { label:"Rodada Z2 larga", distance:70, detail:"70km ritmo uniforme Z2. El volumen es el objetivo hoy. Come algo a mitad si supera 2h.", duration:"2h20–2h40" },
  { label:"Intervalos en subida", distance:45, detail:"45km con 4x8min en subida (FC 165-175) desc bajando. Fuerza específica de pierna, clave para economía de carrera.", duration:"1h40–2h" },
  { label:"Tempo en bici", distance:60, detail:"60km: 10km cal + 30min a Z3-Z4 (FC 150-165) + 10km enf. Equivalente al tempo de carrera pero sin impacto.", duration:"2h–2h20" },
  { label:"Rodada recuperación activa", distance:40, detail:"40km muy suave Z1-Z2 (FC <130). Tras semana de carga. Activa circulación sin acumular fatiga.", duration:"1h20–1h40" },
  { label:"Bici larga con progresión", distance:75, detail:"75km: primeros 50km Z2, últimos 25km subes a Z3. Simula el final de carrera con fatiga acumulada.", duration:"2h30–3h" },
  { label:"Series cortas en bici", distance:50, detail:"50km: 10km cal + 8x3min al máximo desc 3min + 10km enf. Trabaja la potencia máxima aeróbica (VO2max).", duration:"1h45–2h" },
  { label:"Rodada larga Z2+Z3", distance:65, detail:"65km: 40km Z2 + 20km Z3 + 5km enf. Combina volumen y algo de intensidad.", duration:"2h10–2h30" },
  { label:"Bici técnica y cadencia", distance:45, detail:"45km con trabajo de cadencia: 5x5min a 100rpm+ desc 3min. Mejora economía de pedaleo y coordinación neuromuscular.", duration:"1h35–1h55" },
  { label:"Tempo largo en bici", distance:65, detail:"65km: 10km cal + 40min tempo Z3-Z4 + 10km enf. Sesión de calidad aeróbica alta.", duration:"2h10–2h30" },
  { label:"Rodada suave pre-carrera", distance:35, detail:"35km muy suave. Última bici antes del taper final. Mantén las piernas activas sin cargarlas.", duration:"1h10–1h30" },
];

// ============================================================
// PLAN GENERATOR — with corrected km counting & varied sessions
// ============================================================
function generatePlan() {
  const start = new Date("2026-06-01");
  const raceDay = new Date("2026-09-27");
  const swimCutoff = new Date("2026-09-03");
  const noSwimWeek = 9; // week 9 no bike → extra swim opportunity handled
  const noBikeWeeks = [16, 17]; // last 2 weeks no bike (injury risk)
  const noBikeWeek9 = true;
  const days = [];

  const gym = {
    base: { label:"Fuerza Base", exercises:[{name:"Sentadilla",sets:3,reps:8,kg:40},{name:"Press banca",sets:3,reps:8,kg:40},{name:"Peso muerto rumano",sets:3,reps:10,kg:35},{name:"Zancadas",sets:3,reps:10,kg:20},{name:"Plancha",sets:3,reps:1,duration:"45s"},{name:"Elevaciones gemelos",sets:3,reps:15,kg:0}] },
    mid: { label:"Fuerza Media", exercises:[{name:"Sentadilla",sets:4,reps:6,kg:50},{name:"Press banca",sets:4,reps:6,kg:50},{name:"Peso muerto",sets:3,reps:6,kg:55},{name:"Hip thrust",sets:3,reps:10,kg:40},{name:"Plancha lateral",sets:3,reps:1,duration:"40s c/lado"},{name:"Step-up",sets:3,reps:10,kg:15}] },
    specific: { label:"Fuerza Específica", exercises:[{name:"Sentadilla búlgara",sets:3,reps:8,kg:20},{name:"Press banca",sets:3,reps:8,kg:52},{name:"Peso muerto",sets:3,reps:6,kg:60},{name:"Hip thrust",sets:3,reps:12,kg:50},{name:"Core: dead bug",sets:3,reps:10,kg:0},{name:"Gemelos en máquina",sets:4,reps:15,kg:30}] },
    taper: { label:"Fuerza Mantenimiento", exercises:[{name:"Sentadilla",sets:2,reps:8,kg:45},{name:"Press banca",sets:2,reps:8,kg:45},{name:"Hip thrust",sets:2,reps:10,kg:40},{name:"Plancha",sets:2,reps:1,duration:"40s"}] },
  };

  // Series: core km + 3km warmup + 3km cooldown = totalKm
  // coreKm is the actual interval distance
  const seriesDefs = [
    { desc:"6x1000m r:90s @ 4:00–4:05/km", coreKm:6, wc:3 },
    { desc:"5x1200m r:2min @ 4:00–4:05/km", coreKm:6, wc:3 },
    { desc:"8x800m r:75s @ 3:55–4:00/km", coreKm:6.4, wc:3 },
    { desc:"Rodaje calidad suave 8km (semana recuperación)", coreKm:8, wc:0 },
    { desc:"5x1600m r:2min @ 4:10–4:15/km", coreKm:8, wc:3 },
    { desc:"6x1200m r:90s @ 3:58–4:03/km", coreKm:7.2, wc:3 },
    { desc:"4x2000m r:2:30min @ 4:10–4:15/km", coreKm:8, wc:3 },
    { desc:"3x3000m r:3min @ 4:12–4:18/km", coreKm:9, wc:3 },
    { desc:"10x600m r:60s @ 3:48–3:53/km", coreKm:6, wc:3 },
    { desc:"5x2000m r:2min @ 4:08–4:13/km", coreKm:10, wc:3 },
    { desc:"3x4000m r:3min @ 4:10–4:14/km", coreKm:12, wc:3 },
    { desc:"Tempo continuo 6km @ 4:18–4:22/km", coreKm:6, wc:3 },
    { desc:"4x3000m r:2:30min @ 4:07–4:12/km", coreKm:12, wc:3 },
    { desc:"Rodaje mixto: 5km fácil + 5km ritmo maratón (4:15–4:20)", coreKm:10, wc:3 },
    { desc:"3x2000m r:2min @ 4:05/km + 6x400m r:60s @ 3:45/km", coreKm:8.4, wc:3 },
    { desc:"4x1600m r:2min @ 4:08–4:13/km", coreKm:6.4, wc:3 },
    { desc:"3x1000m r:90s @ 4:00/km + 3x500m r:60s @ 3:45/km", coreKm:4.5, wc:3 },
  ];

  // Long run schedule (adjusted to keep weekly km reasonable with series km)
  const longRunByWeek = {1:16,2:17,3:18,4:13,5:18,6:20,7:14,8:19,9:20,10:17,11:18,12:20,13:21,14:15,15:20,16:17,17:12};
  // Easy Mon km
  const easyMonByWeek = {1:10,2:11,3:11,4:8,5:11,6:12,7:10,8:12,9:12,10:10,11:12,12:13,13:13,14:10,15:12,16:10,17:7};

  let seriesIdx = 0, swimIdx = 0, bikeIdx = 0;
  const cur = new Date(start);

  while (cur <= raceDay) {
    const dow = cur.getDay();
    const dateStr = cur.toISOString().split("T")[0];
    const wk = Math.floor((cur - start) / 86400000 / 7) + 1;
    const swimAvail = cur < swimCutoff && cur >= new Date("2026-06-15");
    const noBike = noBikeWeeks.includes(wk) || (noBikeWeek9 && wk === 9);

    let phase = "Base 1";
    if (wk<=3) phase="Base 1";
    else if (wk<=6) phase="Base 2";
    else if (wk<=10) phase="Desarrollo";
    else if (wk<=14) phase="Específico";
    else if (wk<=16) phase="Pico";
    else phase="Taper";

    const isRec = [4,10,14].includes(wk);
    const isTaper = wk===17;
    const isRace = dateStr==="2026-09-27";

    let session = null;

    if (isRace) {
      session = { type:"race", label:"🏆 MEDIA MARATÓN VALLADOLID", distance:21.1, targetTime:"1:28:30–1:30:00", detail:"Salida controlada 4:20/km primeros 5km · 4:16/km hasta km10 · 4:12/km hasta km18 · ¡a fondo los últimos 3km!" };
    }
    else if (dow===1) {
      // Monday easy
      const k = easyMonByWeek[wk] || 10;
      session = { type:"easy", label:"Rodaje suave", distance:k, pace:isRec?"6:00–6:30 /km":"5:40–6:10 /km", duration:`${Math.round(k*5.8)}–${Math.round(k*6.2)} min`, detail:"Ritmo conversacional. FC < 140 ppm. Activa las piernas sin acumular fatiga." };
    }
    else if (dow===2) {
      // Tuesday gym
      const g = wk<=4?"base":wk<=10?"mid":isTaper?"taper":"specific";
      session = { type:"gym", label:"Gimnasio", gymData:gym[g], detail:"Calentamiento 10min cardiovascular suave. Estiramientos 10min al final." };
    }
    else if (dow===3) {
      // Wednesday series
      const s = seriesDefs[Math.min(seriesIdx, seriesDefs.length-1)];
      const totalKm = s.wc===0 ? s.coreKm : s.coreKm + s.wc*2;
      session = { type:"series", label:"Series / Calidad", seriesDescription:s.desc, coreKm:s.coreKm, warmCoolKm:s.wc, totalKm:Math.round(totalKm*10)/10, detail: s.wc>0 ? `${s.wc}km calentamiento suave + ${s.desc} + ${s.wc}km enfriamiento. Total: ${Math.round(totalKm*10)/10}km` : s.desc };
      seriesIdx++;
    }
    else if (dow===4) {
      // Thursday: swim if available, else rest
      if (swimAvail) {
        const sw = swimSessions[Math.min(swimIdx, swimSessions.length-1)];
        session = { type:"swim", label:"Natación", distanceM:sw.distanceM, swimLabel:sw.label, detail:sw.detail };
        swimIdx++;
      } else {
        session = { type:"rest", label:"Descanso activo", detail:"Movilidad y estiramientos 20 min. Foam roller si tienes." };
      }
    }
    else if (dow===5) {
      // Friday: bike or rest if no-bike week
      if (noBike) {
        // Week 9: extra swim on Friday if still swim season
        if (wk===9 && swimAvail) {
          const sw = swimSessions[Math.min(swimIdx, swimSessions.length-1)];
          session = { type:"swim", label:"Natación (extra — sin bici sem 9)", distanceM:sw.distanceM, swimLabel:sw.label, detail:sw.detail };
          swimIdx++;
        } else if (noBikeWeeks.includes(wk)) {
          session = { type:"rest", label:"Descanso activo", detail:"Sin bici estas dos semanas para evitar riesgo de caída antes de la carrera. Estiramientos y movilidad 20min." };
        } else {
          session = { type:"rest", label:"Descanso activo", detail:"Movilidad y estiramientos 20 min." };
        }
      } else {
        const bk = bikeSessions[Math.min(bikeIdx, bikeSessions.length-1)];
        session = { type:"bike", label:`Bicicleta — ${bk.label}`, distance:bk.distance, detail:bk.detail, duration:bk.duration };
        bikeIdx++;
      }
    }
    else if (dow===6) {
      // Saturday: gym (even weeks) or medium run (odd weeks), sometimes extra bike
      // Weeks 3,7,11: add bike on Saturday (trainer decision for extra aerobic base)
      const extraBikeSat = [3,7,11].includes(wk) && !noBike;
      if (extraBikeSat) {
        const bk = bikeSessions[Math.min(bikeIdx, bikeSessions.length-1)];
        session = { type:"bike", label:`Bicicleta sábado — ${bk.label}`, distance:bk.distance, detail:bk.detail + " (Sesión extra sábado para completar carga aeróbica de la semana.)", duration:bk.duration };
        bikeIdx++;
      } else if (wk%2===0) {
        const g = wk<=4?"base":wk<=10?"mid":isTaper?"taper":"specific";
        session = { type:"gym", label:"Gimnasio", gymData:gym[g], detail:"Segunda sesión de fuerza semanal. Varía el orden de ejercicios." };
      } else {
        const k = Math.round((longRunByWeek[wk]||16)*0.5);
        session = { type:"easy", label:"Rodaje medio", distance:k, pace:"5:40–6:10 /km", duration:`${Math.round(k*5.7)}–${Math.round(k*6.1)} min`, detail:"Rodaje de apoyo. Sin forzar. Prepara el largo del domingo." };
      }
    }
    else if (dow===0) {
      // Sunday: long run
      const lr = longRunByWeek[wk] || 16;
      session = { type:"long", label:isTaper?"Rodaje largo (taper)":"Rodaje largo", distance:lr, pace:isRec?"6:00–6:30 /km":"5:40–6:10 /km", detail:isRec?`${lr}km tranquilo a 6:00–6:30/km. Semana de recuperación, no fuerces.`:`${lr}km. Primeros ${Math.round(lr*0.65)}km a 5:40–6:10/km. Últimos ${Math.round(lr*0.25)}km a 4:15–4:20/km.`, includes:isRec?null:`Últimos ${Math.round(lr*0.25)}km a ritmo objetivo` };
    }

    if (session) days.push({ date:dateStr, weekNum:wk, phase, dayOfWeek:dow, session, completed:false, actual:null });
    cur.setDate(cur.getDate()+1);
  }
  return days;
}

// ============================================================
// STORAGE
// ============================================================
const SK="hm_val_2026_v4", STK="strava_token_2026", UK="strava_ua_2026";
function loadData(){try{const s=localStorage.getItem(SK);if(s)return JSON.parse(s);}catch(e){}return null;}
function saveData(d){try{localStorage.setItem(SK,JSON.stringify(d));}catch(e){}}
function loadToken(){try{const s=localStorage.getItem(STK);if(s)return JSON.parse(s);}catch(e){}return null;}
function saveToken(t){try{localStorage.setItem(STK,JSON.stringify(t));}catch(e){}}
function loadUA(){try{const s=localStorage.getItem(UK);if(s)return JSON.parse(s);}catch(e){}return[];}
function saveUA(u){try{localStorage.setItem(UK,JSON.stringify(u));}catch(e){}}

// ============================================================
// HELPERS
// ============================================================
const DOW=["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
const MON=["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
function fmtDate(ds){const d=new Date(ds+"T00:00:00");return `${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`;}
function typeColor(t){return{easy:"#4ade80",series:"#f97316",long:"#818cf8",gym:"#e879f9",bike:"#38bdf8",swim:"#2dd4bf",race:"#fbbf24",rest:"#94a3b8"}[t]||"#94a3b8";}
function typeIcon(t){return{easy:"🏃",series:"⚡",long:"🛤️",gym:"🏋️",bike:"🚴",swim:"🏊",race:"🏆",rest:"💤"}[t]||"📋";}
function actIcon(act){const c=activityCategory(act);return c==="run"?"🏃":c==="bike"?"🚴":c==="swim"?"🏊":"📋";}

// ============================================================
// STATS — correctly separated
// ============================================================
function StatsPanel({plan}){
  // Run: easy + long + series (series totalKm includes warmup/cooldown)
  const runKmPlan = plan.filter(d=>["easy","long","series"].includes(d.session.type))
    .reduce((s,d)=>{
      if(d.session.type==="series") return s+(d.session.totalKm||0);
      return s+(d.session.distance||0);
    },0);
  const runKmReal = plan.filter(d=>["easy","long","series"].includes(d.session.type)&&d.completed&&d.actual?.distance)
    .reduce((s,d)=>s+parseFloat(d.actual.distance||0),0);

  // Bike
  const bikeKmPlan = plan.filter(d=>d.session.type==="bike"&&d.session.distance).reduce((s,d)=>s+(d.session.distance||0),0);
  const bikeKmReal = plan.filter(d=>d.session.type==="bike"&&d.completed&&d.actual?.distance).reduce((s,d)=>s+parseFloat(d.actual.distance||0),0);

  // Swim in metres
  const swimMPlan = plan.filter(d=>d.session.type==="swim"&&d.session.distanceM).reduce((s,d)=>s+(d.session.distanceM||0),0);
  const swimMReal = plan.filter(d=>d.session.type==="swim"&&d.completed&&d.actual?.distance)
    .reduce((s,d)=>{
      const v=parseFloat(d.actual.distance||0);
      // If logged in metres (>100) use as-is, else assume km and convert
      return s+(v>100?v:v*1000);
    },0);

  const done=plan.filter(d=>d.completed).length;
  const daysLeft=Math.max(0,Math.floor((new Date("2026-09-27")-new Date())/86400000));

  return(
    <div style={{marginBottom:16}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
        {[{label:"Días para la carrera",value:daysLeft,color:"#fbbf24"},{label:"Sesiones completadas",value:`${done}/${plan.length}`,color:"#4ade80"}].map(s=>(
          <div key={s.label} style={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:12,padding:"12px",textAlign:"center"}}>
            <div style={{fontSize:22,fontWeight:800,color:s.color,lineHeight:1}}>{s.value}</div>
            <div style={{fontSize:9,color:"#475569",marginTop:4,letterSpacing:0.5,lineHeight:1.3}}>{s.label.toUpperCase()}</div>
          </div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
        {[
          {icon:"🏃",label:"Carrera",plan:`${Math.round(runKmPlan)}km`,real:`${Math.round(runKmReal)}km`,color:"#4ade80"},
          {icon:"🚴",label:"Bici",plan:`${Math.round(bikeKmPlan)}km`,real:`${Math.round(bikeKmReal)}km`,color:"#38bdf8"},
          {icon:"🏊",label:"Natación",plan:`${Math.round(swimMPlan)}m`,real:`${Math.round(swimMReal)}m`,color:"#2dd4bf"},
        ].map(s=>(
          <div key={s.label} style={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:12,padding:"10px 8px",textAlign:"center"}}>
            <div style={{fontSize:15,marginBottom:3}}>{s.icon}</div>
            <div style={{fontSize:9,color:"#475569",marginBottom:5,letterSpacing:0.5}}>{s.label.toUpperCase()}</div>
            <div style={{fontSize:15,fontWeight:800,color:s.color,lineHeight:1}}>{s.real}</div>
            <div style={{fontSize:9,color:"#334155",marginTop:3}}>/{s.plan}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// GYM CARD
// ============================================================
function GymCard({gymData}){
  return(
    <div style={{marginTop:10}}>
      <div style={{fontSize:10,fontWeight:700,letterSpacing:2,color:"#e879f9",marginBottom:6}}>{gymData.label.toUpperCase()}</div>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
        <thead><tr style={{color:"#64748b"}}><th style={{textAlign:"left",paddingBottom:3,fontWeight:600}}>Ejercicio</th><th style={{textAlign:"center",paddingBottom:3,fontWeight:600}}>Series</th><th style={{textAlign:"center",paddingBottom:3,fontWeight:600}}>Reps</th><th style={{textAlign:"center",paddingBottom:3,fontWeight:600}}>Kg</th></tr></thead>
        <tbody>{gymData.exercises.map((ex,i)=>(<tr key={i} style={{borderTop:"1px solid #1e293b"}}><td style={{padding:"4px 0",color:"#e2e8f0"}}>{ex.name}</td><td style={{textAlign:"center",color:"#94a3b8"}}>{ex.sets}</td><td style={{textAlign:"center",color:"#94a3b8"}}>{ex.duration||ex.reps}</td><td style={{textAlign:"center",color:ex.kg>0?"#e879f9":"#475569"}}>{ex.kg>0?`${ex.kg}kg`:"—"}</td></tr>))}</tbody>
      </table>
    </div>
  );
}

// ============================================================
// ACTUAL FORM
// ============================================================
const LS={display:"block",fontSize:11,fontWeight:600,color:"#64748b",marginBottom:4,marginTop:12,letterSpacing:1};
const IS={width:"100%",padding:"10px 12px",background:"#1e293b",border:"1px solid #334155",borderRadius:8,color:"#f1f5f9",fontSize:16,boxSizing:"border-box",outline:"none"};

function ActualForm({day,onSave,onClose}){
  const[form,setForm]=useState(day.actual||{distance:"",duration:"",pace:"",notes:"",gymWeights:{}});
  const isGym=day.session.type==="gym";
  const isSwim=day.session.type==="swim";
  const exs=day.session.gymData?.exercises||[];
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",zIndex:100,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div style={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:"20px 20px 0 0",padding:20,width:"100%",maxWidth:500,maxHeight:"85vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div style={{fontWeight:700,fontSize:14,color:"#f8fafc"}}>{typeIcon(day.session.type)} Registrar actividad</div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#64748b",cursor:"pointer",fontSize:22,lineHeight:1}}>✕</button>
        </div>
        <div style={{fontSize:11,color:"#64748b",marginBottom:14}}>{fmtDate(day.date)} — {day.session.label}</div>
        {day.actual?.fromStrava&&<div style={{background:"#0c2a1a",border:"1px solid #166534",borderRadius:8,padding:10,marginBottom:12,fontSize:11,color:"#4ade80"}}>🟠 Strava: <strong>{day.actual.stravaName}</strong></div>}
        {!isGym&&(<>
          <label style={LS}>{isSwim?"Distancia real (metros)":"Distancia real (km)"}</label>
          <input style={IS} type="number" step={isSwim?"50":"0.1"} value={form.distance} onChange={e=>setForm(f=>({...f,distance:e.target.value}))} placeholder={isSwim?(day.session.distanceM||"—"):(day.session.distance||"—")} />
          <label style={LS}>Tiempo real</label>
          <input style={IS} type="text" value={form.duration} onChange={e=>setForm(f=>({...f,duration:e.target.value}))} placeholder="mm:ss o h:mm:ss" />
          {!isSwim&&<><label style={LS}>Ritmo medio (/km)</label><input style={IS} type="text" value={form.pace} onChange={e=>setForm(f=>({...f,pace:e.target.value}))} placeholder="5:42" /></>}
        </>)}
        {isGym&&exs.map(ex=>(
          <div key={ex.name} style={{marginBottom:8}}>
            <label style={LS}>{ex.name} (kg reales)</label>
            <input style={IS} type="number" step="2.5" value={form.gymWeights[ex.name]||""} onChange={e=>setForm(f=>({...f,gymWeights:{...f.gymWeights,[ex.name]:e.target.value}}))} placeholder={ex.kg>0?`Objetivo: ${ex.kg}kg`:"—"} />
          </div>
        ))}
        <label style={LS}>Notas</label>
        <textarea style={{...IS,height:65,resize:"none"}} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Sensaciones, incidencias..." />
        <button onClick={()=>onSave(form)} style={{width:"100%",padding:"14px",marginTop:14,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",borderRadius:12,color:"#fff",fontWeight:700,fontSize:15,cursor:"pointer"}}>💾 Guardar entrenamiento</button>
      </div>
    </div>
  );
}

// ============================================================
// DAY CARD
// ============================================================
function DayCard({day,onComplete,onUncomplete,onLog}){
  const{session,completed,actual}=day;
  const color=typeColor(session.type);
  const isToday=day.date===new Date().toISOString().split("T")[0];
  return(
    <div style={{background:completed?"#0a1628":"#0f172a",border:`1px solid ${isToday?color:completed?"#1e3a5f":"#1e293b"}`,borderLeft:`3px solid ${color}`,borderRadius:12,padding:"12px 12px",marginBottom:7,position:"relative"}}>
      {isToday&&<div style={{position:"absolute",top:-8,right:10,background:color,color:"#000",fontSize:8,fontWeight:800,padding:"2px 7px",borderRadius:10,letterSpacing:1}}>HOY</div>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:3,flexWrap:"wrap"}}>
            <span style={{fontSize:14}}>{typeIcon(session.type)}</span>
            <span style={{fontSize:13,fontWeight:700,color:"#f8fafc",wordBreak:"break-word"}}>{session.label}</span>
            <span style={{fontSize:8,fontWeight:700,background:color+"22",color,padding:"2px 5px",borderRadius:5,whiteSpace:"nowrap"}}>{session.type.toUpperCase()}</span>
            {actual?.fromStrava&&<span style={{fontSize:8,fontWeight:700,background:"#f9731622",color:"#f97316",padding:"2px 5px",borderRadius:5}}>STRAVA</span>}
          </div>
          <div style={{fontSize:10,color:"#64748b",marginBottom:4}}>{fmtDate(day.date)}</div>
          {session.distance&&<div style={{fontSize:12,color:"#94a3b8"}}>📏 <strong style={{color:"#e2e8f0"}}>{session.distance}km</strong>{session.pace&&<span style={{marginLeft:5}}>· {session.pace}</span>}{session.duration&&<span style={{marginLeft:5}}>· {session.duration}</span>}</div>}
          {session.distanceM&&<div style={{fontSize:12,color:"#94a3b8"}}>📏 <strong style={{color:"#2dd4bf"}}>{session.distanceM}m</strong></div>}
          {session.totalKm&&session.type==="series"&&<div style={{fontSize:12,color:"#94a3b8",marginTop:2}}>📏 <strong style={{color:"#f97316"}}>{session.totalKm}km total</strong> <span style={{fontSize:10,color:"#64748b"}}>(incl. cal+enf)</span></div>}
          {session.seriesDescription&&<div style={{fontSize:11,color:"#f97316",marginTop:4,lineHeight:1.5}}>⚡ {session.seriesDescription}</div>}
          {session.swimLabel&&<div style={{fontSize:11,color:"#2dd4bf",marginTop:4,lineHeight:1.5}}>🏊 {session.swimLabel}</div>}
          {session.includes&&<div style={{fontSize:11,color:"#818cf8",marginTop:2}}>↗ {session.includes}</div>}
          {session.targetTime&&<div style={{fontSize:12,color:"#fbbf24",marginTop:3,fontWeight:700}}>🎯 {session.targetTime}</div>}
          <div style={{fontSize:11,color:"#475569",marginTop:5,lineHeight:1.6}}>{session.detail}</div>
          {session.gymData&&<GymCard gymData={session.gymData}/>}
          {actual&&(
            <div style={{marginTop:8,padding:"7px 10px",background:"#1e3a5f",borderRadius:8,fontSize:11}}>
              <span style={{color:actual.fromStrava?"#f97316":"#4ade80",fontWeight:700}}>{actual.fromStrava?"🟠 Strava: ":"✓ Real: "}</span>
              {actual.distance&&<span style={{color:"#a5f3fc"}}>{actual.distance}{day.session.type==="swim"?"m":"km"} </span>}
              {actual.duration&&<span style={{color:"#a5f3fc"}}>{actual.duration} </span>}
              {actual.pace&&<span style={{color:"#a5f3fc"}}>@ {actual.pace}/km </span>}
              {actual.notes&&<span style={{color:"#64748b"}}>— {actual.notes}</span>}
            </div>
          )}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:5,flexShrink:0}}>
          <button onClick={()=>onLog(day)} style={{padding:"7px 10px",background:"#1e293b",border:"1px solid #334155",borderRadius:8,color:"#94a3b8",fontSize:11,cursor:"pointer",whiteSpace:"nowrap",minWidth:60}}>📝 Log</button>
          {completed
            ?<button onClick={()=>onUncomplete(day.date)} style={{padding:"7px 10px",background:"#052e16",border:"1px solid #166534",borderRadius:8,color:"#4ade80",fontSize:11,cursor:"pointer"}}>✓ Hecho</button>
            :<button onClick={()=>onComplete(day.date)} style={{padding:"7px 10px",background:"#1e293b",border:"1px solid #334155",borderRadius:8,color:"#475569",fontSize:11,cursor:"pointer"}}>○ Marcar</button>}
        </div>
      </div>
    </div>
  );
}

function WeekView({weekDays,onComplete,onUncomplete,onLog}){
  const[open,setOpen]=useState(true);
  if(!weekDays.length) return null;
  const{weekNum,phase}=weekDays[0];
  const done=weekDays.filter(d=>d.completed).length;
  // Run km including series warmup/cooldown
  const runKm=weekDays.filter(d=>["easy","long","series"].includes(d.session.type)).reduce((s,d)=>{
    if(d.session.type==="series") return s+(d.session.totalKm||0);
    return s+(d.session.distance||0);
  },0);
  const bikeKm=weekDays.filter(d=>d.session.type==="bike").reduce((s,d)=>s+(d.session.distance||0),0);
  const swimM=weekDays.filter(d=>d.session.type==="swim").reduce((s,d)=>s+(d.session.distanceM||0),0);
  const pct=weekDays.length?Math.round((done/weekDays.length)*100):0;
  return(
    <div style={{marginBottom:14}}>
      <button onClick={()=>setOpen(!open)} style={{width:"100%",background:"#0f172a",border:"1px solid #1e293b",borderRadius:10,padding:"10px 12px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:open?7:0}}>
        <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
          <span style={{fontSize:13,fontWeight:800,color:"#f8fafc"}}>Sem {weekNum}</span>
          <span style={{fontSize:9,fontWeight:700,color:"#818cf8",background:"#818cf822",padding:"2px 6px",borderRadius:5}}>{phase}</span>
          <span style={{fontSize:10,color:"#4ade80"}}>🏃{Math.round(runKm)}km</span>
          {bikeKm>0&&<span style={{fontSize:10,color:"#38bdf8"}}>🚴{Math.round(bikeKm)}km</span>}
          {swimM>0&&<span style={{fontSize:10,color:"#2dd4bf"}}>🏊{swimM}m</span>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:7}}>
          <span style={{fontSize:11,color:done===weekDays.length?"#4ade80":"#64748b"}}>{done}/{weekDays.length}</span>
          <div style={{width:32,height:4,background:"#1e293b",borderRadius:2,overflow:"hidden"}}><div style={{width:`${pct}%`,height:"100%",background:"#6366f1",borderRadius:2}}/></div>
          <span style={{color:"#475569",fontSize:11}}>{open?"▲":"▼"}</span>
        </div>
      </button>
      {open&&weekDays.map(d=><DayCard key={d.date} day={d} onComplete={onComplete} onUncomplete={onUncomplete} onLog={onLog}/>)}
    </div>
  );
}

// ============================================================
// UNASSIGNED TRAY
// ============================================================
function UnassignedTray({unassigned,plan,onAssign,onDismiss,onClose}){
  const[sel,setSel]=useState(null);
  const[target,setTarget]=useState("");
  const selAct=sel!==null?unassigned[sel]:null;
  function compatDays(act){
    const cat=activityCategory(act);
    if(cat==="run") return plan.filter(d=>["easy","long","series","race"].includes(d.session.type));
    if(cat==="bike") return plan.filter(d=>d.session.type==="bike");
    if(cat==="swim") return plan.filter(d=>d.session.type==="swim");
    return[];
  }
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div style={{background:"#0f172a",border:"1px solid #334155",borderRadius:"20px 20px 0 0",width:"100%",maxWidth:600,maxHeight:"85vh",overflowY:"auto",padding:18}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div><div style={{fontSize:15,fontWeight:800,color:"#f8fafc"}}>⚠️ Actividades sin asignar</div><div style={{fontSize:11,color:"#64748b",marginTop:2}}>No coinciden con ningún día del plan</div></div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#64748b",fontSize:22,cursor:"pointer",lineHeight:1}}>✕</button>
        </div>
        {!selAct?unassigned.map((act,i)=>{
          const cat=activityCategory(act),dist=(act.distance/1000).toFixed(1),t=secondsToTime(act.moving_time),p=cat==="run"?speedToPace(act.average_speed):null,d=act.start_date_local?.split("T")[0];
          return(
            <div key={act.id} style={{background:"#1e293b",borderRadius:12,padding:13,marginBottom:8}}>
              <div style={{fontSize:13,fontWeight:700,color:"#f8fafc",marginBottom:2}}>{actIcon(act)} {act.name}</div>
              <div style={{fontSize:11,color:"#64748b",marginBottom:5}}>{d?fmtDate(d):"—"}</div>
              <div style={{fontSize:12,color:"#94a3b8",marginBottom:9}}>📏 {dist}km · ⏱ {t}{p?` · ${p}/km`:""}</div>
              <div style={{display:"flex",gap:7}}>
                <button onClick={()=>{setSel(i);setTarget("");}} style={{flex:1,padding:"8px 0",background:"#6366f122",border:"1px solid #6366f1",borderRadius:8,color:"#818cf8",fontSize:11,fontWeight:700,cursor:"pointer"}}>📅 Asignar</button>
                <button onClick={()=>onDismiss(act.id)} style={{padding:"8px 12px",background:"#1e293b",border:"1px solid #334155",borderRadius:8,color:"#475569",fontSize:11,cursor:"pointer"}}>🗑</button>
              </div>
            </div>
          );
        }):(
          <div>
            <button onClick={()=>setSel(null)} style={{background:"none",border:"none",color:"#6366f1",fontSize:12,cursor:"pointer",marginBottom:10,padding:0}}>← Volver</button>
            <div style={{background:"#1e293b",borderRadius:10,padding:11,marginBottom:14}}>
              <div style={{fontSize:12,fontWeight:700,color:"#f8fafc",marginBottom:3}}>{actIcon(selAct)} {selAct.name}</div>
              <div style={{fontSize:11,color:"#64748b"}}>{(selAct.distance/1000).toFixed(1)}km · {secondsToTime(selAct.moving_time)}</div>
            </div>
            <div style={{fontSize:11,fontWeight:700,color:"#94a3b8",marginBottom:8,letterSpacing:1}}>ELIGE EL DÍA:</div>
            <div style={{maxHeight:300,overflowY:"auto"}}>
              {compatDays(selAct).map(d=>(
                <button key={d.date} onClick={()=>setTarget(d.date)} style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 11px",marginBottom:5,borderRadius:9,cursor:"pointer",background:target===d.date?"#6366f133":"#1e293b",border:target===d.date?"1px solid #6366f1":"1px solid #334155",textAlign:"left"}}>
                  <div><div style={{fontSize:12,fontWeight:700,color:"#f8fafc"}}>{typeIcon(d.session.type)} {d.session.label}</div><div style={{fontSize:10,color:"#64748b",marginTop:1}}>{fmtDate(d.date)}</div></div>
                  <div style={{fontSize:10,color:d.completed?"#4ade80":"#475569"}}>{d.completed?"✓":"○"}</div>
                </button>
              ))}
            </div>
            {target&&<button onClick={()=>{onAssign(selAct,target);setSel(null);}} style={{width:"100%",padding:"13px",marginTop:10,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",borderRadius:11,color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer"}}>✅ Asignar al {fmtDate(target)}</button>}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// STRAVA MANAGER
// ============================================================
function StravaManager({plan,stravaToken,unassigned,onAssign,onDismiss,onSync,syncing,allStravaActivities}){
  const[mode,setMode]=useState("unassigned");
  const[selDay,setSelDay]=useState(null);
  const[selActId,setSelActId]=useState(null);
  const planDays=plan.filter(d=>["easy","long","series","race","bike","swim"].includes(d.session.type));
  function compatActs(day){
    if(!allStravaActivities) return[];
    const cat=day.session.type==="bike"?"bike":day.session.type==="swim"?"swim":"run";
    return allStravaActivities.filter(a=>activityCategory(a)===cat);
  }
  const selDayObj=selDay?plan.find(d=>d.date===selDay):null;
  return(
    <div>
      <div style={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:12,padding:14,marginBottom:14}}>
        <div style={{fontSize:12,fontWeight:700,color:"#f8fafc",marginBottom:9}}>🟠 Estado Strava</div>
        {stravaToken?(
          <div>
            <div style={{fontSize:11,color:"#4ade80",marginBottom:9}}>✅ Conectado como <strong>{stravaToken.athlete?.firstname} {stravaToken.athlete?.lastname}</strong></div>
            <button onClick={onSync} disabled={syncing} style={{width:"100%",padding:"10px",background:"#fc4c0222",border:"1px solid #fc4c02",borderRadius:9,color:"#fc4c02",fontWeight:700,fontSize:12,cursor:"pointer"}}>
              {syncing?"⏳ Sincronizando...":"🔄 Sincronizar actividades"}
            </button>
            {allStravaActivities&&<div style={{fontSize:10,color:"#64748b",textAlign:"center",marginTop:6}}>{allStravaActivities.length} actividades cargadas</div>}
          </div>
        ):(
          <a href={stravaAuthUrl()} style={{display:"block",padding:"10px",background:"#fc4c0222",border:"1px solid #fc4c02",borderRadius:9,color:"#fc4c02",fontWeight:700,fontSize:12,textAlign:"center",textDecoration:"none"}}>🟠 Conectar con Strava</a>
        )}
      </div>
      <div style={{display:"flex",gap:6,marginBottom:14}}>
        <button onClick={()=>setMode("unassigned")} style={{flex:1,padding:"9px 0",borderRadius:8,border:"none",cursor:"pointer",background:mode==="unassigned"?"#f97316":"#1e293b",color:mode==="unassigned"?"#fff":"#64748b",fontSize:11,fontWeight:700}}>⚠️ Sin asignar {unassigned.length>0&&`(${unassigned.length})`}</button>
        <button onClick={()=>setMode("manual")} style={{flex:1,padding:"9px 0",borderRadius:8,border:"none",cursor:"pointer",background:mode==="manual"?"#6366f1":"#1e293b",color:mode==="manual"?"#fff":"#64748b",fontSize:11,fontWeight:700}}>🔗 Manual</button>
      </div>
      {mode==="unassigned"&&(
        unassigned.length===0
          ?<div style={{textAlign:"center",padding:36,color:"#475569",fontSize:12}}>✅ No hay actividades sin asignar</div>
          :unassigned.map((act,i)=>{
            const cat=activityCategory(act),dist=(act.distance/1000).toFixed(1),t=secondsToTime(act.moving_time),p=cat==="run"?speedToPace(act.average_speed):null,d=act.start_date_local?.split("T")[0];
            return(
              <div key={act.id} style={{background:"#1e293b",borderRadius:12,padding:13,marginBottom:8}}>
                <div style={{fontSize:13,fontWeight:700,color:"#f8fafc",marginBottom:2}}>{actIcon(act)} {act.name}</div>
                <div style={{fontSize:11,color:"#64748b",marginBottom:5}}>{d?fmtDate(d):"—"} · {cat}</div>
                <div style={{fontSize:12,color:"#94a3b8",marginBottom:9}}>📏 {dist}km · ⏱ {t}{p?` · ${p}/km`:""}</div>
                <div style={{display:"flex",gap:7}}>
                  <button onClick={()=>{setMode("manual");setSelDay(null);setSelActId(act.id);}} style={{flex:1,padding:"8px 0",background:"#6366f122",border:"1px solid #6366f1",borderRadius:8,color:"#818cf8",fontSize:11,fontWeight:700,cursor:"pointer"}}>📅 Asignar</button>
                  <button onClick={()=>onDismiss(act.id)} style={{padding:"8px 11px",background:"#1e293b",border:"1px solid #334155",borderRadius:8,color:"#475569",fontSize:11,cursor:"pointer"}}>🗑</button>
                </div>
              </div>
            );
          })
      )}
      {mode==="manual"&&(
        <div>
          <div style={{fontSize:11,color:"#64748b",marginBottom:10}}>Elige un día del plan y la actividad de Strava a asociar.</div>
          <div style={{fontSize:10,fontWeight:700,color:"#94a3b8",marginBottom:7,letterSpacing:1}}>1 · DÍA DEL PLAN</div>
          <div style={{maxHeight:200,overflowY:"auto",marginBottom:14}}>
            {planDays.map(d=>(
              <button key={d.date} onClick={()=>{setSelDay(d.date);setSelActId(null);}} style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 11px",marginBottom:4,borderRadius:9,cursor:"pointer",background:selDay===d.date?"#6366f133":"#1e293b",border:selDay===d.date?"1px solid #6366f1":"1px solid #334155",textAlign:"left"}}>
                <div><div style={{fontSize:12,fontWeight:700,color:"#f8fafc"}}>{typeIcon(d.session.type)} {d.session.label}</div><div style={{fontSize:10,color:"#64748b",marginTop:1}}>{fmtDate(d.date)}</div></div>
                <div style={{fontSize:10,color:d.actual?.fromStrava?"#f97316":d.completed?"#4ade80":"#475569"}}>{d.actual?.fromStrava?"🟠":d.completed?"✓":"○"}</div>
              </button>
            ))}
          </div>
          {selDayObj&&(
            <>
              <div style={{fontSize:10,fontWeight:700,color:"#94a3b8",marginBottom:7,letterSpacing:1}}>2 · ACTIVIDAD STRAVA</div>
              {!allStravaActivities?<div style={{fontSize:11,color:"#475569",textAlign:"center",padding:18}}>Sincroniza primero</div>
              :compatActs(selDayObj).length===0?<div style={{fontSize:11,color:"#475569",textAlign:"center",padding:18}}>Sin actividades compatibles</div>
              :compatActs(selDayObj).map(act=>{
                const cat=activityCategory(act),dist=(act.distance/1000).toFixed(1),t=secondsToTime(act.moving_time),p=cat==="run"?speedToPace(act.average_speed):null,d=act.start_date_local?.split("T")[0];
                const isSel=selActId===act.id;
                return(
                  <button key={act.id} onClick={()=>setSelActId(isSel?null:act.id)} style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 11px",marginBottom:4,borderRadius:9,cursor:"pointer",background:isSel?"#4ade8022":"#1e293b",border:isSel?"1px solid #4ade80":"1px solid #334155",textAlign:"left"}}>
                    <div><div style={{fontSize:12,fontWeight:700,color:"#f8fafc"}}>{actIcon(act)} {act.name}</div><div style={{fontSize:10,color:"#64748b",marginTop:1}}>{d?fmtDate(d):"—"}</div></div>
                    <div style={{fontSize:10,color:"#94a3b8",textAlign:"right"}}><div>{dist}km</div><div>{t}</div>{p&&<div>{p}/km</div>}</div>
                  </button>
                );
              })}
              {selActId&&selDay&&(
                <button onClick={()=>{const act=allStravaActivities.find(a=>a.id===selActId);if(act){onAssign(act,selDay);setSelDay(null);setSelActId(null);}}} style={{width:"100%",padding:"13px",marginTop:8,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",borderRadius:11,color:"#fff",fontWeight:700,fontSize:14,cursor:"pointer"}}>✅ Asociar al {fmtDate(selDay)}</button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// APP
// ============================================================
export default function App(){
  const[plan,setPlan]=useState(()=>loadData()||generatePlan());
  const[filterPhase,setFilterPhase]=useState("all");
  const[filterType,setFilterType]=useState("all");
  const[showCompleted,setShowCompleted]=useState(true);
  const[logging,setLogging]=useState(null);
  const[view,setView]=useState("calendar");
  const[stravaToken,setStravaToken]=useState(()=>loadToken());
  const[syncing,setSyncing]=useState(false);
  const[syncMsg,setSyncMsg]=useState("");
  const[unassigned,setUnassigned]=useState(()=>loadUA());
  const[showTray,setShowTray]=useState(false);
  const[allActivities,setAllActivities]=useState(null);

  useEffect(()=>{saveData(plan);},[plan]);
  useEffect(()=>{if(stravaToken)saveToken(stravaToken);},[stravaToken]);
  useEffect(()=>{saveUA(unassigned);},[unassigned]);

  useEffect(()=>{
    const p=new URLSearchParams(window.location.search),code=p.get("code");
    if(code){exchangeToken(code).then(data=>{if(data.access_token){setStravaToken(data);window.history.replaceState({},"","/");setSyncMsg("✅ Strava conectado");setTimeout(()=>setSyncMsg(""),4000);}});}
  },[]);

  async function syncStrava(){
    if(!stravaToken) return;
    setSyncing(true);setSyncMsg("Sincronizando...");
    try{
      let token=stravaToken;
      if(Date.now()/1000>token.expires_at-300){const r=await refreshStravaToken(token.refresh_token);if(r.access_token){token={...token,...r};setStravaToken(token);}}
      const acts=await fetchStravaActivities(token.access_token);
      if(Array.isArray(acts)){
        setAllActivities(acts);
        const{matched,unassigned:ua}=matchActivitiesToPlan(acts,plan);
        setPlan(matched);
        setUnassigned(prev=>{const ids=new Set(prev.map(a=>a.id));return[...prev,...ua.filter(a=>!ids.has(a.id))];});
        setSyncMsg(`✅ ${acts.length} actividades · ${ua.length} sin asignar`);
        if(ua.length>0) setTimeout(()=>setShowTray(true),1500);
      }else setSyncMsg("⚠️ Error Strava");
    }catch(e){setSyncMsg("⚠️ Error de conexión");}
    setSyncing(false);setTimeout(()=>setSyncMsg(""),5000);
  }

  function handleAssign(act,targetDate){
    setPlan(prev=>prev.map(d=>d.date===targetDate?{...d,completed:true,actual:buildActualFromActivity(act)}:d));
    setUnassigned(prev=>prev.filter(a=>a.id!==act.id));
    if(unassigned.length<=1)setShowTray(false);
  }
  function handleDismiss(id){setUnassigned(prev=>prev.filter(a=>a.id!==id));if(unassigned.length<=1)setShowTray(false);}
  function markComplete(date){setPlan(p=>p.map(d=>d.date===date?{...d,completed:true}:d));}
  function markUncomplete(date){setPlan(p=>p.map(d=>d.date===date?{...d,completed:false}:d));}
  function saveLog(form){setPlan(p=>p.map(d=>d.date===logging.date?{...d,completed:true,actual:form}:d));setLogging(null);}

  const phases=["all","Base 1","Base 2","Desarrollo","Específico","Pico","Taper"];
  const types=["all","easy","series","long","gym","bike","swim","race","rest"];

  const filtered=useMemo(()=>plan.filter(d=>{
    if(!showCompleted&&d.completed) return false;
    if(filterPhase!=="all"&&d.phase!==filterPhase) return false;
    if(filterType!=="all"&&d.session.type!==filterType) return false;
    return true;
  }),[plan,filterPhase,filterType,showCompleted]);

  const weeks=useMemo(()=>{
    const map={};
    filtered.forEach(d=>{if(!map[d.weekNum])map[d.weekNum]=[];map[d.weekNum].push(d);});
    return Object.entries(map).map(([wk,days])=>({weekNum:parseInt(wk),days}));
  },[filtered]);

  const today=new Date().toISOString().split("T")[0];
  const todayPlan=plan.find(d=>d.date===today);
  const daysLeft=Math.max(0,Math.floor((new Date("2026-09-27")-new Date())/86400000));
  const navItems=[["calendar","📅","Plan"],["stats","📊","Stats"],["strava","🟠","Strava"],["race","🏁","Carrera"]];

  return(
    <div style={{minHeight:"100vh",background:"#020817",color:"#f8fafc",fontFamily:"system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",paddingBottom:90}}>
      <style>{`
        html,body{margin:0;padding:0;width:100%;overflow-x:hidden;}
        *{box-sizing:border-box;-webkit-text-size-adjust:100%;text-size-adjust:100%;}
        ::-webkit-scrollbar{width:3px;}
        ::-webkit-scrollbar-thumb{background:#1e293b;border-radius:2px;}
        button,a{-webkit-tap-highlight-color:transparent;touch-action:manipulation;}
        input,textarea,select{font-size:16px!important;-webkit-appearance:none;}
        img{max-width:100%;}
      `}</style>

      {/* STICKY HEADER */}
      <div style={{background:"linear-gradient(180deg,#0d1b35 0%,#020817 100%)",borderBottom:"1px solid #1e293b",padding:"env(safe-area-inset-top,12px) 14px 12px",position:"sticky",top:0,zIndex:50,width:"100%"}}>
        <div style={{maxWidth:560,margin:"0 auto"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div>
              <div style={{fontSize:10,letterSpacing:3,color:"#6366f1",fontWeight:700,marginBottom:1}}>🏃 MEDIA MARATÓN</div>
              <div style={{fontSize:17,fontWeight:800,lineHeight:1.2}}>Valladolid <span style={{color:"#6366f1"}}>27/09/26</span></div>
              <div style={{fontSize:11,color:"#475569",marginTop:1}}>Objetivo: <span style={{color:"#fbbf24",fontWeight:700}}>sub 1:30:00</span></div>
            </div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:5}}>
              <div style={{background:"#6366f111",border:"1px solid #6366f133",borderRadius:10,padding:"6px 11px",textAlign:"center",minWidth:52}}>
                <div style={{fontSize:20,fontWeight:800,color:"#818cf8",lineHeight:1}}>{daysLeft}</div>
                <div style={{fontSize:8,color:"#475569",letterSpacing:1}}>DÍAS</div>
              </div>
              <div style={{display:"flex",gap:4,alignItems:"center",flexWrap:"wrap",justifyContent:"flex-end"}}>
                {stravaToken?(
                  <>
                    {unassigned.length>0&&<button onClick={()=>setShowTray(true)} style={{padding:"5px 7px",background:"#fbbf2422",border:"1px solid #fbbf24",borderRadius:7,color:"#fbbf24",fontSize:10,fontWeight:700,cursor:"pointer"}}>⚠️{unassigned.length}</button>}
                    <button onClick={syncStrava} disabled={syncing} style={{padding:"5px 8px",background:"#fc4c0211",border:"1px solid #fc4c02",borderRadius:7,color:"#fc4c02",fontSize:10,fontWeight:700,cursor:"pointer"}}>{syncing?"⏳":"🔄"}</button>
                    <button onClick={()=>{setStravaToken(null);localStorage.removeItem(STK);}} style={{padding:"5px 7px",background:"#1e293b",border:"1px solid #334155",borderRadius:7,color:"#64748b",fontSize:10,cursor:"pointer"}}>✕</button>
                  </>
                ):(
                  <a href={stravaAuthUrl()} style={{padding:"5px 9px",background:"#fc4c0222",border:"1px solid #fc4c02",borderRadius:7,color:"#fc4c02",fontSize:10,fontWeight:700,textDecoration:"none"}}>🟠 Strava</a>
                )}
              </div>
            </div>
          </div>
          {syncMsg&&<div style={{background:"#1e293b",borderRadius:8,padding:"6px 11px",fontSize:11,color:"#94a3b8",marginBottom:8,textAlign:"center"}}>{syncMsg}</div>}
          <div style={{display:"flex",gap:5}}>
            {navItems.map(([v,icon,label])=>(
              <button key={v} onClick={()=>setView(v)} style={{flex:1,padding:"7px 2px",borderRadius:8,border:"none",cursor:"pointer",background:view===v?"#6366f1":"#1e293b",color:view===v?"#fff":"#64748b",display:"flex",flexDirection:"column",alignItems:"center",gap:1}}>
                <span style={{fontSize:14}}>{icon}</span>
                <span style={{fontSize:8,letterSpacing:0.5,fontWeight:700}}>{label.toUpperCase()}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{maxWidth:560,margin:"0 auto",padding:"13px 13px"}}>

        {todayPlan&&view==="calendar"&&(
          <div style={{background:"linear-gradient(135deg,#1e1b4b 0%,#0f172a 100%)",border:"1px solid #4f46e5",borderRadius:14,padding:"12px 13px",marginBottom:13}}>
            <div style={{fontSize:9,letterSpacing:2,color:"#6366f1",fontWeight:700,marginBottom:5}}>HOY · {fmtDate(todayPlan.date)}</div>
            <DayCard day={todayPlan} onComplete={markComplete} onUncomplete={markUncomplete} onLog={setLogging}/>
          </div>
        )}

        {view==="calendar"&&(
          <>
            <StatsPanel plan={plan}/>
            {unassigned.length>0&&(
              <button onClick={()=>setShowTray(true)} style={{width:"100%",background:"#fbbf2411",border:"1px solid #fbbf24",borderRadius:12,padding:"10px 13px",marginBottom:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div style={{textAlign:"left"}}><div style={{fontSize:13,fontWeight:700,color:"#fbbf24"}}>⚠️ {unassigned.length} actividad{unassigned.length>1?"es":""} sin asignar</div><div style={{fontSize:10,color:"#92400e",marginTop:1}}>Pulsa para asignarlas</div></div>
                <span style={{color:"#fbbf24",fontSize:18}}>›</span>
              </button>
            )}
            <div style={{marginBottom:11}}>
              <div style={{display:"flex",gap:5,overflowX:"auto",paddingBottom:3,marginBottom:6,WebkitOverflowScrolling:"touch"}}>
                {phases.map(p=><button key={p} onClick={()=>setFilterPhase(p)} style={{whiteSpace:"nowrap",padding:"5px 9px",borderRadius:7,border:"none",cursor:"pointer",background:filterPhase===p?"#6366f1":"#1e293b",color:filterPhase===p?"#fff":"#64748b",fontSize:10,fontWeight:700,flexShrink:0}}>{p==="all"?"Todas":p}</button>)}
              </div>
              <div style={{display:"flex",gap:5,overflowX:"auto",paddingBottom:3,marginBottom:6,WebkitOverflowScrolling:"touch"}}>
                {types.map(t=><button key={t} onClick={()=>setFilterType(t)} style={{whiteSpace:"nowrap",padding:"5px 9px",borderRadius:7,border:filterType===t?`1px solid ${typeColor(t)}`:"1px solid transparent",cursor:"pointer",background:filterType===t?typeColor(t)+"44":"#1e293b",color:filterType===t?typeColor(t):"#64748b",fontSize:10,fontWeight:700,flexShrink:0}}>{typeIcon(t)} {t==="all"?"Todo":t}</button>)}
              </div>
              <label style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:"#64748b",cursor:"pointer"}}>
                <input type="checkbox" checked={showCompleted} onChange={e=>setShowCompleted(e.target.checked)}/> Mostrar completados
              </label>
            </div>
            {weeks.map(({weekNum,days})=><WeekView key={weekNum} weekDays={days} onComplete={markComplete} onUncomplete={markUncomplete} onLog={setLogging}/>)}
          </>
        )}

        {view==="stats"&&(
          <div>
            <StatsPanel plan={plan}/>
            <div style={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:12,padding:14,marginBottom:12}}>
              <div style={{fontSize:12,fontWeight:700,color:"#f8fafc",marginBottom:11}}>Progreso por tipo</div>
              {["easy","long","series","gym","bike","swim"].map(type=>{
                const tot=plan.filter(d=>d.session.type===type).length;
                const dn=plan.filter(d=>d.session.type===type&&d.completed).length;
                if(!tot) return null;
                return(<div key={type} style={{marginBottom:9}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:11,color:"#94a3b8"}}>{typeIcon(type)} {type}</span><span style={{fontSize:11,color:typeColor(type)}}>{dn}/{tot}</span></div>
                  <div style={{height:4,background:"#1e293b",borderRadius:2}}><div style={{height:"100%",width:`${Math.round((dn/tot)*100)}%`,background:typeColor(type),borderRadius:2}}/></div>
                </div>);
              })}
            </div>
            <div style={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:12,padding:14}}>
              <div style={{fontSize:12,fontWeight:700,color:"#f8fafc",marginBottom:11}}>Referencias de ritmo</div>
              {[{l:"HM Madrid 26 Abr",v:"1:31:48",s:"4:21/km"},{l:"10k Familias",v:"40:04",s:"4:00/km"},{l:"Objetivo Valladolid",v:"< 1:30:00",s:"4:15/km",hl:true},{l:"Series objetivo",v:"3:55–4:05/km",s:"VO2max"},{l:"Umbral",v:"4:15–4:25/km",s:"Tempo"},{l:"Rodaje fácil",v:"5:40–6:10/km",s:"Z2"}].map(r=>(
                <div key={r.l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid #1e293b"}}>
                  <span style={{fontSize:11,color:"#94a3b8"}}>{r.l}</span>
                  <div style={{textAlign:"right"}}><div style={{fontSize:12,fontWeight:700,color:r.hl?"#fbbf24":"#f8fafc"}}>{r.v}</div><div style={{fontSize:9,color:"#475569"}}>{r.s}</div></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view==="strava"&&(
          <StravaManager plan={plan} stravaToken={stravaToken} unassigned={unassigned} onAssign={handleAssign} onDismiss={handleDismiss} onSync={syncStrava} syncing={syncing} allStravaActivities={allActivities}/>
        )}

        {view==="race"&&(
          <div>
            <div style={{background:"linear-gradient(135deg,#1c1917 0%,#0f172a 100%)",border:"1px solid #fbbf2433",borderRadius:16,padding:16,marginBottom:13}}>
              <div style={{fontSize:9,letterSpacing:3,color:"#fbbf24",fontWeight:700,marginBottom:5}}>🏆 27 SEPT 2026</div>
              <div style={{fontSize:16,fontWeight:800,marginBottom:3}}>Media Maratón Valladolid</div>
              <div style={{fontSize:11,color:"#94a3b8",marginBottom:13}}>Recorrido plano · Sub 1:30:00</div>
              {[{km:"0–5",pace:"4:20/km",time:"~21:40",note:"Salida controlada"},{km:"5–10",pace:"4:16/km",time:"~21:20",note:"Ritmo objetivo"},{km:"10–18",pace:"4:12/km",time:"~33:36",note:"Mantén"},{km:"18–21.1",pace:"4:05/km",time:"~12:42",note:"¡A fondo!"}].map(s=>(
                <div key={s.km} style={{display:"flex",alignItems:"center",gap:9,padding:"7px 0",borderBottom:"1px solid #1e293b"}}>
                  <div style={{minWidth:46,fontSize:9,fontWeight:700,color:"#fbbf24",background:"#fbbf2411",padding:"2px 5px",borderRadius:5,textAlign:"center"}}>km {s.km}</div>
                  <div style={{flex:1}}><div style={{fontSize:12,fontWeight:700}}>{s.pace}</div><div style={{fontSize:10,color:"#64748b"}}>{s.note}</div></div>
                  <div style={{fontSize:10,color:"#94a3b8"}}>{s.time}</div>
                </div>
              ))}
              <div style={{background:"#1e293b",borderRadius:9,padding:11,marginTop:13,marginBottom:9}}>
                <div style={{fontSize:10,fontWeight:700,color:"#38bdf8",marginBottom:4}}>🍌 DÍA ANTES</div>
                <div style={{fontSize:11,color:"#94a3b8",lineHeight:1.7}}>· Pasta o arroz, nada nuevo<br/>· Hidratación extra todo el día<br/>· Paseo 15–20min<br/>· En cama a las 22:30</div>
              </div>
              <div style={{background:"#1e293b",borderRadius:9,padding:11}}>
                <div style={{fontSize:10,fontWeight:700,color:"#4ade80",marginBottom:4}}>☀️ DÍA DE CARRERA</div>
                <div style={{fontSize:11,color:"#94a3b8",lineHeight:1.7}}>· Desayuno 3h antes: avena + plátano + café<br/>· Gel + agua en km 7 y km 14<br/>· Hidratación en TODOS los avituallamientos<br/>· Calentamiento 15min<br/>· Ropa y zapatillas ya probadas</div>
              </div>
            </div>
            <div style={{background:"#0f172a",border:"1px solid #1e293b",borderRadius:12,padding:14}}>
              <div style={{fontSize:12,fontWeight:700,color:"#f8fafc",marginBottom:9}}>📈 Progresión prevista</div>
              <div style={{fontSize:11,color:"#64748b",lineHeight:1.8}}>Umbral actual ~4:18–4:22/km. Necesitas 4:15/km para bajar de 1:30.<br/><br/>Con este plan:<br/>· Carrera: 45 → 68km/semana → taper<br/>· Series progresivas para bajar VMA<br/>· Fuerza + bici para economía de carrera<br/>· Natación para recuperación activa<br/><br/>Mejora esperada: <strong style={{color:"#4ade80"}}>1:28:30–1:29:30</strong> 🎯</div>
            </div>
          </div>
        )}
      </div>

      {logging&&<ActualForm day={logging} onSave={saveLog} onClose={()=>setLogging(null)}/>}
      {showTray&&unassigned.length>0&&<UnassignedTray unassigned={unassigned} plan={plan} onAssign={handleAssign} onDismiss={handleDismiss} onClose={()=>setShowTray(false)}/>}
      <div style={{height:20}}/>
    </div>
  );
}