import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "firebase/auth";

// Your web app's Firebase configuration
export const firebaseConfig = {
  apiKey: "AIzaSyC36BJgmBVv1zz_XSGZqwKWbelvNVkY2Vc",
  authDomain: "crack-survey-manager-fs.firebaseapp.com",
  projectId: "crack-survey-manager-fs",
  storageBucket: "crack-survey-manager-fs.firebasestorage.app",
  messagingSenderId: "205913547197",
  appId: "1:205913547197:web:9bee59b75b993df738f2d4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
};

export default app;
