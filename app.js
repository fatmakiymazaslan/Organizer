const STORAGE_KEY = "salon-ajanda-state-v1";
const SUPABASE_CDN_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
const SUPABASE_TABLES = {
  reservations: "reservations",
  prices: "prices"
};

const USERS = [
  { id: "sule-k", name: "Şule K.", email: "sule@1453partyhouse.com" },
  { id: "mustafa-k", name: "Mustafa K.", email: "mustafa@1453partyhouse.com" },
  { id: "yahya-s", name: "Yahya S.", email: "yahya@1453partyhouse.com" },
  { id: "gamze-s", name: "Gamze S.", email: "gamze@1453partyhouse.com" }
];

const EVENT_TYPES = [
  "Nişan",
  "Kına",
  "Düğün",
  "Söz",
  "Mezuniyet",
  "Asker Gecesi",
  "Bride",
  "Baby Shower",
  "Doğum Günü"
];

const CATERING_OPTIONS = ["Sadece kuruyemiş", "Ordövr tabak", "Yemekli menü", "Pasta + içecek"];
const GUEST_PRESETS = [60, 80, 100, 130];
const SLOTS = [
  { id: "day", label: "Gündüz" },
  { id: "night", label: "Akşam" }
];

const DEFAULT_PRICES = [
  { id: "price-1", eventType: "Tüm etkinlikler", guestCount: 60, catering: "Sadece kuruyemiş", amount: 22000 },
  { id: "price-2", eventType: "Tüm etkinlikler", guestCount: 80, catering: "Sadece kuruyemiş", amount: 26000 },
  { id: "price-3", eventType: "Tüm etkinlikler", guestCount: 100, catering: "Sadece kuruyemiş", amount: 30000 },
  { id: "price-4", eventType: "Tüm etkinlikler", guestCount: 130, catering: "Sadece kuruyemiş", amount: 37000 },
  { id: "price-5", eventType: "Tüm etkinlikler", guestCount: 60, catering: "Ordövr tabak", amount: 30000 },
  { id: "price-6", eventType: "Tüm etkinlikler", guestCount: 80, catering: "Ordövr tabak", amount: 36000 },
  { id: "price-7", eventType: "Tüm etkinlikler", guestCount: 100, catering: "Ordövr tabak", amount: 42000 },
  { id: "price-8", eventType: "Tüm etkinlikler", guestCount: 130, catering: "Ordövr tabak", amount: 52000 }
];

const app = document.querySelector("#app");

let state = loadState();
let supabaseConfig = loadSupabaseConfig();
let supabaseClient = null;
let authSubscription = null;
let supabaseLibraryPromise = null;
let cloud = {
  configured: false,
  clientReady: false,
  signedIn: false,
  loading: false,
  userEmail: "",
  message: "Supabase ayarı bekleniyor.",
  lastSyncAt: ""
};
let modal = null;
let toastTimer = null;

function loadState() {
  const today = toISODate(new Date());
  const currentMonth = today.slice(0, 7);
  const defaults = {
    activeTab: "agenda",
    currentUserId: "",
    selectedDate: today,
    visibleMonth: currentMonth,
    reservations: [],
    prices: DEFAULT_PRICES
  };

  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return { ...defaults, ...(stored || {}) };
  } catch {
    return defaults;
  }
}

function saveState() {
  const persisted = { ...state };
  delete persisted.pendingUserId;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
}

function loadSupabaseConfig() {
  const fileConfig = window.PARTY_HOUSE_SUPABASE || {};
  return {
    url: normalizeConfigValue(fileConfig.url),
    anonKey: normalizeConfigValue(fileConfig.anonKey)
  };
}

function normalizeConfigValue(value) {
  return String(value || "").trim();
}

function isSupabaseConfigured(config = supabaseConfig) {
  const url = normalizeConfigValue(config.url);
  const anonKey = normalizeConfigValue(config.anonKey);
  return url.startsWith("https://") && anonKey.length > 40;
}

function shouldShowLogin() {
  return !cloud.signedIn || !state.currentUserId;
}

function render() {
  if (shouldShowLogin()) {
    renderLogin();
    return;
  }

  app.innerHTML = `
    <header class="topbar">
      <div class="brand-row">
        <div class="brand">
          <div class="brand-mark">1453</div>
          <div>
            <h1>1453 Party House</h1>
            <p>Rezervasyon, müşteri ve fiyat takibi</p>
          </div>
        </div>
        <div class="topbar-actions">
          ${renderSyncBadge()}
          <button class="user-chip" type="button" data-action="logout" title="Oturumu kapat">
            <span class="user-avatar" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none">
                <circle cx="12" cy="8" r="4" fill="currentColor" />
                <path d="M4 20c0-4.4 3.6-7 8-7s8 2.6 8 7" fill="currentColor" />
              </svg>
            </span>
            <span>${escapeHTML(getCurrentUser().name)}</span>
          </button>
        </div>
      </div>
      <nav class="toolbar" aria-label="Uygulama sayfaları">
        ${tabButton("agenda", "Ajanda")}
        ${tabButton("reservations", "Kayıtlar")}
        ${tabButton("prices", "Fiyatlar")}
        ${tabButton("settings", "Ayarlar")}
      </nav>
    </header>

    <main class="layout">
      ${renderCloudNotice()}
      ${renderStats()}
      ${state.activeTab === "agenda" ? renderAgenda() : ""}
      ${state.activeTab === "reservations" ? renderReservationList() : ""}
      ${state.activeTab === "prices" ? renderPrices() : ""}
      ${state.activeTab === "settings" ? renderSettings() : ""}
    </main>
  `;

  bindAppEvents();
}

function renderLogin() {
  const selected = state.pendingUserId || state.currentUserId || USERS[0].id;
  const configured = isSupabaseConfigured();

  app.innerHTML = `
    <main class="login-screen">
      <section class="login-card">
        <div class="brand-mark">1453</div>
        <h1>1453 Party House</h1>
        <p>Rezervasyon ajandasına giriş yap</p>
        ${renderLoginStatus()}
        ${cloud.signedIn ? renderUnauthorizedLogin() : configured ? renderSupabaseLogin(selected) : ""}
      </section>
    </main>
  `;

  app.querySelectorAll("[data-login-user]").forEach((button) => {
    button.addEventListener("click", () => {
      state.pendingUserId = button.dataset.loginUser;
      renderLogin();
    });
  });

  const authForm = app.querySelector("[data-auth-form]");
  if (authForm) {
    authForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      await handleSupabaseAuth(authForm);
    });
  }

  const logoutButton = app.querySelector('[data-action="auth-logout"]');
  if (logoutButton) {
    logoutButton.addEventListener("click", () => signOut());
  }
}

function renderLoginStatus() {
  if (
    cloud.clientReady &&
    !cloud.loading &&
    !cloud.signedIn &&
    cloud.message === "Supabase hazır, giriş bekleniyor."
  ) {
    return "";
  }

  const status = getCloudStatus();
  return `
    <div class="connection-status ${status.className}">
      <strong>${escapeHTML(status.title)}</strong>
      <span>${escapeHTML(status.message)}</span>
    </div>
  `;
}

function renderUnauthorizedLogin() {
  return `
    <div class="auth-actions login-logout-action">
      <button class="ghost-button" type="button" data-action="auth-logout">Başka hesapla giriş yap</button>
    </div>
  `;
}

