const __firebase_messaging_sw_START = performance.now();


// firebase-messaging-sw.js — Opravený Service Worker
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDLjV9havKCkXSQVLZx7Dx5IXfaBsQSmYE",
  authDomain: "mesenger-aplikace-vc-adm-jirik.firebaseapp.com",
  projectId: "mesenger-aplikace-vc-adm-jirik",
  storageBucket: "mesenger-aplikace-vc-adm-jirik.firebasestorage.app",
  messagingSenderId: "543388043871",
  appId: "1:543388043871:web:a3bddecf15a35f583ae9ea"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification?.title || "LCARS Messenger";
  const notificationOptions = {
    body: payload.notification?.body || "Nová zpráva na můstku!",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: "lcars-msg",
    vibrate: [200, 100, 200]
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});



// ⏱️ LOG END 
    console.log(`%c🚀 [firebase-messaging-sw] Načteno za ${(performance.now() - __firebase_messaging_sw_START).toFixed(2)} ms`, 'background: #000; color: #00ff00; font-weight: bold; padding: 2px;');
