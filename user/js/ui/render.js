import { getRoomImageUrl } from "../services/dataService.js";

const money = (value) => `$${Number(value || 0).toFixed(2)}`;

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const roomImageCache = {};

async function loadRoomImage(roomId) {
  if (roomImageCache[roomId] !== undefined) {
    return roomImageCache[roomId];
  }

  const url = await getRoomImageUrl(roomId);
  roomImageCache[roomId] = url;
  return url;
}

function renderRooms(container, rooms) {
  if (!rooms.length) {
    container.innerHTML =
      '<div class="empty-state">No rooms are currently available.</div>';
    return;
  }

  container.innerHTML = rooms
    .map(
      (room) => `
      <article class="room-card">
        <div class="room-img-wrap" data-room-img="${room.id}">
          <div class="room-img-placeholder">
            <span class="room-img-icon">🏨</span>
          </div>
        </div>
        <div class="room-card-body">
          <h4>Room ${escapeHtml(room.number)}</h4>
          <p>${escapeHtml(room.type)} | Capacity ${escapeHtml(room.capacity)}</p>
          <p><strong>${money(room.price)}</strong> / night</p>
          <span class="room-status">${escapeHtml(room.status || "available")}</span>
          <div class="card-actions">
            <button class="card-action" data-room-pick="${room.id}">Book This Room</button>
          </div>
        </div>
      </article>
    `,
    )
    .join("");

  // Load images asynchronously
  rooms.forEach(async (room) => {
    const url = await loadRoomImage(room.id);
    const wrap = container.querySelector(`[data-room-img="${room.id}"]`);
    if (wrap && url) {
      wrap.innerHTML = `<img class="room-img" src="${url}" alt="Room ${escapeHtml(room.number)}" loading="lazy" />`;
    }
  });
}

function renderRoomOptions(select, rooms) {
  const previous = select.value;

  select.innerHTML =
    '<option value="">Select Room</option>' +
    rooms
      .map(
        (room) =>
          `<option value="${room.id}">Room ${escapeHtml(room.number)} - ${escapeHtml(room.type)} (${money(room.price)})</option>`,
      )
      .join("");

  if (previous && rooms.some((room) => room.id === previous)) {
    select.value = previous;
  }
}

function renderBookings(tbody, bookings, roomsById) {
  if (!bookings.length) {
    tbody.innerHTML =
      '<tr><td colspan="7" class="empty-state">No bookings yet. Start by reserving a room.</td></tr>';
    return;
  }

  tbody.innerHTML = bookings
    .map((booking) => {
      const room = roomsById[booking.roomId];
      const roomLabel = room
        ? `Room ${room.number} (${room.type})`
        : booking.roomNumber
          ? `Room ${booking.roomNumber} (${booking.roomType || "Standard"})`
          : "Room not available";

      return `
        <tr>
          <td>${escapeHtml(roomLabel)}</td>
          <td>${escapeHtml(booking.checkInDate)} to ${escapeHtml(booking.checkOutDate)}</td>
          <td>${escapeHtml(booking.guestCount)}</td>
          <td>${escapeHtml(booking.guestName || "-")}</td>
          <td>${money(booking.totalAmount)}</td>
          <td>${escapeHtml(booking.status || "reserved")}</td>
          <td>${escapeHtml(booking.paymentStatus || "unpaid")}</td>
        </tr>
      `;
    })
    .join("");
}

function renderBookingOptions(select, bookings) {
  const previous = select.value;

  select.innerHTML =
    '<option value="">Select Booking</option>' +
    bookings
      .map(
        (booking) =>
          `<option value="${booking.id}">${escapeHtml(booking.checkInDate)} to ${escapeHtml(booking.checkOutDate)} (${money(booking.totalAmount)}) - ${escapeHtml(booking.paymentStatus || "unpaid")}</option>`,
      )
      .join("");

  if (previous && bookings.some((booking) => booking.id === previous)) {
    select.value = previous;
  }
}

function renderPayments(tbody, payments, bookingsById) {
  if (!payments.length) {
    tbody.innerHTML =
      '<tr><td colspan="5" class="empty-state">No payments submitted yet.</td></tr>';
    return;
  }

  tbody.innerHTML = payments
    .map((payment) => {
      const booking = bookingsById[payment.bookingId];
      const bookingLabel = booking
        ? `${booking.checkInDate} to ${booking.checkOutDate}`
        : payment.bookingLabel ||
          (payment.checkInDate && payment.checkOutDate
            ? `${payment.checkInDate} to ${payment.checkOutDate}`
            : "Unknown booking");

      const date = payment.createdAtMs
        ? new Date(payment.createdAtMs).toLocaleString()
        : "-";

      return `
        <tr>
          <td>${escapeHtml(bookingLabel)}</td>
          <td>${money(payment.amount)}</td>
          <td>${escapeHtml(payment.method)}</td>
          <td>${escapeHtml(payment.status || "pending")}</td>
          <td>${escapeHtml(date)}</td>
        </tr>
      `;
    })
    .join("");
}

export {
  money,
  renderRooms,
  renderRoomOptions,
  renderBookings,
  renderBookingOptions,
  renderPayments,
};