function renderSupabaseLogin(selected) {
  const disabled = cloud.loading || !cloud.clientReady;
  const selectedUser = USERS.find((user) => user.id === selected) || USERS[0];
  return `
    <form class="auth-form" data-auth-form>
      ${renderTeamPicker(selected)}
      <input name="email" type="hidden" value="${escapeAttr(selectedUser.email)}" />
      <div class="field login-password-field">
        <label for="authPassword">${escapeHTML(selectedUser.name)} için şifre</label>
        <input id="authPassword" name="password" type="password" autocomplete="current-password" minlength="6" placeholder="Şifreni yaz" required autofocus />
      </div>
      <div class="auth-actions">
        <button class="primary-button" type="submit" ${disabled ? "disabled" : ""}>Giriş yap</button>
      </div>
    </form>
  `;
}

function renderTeamPicker(selected) {
  return `
    <div class="login-users" role="group" aria-label="Ekip üyesi seçimi">
      ${USERS.map(
        (user) => `
          <button class="login-user ${selected === user.id ? "is-active" : ""}" type="button" data-login-user="${user.id}" aria-pressed="${selected === user.id}">
            <span class="login-user-avatar" aria-hidden="true">${escapeHTML(user.name.charAt(0))}</span>
            <span class="login-user-copy">
              <strong>${escapeHTML(user.name)}</strong>
              <small>${escapeHTML(user.email)}</small>
            </span>
            <span class="login-user-check" aria-hidden="true">${selected === user.id ? "✓" : ""}</span>
          </button>
        `
      ).join("")}
    </div>
  `;
}

function tabButton(tab, label) {
  return `
    <button class="tab-button ${state.activeTab === tab ? "is-active" : ""}" type="button" data-tab="${tab}">
      ${label}
    </button>
  `;
}

function renderSyncBadge() {
  const status = getCloudStatus();
  return `<span class="sync-badge ${status.className}" title="${escapeAttr(status.message)}">${escapeHTML(status.badge)}</span>`;
}

function renderCloudNotice() {
  if (isSupabaseConfigured() && cloud.signedIn && !cloud.loading && !cloud.message) return "";
  if (isSupabaseConfigured() && cloud.signedIn && !cloud.loading) return "";

  const status = getCloudStatus();
  return `
    <section class="sync-banner ${status.className}">
      <strong>${escapeHTML(status.title)}</strong>
      <span>${escapeHTML(status.message)}</span>
    </section>
  `;
}

function getCloudStatus() {
  if (!isSupabaseConfigured()) {
    return {
      className: "is-error",
      badge: "Bağlantı yok",
      title: "Bağlantı yapılandırılmamış",
      message: "supabase-config.js dosyasındaki proje bilgilerini kontrol et."
    };
  }

  if (!cloud.clientReady) {
    return {
      className: "is-warning",
      badge: "Hazırlanıyor",
      title: "Supabase hazırlanıyor",
      message: cloud.message || "Bağlantı bilgileri kontrol ediliyor."
    };
  }

  if (cloud.loading) {
    return {
      className: "is-warning",
      badge: "Senkron",
      title: "Bulut senkronu sürüyor",
      message: cloud.message || "Supabase verileri alınıyor."
    };
  }

  if (cloud.signedIn && !state.currentUserId) {
    return {
      className: "is-error",
      badge: "Yetkisiz hesap",
      title: "Bu hesap tanımlı değil",
      message: cloud.message || "Yalnızca tanımlı ekip üyeleri giriş yapabilir."
    };
  }

  if (cloud.signedIn) {
    return {
      className: "is-ok",
      badge: "Güncel",
      title: "Buluta bağlı",
      message: `${cloud.userEmail || "Oturum açık"} · ${formatSyncTime()}`
    };
  }

  return {
    className: "is-warning",
    badge: "Giriş bekleniyor",
    title: "Giriş yap",
    message: cloud.message || "Ekip üyesini seçip şifreni yaz."
  };
}

function renderStats() {
  const monthReservations = state.reservations.filter((reservation) => reservation.date.startsWith(state.visibleMonth));
  const monthRevenue = monthReservations.reduce((sum, reservation) => sum + Number(reservation.amount || 0), 0);
  const upcoming = [...state.reservations]
    .filter((reservation) => reservation.date >= toISODate(new Date()))
    .sort(sortReservationDate)[0];
  const selectedReservations = state.reservations.filter((reservation) => reservation.date === state.selectedDate);

  return `
    <section class="stats-grid" aria-label="Özet bilgiler">
      <article class="stat-card">
        <p class="stat-label">Bu ay</p>
        <p class="stat-value">${monthReservations.length}</p>
        <p class="stat-note">rezervasyon</p>
      </article>
      <article class="stat-card">
        <p class="stat-label">Aylık tutar</p>
        <p class="stat-value">${formatTRY(monthRevenue)}</p>
        <p class="stat-note">anlaşılan toplam</p>
      </article>
      <article class="stat-card">
        <p class="stat-label">Sıradaki</p>
        <p class="stat-value">${upcoming ? shortDate(upcoming.date) : "-"}</p>
        <p class="stat-note">${upcoming ? `${slotLabel(upcoming.slot)} · ${upcoming.eventType}` : "kayıt yok"}</p>
      </article>
      <article class="stat-card">
        <p class="stat-label">Seçili gün</p>
        <p class="stat-value">${selectedReservations.length}/2</p>
        <p class="stat-note">${longDate(state.selectedDate)}</p>
      </article>
    </section>
  `;
}

function renderAgenda() {
  return `
    <section class="main-grid">
      <article class="panel">
        <div class="panel-header">
          <div class="panel-title">
            <h2>${monthTitle(state.visibleMonth)}</h2>
            <p>Gündüz ve akşam durumunu aynı ekranda takip et</p>
          </div>
          <div class="panel-actions">
            <button class="icon-button" type="button" data-action="prev-month" title="Önceki ay">‹</button>
            <button class="icon-button" type="button" data-action="next-month" title="Sonraki ay">›</button>
          </div>
        </div>
        <div class="calendar">
          ${renderCalendar()}
        </div>
      </article>
      <article class="panel">
        <div class="panel-header">
          <div class="panel-title">
            <h2>${longDate(state.selectedDate)}</h2>
            <p>${selectedDaySubtitle()}</p>
          </div>
          <button class="primary-button" type="button" data-action="new-reservation">Yeni kayıt</button>
        </div>
        <div class="day-detail">
          ${renderSelectedDaySlots()}
        </div>
      </article>
    </section>
  `;
}

function renderCalendar() {
  const dates = calendarDates(state.visibleMonth);
  return `
    <div class="weekday-grid" aria-hidden="true">
      ${["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"].map((day) => `<div class="weekday">${day}</div>`).join("")}
    </div>
    <div class="calendar-grid">
      ${dates.map((date) => renderDayCell(date)).join("")}
    </div>
  `;
}

