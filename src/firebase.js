// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA96gFqDzYYBX8xpXDHN_VK8GvDJMtVGU4",
  authDomain: "mayoor-cf2e5.firebaseapp.com",
  projectId: "mayoor-cf2e5",
  storageBucket: "mayoor-cf2e5.firebasestorage.app",
  messagingSenderId: "772343044877",
  appId: "1:772343044877:web:be4244a93203cb80be2e44",
  measurementId: "G-2KPRGCY5EC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Long polling is more reliable than the default streaming transport on
// networks that block Firestore's WebChannel connection.
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  useFetchStreams: false,
});
export const googleProvider = new GoogleAuthProvider();