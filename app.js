/**
 * StockFlow - Offline-First Inventory Progressive Web App (PWA)
 * Vanilla JavaScript Implementation
 */

(() => {
  'use strict';

  // --- Storage Keys ---
  const STORAGE_KEYS = {
    API_URL: 'stockflow_api_url',
    QUEUE: 'stockflow_pending_queue',
    HISTORY: 'stockflow_history',
    PRODUCTS: 'stockflow_product_suggestions'
  };

  // --- State ---
  let isSyncing = false;
  let currentActionType = 'Stock IN (NEW)'; // 'Stock IN (NEW)' | 'Stock OUT'
  let currentDestination = 'PICK-UP';      // 'PETRONAS' | 'PICK-UP' | 'Courier'
  const COURIER_UNIT_FEE = 0.50;           // RM 0.50 per unit

  // --- DOM Elements ---
  const connectionStatusEl = document.getElementById('connectionStatus');
  const connectionTextEl = document.getElementById('connectionText');
  const apiConfigBannerEl = document.getElementById('apiConfigBanner');
  const bannerConfigBtn = document.getElementById('bannerConfigBtn');
  const openSettingsBtn = document.getElementById('openSettingsBtn');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const settingsModal = document.getElementById('settingsModal');
  const apiUrlInput = document.getElementById('apiUrlInput');
  const testApiBtn = document.getElementById('testApiBtn');
  const testApiBtnText = document.getElementById('testApiBtnText');
  const testApiFeedback = document.getElementById('testApiFeedback');
  const resetQueueBtn = document.getElementById('resetQueueBtn');

  // Form Elements
  const inventoryForm = document.getElementById('inventoryForm');
  const productNameInput = document.getElementById('productName');
  const clearProductBtn = document.getElementById('clearProductBtn');
  const productSuggestions = document.getElementById('productSuggestions');
  const quantityInput = document.getElementById('quantity');
  const qtyMinusBtn = document.getElementById('qtyMinusBtn');
  const qtyPlusBtn = document.getElementById('qtyPlusBtn');
  const quickQtyButtons = document.querySelectorAll('.quick-qty-chip');
  const labelStockIn = document.getElementById('labelStockIn');
  const labelStockOut = document.getElementById('labelStockOut');
  const actionRadios = document.querySelectorAll('input[name="actionType"]');
  const stockOutOptions = document.getElementById('stockOutOptions');
  const destinationCards = document.querySelectorAll('.destination-card');
  const destinationRadios = document.querySelectorAll('input[name="destination"]');
  const courierFeeBanner = document.getElementById('courierFeeBanner');
  const feeQtyCalc = document.getElementById('feeQtyCalc');
  const totalCourierFeeDisplay = document.getElementById('totalCourierFeeDisplay');
  const submitBtn = document.getElementById('submitBtn');
  const submitBtnText = document.getElementById('submitBtnText');

  // Sync & History Elements
  const syncBadge = document.getElementById('syncBadge');
  const syncStatusSummary = document.getElementById('syncStatusSummary');
  const manualSyncBtn = document.getElementById('manualSyncBtn');
  const syncIcon = document.getElementById('syncIcon');
  const historyList = document.getElementById('historyList');
  const historyEmpty = document.getElementById('historyEmpty');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  const toastContainer = document.getElementById('toastContainer');

  // --- Initializer ---
  function init() {
    registerServiceWorker();
    setupNetworkListeners();
    setupEventListeners();
    loadProductSuggestions();
    updateApiBannerState();
    renderQueueSummary();
    renderHistory();
    updateUiState();

    // Try auto-sync on startup if online
    if (navigator.onLine && getApiUrl()) {
      setTimeout(() => triggerSync(), 1000);
    }
  }

  // --- Service Worker Registration ---
  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then((reg) => {
            console.log('[StockFlow PWA] ServiceWorker registered with scope:', reg.scope);
          })
          .catch((err) => {
            console.warn('[StockFlow PWA] ServiceWorker registration failed:', err);
          });
      });
    }
  }

  // --- Network Connectivity Listeners ---
  function setupNetworkListeners() {
    const updateStatus = () => {
      const isOnline = navigator.onLine;
      if (isOnline) {
        connectionStatusEl.className = 'status-pill status-online';
        connectionTextEl.textContent = 'Online';
        showToast('Online mode restored. Auto-syncing pending items...', 'info');
        triggerSync();
      } else {
        connectionStatusEl.className = 'status-pill status-offline';
        connectionTextEl.textContent = 'Offline';
        showToast('You are currently offline. Data will save locally.', 'warning');
      }
    };

    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);

    // Initial check
    if (!navigator.onLine) {
      connectionStatusEl.className = 'status-pill status-offline';
      connectionTextEl.textContent = 'Offline';
    }

    // Auto-sync when user returns to app tab
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        triggerSync();
      }
    });

    // Periodic sync poll every 60 seconds
    setInterval(() => {
      if (navigator.onLine && getPendingQueue().length > 0) {
        triggerSync();
      }
    }, 60000);
  }

  // --- Event Listeners Setup ---
  function setupEventListeners() {
    // Action Type Toggle (Stock IN vs Stock OUT)
    actionRadios.forEach((radio) => {
      radio.addEventListener('change', (e) => {
        currentActionType = e.target.value;
        if (currentActionType === 'Stock IN (NEW)') {
          labelStockIn.classList.add('active');
          labelStockOut.classList.remove('active');
        } else {
          labelStockIn.classList.remove('active');
          labelStockOut.classList.add('active');
        }
        updateUiState();
      });
    });

    // Destination Radio Cards (Stock OUT options)
    destinationCards.forEach((card) => {
      card.addEventListener('click', () => {
        destinationCards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        const radio = card.querySelector('input[type="radio"]');
        if (radio) {
          radio.checked = true;
          currentDestination = radio.value;
        }
        updateUiState();
      });
    });

    // Product Input Clear Button
    productNameInput.addEventListener('input', () => {
      clearProductBtn.style.display = productNameInput.value.length > 0 ? 'block' : 'none';
    });

    clearProductBtn.addEventListener('click', () => {
      productNameInput.value = '';
      clearProductBtn.style.display = 'none';
      productNameInput.focus();
    });

    // Quantity Stepper Buttons
    qtyMinusBtn.addEventListener('click', () => {
      let qty = parseInt(quantityInput.value, 10) || 1;
      if (qty > 1) {
        quantityInput.value = qty - 1;
        updateUiState();
      }
    });

    qtyPlusBtn.addEventListener('click', () => {
      let qty = parseInt(quantityInput.value, 10) || 1;
      quantityInput.value = qty + 1;
      updateUiState();
    });

    quantityInput.addEventListener('input', () => {
      let qty = parseInt(quantityInput.value, 10);
      if (isNaN(qty) || qty < 1) {
        // Keep valid minimum
      }
      updateUiState();
    });

    // Quick Quantity Chips (+1, +5, +10, etc.)
    quickQtyButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const add = parseInt(btn.dataset.qty, 10) || 0;
        let qty = parseInt(quantityInput.value, 10) || 0;
        quantityInput.value = Math.max(1, qty + add);
        updateUiState();
      });
    });

    // Form Submission
    inventoryForm.addEventListener('submit', handleFormSubmit);

    // Manual Sync Button
    manualSyncBtn.addEventListener('click', () => {
      if (!navigator.onLine) {
        showToast('Cannot sync: Device is currently offline.', 'warning');
        return;
      }
      if (!getApiUrl()) {
        openSettings();
        showToast('Please set your Google Apps Script Web App URL first.', 'warning');
        return;
      }
      triggerSync(true);
    });

    // Settings Modal
    openSettingsBtn.addEventListener('click', openSettings);
    bannerConfigBtn.addEventListener('click', openSettings);
    closeSettingsBtn.addEventListener('click', closeSettings);
    cancelSettingsBtn.addEventListener('click', closeSettings);
    saveSettingsBtn.addEventListener('click', saveSettings);
    testApiBtn.addEventListener('click', handleTestApi);
    resetQueueBtn.addEventListener('click', handleResetQueue);

    // Close modal on click outside
    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) {
        closeSettings();
      }
    });

    // Clear History Button
    clearHistoryBtn.addEventListener('click', () => {
      if (confirm('Clear local activity log on this device? (Unsynced queue items will be preserved)')) {
        localStorage.removeItem(STORAGE_KEYS.HISTORY);
        renderHistory();
        showToast('Local activity log cleared.', 'info');
      }
    });
  }

  // --- Dynamic UI State Updating ---
  function updateUiState() {
    const qty = Math.max(1, parseInt(quantityInput.value, 10) || 1);

    if (currentActionType === 'Stock IN (NEW)') {
      // Stock IN mode
      stockOutOptions.classList.add('hidden');
      submitBtn.className = 'btn-submit btn-stock-in';
      submitBtnText.textContent = `Record Stock IN (${qty})`;
    } else {
      // Stock OUT mode
      stockOutOptions.classList.remove('hidden');
      submitBtn.className = 'btn-submit btn-stock-out';

      if (currentDestination === 'Courier') {
        courierFeeBanner.classList.remove('hidden');
        feeQtyCalc.textContent = qty;
        const totalFee = (qty * COURIER_UNIT_FEE).toFixed(2);
        totalCourierFeeDisplay.textContent = `RM ${totalFee}`;
        submitBtnText.textContent = `Record Stock OUT — Courier (RM ${totalFee})`;
      } else {
        courierFeeBanner.classList.add('hidden');
        submitBtnText.textContent = `Record Stock OUT — ${currentDestination} (${qty})`;
      }
    }
  }

  // --- Form Submission Handler ---
  function handleFormSubmit(e) {
    e.preventDefault();

    const productName = productNameInput.value.trim();
    const qty = parseInt(quantityInput.value, 10);

    if (!productName) {
      showToast('Please enter a product name.', 'warning');
      productNameInput.focus();
      return;
    }

    if (isNaN(qty) || qty <= 0) {
      showToast('Quantity must be at least 1.', 'warning');
      quantityInput.focus();
      return;
    }

    // Prepare item record
    const isStockOut = currentActionType === 'Stock OUT';
    const destination = isStockOut ? currentDestination : '-';
    const isCourier = isStockOut && currentDestination === 'Courier';
    const courierFeeUnit = isCourier ? COURIER_UNIT_FEE : 0;
    const totalCourierFee = isCourier ? +(qty * COURIER_UNIT_FEE).toFixed(2) : 0;

    const item = {
      id: generateTxId(),
      timestamp: formatDateTime(new Date()),
      productName: productName,
      actionType: currentActionType,
      quantity: qty,
      destination: destination,
      courierFeeUnit: courierFeeUnit,
      totalCourierFee: totalCourierFee,
      status: 'pending',
      syncedFromOffline: !navigator.onLine,
      createdAt: Date.now()
    };

    // Save to pending queue in localStorage
    addToQueue(item);

    // Save to recent activity history
    addToHistory(item);

    // Save product name to suggestions
    saveProductSuggestion(productName);

    // Reset form inputs
    productNameInput.value = '';
    clearProductBtn.style.display = 'none';
    quantityInput.value = '1';
    updateUiState();
    productNameInput.focus();

    // Render updated views
    renderQueueSummary();
    renderHistory();

    // Immediate sync attempt if online & API is configured
    if (navigator.onLine && getApiUrl()) {
      showToast(`Saved locally! Auto-syncing to Google Sheets...`, 'info');
      triggerSync();
    } else if (!navigator.onLine) {
      showToast(`Saved offline! Will sync automatically when connected.`, 'warning');
    } else {
      showToast(`Saved locally. Configure Google Sheets API in Settings to sync.`, 'info');
    }
  }

  // --- Storage Helper Functions ---
  function getApiUrl() {
    return (localStorage.getItem(STORAGE_KEYS.API_URL) || '').trim();
  }

  function setApiUrl(url) {
    localStorage.setItem(STORAGE_KEYS.API_URL, (url || '').trim());
    updateApiBannerState();
  }

  function getPendingQueue() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.QUEUE);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  function setPendingQueue(queue) {
    localStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify(queue));
    renderQueueSummary();
  }

  function addToQueue(item) {
    const queue = getPendingQueue();
    queue.push(item);
    setPendingQueue(queue);
  }

  function getHistory() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.HISTORY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  function setHistory(history) {
    // Keep last 50 entries
    const capped = history.slice(0, 50);
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(capped));
  }

  function addToHistory(item) {
    const history = getHistory();
    history.unshift(item);
    setHistory(history);
  }

  function markItemsSyncedInHistory(syncedIds) {
    const history = getHistory();
    const idSet = new Set(syncedIds);
    const updated = history.map((item) => {
      if (idSet.has(item.id)) {
        return { ...item, status: 'synced' };
      }
      return item;
    });
    setHistory(updated);
    renderHistory();
  }

  function loadProductSuggestions() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
      const suggestions = data ? JSON.parse(data) : [];
      productSuggestions.innerHTML = suggestions
        .map(name => `<option value="${escapeHtml(name)}"></option>`)
        .join('');
    } catch {
      // Ignore
    }
  }

  function saveProductSuggestion(name) {
    try {
      let suggestions = [];
      const data = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
      if (data) suggestions = JSON.parse(data);
      if (!suggestions.includes(name)) {
        suggestions.unshift(name);
        if (suggestions.length > 30) suggestions.pop();
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(suggestions));
        loadProductSuggestions();
      }
    } catch {
      // Ignore
    }
  }

  // --- Auto-Sync Engine ---
  async function triggerSync(isManual = false) {
    if (isSyncing) return;

    const queue = getPendingQueue();
    if (queue.length === 0) {
      if (isManual) {
        showToast('All items are already synced! ✨', 'success');
      }
      return;
    }

    const apiUrl = getApiUrl();
    if (!apiUrl) {
      if (isManual) {
        openSettings();
        showToast('Please set your Google Apps Script URL in Settings.', 'warning');
      }
      return;
    }

    if (!navigator.onLine) {
      if (isManual) {
        showToast('Cannot sync: No internet connection.', 'warning');
      }
      return;
    }

    isSyncing = true;
    syncIcon.classList.add('spinning');
    syncStatusSummary.textContent = `Syncing ${queue.length} item(s)...`;

    try {
      // Use text/plain payload to bypass CORS preflight OPTIONS which Google Apps Script does not support
      const payloadString = JSON.stringify({
        action: 'batch_sync',
        items: queue
      });

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: payloadString,
        redirect: 'follow'
      });

      let result = null;
      try {
        result = await response.json();
      } catch (parseErr) {
        // Fallback check if response succeeded via redirect
        if (response.ok) {
          result = { status: 'success', syncedCount: queue.length };
        }
      }

      if (result && result.status === 'success') {
        const syncedIds = queue.map(i => i.id);
        markItemsSyncedInHistory(syncedIds);
        setPendingQueue([]);
        showToast(`Successfully synced ${queue.length} item(s) to Google Sheets! ☁️`, 'success');
      } else {
        const errMsg = (result && result.message) ? result.message : 'Invalid response from Google Sheets';
        throw new Error(errMsg);
      }

    } catch (err) {
      console.error('[StockFlow Sync Error]', err);
      syncStatusSummary.textContent = `Sync failed. Retrying when online.`;
      if (isManual) {
        showToast(`Sync failed: ${err.message || 'Check network / API URL'}`, 'error');
      }
    } finally {
      isSyncing = false;
      syncIcon.classList.remove('spinning');
      renderQueueSummary();
    }
  }

  // --- Render Queue and History ---
  function renderQueueSummary() {
    const queue = getPendingQueue();
    const count = queue.length;

    if (count > 0) {
      syncBadge.textContent = `${count} pending`;
      syncBadge.className = 'sync-badge has-pending';
      syncStatusSummary.textContent = `${count} unsynced item(s) stored locally`;
    } else {
      syncBadge.textContent = '0 pending';
      syncBadge.className = 'sync-badge';
      syncStatusSummary.textContent = 'All entries synced to cloud';
    }
  }

  function renderHistory() {
    const history = getHistory();
    if (history.length === 0) {
      historyEmpty.style.display = 'block';
      historyList.innerHTML = '';
      historyList.appendChild(historyEmpty);
      return;
    }

    historyEmpty.style.display = 'none';
    const itemsHtml = history.map((item) => {
      const isStockIn = item.actionType === 'Stock IN (NEW)';
      const typeBadge = isStockIn
        ? '<span class="history-badge badge-in">Stock IN</span>'
        : '<span class="history-badge badge-out">Stock OUT</span>';

      const destBadge = (!isStockIn && item.destination && item.destination !== '-')
        ? `<span class="history-badge badge-dest">${escapeHtml(item.destination)}</span>`
        : '';

      const feeText = (item.totalCourierFee && item.totalCourierFee > 0)
        ? `<span class="history-badge badge-dest" style="color:#38bdf8;">Fee: RM ${Number(item.totalCourierFee).toFixed(2)}</span>`
        : '';

      const syncBadgeHtml = (item.status === 'synced')
        ? '<span class="history-sync-status sync-synced">✅ Synced</span>'
        : '<span class="history-sync-status sync-pending">⏳ Queued</span>';

      return `
        <div class="history-item">
          <div class="history-item-left">
            <span class="history-product-name">${escapeHtml(item.productName)}</span>
            <div class="history-meta">
              <span>${escapeHtml(item.timestamp)}</span>
              ${typeBadge}
              ${destBadge}
              ${feeText}
            </div>
          </div>
          <div class="history-item-right">
            <span class="history-qty ${isStockIn ? 'qty-in' : 'qty-out'}">
              ${isStockIn ? '+' : '-'}${item.quantity}
            </span>
            ${syncBadgeHtml}
          </div>
        </div>
      `;
    }).join('');

    historyList.innerHTML = itemsHtml;
  }

  function updateApiBannerState() {
    const url = getApiUrl();
    if (!url) {
      apiConfigBannerEl.classList.remove('hidden');
    } else {
      apiConfigBannerEl.classList.add('hidden');
    }
  }

  // --- Settings & API Management ---
  function openSettings() {
    apiUrlInput.value = getApiUrl();
    testApiFeedback.className = 'test-feedback hidden';
    testApiFeedback.textContent = '';
    settingsModal.classList.remove('hidden');
  }

  function closeSettings() {
    settingsModal.classList.add('hidden');
  }

  function saveSettings() {
    const url = apiUrlInput.value.trim();
    setApiUrl(url);
    closeSettings();
    showToast('Settings saved successfully.', 'success');

    if (url && navigator.onLine && getPendingQueue().length > 0) {
      triggerSync();
    }
  }

  async function handleTestApi() {
    const url = apiUrlInput.value.trim();
    if (!url) {
      testApiFeedback.className = 'test-feedback error';
      testApiFeedback.textContent = 'Please enter a URL first.';
      testApiFeedback.classList.remove('hidden');
      return;
    }

    testApiBtn.disabled = true;
    testApiBtnText.textContent = 'Testing connection...';
    testApiFeedback.className = 'test-feedback hidden';

    try {
      const response = await fetch(url, { method: 'GET', redirect: 'follow' });
      const data = await response.json();

      if (data && data.status === 'success') {
        testApiFeedback.className = 'test-feedback success';
        testApiFeedback.textContent = '✅ Success! Connected to Google Apps Script.';
      } else {
        testApiFeedback.className = 'test-feedback error';
        testApiFeedback.textContent = '⚠️ Connected, but unexpected response received.';
      }
    } catch (err) {
      testApiFeedback.className = 'test-feedback error';
      testApiFeedback.textContent = '❌ Failed to connect: Check Web App deployment & "Anyone" access.';
    } finally {
      testApiBtn.disabled = false;
      testApiBtnText.textContent = 'Test API Connection';
      testApiFeedback.classList.remove('hidden');
    }
  }

  function handleResetQueue() {
    const count = getPendingQueue().length;
    if (confirm(`Are you sure you want to delete ${count} pending item(s) from the offline queue? This cannot be undone.`)) {
      setPendingQueue([]);
      showToast('Offline sync queue was cleared.', 'info');
    }
  }

  // --- Toasts Notification System ---
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3500);
  }

  // --- Helper Utilities ---
  function generateTxId() {
    return 'TX-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
  }

  function formatDateTime(date) {
    const pad = n => (n < 10 ? '0' + n : n);
    const yyyy = date.getFullYear();
    const mm = pad(date.getMonth() + 1);
    const dd = pad(date.getDate());
    const hh = pad(date.getHours());
    const min = pad(date.getMinutes());
    const ss = pad(date.getSeconds());
    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Initialize App on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