function renderDayCell(date) {
  const iso = toISODate(date);
  const month = state.visibleMonth;
  const isCurrentMonth = iso.startsWith(month);
  const isSelected = iso === state.selectedDate;
  const isToday = iso === toISODate(new Date());
  const dayReservations = state.reservations.filter((reservation) => reservation.date === iso);
  const slots = SLOTS.map((slot) => ({
    ...slot,
    reservation: dayReservations.find((reservation) => reservation.slot === slot.id)
  }));

  return `
    <button class="day-cell ${isCurrentMonth ? "" : "is-muted"} ${isSelected ? "is-selected" : ""} ${isToday ? "is-today" : ""}"
      type="button"
      data-date="${iso}">
      <span class="day-number">${date.getDate()}</span>
      <span class="slot-dots">
        ${slots
          .map(
            (slot) => `
              <span class="slot-dot ${slot.reservation ? "is-full" : ""}">
                ${slot.label.slice(0, 1)} ${slot.reservation ? slot.reservation.eventType : "Boş"}
              </span>
            `
          )
          .join("")}
      </span>
    </button>
  `;
}

function renderSelectedDaySlots() {
  const reservations = state.reservations.filter((reservation) => reservation.date === state.selectedDate);

  return `
    <div class="slot-list">
      ${SLOTS.map((slot) => {
        const reservation = reservations.find((item) => item.slot === slot.id);
        if (!reservation) {
          return `
            <section class="slot-card is-empty">
              <div class="slot-heading">
                <span class="slot-name">${slot.label}</span>
                <span class="status-pill is-free">Boş</span>
              </div>
              <button class="ghost-button" type="button" data-action="new-reservation" data-slot="${slot.id}">
                ${slot.label} için kayıt ekle
              </button>
            </section>
          `;
        }

        return `
          <section class="slot-card">
            <div class="slot-heading">
              <span class="slot-name">${slot.label}</span>
              <span class="status-pill is-full">Dolu</span>
            </div>
            <div class="reservation-summary">
              <strong>${escapeHTML(reservation.eventType)} · ${escapeHTML(reservation.customerName)}</strong>
              <div class="meta-line">
                <span class="meta-pill">${escapeHTML(reservation.guestCount)} kişi</span>
                <span class="meta-pill">${escapeHTML(reservation.catering)}</span>
                <span class="meta-pill">${formatTRY(reservation.amount)}</span>
              </div>
              <div class="meta-line">
                ${paymentBadge(reservation)}
              </div>
              <div class="meta-line">
                <span>${escapeHTML(reservation.phone || "Telefon yok")}</span>
                <span>Kaydeden: ${escapeHTML(reservation.createdByName || "-")}</span>
              </div>
            </div>
            <div class="card-actions">
              <button class="small-button" type="button" data-action="edit-reservation" data-id="${reservation.id}">Düzenle</button>
              <button class="small-button" type="button" data-action="delete-reservation" data-id="${reservation.id}">Sil</button>
            </div>
          </section>
        `;
      }).join("")}
    </div>
  `;
}

function renderReservationList() {
  const filter = state.listFilter || "all";
  const reservations = getFilteredReservations();

  return `
    <section class="panel">
      <div class="panel-header">
        <div class="panel-title">
          <h2>Tüm kayıtlar</h2>
          <p data-list-count>${reservations.length} kayıt listeleniyor</p>
        </div>
        <button class="primary-button" type="button" data-action="new-reservation">Yeni kayıt</button>
      </div>
      <div class="list-tools">
        <div class="field">
          <label for="search">Arama</label>
          <input id="search" type="search" value="${escapeAttr(state.searchQuery || "")}" placeholder="Müşteri, telefon, etkinlik" data-action="search" />
        </div>
        <div class="field">
          <label for="event-filter">Etkinlik</label>
          <select id="event-filter" data-action="filter-event">
            <option value="all">Hepsi</option>
            ${EVENT_TYPES.map((type) => `<option value="${escapeAttr(type)}" ${filter === type ? "selected" : ""}>${escapeHTML(type)}</option>`).join("")}
          </select>
        </div>
        <button class="ghost-button" type="button" data-action="clear-filters">Temizle</button>
      </div>
      <div class="quick-filters" role="group" aria-label="Tarih filtresi">
        ${dateFilterChip("all", "Tümü")}
        ${dateFilterChip("month", "Bu ay")}
        ${dateFilterChip("upcoming", "Gelecek")}
        ${dateFilterChip("past", "Geçmiş")}
      </div>
      <div class="reservation-list">
        ${
          reservations.length
            ? reservations.map((reservation) => renderReservationCard(reservation)).join("")
            : `<div class="empty-state"><strong>Kayıt bulunamadı</strong>Arama veya filtreyi değiştir.</div>`
        }
      </div>
    </section>
  `;
}

function dateFilterChip(value, label) {
  const active = (state.dateFilter || "all") === value;
  return `
    <button class="filter-chip ${active ? "is-active" : ""}" type="button" data-action="set-date-filter" data-value="${value}">
      ${label}
    </button>
  `;
}

function getFilteredReservations() {
  const query = (state.searchQuery || "").trim().toLocaleLowerCase("tr");
  const filter = state.listFilter || "all";
  const dateFilter = state.dateFilter || "all";
  const today = toISODate(new Date());
  const currentMonth = today.slice(0, 7);

  return [...state.reservations]
    .filter((reservation) => {
      if (filter !== "all" && reservation.eventType !== filter) return false;
      if (dateFilter === "month" && !reservation.date.startsWith(currentMonth)) return false;
      if (dateFilter === "upcoming" && reservation.date < today) return false;
      if (dateFilter === "past" && reservation.date >= today) return false;
      if (!query) return true;
      return [reservation.customerName, reservation.phone, reservation.eventType, reservation.catering, reservation.notes]
        .filter(Boolean)
        .some((value) => value.toLocaleLowerCase("tr").includes(query));
    })
    .sort(sortReservationDate);
}

function renderReservationListItems() {
  const reservations = getFilteredReservations();
  const list = app.querySelector(".reservation-list");
  const count = app.querySelector("[data-list-count]");

  if (count) count.textContent = `${reservations.length} kayıt listeleniyor`;
  if (!list) return;

  list.innerHTML = reservations.length
    ? reservations.map((reservation) => renderReservationCard(reservation)).join("")
    : `<div class="empty-state"><strong>Kayıt bulunamadı</strong>Arama veya filtreyi değiştir.</div>`;

  list.querySelectorAll("[data-action]").forEach((element) => {
    element.addEventListener("click", (event) => handleAction(event, element));
  });
}

function renderReservationCard(reservation) {
  return `
    <article class="reservation-card">
      <header>
        <div>
          <h3>${escapeHTML(reservation.customerName)} · ${escapeHTML(reservation.eventType)}</h3>
          <p>${longDate(reservation.date)} · ${slotLabel(reservation.slot)}</p>
        </div>
        <strong>${formatTRY(reservation.amount)}</strong>
      </header>
      <div class="meta-line">
        <span class="meta-pill">${escapeHTML(reservation.guestCount)} kişi</span>
        <span class="meta-pill">${escapeHTML(reservation.catering)}</span>
        <span class="meta-pill">${escapeHTML(reservation.phone || "Telefon yok")}</span>
      </div>
      <div class="meta-line">
        ${paymentBadge(reservation)}
      </div>
      ${reservation.notes ? `<p>${escapeHTML(reservation.notes)}</p>` : ""}
      <div class="card-actions">
        <button class="small-button" type="button" data-action="select-date" data-date="${reservation.date}">Güne git</button>
        <button class="small-button" type="button" data-action="edit-reservation" data-id="${reservation.id}">Düzenle</button>
        <button class="small-button" type="button" data-action="delete-reservation" data-id="${reservation.id}">Sil</button>
      </div>
    </article>
  `;
}

