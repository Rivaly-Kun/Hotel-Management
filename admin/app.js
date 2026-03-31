import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-analytics.js";
import {
  getDatabase,
  onValue,
  push,
  ref,
  remove,
  serverTimestamp,
  set,
  update,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCYsD5avcJWzW_SOvuNWD4ZRRrNFiXtH-o",
  authDomain: "lost-and-found-ba220.firebaseapp.com",
  databaseURL:
    "https://lost-and-found-ba220-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "lost-and-found-ba220",
  storageBucket: "lost-and-found-ba220.firebasestorage.app",
  messagingSenderId: "135912601274",
  appId: "1:135912601274:web:7f84995c81f748c448f483",
  measurementId: "G-NEGQTKZZJS",
};

const app = initializeApp(firebaseConfig);
let analytics;
try {
  analytics = getAnalytics(app);
} catch (err) {
  console.warn("Analytics unavailable in this environment:", err.message);
}

const db = getDatabase(app);

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "admin123";

const loginView = document.getElementById("loginView");
const dashboardView = document.getElementById("dashboardView");
const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");
const logoutBtn = document.getElementById("logoutBtn");

const tabButtons = Array.from(document.querySelectorAll(".tab-btn"));
const tabPanels = Array.from(document.querySelectorAll(".tab-panel"));

const totalRooms = document.getElementById("totalRooms");
const activeBookings = document.getElementById("activeBookings");
const checkedInCount = document.getElementById("checkedInCount");
const paidRevenue = document.getElementById("paidRevenue");

const roomForm = document.getElementById("roomForm");
const bookingForm = document.getElementById("bookingForm");
const checkinForm = document.getElementById("checkinForm");
const amenityForm = document.getElementById("amenityForm");
const paymentForm = document.getElementById("paymentForm");

const roomsTableBody = document.getElementById("roomsTableBody");
const bookingsTableBody = document.getElementById("bookingsTableBody");
const checkinsTableBody = document.getElementById("checkinsTableBody");
const amenitiesTableBody = document.getElementById("amenitiesTableBody");
const amenityRequestsTableBody = document.getElementById(
  "amenityRequestsTableBody",
);
const paymentsTableBody = document.getElementById("paymentsTableBody");

const bookingRoomId = document.getElementById("bookingRoomId");
const checkinRoomId = document.getElementById("checkinRoomId");
const checkinBookingId = document.getElementById("checkinBookingId");
const paymentBookingId = document.getElementById("paymentBookingId");
const checkinGuestNameInput = document.getElementById("checkinGuestName");
const paymentGuestNameInput = document.getElementById("paymentGuestName");
const paymentAmountInput = document.getElementById("paymentAmount");

const editModal = document.getElementById("editModal");
const modalTitle = document.getElementById("modalTitle");
const modalForm = document.getElementById("modalForm");
const modalFields = document.getElementById("modalFields");
const modalMessage = document.getElementById("modalMessage");
const modalCloseBtn = document.getElementById("modalCloseBtn");
const modalCancelBtn = document.getElementById("modalCancelBtn");

let roomsCache = {};
let bookingsCache = {};
let checkinsCache = {};
let amenitiesCache = {};
let amenityRequestsCache = {};
let paymentsCache = {};
let tabsInitialized = false;
let modalState = null;

const formatMoney = (value) => `$${Number(value || 0).toFixed(2)}`;

const escapeHtml = (str) =>
  String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const mapPaymentStateToBookingState = {
  paid: "paid",
  pending: "pending",
  failed: "unpaid",
};

const EDIT_SCHEMAS = {
  rooms: {
    title: "Edit Room",
    fields: [
      { key: "number", label: "Room Number", type: "text", required: true },
      { key: "type", label: "Type", type: "text", required: true },
      {
        key: "capacity",
        label: "Capacity",
        type: "number",
        min: 1,
        required: true,
      },
      { key: "price", label: "Price", type: "number", min: 0, required: true },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: ["available", "occupied", "maintenance"],
        required: true,
      },
    ],
  },
  amenities: {
    title: "Edit Amenity",
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "location", label: "Location", type: "text", required: true },
      { key: "price", label: "Price", type: "number", min: 0, required: true },
      {
        key: "availability",
        label: "Availability",
        type: "select",
        options: ["available", "limited", "unavailable"],
        required: true,
      },
    ],
  },
  payments: {
    title: "Edit Payment",
    fields: [
      {
        key: "amount",
        label: "Amount",
        type: "number",
        min: 0,
        required: true,
      },
      {
        key: "method",
        label: "Method",
        type: "select",
        options: ["cash", "card", "transfer", "bank-transfer", "online"],
        required: true,
      },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: ["paid", "pending", "failed"],
        required: true,
      },
    ],
  },
};

