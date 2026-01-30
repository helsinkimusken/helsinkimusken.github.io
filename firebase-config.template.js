// Firebase Configuration Template
// Copy this file to 'firebase-config.js' and fill in your actual Firebase project credentials
// NEVER commit firebase-config.js to version control!

const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.REGION.firebasedatabase.app",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID"
};

// Authorized Users Configuration
// Only these users can access the system
const authorizedUsers = [
  "user1@yourcompany.com",
  "user2@yourcompany.com",
  "user3@yourcompany.com"
  // Add more authorized email addresses here
];

// WeChat QR Code Configuration (Optional)
// Used for WeChat login integration
const wechatConfig = {
  enabled: false,  // Set to true to enable WeChat QR code login
  appId: "YOUR_WECHAT_APP_ID",  // Your WeChat Mini Program/Official Account App ID
  // QR code will be generated dynamically when user needs to login
};
