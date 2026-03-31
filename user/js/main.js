import {
  auth,
  loginUser,
  logoutUser,
  observeAuth,
  registerUser,
} from "./services/authService.js";
import {
  createBooking,
  createAmenityRequest,
  createPayment,
  subscribeActiveBookings,
  subscribeAmenities,
  subscribeRooms,
  subscribeUserAmenityRequests,
  subscribeUserBookings,
  subscribeUserPayments,
} from "./services/dataService.js";
import {
  money,
  renderAmenities,
  renderBookingOptions,
  renderBookings,
  renderPayments,
  renderRoomOptions,
  renderRooms,
} from "./ui/render.js";

const authView = document.getElementById("authView");
const appView = document.getElementById("appView");

const showLoginBtn = document.getElementById("showLoginBtn");
const showRegisterBtn = document.getElementById("showRegisterBtn");
const authMessage = document.getElementById("authMessage");

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

const userDisplayName = document.getElementById("userDisplayName");
const userDisplayEmail = document.getElementById("userDisplayEmail");
const logoutBtn = document.getElementById("logoutBtn");

const navButtons = Array.from(document.querySelectorAll(".nav-btn"));
const panels = Array.from(document.querySelectorAll(".panel"));

const roomsList = document.getElementById("roomsList");
const bookingForm = document.getElementById("bookingForm");
const bookingRoomSelect = document.getElementById("bookingRoomId");
const bookingMessage = document.getElementById("bookingMessage");
const checkInDateInput = document.getElementById("checkInDate");
const checkOutDateInput = document.getElementById("checkOutDate");

const amenitiesList = document.getElementById("amenitiesList");
const amenityMessage = document.getElementById("amenityMessage");
const bookingsTableBody = document.getElementById("bookingsTableBody");
const paymentsTableBody = document.getElementById("paymentsTableBody");

const paymentForm = document.getElementById("paymentForm");
const paymentBookingSelect = document.getElementById("paymentBookingId");
const paymentAmountInput = document.getElementById("paymentAmount");
const paymentMessage = document.getElementById("paymentMessage");

const notificationToggleBtn = document.getElementById("notificationToggleBtn");
const notificationBadge = document.getElementById("notificationBadge");
const notificationPanel = document.getElementById("notificationPanel");
const notificationsList = document.getElementById("notificationsList");

const state = {
  rooms: [],
  roomsById: {},
  bookings: [],
  bookingsById: {},
  payments: [],
  amenityRequests: [],
  amenitiesById: {},
  notifications: [],
  activeBookingsByRoom: {},
  unsubs: [],
};

const todayIso = new Date().toISOString().split("T")[0];
checkInDateInput.min = todayIso;
checkOutDateInput.min = todayIso;

checkInDateInput.addEventListener("change", () => {
  checkOutDateInput.min = checkInDateInput.value || todayIso;
  if (
    checkOutDateInput.value &&
    checkInDateInput.value &&
    checkOutDateInput.value <= checkInDateInput.value
  ) {
    checkOutDateInput.value = "";
  }
});

function setMessage(target, text, type = "info") {
  target.textContent = text;
  target.classList.toggle("success", type === "success");
}

function clearMessage(target) {
  setMessage(target, "", "info");
}

function formatAuthError(error) {
  const code = error?.code || "";

  if (code.includes("invalid-credential") || code.includes("wrong-password")) {
    return "Invalid email or password.";
  }

  if (code.includes("email-already-in-use")) {
    return "This email is already registered.";
  }

  if (code.includes("weak-password")) {
    return "Password is too weak. Use at least 6 characters.";
  }

  if (code.includes("invalid-email")) {
    return "Please provide a valid email address.";
  }

  return "Something went wrong. Please try again.";
}

function setAuthMode(mode) {
  const isLogin = mode === "login";
  loginForm.classList.toggle("hidden", !isLogin);
  registerForm.classList.toggle("hidden", isLogin);
  showLoginBtn.classList.toggle("active", isLogin);
  showRegisterBtn.classList.toggle("active", !isLogin);
  clearMessage(authMessage);
}

function activatePanel(panelName) {
  navButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.panel === panelName);
  });

  panels.forEach((panel) => {
    panel.classList.toggle("hidden", panel.id !== `panel-${panelName}`);
  });
}

function clearRealtimeSubscriptions() {
  state.unsubs.forEach((unsubscribe) => unsubscribe());
  state.unsubs = [];
}

function parseDateOnly(value) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function hasBookingConflict(roomId, checkInDate, checkOutDate) {
  const start = parseDateOnly(checkInDate);
  const end = parseDateOnly(checkOutDate);

  if (!start || !end) {
    return false;
  }

  const roomBookings = state.activeBookingsByRoom[roomId] || [];
  return roomBookings.some((booking) => {
    const existingStart = parseDateOnly(booking.checkInDate);
    const existingEnd = parseDateOnly(booking.checkOutDate);

    if (!existingStart || !existingEnd) {
      return false;
    }

    return start < existingEnd && existingStart < end;
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getRecordTimestamp(record) {
  const updatedAtMs = Number(record?.updatedAtMs || 0);
  if (Number.isFinite(updatedAtMs) && updatedAtMs > 0) {
    return updatedAtMs;
  }

  const createdAtMs = Number(record?.createdAtMs || 0);
  if (Number.isFinite(createdAtMs) && createdAtMs > 0) {
    return createdAtMs;
  }

  const reviewedAt = record?.reviewedAt ? Date.parse(record.reviewedAt) : NaN;
  if (!Number.isNaN(reviewedAt)) {
    return reviewedAt;
  }

  const paidAt = record?.paidAt ? Date.parse(record.paidAt) : NaN;
  if (!Number.isNaN(paidAt)) {
    return paidAt;
  }

  return 0;
}

function formatNotificationTime(timestampMs) {
  return timestampMs > 0 ? new Date(timestampMs).toLocaleString() : "Recently";
}

function closeNotificationPanel() {
  notificationPanel.classList.add("hidden");
  notificationToggleBtn.setAttribute("aria-expanded", "false");
}

function toggleNotificationPanel() {
  renderNotifications();
  const isHidden = notificationPanel.classList.contains("hidden");
  notificationPanel.classList.toggle("hidden", !isHidden);
  notificationToggleBtn.setAttribute("aria-expanded", String(isHidden));
}

function getBookingLabelForPayment(payment) {
  const booking = state.bookingsById[payment.bookingId];
  if (booking?.checkInDate && booking?.checkOutDate) {
    return `${booking.checkInDate} to ${booking.checkOutDate}`;
  }

  if (payment.bookingLabel) {
    return payment.bookingLabel;
  }

  if (payment.checkInDate && payment.checkOutDate) {
    return `${payment.checkInDate} to ${payment.checkOutDate}`;
  }

  return "your booking";
}

function renderNotifications() {
  const notifications = [];

  state.bookings.forEach((booking) => {
    const status = String(booking.status || "").toLowerCase();
    if (
      ![
        "reserved",
        "accepted",
        "rejected",
        "checked-in",
        "checked-out",
        "cancelled",
      ].includes(status)
    ) {
      return;
    }

    const bookingLabel =
      booking.checkInDate && booking.checkOutDate
        ? `${booking.checkInDate} to ${booking.checkOutDate}`
        : "your booking";

    const messageMap = {
      reserved: `Your booking (${bookingLabel}) was submitted and is pending approval.`,
      accepted: `Your booking (${bookingLabel}) was accepted.`,
      rejected: `Your booking (${bookingLabel}) was rejected.`,
      "checked-in": `You are now checked in for ${bookingLabel}.`,
      "checked-out": `You have checked out from ${bookingLabel}.`,
      cancelled: `Your booking (${bookingLabel}) was cancelled.`,
    };

    const tone =
      status === "rejected" || status === "cancelled"
        ? "danger"
        : status === "reserved"
          ? "info"
          : "success";

    notifications.push({
      id: `booking-${booking.id}`,
      title: "Booking Update",
      message: messageMap[status] || "Booking status updated.",
      tone,
      timestamp: getRecordTimestamp(booking),
    });
  });

  state.payments.forEach((payment) => {
    const status = String(payment.status || "pending").toLowerCase();
    const bookingLabel = getBookingLabelForPayment(payment);

    const messageMap = {
      paid: `Your payment for ${bookingLabel} was confirmed.`,
      failed: `Your payment for ${bookingLabel} was rejected.`,
      pending: `Your payment for ${bookingLabel} is awaiting admin review.`,
    };

    const tone =
      status === "failed" ? "danger" : status === "paid" ? "success" : "info";

    notifications.push({
      id: `payment-${payment.id}`,
      title: "Payment Update",
      message: messageMap[status] || "Payment status updated.",
      tone,
      timestamp: getRecordTimestamp(payment),
    });
  });

  state.amenityRequests.forEach((request) => {
    const status = String(request.status || "pending").toLowerCase();
    const amenityName = request.amenityName || "amenity request";

    const messageMap = {
      approved: `Your amenity request for ${amenityName} was approved.`,
      rejected: `Your amenity request for ${amenityName} was rejected.`,
      pending: `Your amenity request for ${amenityName} is pending approval.`,
    };

    const tone =
      status === "rejected"
        ? "danger"
        : status === "approved"
          ? "success"
          : "info";

    notifications.push({
      id: `amenity-request-${request.id}`,
      title: "Amenity Request",
      message:
        messageMap[status] ||
        `Your amenity request for ${amenityName} was updated.`,
      tone,
      timestamp: getRecordTimestamp(request),
    });
  });

  notifications.sort((a, b) => b.timestamp - a.timestamp);
  state.notifications = notifications.slice(0, 40);

  if (!state.notifications.length) {
    notificationBadge.classList.add("hidden");
    notificationsList.innerHTML =
      '<div class="notif-empty">No notifications yet. Status updates will appear here.</div>';
    return;
  }

  const badgeCount = Math.min(state.notifications.length, 99);
  notificationBadge.textContent = String(badgeCount);
  notificationBadge.classList.remove("hidden");

  notificationsList.innerHTML = state.notifications
    .map(
      (item) => `
      <article class="notif-item ${item.tone}">
        <div>
          <strong>${escapeHtml(item.title)}</strong>
          <p>${escapeHtml(item.message)}</p>
        </div>
        <time>${escapeHtml(formatNotificationTime(item.timestamp))}</time>
      </article>
    `,
    )
    .join("");
}

async function handleAmenityRequest(amenityId) {
  clearMessage(amenityMessage);

  const user = auth.currentUser;
  if (!user) {
    setMessage(amenityMessage, "Please sign in first.");
    return;
  }

  const amenity = state.amenitiesById[amenityId];
  if (!amenity) {
    setMessage(amenityMessage, "Selected amenity is no longer available.");
    return;
  }

  const availability = String(
    amenity.availability || "available",
  ).toLowerCase();
  if (availability === "unavailable") {
    setMessage(amenityMessage, "This amenity is currently unavailable.");
    return;
  }

  const unitPrice = Number(amenity.price || 0);

  try {
    await createAmenityRequest({
      userId: user.uid,
      userEmail: user.email || "",
      guestName: user.displayName || user.email?.split("@")[0] || "Guest",
      amenityId,
      amenityName: amenity.name || "Amenity",
      amenityLocation: amenity.location || "",
      unitPrice,
      quantity: 1,
      totalAmount: unitPrice,
    });

    setMessage(
      amenityMessage,
      `${amenity.name || "Amenity"} request submitted successfully.`,
      "success",
    );
  } catch (error) {
    setMessage(
      amenityMessage,
      "Could not submit amenity request. Please try again.",
    );
    console.error(error);
  }
}

function attachRealtimeSubscriptions(user) {
  clearRealtimeSubscriptions();

  state.unsubs.push(
    subscribeActiveBookings((bookings) => {
      const byRoom = {};
      bookings.forEach((booking) => {
        if (!booking.roomId) {
          return;
        }

        if (!byRoom[booking.roomId]) {
          byRoom[booking.roomId] = [];
        }

        byRoom[booking.roomId].push(booking);
      });

      state.activeBookingsByRoom = byRoom;
    }),
  );

  state.unsubs.push(
    subscribeRooms((rooms) => {
      state.rooms = rooms;
      state.roomsById = Object.fromEntries(
        rooms.map((room) => [room.id, room]),
      );

      const availableRooms = rooms.filter(
        (room) =>
          String(room.status || "available").toLowerCase() === "available",
      );

      renderRooms(roomsList, availableRooms);
      renderRoomOptions(bookingRoomSelect, availableRooms);
      renderBookings(bookingsTableBody, state.bookings, state.roomsById);
    }),
  );

  state.unsubs.push(
    subscribeAmenities((amenities) => {
      state.amenitiesById = Object.fromEntries(
        amenities.map((amenity) => [amenity.id, amenity]),
      );
      renderAmenities(amenitiesList, amenities);
      renderNotifications();
    }),
  );

  state.unsubs.push(
    subscribeUserBookings(user.uid, (bookings) => {
      state.bookings = bookings;
      state.bookingsById = Object.fromEntries(
        bookings.map((booking) => [booking.id, booking]),
      );

      renderBookings(bookingsTableBody, bookings, state.roomsById);
      renderBookingOptions(paymentBookingSelect, bookings);
      renderNotifications();
    }),
  );

  state.unsubs.push(
    subscribeUserPayments(user.uid, (payments) => {
      state.payments = payments;
      renderPayments(paymentsTableBody, payments, state.bookingsById);
      renderNotifications();
    }),
  );

  state.unsubs.push(
    subscribeUserAmenityRequests(user.uid, (requests) => {
      state.amenityRequests = requests;
      renderNotifications();
    }),
  );
}

notificationToggleBtn.addEventListener("click", (event) => {
  event.stopPropagation();
  toggleNotificationPanel();
});

showLoginBtn.addEventListener("click", () => setAuthMode("login"));
showRegisterBtn.addEventListener("click", () => setAuthMode("register"));

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage(authMessage);

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  try {
    await loginUser({ email, password });
    loginForm.reset();
  } catch (error) {
    setMessage(authMessage, formatAuthError(error));
  }
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage(authMessage);

  const name = document.getElementById("registerName").value.trim();
  const email = document.getElementById("registerEmail").value.trim();
  const password = document.getElementById("registerPassword").value;
  const confirmPassword = document.getElementById(
    "registerConfirmPassword",
  ).value;

  if (password !== confirmPassword) {
    setMessage(authMessage, "Passwords do not match.");
    return;
  }

  try {
    await registerUser({ name, email, password });
    registerForm.reset();
  } catch (error) {
    setMessage(authMessage, formatAuthError(error));
  }
});

logoutBtn.addEventListener("click", async () => {
  await logoutUser();
});

navButtons.forEach((button) => {
  button.addEventListener("click", () => activatePanel(button.dataset.panel));
});

document.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  if (!target.closest(".notif-wrap")) {
    closeNotificationPanel();
  }

  const roomPickButton = target.closest("[data-room-pick]");
  if (roomPickButton instanceof HTMLElement) {
    const roomId = roomPickButton.getAttribute("data-room-pick");
    if (roomId) {
      activatePanel("discover");
      bookingRoomSelect.value = roomId;
      checkInDateInput.focus();
    }
    return;
  }

  const amenityRequestButton = target.closest("[data-amenity-request]");
  if (amenityRequestButton instanceof HTMLElement) {
    const amenityId = amenityRequestButton.getAttribute("data-amenity-request");
    if (amenityId) {
      await handleAmenityRequest(amenityId);
    }
    return;
  }
});

bookingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage(bookingMessage);

  const user = auth.currentUser;
  if (!user) {
    setMessage(bookingMessage, "Please sign in first.");
    return;
  }

  const roomId = bookingRoomSelect.value;
  const checkInDate = document.getElementById("checkInDate").value;
  const checkOutDate = document.getElementById("checkOutDate").value;
  const guestCount = Number(document.getElementById("guestCount").value);
  const notes = document.getElementById("bookingNotes").value.trim();

  const room = state.roomsById[roomId];
  if (!room) {
    setMessage(bookingMessage, "Please choose an available room.");
    return;
  }

  const start = new Date(checkInDate);
  const end = new Date(checkOutDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (
    !checkInDate ||
    !checkOutDate ||
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    start < today ||
    end <= start
  ) {
    setMessage(bookingMessage, "Check-out date must be after check-in date.");
    return;
  }

  if (hasBookingConflict(roomId, checkInDate, checkOutDate)) {
    setMessage(
      bookingMessage,
      "This room is already reserved for the selected date range.",
    );
    return;
  }

  if (guestCount > Number(room.capacity || 1)) {
    setMessage(
      bookingMessage,
      `This room supports up to ${room.capacity} guests.`,
    );
    return;
  }

  const msPerDay = 1000 * 60 * 60 * 24;
  const nights = Math.max(1, Math.ceil((end - start) / msPerDay));
  const totalAmount = Number(room.price || 0) * nights;

  try {
    await createBooking({
      userId: user.uid,
      userEmail: user.email,
      guestName: user.displayName || user.email?.split("@")[0] || "Guest",
      roomId,
      roomNumber: room.number || "",
      roomType: room.type || "",
      checkInDate,
      checkOutDate,
      guestCount,
      notes,
      totalAmount,
    });

    bookingForm.reset();
    setMessage(
      bookingMessage,
      `Booking created successfully. Estimated total: ${money(totalAmount)}.`,
      "success",
    );
  } catch (error) {
    setMessage(bookingMessage, "Could not create booking. Please try again.");
    console.error(error);
  }
});

