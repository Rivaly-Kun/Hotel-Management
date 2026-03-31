import {
  onValue,
  push,
  ref,
  remove,
  serverTimestamp,
  set,
  update,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";
import { db } from "../firebase/config.js";

function mapToList(raw) {
  return Object.entries(raw || {}).map(([id, value]) => ({ id, ...value }));
}

function subscribeRooms(callback) {
  return onValue(ref(db, "rooms"), (snapshot) => {
    const rooms = mapToList(snapshot.val()).sort((a, b) =>
      String(a.number || "").localeCompare(String(b.number || ""), undefined, {
        numeric: true,
      }),
    );
    callback(rooms);
  });
}

function subscribeAmenities(callback) {
  return onValue(ref(db, "amenities"), (snapshot) => {
    const amenities = mapToList(snapshot.val()).sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || "")),
    );
    callback(amenities);
  });
}

function subscribeUserBookings(userId, callback) {
  return onValue(ref(db, "bookings"), (snapshot) => {
    const bookings = mapToList(snapshot.val())
      .filter((booking) => booking.userId === userId)
      .sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0));

    callback(bookings);
  });
}

function subscribeUserPayments(userId, callback) {
  return onValue(ref(db, "payments"), (snapshot) => {
    const payments = mapToList(snapshot.val())
      .filter((payment) => payment.userId === userId)
      .sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0));

    callback(payments);
  });
}

function subscribeUserAmenityRequests(userId, callback) {
  return onValue(ref(db, "amenityRequests"), (snapshot) => {
    const requests = mapToList(snapshot.val())
      .filter((request) => request.userId === userId)
      .sort(
        (a, b) =>
          Number(b.updatedAtMs || b.createdAtMs || 0) -
          Number(a.updatedAtMs || a.createdAtMs || 0),
      );

    callback(requests);
  });
}

function subscribeActiveBookings(callback) {
  return onValue(
    ref(db, "bookings"),
    (snapshot) => {
      const bookings = mapToList(snapshot.val()).filter((booking) =>
        ["reserved", "accepted", "checked-in"].includes(
          String(booking.status || "").toLowerCase(),
        ),
      );

      callback(bookings);
    },
    () => {
      callback([]);
    },
  );
}

async function createBooking(payload) {
  const bookingRef = push(ref(db, "bookings"));
  await set(bookingRef, {
    ...payload,
    source: "user-portal",
    status: "reserved",
    paymentStatus: "unpaid",
    roomNumber: payload.roomNumber || "",
    roomType: payload.roomType || "",
    createdAt: serverTimestamp(),
    createdAtMs: Date.now(),
  });

  return bookingRef.key;
}

async function createPayment(payload) {
  const paymentRef = push(ref(db, "payments"));
  await set(paymentRef, {
    ...payload,
    source: "user-portal",
    status: "pending",
    createdAt: serverTimestamp(),
    createdAtMs: Date.now(),
  });

  if (payload.bookingId) {
    await update(ref(db, `bookings/${payload.bookingId}`), {
      paymentStatus: "pending",
    });
  }

  return paymentRef.key;
}

async function createAmenityRequest(payload) {
  const requestRef = push(ref(db, "amenityRequests"));
  await set(requestRef, {
    ...payload,
    source: "user-portal",
    status: "pending",
    createdAt: serverTimestamp(),
    createdAtMs: Date.now(),
  });

  return requestRef.key;
}

async function updateBooking(bookingId, payload) {
  await update(ref(db, `bookings/${bookingId}`), {
    ...payload,
    updatedAt: serverTimestamp(),
    updatedAtMs: Date.now(),
  });
}

async function updatePayment(paymentId, payload) {
  await update(ref(db, `payments/${paymentId}`), {
    ...payload,
    updatedAt: serverTimestamp(),
    updatedAtMs: Date.now(),
  });
}

async function deletePayment(paymentId) {
  await remove(ref(db, `payments/${paymentId}`));
}

export {
  subscribeRooms,
  subscribeAmenities,
  subscribeUserBookings,
  subscribeUserPayments,
  subscribeUserAmenityRequests,
  subscribeActiveBookings,
  createBooking,
  createPayment,
  createAmenityRequest,
  updateBooking,
  updatePayment,
  deletePayment,
};