function parseDateInput(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getCollectionCache(collection) {
  if (collection === "rooms") {
    return roomsCache;
  }
  if (collection === "amenities") {
    return amenitiesCache;
  }
  if (collection === "payments") {
    return paymentsCache;
  }

  return null;
}

function closeModal() {
  modalState = null;
  modalFields.innerHTML = "";
  modalMessage.textContent = "";
  editModal.classList.add("hidden");
  editModal.setAttribute("aria-hidden", "true");
}

function openModal(collection, id) {
  const schema = EDIT_SCHEMAS[collection];
  const cache = getCollectionCache(collection);
  const record = cache?.[id];

  if (!schema || !record) {
    return;
  }

  modalState = { collection, id };
  modalTitle.textContent = schema.title;
  modalMessage.textContent = "";

  modalFields.innerHTML = schema.fields
    .map((field) => {
      const value = record[field.key] ?? "";
      const fieldId = `modal-${field.key}`;

      if (field.type === "select") {
        const options = field.options
          .map(
            (option) =>
              `<option value="${option}" ${String(value).toLowerCase() === option ? "selected" : ""}>${option}</option>`,
          )
          .join("");

        return `<label for="${fieldId}">${field.label}<select id="${fieldId}" name="${field.key}" ${field.required ? "required" : ""}>${options}</select></label>`;
      }

      return `<label for="${fieldId}">${field.label}<input id="${fieldId}" name="${field.key}" type="${field.type}" value="${escapeHtml(value)}" ${field.required ? "required" : ""} ${field.min !== undefined ? `min="${field.min}"` : ""} /></label>`;
    })
    .join("");

  editModal.classList.remove("hidden");
  editModal.setAttribute("aria-hidden", "false");
}

function readModalPayload() {
  if (!modalState) {
    return null;
  }

  const schema = EDIT_SCHEMAS[modalState.collection];
  if (!schema) {
    return null;
  }

  const formData = new FormData(modalForm);
  const payload = {};

  for (const field of schema.fields) {
    const raw = String(formData.get(field.key) ?? "").trim();

    if (field.required && !raw) {
      modalMessage.textContent = `${field.label} is required.`;
      return null;
    }

    if (field.type === "number") {
      const parsed = Number(raw);
      if (
        !Number.isFinite(parsed) ||
        (field.min !== undefined && parsed < field.min)
      ) {
        modalMessage.textContent = `Invalid value for ${field.label}.`;
        return null;
      }
      payload[field.key] = parsed;
      continue;
    }

    if (field.type === "select") {
      const normalized = raw.toLowerCase();
      if (!field.options.includes(normalized)) {
        modalMessage.textContent = `Invalid value for ${field.label}.`;
        return null;
      }
      payload[field.key] = normalized;
      continue;
    }

    payload[field.key] = raw;
  }

  return payload;
}

async function saveModalEdit() {
  const payload = readModalPayload();
  if (!payload || !modalState) {
    return;
  }

  const { collection, id } = modalState;
  const updates = {
    ...payload,
    updatedAt: serverTimestamp(),
    updatedAtMs: Date.now(),
  };

  if (collection === "payments") {
    updates.paidAt = payload.status === "paid" ? new Date().toISOString() : "";
  }

  await update(ref(db, `${collection}/${id}`), updates);

  if (collection === "payments") {
    const payment = paymentsCache[id];
    if (payment?.bookingId) {
      await update(ref(db, `bookings/${payment.bookingId}`), {
        paymentStatus:
          mapPaymentStateToBookingState[payload.status] || "pending",
      });
    }
  }

  closeModal();
}

async function acceptBooking(id) {
  const booking = bookingsCache[id];
  if (!booking) {
    return;
  }

  await update(ref(db, `bookings/${id}`), {
    status: "accepted",
    updatedAt: serverTimestamp(),
    updatedAtMs: Date.now(),
  });
}

async function rejectBooking(id) {
  const booking = bookingsCache[id];
  if (!booking) {
    return;
  }

  await update(ref(db, `bookings/${id}`), {
    status: "rejected",
    paymentStatus: "unpaid",
    updatedAt: serverTimestamp(),
    updatedAtMs: Date.now(),
  });

  if (booking.roomId) {
    await update(ref(db, `rooms/${booking.roomId}`), {
      status: "available",
    });
  }
}

async function acceptCheckin(id) {
  const checkin = checkinsCache[id];
  if (!checkin) {
    return;
  }

  await update(ref(db, `checkins/${id}`), {
    status: "in",
    checkInTime: checkin.checkInTime || new Date().toISOString(),
    updatedAt: serverTimestamp(),
    updatedAtMs: Date.now(),
  });

  if (checkin.bookingId) {
    await update(ref(db, `bookings/${checkin.bookingId}`), {
      status: "checked-in",
      updatedAt: serverTimestamp(),
      updatedAtMs: Date.now(),
    });
  }

  if (checkin.roomId) {
    await update(ref(db, `rooms/${checkin.roomId}`), {
      status: "occupied",
    });
  }
}

async function rejectCheckin(id) {
  const checkin = checkinsCache[id];
  if (!checkin) {
    return;
  }

  await update(ref(db, `checkins/${id}`), {
    status: "rejected",
    checkOutTime: "",
    updatedAt: serverTimestamp(),
    updatedAtMs: Date.now(),
  });

  const booking = checkin.bookingId ? bookingsCache[checkin.bookingId] : null;
  if (checkin.bookingId) {
    const nextBookingStatus =
      booking && String(booking.status).toLowerCase() === "rejected"
        ? "rejected"
        : "accepted";

    await update(ref(db, `bookings/${checkin.bookingId}`), {
      status: nextBookingStatus,
      updatedAt: serverTimestamp(),
      updatedAtMs: Date.now(),
    });
  }

  if (checkin.roomId) {
    await update(ref(db, `rooms/${checkin.roomId}`), {
      status: "available",
    });
  }
}

async function approvePayment(id) {
  const payment = paymentsCache[id];
  if (!payment) {
    return;
  }

  await update(ref(db, `payments/${id}`), {
    status: "paid",
    paidAt: new Date().toISOString(),
    updatedAt: serverTimestamp(),
    updatedAtMs: Date.now(),
  });

  if (payment.bookingId) {
    await update(ref(db, `bookings/${payment.bookingId}`), {
      paymentStatus: "paid",
    });
  }
}

async function rejectPayment(id) {
  const payment = paymentsCache[id];
  if (!payment) {
    return;
  }

  await update(ref(db, `payments/${id}`), {
    status: "failed",
    paidAt: "",
    updatedAt: serverTimestamp(),
    updatedAtMs: Date.now(),
  });

  if (payment.bookingId) {
    await update(ref(db, `bookings/${payment.bookingId}`), {
      paymentStatus: "unpaid",
    });
  }
}

async function approveAmenityRequest(id) {
  const request = amenityRequestsCache[id];
  if (!request) {
    return;
  }

  await update(ref(db, `amenityRequests/${id}`), {
    status: "approved",
    reviewedAt: new Date().toISOString(),
    updatedAt: serverTimestamp(),
    updatedAtMs: Date.now(),
  });
}

async function rejectAmenityRequest(id) {
  const request = amenityRequestsCache[id];
  if (!request) {
    return;
  }

  await update(ref(db, `amenityRequests/${id}`), {
    status: "rejected",
    reviewedAt: new Date().toISOString(),
    updatedAt: serverTimestamp(),
    updatedAtMs: Date.now(),
  });
}

function ensureAuth() {
  const token = localStorage.getItem("rbmsAdmin");
  if (token === "ok") {
    loginView.classList.add("hidden");
    dashboardView.classList.remove("hidden");
    initializeTabs();
    subscribeAll();
  }
}

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    localStorage.setItem("rbmsAdmin", "ok");
    loginMessage.textContent = "";
    loginView.classList.add("hidden");
    dashboardView.classList.remove("hidden");
    initializeTabs();
    subscribeAll();
    return;
  }

  loginMessage.textContent = "Invalid admin credentials.";
});

