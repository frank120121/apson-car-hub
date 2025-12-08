// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
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
const analytics = getAnalytics(app);