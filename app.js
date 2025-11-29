// IndexedDB Database Management
class XteamDB {
    constructor() {
        this.dbName = 'XteamDB';
        this.version = 1;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
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

    async addRecord(record) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['records'], 'readwrite');
            const objectStore = transaction.objectStore('records');
            const request = objectStore.add(record);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllRecords() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['records'], 'readonly');
            const objectStore = transaction.objectStore('records');
            const request = objectStore.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteRecord(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['records'], 'readwrite');
            const objectStore = transaction.objectStore('records');
            const request = objectStore.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async clearAllRecords() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['records'], 'readwrite');
            const objectStore = transaction.objectStore('records');
            const request = objectStore.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
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
            if (file.type.startsWith('image/') || file.size < 1024 * 1024) { // Images or files < 1MB
                fileData.data = await this.fileToBase64(file);
            } else {
                // For larger files, store metadata only
                fileData.data = null;
                fileData.note = 'File too large to store in browser database';
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
        this.html5QrCode = null;
        this.init();
    }

    async init() {
        try {
            await this.db.init();
            this.setupEventListeners();
            this.loadRecords();
            console.log('Xteam application initialized successfully');
        } catch (error) {
            console.error('Failed to initialize application:', error);
            Notification.show('Failed to initialize application', 'error');
        }
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
            const html5QrCode = new Html5Qrcode("qrReader");
            const decodedText = await html5QrCode.scanFile(file, true);

            document.getElementById('barcodeInput').value = decodedText;
            Notification.show(`Code detected from image: ${decodedText}`, 'success');

            // Clear file input
            event.target.value = '';
        } catch (error) {
            console.error('Image scan error:', error);
            Notification.show('No barcode/QR code found in image. Try camera scan or manual entry.', 'warning');
            event.target.value = '';
        }
    }

    async startScanner() {
        const scannerContainer = document.getElementById('scannerContainer');
        const scanButton = document.getElementById('scanButton');

        scannerContainer.style.display = 'block';
        scanButton.disabled = true;

        try {
            // Check for camera availability first
            const cameras = await Html5Qrcode.getCameras();
            if (!cameras || cameras.length === 0) {
                throw new Error('No cameras found');
            }

            console.log('Found cameras:', cameras);

            this.html5QrCode = new Html5Qrcode("qrReader");

            const onScanSuccess = (decodedText, decodedResult) => {
                console.log('✓ Code detected:', decodedText);
                document.getElementById('barcodeInput').value = decodedText;
                const format = decodedResult?.result?.format?.formatName || 'Code';
                Notification.show(`${format} detected: ${decodedText}`, 'success');
                this.stopScanner();
            };

            const onScanFailure = (error) => {
                // Scanning failures are normal, just ignore
            };

            // Simplified config - less formats, better performance
            const config = {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0
            };

            // Use the first available camera (usually rear on mobile)
            const cameraId = cameras[cameras.length - 1].id; // Last camera is usually rear

            await this.html5QrCode.start(
                cameraId,
                config,
                onScanSuccess,
                onScanFailure
            );

            console.log('✓ Scanner started successfully');
            Notification.show('Scanner active! Hold code steady in the frame', 'success');

        } catch (error) {
            console.error('Scanner start error:', error);
            Notification.show(`Scanner error: ${error.message}. Try image upload or manual entry.`, 'error');
            this.stopScanner();
        }
    }

    async stopScanner() {
        if (this.html5QrCode) {
            try {
                await this.html5QrCode.stop();
                await this.html5QrCode.clear();
            } catch (error) {
                console.error('Error stopping scanner:', error);
            }
            this.html5QrCode = null;
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
                </div>
            </div>
        `;
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
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new XteamApp();
});
