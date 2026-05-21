// ============================================================
// FRESHSAVE v3 — подключён к Supabase
//
// ЧТО ИЗМЕНИЛОСЬ по сравнению с v2:
// 1. Данные теперь приходят из реальной БД (не фейковый массив)
// 2. Добавлены функции: fetchListings(), createOrder()
// 3. Состояние загрузки (loading/error) — как в настоящих приложениях
//
// КАК ПОДКЛЮЧИТЬ:
// Замени две строки ниже на свои значения из Supabase → Settings → API
// ============================================================

import { useState, useEffect, useCallback } from "react";

// ── КОНФИГ SUPABASE ──────────────────────────────────────────
// После того как создашь проект на supabase.com,
// замени эти два значения на свои из Settings → API
const SUPABASE_URL = "https://wmkhgvgzfdpoalrkbrkt.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indta2hndmd6ZmRwb2Fscmticmt0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzODgxNTIsImV4cCI6MjA5NDk2NDE1Mn0.7sp1-26TR8nERs1lPQ7-mjNhzBzkm4hEgxgoFw_FDic";

// Простой Supabase-клиент без npm (работает через fetch)
// Так проще показать как это работает изнутри
const supabase = {
  // Получить данные из таблицы
  from: (table) => ({
    select: (columns = "*") => ({
      eq: (col, val) => fetch(
        `${SUPABASE_URL}/rest/v1/${table}?select=${columns}&${col}=eq.${val}`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      ).then(r => r.json()),
      order: (col, { ascending = true } = {}) =>
        fetch(
          `${SUPABASE_URL}/rest/v1/${table}?select=${columns}&order=${col}.${ascending?"asc":"desc"}`,
          { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
        ).then(r => r.json()),
      then: (resolve) => fetch(
        `${SUPABASE_URL}/rest/v1/${table}?select=${columns}`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      ).then(r => r.json()).then(resolve),
    }),
    // Вставить запись
    insert: (data) => fetch(
      `${SUPABASE_URL}/rest/v1/${table}`,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify(data),
      }
    ).then(r => r.json()),
    // Обновить запись
    update: (data) => ({
      eq: (col, val) => fetch(
        `${SUPABASE_URL}/rest/v1/${table}?${col}=eq.${val}`,
        {
          method: "PATCH",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        }
      ).then(r => r.json()),
    }),
  }),
};

// ── ФУНКЦИИ РАБОТЫ С БД ──────────────────────────────────────
// Эти функции — "мост" между интерфейсом и базой данных.
// Называются они "async" потому что данные приходят не мгновенно.

