// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDzpCMjgtVe3kYt-nMk1TCWty4Qz4qeUTY",
  authDomain: "redroomweb-3a99e.firebaseapp.com",
  projectId: "redroomweb-3a99e",
  storageBucket: "redroomweb-3a99e.firebasestorage.app",
  messagingSenderId: "607974325151",
  appId: "1:607974325151:web:840486d3ebe492e1739baa",
  measurementId: "G-X615BSS0F0"
};

// Initialize Firebase using compat libraries
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
