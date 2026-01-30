// Firebase Database Management
class XteamDB {
    constructor() {
        this.db = null;
        this.recordsRef = null;
        this.useFirebase = false;
    }

    async init() {
        try {
            // Check if Firebase is configured
            if (typeof firebase !== 'undefined' && typeof firebaseConfig !== 'undefined') {
                // Initialize Firebase
                if (!firebase.apps.length) {
                    firebase.initializeApp(firebaseConfig);
                }
                this.db = firebase.database();
                this.recordsRef = this.db.ref('records');
                this.useFirebase = true;
                console.log('✓ Firebase initialized successfully');

                // Set up real-time listener
                this.setupRealtimeListener();
            } else {
                console.warn('Firebase not configured. Using local IndexedDB only.');
                await this.initIndexedDB();
            }
        } catch (error) {
            console.error('Firebase initialization error:', error);
            console.warn('Falling back to IndexedDB');
            await this.initIndexedDB();
        }
    }

    async initIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('XteamDB', 1);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.localDB = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('records')) {
                    const objectStore = db.createObjectStore('records', { keyPath: 'id', autoIncrement: true });
                    objectStore.createIndex('timestamp', 'timestamp', { unique: false });
                    objectStore.createIndex('category', 'category', { unique: false });
                    objectStore.createIndex('userName', 'userName', { unique: false });
                }
            };
        });
    }

    setupRealtimeListener() {
        if (!this.useFirebase) return;

        // Listen for new records
        this.recordsRef.on('value', (snapshot) => {
            if (window.xteamApp) {
                // Trigger UI update
                window.xteamApp.onDataChanged();
            }
        });
    }

    async addRecord(record) {
        if (this.useFirebase) {
            // Add to Firebase with auto-generated key
            const newRecordRef = this.recordsRef.push();
            record.id = newRecordRef.key;
            await newRecordRef.set(record);
            console.log('✓ Record saved to Firebase');
            return record.id;
        } else {
            // Fallback to IndexedDB
            return new Promise((resolve, reject) => {
                const transaction = this.localDB.transaction(['records'], 'readwrite');
                const objectStore = transaction.objectStore('records');
                const request = objectStore.add(record);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }
    }

    async getAllRecords() {
        if (this.useFirebase) {
            const snapshot = await this.recordsRef.once('value');
            const records = [];
            snapshot.forEach((childSnapshot) => {
                records.push({
                    id: childSnapshot.key,
                    ...childSnapshot.val()
                });
            });
            return records;
        } else {
            // Fallback to IndexedDB
            return new Promise((resolve, reject) => {
                const transaction = this.localDB.transaction(['records'], 'readonly');
                const objectStore = transaction.objectStore('records');
                const request = objectStore.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }
    }

    async deleteRecord(id) {
        if (this.useFirebase) {
            await this.recordsRef.child(id).remove();
            console.log('✓ Record deleted from Firebase');
        } else {
            // Fallback to IndexedDB
            return new Promise((resolve, reject) => {
                const transaction = this.localDB.transaction(['records'], 'readwrite');
                const objectStore = transaction.objectStore('records');
                const request = objectStore.delete(id);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }
    }

    async clearAllRecords() {
        if (this.useFirebase) {
            await this.recordsRef.remove();
            console.log('✓ All records cleared from Firebase');
        } else {
            // Fallback to IndexedDB
            return new Promise((resolve, reject) => {
                const transaction = this.localDB.transaction(['records'], 'readwrite');
                const objectStore = transaction.objectStore('records');
                const request = objectStore.clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }
    }
}

// File handling utilities
class FileHandler {
    static async fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    static async processFiles(files) {
        const processedFiles = [];
        for (const file of files) {
            const fileData = {
                name: file.name,
                size: file.size,
                type: file.type,
                lastModified: file.lastModified
            };

            // Store images and small files as base64
            if (file.type.startsWith('image/') || file.size < 100 * 1024 * 1024) { // Images or files < 100MB
                fileData.data = await this.fileToBase64(file);
            } else {
                // For larger files, store metadata only
                fileData.data = null;
                fileData.note = 'File too large to store in browser database (limit 100MB)';
            }

            processedFiles.push(fileData);
        }
        return processedFiles;
    }

    static formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }
}

// Notification system
class Notification {
    static show(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Audio beep for barcode detection
let audioContext = null;
function playBeep() {
    try {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Beep frequency and duration
        oscillator.frequency.value = 1200; // Hz
        oscillator.type = 'square';

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
    } catch (error) {
        console.error('Error playing beep:', error);
    }
}

// Main Application
class XteamApp {
    constructor() {
        this.db = new XteamDB();
        this.uploadedFiles = {
            photos: [],
            files: [],
            folders: [],
            archives: []
        };
        this.codeReader = new ZXing.BrowserMultiFormatReader();
        this.init();
    }

    async init() {
        try {
            await this.db.init();
            this.setupEventListeners();
            this.loadRecords();

            // Make app globally accessible for Firebase callbacks
            window.xteamApp = this;

            // Show connection status
            if (this.db.useFirebase) {
                Notification.show('✓ Connected to Firebase - Real-time sync enabled!', 'success');
            } else {
                Notification.show('Using local storage only - Data not shared', 'warning');
            }

            console.log('Xteam application initialized successfully');
        } catch (error) {
            console.error('Failed to initialize application:', error);
            Notification.show('Failed to initialize application', 'error');
        }
    }

    // Called by Firebase when data changes
    onDataChanged() {
        console.log('Data changed - reloading...');
        this.loadRecords();
    }

    setupEventListeners() {
        // Submit button
        document.getElementById('submitButton').addEventListener('click', () => this.submitRecord());

        // Clear button
        document.getElementById('clearButton').addEventListener('click', () => this.clearForm());

        // File uploads
        this.setupFileUpload('photoUpload', 'photoPreview', 'photos', 'photoDropZone');
        this.setupFileUpload('fileUpload', 'filePreview', 'files', 'fileDropZone');
        this.setupFileUpload('folderUpload', 'folderPreview', 'folders');
        this.setupFileUpload('archiveUpload', 'archivePreview', 'archives', 'archiveDropZone');

        // Barcode scanner
        document.getElementById('scanButton').addEventListener('click', () => this.startScanner());
        document.getElementById('closeScannerButton').addEventListener('click', () => this.stopScanner());

        // Image upload for code scanning
        document.getElementById('codeImageUpload').addEventListener('change', (e) => this.scanImageFile(e));

        // Filter
        document.getElementById('filterCategory').addEventListener('change', (e) => this.filterRecords(e.target.value));

        // Export and clear all
        document.getElementById('exportButton').addEventListener('click', () => this.exportData());
        document.getElementById('clearAllButton').addEventListener('click', () => this.clearAllData());
    }

    setupFileUpload(inputId, previewId, type, dropZoneId = null) {
        const input = document.getElementById(inputId);
        const preview = document.getElementById(previewId);

        input.addEventListener('change', (e) => {
            this.handleFileSelect(e.target.files, preview, type);
        });

        if (dropZoneId) {
            const dropZone = document.getElementById(dropZoneId);

            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('drag-over');
            });

            dropZone.addEventListener('dragleave', () => {
                dropZone.classList.remove('drag-over');
            });

            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('drag-over');
                this.handleFileSelect(e.dataTransfer.files, preview, type);
            });
        }
    }

    async handleFileSelect(files, previewElement, type) {
        const fileArray = Array.from(files);
        this.uploadedFiles[type] = this.uploadedFiles[type].concat(fileArray);

        previewElement.innerHTML = '';

        for (let i = 0; i < this.uploadedFiles[type].length; i++) {
            const file = this.uploadedFiles[type][i];
            const fileItem = document.createElement('div');
            fileItem.className = 'file-preview-item';

            if (file.type.startsWith('image/')) {
                const img = document.createElement('img');
                img.src = URL.createObjectURL(file);
                fileItem.appendChild(img);
            }

            const fileName = document.createElement('div');
            fileName.textContent = file.name;
            fileName.style.fontSize = '0.75rem';
            fileName.style.marginTop = '5px';
            fileItem.appendChild(fileName);

            const fileSize = document.createElement('div');
            fileSize.textContent = FileHandler.formatFileSize(file.size);
            fileSize.style.fontSize = '0.7rem';
            fileSize.style.color = '#64748b';
            fileItem.appendChild(fileSize);

            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-file';
            removeBtn.textContent = '×';
            removeBtn.onclick = () => {
                this.uploadedFiles[type].splice(i, 1);
                this.handleFileSelect(this.uploadedFiles[type], previewElement, type);
            };
            fileItem.appendChild(removeBtn);

            previewElement.appendChild(fileItem);
        }
    }

    async scanImageFile(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const result = await this.codeReader.decodeFromImageUrl(e.target.result);
                    const decodedText = result.getText();
                    const format = result.getBarcodeFormat();

                    // Play beep sound
                    playBeep();

                    // Vibrate if supported (mobile devices)
                    if (navigator.vibrate) {
                        navigator.vibrate(200);
                    }

                    document.getElementById('barcodeInput').value = decodedText;
                    Notification.show(`${format} detected from image: ${decodedText}`, 'success');
                    console.log('✓ Code detected from image:', decodedText);
                } catch (error) {
                    console.error('Image scan error:', error);
                    Notification.show('No barcode/QR code found in image. Please try camera scan or enter manually.', 'warning');
                }
                event.target.value = '';
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error('File read error:', error);
            Notification.show('Error reading file. Please try again.', 'error');
            event.target.value = '';
        }
    }

    async startScanner() {
        const scannerContainer = document.getElementById('scannerContainer');
        const scanButton = document.getElementById('scanButton');
        const videoElement = document.getElementById('scannerVideo');

        scannerContainer.style.display = 'block';
        scanButton.disabled = true;

        try {
            console.log('Starting camera scanner...');

            // Request camera permission first
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });

            console.log('Camera permission granted');

            // Get device ID
            const track = stream.getVideoTracks()[0];
            const settings = track.getSettings();
            const deviceId = settings.deviceId;

            // Stop temporary stream
            stream.getTracks().forEach(t => t.stop());

            console.log('Using camera:', deviceId);

            // Start ZXing decoder
            await this.codeReader.decodeFromVideoDevice(deviceId, videoElement, (result, error) => {
                if (result) {
                    const decodedText = result.getText();
                    const format = result.getBarcodeFormat();

                    console.log('✓ Code detected:', decodedText);

                    // Play beep sound
                    playBeep();

                    // Vibrate if supported (mobile devices)
                    if (navigator.vibrate) {
                        navigator.vibrate(200);
                    }

                    document.getElementById('barcodeInput').value = decodedText;
                    Notification.show(`${format} detected: ${decodedText}`, 'success');

                    this.stopScanner();
                }
                // Ignore NotFoundException errors (normal during scanning)
                if (error && !(error instanceof ZXing.NotFoundException)) {
                    console.error('Decode error:', error);
                }
            });

            console.log('✓ Scanner started successfully');
            Notification.show('Scanner active! Point at barcode or QR code', 'success');

        } catch (error) {
            console.error('Scanner start error:', error);
            Notification.show(`Camera error: ${error.message}. Try image upload or manual entry.`, 'error');
            this.stopScanner();
        }
    }

    async stopScanner() {
        try {
            this.codeReader.reset();
            console.log('Scanner stopped');
        } catch (error) {
            console.error('Error stopping scanner:', error);
        }

        document.getElementById('scannerContainer').style.display = 'none';
        document.getElementById('scanButton').disabled = false;
    }

    async submitRecord() {
        const textInput = document.getElementById('textInput').value.trim();
        const barcodeInput = document.getElementById('barcodeInput').value.trim();
        const userName = document.getElementById('userName').value.trim();
        const category = document.getElementById('category').value;

        // Validation
        if (!textInput && !barcodeInput &&
            !this.uploadedFiles.photos.length &&
            !this.uploadedFiles.files.length &&
            !this.uploadedFiles.folders.length &&
            !this.uploadedFiles.archives.length) {
            Notification.show('Please enter some information before submitting', 'warning');
            return;
        }

        if (!userName) {
            Notification.show('Please enter your name', 'warning');
            return;
        }

        try {
            // Process files
            const processedData = {
                photos: await FileHandler.processFiles(this.uploadedFiles.photos),
                files: await FileHandler.processFiles(this.uploadedFiles.files),
                folders: await FileHandler.processFiles(this.uploadedFiles.folders),
                archives: await FileHandler.processFiles(this.uploadedFiles.archives)
            };

            const record = {
                textInput,
                barcodeInput,
                userName,
                category: category || 'other',
                timestamp: new Date().toISOString(),
                ...processedData
            };

            await this.db.addRecord(record);
            Notification.show('Record submitted successfully!', 'success');
            this.clearForm();
            this.loadRecords();
        } catch (error) {
            console.error('Error submitting record:', error);
            Notification.show('Failed to submit record', 'error');
        }
    }

    clearForm() {
        document.getElementById('textInput').value = '';
        document.getElementById('barcodeInput').value = '';
        document.getElementById('userName').value = '';
        document.getElementById('category').value = '';

        // Clear file inputs
        document.getElementById('photoUpload').value = '';
        document.getElementById('fileUpload').value = '';
        document.getElementById('folderUpload').value = '';
        document.getElementById('archiveUpload').value = '';

        // Clear uploaded files
        this.uploadedFiles = {
            photos: [],
            files: [],
            folders: [],
            archives: []
        };

        // Clear previews
        document.getElementById('photoPreview').innerHTML = '';
        document.getElementById('filePreview').innerHTML = '';
        document.getElementById('folderPreview').innerHTML = '';
        document.getElementById('archivePreview').innerHTML = '';

        Notification.show('Form cleared', 'success');
    }

    async loadRecords(filterCategory = '') {
        try {
            const records = await this.db.getAllRecords();
            const filteredRecords = filterCategory
                ? records.filter(r => r.category === filterCategory)
                : records;

            this.displayRecords(filteredRecords.reverse()); // Show newest first
            this.updateDashboard(records); // Update dashboard with all records
        } catch (error) {
            console.error('Error loading records:', error);
            Notification.show('Failed to load records', 'error');
        }
    }

    displayRecords(records) {
        const recordsList = document.getElementById('recordsList');

        if (records.length === 0) {
            recordsList.innerHTML = `
                <div class="empty-state">
                    <div class="icon">📋</div>
                    <p>No records found. Start by submitting your first record!</p>
                </div>
            `;
            return;
        }

        recordsList.innerHTML = records.map(record => this.createRecordCard(record)).join('');

        // Add delete event listeners
        records.forEach(record => {
            const deleteBtn = document.getElementById(`delete-${record.id}`);
            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => this.deleteRecord(record.id));
            }
            const downloadBtn = document.getElementById(`download-${record.id}`);
            if (downloadBtn) {
                    downloadBtn.addEventListener('click', () => this.downloadRecordFiles(record));
            }
        });
    }

    createRecordCard(record) {
        const date = new Date(record.timestamp);
        const formattedDate = date.toLocaleString();

        let filesHtml = '';

        // Display photos
        if (record.photos && record.photos.length > 0) {
            filesHtml += '<div class="record-files"><strong>Photos:</strong><br>';
            record.photos.forEach(photo => {
                filesHtml += `
                    <div class="record-file-item">
                        ${photo.data ? `<img src="${photo.data}" alt="${photo.name}">` : ''}
                        <div>${photo.name}</div>
                        <div style="font-size: 0.7rem; color: #64748b;">${FileHandler.formatFileSize(photo.size)}</div>
                    </div>
                `;
            });
            filesHtml += '</div>';
        }

        // Display files
        if (record.files && record.files.length > 0) {
            filesHtml += '<div class="record-files"><strong>Files:</strong><br>';
            record.files.forEach(file => {
                filesHtml += `
                    <div class="record-file-item">
                        ${file.data && file.type.startsWith('image/') ? `<img src="${file.data}" alt="${file.name}">` : '📄'}
                        <div>${file.name}</div>
                        <div style="font-size: 0.7rem; color: #64748b;">${FileHandler.formatFileSize(file.size)}</div>
                        ${file.note ? `<div style="font-size: 0.65rem; color: #ef4444;">${file.note}</div>` : ''}
                    </div>
                `;
            });
            filesHtml += '</div>';
        }

        // Display folders
        if (record.folders && record.folders.length > 0) {
            filesHtml += `<div><strong>Folder Files (${record.folders.length}):</strong> `;
            filesHtml += record.folders.slice(0, 5).map(f => f.name).join(', ');
            if (record.folders.length > 5) filesHtml += ` and ${record.folders.length - 5} more...`;
            filesHtml += '</div>';
        }

        // Display archives
        if (record.archives && record.archives.length > 0) {
            filesHtml += '<div class="record-files"><strong>Archives:</strong><br>';
            record.archives.forEach(archive => {
                filesHtml += `
                    <div class="record-file-item">
                        🗜️
                        <div>${archive.name}</div>
                        <div style="font-size: 0.7rem; color: #64748b;">${FileHandler.formatFileSize(archive.size)}</div>
                    </div>
                `;
            });
            filesHtml += '</div>';
        }

        return `
            <div class="record-card">
                <div class="record-header">
                    <span class="category-badge category-${record.category}">${record.category.replace('-', ' ')}</span>
                    <div class="record-meta">
                        <span>👤 ${record.userName}</span>
                        <span>🕒 ${formattedDate}</span>
                    </div>
                </div>
                <div class="record-content">
                    ${record.textInput ? `<div class="record-text"><strong>Text:</strong><br>${record.textInput}</div>` : ''}
                    ${record.barcodeInput ? `<div class="record-barcode"><strong>Barcode/QR:</strong> ${record.barcodeInput}</div>` : ''}
                    ${filesHtml}
                </div>
                <div class="record-actions">
                    <button id="delete-${record.id}" class="btn btn-danger">
                        <span class="icon">🗑️</span> Delete
                    </button>
                    <button id="download-${record.id}" class="btn btn-primary">
                        <span class="icon">⬇️</span> Download
                    </button>
                </div>
                
            </div>
        `;
    }
    
    async downloadRecordFiles(record) {
        try {
            const allFiles = [...(record.photos || []), ...(record.files || []), ...(record.archives || [])];
            if (allFiles.length === 0) {
                Notification.show('No files to download', 'warning');
                return;
            }

            let downloadedCount = 0;
            for (const file of allFiles) {
                if (file.data) {
                    const link = document.createElement('a');
                    link.href = file.data;
                    link.download = file.name;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    downloadedCount++;
                }
            }

            if (downloadedCount === 0) {
                Notification.show('No files contain data (files might be too large)', 'warning');
            } else if (downloadedCount < allFiles.length) {
                Notification.show(`Downloaded ${downloadedCount} of ${allFiles.length} files. Some were too large to store.`, 'warning');
            } else {
                Notification.show('Files downloaded successfully!', 'success');
            }
        } catch (error) {
            console.error('Download error:', error);
            Notification.show('Failed to download files', 'error');
        }
    }

    async deleteRecord(id) {
        if (!confirm('Are you sure you want to delete this record?')) {
            return;
        }

        try {
            await this.db.deleteRecord(id);
            Notification.show('Record deleted successfully', 'success');
            this.loadRecords();
        } catch (error) {
            console.error('Error deleting record:', error);
            Notification.show('Failed to delete record', 'error');
        }
    }

    filterRecords(category) {
        this.loadRecords(category);
    }

    async exportData() {
        try {
            const records = await this.db.getAllRecords();
            const dataStr = JSON.stringify(records, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);

            const link = document.createElement('a');
            link.href = url;
            link.download = `xteam-data-${new Date().toISOString().split('T')[0]}.json`;
            link.click();

            URL.revokeObjectURL(url);
            Notification.show('Data exported successfully', 'success');
        } catch (error) {
            console.error('Error exporting data:', error);
            Notification.show('Failed to export data', 'error');
        }
    }

    async clearAllData() {
        if (!confirm('Are you sure you want to delete ALL records? This cannot be undone!')) {
            return;
        }

        try {
            await this.db.clearAllRecords();
            Notification.show('All data cleared successfully', 'success');
            this.loadRecords();
        } catch (error) {
            console.error('Error clearing data:', error);
            Notification.show('Failed to clear data', 'error');
        }
    }

    updateDashboard(records) {
        // Calculate statistics
        const total = records.length;
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

        const todayCount = records.filter(r => new Date(r.timestamp) >= today).length;
        const weekCount = records.filter(r => new Date(r.timestamp) >= weekAgo).length;
        const uniqueUsers = [...new Set(records.map(r => r.userName))].length;

        // Update stats
        document.getElementById('totalRecords').textContent = total;
        document.getElementById('todayRecords').textContent = todayCount;
        document.getElementById('weekRecords').textContent = weekCount;
        document.getElementById('activeUsers').textContent = uniqueUsers;

        // Update charts
        this.updateCategoryChart(records);
        this.updateUserChart(records);
        this.updateTimelineChart(records);
    }

    updateCategoryChart(records) {
        const categoryCounts = {};
        const categories = ['vendor-performance', 'cross-team-issue', 'quality-report', 'delay-report', 'achievement', 'other'];
        const categoryLabels = {
            'vendor-performance': 'Vendor Performance',
            'cross-team-issue': 'Cross-Team Issue',
            'quality-report': 'Quality Report',
            'delay-report': 'Delay Report',
            'achievement': 'Achievement',
            'other': 'Other'
        };

        categories.forEach(cat => categoryCounts[cat] = 0);
        records.forEach(r => {
            if (categoryCounts[r.category] !== undefined) {
                categoryCounts[r.category]++;
            }
        });

        this.drawPieChart('categoryChart', categoryCounts, categoryLabels, 'categoryLegend');
    }

    updateUserChart(records) {
        const userCounts = {};
        records.forEach(r => {
            userCounts[r.userName] = (userCounts[r.userName] || 0) + 1;
        });

        // Top 5 users
        const topUsers = Object.entries(userCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {});

        this.drawPieChart('userChart', topUsers, topUsers, 'userLegend');
    }

    updateTimelineChart(records) {
        const last7Days = {};
        const now = new Date();

        // Initialize last 7 days
        for (let i = 6; i >= 0; i--) {
            const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const dateStr = date.toISOString().split('T')[0];
            last7Days[dateStr] = 0;
        }

        // Count records per day
        records.forEach(r => {
            const dateStr = r.timestamp.split('T')[0];
            if (last7Days[dateStr] !== undefined) {
                last7Days[dateStr]++;
            }
        });

        this.drawBarChart('timelineChart', last7Days);
    }

    drawPieChart(canvasId, data, labels, legendId) {
        const canvas = document.getElementById(canvasId);
        const ctx = canvas.getContext('2d');
        const legend = document.getElementById(legendId);

        canvas.width = 300;
        canvas.height = 300;

        const colors = [
            '#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'
        ];

        const total = Object.values(data).reduce((a, b) => a + b, 0);
        if (total === 0) {
            ctx.fillStyle = '#94a3b8';
            ctx.textAlign = 'center';
            ctx.font = '14px sans-serif';
            ctx.fillText('No data', canvas.width / 2, canvas.height / 2);
            return;
        }

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(centerX, centerY) - 10;

        let startAngle = -Math.PI / 2;
        legend.innerHTML = '';

        Object.entries(data).forEach(([key, value], index) => {
            if (value === 0) return;

            const sliceAngle = (value / total) * 2 * Math.PI;
            const endAngle = startAngle + sliceAngle;

            // Draw slice
            ctx.fillStyle = colors[index % colors.length];
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.closePath();
            ctx.fill();

            // Draw border
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.stroke();

            startAngle = endAngle;

            // Add legend
            const legendItem = document.createElement('div');
            legendItem.className = 'legend-item';
            legendItem.innerHTML = `
                <div class="legend-color" style="background-color: ${colors[index % colors.length]}"></div>
                <span>${labels[key] || key}: ${value} (${Math.round(value / total * 100)}%)</span>
            `;
            legend.appendChild(legendItem);
        });
    }

    drawBarChart(canvasId, data) {
        const canvas = document.getElementById(canvasId);
        const ctx = canvas.getContext('2d');

        canvas.width = canvas.parentElement.clientWidth - 50;
        canvas.height = 300;

        const entries = Object.entries(data);
        const maxValue = Math.max(...Object.values(data), 1);
        const barWidth = canvas.width / entries.length - 10;
        const barMaxHeight = canvas.height - 60;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        entries.forEach(([date, value], index) => {
            const x = index * (barWidth + 10) + 20;
            const barHeight = (value / maxValue) * barMaxHeight;
            const y = canvas.height - barHeight - 40;

            // Draw bar
            ctx.fillStyle = '#2563eb';
            ctx.fillRect(x, y, barWidth, barHeight);

            // Draw value on top
            ctx.fillStyle = '#1e293b';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(value, x + barWidth / 2, y - 5);

            // Draw date label
            const dateLabel = new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            ctx.fillStyle = '#64748b';
            ctx.font = '11px sans-serif';
            ctx.save();
            ctx.translate(x + barWidth / 2, canvas.height - 10);
            ctx.rotate(-Math.PI / 6);
            ctx.fillText(dateLabel, 0, 0);
            ctx.restore();
        });
    }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Initialize Firebase first (required before AuthManager)
        if (typeof firebase !== 'undefined' && typeof firebaseConfig !== 'undefined') {
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
                console.log('✓ Firebase initialized');
            }
        } else {
            throw new Error('Firebase or firebaseConfig not loaded. Check firebase-config-public.js');
        }

        // Initialize Authentication Manager (requires Firebase to be initialized)
        window.authManager = new AuthManager();
        await window.authManager.init();

        // Set up auth state change callback to initialize app when authenticated
        window.authManager.onAuthStateChanged((user) => {
            if (user && !window.xteamApp) {
                // User is authenticated and app not yet initialized
                console.log('User authenticated, initializing Xteam app...');
                window.xteamApp = new XteamApp();
            } else if (!user && window.xteamApp) {
                // User logged out - could reset app state here if needed
                console.log('User logged out');
            }
        });

        console.log('✓ Application initialization complete');

    } catch (error) {
        console.error('Application initialization error:', error);
        alert('Failed to initialize application. Please refresh the page.');
    }
});
