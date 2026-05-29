import { useState, useEffect, useMemo } from "react";

// ============================================================
// STRAVA CONFIG
// ============================================================
const STRAVA_CLIENT_ID = "253017";
const STRAVA_REDIRECT = "https://valladolid-hm-zuqu.vercel.app";
const STRAVA_SCOPE = "activity:read_all";

function stravaAuthUrl() {
  return `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&redirect_uri=${encodeURIComponent(STRAVA_REDIRECT)}&response_type=code&scope=${STRAVA_SCOPE}`;
}

async function exchangeToken(code) {
  const r = await fetch(`/api/strava?action=token&code=${code}`);
  return r.json();
}

async function fetchStravaActivities(access_token) {
  const r = await fetch(`/api/strava?action=activities&access_token=${access_token}`);
  return r.json();
}

async function refreshStravaToken(refresh_token) {
  const r = await fetch(`/api/strava?action=refresh&refresh_token=${refresh_token}`);
  return r.json();
}

// Convierte segundos a mm:ss o h:mm:ss
function secondsToTime(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

// Convierte m/s a ritmo mm:ss/km
function speedToPace(mps) {
  if (!mps || mps === 0) return "—";
  const secPerKm = 1000 / mps;
  const m = Math.floor(secPerKm / 60);
  const s = Math.floor(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ============================================================
// PLAN GENERATOR
// ============================================================
function generatePlan() {
  const start = new Date("2026-06-01");
  const raceDay = new Date("2026-09-27");
  const days = [];

  const pace = {
    easy: "5:40–6:10 /km",
    tempo: "4:15–4:25 /km",
    threshold: "4:20–4:30 /km",
    marathon: "4:16 /km",
    race: "4:12–4:15 /km",
    recovery: "6:00–6:30 /km",
    fast: "3:55–4:05 /km",
    vo2: "3:50–4:00 /km",
  };

  const gym = {
    base: {
      label: "Fuerza Base",
      exercises: [
        { name: "Sentadilla", sets: 3, reps: 8, kg: 40 },
        { name: "Press banca", sets: 3, reps: 8, kg: 40 },
        { name: "Peso muerto rumano", sets: 3, reps: 10, kg: 35 },
        { name: "Zancadas", sets: 3, reps: 10, kg: 20 },
        { name: "Plancha", sets: 3, reps: 1, duration: "45s" },
        { name: "Elevaciones gemelos", sets: 3, reps: 15, kg: 0 },
      ],
    },
    mid: {
      label: "Fuerza Media",
      exercises: [
        { name: "Sentadilla", sets: 4, reps: 6, kg: 50 },
        { name: "Press banca", sets: 4, reps: 6, kg: 50 },
        { name: "Peso muerto", sets: 3, reps: 6, kg: 55 },
        { name: "Hip thrust", sets: 3, reps: 10, kg: 40 },
        { name: "Plancha lateral", sets: 3, reps: 1, duration: "40s c/lado" },
        { name: "Step-up", sets: 3, reps: 10, kg: 15 },
      ],
    },
    specific: {
      label: "Fuerza Específica Corredor",
      exercises: [
        { name: "Sentadilla búlgara", sets: 3, reps: 8, kg: 20 },
        { name: "Press banca", sets: 3, reps: 8, kg: 52 },
        { name: "Peso muerto", sets: 3, reps: 6, kg: 60 },
        { name: "Hip thrust", sets: 3, reps: 12, kg: 50 },
        { name: "Core: dead bug", sets: 3, reps: 10, kg: 0 },
        { name: "Gemelos en máquina", sets: 4, reps: 15, kg: 30 },
      ],
    },
    taper: {
      label: "Fuerza Mantenimiento (Taper)",
      exercises: [
        { name: "Sentadilla", sets: 2, reps: 8, kg: 45 },
        { name: "Press banca", sets: 2, reps: 8, kg: 45 },
        { name: "Hip thrust", sets: 2, reps: 10, kg: 40 },
        { name: "Plancha", sets: 2, reps: 1, duration: "40s" },
      ],
    },
  };

  const seriesTemplates = [
    "6x1000m r:90s (ritmo 4:00–4:05)",
    "5x1200m r:2min (ritmo 4:00–4:05)",
    "8x800m r:75s (ritmo 3:55–4:00)",
    "Rodaje suave 8km (sin series - semana recuperación)",
    "5x1600m r:2min (ritmo 4:10–4:15)",
    "6x1200m r:90s (ritmo 3:58–4:03)",
    "4x2000m r:2:30min (ritmo 4:10–4:15)",
    "3x3000m r:3min (ritmo 4:12–4:18)",
    "10x600m r:60s (ritmo 3:48–3:53)",
    "5x2000m r:2min (ritmo 4:08–4:13)",
    "3x4000m r:3min (ritmo 4:10–4:14)",
    "Tempo continuo 6km (ritmo 4:18–4:22)",
    "4x3000m r:2:30min (ritmo 4:07–4:12)",
    "Rodaje mixto: 5km fácil + 5km ritmo maratón",
    "3x2000m r:2min (ritmo 4:05–4:10) + 6x400m r:60s (ritmo 3:45)",
    "4x1600m r:2min (ritmo 4:08–4:13)",
    "3x1000m r:90s (ritmo 4:00) + 3x500m r:60s (ritmo 3:45)",
  ];

  let seriesIdx = 0;
  const cur = new Date(start);

  while (cur <= raceDay) {
    const dow = cur.getDay();
    const dateStr = cur.toISOString().split("T")[0];
    const daysSinceStart = Math.floor((cur - start) / 86400000);
    const weekNum = Math.floor(daysSinceStart / 7) + 1;

    let phase = "Base 1";
    let longRunKm = 16;
    let isRecoveryWeek = false;

    if (weekNum <= 3) { phase = "Base 1"; longRunKm = [16, 17, 18][weekNum - 1]; }
    else if (weekNum <= 6) { phase = "Base 2"; longRunKm = [13, 18, 20][weekNum - 4]; isRecoveryWeek = weekNum === 4; }
    else if (weekNum <= 10) { phase = "Desarrollo"; longRunKm = [14, 20, 21, 18][weekNum - 7]; isRecoveryWeek = weekNum === 10; }
    else if (weekNum <= 14) { phase = "Específico"; longRunKm = [18, 21, 22, 16][weekNum - 11]; isRecoveryWeek = weekNum === 14; }
    else if (weekNum <= 16) { phase = "Pico"; longRunKm = [21, 18][weekNum - 15]; }
    else { phase = "Taper"; longRunKm = 13; }

    const isTaperWeek = weekNum === 17;
    const isRaceDay = dateStr === "2026-09-27";
    const swimAvailable = cur >= new Date("2026-06-15");

    let session = null;

    if (isRaceDay) {
      session = {
        type: "race",
        label: "🏆 MEDIA MARATÓN VALLADOLID",
        description: "¡El gran día! Objetivo: sub 1:30:00",
        detail: "Salida controlada 4:20/km los primeros 5km. Del km 5–10 baja a 4:16/km. Del km 10–18 mantén 4:12–4:15/km. Últimos 3km a fondo.",
        distance: 21.1,
        targetTime: "1:28:30–1:30:00",
      };
    } else if (dow === 1) {
      const easyKm = isRecoveryWeek ? 8 : (weekNum <= 3 ? 10 : weekNum <= 6 ? 11 : weekNum <= 10 ? 12 : weekNum <= 14 ? 13 : isTaperWeek ? 8 : 12);
      session = {
        type: "easy",
        label: "Rodaje suave",
        distance: easyKm,
        pace: isRecoveryWeek ? pace.recovery : pace.easy,
        duration: `${Math.round(easyKm * 5.8)}–${Math.round(easyKm * 6.2)} min`,
        detail: "Ritmo conversacional. FC < 140 ppm. Ideal para activar piernas sin acumular fatiga.",
      };
    } else if (dow === 2) {
      const gymType = weekNum <= 4 ? "base" : weekNum <= 10 ? "mid" : isTaperWeek ? "taper" : "specific";
      session = {
        type: "gym",
        label: "Gimnasio",
        gymType,
        gymData: gym[gymType],
        detail: "Calentamiento 10 min cardiovascular suave. Estiramientos al final 10 min.",
      };
    } else if (dow === 3) {
      const sIdx = Math.min(seriesIdx, seriesTemplates.length - 1);
      const warmCoolKm = weekNum <= 6 ? 2 : 3;
      session = {
        type: "series",
        label: "Series / Calidad",
        seriesDescription: seriesTemplates[sIdx],
        warmup: `${warmCoolKm}km calentamiento ${pace.easy}`,
        cooldown: `${warmCoolKm}km vuelta a la calma ${pace.recovery}`,
        totalKm: weekNum <= 6 ? 10 : 14,
        detail: `Calentamiento + ${seriesTemplates[sIdx]} + Enfriamiento. Total aprox ${weekNum <= 6 ? 10 : 14}km`,
      };
      seriesIdx++;
    } else if (dow === 4) {
      if (swimAvailable) {
        session = {
          type: "swim",
          label: "Natación",
          detail: "1500–2000m en piscina. Estilo crol. Series de 100m con 20s descanso.",
          distance: 1500 + Math.min((weekNum - 3) * 100, 1000),
        };
      } else {
        session = { type: "rest", label: "Descanso activo", detail: "Movilidad y estiramientos 20 min. Foam roller si tienes." };
      }
    } else if (dow === 5) {
      const bikeKm = isRecoveryWeek ? 40 : (weekNum <= 6 ? 50 : weekNum <= 12 ? 65 : isTaperWeek ? 35 : 55);
      session = {
        type: "bike",
        label: "Bicicleta",
        distance: bikeKm,
        detail: `${bikeKm}km en bici. Ritmo cómodo–moderado. Zona 2 principalmente (FC 130–150).`,
        duration: `${Math.round(bikeKm * 2.5)}–${Math.round(bikeKm * 3)} min`,
      };
    } else if (dow === 6) {
      const isGymSat = weekNum % 2 === 0;
      if (isGymSat) {
        const gymType = weekNum <= 4 ? "base" : weekNum <= 10 ? "mid" : isTaperWeek ? "taper" : "specific";
        session = { type: "gym", label: "Gimnasio", gymType, gymData: gym[gymType], detail: "Segunda sesión de fuerza semanal." };
      } else {
        const easyKm = Math.round(longRunKm * 0.55);
        session = { type: "easy", label: "Rodaje medio", distance: easyKm, pace: pace.easy, duration: `${Math.round(easyKm * 5.7)}–${Math.round(easyKm * 6.1)} min`, detail: "Rodaje de apoyo, sin forzar." };
      }
    } else if (dow === 0) {
      session = {
        type: "long",
        label: isTaperWeek ? "Rodaje largo (taper)" : "Rodaje largo",
        distance: isTaperWeek ? 13 : longRunKm,
        pace: isRecoveryWeek ? pace.recovery : pace.easy,
        detail: isRecoveryWeek
          ? `Rodaje largo ligero ${longRunKm}km a ${pace.recovery}.`
          : `${longRunKm}km. Primeros 2/3 a ${pace.easy}. Últimos ${Math.round(longRunKm * 0.25)}km a ${pace.marathon}.`,
        includes: isRecoveryWeek ? null : `Últimos ${Math.round(longRunKm * 0.25)}km a ritmo objetivo (4:15–4:20/km)`,
      };
    }

    if (session) {
      days.push({ date: dateStr, weekNum, phase, dayOfWeek: dow, session, completed: false, actual: null });
    }

    cur.setDate(cur.getDate() + 1);
  }

  return days;
}

// ============================================================
// STORAGE
// ============================================================
const STORAGE_KEY = "hm_valladolid_2026";
const STRAVA_TOKEN_KEY = "strava_token";

function loadData() {
  try { const s = localStorage.getItem(STORAGE_KEY); if (s) return JSON.parse(s); } catch (e) {}
  return null;
}
function saveData(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
}
function loadStravaToken() {
  try { const s = localStorage.getItem(STRAVA_TOKEN_KEY); if (s) return JSON.parse(s); } catch (e) {}
  return null;
}
function saveStravaToken(token) {
  try { localStorage.setItem(STRAVA_TOKEN_KEY, JSON.stringify(token)); } catch (e) {}
}

// ============================================================
// HELPERS
// ============================================================
const DOW_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTH_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function formatDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return `${DOW_ES[d.getDay()]} ${d.getDate()} ${MONTH_ES[d.getMonth()]}`;
}
function typeColor(type) {
  return { easy: "#4ade80", series: "#f97316", long: "#818cf8", gym: "#e879f9", bike: "#38bdf8", swim: "#2dd4bf", race: "#fbbf24", rest: "#94a3b8" }[type] || "#94a3b8";
}
function typeIcon(type) {
  return { easy: "🏃", series: "⚡", long: "🛤️", gym: "🏋️", bike: "🚴", swim: "🏊", race: "🏆", rest: "💤" }[type] || "📋";
}

// ============================================================
// STRAVA SYNC
// ============================================================
function matchActivityToPlan(activities, plan) {
  const updated = [...plan];
  const runTypes = ["Run", "TrailRun", "VirtualRun"];
  const bikeTypes = ["Ride", "VirtualRide", "EBikeRide"];
  const swimTypes = ["Swim"];

  activities.forEach(act => {
    const actDate = act.start_date_local?.split("T")[0];
    if (!actDate) return;

    const dayIdx = updated.findIndex(d => d.date === actDate);
    if (dayIdx === -1) return;

    const day = updated[dayIdx];
    const stype = day.session.type;

    const isRun = runTypes.includes(act.type) && ["easy", "long", "series", "race"].includes(stype);
    const isBike = bikeTypes.includes(act.type) && stype === "bike";
    const isSwim = swimTypes.includes(act.type) && stype === "swim";

    if (isRun || isBike || isSwim) {
      const distKm = (act.distance / 1000).toFixed(2);
      const timeStr = secondsToTime(act.moving_time);
      const paceStr = isRun ? speedToPace(act.average_speed) : null;

      updated[dayIdx] = {
        ...day,
        completed: true,
        actual: {
          ...day.actual,
          distance: distKm,
          duration: timeStr,
          pace: paceStr || day.actual?.pace || "",
          stravaId: act.id,
          stravaName: act.name,
          fromStrava: true,
        },
      };
    }
  });

  return updated;
}

// ============================================================
// COMPONENTS
// ============================================================
function GymCard({ gymData }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "#e879f9", marginBottom: 8 }}>{gymData.label.toUpperCase()}</div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ color: "#64748b" }}>
            <th style={{ textAlign: "left", paddingBottom: 4, fontWeight: 600 }}>Ejercicio</th>
            <th style={{ textAlign: "center", paddingBottom: 4, fontWeight: 600 }}>Series</th>
            <th style={{ textAlign: "center", paddingBottom: 4, fontWeight: 600 }}>Reps</th>
            <th style={{ textAlign: "center", paddingBottom: 4, fontWeight: 600 }}>Kg</th>
          </tr>
        </thead>
        <tbody>
          {gymData.exercises.map((ex, i) => (
            <tr key={i} style={{ borderTop: "1px solid #1e293b" }}>
              <td style={{ padding: "5px 0", color: "#e2e8f0" }}>{ex.name}</td>
              <td style={{ textAlign: "center", color: "#94a3b8" }}>{ex.sets}</td>
              <td style={{ textAlign: "center", color: "#94a3b8" }}>{ex.duration || ex.reps}</td>
              <td style={{ textAlign: "center", color: ex.kg > 0 ? "#e879f9" : "#475569" }}>{ex.kg > 0 ? `${ex.kg}kg` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const labelStyle = { display: "block", fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 4, marginTop: 12, letterSpacing: 1 };
const inputStyle = { width: "100%", padding: "10px 12px", background: "#1e293b", border: "1px solid #334155", borderRadius: 8, color: "#f1f5f9", fontSize: 13, boxSizing: "border-box", outline: "none" };

function ActualForm({ day, onSave, onClose }) {
  const [form, setForm] = useState(day.actual || { distance: "", duration: "", pace: "", notes: "", gymWeights: {} });
  const isGym = day.session.type === "gym";
  const exercises = day.session.gymData?.exercises || [];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 16, padding: 24, width: "100%", maxWidth: 400, maxHeight: "80vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#f8fafc" }}>{typeIcon(day.session.type)} Registrar actividad</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 18 }}>✕</button>
        </div>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>{formatDate(day.date)} — {day.session.label}</div>

        {day.actual?.fromStrava && (
          <div style={{ background: "#0c2a1a", border: "1px solid #166534", borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 11, color: "#4ade80" }}>
            🟠 Importado de Strava: <strong>{day.actual.stravaName}</strong>
          </div>
        )}

        {!isGym && (
          <>
            <label style={labelStyle}>Distancia real (km)</label>
            <input style={inputStyle} type="number" step="0.1" value={form.distance} onChange={e => setForm(f => ({ ...f, distance: e.target.value }))} placeholder={day.session.distance || "—"} />
            <label style={labelStyle}>Tiempo real (ej: 58:30)</label>
            <input style={inputStyle} type="text" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} placeholder="mm:ss o h:mm:ss" />
            <label style={labelStyle}>Ritmo medio real (/km)</label>
            <input style={inputStyle} type="text" value={form.pace} onChange={e => setForm(f => ({ ...f, pace: e.target.value }))} placeholder="5:42" />
          </>
        )}

        {isGym && exercises.map(ex => (
          <div key={ex.name} style={{ marginBottom: 10 }}>
            <label style={labelStyle}>{ex.name} (kg reales)</label>
            <input style={inputStyle} type="number" step="2.5" value={form.gymWeights[ex.name] || ""} onChange={e => setForm(f => ({ ...f, gymWeights: { ...f.gymWeights, [ex.name]: e.target.value } }))} placeholder={ex.kg > 0 ? `Objetivo: ${ex.kg}kg` : "—"} />
          </div>
        ))}

        <label style={labelStyle}>Notas</label>
        <textarea style={{ ...inputStyle, height: 70, resize: "vertical" }} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Sensaciones, incidencias..." />
        <button onClick={() => onSave(form)} style={{ width: "100%", padding: "12px", marginTop: 12, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none", borderRadius: 10, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          💾 Guardar entrenamiento
        </button>
      </div>
    </div>
  );
}