function initializeTabs() {
  if (tabsInitialized) {
    return;
  }

  const activateTab = (name) => {
    tabButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.tab === name);
    });

    tabPanels.forEach((panel) => {
      panel.classList.toggle("hidden", panel.id !== `panel-${name}`);
    });
  };

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => activateTab(button.dataset.tab));
  });

  activateTab("overview");
  tabsInitialized = true;
}

logoutBtn.addEventListener("click", () => {
  localStorage.removeItem("rbmsAdmin");
  location.reload();
});

roomForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = {
    number: document.getElementById("roomNumber").value.trim(),
    type: document.getElementById("roomType").value.trim(),
    capacity: Number(document.getElementById("roomCapacity").value),
    price: Number(document.getElementById("roomPrice").value),
    status: document.getElementById("roomStatus").value,
    createdAt: serverTimestamp(),
    createdAtMs: Date.now(),
  };

  const roomRef = push(ref(db, "rooms"));
  await set(roomRef, payload);
  roomForm.reset();
});

bookingForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const roomId = bookingRoomId.value;
  const room = roomsCache[roomId];
  if (!room) {
    alert("Please select a valid room.");
    return;
  }

  const checkInDate = document.getElementById("checkInDate").value;
  const checkOutDate = document.getElementById("checkOutDate").value;
  const checkIn = parseDateInput(checkInDate);
  const checkOut = parseDateInput(checkOutDate);

  if (!checkIn || !checkOut || checkOut <= checkIn) {
    alert("Check-out date must be after check-in date.");
    return;
  }

  const guestCount = Number(document.getElementById("guestCount").value);
  if (guestCount > Number(room.capacity || 1)) {
    alert(`Room capacity is ${room.capacity}.`);
    return;
  }

  const msPerDay = 1000 * 60 * 60 * 24;
  const nights = Math.max(1, Math.ceil((checkOut - checkIn) / msPerDay));

  const enteredTotal = Number(document.getElementById("totalAmount").value);
  const computedTotal = Number(room.price || 0) * nights;
  const totalAmount = enteredTotal > 0 ? enteredTotal : computedTotal;

  const payload = {
    guestName: document.getElementById("guestName").value.trim(),
    roomId,
    roomNumber: room.number || "",
    roomType: room.type || "",
    checkInDate,
    checkOutDate,
    guestCount,
    totalAmount,
    status: document.getElementById("bookingStatus").value,
    paymentStatus: document.getElementById("paymentStatus").value,
    createdAt: serverTimestamp(),
    createdAtMs: Date.now(),
    source: "admin-portal",
  };

  const bookingRef = push(ref(db, "bookings"));
  await set(bookingRef, payload);
  bookingForm.reset();
});

checkinForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const bookingId = checkinBookingId.value;
  const booking = bookingsCache[bookingId];
  if (!booking) {
    alert("Please select a valid booking.");
    return;
  }

  const roomId = checkinRoomId.value || booking.roomId;
  const room = roomsCache[roomId];
  if (!room) {
    alert("Please select a valid room.");
    return;
  }

  const status = document.getElementById("checkinStatus").value;
  const payload = {
    bookingId,
    roomId,
    guestName:
      checkinGuestNameInput.value.trim() ||
      booking.guestName ||
      "Unknown Guest",
    status,
    checkInTime: status === "in" ? new Date().toISOString() : "",
    checkOutTime: status === "out" ? new Date().toISOString() : "",
    createdAt: serverTimestamp(),
    createdAtMs: Date.now(),
  };

  const checkinRef = push(ref(db, "checkins"));
  await set(checkinRef, payload);

  await update(ref(db, `bookings/${bookingId}`), {
    status: status === "in" ? "checked-in" : "checked-out",
  });

  await update(ref(db, `rooms/${roomId}`), {
    status: status === "in" ? "occupied" : "available",
  });

  checkinForm.reset();
});

amenityForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = {
    name: document.getElementById("amenityName").value.trim(),
    location: document.getElementById("amenityLocation").value.trim(),
    price: Number(document.getElementById("amenityPrice").value),
    availability: document.getElementById("amenityAvailability").value,
    createdAt: serverTimestamp(),
    createdAtMs: Date.now(),
  };

  const amenityRef = push(ref(db, "amenities"));
  await set(amenityRef, payload);
  amenityForm.reset();
});

paymentForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const bookingId = paymentBookingId.value;
  const booking = bookingsCache[bookingId];
  if (!booking) {
    alert("Please select a valid booking.");
    return;
  }

  const status = document.getElementById("paymentState").value;
  const method = document.getElementById("paymentMethod").value;
  const amount = Number(paymentAmountInput.value || booking.totalAmount || 0);

  if (!(amount > 0)) {
    alert("Enter a valid payment amount.");
    return;
  }

  const guestName =
    paymentGuestNameInput.value.trim() || booking.guestName || "Unknown Guest";

  const payload = {
    bookingId,
    userId: booking.userId || "",
    userEmail: booking.userEmail || "",
    guestName,
    checkInDate: booking.checkInDate || "",
    checkOutDate: booking.checkOutDate || "",
    bookingLabel:
      booking.checkInDate && booking.checkOutDate
        ? `${booking.checkInDate} to ${booking.checkOutDate}`
        : "",
    amount,
    method,
    status,
    paidAt: status === "paid" ? new Date().toISOString() : "",
    createdAt: serverTimestamp(),
    createdAtMs: Date.now(),
    source: "admin-portal",
  };

  const existingPaymentEntry = Object.entries(paymentsCache).find(
    ([, payment]) =>
      payment.bookingId === bookingId &&
      String(payment.status || "").toLowerCase() === "pending",
  );

  if (existingPaymentEntry) {
    const [existingId] = existingPaymentEntry;
    await update(ref(db, `payments/${existingId}`), {
      guestName,
      checkInDate: booking.checkInDate || "",
      checkOutDate: booking.checkOutDate || "",
      bookingLabel:
        booking.checkInDate && booking.checkOutDate
          ? `${booking.checkInDate} to ${booking.checkOutDate}`
          : "",
      amount,
      method,
      status,
      paidAt: status === "paid" ? new Date().toISOString() : "",
      updatedAt: serverTimestamp(),
      updatedAtMs: Date.now(),
    });
  } else {
    const paymentRef = push(ref(db, "payments"));
    await set(paymentRef, payload);
  }

  await update(ref(db, `bookings/${bookingId}`), {
    paymentStatus: mapPaymentStateToBookingState[status] || "pending",
  });

  paymentForm.reset();
});

checkinBookingId.addEventListener("change", () => {
  const booking = bookingsCache[checkinBookingId.value];
  if (!booking) {
    return;
  }

  checkinGuestNameInput.value = booking.guestName || "";
  checkinRoomId.value = booking.roomId || "";
});

paymentBookingId.addEventListener("change", () => {
  const booking = bookingsCache[paymentBookingId.value];
  if (!booking) {
    return;
  }

  paymentGuestNameInput.value = booking.guestName || "";
  paymentAmountInput.value = Number(booking.totalAmount || 0).toFixed(2);
});

modalForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await saveModalEdit();
});

modalCloseBtn.addEventListener("click", closeModal);
modalCancelBtn.addEventListener("click", closeModal);

editModal.addEventListener("click", (event) => {
  if (event.target === editModal) {
    closeModal();
  }
});

function subscribeAll() {
  subscribeRooms();
  subscribeBookings();
  subscribeCheckins();
  subscribeAmenities();
  subscribeAmenityRequests();
  subscribePayments();
}

function subscribeRooms() {
  onValue(ref(db, "rooms"), (snapshot) => {
    const rooms = snapshot.val() || {};
    roomsCache = rooms;
    renderRooms(rooms);
    populateRoomSelects(rooms);
    totalRooms.textContent = String(Object.keys(rooms).length);
  });
}

