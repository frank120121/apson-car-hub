
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";


const firebaseConfig = {
  apiKey: "AIzaSyAdmuFZDU76WIFr1SAfJk-NqCA8GjLRPN0",
  authDomain: "apson-car-hub.firebaseapp.com",
  projectId: "apson-car-hub",
  storageBucket: "apson-car-hub.firebasestorage.app",
  messagingSenderId: "923005799000",
  appId: "1:923005799000:web:13f3e36b639c307af2182d",
  measurementId: "G-Z2Y67N76YW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };