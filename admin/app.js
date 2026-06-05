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
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

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
const storage = getStorage(app);

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
const paymentForm = document.getElementById("paymentForm");

const roomsTableBody = document.getElementById("roomsTableBody");
const bookingsTableBody = document.getElementById("bookingsTableBody");
const checkinsTableBody = document.getElementById("checkinsTableBody");
const paymentsTableBody = document.getElementById("paymentsTableBody");

const bookingRoomId = document.getElementById("bookingRoomId");
const checkinRoomId = document.getElementById("checkinRoomId");
const checkinBookingId = document.getElementById("checkinBookingId");
const paymentBookingId = document.getElementById("paymentBookingId");
const checkinGuestNameInput = document.getElementById("checkinGuestName");
const paymentGuestNameInput = document.getElementById("paymentGuestName");
const paymentAmountInput = document.getElementById("paymentAmount");

const roomImageInput = document.getElementById("roomImage");
const roomUploadMessage = document.getElementById("roomUploadMessage");

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
let paymentsCache = {};
let roomImageCache = {};
let tabsInitialized = false;
let modalState = null;
let activateTab = null;

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
  "pay-later": "pay-later",
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
        options: ["paid", "pending", "failed", "pay-later"],
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

  let fieldsHtml = schema.fields
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

  if (collection === "rooms") {
    fieldsHtml += `
      <div class="modal-image-section" style="margin-top: 12px; display: grid; gap: 8px;">
        <label style="color: #0d3f90; font-size: 0.86rem; font-weight: 500;">Current Room Image</label>
        <div id="modal-image-preview" class="modal-image-preview">
          <div class="room-img-placeholder">Checking storage...</div>
        </div>
        <label class="file-label">
          Upload New Image
          <input
            id="modal-room-image-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
          />
        </label>
      </div>
    `;
  }

  modalFields.innerHTML = fieldsHtml;

  if (collection === "rooms") {
    const previewContainer = document.getElementById("modal-image-preview");
    getRoomImageUrl(id).then((url) => {
      if (url) {
        previewContainer.innerHTML = `<img src="${url}" alt="Room" class="room-img-thumb-modal" />`;
      } else {
        previewContainer.innerHTML = `<div class="room-img-placeholder">No image</div>`;
      }
    });

    const fileInput = document.getElementById("modal-room-image-input");
    fileInput.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          previewContainer.innerHTML = `<img src="${e.target.result}" alt="Preview" class="room-img-thumb-modal" />`;
        };
        reader.readAsDataURL(file);
      }
    });
  }

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

  const submitBtn = modalForm.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
  }

  try {
    await update(ref(db, `${collection}/${id}`), updates);

    if (collection === "rooms") {
      const fileInput = document.getElementById("modal-room-image-input");
      const file = fileInput?.files?.[0];
      if (file) {
        modalMessage.textContent = "Uploading image...";
        const url = await uploadRoomImage(id, file);
        roomImageCache[id] = url;
        loadRoomImage(id);
      }
    }

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
  } catch (err) {
    console.error("Save edit failed:", err);
    modalMessage.textContent = "Error saving changes: " + err.message;
    if (submitBtn) {
      submitBtn.disabled = false;
    }
  }
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

  activateTab = (name) => {
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

/* ── Room image upload helper ── */

async function uploadRoomImage(roomId, file) {
  const ext = file.name.split(".").pop().toLowerCase();

  // Clean up any existing image files with different extensions to avoid conflicts
  const extensions = ["jpg", "jpeg", "png", "webp"];
  for (const e of extensions) {
    if (e !== ext) {
      try {
        const oldRef = storageRef(storage, `rooms/${roomId}.${e}`);
        await deleteObject(oldRef);
      } catch (err) {
        // Ignore error if file didn't exist
      }
    }
  }

  const path = `rooms/${roomId}.${ext}`;
  const sRef = storageRef(storage, path);
  await uploadBytes(sRef, file);
  const url = await getDownloadURL(sRef);
  return url;
}

async function getRoomImageUrl(roomId) {
  if (roomImageCache[roomId] !== undefined) {
    return roomImageCache[roomId];
  }

  const extensions = ["jpg", "jpeg", "png", "webp"];
  for (const ext of extensions) {
    try {
      const url = await getDownloadURL(
        storageRef(storage, `rooms/${roomId}.${ext}`),
      );
      roomImageCache[roomId] = url;
      return url;
    } catch {
      /* try next */
    }
  }

  roomImageCache[roomId] = null;
  return null;
}

/* ── Overview Dashboard Helpers ── */

function updateOccupancyBreakdown(rooms) {
  const roomsList = Object.values(rooms);
  const total = roomsList.length;

  const available = roomsList.filter(
    (r) => String(r.status).toLowerCase() === "available",
  ).length;
  const occupied = roomsList.filter(
    (r) => String(r.status).toLowerCase() === "occupied",
  ).length;
  const maintenance = roomsList.filter(
    (r) => String(r.status).toLowerCase() === "maintenance",
  ).length;

  const countAvailable = document.getElementById("occupancyAvailable");
  const countOccupied = document.getElementById("occupancyOccupied");
  const countMaintenance = document.getElementById("occupancyMaintenance");

  if (countAvailable) countAvailable.textContent = String(available);
  if (countOccupied) countOccupied.textContent = String(occupied);
  if (countMaintenance) countMaintenance.textContent = String(maintenance);

  const availablePct = total > 0 ? (available / total) * 100 : 0;
  const occupiedPct = total > 0 ? (occupied / total) * 100 : 0;
  const maintenancePct = total > 0 ? (maintenance / total) * 100 : 0;

  const barAvailable = document.getElementById("occupancyBarAvailable");
  const barOccupied = document.getElementById("occupancyBarOccupied");
  const barMaintenance = document.getElementById("occupancyBarMaintenance");

  if (barAvailable) barAvailable.style.width = `${availablePct}%`;
  if (barOccupied) barOccupied.style.width = `${occupiedPct}%`;
  if (barMaintenance) barMaintenance.style.width = `${maintenancePct}%`;
}

function updateRecentBookings(bookings) {
  const container = document.getElementById("overviewRecentBookings");
  if (!container) return;

  const sorted = Object.entries(bookings)
    .sort((a, b) => (b[1].createdAtMs || 0) - (a[1].createdAtMs || 0))
    .slice(0, 5);

  if (sorted.length === 0) {
    container.innerHTML = `<tr><td colspan="4" class="room-img-placeholder" style="text-align: center; padding: 12px;">No bookings found</td></tr>`;
    return;
  }

  container.innerHTML = sorted
    .map(([id, booking]) => {
      const room = roomsCache[booking.roomId];
      const roomLabel = room ? room.number : "Room";
      return `
        <tr>
          <td><strong>${escapeHtml(booking.guestName)}</strong></td>
          <td>${escapeHtml(roomLabel)}</td>
          <td style="font-size: 0.8rem; color: var(--muted);">${escapeHtml(booking.checkInDate)} to ${escapeHtml(booking.checkOutDate)}</td>
          <td><span class="status-pill" style="padding: 2px 8px; font-size: 0.72rem;">${escapeHtml(booking.status || "reserved")}</span></td>
        </tr>
      `;
    })
    .join("");
}

function updateRecentPayments(payments) {
  const container = document.getElementById("overviewRecentPayments");
  if (!container) return;

  const sorted = Object.values(payments)
    .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0))
    .slice(0, 5);

  if (sorted.length === 0) {
    container.innerHTML = `<tr><td colspan="3" class="room-img-placeholder" style="text-align: center; padding: 12px;">No payments found</td></tr>`;
    return;
  }

  container.innerHTML = sorted
    .map((payment) => {
      const paymentStatus = String(payment.status || "pending").toLowerCase();
      const statusClass = ["paid", "pending", "failed", "pay-later"].includes(
        paymentStatus,
      )
        ? paymentStatus
        : "pending";

      return `
        <tr>
          <td><strong>${escapeHtml(payment.guestName || "Guest")}</strong></td>
          <td>${formatMoney(payment.amount)}</td>
          <td><span class="status-pill ${statusClass}" style="padding: 2px 8px; font-size: 0.72rem;">${escapeHtml(payment.status || "pending")}</span></td>
        </tr>
      `;
    })
    .join("");
}