function subscribeBookings() {
  onValue(ref(db, "bookings"), (snapshot) => {
    const bookings = snapshot.val() || {};
    bookingsCache = bookings;
    renderBookings(bookings);
    populateBookingSelects(bookings);

    const active = Object.values(bookings).filter((booking) =>
      ["reserved", "accepted", "checked-in"].includes(
        String(booking.status || "").toLowerCase(),
      ),
    ).length;

    activeBookings.textContent = String(active);
  });
}

function subscribeCheckins() {
  onValue(ref(db, "checkins"), (snapshot) => {
    const checkins = snapshot.val() || {};
    checkinsCache = checkins;
    renderCheckins(checkins);

    const checkedIn = Object.values(checkins).filter(
      (checkin) => String(checkin.status || "").toLowerCase() === "in",
    ).length;

    checkedInCount.textContent = String(checkedIn);
  });
}

function subscribeAmenities() {
  onValue(ref(db, "amenities"), (snapshot) => {
    const amenities = snapshot.val() || {};
    amenitiesCache = amenities;
    renderAmenities(amenities);
  });
}

function subscribeAmenityRequests() {
  onValue(ref(db, "amenityRequests"), (snapshot) => {
    const requests = snapshot.val() || {};
    amenityRequestsCache = requests;
    renderAmenityRequests(requests);
  });
}

function subscribePayments() {
  onValue(ref(db, "payments"), (snapshot) => {
    const payments = snapshot.val() || {};
    paymentsCache = payments;
    renderPayments(payments);

    const revenue = Object.values(payments)
      .filter(
        (payment) => String(payment.status || "").toLowerCase() === "paid",
      )
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

    paidRevenue.textContent = formatMoney(revenue);
  });
}

function populateRoomSelects(rooms) {
  const options = Object.entries(rooms)
    .map(
      ([id, room]) =>
        `<option value="${id}">${escapeHtml(room.number)} - ${escapeHtml(room.type)}</option>`,
    )
    .join("");

  bookingRoomId.innerHTML = '<option value="">Select Room</option>' + options;
  checkinRoomId.innerHTML = '<option value="">Select Room</option>' + options;
}

function populateBookingSelects(bookings) {
  const options = Object.entries(bookings)
    .map(
      ([id, booking]) =>
        `<option value="${id}">${escapeHtml(booking.guestName)} - ${escapeHtml(booking.checkInDate)} (${escapeHtml(booking.status || "reserved")})</option>`,
    )
    .join("");

  checkinBookingId.innerHTML =
    '<option value="">Select Booking</option>' + options;
  paymentBookingId.innerHTML =
    '<option value="">Select Booking</option>' + options;
}

function renderRooms(rooms) {
  roomsTableBody.innerHTML = Object.entries(rooms)
    .map(
      ([id, room]) => `
      <tr>
        <td>${escapeHtml(room.number)}</td>
        <td>${escapeHtml(room.type)}</td>
        <td>${escapeHtml(room.capacity)}</td>
        <td>${formatMoney(room.price)}</td>
        <td>${escapeHtml(room.status)}</td>
        <td>
          <div class="action-group">
            <button class="action-btn edit" data-edit="rooms" data-id="${id}">Edit</button>
            <button class="action-btn danger" data-del="rooms" data-id="${id}">Delete</button>
          </div>
        </td>
      </tr>`,
    )
    .join("");
}

function renderBookings(bookings) {
  bookingsTableBody.innerHTML = Object.entries(bookings)
    .map(([id, booking]) => {
      const room = roomsCache[booking.roomId];
      const roomLabel = room ? `${room.number}/${room.type}` : "Unknown";
      const status = String(booking.status || "reserved").toLowerCase();

      const showAccept = ![
        "accepted",
        "checked-in",
        "checked-out",
        "cancelled",
      ].includes(status);
      const showReject = !["rejected", "checked-out", "cancelled"].includes(
        status,
      );

      return `
      <tr>
        <td>${escapeHtml(booking.guestName)}</td>
        <td>${escapeHtml(roomLabel)}</td>
        <td>${escapeHtml(booking.checkInDate)} to ${escapeHtml(booking.checkOutDate)}</td>
        <td>${escapeHtml(booking.status || "reserved")}</td>
        <td>${escapeHtml(booking.paymentStatus || "unpaid")}</td>
        <td>
          <div class="action-group">
            ${showAccept ? `<button class="action-btn approve" data-accept-booking data-id="${id}">Accept</button>` : ""}
            ${showReject ? `<button class="action-btn reject" data-reject-booking data-id="${id}">Reject</button>` : ""}
            <button class="action-btn danger" data-del="bookings" data-id="${id}">Delete</button>
          </div>
        </td>
      </tr>`;
    })
    .join("");
}

