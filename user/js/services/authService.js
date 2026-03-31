import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  ref,
  set,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";
import { auth, db } from "../firebase/config.js";

async function registerUser({ name, email, password }) {
  const credential = await createUserWithEmailAndPassword(
    auth,
    email,
    password,
  );
  const { user } = credential;

  if (name) {
    await updateProfile(user, { displayName: name });
  }

  await set(ref(db, `users/${user.uid}`), {
    name,
    email: user.email,
    role: "user",
    createdAtMs: Date.now(),
  });

  return user;
}

async function loginUser({ email, password }) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

async function logoutUser() {
  await signOut(auth);
}

function observeAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export { auth, registerUser, loginUser, logoutUser, observeAuth };