function renderPrices() {
  const prices = [...state.prices].sort((a, b) => a.guestCount - b.guestCount || a.catering.localeCompare(b.catering, "tr"));

  return `
    <section class="panel">
      <div class="panel-header">
        <div class="panel-title">
          <h2>Fiyat listesi</h2>
          <p>Kişi sayısı ve tabak seçeneğine göre teklifleri düzenle</p>
        </div>
        <button class="primary-button" type="button" data-action="new-price">Fiyat ekle</button>
      </div>
      <div class="price-list">
        ${prices.map((price) => renderPriceRow(price)).join("")}
      </div>
    </section>
  `;
}

function renderPriceRow(price) {
  return `
    <article class="price-row">
      <header>
        <div>
          <h3>${escapeHTML(price.guestCount)} kişi · ${escapeHTML(price.catering)}</h3>
          <p>${escapeHTML(price.eventType)}</p>
        </div>
        <span class="price-amount">${formatTRY(price.amount)}</span>
      </header>
      <div class="card-actions">
        <button class="small-button" type="button" data-action="edit-price" data-id="${price.id}">Düzenle</button>
        <button class="small-button" type="button" data-action="delete-price" data-id="${price.id}">Sil</button>
      </div>
    </article>
  `;
}

function renderSettings() {
  const status = getCloudStatus();
  const user = getCurrentUser();

  return `
    <section class="settings-page">
      <div class="panel-header">
        <div class="panel-title">
          <h2>Ayarlar</h2>
          <p>Hesap ve bulut bağlantısı</p>
        </div>
      </div>
      <div class="settings-grid">
        <article class="settings-block">
          <div class="settings-block-header">
            <h3>Hesabım</h3>
            <p>Oturum açılan ekip üyesi</p>
          </div>
          <div class="settings-profile">
            <span class="settings-avatar" aria-hidden="true">${escapeHTML(user.name.charAt(0))}</span>
            <div>
              <strong>${escapeHTML(user.name)}</strong>
              <span>${escapeHTML(user.email)}</span>
            </div>
          </div>
          <div class="card-actions">
            <button class="ghost-button" type="button" data-action="logout">Oturumu kapat</button>
          </div>
        </article>

        <article class="settings-block">
          <div class="settings-block-header">
            <h3>Bulut bağlantısı</h3>
            <p>Ortak ajandanın güncel durumu</p>
          </div>
          <div class="settings-status ${status.className}">
            <span class="settings-status-dot" aria-hidden="true"></span>
            <div>
              <strong>${escapeHTML(status.title)}</strong>
              <span>${escapeHTML(status.message)}</span>
            </div>
          </div>
          <div class="settings-summary">
            <span><strong>${state.reservations.length}</strong> rezervasyon</span>
            <span><strong>${state.prices.length}</strong> fiyat satırı</span>
          </div>
          <div class="card-actions">
            <button class="ghost-button" type="button" data-action="refresh-cloud" ${isCloudReady() ? "" : "disabled"}>Buluttan yenile</button>
          </div>
        </article>
      </div>
    </section>
  `;
}

function bindAppEvents() {
  app.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeTab = button.dataset.tab;
      saveState();
      render();
    });
  });

  app.querySelectorAll(".day-cell[data-date]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedDate = button.dataset.date;
      state.visibleMonth = button.dataset.date.slice(0, 7);
      saveState();
      render();
    });
  });

  app.querySelectorAll("[data-action]").forEach((element) => {
    element.addEventListener("click", (event) => handleAction(event, element));
  });

  const search = app.querySelector('[data-action="search"]');
  if (search) {
    search.addEventListener("input", (event) => {
      state.searchQuery = event.target.value;
      saveState();
      renderReservationListItems();
    });
  }

  const filter = app.querySelector('[data-action="filter-event"]');
  if (filter) {
    filter.addEventListener("change", (event) => {
      state.listFilter = event.target.value;
      saveState();
      render();
    });
  }
}

async function handleAction(event, element) {
  const action = element.dataset.action;
  if (!action) return;

  if (["search", "filter-event"].includes(action)) return;
  event.stopPropagation();

  if (action === "logout") {
    await signOut();
  }

  if (action === "prev-month" || action === "next-month") {
    const offset = action === "prev-month" ? -1 : 1;
    state.visibleMonth = shiftMonth(state.visibleMonth, offset);
    saveState();
    render();
  }

  if (action === "new-reservation") {
    openReservationModal({ date: state.selectedDate, slot: element.dataset.slot || "day" });
  }

  if (action === "edit-reservation") {
    const reservation = state.reservations.find((item) => item.id === element.dataset.id);
    if (reservation) openReservationModal(reservation);
  }

  if (action === "delete-reservation") {
    deleteReservation(element.dataset.id);
  }

  if (action === "select-date") {
    state.selectedDate = element.dataset.date;
    state.visibleMonth = element.dataset.date.slice(0, 7);
    state.activeTab = "agenda";
    saveState();
    render();
  }

  if (action === "clear-filters") {
    state.searchQuery = "";
    state.listFilter = "all";
    state.dateFilter = "all";
    saveState();
    render();
  }

  if (action === "set-date-filter") {
    state.dateFilter = element.dataset.value;
    saveState();
    render();
  }

  if (action === "new-price") {
    openPriceModal();
  }

  if (action === "edit-price") {
    const price = state.prices.find((item) => item.id === element.dataset.id);
    if (price) openPriceModal(price);
  }

  if (action === "delete-price") {
    deletePrice(element.dataset.id);
  }

  if (action === "refresh-cloud") {
    await loadCloudData();
    render();
  }
}

function openReservationModal(reservation = {}) {
  const isEditing = Boolean(reservation.id);
  const formState = {
    id: reservation.id || createId(),
    date: reservation.date || state.selectedDate,
    slot: reservation.slot || "day",
    eventType: reservation.eventType || EVENT_TYPES[0],
    customerName: reservation.customerName || "",
    phone: reservation.phone || "",
    amount: reservation.amount ? formatAmountDisplay(reservation.amount) : "",
    paidAmount: reservation.paidAmount ? formatAmountDisplay(reservation.paidAmount) : "",
    guestCount: reservation.guestCount || 100,
    catering: reservation.catering || CATERING_OPTIONS[0],
    notes: reservation.notes || ""
  };

  modal = { type: "reservation", isEditing, formState };
  renderModal();
}

function openPriceModal(price = {}) {
  modal = {
    type: "price",
    isEditing: Boolean(price.id),
    formState: {
      id: price.id || createId(),
      eventType: price.eventType || "Tüm etkinlikler",
      guestCount: price.guestCount || 100,
      catering: price.catering || CATERING_OPTIONS[0],
      amount: price.amount ? formatAmountDisplay(price.amount) : ""
    }
  };
  renderModal();
}