function renderCheckins(checkins) {
  checkinsTableBody.innerHTML = Object.entries(checkins)
    .map(([id, checkin]) => {
      const booking = bookingsCache[checkin.bookingId];
      const room = roomsCache[checkin.roomId];

      return `
      <tr>
        <td>${escapeHtml(checkin.guestName)}</td>
        <td>${escapeHtml(booking?.guestName || "Unknown")}</td>
        <td>${escapeHtml(room?.number || "Unknown")}</td>
        <td>${escapeHtml(checkin.status || "-")}</td>
        <td>
          <div class="action-group">
            <button class="action-btn approve" data-accept-checkin data-id="${id}">Accept</button>
            <button class="action-btn reject" data-reject-checkin data-id="${id}">Reject</button>
            <button class="action-btn danger" data-del="checkins" data-id="${id}">Delete</button>
          </div>
        </td>
      </tr>`;
    })
    .join("");
}

function renderAmenities(amenities) {
  amenitiesTableBody.innerHTML = Object.entries(amenities)
    .map(
      ([id, amenity]) => `
      <tr>
        <td>${escapeHtml(amenity.name)}</td>
        <td>${escapeHtml(amenity.location)}</td>
        <td>${formatMoney(amenity.price)}</td>
        <td>${escapeHtml(amenity.availability)}</td>
        <td>
          <div class="action-group">
            <button class="action-btn edit" data-edit="amenities" data-id="${id}">Edit</button>
            <button class="action-btn danger" data-del="amenities" data-id="${id}">Delete</button>
          </div>
        </td>
      </tr>`,
    )
    .join("");
}

function renderAmenityRequests(requests) {
  const rows = Object.entries(requests).sort(
    (a, b) => Number(b[1]?.createdAtMs || 0) - Number(a[1]?.createdAtMs || 0),
  );

  if (!rows.length) {
    amenityRequestsTableBody.innerHTML =
      '<tr><td colspan="8">No amenity requests yet.</td></tr>';
    return;
  }

  amenityRequestsTableBody.innerHTML = rows
    .map(([id, request]) => {
      const amenity = amenitiesCache[request.amenityId];
      const requestStatus = String(request.status || "pending").toLowerCase();
      const statusClass =
        requestStatus === "approved" || requestStatus === "fulfilled"
          ? "approved"
          : requestStatus === "rejected" || requestStatus === "cancelled"
            ? "rejected"
            : "pending";

      const guestLabel =
        request.guestName || request.userEmail || "Unknown Guest";
      const amenityLabel = request.amenityName || amenity?.name || "Unknown";
      const locationLabel = request.amenityLocation || amenity?.location || "-";
      const quantity = Number(request.quantity || 1);
      const totalAmount = Number(
        request.totalAmount || Number(request.unitPrice || 0) * quantity,
      );
      const requestedAt = request.createdAtMs
        ? new Date(request.createdAtMs).toLocaleString()
        : "-";

      const reviewActions =
        requestStatus === "pending"
          ? `<button class="action-btn approve" data-approve-amenity-request data-id="${id}">Accept</button>
             <button class="action-btn reject" data-reject-amenity-request data-id="${id}">Reject</button>`
          : "";

      return `
      <tr>
        <td>${escapeHtml(guestLabel)}</td>
        <td>${escapeHtml(amenityLabel)}</td>
        <td>${escapeHtml(locationLabel)}</td>
        <td>${escapeHtml(quantity)}</td>
        <td>${formatMoney(totalAmount)}</td>
        <td><span class="status-pill ${statusClass}">${escapeHtml(requestStatus)}</span></td>
        <td>${escapeHtml(requestedAt)}</td>
        <td>
          <div class="action-group amenity-request-actions">
            ${reviewActions}
            <button class="action-btn danger" data-del="amenityRequests" data-id="${id}">Delete</button>
          </div>
        </td>
      </tr>`;
    })
    .join("");
}