paymentBookingSelect.addEventListener("change", () => {
  const booking = state.bookingsById[paymentBookingSelect.value];
  if (booking) {
    paymentAmountInput.value = Number(booking.totalAmount || 0).toFixed(2);
  }
});

paymentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage(paymentMessage);

  const user = auth.currentUser;
  if (!user) {
    setMessage(paymentMessage, "Please sign in first.");
    return;
  }

  const bookingId = paymentBookingSelect.value;
  const amount = Number(paymentAmountInput.value);
  const method = document.getElementById("paymentMethod").value;
  const booking = state.bookingsById[bookingId];

  if (!bookingId) {
    setMessage(paymentMessage, "Please select a booking.");
    return;
  }

  if (!booking) {
    setMessage(paymentMessage, "Booking no longer exists.");
    return;
  }

  if (String(booking.paymentStatus || "").toLowerCase() === "paid") {
    setMessage(paymentMessage, "This booking is already marked as paid.");
    return;
  }

  if (!amount || amount <= 0) {
    setMessage(paymentMessage, "Enter a valid payment amount.");
    return;
  }

  try {
    await createPayment({
      userId: user.uid,
      userEmail: user.email,
      guestName:
        user.displayName ||
        booking.guestName ||
        user.email?.split("@")[0] ||
        "Guest",
      bookingId,
      checkInDate: booking.checkInDate || "",
      checkOutDate: booking.checkOutDate || "",
      bookingLabel:
        booking.checkInDate && booking.checkOutDate
          ? `${booking.checkInDate} to ${booking.checkOutDate}`
          : "",
      amount,
      method,
    });

    paymentForm.reset();
    setMessage(
      paymentMessage,
      "Payment submitted. Awaiting admin confirmation.",
      "success",
    );
  } catch (error) {
    setMessage(paymentMessage, "Could not submit payment. Please try again.");
    console.error(error);
  }
});

observeAuth((user) => {
  if (!user) {
    clearRealtimeSubscriptions();
    state.rooms = [];
    state.roomsById = {};
    state.bookings = [];
    state.bookingsById = {};
    state.payments = [];
    state.amenityRequests = [];
    state.amenitiesById = {};
    state.notifications = [];
    state.activeBookingsByRoom = {};

    authView.classList.remove("hidden");
    appView.classList.add("hidden");

    userDisplayName.textContent = "Guest";
    userDisplayEmail.textContent = "";
    setAuthMode("login");
    activatePanel("discover");
    closeNotificationPanel();
    renderNotifications();
    return;
  }

  authView.classList.add("hidden");
  appView.classList.remove("hidden");

  userDisplayName.textContent = user.displayName || "Guest";
  userDisplayEmail.textContent = user.email || "";

  clearMessage(bookingMessage);
  clearMessage(amenityMessage);
  clearMessage(paymentMessage);
  closeNotificationPanel();
  activatePanel("discover");
  attachRealtimeSubscriptions(user);
});
