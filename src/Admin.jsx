// ============================================================
// FRESHSAVE — Админ-панель для ресторанов
// Файл: src/Admin.jsx
//
// Как подключить:
// 1. Положи этот файл в src/Admin.jsx
// 2. В src/main.jsx добавь роутинг (инструкция ниже)
// ============================================================

import { useState, useEffect } from "react";

const SUPABASE_URL = "https://wmkhgvgzfdpoalrkbrkt.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indta2hndmd6ZmRwb2Fscmticmt0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzODgxNTIsImV4cCI6MjA5NDk2NDE1Mn0.7sp1-26TR8nERs1lPQ7-mjNhzBzkm4hEgxgoFw_FDic";

// Простой пароль для входа — потом заменим на нормальную авторизацию
const ADMIN_PASSWORD = "freshsave2024";

const fmt = (n) => n?.toLocaleString("ru-RU") ?? "0";

// ── SUPABASE ЗАПРОСЫ ─────────────────────────────────────────
async function getRestaurants() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/restaurants?select=*&is_active=eq.true&order=name.asc`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  return res.json();
}

async function getListings(restaurantId) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/listings?select=*&restaurant_id=eq.${restaurantId}&date=eq.${today()}&order=created_at.desc`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  return res.json();
}

async function createListing(data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/listings`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(data),
  });
  return res.json();
}

async function deleteListing(id) {
  await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${id}`, {
    method: "DELETE",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
}

async function updateListing(id, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/listings?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(data),
  });
  return res.json();
}

const today = () => new Date().toISOString().split("T")[0];

// ── СТИЛИ ────────────────────────────────────────────────────
const S = {
  input: {
    width: "100%",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 12,
    padding: "12px 14px",
    color: "#F0F0F0",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
  },
  label: {
    fontSize: 12,
    color: "#555",
    fontWeight: 600,
    letterSpacing: "0.4px",
    marginBottom: 6,
    display: "block",
  },
  btn: {
    padding: "13px 20px",
    borderRadius: 13,
    border: "none",
    background: "linear-gradient(135deg,#4CAF82,#2E9B6A)",
    color: "#fff",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    transition: "opacity .2s",
  },
  btnDanger: {
    padding: "7px 12px",
    borderRadius: 9,
    border: "1px solid rgba(255,107,107,0.25)",
    background: "rgba(255,107,107,0.1)",
    color: "#ff6b6b",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
  card: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 18,
    padding: 20,
    marginBottom: 12,
  },
};

// ── ЭКРАН ВХОДА ───────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  const handle = () => {
    if (password === ADMIN_PASSWORD) {
      onLogin();
    } else {
      setError(true);
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#0A0A0C",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "-apple-system,'SF Pro Text',sans-serif",
    }}>
      <div style={{
        width: 360, padding: 36,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 24,
        animation: shake ? "shake .4s ease" : "none",
      }}>
        <style>{`
          @keyframes shake {
            0%,100%{transform:translateX(0)}
            20%{transform:translateX(-8px)}
            40%{transform:translateX(8px)}
            60%{transform:translateX(-5px)}
            80%{transform:translateX(5px)}
          }
        `}</style>

        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🍽️</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#F0F0F0", letterSpacing: "-0.6px" }}>
            Fresh<span style={{ color: "#4CAF82" }}>Save</span>
          </div>
          <div style={{ fontSize: 13, color: "#555", marginTop: 4 }}>Панель управления рестораном</div>
        </div>

        <label style={S.label}>Пароль доступа</label>
        <input
          type="password"
          value={password}
          onChange={e => { setPassword(e.target.value); setError(false); }}
          onKeyDown={e => e.key === "Enter" && handle()}
          placeholder="Введите пароль..."
          style={{ ...S.input, borderColor: error ? "rgba(255,107,107,0.4)" : "rgba(255,255,255,0.1)", marginBottom: 16 }}
        />
        {error && <div style={{ fontSize: 12, color: "#ff6b6b", marginBottom: 12, marginTop: -8 }}>Неверный пароль</div>}

        <button onClick={handle} style={{ ...S.btn, width: "100%" }}>Войти →</button>

        <div style={{ fontSize: 11, color: "#333", textAlign: "center", marginTop: 16 }}>
          Для MVP пароль: freshsave2024
        </div>
      </div>
    </div>
  );
}