function renderModal() {
  closeModalElement();
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) closeModal();
  });
  backdrop.innerHTML = modal.type === "reservation" ? reservationModalHTML() : priceModalHTML();
  document.body.appendChild(backdrop);

  backdrop.querySelectorAll('[data-action="close-modal"]').forEach((button) => {
    button.addEventListener("click", closeModal);
  });
  backdrop.querySelector("form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (modal.type === "reservation") {
      await submitReservation(backdrop);
    } else {
      await submitPrice(backdrop);
    }
  });

  if (modal.type === "reservation") bindReservationModal(backdrop);
  if (modal.type === "price") bindAmountField(backdrop.querySelector("#priceAmount"));
}

function reservationModalHTML() {
  const item = modal.formState;
  const suggestion = findSuggestedPrice(item);

  return `
    <section class="modal" role="dialog" aria-modal="true" aria-labelledby="reservation-title">
      <div class="modal-header">
        <h2 id="reservation-title">${modal.isEditing ? "Kaydı düzenle" : "Yeni rezervasyon"}</h2>
        <button class="icon-button" type="button" data-action="close-modal" title="Kapat">×</button>
      </div>
      <form>
        <div class="modal-body">
          <div class="form-grid">
            <div class="field">
              <label for="date">Tarih</label>
              <input id="date" name="date" type="date" value="${escapeAttr(item.date)}" required />
            </div>
            <div class="field">
              <label>Saat seçimi</label>
              <div class="segmented">
                ${SLOTS.map(
                  (slot) => `
                    <button class="slot-button ${item.slot === slot.id ? "is-active" : ""}" type="button" data-modal-slot="${slot.id}">
                      ${slot.label}
                    </button>
                  `
                ).join("")}
              </div>
              <input type="hidden" name="slot" value="${escapeAttr(item.slot)}" />
            </div>
            <div class="field">
              <label for="eventType">Etkinlik</label>
              <select id="eventType" name="eventType" required>
                ${EVENT_TYPES.map((type) => `<option value="${escapeAttr(type)}" ${item.eventType === type ? "selected" : ""}>${escapeHTML(type)}</option>`).join("")}
              </select>
            </div>
            <div class="field">
              <label for="catering">Tabak / yemek</label>
              <select id="catering" name="catering" required>
                ${CATERING_OPTIONS.map((option) => `<option value="${escapeAttr(option)}" ${item.catering === option ? "selected" : ""}>${escapeHTML(option)}</option>`).join("")}
              </select>
            </div>
            <div class="field is-wide">
              <label>Kişi sayısı</label>
              <div class="guest-options">
                ${GUEST_PRESETS.map(
                  (count) => `
                    <button class="guest-option ${Number(item.guestCount) === count ? "is-active" : ""}" type="button" data-guest="${count}">
                      ${count}
                    </button>
                  `
                ).join("")}
              </div>
            </div>
            <div class="field">
              <label for="guestCount">Özel kişi sayısı</label>
              <input id="guestCount" name="guestCount" type="number" min="1" step="1" value="${escapeAttr(item.guestCount)}" required />
            </div>
            <div class="field">
              <label for="amount">Anlaşılan tutar</label>
              <input id="amount" name="amount" type="text" inputmode="numeric" pattern="[0-9.]*" value="${escapeAttr(item.amount)}" placeholder="30.000" required />
            </div>
            <div class="field">
              <label for="paidAmount">Ödenen / kapora</label>
              <div class="field-with-action">
                <input id="paidAmount" name="paidAmount" type="text" inputmode="numeric" pattern="[0-9.]*" value="${escapeAttr(item.paidAmount)}" placeholder="0" />
                <button class="small-button" type="button" data-action="mark-full-paid">Tamamı ödendi</button>
              </div>
            </div>
            <div class="field">
              <label for="customerName">Etkinlik sahibi</label>
              <input id="customerName" name="customerName" type="text" value="${escapeAttr(item.customerName)}" required />
            </div>
            <div class="field">
              <label for="phone">Telefon</label>
              <input id="phone" name="phone" type="tel" inputmode="numeric" autocomplete="tel"
                value="${escapeAttr(item.phone)}" placeholder="0532 123 45 67"
                pattern="^(0|\+90)?\s?5\d{2}\s?\d{3}\s?\d{2}\s?\d{2}$"
                title="Örnek: 0532 123 45 67" />
              <p class="field-hint" data-phone-hint hidden>Telefon numarası eksik veya hatalı görünüyor (örn: 0532 123 45 67).</p>
            </div>
            <div class="field is-wide">
              <label for="notes">Not</label>
              <textarea id="notes" name="notes">${escapeHTML(item.notes)}</textarea>
            </div>
          </div>
          ${
            suggestion
              ? `
                <div class="suggestion-box">
                  <p>Fiyat listesi önerisi: ${formatTRY(suggestion.amount)}</p>
                  <button class="small-button" type="button" data-action="use-suggestion" data-amount="${suggestion.amount}">Tutarı kullan</button>
                </div>
              `
              : ""
          }
        </div>
        <div class="modal-footer">
          <button class="ghost-button" type="button" data-action="close-modal">Vazgeç</button>
          <button class="primary-button" type="submit">${modal.isEditing ? "Kaydı kaydet" : "Rezervasyonu ekle"}</button>
        </div>
      </form>
    </section>
  `;
}

function priceModalHTML() {
  const item = modal.formState;
  const eventTypes = ["Tüm etkinlikler", ...EVENT_TYPES];

  return `
    <section class="modal" role="dialog" aria-modal="true" aria-labelledby="price-title">
      <div class="modal-header">
        <h2 id="price-title">${modal.isEditing ? "Fiyatı düzenle" : "Fiyat ekle"}</h2>
        <button class="icon-button" type="button" data-action="close-modal" title="Kapat">×</button>
      </div>
      <form>
        <div class="modal-body">
          <div class="form-grid">
            <div class="field">
              <label for="priceEventType">Etkinlik</label>
              <select id="priceEventType" name="eventType">
                ${eventTypes.map((type) => `<option value="${escapeAttr(type)}" ${item.eventType === type ? "selected" : ""}>${escapeHTML(type)}</option>`).join("")}
              </select>
            </div>
            <div class="field">
              <label for="priceCatering">Tabak / yemek</label>
              <select id="priceCatering" name="catering">
                ${CATERING_OPTIONS.map((option) => `<option value="${escapeAttr(option)}" ${item.catering === option ? "selected" : ""}>${escapeHTML(option)}</option>`).join("")}
              </select>
            </div>
            <div class="field">
              <label for="priceGuestCount">Kişi sayısı</label>
              <input id="priceGuestCount" name="guestCount" type="number" min="1" step="1" value="${escapeAttr(item.guestCount)}" required />
            </div>
            <div class="field">
              <label for="priceAmount">Fiyat</label>
              <input id="priceAmount" name="amount" type="text" inputmode="numeric" pattern="[0-9.]*" value="${escapeAttr(item.amount)}" placeholder="30.000" required />
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="ghost-button" type="button" data-action="close-modal">Vazgeç</button>
          <button class="primary-button" type="submit">${modal.isEditing ? "Fiyatı kaydet" : "Fiyat ekle"}</button>
        </div>
      </form>
    </section>
  `;
}