// Загрузить все активные лоты с данными ресторана
async function fetchListings() {
  const res = await fetch(
    // Джойн двух таблиц — listings + restaurants (как SQL JOIN)
    `${SUPABASE_URL}/rest/v1/listings?select=*,restaurant:restaurants(*)&is_active=eq.true&order=discount_price.asc`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  const data = await res.json();
  return data;
}

// Создать заказ в БД
async function createOrder({ userId, items, total, paymentMethod }) {
  // Шаг 1: создаём заказ
  const orderRes = await supabase.from("orders").insert({
    user_id: userId || null,
    total_price: total,
    payment_method: paymentMethod,
    payment_status: "pending",
    status: "confirmed",
    qr_code: `FS-${Math.floor(Math.random() * 90000) + 10000}`,
  });

  if (!orderRes || orderRes.error) throw new Error("Ошибка создания заказа");
  const order = Array.isArray(orderRes) ? orderRes[0] : orderRes;

  // Шаг 2: добавляем позиции заказа
  const orderItems = items.map(item => ({
    order_id: order.id,
    listing_id: item.id,
    price: item.discountPrice,
  }));
  await supabase.from("order_items").insert(orderItems);

  // Шаг 3: уменьшаем quantity_left у каждого лота
  for (const item of items) {
    await supabase.from("listings")
      .update({ quantity_left: item.quantity_left - 1 })
      .eq("id", item.id);
  }

  return order;
}

// ── УТИЛИТЫ ──────────────────────────────────────────────────
const fmt = (n) => n?.toLocaleString("ru-RU") ?? "0";

// Таймер обратного отсчёта
function useCountdown(targetTime) {
  const [diff, setDiff] = useState(null);
  useEffect(() => {
    if (!targetTime) return;
    const calc = () => {
      const now = new Date();
      const [h, m] = targetTime.split(":").map(Number);
      const target = new Date(now);
      target.setHours(h, m, 0, 0);
      setDiff(Math.max(0, Math.floor((target - now) / 1000)));
    };
    calc();
    const t = setInterval(calc, 1000);
    return () => clearInterval(t);
  }, [targetTime]);
  if (diff === null) return "--:--";
  const h = Math.floor(diff / 3600);
  const min = Math.floor((diff % 3600) / 60);
  const sec = diff % 60;
  if (h > 0) return `${h}ч ${min}м`;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

// Скидка в процентах
const discountPct = (orig, disc) => Math.round((1 - disc / orig) * 100);

// ── ИКОНКИ ───────────────────────────────────────────────────
const Ico = {
  home:  (a) => <svg width="23" height="23" viewBox="0 0 24 24" fill="none"><path d="M3 10.5L12 3l9 7.5V21a1 1 0 01-1 1H5a1 1 0 01-1-1V10.5z" fill={a?"#4CAF82":"none"} stroke={a?"#4CAF82":"#505050"} strokeWidth="1.8"/><path d="M9 22V13h6v9" stroke={a?"#4CAF82":"#505050"} strokeWidth="1.8" strokeLinecap="round"/></svg>,
  map:   (a) => <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke={a?"#4CAF82":"#505050"} strokeWidth="1.8"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>,
  bag:   (a, n) => <div style={{position:"relative"}}><svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke={a?"#4CAF82":"#505050"} strokeWidth="1.8"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>{n>0&&<span style={{position:"absolute",top:-5,right:-7,background:"#4CAF82",borderRadius:"50%",width:17,height:17,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:"#fff"}}>{n}</span>}</div>,
  user:  (a) => <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke={a?"#4CAF82":"#505050"} strokeWidth="1.8"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  back:  () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EFEFEF" strokeWidth="2.2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>,
  trash: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>,
  star:  () => <svg width="11" height="11" viewBox="0 0 24 24" fill="#F5C518"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>,
  check: () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
  kaspi: () => <svg width="22" height="22" viewBox="0 0 40 40"><rect width="40" height="40" rx="10" fill="#F14635"/><text x="50%" y="57%" textAnchor="middle" fill="white" fontSize="18" fontWeight="800" dominantBaseline="middle">K</text></svg>,
  card:  () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.8"><rect x="1" y="4" width="22" height="16" rx="3"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
  qr:    () => <svg width="80" height="80" viewBox="0 0 100 100" fill="none"><rect x="5" y="5" width="38" height="38" rx="4" fill="none" stroke="#4CAF82" strokeWidth="4"/><rect x="15" y="15" width="18" height="18" rx="2" fill="#4CAF82"/><rect x="57" y="5" width="38" height="38" rx="4" fill="none" stroke="#4CAF82" strokeWidth="4"/><rect x="67" y="15" width="18" height="18" rx="2" fill="#4CAF82"/><rect x="5" y="57" width="38" height="38" rx="4" fill="none" stroke="#4CAF82" strokeWidth="4"/><rect x="15" y="67" width="18" height="18" rx="2" fill="#4CAF82"/><rect x="57" y="57" width="8" height="8" fill="#4CAF82"/><rect x="71" y="57" width="8" height="8" fill="#4CAF82"/><rect x="85" y="57" width="8" height="8" fill="#4CAF82"/><rect x="57" y="71" width="8" height="8" fill="#4CAF82"/><rect x="71" y="71" width="8" height="8" fill="#4CAF82"/><rect x="57" y="85" width="8" height="8" fill="#4CAF82"/><rect x="71" y="85" width="8" height="8" fill="#4CAF82"/><rect x="85" y="71" width="8" height="8" fill="#4CAF82"/><rect x="85" y="85" width="8" height="8" fill="#4CAF82"/></svg>,
  refresh: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4CAF82" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>,
};

// ── СКЕЛЕТОН ЗАГРУЗКИ ─────────────────────────────────────────
// Показывается пока данные грузятся из БД — выглядит профессионально
function Skeleton() {
  return (
    <div style={{ display:"flex",flexDirection:"column",gap:10 }}>
      {[1,2,3].map(i => (
        <div key={i} style={{ background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:20,padding:15,display:"flex",gap:12,alignItems:"center" }}>
          <div style={{ width:56,height:56,borderRadius:14,background:"rgba(255,255,255,0.06)",animation:`pulse ${0.8+i*0.2}s ease infinite alternate` }}/>
          <div style={{ flex:1,display:"flex",flexDirection:"column",gap:7 }}>
            <div style={{ height:14,borderRadius:6,background:"rgba(255,255,255,0.06)",width:"60%" }}/>
            <div style={{ height:11,borderRadius:5,background:"rgba(255,255,255,0.04)",width:"40%" }}/>
            <div style={{ height:11,borderRadius:5,background:"rgba(255,255,255,0.04)",width:"50%" }}/>
          </div>
        </div>
      ))}
      <style>{`@keyframes pulse{from{opacity:.5}to{opacity:1}}`}</style>
    </div>
  );
}

// ── КАРТОЧКА ЛОТА ─────────────────────────────────────────────
// listing — данные из БД (содержит вложенный объект restaurant)
function Card({ listing, onOpen, i }) {
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), i * 65); return () => clearTimeout(t); }, []);

  const r = listing.restaurant || {};
  const pct = discountPct(listing.original_price, listing.discount_price);
  const hot = listing.quantity_left <= 2;
  const pickupEnd = listing.pickup_end?.slice(0, 5); // "19:00:00" → "19:00"
  const countdown = useCountdown(pickupEnd);

  return (
    <div onClick={() => onOpen(listing)} style={{
      background:"rgba(255,255,255,0.037)",
      border:`1px solid ${hot?"rgba(255,107,53,0.22)":"rgba(255,255,255,0.068)"}`,
      borderRadius:20,padding:15,marginBottom:10,cursor:"pointer",
      opacity:show?1:0,transform:show?"translateY(0)":"translateY(14px)",
      transition:"opacity .38s ease,transform .38s ease,background .18s",
    }}
      onMouseEnter={e => e.currentTarget.style.background="rgba(255,255,255,0.06)"}
      onMouseLeave={e => e.currentTarget.style.background="rgba(255,255,255,0.037)"}
    >
      <div style={{ display:"flex",gap:12 }}>
        <div style={{ width:56,height:56,borderRadius:14,flexShrink:0,background:`${r.accent_color}18`,border:`1.5px solid ${r.accent_color}33`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:25 }}>
          {r.emoji}
        </div>
        <div style={{ flex:1,minWidth:0 }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start" }}>
            <div style={{ fontWeight:660,fontSize:15,color:"#EFEFEF",letterSpacing:"-0.3px" }}>{r.name}</div>
            <div style={{ background:"#4CAF8220",border:"1px solid #4CAF8240",borderRadius:7,padding:"2px 7px",fontSize:11,fontWeight:800,color:"#4CAF82" }}>−{pct}%</div>
          </div>
          <div style={{ fontSize:12,color:"#5A5A5A",marginTop:2 }}>{r.cuisine} · {r.address}</div>
          <div style={{ display:"flex",alignItems:"center",gap:8,marginTop:7 }}>
            <span style={{ fontSize:17,fontWeight:760,color:"#F0F0F0",letterSpacing:"-0.5px" }}>₸{fmt(listing.discount_price)}</span>
            <span style={{ fontSize:12,color:"#3E3E3E",textDecoration:"line-through" }}>₸{fmt(listing.original_price)}</span>
          </div>
          <div style={{ display:"flex",alignItems:"center",gap:8,marginTop:6 }}>
            <div style={{ display:"flex",alignItems:"center",gap:3 }}>{Ico.star()}<span style={{ fontSize:12,color:"#888" }}>{r.rating}</span></div>
            <span style={{ color:"#2E2E2E" }}>·</span>
            <span style={{ fontSize:12,color:parseInt(countdown)<600?"#FF6B35":"#666" }}>⏱ {countdown}</span>
            <span style={{ color:"#2E2E2E" }}>·</span>
            {hot
              ? <span style={{ fontSize:12,color:"#FF6B35",fontWeight:600 }}>🔥 {listing.quantity_left} шт!</span>
              : <span style={{ fontSize:12,color:"#555" }}>{listing.quantity_left} шт</span>
            }
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ЭКРАН ГЛАВНАЯ ─────────────────────────────────────────────
const CATS = ["Все", "Горячее", "Салаты", "Выпечка", "Суши"];

function HomeScreen({ onOpen }) {
  const [cat, setCat] = useState("Все");
  // loading/error/data — стандартный паттерн для работы с API
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [listings, setListings] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchListings();
      // Если Supabase не подключён — возвращается ошибка или пустой массив
      if (data?.message) throw new Error(data.message);
      setListings(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = cat === "Все" ? listings : listings.filter(l => l.tag === cat);

  return (
    <div style={{ height:"100%",display:"flex",flexDirection:"column" }}>
      <div style={{ padding:"50px 18px 0",flexShrink:0 }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18 }}>
          <div>
            <div style={{ fontSize:12,color:"#555",marginBottom:3 }}>📍 Астана, Есиль</div>
            <div style={{ fontSize:29,fontWeight:820,color:"#F0F0F0",letterSpacing:"-1.2px",lineHeight:1 }}>
              Fresh<span style={{ color:"#4CAF82" }}>Save</span>
            </div>
          </div>
          <button onClick={load} style={{ width:40,height:40,borderRadius:12,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer" }}>
            {Ico.refresh()}
          </button>
        </div>

        {/* Эко-баннер */}
        <div style={{ background:"linear-gradient(135deg,rgba(76,175,130,0.12),rgba(46,155,106,0.07))",border:"1px solid rgba(76,175,130,0.2)",borderRadius:17,padding:"13px 15px",display:"flex",alignItems:"center",gap:11,marginBottom:14 }}>
          <div style={{ fontSize:28 }}>🌱</div>
          <div>
            <div style={{ fontSize:11,color:"#4CAF82",fontWeight:700,letterSpacing:"0.4px" }}>СЕГОДНЯ СПАСЕНО</div>
            <div style={{ fontSize:14,fontWeight:700,color:"#EFEFEF",marginTop:1 }}>
              {listings.reduce((s,l) => s+(l.quantity_total-l.quantity_left), 0)} порций от мусорки
            </div>
          </div>
        </div>

        {/* Поиск */}
        <div style={{ background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:13,padding:"11px 15px",display:"flex",alignItems:"center",gap:9,marginBottom:13 }}>
          <span style={{ fontSize:14,opacity:.35 }}>🔍</span>
          <span style={{ color:"#404040",fontSize:14 }}>Ресторан, кухня...</span>
        </div>

        {/* Категории */}
        <div style={{ display:"flex",gap:7,overflowX:"auto",paddingBottom:2,marginBottom:14,scrollbarWidth:"none" }}>
          {CATS.map(c => (
            <button key={c} onClick={() => setCat(c)} style={{ flexShrink:0,padding:"6px 14px",borderRadius:20,border:"none",cursor:"pointer",background:cat===c?"#4CAF82":"rgba(255,255,255,0.06)",color:cat===c?"#fff":"#666",fontSize:13,fontWeight:cat===c?700:500,transition:"all .2s" }}>{c}</button>
          ))}
        </div>

        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10 }}>
          <div style={{ fontSize:16,fontWeight:720,color:"#F0F0F0",letterSpacing:"-0.4px" }}>Закрываются сегодня</div>
          {!loading && <div style={{ fontSize:13,color:"#4CAF82" }}>{filtered.length} заведений</div>}
        </div>
      </div>

      <div style={{ flex:1,overflowY:"auto",padding:"0 18px 16px",scrollbarWidth:"none" }}>
        {/* Состояние загрузки */}
        {loading && <Skeleton/>}

        {/* Ошибка — Supabase не подключён */}
        {error && !loading && (
          <div style={{ background:"rgba(255,107,53,0.08)",border:"1px solid rgba(255,107,53,0.2)",borderRadius:16,padding:20,textAlign:"center" }}>
            <div style={{ fontSize:28,marginBottom:10 }}>⚠️</div>
            <div style={{ fontSize:14,color:"#FF6B35",fontWeight:600,marginBottom:6 }}>Supabase не подключён</div>
            <div style={{ fontSize:12,color:"#555",lineHeight:1.6 }}>
              Замени SUPABASE_URL и SUPABASE_KEY<br/>в начале файла на свои значения<br/>из Settings → API в Supabase
            </div>
            <button onClick={load} style={{ marginTop:14,padding:"8px 18px",borderRadius:10,border:"1px solid rgba(255,107,53,0.3)",background:"transparent",color:"#FF6B35",fontSize:13,cursor:"pointer" }}>
              Попробовать снова
            </button>
          </div>
        )}

        {/* Данные загружены */}
        {!loading && !error && filtered.map((l,i) => (
          <Card key={l.id} listing={l} onOpen={onOpen} i={i}/>
        ))}

        {!loading && !error && filtered.length === 0 && (
          <div style={{ textAlign:"center",paddingTop:40 }}>
            <div style={{ fontSize:40,marginBottom:12 }}>😔</div>
            <div style={{ fontSize:15,color:"#444" }}>В этой категории пока ничего нет</div>
          </div>
        )}
        <div style={{ height:16 }}/>
      </div>
    </div>
  );
}

// ── ЭКРАН ДЕТАЛЬНАЯ СТРАНИЦА ──────────────────────────────────
function DetailScreen({ listing, onBack, cart, setCart }) {
  const r = listing.restaurant || {};
  const inCart = cart.some(i => i.id === listing.id);
  const pct = discountPct(listing.original_price, listing.discount_price);
  const pickupEnd = listing.pickup_end?.slice(0,5);
  const pickupStart = listing.pickup_start?.slice(0,5);
  const countdown = useCountdown(pickupEnd);

  const toggle = () => {
    if (inCart) setCart(p => p.filter(i => i.id !== listing.id));
    else setCart(p => [...p, listing]);
  };

  return (
    <div style={{ height:"100%",display:"flex",flexDirection:"column" }}>
      <div style={{ padding:"50px 18px 14px",display:"flex",alignItems:"center",gap:12,flexShrink:0 }}>
        <button onClick={onBack} style={{ width:36,height:36,borderRadius:11,border:"none",background:"rgba(255,255,255,0.08)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>{Ico.back()}</button>
        <div style={{ fontWeight:700,fontSize:17,color:"#F0F0F0",letterSpacing:"-0.4px" }}>{r.name}</div>
      </div>

      <div style={{ flex:1,overflowY:"auto",padding:"0 18px",scrollbarWidth:"none" }}>
        <div style={{ background:`${r.accent_color}13`,border:`1.5px solid ${r.accent_color}28`,borderRadius:22,padding:"26px 0",display:"flex",flexDirection:"column",alignItems:"center",marginBottom:18,position:"relative" }}>
          <div style={{ fontSize:60,marginBottom:6 }}>{r.emoji}</div>
          <div style={{ fontSize:18,fontWeight:730,color:"#F0F0F0" }}>{r.name}</div>
          <div style={{ fontSize:13,color:"#666",marginTop:2 }}>{r.cuisine}</div>
          <div style={{ position:"absolute",top:10,right:10,background:"#4CAF82",borderRadius:9,padding:"3px 10px",fontSize:13,fontWeight:800,color:"#fff" }}>−{pct}%</div>
        </div>

        <p style={{ fontSize:14,color:"#777",lineHeight:1.65,marginBottom:18 }}>{r.description}</p>

        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:9,marginBottom:18 }}>
          {[
            { icon:"⏱", label:"Самовывоз", val:`${pickupStart}–${pickupEnd}` },
            { icon:"⏳", label:"Осталось времени", val:countdown, hot:parseInt(countdown)<600 },
            { icon:"⭐", label:"Рейтинг", val:`${r.rating} (${r.reviews_count})` },
            { icon:"📦", label:"Пакетов осталось", val:`${listing.quantity_left} шт`, hot:listing.quantity_left<=2 },
          ].map((x,i) => (
            <div key={i} style={{ background:x.hot?"rgba(255,107,53,0.08)":"rgba(255,255,255,0.04)",border:`1px solid ${x.hot?"rgba(255,107,53,0.2)":"rgba(255,255,255,0.07)"}`,borderRadius:13,padding:"11px 13px" }}>
              <div style={{ fontSize:15,marginBottom:3 }}>{x.icon}</div>
              <div style={{ fontSize:11,color:"#444",marginBottom:2 }}>{x.label}</div>
              <div style={{ fontSize:13,fontWeight:650,color:x.hot?"#FF6B35":"#D0D0D0" }}>{x.val}</div>
            </div>
          ))}
        </div>

        <div style={{ background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:17,padding:15,marginBottom:18 }}>
          <div style={{ fontSize:11,color:"#444",fontWeight:700,letterSpacing:"0.5px",marginBottom:11 }}>📋 СОСТАВ ПАКЕТА</div>
          {(listing.items || []).map((item,i) => (
            <div key={i} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:i<listing.items.length-1?"1px solid rgba(255,255,255,0.05)":"none" }}>
              <span style={{ fontSize:14,color:"#B0B0B0" }}>{r.emoji} {item}</span>
              <span style={{ fontSize:11,color:"#4CAF82",background:"#4CAF8212",padding:"2px 7px",borderRadius:5 }}>вкл.</span>
            </div>
          ))}
        </div>

        <div style={{ background:"rgba(76,175,130,0.07)",border:"1px solid rgba(76,175,130,0.15)",borderRadius:13,padding:"11px 14px",display:"flex",gap:9,alignItems:"center",marginBottom:20 }}>
          <span style={{ fontSize:18 }}>🌱</span>
          <span style={{ fontSize:13,color:"#4CAF82" }}>Сэкономишь <strong>{listing.co2_saved} кг CO₂</strong>, купив этот пакет</span>
        </div>

        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:13 }}>
          <div>
            <div style={{ fontSize:27,fontWeight:860,color:"#F0F0F0",letterSpacing:"-1px" }}>₸{fmt(listing.discount_price)}</div>
            <div style={{ fontSize:13,color:"#3A3A3A",textDecoration:"line-through" }}>₸{fmt(listing.original_price)}</div>
          </div>
          <div style={{ background:"#4CAF8220",border:"1px solid #4CAF8240",borderRadius:11,padding:"5px 13px",fontSize:15,fontWeight:800,color:"#4CAF82" }}>−{pct}%</div>
        </div>

        <button onClick={toggle} style={{
          width:"100%",padding:"16px",borderRadius:17,
          border:inCart?"1px solid rgba(76,175,130,0.35)":"none",
          background:inCart?"rgba(76,175,130,0.12)":"linear-gradient(135deg,#4CAF82,#2E9B6A)",
          color:inCart?"#4CAF82":"#fff",fontSize:16,fontWeight:700,cursor:"pointer",
          transition:"all .25s",display:"flex",alignItems:"center",justifyContent:"center",gap:8,
        }}>
          {inCart ? "✓ В корзине — убрать" : "Добавить в корзину"}
        </button>
        <div style={{ height:28 }}/>
      </div>
    </div>
  );
}