// ── ФОРМА ДОБАВЛЕНИЯ ЛОТА ─────────────────────────────────────
function AddListingForm({ restaurant, onAdded }) {
  const [form, setForm] = useState({
    title: "Вечерний сет",
    items: "",
    original_price: "",
    discount_price: "",
    pickup_start: "19:00",
    pickup_end: "21:00",
    quantity_total: "5",
    tag: "Горячее",
    co2_saved: "1.0",
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const set = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const discount = form.original_price && form.discount_price
    ? Math.round((1 - form.discount_price / form.original_price) * 100)
    : 0;

  const handle = async () => {
    if (!form.items || !form.original_price || !form.discount_price) return;
    setLoading(true);
    try {
      await createListing({
        restaurant_id: restaurant.id,
        title: form.title,
        items: form.items.split("\n").map(s => s.trim()).filter(Boolean),
        original_price: parseInt(form.original_price),
        discount_price: parseInt(form.discount_price),
        pickup_start: form.pickup_start,
        pickup_end: form.pickup_end,
        quantity_total: parseInt(form.quantity_total),
        quantity_left: parseInt(form.quantity_total),
        tag: form.tag,
        co2_saved: parseFloat(form.co2_saved),
        is_active: true,
        date: today(),
      });
      setSuccess(true);
      setTimeout(() => { setSuccess(false); onAdded(); }, 1500);
      setForm(p => ({ ...p, items: "", original_price: "", discount_price: "" }));
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const TAGS = ["Горячее", "Салаты", "Выпечка", "Суши", "Десерты"];

  return (
    <div style={S.card}>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#F0F0F0", marginBottom: 18, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 18 }}>{restaurant.emoji}</span> {restaurant.name} — новый лот
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label style={S.label}>Обычная цена (₸)</label>
          <input value={form.original_price} onChange={e => set("original_price", e.target.value)}
            placeholder="3200" style={S.input} type="number"/>
        </div>
        <div>
          <label style={S.label}>Цена со скидкой (₸)</label>
          <input value={form.discount_price} onChange={e => set("discount_price", e.target.value)}
            placeholder="1100" style={S.input} type="number"/>
        </div>
      </div>

      {discount > 0 && (
        <div style={{ background: "rgba(76,175,130,0.1)", border: "1px solid rgba(76,175,130,0.2)", borderRadius: 10, padding: "8px 14px", marginBottom: 12, fontSize: 13, color: "#4CAF82", fontWeight: 600 }}>
          🎉 Скидка {discount}% — экономия ₸{fmt(form.original_price - form.discount_price)}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label style={S.label}>Начало выдачи</label>
          <input value={form.pickup_start} onChange={e => set("pickup_start", e.target.value)}
            type="time" style={S.input}/>
        </div>
        <div>
          <label style={S.label}>Конец выдачи</label>
          <input value={form.pickup_end} onChange={e => set("pickup_end", e.target.value)}
            type="time" style={S.input}/>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div>
          <label style={S.label}>Количество пакетов</label>
          <input value={form.quantity_total} onChange={e => set("quantity_total", e.target.value)}
            placeholder="5" style={S.input} type="number" min="1" max="50"/>
        </div>
        <div>
          <label style={S.label}>Категория</label>
          <select value={form.tag} onChange={e => set("tag", e.target.value)}
            style={{ ...S.input, appearance: "none" }}>
            {TAGS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={S.label}>Состав пакета (каждая позиция с новой строки)</label>
        <textarea
          value={form.items}
          onChange={e => set("items", e.target.value)}
          placeholder={"Лапша с говядиной\nДимсамы (6 шт)\nВесенний ролл\nСуп том ям"}
          rows={4}
          style={{ ...S.input, resize: "vertical", lineHeight: 1.6 }}
        />
      </div>

      <button
        onClick={handle}
        disabled={loading || success || !form.items || !form.original_price || !form.discount_price}
        style={{
          ...S.btn, width: "100%",
          background: success ? "#4CAF82" : "linear-gradient(135deg,#4CAF82,#2E9B6A)",
          opacity: (!form.items || !form.original_price || !form.discount_price) ? 0.4 : 1,
        }}
      >
        {loading ? "Сохраняем..." : success ? "✓ Лот добавлен!" : "Опубликовать лот"}
      </button>
    </div>
  );
}

// ── КАРТОЧКА АКТИВНОГО ЛОТА ───────────────────────────────────
function ListingCard({ listing, onDelete, onToggle }) {
  const pct = Math.round((1 - listing.discount_price / listing.original_price) * 100);
  const sold = listing.quantity_total - listing.quantity_left;

  return (
    <div style={{
      ...S.card,
      border: listing.is_active ? "1px solid rgba(76,175,130,0.2)" : "1px solid rgba(255,255,255,0.06)",
      opacity: listing.is_active ? 1 : 0.5,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#F0F0F0" }}>{listing.title}</div>
          <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>
            ⏱ {listing.pickup_start?.slice(0,5)}–{listing.pickup_end?.slice(0,5)} · {listing.tag}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ background: "#4CAF8220", border: "1px solid #4CAF8240", borderRadius: 8, padding: "3px 9px", fontSize: 12, fontWeight: 800, color: "#4CAF82" }}>
            −{pct}%
          </div>
        </div>
      </div>

      {/* Позиции */}
      <div style={{ marginBottom: 12 }}>
        {(listing.items || []).map((item, i) => (
          <div key={i} style={{ fontSize: 13, color: "#888", padding: "3px 0", borderBottom: i < listing.items.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
            · {item}
          </div>
        ))}
      </div>

      {/* Цена и прогресс */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div>
          <span style={{ fontSize: 18, fontWeight: 800, color: "#F0F0F0" }}>₸{fmt(listing.discount_price)}</span>
          <span style={{ fontSize: 13, color: "#3A3A3A", textDecoration: "line-through", marginLeft: 8 }}>₸{fmt(listing.original_price)}</span>
        </div>
        <div style={{ fontSize: 13, color: "#666" }}>
          Продано: <span style={{ color: sold > 0 ? "#4CAF82" : "#666", fontWeight: 600 }}>{sold}</span> / {listing.quantity_total}
        </div>
      </div>

      {/* Прогресс-бар */}
      <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 6, height: 6, marginBottom: 14 }}>
        <div style={{
          height: 6, borderRadius: 6,
          background: sold === listing.quantity_total ? "#FF6B35" : "#4CAF82",
          width: `${(sold / listing.quantity_total) * 100}%`,
          transition: "width .3s ease",
        }}/>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => onToggle(listing)} style={{
          ...S.btnDanger,
          borderColor: listing.is_active ? "rgba(255,107,107,0.25)" : "rgba(76,175,130,0.25)",
          color: listing.is_active ? "#ff6b6b" : "#4CAF82",
          background: listing.is_active ? "rgba(255,107,107,0.08)" : "rgba(76,175,130,0.08)",
          flex: 1,
        }}>
          {listing.is_active ? "⏸ Снять с публикации" : "▶ Опубликовать снова"}
        </button>
        <button onClick={() => onDelete(listing.id)} style={{ ...S.btnDanger, padding: "7px 14px" }}>
          🗑
        </button>
      </div>
    </div>
  );
}

// ── ГЛАВНАЯ ПАНЕЛЬ ────────────────────────────────────────────
function Dashboard() {
  const [restaurants, setRestaurants] = useState([]);
  const [selected, setSelected] = useState(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("add"); // "add" | "active"

  useEffect(() => {
    getRestaurants().then(data => {
      setRestaurants(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  }, []);

  const loadListings = async (r) => {
    const data = await getListings(r.id);
    setListings(Array.isArray(data) ? data : []);
  };

  const selectRestaurant = (r) => {
    setSelected(r);
    loadListings(r);
  };

  const handleDelete = async (id) => {
    if (!confirm("Удалить этот лот?")) return;
    await deleteListing(id);
    loadListings(selected);
  };

  const handleToggle = async (listing) => {
    await updateListing(listing.id, { is_active: !listing.is_active });
    loadListings(selected);
  };

  const totalSold = listings.reduce((s, l) => s + (l.quantity_total - l.quantity_left), 0);
  const totalRevenue = listings.reduce((s, l) => s + (l.quantity_total - l.quantity_left) * l.discount_price, 0);

  return (
    <div style={{
      minHeight: "100vh", background: "#0A0A0C",
      fontFamily: "-apple-system,'SF Pro Text',sans-serif",
      color: "#F0F0F0",
    }}>
      {/* Хедер */}
      <div style={{
        background: "rgba(13,13,15,0.95)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        padding: "16px 24px", display: "flex", alignItems: "center", gap: 12,
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ fontSize: 20 }}>🍽️</div>
        <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.5px" }}>
          Fresh<span style={{ color: "#4CAF82" }}>Save</span>
          <span style={{ fontSize: 12, color: "#555", fontWeight: 500, marginLeft: 8 }}>Панель ресторана</span>
        </div>
        {selected && (
          <div style={{ marginLeft: "auto", fontSize: 13, color: "#4CAF82", fontWeight: 600 }}>
            {selected.emoji} {selected.name}
          </div>
        )}
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "24px 20px" }}>

        {/* Выбор ресторана */}
        {!selected ? (
          <>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#F0F0F0", letterSpacing: "-0.5px", marginBottom: 6 }}>
              Выбери свой ресторан
            </div>
            <div style={{ fontSize: 13, color: "#555", marginBottom: 20 }}>
              Для добавления лотов на сегодня
            </div>

            {loading ? (
              <div style={{ textAlign: "center", padding: 40, color: "#444" }}>Загружаем...</div>
            ) : (
              restaurants.map(r => (
                <div key={r.id} onClick={() => selectRestaurant(r)} style={{
                  ...S.card, cursor: "pointer", display: "flex", alignItems: "center", gap: 14,
                  transition: "background .2s",
                }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.07)"}
                  onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
                >
                  <div style={{ width: 48, height: 48, borderRadius: 13, background: `${r.accent_color}18`, border: `1px solid ${r.accent_color}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                    {r.emoji}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 650, fontSize: 15, color: "#EFEFEF" }}>{r.name}</div>
                    <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>{r.cuisine} · {r.address}</div>
                  </div>
                  <div style={{ fontSize: 18, color: "#333" }}>→</div>
                </div>
              ))
            )}
          </>
        ) : (
          <>
            {/* Кнопка назад */}
            <button onClick={() => setSelected(null)} style={{
              background: "none", border: "none", color: "#4CAF82", fontSize: 13,
              cursor: "pointer", marginBottom: 16, padding: 0, display: "flex", alignItems: "center", gap: 6,
            }}>
              ← Сменить ресторан
            </button>

            {/* Статистика дня */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
              {[
                { icon: "📦", label: "Лотов сегодня", val: listings.length },
                { icon: "✅", label: "Продано", val: totalSold },
                { icon: "💰", label: "Выручка", val: `₸${fmt(totalRevenue)}` },
              ].map((s, i) => (
                <div key={i} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "14px 16px" }}>
                  <div style={{ fontSize: 18, marginBottom: 4 }}>{s.icon}</div>
                  <div style={{ fontSize: 16, fontWeight: 750, color: "#F0F0F0", letterSpacing: "-0.4px" }}>{s.val}</div>
                  <div style={{ fontSize: 11, color: "#444", marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Табы */}
            <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
              {[
                { id: "add", label: "➕ Добавить лот" },
                { id: "active", label: `📋 Активные (${listings.length})` },
              ].map(t => (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  padding: "9px 16px", borderRadius: 12, border: "none", cursor: "pointer",
                  background: tab === t.id ? "#4CAF82" : "rgba(255,255,255,0.06)",
                  color: tab === t.id ? "#fff" : "#666",
                  fontSize: 13, fontWeight: tab === t.id ? 700 : 500,
                  transition: "all .2s",
                }}>{t.label}</button>
              ))}
            </div>

            {/* Контент */}
            {tab === "add" && (
              <AddListingForm
                restaurant={selected}
                onAdded={() => { loadListings(selected); setTab("active"); }}
              />
            )}

            {tab === "active" && (
              <>
                {listings.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 20px" }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                    <div style={{ fontSize: 16, color: "#444" }}>Нет активных лотов на сегодня</div>
                    <button onClick={() => setTab("add")} style={{ ...S.btn, marginTop: 16 }}>
                      Добавить первый →
                    </button>
                  </div>
                ) : (
                  listings.map(l => (
                    <ListingCard
                      key={l.id}
                      listing={l}
                      onDelete={handleDelete}
                      onToggle={handleToggle}
                    />
                  ))
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── ГЛАВНЫЙ ЭКСПОРТ ───────────────────────────────────────────
export default function Admin() {
  const [loggedIn, setLoggedIn] = useState(
    sessionStorage.getItem("fs_admin") === "true"
  );

  const handleLogin = () => {
    sessionStorage.setItem("fs_admin", "true");
    setLoggedIn(true);
  };

  return loggedIn ? <Dashboard /> : <LoginScreen onLogin={handleLogin} />;
}