function renderPayments(payments) {
  paymentsTableBody.innerHTML = Object.entries(payments)
    .map(([id, payment]) => {
      const booking = bookingsCache[payment.bookingId];
      const paymentStatus = String(payment.status || "pending").toLowerCase();
      const statusClass = ["paid", "pending", "failed"].includes(paymentStatus)
        ? paymentStatus
        : "pending";

      const guestLabel =
        payment.guestName ||
        booking?.guestName ||
        booking?.userEmail ||
        "Unknown Guest";

      const bookingLabel =
        booking?.checkInDate && booking?.checkOutDate
          ? `${booking.checkInDate} to ${booking.checkOutDate}`
          : payment.bookingLabel ||
            (payment.checkInDate && payment.checkOutDate
              ? `${payment.checkInDate} to ${payment.checkOutDate}`
              : "Unknown booking");

      const pendingActions =
        paymentStatus === "pending"
          ? `<button class="action-btn approve" data-approve-payment data-id="${id}">Accept</button>
             <button class="action-btn reject" data-reject-payment data-id="${id}">Reject</button>`
          : "";

      return `
      <tr>
        <td>${escapeHtml(guestLabel)}</td>
        <td>${escapeHtml(bookingLabel)}</td>
        <td>${formatMoney(payment.amount)}</td>
        <td>${escapeHtml(payment.method)}</td>
        <td><span class="status-pill ${statusClass}">${escapeHtml(payment.status || "pending")}</span></td>
        <td>
          <div class="action-group payment-actions">
            ${pendingActions}
            <button class="action-btn danger" data-del="payments" data-id="${id}">Delete</button>
          </div>
        </td>
      </tr>`;
    })
    .join("");
}

document.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const button = target.closest("button");
  if (!button) {
    return;
  }

  if (button.matches("[data-edit]")) {
    const collection = button.getAttribute("data-edit");
    const id = button.getAttribute("data-id");
    if (collection && id && EDIT_SCHEMAS[collection]) {
      openModal(collection, id);
    }
    return;
  }

  if (button.matches("[data-accept-booking]")) {
    const id = button.getAttribute("data-id");
    if (id) {
      await acceptBooking(id);
    }
    return;
  }

  if (button.matches("[data-reject-booking]")) {
    const id = button.getAttribute("data-id");
    if (id) {
      await rejectBooking(id);
    }
    return;
  }

  if (button.matches("[data-accept-checkin]")) {
    const id = button.getAttribute("data-id");
    if (id) {
      await acceptCheckin(id);
    }
    return;
  }

  if (button.matches("[data-reject-checkin]")) {
    const id = button.getAttribute("data-id");
    if (id) {
      await rejectCheckin(id);
    }
    return;
  }

  if (button.matches("[data-approve-amenity-request]")) {
    const id = button.getAttribute("data-id");
    if (id) {
      await approveAmenityRequest(id);
    }
    return;
  }

  if (button.matches("[data-reject-amenity-request]")) {
    const id = button.getAttribute("data-id");
    if (id) {
      await rejectAmenityRequest(id);
    }
    return;
  }

  if (button.matches("[data-approve-payment]")) {
    const id = button.getAttribute("data-id");
    if (id) {
      await approvePayment(id);
    }
    return;
  }

  if (button.matches("[data-reject-payment]")) {
    const id = button.getAttribute("data-id");
    if (id) {
      await rejectPayment(id);
    }
    return;
  }

  if (button.matches("[data-del]")) {
    const collection = button.getAttribute("data-del");
    const id = button.getAttribute("data-id");

    if (!collection || !id) {
      return;
    }

    const yes = confirm("Delete this record?");
    if (!yes) {
      return;
    }

    await remove(ref(db, `${collection}/${id}`));
  }
});

ensureAuth();
void analytics;
