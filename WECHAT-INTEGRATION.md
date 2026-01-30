# WeChat QR Code Login Integration Guide

This document explains how the WeChat QR code login feature works and how to complete the integration.

---

## Overview

The Xteam application now includes a **WeChat QR Code Login** feature that allows users to authenticate by scanning a QR code with their WeChat app instead of entering email/password credentials.

**Current Status:** ✅ Frontend UI implemented, ⚠️ Backend integration required

---

## User Experience Flow

### For End Users:

1. User opens Xteam application
2. Login modal appears with two tabs:
   - **Email Login** (traditional email/password)
   - **WeChat QR Code** (scan to login)

3. User clicks **WeChat QR Code** tab
4. QR code is generated and displayed
5. User opens WeChat app on their phone
6. User scans the QR code
7. WeChat app shows authorization request
8. User approves in WeChat
9. Xteam automatically logs the user in
10. Main application appears

**Benefits:**
- ✅ No password to remember
- ✅ Faster login (just scan)
- ✅ Familiar for Chinese users
- ✅ More secure (phone-based authentication)

---

## Current Implementation

### Frontend (Completed ✅)

The following features are already implemented:

1. **Login UI with Tabs**
   - Email/Password tab
   - WeChat QR Code tab
   - Smooth tab switching

2. **QR Code Display**
   - QR code container
   - Timer countdown (3 minutes)
   - Auto-refresh when expired
   - Refresh button

3. **QR Code Generation**
   - Uses QRCode.js library
   - Generates unique session IDs
   - Encodes authentication data

4. **Polling Mechanism**
   - Checks login status every 3 seconds
   - Auto-completes login when user scans
   - Handles timeout and errors

**Files:**
- [index.html](./index.html) - Login modal UI (lines 12-62)
- [auth.js](./auth.js) - QR code generation logic (lines 195-334)
- [styles.css](./styles.css) - QR code styling (lines 698-718)
- [firebase-config.js](./firebase-config.js) - WeChat configuration (lines 23-29)

---

## Backend Integration Required

To complete the WeChat integration, you need to implement a **backend service** that:

### 1. WeChat Mini Program / Official Account

You need **one** of the following:

**Option A: WeChat Mini Program**
- Create a WeChat Mini Program
- Get App ID and App Secret
- Implement scan-to-login functionality

**Option B: WeChat Official Account**
- Register a WeChat Official Account
- Enable web authorization
- Get App ID and App Secret

**How to Register:**
1. Go to [WeChat Open Platform](https://open.weixin.qq.com/)
2. Create an account (requires Chinese phone number or business verification)
3. Register a Mini Program or Official Account
4. Get your credentials

### 2. Backend Server (Node.js Example)

Create a backend API to handle WeChat authentication:

```javascript
// Example: Node.js + Express backend
const express = require('express');
const axios = require('axios');
const admin = require('firebase-admin');

const app = express();

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert('./serviceAccountKey.json')
});

// Endpoint: Generate QR Code Session
app.post('/api/wechat-qr-session', async (req, res) => {
  const sessionId = generateSessionId();

  // Store session in database (Redis, Firebase, etc.)
  await storeSession(sessionId, {
    created: Date.now(),
    status: 'pending',
    expiresAt: Date.now() + 180000 // 3 minutes
  });

  // Return session ID to frontend
  res.json({ sessionId });
});

// Endpoint: WeChat Callback (after user scans QR code)
app.get('/api/wechat-callback', async (req, res) => {
  const { code, state } = req.query; // WeChat auth code and state
  const sessionId = state; // Session ID passed in QR code

  try {
    // Exchange code for WeChat user info
    const wechatData = await getWeChatUserInfo(code);

    // Verify user is authorized (check email/openid)
    const isAuthorized = await checkAuthorization(wechatData.openid);

    if (!isAuthorized) {
      await updateSession(sessionId, { status: 'denied' });
      return res.status(403).send('Not authorized');
    }

    // Create Firebase custom token
    const firebaseToken = await admin.auth().createCustomToken(
      wechatData.openid,
      {
        email: wechatData.email, // If available
        provider: 'wechat'
      }
    );

    // Update session with token
    await updateSession(sessionId, {
      status: 'authenticated',
      firebaseToken: firebaseToken
    });

    res.send('Authentication successful! You can close this window.');

  } catch (error) {
    console.error('WeChat callback error:', error);
    await updateSession(sessionId, { status: 'error' });
    res.status(500).send('Authentication failed');
  }
});

// Endpoint: Check Login Status (polled by frontend)
app.get('/api/wechat-login-check/:sessionId', async (req, res) => {
  const { sessionId } = req.params;

  const session = await getSession(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  if (session.expiresAt < Date.now()) {
    return res.json({ status: 'expired' });
  }

  if (session.status === 'authenticated') {
    return res.json({
      status: 'authenticated',
      firebaseToken: session.firebaseToken
    });
  }

  res.json({ status: session.status });
});

// Helper: Get WeChat User Info
async function getWeChatUserInfo(code) {
  const WECHAT_APP_ID = 'YOUR_WECHAT_APP_ID';
  const WECHAT_APP_SECRET = 'YOUR_WECHAT_APP_SECRET';

  // Get access token
  const tokenResponse = await axios.get(
    `https://api.weixin.qq.com/sns/oauth2/access_token`,
    {
      params: {
        appid: WECHAT_APP_ID,
        secret: WECHAT_APP_SECRET,
        code: code,
        grant_type: 'authorization_code'
      }
    }
  );

  const { access_token, openid } = tokenResponse.data;

  // Get user info
  const userResponse = await axios.get(
    `https://api.weixin.qq.com/sns/userinfo`,
    {
      params: {
        access_token: access_token,
        openid: openid,
        lang: 'en'
      }
    }
  );

  return userResponse.data;
}