function DayCard({ day, onComplete, onUncomplete, onLog }) {
  const { session, completed, actual } = day;
  const color = typeColor(session.type);
  const isToday = day.date === new Date().toISOString().split("T")[0];

  return (
    <div style={{ background: completed ? "#0a1628" : "#0f172a", border: `1px solid ${isToday ? color : completed ? "#1e3a5f" : "#1e293b"}`, borderLeft: `3px solid ${color}`, borderRadius: 12, padding: "14px 16px", marginBottom: 8, opacity: completed ? 0.75 : 1, position: "relative" }}>
      {isToday && <div style={{ position: "absolute", top: -8, right: 12, background: color, color: "#000", fontSize: 9, fontWeight: 800, padding: "2px 8px", borderRadius: 10, letterSpacing: 1 }}>HOY</div>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 14 }}>{typeIcon(session.type)}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#f8fafc" }}>{session.label}</span>
            <span style={{ fontSize: 9, fontWeight: 700, background: color + "22", color, padding: "2px 6px", borderRadius: 6, letterSpacing: 1 }}>{session.type.toUpperCase()}</span>
            {actual?.fromStrava && <span style={{ fontSize: 9, fontWeight: 700, background: "#f9731622", color: "#f97316", padding: "2px 6px", borderRadius: 6 }}>STRAVA</span>}
          </div>
          <div style={{ fontSize: 11, color: "#64748b", marginBottom: 6 }}>{formatDate(day.date)}</div>
          {session.distance && <div style={{ fontSize: 12, color: "#94a3b8" }}>📏 <strong style={{ color: "#e2e8f0" }}>{session.distance} km</strong>{session.pace && <span style={{ marginLeft: 8 }}>· {session.pace}</span>}{session.duration && <span style={{ marginLeft: 8 }}>· ~{session.duration}</span>}</div>}
          {session.seriesDescription && <div style={{ fontSize: 11, color: "#f97316", marginTop: 4, lineHeight: 1.5 }}>⚡ {session.seriesDescription}</div>}
          {session.includes && <div style={{ fontSize: 11, color: "#818cf8", marginTop: 2 }}>↗ {session.includes}</div>}
          {session.targetTime && <div style={{ fontSize: 12, color: "#fbbf24", marginTop: 4, fontWeight: 700 }}>🎯 Objetivo: {session.targetTime}</div>}
          <div style={{ fontSize: 11, color: "#475569", marginTop: 6, lineHeight: 1.6 }}>{session.detail}</div>
          {session.gymData && <GymCard gymData={session.gymData} />}
          {actual && (
            <div style={{ marginTop: 10, padding: "8px 10px", background: "#1e3a5f", borderRadius: 8, fontSize: 11 }}>
              <span style={{ color: "#4ade80", fontWeight: 700 }}>{actual.fromStrava ? "🟠 Strava: " : "✓ Realizado: "}</span>
              {actual.distance && <span style={{ color: "#a5f3fc" }}>{actual.distance}km </span>}
              {actual.duration && <span style={{ color: "#a5f3fc" }}>{actual.duration} </span>}
              {actual.pace && <span style={{ color: "#a5f3fc" }}>@ {actual.pace}/km </span>}
              {actual.notes && <span style={{ color: "#64748b" }}>— {actual.notes}</span>}
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginLeft: 10 }}>
          <button onClick={() => onLog(day)} style={{ padding: "6px 10px", background: "#1e293b", border: "1px solid #334155", borderRadius: 8, color: "#94a3b8", fontSize: 11, cursor: "pointer" }}>📝 Log</button>
          {completed
            ? <button onClick={() => onUncomplete(day.date)} style={{ padding: "6px 10px", background: "#052e16", border: "1px solid #166534", borderRadius: 8, color: "#4ade80", fontSize: 11, cursor: "pointer" }}>✓ Hecho</button>
            : <button onClick={() => onComplete(day.date)} style={{ padding: "6px 10px", background: "#1e293b", border: "1px solid #334155", borderRadius: 8, color: "#475569", fontSize: 11, cursor: "pointer" }}>○ Marcar</button>
          }
        </div>
      </div>
    </div>
  );
}