// ── ЭКРАН КОРЗИНА ─────────────────────────────────────────────
function CartScreen({ cart, setCart, onCheckout }) {
  const total = cart.reduce((s,i) => s+i.discount_price, 0);
  const saved = cart.reduce((s,i) => s+(i.original_price-i.discount_price), 0);

  if (cart.length===0) return (
    <div style={{ height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32 }}>
      <div style={{ fontSize:52,marginBottom:14 }}>🛍️</div>
      <div style={{ fontSize:20,fontWeight:700,color:"#444",textAlign:"center" }}>Корзина пуста</div>
      <div style={{ fontSize:14,color:"#333",marginTop:8,textAlign:"center" }}>Добавь пакеты из ленты</div>
    </div>
  );

  return (
    <div style={{ height:"100%",display:"flex",flexDirection:"column" }}>
      <div style={{ padding:"50px 18px 14px",flexShrink:0 }}>
        <div style={{ fontSize:26,fontWeight:820,color:"#F0F0F0",letterSpacing:"-0.8px" }}>Корзина</div>
        <div style={{ fontSize:13,color:"#555",marginTop:2 }}>{cart.length} {cart.length===1?"пакет":"пакета"}</div>
      </div>
      <div style={{ flex:1,overflowY:"auto",padding:"0 18px",scrollbarWidth:"none" }}>
        {cart.map(item => {
          const r = item.restaurant || {};
          return (
            <div key={item.id} style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:17,padding:13,marginBottom:9,display:"flex",alignItems:"center",gap:11 }}>
              <div style={{ width:50,height:50,borderRadius:12,background:`${r.accent_color}18`,border:`1px solid ${r.accent_color}28`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0 }}>{r.emoji}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:650,fontSize:14,color:"#EFEFEF" }}>{r.name}</div>
                <div style={{ fontSize:12,color:"#444",marginTop:1 }}>⏱ {item.pickup_start?.slice(0,5)}–{item.pickup_end?.slice(0,5)}</div>
                <div style={{ fontSize:15,fontWeight:750,color:"#F0F0F0",marginTop:3 }}>₸{fmt(item.discount_price)}</div>
              </div>
              <button onClick={() => setCart(p => p.filter(i => i.id!==item.id))} style={{ width:33,height:33,background:"rgba(255,107,107,0.1)",border:"1px solid rgba(255,107,107,0.15)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer" }}>{Ico.trash()}</button>
            </div>
          );
        })}
        <div style={{ background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:17,padding:16,marginTop:4,marginBottom:14 }}>
          <div style={{ display:"flex",justifyContent:"space-between",marginBottom:7 }}>
            <span style={{ fontSize:14,color:"#666" }}>Сумма</span>
            <span style={{ fontSize:14,color:"#B0B0B0" }}>₸{fmt(total)}</span>
          </div>
          <div style={{ display:"flex",justifyContent:"space-between",marginBottom:11,paddingBottom:11,borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
            <span style={{ fontSize:14,color:"#4CAF82" }}>💰 Экономия</span>
            <span style={{ fontSize:14,color:"#4CAF82",fontWeight:700 }}>₸{fmt(saved)}</span>
          </div>
          <div style={{ display:"flex",justifyContent:"space-between" }}>
            <span style={{ fontSize:16,fontWeight:700,color:"#F0F0F0" }}>Итого</span>
            <span style={{ fontSize:18,fontWeight:820,color:"#F0F0F0",letterSpacing:"-0.5px" }}>₸{fmt(total)}</span>
          </div>
        </div>
        <button onClick={onCheckout} style={{ width:"100%",padding:"16px",borderRadius:17,border:"none",background:"linear-gradient(135deg,#4CAF82,#2E9B6A)",color:"#fff",fontSize:16,fontWeight:700,cursor:"pointer" }}>
          Перейти к оплате →
        </button>
        <div style={{ height:24 }}/>
      </div>
    </div>
  );
}