app.listen(3000, () => {
  console.log('WeChat auth backend running on port 3000');
});
```

### 3. Update Frontend to Use Backend

Update [auth.js](./auth.js) `startWeChatLoginCheck()` method:

```javascript
startWeChatLoginCheck(sessionId) {
  if (this.wechatLoginCheckInterval) {
    clearInterval(this.wechatLoginCheckInterval);
  }

  const checkInterval = wechatConfig.refreshInterval || 3000;

  this.wechatLoginCheckInterval = setInterval(async () => {
    try {
      // Call your backend API
      const response = await fetch(`https://your-backend.com/api/wechat-login-check/${sessionId}`);
      const data = await response.json();

      if (data.status === 'authenticated') {
        // User scanned and approved - sign them in
        await this.auth.signInWithCustomToken(data.firebaseToken);
        clearInterval(this.wechatLoginCheckInterval);

      } else if (data.status === 'expired') {
        clearInterval(this.wechatLoginCheckInterval);
        this.showError('wechatLoginError', 'QR code expired. Please refresh.');

      } else if (data.status === 'error' || data.status === 'denied') {
        clearInterval(this.wechatLoginCheckInterval);
        this.showError('wechatLoginError', 'Authentication failed or access denied.');
      }

    } catch (error) {
      console.error('WeChat login check error:', error);
    }
  }, checkInterval);
}
```

---

## Configuration

### Step 1: Get WeChat Credentials

After registering your WeChat app, you'll receive:
- **App ID** (appid)
- **App Secret** (secret)

### Step 2: Update firebase-config.js

```javascript
const wechatConfig = {
  enabled: true,                      // Set to true to enable
  appId: "wx1234567890abcdef",        // Your WeChat App ID
  loginTimeout: 180000,               // 3 minutes
  refreshInterval: 3000               // Check every 3 seconds
};
```

### Step 3: Update Firebase Security Rules

Allow authentication via WeChat custom tokens:

```json
{
  "rules": {
    ".read": "auth != null && (
      auth.token.email == 'user@company.com' ||
      auth.token.provider == 'wechat'
    )",
    ".write": "auth != null"
  }
}
```

### Step 4: Deploy Backend

Deploy your backend server to:
- **Vercel** (Node.js)
- **Heroku** (Node.js)
- **Google Cloud Functions** (Serverless)
- **AWS Lambda** (Serverless)
- **Your own server**

---

## Simplified Alternative: QR Code for Contact Info

If full WeChat OAuth is too complex, you can use a **simpler approach**:

### Option: QR Code for Admin Contact

Display a QR code that, when scanned, opens a WeChat conversation with the admin:

```javascript
// In auth.js, modify generateWeChatQRCode():
const adminWeChatID = "your-wechat-id";
const qrData = `weixin://dl/chat?${adminWeChatID}`;