function WeekView({ weekDays, onComplete, onUncomplete, onLog }) {
  const [open, setOpen] = useState(true);
  if (!weekDays.length) return null;
  const { weekNum, phase } = weekDays[0];
  const completedCount = weekDays.filter(d => d.completed).length;
  const totalKm = weekDays.filter(d => d.session.distance && ["easy", "long", "series"].includes(d.session.type)).reduce((s, d) => s + (d.session.distance || 0), 0);
  const progressPct = weekDays.length ? Math.round((completedCount / weekDays.length) * 100) : 0;

  return (
    <div style={{ marginBottom: 20 }}>
      <button onClick={() => setOpen(!open)} style={{ width: "100%", background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: open ? 10 : 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: "#f8fafc" }}>Sem {weekNum}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#818cf8", background: "#818cf822", padding: "2px 8px", borderRadius: 6, letterSpacing: 1 }}>{phase.toUpperCase()}</span>
          <span style={{ fontSize: 11, color: "#64748b" }}>~{Math.round(totalKm)}km carrera</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 11, color: completedCount === weekDays.length ? "#4ade80" : "#64748b" }}>{completedCount}/{weekDays.length}</div>
          <div style={{ width: 40, height: 4, background: "#1e293b", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ width: `${progressPct}%`, height: "100%", background: "#6366f1", borderRadius: 2 }} />
          </div>
          <span style={{ color: "#475569", fontSize: 12 }}>{open ? "▲" : "▼"}</span>
        </div>
      </button>
      {open && weekDays.map(d => <DayCard key={d.date} day={d} onComplete={onComplete} onUncomplete={onUncomplete} onLog={onLog} />)}
    </div>
  );
}