function bindReservationModal(backdrop) {
  bindAmountField(backdrop.querySelector("#amount"));
  bindAmountField(backdrop.querySelector("#paidAmount"));

  const phoneInput = backdrop.querySelector("#phone");
  const phoneHint = backdrop.querySelector("[data-phone-hint]");
  if (phoneInput) {
    phoneInput.addEventListener("input", () => {
      const cursorAtEnd = phoneInput.selectionEnd === phoneInput.value.length;
      phoneInput.value = formatPhoneNumber(phoneInput.value);
      if (cursorAtEnd) {
        phoneInput.selectionStart = phoneInput.selectionEnd = phoneInput.value.length;
      }
    });
    phoneInput.addEventListener("blur", () => {
      if (phoneHint) phoneHint.hidden = phoneInput.value === "" || phoneInput.checkValidity();
    });
  }

  backdrop.querySelectorAll("[data-modal-slot]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = backdrop.querySelector('input[name="slot"]');
      input.value = button.dataset.modalSlot;
      backdrop.querySelectorAll("[data-modal-slot]").forEach((item) => item.classList.remove("is-active"));
      button.classList.add("is-active");
    });
  });

  backdrop.querySelectorAll("[data-guest]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = backdrop.querySelector('input[name="guestCount"]');
      input.value = button.dataset.guest;
      backdrop.querySelectorAll("[data-guest]").forEach((item) => item.classList.remove("is-active"));
      button.classList.add("is-active");
      refreshReservationSuggestion(backdrop);
    });
  });

  ["eventType", "catering", "guestCount"].forEach((name) => {
    const input = backdrop.querySelector(`[name="${name}"]`);
    input.addEventListener("change", () => refreshReservationSuggestion(backdrop));
  });

  const suggestionButton = backdrop.querySelector('[data-action="use-suggestion"]');
  if (suggestionButton) {
    suggestionButton.addEventListener("click", () => {
      backdrop.querySelector('[name="amount"]').value = formatAmountDisplay(suggestionButton.dataset.amount);
    });
  }

  const markFullPaidButton = backdrop.querySelector('[data-action="mark-full-paid"]');
  if (markFullPaidButton) {
    markFullPaidButton.addEventListener("click", () => {
      const amountInput = backdrop.querySelector('[name="amount"]');
      const paidInput = backdrop.querySelector('[name="paidAmount"]');
      if (!amountInput.value) {
        amountInput.focus();
        showToast("Önce anlaşılan tutarı gir.");
        return;
      }
      paidInput.value = amountInput.value;
    });
  }
}

function refreshReservationSuggestion(backdrop) {
  const form = new FormData(backdrop.querySelector("form"));
  const current = Object.fromEntries(form.entries());
  modal.formState = {
    ...modal.formState,
    ...current,
    customerName: current.customerName || "",
    phone: current.phone || "",
    notes: current.notes || "",
    guestCount: Number(current.guestCount || 0)
  };
  renderModal();
}

async function submitReservation(backdrop) {
  const data = Object.fromEntries(new FormData(backdrop.querySelector("form")).entries());
  const reservation = {
    id: modal.formState.id,
    date: data.date,
    slot: data.slot,
    eventType: data.eventType,
    customerName: data.customerName.trim(),
    phone: data.phone.trim(),
    guestCount: Number(data.guestCount),
    catering: data.catering,
    amount: parseAmount(data.amount),
    paidAmount: parseAmount(data.paidAmount),
    notes: data.notes.trim(),
    createdBy: modal.isEditing
      ? state.reservations.find((item) => item.id === modal.formState.id)?.createdBy || state.currentUserId
      : state.currentUserId,
    createdByName: modal.isEditing
      ? state.reservations.find((item) => item.id === modal.formState.id)?.createdByName || getCurrentUser().name
      : getCurrentUser().name,
    updatedAt: new Date().toISOString()
  };

  const duplicate = state.reservations.find(
    (item) => item.id !== reservation.id && item.date === reservation.date && item.slot === reservation.slot
  );

  if (duplicate) {
    showToast(`${longDate(reservation.date)} ${slotLabel(reservation.slot)} zaten dolu.`);
    return;
  }

  try {
    await saveReservationToCloudIfReady(reservation);
  } catch (error) {
    handleCloudError(error, "Rezervasyon kaydedilemedi.");
    return;
  }

  if (modal.isEditing) {
    state.reservations = state.reservations.map((item) => (item.id === reservation.id ? reservation : item));
    showToast("Rezervasyon güncellendi.");
  } else {
    state.reservations = [...state.reservations, reservation];
    showToast("Rezervasyon eklendi.");
  }

  state.selectedDate = reservation.date;
  state.visibleMonth = reservation.date.slice(0, 7);
  state.activeTab = "agenda";
  saveState();
  closeModal();
  render();
}

async function submitPrice(backdrop) {
  const data = Object.fromEntries(new FormData(backdrop.querySelector("form")).entries());
  const price = {
    id: modal.formState.id,
    eventType: data.eventType,
    guestCount: Number(data.guestCount),
    catering: data.catering,
    amount: parseAmount(data.amount)
  };

  try {
    await savePriceToCloudIfReady(price);
  } catch (error) {
    handleCloudError(error, "Fiyat kaydedilemedi.");
    return;
  }

  if (modal.isEditing) {
    state.prices = state.prices.map((item) => (item.id === price.id ? price : item));
    showToast("Fiyat güncellendi.");
  } else {
    state.prices = [...state.prices, price];
    showToast("Fiyat eklendi.");
  }

  saveState();
  closeModal();
  render();
}

function deleteReservation(id) {
  const reservation = state.reservations.find((item) => item.id === id);
  if (!reservation) return;
  openConfirmModal({
    title: "Rezervasyonu sil",
    message: `${reservation.customerName} · ${longDate(reservation.date)} kaydı silinsin mi? Bu işlem geri alınamaz.`,
    confirmLabel: "Kaydı sil",
    onConfirm: async () => {
      try {
        await deleteReservationFromCloudIfReady(id);
      } catch (error) {
        handleCloudError(error, "Rezervasyon silinemedi.");
        return;
      }
      state.reservations = state.reservations.filter((item) => item.id !== id);
      saveState();
      showToast("Rezervasyon silindi.");
      render();
    }
  });
}

function deletePrice(id) {
  openConfirmModal({
    title: "Fiyat satırını sil",
    message: "Bu fiyat satırı silinsin mi? Bu işlem geri alınamaz.",
    confirmLabel: "Satırı sil",
    onConfirm: async () => {
      try {
        await deletePriceFromCloudIfReady(id);
      } catch (error) {
        handleCloudError(error, "Fiyat silinemedi.");
        return;
      }
      state.prices = state.prices.filter((item) => item.id !== id);
      saveState();
      showToast("Fiyat silindi.");
      render();
    }
  });
}

async function boot() {
  render();
  await initializeSupabase();
  render();
}

async function initializeSupabase() {
  supabaseConfig = loadSupabaseConfig();
  cloud.configured = isSupabaseConfigured();
  cloud.clientReady = false;
  cloud.signedIn = false;
  cloud.userEmail = "";

  if (authSubscription?.unsubscribe) {
    authSubscription.unsubscribe();
    authSubscription = null;
  }

  if (!cloud.configured) {
    supabaseClient = null;
    cloud.message = "Supabase ayarı bekleniyor.";
    return;
  }

  try {
    await ensureSupabaseLibrary();
    supabaseClient = window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
    cloud.clientReady = true;
    cloud.message = "Supabase hazır, giriş bekleniyor.";

    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    setCloudSession(data.session);

    const { data: listener } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      setCloudSession(session);
      if (!session) {
        state.currentUserId = "";
        saveState();
        render();
        return;
      }
      if (state.currentUserId) {
        loadCloudData({ quiet: true }).finally(render);
      } else {
        render();
      }
    });
    authSubscription = listener?.subscription || null;

    if (data.session && state.currentUserId) {
      await loadCloudData({ quiet: true });
    }
  } catch (error) {
    supabaseClient = null;
    cloud.clientReady = false;
    cloud.message = translateSupabaseError(error);
  }
}

