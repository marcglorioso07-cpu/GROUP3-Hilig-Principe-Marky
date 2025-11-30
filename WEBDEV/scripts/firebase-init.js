// scripts/firebase-init.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-analytics.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithPopup,
  signOut,
  setPersistence,
  browserLocalPersistence,
  updateProfile,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBRnGwfn-_tHIe89pol8NpzO-nabDz0FhA",
  authDomain: "slsu-marketplace.firebaseapp.com",
  projectId: "slsu-marketplace",
  storageBucket: "slsu-marketplace.firebasestorage.app",
  messagingSenderId: "309862760350",
  appId: "1:309862760350:web:dbd81679ae570656aee08f",
  measurementId: "G-3QY3942GXT"
};

const app = initializeApp(firebaseConfig);
let analytics = null;
if (typeof window !== "undefined") {
  analytics = getAnalytics(app);
}

const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence);
const db = getFirestore(app);

window.firebaseNS = {
  // core
  app,
  analytics,
  auth,
  db,

  // auth helpers
  onAuthStateChanged,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  FacebookAuthProvider,
  signInWithPopup,
  signOut,
  setPersistence,
  browserLocalPersistence,
  updateProfile,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,

  // firestore helpers (used in marketplace.js)
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,

  firestore: {
    collection,
    doc,
    addDoc,
    setDoc,
    getDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    onSnapshot,
    query,
    where,
    orderBy,
    serverTimestamp
  }
};

window.getCurrentUserProfile = async function () {
  if (!auth || !db) return null;
  const user = auth.currentUser;
  if (!user) return null;

  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const data = snap.data();
    window.currentUserProfile = data;
    return data;
  }

  const profile = {
    uid: user.uid,
    email: user.email || "",
    displayName:
      user.displayName || (user.email ? user.email.split("@")[0] : "Student"),
    avatar: "",
    createdAt: serverTimestamp()
  };

  await setDoc(ref, profile);
  window.currentUserProfile = profile;
  return profile;
};
