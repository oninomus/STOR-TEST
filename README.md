# 📦 StockFlow - 100% Free Offline-First Inventory PWA

A lightweight, mobile-first Progressive Web App (PWA) built with **vanilla HTML, CSS, and JavaScript**. Designed to manage stock transactions seamlessly in low-connectivity or offline environments (e.g. warehouses, field operations, delivery trucks), and automatically sync with **Google Sheets** as a free cloud database via **Google Apps Script**.

---

## ✨ Features

- **100% Free & Serverless**: No database hosting fees, no monthly subscriptions. Powered by **Google Sheets** and **GitHub Pages**.
- **Offline-First Architecture**: 
  - Uses **Service Workers** to cache the entire app shell for offline loading.
  - Saves all transaction logs to **Local Storage** while offline.
  - Automatically detects connectivity restoration and triggers auto-sync to the Google Sheets API.
- **Mobile-Friendly UI**:
  - Touch-optimized inputs for **Product Name** and **Quantity** (with quick steppers and `+1`, `+5`, `+10`, `+50`, `+100` chips).
  - High-contrast toggle buttons for **Stock IN (NEW)** and **Stock OUT**.
- **Smart Conditional Logic**:
  - Selecting **Stock OUT** reveals delivery options: **PETRONAS**, **PICK-UP**, and **Courier**.
  - Selecting **Courier** automatically calculates handling fees:  
    $$\text{Total Fee} = \text{RM } 0.50 \times \text{Quantity}$$
- **Audit & Activity Log**:
  - Displays recent transactions locally on the device with real-time status badges (**✅ Synced** vs **⏳ Queued**).
  - Manual **Sync Now** button with real-time visual progress indicator.

---

## 🚀 Quick Setup Guide

### Part 1: Set Up the Free Google Sheets API Backend

1. Create a new sheet on [Google Sheets](https://sheets.new) (e.g., name it `Inventory System`).
2. In the top menu, click **Extensions** &rarr; **Apps Script**.
3. In the Apps Script editor, replace any existing code with the contents of [`google-apps-script/Code.gs`](./google-apps-script/Code.gs).
4. Click the **Save** floppy disk icon (or press `Ctrl+S` / `Cmd+S`).
5. In the top-right corner, click **Deploy** &rarr; **New deployment**.
6. Click the gear icon next to *Select type* and choose **Web app**.
7. Fill in the fields:
   - **Description**: `Inventory Web API`
   - **Execute as**: `Me (your email)`
   - **Who has access**: `Anyone` *(Crucial: This allows the PWA to send POST data without requiring Google login)*.
8. Click **Deploy**.
9. If prompted, click **Authorize Access** &rarr; select your Google account &rarr; click **Advanced** &rarr; click **Go to Untitled project (unsafe)** &rarr; click **Allow**.
10. Copy the generated **Web app URL** (it ends with `/exec`).

> **Tip**: If you ever update `Code.gs` later, go to **Deploy** &rarr; **Manage deployments** &rarr; edit &rarr; select **New version** &rarr; **Deploy** to publish updates.

---

### Part 2: Host the Frontend on GitHub Pages (100% Free & Permanent)

1. Create a new GitHub repository (e.g. `inventory-pwa`).
2. Push all the frontend files to the `main` branch:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `sw.js`
   - `manifest.json`
   - `favicon.svg`
   - `icon-192.png`
   - `icon-512.png`
3. On GitHub, go to your repository **Settings** &rarr; **Pages** (in the left sidebar).
4. Under **Build and deployment**:
   - Source: **Deploy from a branch**
   - Branch: **`main`** / Folder: **`/ (root)`**
5. Click **Save**.
6. After 1–2 minutes, your website is live at:  
   `https://<your-username>.github.io/<repo-name>/`

---

### Part 3: Connect the PWA to your Google Sheets

1. Open your live GitHub Pages URL on your mobile phone or desktop browser.
2. Click the ⚙️ **Settings** icon in the top header.
3. Paste the **Google Apps Script Web App URL** you copied in Part 1.
4. Tap **Test API Connection** to verify it connects.
5. Tap **Save Settings**.
6. You're all set! All entries will now save locally and sync directly to your Google Sheet.

---

## 📱 Installing the PWA on Devices

### Android (Chrome / Brave / Edge)
1. Open the GitHub Pages link in Chrome.
2. Tap the three dots menu (**⋮**) in the top right.
3. Tap **Install app** or **Add to Home screen**.
4. The app will install with its own standalone icon on your home screen and run in full-screen native mode without browser bars.

### iOS (iPhone / iPad - Safari)
1. Open the GitHub Pages link in **Safari**.
2. Tap the **Share** button (box with upward arrow) at the bottom.
3. Scroll down and tap **Add to Home Screen**.
4. Tap **Add**. The app will launch like an iOS native app.

### Desktop (Chrome / Edge)
1. Open the URL in Google Chrome or Microsoft Edge.
2. Click the **Install** icon in the right side of the address bar.
3. The app opens in its own window.

---

## 🧪 Testing Offline Mode

1. Open the app while connected to Wi-Fi to allow the **Service Worker** to cache the assets.
2. Turn on **Airplane Mode** or disconnect your Wi-Fi/data.
3. Refresh the page or reopen the app — it loads instantly!
4. Submit transactions:
   - **Stock IN (NEW)**: e.g. 50 units of "Oil Filter 32B".
   - **Stock OUT**: e.g. 10 units of "Brake Fluid", Destination: **Courier** (auto-calculates RM 5.00 fee).
5. Notice the **🟠 Pending** badge update in real-time.
6. Turn **Airplane Mode OFF**.
7. The app detects the connection and immediately synchronizes all pending transactions to your Google Sheet!

---

## 📊 Google Sheets Columns Created Automatically

When the first transaction is synced, the Google Apps Script automatically creates and formats the following table headers:

| Col | Header Name | Description |
|---|---|---|
| A | `Timestamp` | Local time the record was created |
| B | `Transaction ID` | Unique transaction ID (`TX-...`) |
| C | `Product Name` | Name of the inventory item |
| D | `Action Type` | `Stock IN (NEW)` or `Stock OUT` |
| E | `Quantity` | Number of items |
| F | `Destination / Method` | `PETRONAS`, `PICK-UP`, `Courier`, or `-` |
| G | `Courier Fee / Unit (RM)` | `RM 0.50` (if Courier) |
| H | `Total Courier Fee (RM)` | Auto-calculated `Qty × RM 0.50` |
| I | `Notes` | Offline sync indicator |
| J | `Server Received At` | Timestamp when received by Google Cloud |

---

## 🔒 Security & Privacy

- All data stays between **your device** and **your personal Google Drive account**.
- No third-party servers, tracking, or telemetry.
- Runs purely on your browser's local sandbox and Google's infrastructure.