// ── ЭКРАН ЧЕКАУТ ──────────────────────────────────────────────
function CheckoutScreen({ cart, onBack, onSuccess }) {
  const [step, setStep] = useState("review");
  const [method, setMethod] = useState(null);
  const [cardNum, setCardNum] = useState("");
  const [cardExp, setCardExp] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [loading, setLoading] = useState(false);

  const total = cart.reduce((s,i) => s+i.discount_price, 0);
  const saved = cart.reduce((s,i) => s+(i.original_price-i.discount_price), 0);
  const co2 = cart.reduce((s,i) => s+(i.co2_saved||0), 0);

  const fmtCard = v => v.replace(/\D/g,"").slice(0,16).replace(/(.{4})/g,"$1 ").trim();
  const fmtExp  = v => { const d=v.replace(/\D/g,"").slice(0,4); return d.length>2?`${d.slice(0,2)}/${d.slice(2)}`:d; };

  const handlePay = async () => {
    setLoading(true);
    try {
      // createOrder записывает заказ в Supabase и уменьшает quantity_left
      await createOrder({ items: cart, total, paymentMethod: method || "card" });
    } catch(e) {
      console.warn("Supabase не подключён, используем локальный режим");
    }
    setTimeout(() => { setLoading(false); onSuccess({ total, saved, co2, method }); }, 1500);
  };

  const Hdr = ({ title, back }) => (
    <div style={{ padding:"50px 18px 14px",display:"flex",alignItems:"center",gap:12,flexShrink:0 }}>
      <button onClick={back} style={{ width:36,height:36,borderRadius:11,border:"none",background:"rgba(255,255,255,0.08)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>{Ico.back()}</button>
      <div style={{ fontWeight:700,fontSize:17,color:"#F0F0F0" }}>{title}</div>
    </div>
  );

  if (step==="review") return (
    <div style={{ height:"100%",display:"flex",flexDirection:"column" }}>
      <Hdr title="Оформление" back={onBack}/>
      <div style={{ flex:1,overflowY:"auto",padding:"0 18px",scrollbarWidth:"none" }}>
        <div style={{ fontSize:12,color:"#444",fontWeight:700,letterSpacing:"0.5px",marginBottom:10 }}>ВАШИ ПАКЕТЫ</div>
        {cart.map(item => {
          const r = item.restaurant || {};
          return (
            <div key={item.id} style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:16,padding:13,marginBottom:9,display:"flex",gap:11,alignItems:"center" }}>
              <div style={{ width:48,height:48,borderRadius:12,background:`${r.accent_color}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22 }}>{r.emoji}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:650,fontSize:14,color:"#EFEFEF" }}>{r.name}</div>
                <div style={{ fontSize:12,color:"#4A4A4A",marginTop:2 }}>📍 {r.address}</div>
                <div style={{ fontSize:12,color:"#555",marginTop:1 }}>⏱ {item.pickup_start?.slice(0,5)}–{item.pickup_end?.slice(0,5)}</div>
              </div>
              <div style={{ fontWeight:750,fontSize:15,color:"#F0F0F0" }}>₸{fmt(item.discount_price)}</div>
            </div>
          );
        })}
        <div style={{ background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:17,padding:16,marginTop:6,marginBottom:16 }}>
          <div style={{ display:"flex",justifyContent:"space-between",marginBottom:7 }}>
            <span style={{ fontSize:14,color:"#666" }}>Подытог</span>
            <span style={{ fontSize:14,color:"#B0B0B0" }}>₸{fmt(total)}</span>
          </div>
          <div style={{ display:"flex",justifyContent:"space-between",paddingTop:10,borderTop:"1px solid rgba(255,255,255,0.06)" }}>
            <span style={{ fontSize:16,fontWeight:700,color:"#F0F0F0" }}>Итого</span>
            <span style={{ fontSize:18,fontWeight:820,color:"#F0F0F0",letterSpacing:"-0.5px" }}>₸{fmt(total)}</span>
          </div>
          <div style={{ display:"flex",justifyContent:"space-between",marginTop:8 }}>
            <span style={{ fontSize:13,color:"#4CAF82" }}>💰 Ты сэкономишь</span>
            <span style={{ fontSize:13,color:"#4CAF82",fontWeight:700 }}>₸{fmt(saved)}</span>
          </div>
        </div>
        <button onClick={() => setStep("payment")} style={{ width:"100%",padding:"16px",borderRadius:17,border:"none",background:"linear-gradient(135deg,#4CAF82,#2E9B6A)",color:"#fff",fontSize:16,fontWeight:700,cursor:"pointer" }}>
          Выбрать способ оплаты →
        </button>
        <div style={{ height:24 }}/>
      </div>
    </div>
  );

  if (step==="payment") return (
    <div style={{ height:"100%",display:"flex",flexDirection:"column" }}>
      <Hdr title="Способ оплаты" back={() => setStep("review")}/>
      <div style={{ flex:1,padding:"0 18px",overflowY:"auto",scrollbarWidth:"none" }}>
        <div style={{ fontSize:12,color:"#444",fontWeight:700,letterSpacing:"0.5px",marginBottom:14 }}>ВЫБЕРИ КАК ПЛАТИТЬ</div>

        {[
          { id:"kaspi", icon:Ico.kaspi(), label:"Kaspi Pay", sub:"Оплата через приложение Kaspi", badge:"Популярно", badgeColor:"#4CAF82", hoverBg:"rgba(241,70,53,0.08)", activeBg:"rgba(241,70,53,0.1)", activeBorder:"rgba(241,70,53,0.4)" },
          { id:"card", icon:Ico.card(), label:"Банковская карта", sub:"Visa, Mastercard, AmEx", badge:null, hoverBg:"rgba(76,175,130,0.06)", activeBg:"rgba(76,175,130,0.08)", activeBorder:"rgba(76,175,130,0.35)" },
        ].map(opt => (
          <div key={opt.id} onClick={() => { setMethod(opt.id); setStep(opt.id==="kaspi"?"kaspi":"card"); }}
            style={{ background:method===opt.id?opt.activeBg:"rgba(255,255,255,0.04)",border:`1.5px solid ${method===opt.id?opt.activeBorder:"rgba(255,255,255,0.08)"}`,borderRadius:18,padding:"18px 16px",marginBottom:11,cursor:"pointer",display:"flex",gap:14,alignItems:"center",transition:"all .2s" }}
            onMouseEnter={e => e.currentTarget.style.background=opt.hoverBg}
            onMouseLeave={e => e.currentTarget.style.background=method===opt.id?opt.activeBg:"rgba(255,255,255,0.04)"}
          >
            {opt.icon}
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:700,fontSize:15,color:"#F0F0F0" }}>{opt.label}</div>
              <div style={{ fontSize:12,color:"#555",marginTop:2 }}>{opt.sub}</div>
            </div>
            {opt.badge && <div style={{ fontSize:11,color:opt.badgeColor,background:`${opt.badgeColor}18`,padding:"3px 8px",borderRadius:6,fontWeight:700 }}>{opt.badge}</div>}
          </div>
        ))}

        <div style={{ background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:"13px 15px",display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:12 }}>
          <span style={{ fontSize:14,color:"#666" }}>К оплате</span>
          <span style={{ fontSize:20,fontWeight:800,color:"#F0F0F0",letterSpacing:"-0.8px" }}>₸{fmt(total)}</span>
        </div>
      </div>
    </div>
  );

  if (step==="card") return (
    <div style={{ height:"100%",display:"flex",flexDirection:"column" }}>
      <Hdr title="Данные карты" back={() => setStep("payment")}/>
      <div style={{ flex:1,padding:"0 18px",overflowY:"auto",scrollbarWidth:"none" }}>
        <div style={{ background:"linear-gradient(135deg,#1a2a1a,#0d1f0d)",border:"1px solid rgba(76,175,130,0.2)",borderRadius:20,padding:"22px 20px",marginBottom:22 }}>
          <div style={{ fontSize:11,color:"#4CAF82",fontWeight:700,letterSpacing:"1px",marginBottom:14 }}>FRESHSAVE CARD</div>
          <div style={{ fontSize:17,fontWeight:700,color:"#F0F0F0",letterSpacing:"3px",fontFamily:"monospace",marginBottom:14 }}>{cardNum||"•••• •••• •••• ••••"}</div>
          <div style={{ display:"flex",justifyContent:"space-between" }}>
            <div style={{ fontSize:11,color:"#4CAF82" }}>ДЕРЖАТЕЛЬ<br/><span style={{ color:"#F0F0F0",fontWeight:600 }}>ВАШЕ ИМЯ</span></div>
            <div style={{ fontSize:11,color:"#4CAF82",textAlign:"right" }}>СРОК<br/><span style={{ color:"#F0F0F0",fontWeight:600 }}>{cardExp||"ММ/ГГ"}</span></div>
          </div>
        </div>
        {[
          { label:"Номер карты",   val:cardNum, set:v=>setCardNum(fmtCard(v)), ph:"1234 5678 9012 3456", max:19 },
          { label:"Срок действия", val:cardExp, set:v=>setCardExp(fmtExp(v)),  ph:"ММ/ГГ",              max:5  },
          { label:"CVV / CVC",     val:cardCvc, set:v=>setCardCvc(v.replace(/\D/g,"").slice(0,3)), ph:"•••", max:3 },
        ].map((f,i) => (
          <div key={i} style={{ marginBottom:13 }}>
            <div style={{ fontSize:12,color:"#555",fontWeight:600,marginBottom:6 }}>{f.label}</div>
            <input value={f.val} onChange={e=>f.set(e.target.value)} placeholder={f.ph} maxLength={f.max}
              style={{ width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:13,padding:"13px 15px",color:"#F0F0F0",fontSize:16,fontFamily:"monospace",outline:"none",boxSizing:"border-box" }}/>
          </div>
        ))}
        <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:16,marginTop:4 }}>
          <span style={{ fontSize:13 }}>🔒</span>
          <span style={{ fontSize:12,color:"#404040" }}>Данные защищены шифрованием SSL</span>
        </div>
        <button onClick={handlePay} disabled={cardNum.length<19||cardExp.length<5||cardCvc.length<3||loading}
          style={{ width:"100%",padding:"16px",borderRadius:17,border:"none",background:cardNum.length<19||cardExp.length<5||cardCvc.length<3?"rgba(76,175,130,0.25)":"linear-gradient(135deg,#4CAF82,#2E9B6A)",color:"#fff",fontSize:16,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
          {loading?<><span style={{ animation:"spin 1s linear infinite",display:"inline-block" }}>⟳</span> Обработка...</>:`Оплатить ₸${fmt(total)}`}
        </button>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ height:24 }}/>
      </div>
    </div>
  );

  if (step==="kaspi") return (
    <div style={{ height:"100%",display:"flex",flexDirection:"column" }}>
      <Hdr title="Kaspi Pay" back={() => setStep("payment")}/>
      <div style={{ flex:1,padding:"0 18px",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center" }}>
        <div style={{ fontSize:13,color:"#555",marginBottom:18,textAlign:"center" }}>Открой Kaspi.kz → QR-оплата и отсканируй</div>
        <div style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(76,175,130,0.2)",borderRadius:24,padding:28,marginBottom:18 }}>{Ico.qr()}</div>
        <div style={{ fontSize:22,fontWeight:800,color:"#F0F0F0",letterSpacing:"-0.8px",marginBottom:4 }}>₸{fmt(total)}</div>
        <div style={{ fontSize:13,color:"#555",marginBottom:26 }}>FreshSave · {cart.length} {cart.length===1?"пакет":"пакета"}</div>
        <button onClick={handlePay} style={{ width:"100%",padding:"16px",borderRadius:17,border:"none",background:"#F14635",color:"#fff",fontSize:16,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
          {loading?"Проверка...":"Я оплатил в Kaspi ✓"}
        </button>
      </div>
    </div>
  );
}

// ── ЭКРАН УСПЕШНОГО ЗАКАЗА ────────────────────────────────────
function SuccessScreen({ data, onHome }) {
  const orderId = `FS-${Math.floor(Math.random()*90000)+10000}`;
  const [pulse, setPulse] = useState(true);
  useEffect(() => { const t = setInterval(() => setPulse(p=>!p), 900); return () => clearInterval(t); }, []);

  return (
    <div style={{ height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px 24px 40px" }}>
      <div style={{ width:70,height:70,borderRadius:22,background:"linear-gradient(135deg,#4CAF82,#2E9B6A)",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:18,boxShadow:"0 8px 32px rgba(76,175,130,0.35)" }}>{Ico.check()}</div>
      <div style={{ fontSize:24,fontWeight:800,color:"#F0F0F0",letterSpacing:"-0.8px",marginBottom:6,textAlign:"center" }}>Заказ оформлен!</div>
      <div style={{ fontSize:14,color:"#555",marginBottom:22,textAlign:"center" }}>Покажи QR-код на кассе ресторана</div>
      <div style={{ background:"rgba(255,255,255,0.03)",border:`1.5px solid rgba(76,175,130,${pulse?0.4:0.2})`,borderRadius:22,padding:24,marginBottom:18,textAlign:"center",transition:"border-color .9s" }}>
        {Ico.qr()}
        <div style={{ fontSize:13,color:"#4CAF82",fontWeight:700,marginTop:12,letterSpacing:"2px" }}>{orderId}</div>
      </div>
      <div style={{ width:"100%",background:"rgba(76,175,130,0.07)",border:"1px solid rgba(76,175,130,0.15)",borderRadius:17,padding:16,marginBottom:20 }}>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
          {[{icon:"💰",label:"Сэкономлено",val:`₸${fmt(data.saved)}`},{icon:"🌱",label:"CO₂ спасено",val:`${data.co2.toFixed(1)} кг`}].map((s,i)=>(
            <div key={i} style={{ textAlign:"center" }}>
              <div style={{ fontSize:20,marginBottom:4 }}>{s.icon}</div>
              <div style={{ fontSize:17,fontWeight:750,color:"#4CAF82",letterSpacing:"-0.4px" }}>{s.val}</div>
              <div style={{ fontSize:11,color:"#3E3E3E",marginTop:2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
      <button onClick={onHome} style={{ width:"100%",padding:"16px",borderRadius:17,border:"1px solid rgba(255,255,255,0.1)",background:"rgba(255,255,255,0.05)",color:"#F0F0F0",fontSize:16,fontWeight:600,cursor:"pointer" }}>
        На главную
      </button>
    </div>
  );
}

// ── ГЛАВНЫЙ РОУТЕР ────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("home");
  const [detail, setDetail] = useState(null);
  const [cart, setCart] = useState([]);
  const [screen, setScreen] = useState("main");
  const [orderData, setOrderData] = useState(null);

  const handleSuccess = (data) => { setOrderData(data); setCart([]); setScreen("success"); };
  const goHome = () => { setScreen("main"); setTab("home"); setDetail(null); };

  const render = () => {
    if (screen==="success") return <SuccessScreen data={orderData} onHome={goHome}/>;
    if (screen==="checkout") return <CheckoutScreen cart={cart} onBack={() => setScreen("main")} onSuccess={handleSuccess}/>;
    if (detail) return <DetailScreen listing={detail} onBack={() => setDetail(null)} cart={cart} setCart={setCart}/>;
    if (tab==="home") return <HomeScreen onOpen={setDetail}/>;
    if (tab==="map") return <div style={{ height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32 }}><div style={{ fontSize:48,marginBottom:14 }}>🗺️</div><div style={{ fontSize:18,fontWeight:700,color:"#444" }}>Карта</div><div style={{ fontSize:13,color:"#333",marginTop:8,textAlign:"center" }}>Подключим Яндекс Maps API<br/>на следующем шаге</div></div>;
    if (tab==="cart") return <CartScreen cart={cart} setCart={setCart} onCheckout={() => setScreen("checkout")}/>;
    if (tab==="profile") return (
      <div style={{ height:"100%",padding:"50px 18px",overflowY:"auto" }}>
        <div style={{ fontSize:26,fontWeight:820,color:"#F0F0F0",letterSpacing:"-0.8px",marginBottom:22 }}>Профиль</div>
        <div style={{ display:"flex",alignItems:"center",gap:13,marginBottom:26 }}>
          <div style={{ width:58,height:58,borderRadius:18,background:"linear-gradient(135deg,#4CAF82,#2E9B6A)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,fontWeight:800,color:"#fff" }}>Д</div>
          <div><div style={{ fontWeight:700,fontSize:18,color:"#F0F0F0" }}>Даурен</div><div style={{ fontSize:13,color:"#555",marginTop:2 }}>+7 777 000 00 00</div></div>
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:9 }}>
          {[{icon:"🛍️",v:"0",l:"Заказов"},{icon:"🌱",v:"0 кг",l:"CO₂ спасено"},{icon:"💰",v:"₸0",l:"Сэкономлено"},{icon:"🍽️",v:"0",l:"Порций спасено"}].map((s,i)=>(
            <div key={i} style={{ background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:15,padding:"13px 15px" }}>
              <div style={{ fontSize:19,marginBottom:5 }}>{s.icon}</div>
              <div style={{ fontSize:17,fontWeight:750,color:"#F0F0F0",letterSpacing:"-0.4px" }}>{s.v}</div>
              <div style={{ fontSize:11,color:"#444",marginTop:2 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const navItems = [
    { id:"home",    label:"Главная", icon:a=>Ico.home(a) },
    { id:"map",     label:"Карта",   icon:a=>Ico.map(a) },
    { id:"cart",    label:"Корзина", icon:a=>Ico.bag(a, cart.length) },
    { id:"profile", label:"Профиль", icon:a=>Ico.user(a) },
  ];

  const hideNav = screen!=="main" || !!detail;

  return (
    <div style={{ minHeight:"100vh",background:"#070709",display:"flex",justifyContent:"center",alignItems:"flex-start",padding:"24px 0 40px",fontFamily:"-apple-system,'SF Pro Text',BlinkMacSystemFont,sans-serif" }}>
      <div style={{ width:393,height:852,background:"#0D0D0F",borderRadius:54,overflow:"hidden",position:"relative",display:"flex",flexDirection:"column",boxShadow:"0 50px 120px rgba(0,0,0,0.7),0 0 0 1px rgba(255,255,255,0.1),inset 0 0 0 1px rgba(255,255,255,0.05)" }}>
        <div style={{ position:"absolute",top:13,left:"50%",transform:"translateX(-50%)",width:116,height:32,background:"#080808",borderRadius:18,zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",gap:5 }}>
          <div style={{ width:9,height:9,borderRadius:"50%",background:"#181818" }}/>
          <div style={{ width:56,height:4,borderRadius:3,background:"#141414" }}/>
        </div>
        <div style={{ flex:1,overflow:"hidden",position:"relative" }}>{render()}</div>
        {!hideNav && (
          <div style={{ flexShrink:0,background:"rgba(13,13,15,0.96)",backdropFilter:"blur(20px)",borderTop:"1px solid rgba(255,255,255,0.055)",padding:"9px 0 20px",display:"flex",justifyContent:"space-around" }}>
            {navItems.map(t => {
              const a = tab===t.id;
              return (
                <button key={t.id} onClick={() => { setDetail(null); setTab(t.id); }}
                  style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:4,background:"none",border:"none",cursor:"pointer",padding:"4px 16px",transition:"transform .14s" }}
                  onMouseEnter={e=>e.currentTarget.style.transform="scale(1.12)"}
                  onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}
                >
                  {t.icon(a)}
                  <span style={{ fontSize:10,color:a?"#4CAF82":"#404040",fontWeight:a?600:400 }}>{t.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