// Generate QR code with this data
new QRCode(qrCodeContainer, {
  text: qrData,
  width: 200,
  height: 200
});
```

**User Flow:**
1. User clicks WeChat tab
2. Sees QR code with message: "Scan to contact admin for access"
3. User scans and chats with admin
4. Admin manually creates account and shares credentials

**Pros:**
- ✅ No backend required
- ✅ Simple to implement
- ✅ Works immediately

**Cons:**
- ❌ Not automated
- ❌ Admin must manually approve
- ❌ Slower for users

---

## Testing WeChat Integration

### Test Checklist:

- [ ] WeChat app registered and App ID obtained
- [ ] Backend server deployed and accessible
- [ ] `wechatConfig.enabled` set to `true`
- [ ] `wechatConfig.appId` configured
- [ ] Frontend can generate QR codes
- [ ] QR code contains correct callback URL
- [ ] Backend receives WeChat callbacks
- [ ] Backend creates Firebase custom tokens
- [ ] Frontend polling detects authentication
- [ ] User successfully logs in via WeChat
- [ ] Session expires after 3 minutes
- [ ] Refresh button works correctly

---

## Security Considerations

### 1. Secure Backend Communication

- Use HTTPS for all backend APIs
- Validate session IDs server-side
- Implement rate limiting (prevent QR code spam)
- Set short session expiration (3 minutes)

### 2. WeChat App Security

- Keep App Secret secure (server-side only)
- Don't expose App Secret in frontend code
- Use environment variables for credentials
- Rotate secrets periodically

### 3. Authorization

- Verify WeChat OpenID against authorized list
- Don't trust client-side authorization
- Enforce Firebase Security Rules
- Log all authentication attempts

---

## Cost Considerations

### WeChat Costs:

- WeChat Mini Program: **Free** (requires verification)
- WeChat Official Account: **Free** (basic features)
- Business Verification: **~300 CNY/year** (required for some features)

### Backend Hosting Costs:

- **Vercel Free Tier:** Suitable for low traffic
- **Google Cloud Functions:** Free tier includes 2M invocations/month
- **AWS Lambda:** Free tier includes 1M requests/month
- **Heroku Free Tier:** Discontinued, use Vercel or Render instead

**Recommendation:** Start with Google Cloud Functions or Vercel for cost-effective serverless deployment.

---

## Troubleshooting

### Issue: QR code not displaying

**Solution:**
- Check `wechatConfig.enabled` is `true`
- Verify QRCode.js library is loaded
- Check browser console for errors
- Ensure `wechatConfig.appId` is set

### Issue: User scans QR code but nothing happens

**Solution:**
- Check backend is running and accessible
- Verify WeChat callback URL is correct
- Check backend logs for errors
- Ensure session ID is properly passed

### Issue: "Authentication failed" after scanning

**Solution:**
- User's WeChat account may not be authorized
- Check backend authorization logic
- Verify Firebase custom token creation
- Check Firebase Security Rules allow WeChat auth

---

## Next Steps

To enable WeChat login:

1. ✅ **Frontend Ready** - No action needed
2. ⚠️ **Register WeChat App** - Complete registration
3. ⚠️ **Deploy Backend** - Implement and deploy backend API
4. ⚠️ **Update Config** - Add App ID to `wechatConfig`
5. ⚠️ **Test Flow** - End-to-end testing
6. ⚠️ **Security Review** - Verify all security measures

---

## Alternative: Email Login Only

If WeChat integration is too complex for your current needs:

1. Set `wechatConfig.enabled = false` in `firebase-config.js`
2. Users will only see Email Login tab
3. WeChat QR Code tab will be hidden
4. All authentication via email/password

**You can enable WeChat later when ready!**

---

## Resources

- [WeChat Open Platform](https://open.weixin.qq.com/)
- [WeChat OAuth Documentation](https://developers.weixin.qq.com/doc/offiaccount/en/OA_Web_Apps/Wechat_webpage_authorization.html)
- [Firebase Custom Tokens](https://firebase.google.com/docs/auth/admin/create-custom-tokens)
- [QRCode.js Documentation](https://github.com/davidshimjs/qrcodejs)

---

**Last Updated:** 2025-01-30
**Version:** 1.0
**Status:** Frontend Complete, Backend Required