function ensureSupabaseLibrary() {
  if (window.supabase?.createClient) return Promise.resolve();
  if (supabaseLibraryPromise) return supabaseLibraryPromise;

  supabaseLibraryPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SUPABASE_CDN_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Supabase kütüphanesi yüklenemedi. İnternet bağlantısını kontrol et."));
    document.head.appendChild(script);
  });

  return supabaseLibraryPromise;
}

function setCloudSession(session) {
  cloud.signedIn = Boolean(session);
  cloud.userEmail = session?.user?.email || "";
  cloud.message = session ? "Supabase oturumu açık." : "Supabase hazır, giriş bekleniyor.";
  const matchedUser = USERS.find((user) => user.email.toLowerCase() === cloud.userEmail.toLowerCase());
  if (session && matchedUser) {
    state.currentUserId = matchedUser.id;
    delete state.pendingUserId;
    saveState();
  } else if (session) {
    state.currentUserId = "";
    cloud.message = "Bu e-posta tanımlı ekip üyelerinden biri değil.";
    saveState();
  }
  if (!session) cloud.lastSyncAt = "";
}

function isCloudReady() {
  return Boolean(supabaseClient && cloud.clientReady && cloud.signedIn);
}

async function handleSupabaseAuth(form) {
  if (!supabaseClient || !cloud.clientReady) {
    showToast("Bağlantı henüz hazır değil.");
    return;
  }

  const data = Object.fromEntries(new FormData(form).entries());
  const email = String(data.email || "").trim();
  const password = String(data.password || "");

  if (!email || !password) {
    showToast("Şifre gerekli.");
    return;
  }

  cloud.loading = true;
  cloud.message = "Giriş yapılıyor.";
  renderLogin();

  try {
    const result = await supabaseClient.auth.signInWithPassword({ email, password });

    if (result.error) throw result.error;

    setCloudSession(result.data.session);
    if (!result.data.session || !state.currentUserId) {
      await supabaseClient.auth.signOut().catch(() => {});
      setCloudSession(null);
      throw new Error("Bu hesap 1453 Party House ekibinde tanımlı değil.");
    }

    await loadCloudData({ quiet: true });
    showToast("Giriş yapıldı.");
    render();
  } catch (error) {
    cloud.message = translateSupabaseError(error);
    showToast(cloud.message);
  } finally {
    cloud.loading = false;
    if (shouldShowLogin()) {
      renderLogin();
    } else {
      render();
    }
  }
}

async function signOut() {
  if (supabaseClient && cloud.signedIn) {
    await supabaseClient.auth.signOut().catch(() => {});
  }
  state.currentUserId = "";
  delete state.pendingUserId;
  setCloudSession(null);
  saveState();
  render();
}

async function loadCloudData({ quiet = false } = {}) {
  if (!isCloudReady()) return;
  cloud.loading = true;
  cloud.message = "Bulut verisi alınıyor.";
  if (!quiet) render();

  try {
    const [reservationResult, priceResult] = await Promise.all([
      supabaseClient.from(SUPABASE_TABLES.reservations).select("*").order("date", { ascending: true }),
      supabaseClient.from(SUPABASE_TABLES.prices).select("*").order("guest_count", { ascending: true })
    ]);

    if (reservationResult.error) throw reservationResult.error;
    if (priceResult.error) throw priceResult.error;

    state.reservations = (reservationResult.data || []).map(rowToReservation).sort(sortReservationDate);
    if (priceResult.data?.length) {
      state.prices = priceResult.data.map(rowToPrice);
    } else {
      state.prices = DEFAULT_PRICES;
      await upsertPricesToCloud(DEFAULT_PRICES);
    }

    markCloudSynced("Bulut verisi güncel.");
    saveState();
    if (!quiet) showToast("Bulut verisi yenilendi.");
  } catch (error) {
    handleCloudError(error, "Bulut verisi alınamadı.");
  } finally {
    cloud.loading = false;
  }
}

async function saveReservationToCloudIfReady(reservation) {
  if (!isCloudReady()) return;
  const { error } = await supabaseClient
    .from(SUPABASE_TABLES.reservations)
    .upsert(reservationToRow(reservation), { onConflict: "id" });
  if (error) throw error;
  markCloudSynced("Rezervasyon buluta kaydedildi.");
}

async function savePriceToCloudIfReady(price) {
  if (!isCloudReady()) return;
  const { error } = await supabaseClient.from(SUPABASE_TABLES.prices).upsert(priceToRow(price), { onConflict: "id" });
  if (error) throw error;
  markCloudSynced("Fiyat buluta kaydedildi.");
}

async function deleteReservationFromCloudIfReady(id) {
  if (!isCloudReady()) return;
  const { error } = await supabaseClient.from(SUPABASE_TABLES.reservations).delete().eq("id", id);
  if (error) throw error;
  markCloudSynced("Rezervasyon buluttan silindi.");
}

async function deletePriceFromCloudIfReady(id) {
  if (!isCloudReady()) return;
  const { error } = await supabaseClient.from(SUPABASE_TABLES.prices).delete().eq("id", id);
  if (error) throw error;
  markCloudSynced("Fiyat buluttan silindi.");
}

async function upsertPricesToCloud(prices) {
  const { error } = await supabaseClient.from(SUPABASE_TABLES.prices).upsert(prices.map(priceToRow), { onConflict: "id" });
  if (error) throw error;
}

function reservationToRow(reservation) {
  return {
    id: reservation.id,
    date: reservation.date,
    slot: reservation.slot,
    event_type: reservation.eventType,
    customer_name: reservation.customerName,
    phone: reservation.phone || "",
    guest_count: Number(reservation.guestCount || 0),
    catering: reservation.catering,
    amount: Number(reservation.amount || 0),
    paid_amount: Number(reservation.paidAmount || 0),
    notes: reservation.notes || "",
    created_by: reservation.createdBy || state.currentUserId || "",
    created_by_name: reservation.createdByName || getCurrentUser().name,
    updated_at: reservation.updatedAt || new Date().toISOString()
  };
}

function rowToReservation(row) {
  return {
    id: row.id,
    date: row.date,
    slot: row.slot,
    eventType: row.event_type,
    customerName: row.customer_name,
    phone: row.phone || "",
    guestCount: Number(row.guest_count || 0),
    catering: row.catering,
    amount: Number(row.amount || 0),
    paidAmount: Number(row.paid_amount || 0),
    notes: row.notes || "",
    createdBy: row.created_by || "",
    createdByName: row.created_by_name || "",
    updatedAt: row.updated_at || ""
  };
}

function priceToRow(price) {
  return {
    id: price.id,
    event_type: price.eventType,
    guest_count: Number(price.guestCount || 0),
    catering: price.catering,
    amount: Number(price.amount || 0),
    updated_at: new Date().toISOString()
  };
}

