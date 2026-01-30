# GitHub Pages Troubleshooting Guide

## Your Repository
- **Name:** `helsinkimusken.github.io`
- **Expected URL:** `https://helsinkimusken.github.io`
- **Repository Status:** Public ✅

---

## Quick Diagnostics

### ✅ Files Present
- [x] index.html exists
- [x] styles.css exists
- [x] app.js exists
- [x] firebase-config-public.js exists
- [x] All files pushed to GitHub

### ⚠️ Common Issues

1. GitHub Pages not enabled
2. Wrong branch/folder configured
3. Site still building (takes 2-3 minutes)
4. Cache issues in browser

---

## Step-by-Step Fix

### Step 1: Enable GitHub Pages

1. Go to your repository: `https://github.com/helsinkimusken/helsinkimusken.github.io`

2. Click **Settings** (top right)

3. Scroll down to **Pages** (left sidebar)

4. Under **Source**, you should see:
   - **Branch:** Select `main` (or `master`)
   - **Folder:** Select `/ (root)`

5. Click **Save**

6. Wait 2-3 minutes for GitHub to build and deploy

7. Refresh the Settings → Pages section

8. You should see a green banner:
   ```
   ✅ Your site is live at https://helsinkimusken.github.io
   ```

---

### Step 2: Verify Deployment

After enabling GitHub Pages:

1. **Check Build Status**
   - Go to **Actions** tab in your repository
   - Look for "pages build and deployment" workflow
   - Should show ✅ green checkmark when complete
   - If ❌ red X, click to see error details

2. **Test the URL**
   - Open: `https://helsinkimusken.github.io`
   - Should load the Xteam login modal
   - If 404: Wait a few more minutes or check configuration

3. **Force Refresh Browser**
   - Windows: `Ctrl + Shift + R`
   - Mac: `Cmd + Shift + R`
   - Or use incognito/private mode

---

### Step 3: Common Issues & Solutions

#### Issue 1: "404 - Site Not Found"

**Causes:**
- GitHub Pages not enabled
- Wrong branch selected
- Site still building
- Repository name mismatch

**Solutions:**

1. **Check Repository Name:**
   - Username: `helsinkimusken`
   - Repository MUST be: `helsinkimusken.github.io`
   - ✅ Your repo name is correct!

2. **Verify Branch:**
   - Settings → Pages
   - Branch should be `main` (not `master`)
   - Check current branch:
     ```bash
     cd d:\Tools\Xteam
     git branch
     ```
   - Should show `* main`

3. **Wait for Build:**
   - Go to **Actions** tab
   - Wait for green checkmark
   - Builds take 1-3 minutes

4. **Check for Build Errors:**
   - Actions tab → Latest workflow
   - Click on failed job (if any)
   - Read error message

---

#### Issue 2: "Settings → Pages shows 'Upgrade to activate GitHub Pages'"