/* ── Form submissions ── */

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

  /* Upload image if provided */
  const file = roomImageInput?.files?.[0];
  if (file) {
    try {
      roomUploadMessage.textContent = "Uploading image…";
      const url = await uploadRoomImage(roomRef.key, file);
      roomImageCache[roomRef.key] = url;
      roomUploadMessage.textContent = "Image uploaded!";
      setTimeout(() => {
        roomUploadMessage.textContent = "";
      }, 3000);
    } catch (err) {
      console.error("Room image upload failed:", err);
      roomUploadMessage.textContent = "Image upload failed.";
    }
  }

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

  const guestName = document.getElementById("guestName").value.trim();
  const contactNumber = document
    .getElementById("bookingContactNumber")
    .value.trim();

  if (!guestName) {
    alert("Guest name is required.");
    return;
  }
  if (!contactNumber) {
    alert("Contact number is required.");
    return;
  }

  const msPerDay = 1000 * 60 * 60 * 24;
  const nights = Math.max(1, Math.ceil((checkOut - checkIn) / msPerDay));

  const enteredTotal = Number(document.getElementById("totalAmount").value);
  const computedTotal = Number(room.price || 0) * nights;
  const totalAmount = enteredTotal > 0 ? enteredTotal : computedTotal;

  const payload = {
    guestName,
    contactNumber,
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

paymentForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const bookingId = paymentBookingId.value;
  const booking = bookingsCache[bookingId];
  if (!booking) {
    alert("Please select a valid booking.");
    return;
  }

  const payTiming = document.querySelector(
    'input[name="payTiming"]:checked',
  )?.value;

  let status = document.getElementById("paymentState").value;
  if (payTiming === "later") {
    status = "pay-later";
  }

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
    payTiming: payTiming || "now",
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
      payTiming: payTiming || "now",
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

/* ── Realtime subscriptions ── */

function subscribeAll() {
  subscribeRooms();
  subscribeBookings();
  subscribeCheckins();
  subscribePayments();
}

function subscribeRooms() {
  onValue(ref(db, "rooms"), (snapshot) => {
    const rooms = snapshot.val() || {};
    roomsCache = rooms;
    renderRooms(rooms);
    populateRoomSelects(rooms);
    totalRooms.textContent = String(Object.keys(rooms).length);
    updateOccupancyBreakdown(rooms);
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
    updateRecentBookings(bookings);
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
    updateRecentPayments(payments);
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

/* ── Render functions ── */

function renderRooms(rooms) {
  const entries = Object.entries(rooms);
  roomsTableBody.innerHTML = entries
    .map(
      ([id, room]) => `
      <tr>
        <td>
          <div class="room-img-cell" id="room-img-${id}">
            <div class="room-img-placeholder">…</div>
          </div>
        </td>
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

  /* Load images asynchronously */
  for (const [id] of entries) {
    loadRoomImage(id);
  }
}

async function loadRoomImage(roomId) {
  const cell = document.getElementById(`room-img-${roomId}`);
  if (!cell) return;

  const url = await getRoomImageUrl(roomId);
  if (url) {
    cell.innerHTML = `<img src="${url}" alt="Room" class="room-img-thumb" />`;
  } else {
    cell.innerHTML = `<div class="room-img-placeholder">No image</div>`;
  }
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
        <td>${escapeHtml(booking.contactNumber || "-")}</td>
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

function renderPayments(payments) {
  paymentsTableBody.innerHTML = Object.entries(payments)
    .map(([id, payment]) => {
      const booking = bookingsCache[payment.bookingId];
      const paymentStatus = String(payment.status || "pending").toLowerCase();
      const statusClass = [
        "paid",
        "pending",
        "failed",
        "pay-later",
      ].includes(paymentStatus)
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
        paymentStatus === "pending" || paymentStatus === "pay-later"
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
            <button class="action-btn edit" data-edit="payments" data-id="${id}">Edit</button>
            <button class="action-btn danger" data-del="payments" data-id="${id}">Delete</button>
          </div>
        </td>
      </tr>`;
    })
    .join("");
}

/* ── Global click delegation ── */

document.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const button = target.closest("button");
  if (!button) {
    return;
  }

  if (button.matches("[data-nav-tab]")) {
    const tabName = button.getAttribute("data-nav-tab");
    if (tabName && activateTab) {
      activateTab(tabName);
    }
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