function rowToPrice(row) {
  return {
    id: row.id,
    eventType: row.event_type,
    guestCount: Number(row.guest_count || 0),
    catering: row.catering,
    amount: Number(row.amount || 0)
  };
}

function markCloudSynced(message = "Bulut verisi güncel.") {
  if (!isSupabaseConfigured()) return;
  cloud.lastSyncAt = new Date().toISOString();
  cloud.message = message;
}

function handleCloudError(error, fallback) {
  cloud.message = `${fallback} ${translateSupabaseError(error)}`;
  showToast(cloud.message);
}

function translateSupabaseError(error) {
  const message = String(error?.message || error || "Bilinmeyen hata");
  if (/Invalid login credentials/i.test(message)) return "E-posta veya şifre hatalı.";
  if (/Email not confirmed/i.test(message)) return "E-posta onayı bekleniyor.";
  if (/Failed to fetch|NetworkError|Load failed/i.test(message)) return "İnternet veya Supabase bağlantısı kurulamadı.";
  if (/row-level security|permission denied/i.test(message)) return "Supabase tablo izinleri eksik. SQL şemasındaki policy satırlarını çalıştır.";
  if (/relation .* does not exist/i.test(message)) return "Supabase tabloları bulunamadı. supabase-schema.sql dosyasındaki SQL'i çalıştır.";
  return message;
}

function formatSyncTime() {
  if (!cloud.lastSyncAt) return "Henüz senkron yok";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(cloud.lastSyncAt));
}

function openConfirmModal({ title, message, confirmLabel, onConfirm }) {
  closeModalElement();
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) closeModalElement();
  });
  backdrop.innerHTML = `
    <section class="modal confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
      <div class="modal-header">
        <h2 id="confirm-title">${escapeHTML(title)}</h2>
        <button class="icon-button" type="button" data-action="cancel-confirm" title="Kapat">×</button>
      </div>
      <div class="modal-body">
        <p class="confirm-message">${escapeHTML(message)}</p>
      </div>
      <div class="modal-footer">
        <button class="ghost-button" type="button" data-action="cancel-confirm">Vazgeç</button>
        <button class="danger-button" type="button" data-action="proceed-confirm">${escapeHTML(confirmLabel)}</button>
      </div>
    </section>
  `;
  document.body.appendChild(backdrop);

  const cleanup = () => backdrop.remove();
  backdrop.querySelectorAll('[data-action="cancel-confirm"]').forEach((button) => {
    button.addEventListener("click", cleanup);
  });
  backdrop.querySelector('[data-action="proceed-confirm"]').addEventListener("click", async () => {
    cleanup();
    await onConfirm();
  });

  const onKeydown = (event) => {
    if (event.key === "Escape") {
      cleanup();
      document.removeEventListener("keydown", onKeydown);
    }
  };
  document.addEventListener("keydown", onKeydown);
}

function closeModal() {
  modal = null;
  closeModalElement();
}

function closeModalElement() {
  document.querySelectorAll(".modal-backdrop").forEach((element) => element.remove());
}

function findSuggestedPrice(item) {
  const guestCount = Number(item.guestCount);
  return (
    state.prices.find(
      (price) =>
        price.eventType === item.eventType &&
        Number(price.guestCount) === guestCount &&
        price.catering === item.catering
    ) ||
    state.prices.find(
      (price) =>
        price.eventType === "Tüm etkinlikler" &&
        Number(price.guestCount) === guestCount &&
        price.catering === item.catering
    )
  );
}

function paymentBadge(reservation) {
  const total = Number(reservation.amount || 0);
  const paid = Number(reservation.paidAmount || 0);
  const remaining = Math.max(total - paid, 0);

  if (paid <= 0) {
    return `<span class="status-pill is-unpaid">Ödenmedi · ${formatTRY(total)} bekleniyor</span>`;
  }
  if (remaining <= 0) {
    return `<span class="status-pill is-free">Tamamı ödendi</span>`;
  }
  return `<span class="status-pill is-partial">Ödenen ${formatTRY(paid)} · Kalan ${formatTRY(remaining)}</span>`;
}

function selectedDaySubtitle() {
  const count = state.reservations.filter((reservation) => reservation.date === state.selectedDate).length;
  if (count === 0) return "İki slot da boş";
  if (count === 1) return "Bir slot dolu, bir slot boş";
  return "Gündüz ve akşam dolu";
}

function getCurrentUser() {
  return USERS.find((user) => user.id === state.currentUserId) || USERS[0];
}

function calendarDates(month) {
  const [year, monthIndex] = month.split("-").map(Number);
  const first = new Date(year, monthIndex - 1, 1);
  const firstDay = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - firstDay);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function bindAmountField(input) {
  if (!input) return;
  input.addEventListener("input", () => {
    const cursorAtEnd = input.selectionEnd === input.value.length;
    input.value = formatAmountDisplay(input.value);
    if (cursorAtEnd) {
      input.selectionStart = input.selectionEnd = input.value.length;
    }
  });
}

function formatAmountDisplay(value) {
  const digits = String(value ?? "").replace(/[^\d]/g, "");
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function parseAmount(value) {
  const digits = String(value ?? "").replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

function formatPhoneNumber(value) {
  let digits = value.replace(/[^\d+]/g, "");
  const hasCountryCode = digits.startsWith("+90");
  digits = digits.replace(/\+/g, "");
  if (hasCountryCode) digits = digits.slice(2);
  digits = digits.slice(0, 11);

  const prefix = hasCountryCode ? "+90 " : "";
  const parts = [];
  let rest = digits;
  if (rest.startsWith("0")) {
    parts.push(rest.slice(0, 4));
    rest = rest.slice(4);
  } else {
    parts.push(rest.slice(0, 3));
    rest = rest.slice(3);
  }
  if (rest) {
    parts.push(rest.slice(0, 3));
    rest = rest.slice(3);
  }
  if (rest) {
    parts.push(rest.slice(0, 2));
    rest = rest.slice(2);
  }
  if (rest) {
    parts.push(rest.slice(0, 2));
  }

  return prefix + parts.filter(Boolean).join(" ");
}

function toISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftMonth(month, offset) {
  const [year, monthIndex] = month.split("-").map(Number);
  const date = new Date(year, monthIndex - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthTitle(month) {
  const [year, monthIndex] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(new Date(year, monthIndex - 1, 1));
}

function longDate(iso) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    weekday: "long"
  }).format(new Date(`${iso}T12:00:00`));
}

function shortDate(iso) {
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short" }).format(new Date(`${iso}T12:00:00`));
}

function slotLabel(slot) {
  return SLOTS.find((item) => item.id === slot)?.label || slot;
}

function formatTRY(value) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function sortReservationDate(a, b) {
  if (a.date === b.date) {
    return SLOTS.findIndex((slot) => slot.id === a.slot) - SLOTS.findIndex((slot) => slot.id === b.slot);
  }
  return a.date.localeCompare(b.date);
}

function createId() {
  if (window.crypto?.randomUUID) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function showToast(message) {
  clearTimeout(toastTimer);
  document.querySelectorAll(".toast").forEach((toast) => toast.remove());
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  toastTimer = setTimeout(() => toast.remove(), 2600);
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHTML(value);
}

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}

boot();