function StatsPanel({ plan }) {
  const total = plan.length;
  const done = plan.filter(d => d.completed).length;
  const kmPlanned = plan.filter(d => ["easy", "long", "series"].includes(d.session.type) && d.session.distance).reduce((s, d) => s + d.session.distance, 0);
  const kmDone = plan.filter(d => d.completed && d.actual?.distance).reduce((s, d) => s + parseFloat(d.actual.distance || 0), 0);
  const daysLeft = Math.max(0, Math.floor((new Date("2026-09-27") - new Date()) / 86400000));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginBottom: 20 }}>
      {[
        { label: "Días para la carrera", value: daysLeft, color: "#fbbf24" },
        { label: "Sesiones completadas", value: `${done}/${total}`, color: "#4ade80" },
        { label: "Km planificados", value: `${Math.round(kmPlanned)}km`, color: "#818cf8" },
        { label: "Km reales", value: `${Math.round(kmDone)}km`, color: "#38bdf8" },
      ].map(stat => (
        <div key={stat.label} style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: "14px", textAlign: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: stat.color }}>{stat.value}</div>
          <div style={{ fontSize: 10, color: "#475569", marginTop: 3, letterSpacing: 0.5 }}>{stat.label.toUpperCase()}</div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// APP
// ============================================================
export default function App() {
  const [plan, setPlan] = useState(() => loadData() || generatePlan());
  const [filterPhase, setFilterPhase] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [showCompleted, setShowCompleted] = useState(true);
  const [logging, setLogging] = useState(null);
  const [view, setView] = useState("calendar");
  const [stravaToken, setStravaToken] = useState(() => loadStravaToken());
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  useEffect(() => { saveData(plan); }, [plan]);
  useEffect(() => { if (stravaToken) saveStravaToken(stravaToken); }, [stravaToken]);

  // Handle Strava OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      exchangeToken(code).then(data => {
        if (data.access_token) {
          setStravaToken(data);
          window.history.replaceState({}, "", "/");
          setSyncMsg("✅ Strava conectado correctamente");
          setTimeout(() => setSyncMsg(""), 4000);
        }
      });
    }
  }, []);

  async function syncStrava() {
    if (!stravaToken) return;
    setSyncing(true);
    setSyncMsg("Sincronizando con Strava...");
    try {
      let token = stravaToken;
      // Refresh if expired
      if (Date.now() / 1000 > token.expires_at - 300) {
        const refreshed = await refreshStravaToken(token.refresh_token);
        if (refreshed.access_token) {
          token = { ...token, ...refreshed };
          setStravaToken(token);
        }
      }
      const activities = await fetchStravaActivities(token.access_token);
      if (Array.isArray(activities)) {
        setPlan(prev => matchActivityToPlan(activities, prev));
        setSyncMsg(`✅ ${activities.length} actividades sincronizadas`);
      } else {
        setSyncMsg("⚠️ Error al obtener actividades");
      }
    } catch (e) {
      setSyncMsg("⚠️ Error de conexión con Strava");
    }
    setSyncing(false);
    setTimeout(() => setSyncMsg(""), 4000);
  }

  function disconnectStrava() {
    setStravaToken(null);
    localStorage.removeItem(STRAVA_TOKEN_KEY);
    setSyncMsg("Strava desconectado");
    setTimeout(() => setSyncMsg(""), 3000);
  }

  function markComplete(date) { setPlan(p => p.map(d => d.date === date ? { ...d, completed: true } : d)); }
  function markUncomplete(date) { setPlan(p => p.map(d => d.date === date ? { ...d, completed: false } : d)); }
  function saveLog(form) { setPlan(p => p.map(d => d.date === logging.date ? { ...d, completed: true, actual: form } : d)); setLogging(null); }

  const phases = ["all", "Base 1", "Base 2", "Desarrollo", "Específico", "Pico", "Taper"];
  const types = ["all", "easy", "series", "long", "gym", "bike", "swim", "race", "rest"];

  const filteredPlan = useMemo(() => plan.filter(d => {
    if (!showCompleted && d.completed) return false;
    if (filterPhase !== "all" && d.phase !== filterPhase) return false;
    if (filterType !== "all" && d.session.type !== filterType) return false;
    return true;
  }), [plan, filterPhase, filterType, showCompleted]);

  const weeks = useMemo(() => {
    const map = {};
    filteredPlan.forEach(d => { if (!map[d.weekNum]) map[d.weekNum] = []; map[d.weekNum].push(d); });
    return Object.entries(map).map(([wk, days]) => ({ weekNum: parseInt(wk), days }));
  }, [filteredPlan]);

  const today = new Date().toISOString().split("T")[0];
  const todayPlan = plan.find(d => d.date === today);
  const daysLeft = Math.max(0, Math.floor((new Date("2026-09-27") - new Date()) / 86400000));

  return (
    <div style={{ minHeight: "100vh", background: "#020817", color: "#f8fafc", fontFamily: "'Syne', system-ui, sans-serif", paddingBottom: 80 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #020817; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 2px; }
        button:hover { opacity: 0.85; }
      `}</style>

      {/* Header */}
      <div style={{ background: "linear-gradient(180deg, #0d1b35 0%, #020817 100%)", borderBottom: "1px solid #1e293b", padding: "20px 16px 16px", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: 3, color: "#6366f1", fontWeight: 700, marginBottom: 2 }}>🏃 MEDIA MARATÓN</div>
              <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.5 }}>Valladolid <span style={{ color: "#6366f1" }}>27/09/26</span></div>
              <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>Objetivo: <span style={{ color: "#fbbf24", fontWeight: 700 }}>sub 1:30:00</span></div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
              <div style={{ background: "#6366f111", border: "1px solid #6366f133", borderRadius: 12, padding: "8px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#818cf8" }}>{daysLeft}</div>
                <div style={{ fontSize: 9, color: "#475569", letterSpacing: 1 }}>DÍAS</div>
              </div>
              {/* Strava button */}
              {stravaToken ? (
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={syncStrava} disabled={syncing} style={{ padding: "5px 8px", background: "#fc4c0211", border: "1px solid #fc4c02", borderRadius: 8, color: "#fc4c02", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                    {syncing ? "⏳" : "🔄"} Sync
                  </button>
                  <button onClick={disconnectStrava} style={{ padding: "5px 8px", background: "#1e293b", border: "1px solid #334155", borderRadius: 8, color: "#64748b", fontSize: 10, cursor: "pointer" }}>✕</button>
                </div>
              ) : (
                <a href={stravaAuthUrl()} style={{ padding: "5px 10px", background: "#fc4c0222", border: "1px solid #fc4c02", borderRadius: 8, color: "#fc4c02", fontSize: 10, fontWeight: 700, textDecoration: "none", display: "block", textAlign: "center" }}>
                  🟠 Conectar Strava
                </a>
              )}
            </div>
          </div>

          {syncMsg && (
            <div style={{ background: "#1e293b", borderRadius: 8, padding: "8px 12px", fontSize: 11, color: "#94a3b8", marginBottom: 10, textAlign: "center" }}>{syncMsg}</div>
          )}

          <div style={{ display: "flex", gap: 6 }}>
            {[["calendar", "📅 Plan"], ["stats", "📊 Stats"], ["race", "🏁 Carrera"]].map(([v, l]) => (
              <button key={v} onClick={() => setView(v)} style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "none", cursor: "pointer", background: view === v ? "#6366f1" : "#1e293b", color: view === v ? "#fff" : "#64748b", fontSize: 11, fontWeight: 700 }}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: "0 auto", padding: "16px" }}>

        {todayPlan && view === "calendar" && (
          <div style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)", border: "1px solid #4f46e5", borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
            <div style={{ fontSize: 10, letterSpacing: 2, color: "#6366f1", fontWeight: 700, marginBottom: 6 }}>HOY · {formatDate(todayPlan.date)}</div>
            <DayCard day={todayPlan} onComplete={markComplete} onUncomplete={markUncomplete} onLog={setLogging} />
          </div>
        )}

        {view === "calendar" && (
          <>
            <StatsPanel plan={plan} />
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 8 }}>
                {phases.map(p => (
                  <button key={p} onClick={() => setFilterPhase(p)} style={{ whiteSpace: "nowrap", padding: "5px 10px", borderRadius: 8, border: "none", cursor: "pointer", background: filterPhase === p ? "#6366f1" : "#1e293b", color: filterPhase === p ? "#fff" : "#64748b", fontSize: 10, fontWeight: 700 }}>{p === "all" ? "Todas" : p}</button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, marginBottom: 8 }}>
                {types.map(t => (
                  <button key={t} onClick={() => setFilterType(t)} style={{ whiteSpace: "nowrap", padding: "5px 10px", borderRadius: 8, border: "none", cursor: "pointer", background: filterType === t ? typeColor(t) + "55" : "#1e293b", color: filterType === t ? typeColor(t) : "#64748b", fontSize: 10, fontWeight: 700, border: filterType === t ? `1px solid ${typeColor(t)}` : "1px solid transparent" }}>{typeIcon(t)} {t === "all" ? "Todo" : t}</button>
                ))}
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#64748b", cursor: "pointer" }}>
                <input type="checkbox" checked={showCompleted} onChange={e => setShowCompleted(e.target.checked)} />
                Mostrar completados
              </label>
            </div>
            {weeks.map(({ weekNum, days }) => <WeekView key={weekNum} weekDays={days} onComplete={markComplete} onUncomplete={markUncomplete} onLog={setLogging} />)}
          </>
        )}

        {view === "stats" && (
          <div>
            <StatsPanel plan={plan} />
            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: 16, marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#f8fafc", marginBottom: 12 }}>Progreso por tipo</div>
              {["easy", "long", "series", "gym", "bike", "swim"].map(type => {
                const total = plan.filter(d => d.session.type === type).length;
                const done = plan.filter(d => d.session.type === type && d.completed).length;
                if (!total) return null;
                return (
                  <div key={type} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>{typeIcon(type)} {type}</span>
                      <span style={{ fontSize: 11, color: typeColor(type) }}>{done}/{total}</span>
                    </div>
                    <div style={{ height: 4, background: "#1e293b", borderRadius: 2 }}>
                      <div style={{ height: "100%", width: `${Math.round((done / total) * 100)}%`, background: typeColor(type), borderRadius: 2, transition: "width 0.5s" }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Strava status */}
            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: 16, marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#f8fafc", marginBottom: 12 }}>🟠 Strava</div>
              {stravaToken ? (
                <div>
                  <div style={{ fontSize: 11, color: "#4ade80", marginBottom: 8 }}>✅ Conectado como <strong>{stravaToken.athlete?.firstname} {stravaToken.athlete?.lastname}</strong></div>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 12 }}>Las actividades de running, bici y natación desde el 1 de junio se importan automáticamente al sincronizar.</div>
                  <button onClick={syncStrava} disabled={syncing} style={{ width: "100%", padding: "10px", background: "#fc4c0222", border: "1px solid #fc4c02", borderRadius: 10, color: "#fc4c02", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                    {syncing ? "⏳ Sincronizando..." : "🔄 Sincronizar ahora"}
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 12 }}>Conecta Strava para importar automáticamente tus entrenos de running, bici y natación.</div>
                  <a href={stravaAuthUrl()} style={{ display: "block", width: "100%", padding: "10px", background: "#fc4c0222", border: "1px solid #fc4c02", borderRadius: 10, color: "#fc4c02", fontWeight: 700, fontSize: 12, cursor: "pointer", textAlign: "center", textDecoration: "none" }}>
                    🟠 Conectar con Strava
                  </a>
                </div>
              )}
            </div>

            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#f8fafc", marginBottom: 12 }}>Tus referencias</div>
              {[
                { label: "HM Madrid 26 Abr", value: "1:31:48", sub: "4:21/km" },
                { label: "10k Familias", value: "40:04", sub: "4:00/km" },
                { label: "Objetivo Valladolid", value: "< 1:30:00", sub: "4:15/km", highlight: true },
                { label: "Ritmo series objetivo", value: "3:55–4:05/km", sub: "VO2max" },
                { label: "Ritmo umbral", value: "4:15–4:25/km", sub: "Tempo" },
                { label: "Ritmo rodaje fácil", value: "5:40–6:10/km", sub: "Z2" },
              ].map(r => (
                <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #1e293b" }}>
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>{r.label}</span>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: r.highlight ? "#fbbf24" : "#f8fafc" }}>{r.value}</div>
                    <div style={{ fontSize: 10, color: "#475569" }}>{r.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === "race" && (
          <div>
            <div style={{ background: "linear-gradient(135deg, #1c1917 0%, #0f172a 100%)", border: "1px solid #fbbf2433", borderRadius: 16, padding: 20, marginBottom: 16 }}>
              <div style={{ fontSize: 10, letterSpacing: 3, color: "#fbbf24", fontWeight: 700, marginBottom: 8 }}>🏆 DÍA DE CARRERA — 27 SEPT 2026</div>
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Media Maratón Valladolid</div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 16 }}>Recorrido plano · Objetivo sub 1:30:00</div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#fbbf24", marginBottom: 8 }}>ESTRATEGIA DE CARRERA</div>
                {[
                  { km: "0–5", pace: "4:20/km", time: "~21:40", note: "Salida controlada, no te dejes llevar" },
                  { km: "5–10", pace: "4:16/km", time: "~21:20", note: "Ritmo objetivo, encuentra el surco" },
                  { km: "10–18", pace: "4:12/km", time: "~33:36", note: "Bloque principal, mantén" },
                  { km: "18–21.1", pace: "4:05/km", time: "~12:42", note: "Si te quedan fuerzas, ¡aprieta!" },
                ].map(s => (
                  <div key={s.km} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #1e293b" }}>
                    <div style={{ minWidth: 50, fontSize: 10, fontWeight: 700, color: "#fbbf24", background: "#fbbf2411", padding: "2px 6px", borderRadius: 6, textAlign: "center" }}>km {s.km}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#f8fafc" }}>{s.pace}</div>
                      <div style={{ fontSize: 10, color: "#64748b" }}>{s.note}</div>
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>{s.time}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: "#1e293b", borderRadius: 10, padding: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#38bdf8", marginBottom: 6 }}>🍌 DÍA ANTES</div>
                <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.7 }}>· Pasta o arroz en la cena, nada nuevo<br/>· Hidratación extra todo el día<br/>· Sal a pasear 15–20min<br/>· En cama a las 22:30 aunque no puedas dormir</div>
              </div>
              <div style={{ background: "#1e293b", borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#4ade80", marginBottom: 6 }}>☀️ DÍA DE CARRERA</div>
                <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.7 }}>· Desayuno 3h antes: avena + plátano + café<br/>· Gel + agua en km 7 y km 14<br/>· Hidratación en TODOS los avituallamientos<br/>· Calentamiento 15min, últimos 3min suave<br/>· Ropa y zapatillas ya probadas en entrenos</div>
              </div>
            </div>
            <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#f8fafc", marginBottom: 12 }}>📈 Tu progresión prevista</div>
              <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.8 }}>
                Con tus tiempos actuales (HM 1:31:48, 10k 40:04) tu <strong style={{ color: "#818cf8" }}>ritmo umbral lácteo</strong> está ~4:18–4:22/km.<br/><br/>
                Para bajar de 1:30 necesitas ~4:15/km. En 17 semanas con este plan:<br/>
                · Km semanales: 45 → 68 → taper<br/>
                · Series progresivas para bajar VMA<br/>
                · Fuerza para economía de carrera<br/><br/>
                La mejora esperada es <strong style={{ color: "#4ade80" }}>1:28:30–1:29:30</strong> 🎯
              </div>
            </div>
          </div>
        )}
      </div>

      {logging && <ActualForm day={logging} onSave={saveLog} onClose={() => setLogging(null)} />}
      <div style={{ height: 30 }} />
    </div>
  );
}