**Cause:** Free tier limitation (shouldn't happen for public repos)

**Solution:**
- Public repositories get GitHub Pages for free
- If you see this, your repo might be private
- Go to Settings → General → scroll to bottom
- Verify "Public" is selected

---

#### Issue 3: Page loads but shows blank/white screen

**Causes:**
- JavaScript errors
- Firebase configuration issues
- File paths incorrect

**Solutions:**

1. **Check Browser Console:**
   - Press `F12` to open DevTools
   - Click **Console** tab
   - Look for red error messages
   - Common errors:
     - "firebase-config-public.js not found"
     - "Firebase is not defined"
     - "auth.js not found"

2. **Verify File Paths:**
   - All script tags in index.html should use relative paths
   - ✅ Already configured correctly in your index.html

3. **Check Network Tab:**
   - F12 → Network tab
   - Reload page
   - Look for failed requests (red)
   - Check which files failed to load

---

#### Issue 4: "Mixed Content" errors (HTTP/HTTPS)

**Cause:** Loading HTTP resources on HTTPS page

**Solution:**
- GitHub Pages uses HTTPS automatically
- All script URLs in index.html use HTTPS ✅
- No action needed

---

### Step 4: Force GitHub Pages Rebuild

If site won't update:

1. **Make a Small Change:**
   ```bash
   cd d:\Tools\Xteam
   echo "<!-- Updated -->" >> index.html
   git add index.html
   git commit -m "Force GitHub Pages rebuild"
   git push origin main
   ```

2. **Wait 2-3 minutes**

3. **Check Actions tab** for build completion

4. **Test site** with force refresh (`Ctrl + Shift + R`)

---

### Step 5: Verify GitHub Pages Settings

Go to Settings → Pages and verify:

```
Source
├── Branch: main
└── Folder: / (root)

Custom domain
└── (leave empty)

Enforce HTTPS
└── ✅ Checked (automatic)
```

**Screenshot Location:**
```
https://github.com/helsinkimusken/helsinkimusken.github.io/settings/pages
```

---

## Testing Checklist

After enabling GitHub Pages:

- [ ] Repository is public
- [ ] GitHub Pages is enabled (Settings → Pages)
- [ ] Branch is set to `main`
- [ ] Folder is set to `/` (root)
- [ ] Actions tab shows successful deployment
- [ ] URL `https://helsinkimusken.github.io` loads
- [ ] Login modal appears
- [ ] No console errors (F12)
- [ ] Firebase configuration loads
- [ ] Authentication works

---

## Expected Results

### ✅ When Working Correctly:

1. **Visit:** `https://helsinkimusken.github.io`
2. **See:** Login modal with two tabs (Email Login | WeChat QR Code)
3. **Console (F12):** Should show:
   ```
   ✓ Authentication Manager loaded
   ✓ Firebase initialized successfully
   ✓ Application initialization complete
   ```
4. **Can:** Log in with authorized email
5. **Can:** Submit and view records

### ❌ Common Error States:

**404 Not Found:**
- GitHub Pages not enabled
- Wrong branch/folder
- Site still building

**Blank Page:**
- JavaScript error (check console)
- File loading failed (check Network tab)

**"firebase is not defined":**
- Firebase SDK not loading
- Check internet connection
- Check CDN availability

---

## Alternative: Check GitHub Pages Status

### Method 1: GitHub API

```bash
curl -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/helsinkimusken/helsinkimusken.github.io/pages
```

Should return:
```json
{
  "url": "https://helsinkimusken.github.io/",
  "status": "built",
  "html_url": "https://helsinkimusken.github.io"
}
```

### Method 2: GitHub Actions

1. Go to: `https://github.com/helsinkimusken/helsinkimusken.github.io/actions`
2. Look for "pages build and deployment"
3. Check latest run status
4. Green ✅ = deployed successfully
5. Red ❌ = build failed (click for details)

---

## Still Not Working?

### Debug Information to Collect:

1. **GitHub Pages Settings:**
   - Screenshot of Settings → Pages
   - Current branch and folder configuration

2. **Actions Status:**
   - Screenshot of Actions tab
   - Latest workflow run status

3. **Browser Console:**
   - Press F12
   - Screenshot of Console tab errors

4. **Network Tab:**
   - Press F12 → Network
   - Reload page
   - Screenshot of failed requests

### Commands to Run:

```bash
# Check current branch
cd d:\Tools\Xteam
git branch

# Check remote configuration
git remote -v

# Check last commit
git log -1 --oneline

# Verify files exist
ls -la index.html app.js styles.css firebase-config-public.js

# Check git status
git status
```

---

## Contact GitHub Support

If still having issues:

1. Go to: `https://support.github.com/`
2. Select "GitHub Pages"
3. Provide:
   - Repository URL
   - Expected site URL
   - Error messages
   - Screenshots

---

## Summary

**Most Common Issue:** GitHub Pages not enabled in Settings

**Quick Fix:**
1. Go to Settings → Pages
2. Set Source to `main` branch, `/` root folder
3. Click Save
4. Wait 2-3 minutes
5. Visit `https://helsinkimusken.github.io`

**If that doesn't work:**
- Check Actions tab for build errors
- Force refresh browser (`Ctrl + Shift + R`)
- Try incognito/private mode
- Check browser console for JavaScript errors

---

**Your repository name is correct for GitHub Pages!**
**Repository:** helsinkimusken.github.io ✅
**Expected URL:** https://helsinkimusken.github.io ✅

Just need to enable GitHub Pages in Settings!

---

**Last Updated:** 2025-01-30
