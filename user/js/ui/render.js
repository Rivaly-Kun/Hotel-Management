const money = (value) => `$${Number(value || 0).toFixed(2)}`;

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

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
        <h4>Room ${escapeHtml(room.number)}</h4>
        <p>${escapeHtml(room.type)} | Capacity ${escapeHtml(room.capacity)}</p>
        <p><strong>${money(room.price)}</strong> / night</p>
        <span class="room-status">${escapeHtml(room.status || "available")}</span>
        <div class="card-actions">
          <button class="card-action" data-room-pick="${room.id}">Book This Room</button>
        </div>
      </article>
    `,
    )
    .join("");
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
      '<tr><td colspan="6" class="empty-state">No bookings yet. Start by reserving a room.</td></tr>';
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
          <td>${money(booking.totalAmount)}</td>
          <td>${escapeHtml(booking.status || "reserved")}</td>
          <td>${escapeHtml(booking.paymentStatus || "unpaid")}</td>
        </tr>
      `;
    })
    .join("");
}

function renderAmenities(container, amenities) {
  if (!amenities.length) {
    container.innerHTML =
      '<div class="empty-state">No amenities are listed right now.</div>';
    return;
  }

  container.innerHTML = amenities
    .map((amenity) => {
      const availability = String(
        amenity.availability || "available",
      ).toLowerCase();
      const canRequest = availability !== "unavailable";
      const actionMarkup = canRequest
        ? `<button class="card-action request" data-amenity-request="${amenity.id}">Request Amenity</button>`
        : '<button class="card-action disabled" type="button" disabled>Unavailable</button>';

      return `
      <article class="amenity-card">
        <h4>${escapeHtml(amenity.name)}</h4>
        <p>${escapeHtml(amenity.location)}</p>
        <span class="amenity-price">${money(amenity.price)}</span>
        <p>Status: ${escapeHtml(amenity.availability || "available")}</p>
        <div class="card-actions">
          ${actionMarkup}
        </div>
      </article>
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
  renderAmenities,
  renderBookingOptions,
  renderPayments,
};
