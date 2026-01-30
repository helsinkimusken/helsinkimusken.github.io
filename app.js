// NOTE: Core classes (Database, FileHandler, Notification) are now loaded from js/core/ modules
// This file now only contains the XteamApp class and application-specific logic

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
        this.db = new Database();
        this.projectManager = null; // Will be initialized after DB
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

            // Initialize Project Manager
            if (typeof ProjectManager !== 'undefined') {
                this.projectManager = new ProjectManager(this.db);
                await this.projectManager.init();
                console.log('✓ ProjectManager initialized');
            }

            this.setupEventListeners();
            this.setupProjectManagementUI();
            this.loadRecords();
            this.loadProjects(); // Load existing projects

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

    // ============================================================
    // Project Management UI Setup
    // ============================================================

    setupProjectManagementUI() {
        if (!this.projectManager) return;

        // Tab switching (Tasks | Materials | Timeline)
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabName = btn.dataset.tab;
                this.switchTab(tabName);
            });
        });

        // View switching (Kanban | Gantt | List)
        const viewButtons = document.querySelectorAll('.view-btn');
        viewButtons.forEach(btn => {
            btn.addEventListener('click', async () => {
                const viewType = btn.dataset.view;
                await this.switchView(viewType);
            });
        });

        // Project selector
        const projectSelector = document.getElementById('projectSelector');
        if (projectSelector) {
            projectSelector.addEventListener('change', async (e) => {
                const projectId = e.target.value;
                if (projectId) {
                    await this.selectProject(projectId);
                }
            });
        }

        // New project button
        const newProjectBtn = document.getElementById('newProjectBtn');
        if (newProjectBtn) {
            newProjectBtn.addEventListener('click', () => {
                this.showNewProjectModal();
            });
        }

        // New task button
        const newTaskBtn = document.getElementById('newTaskBtn');
        if (newTaskBtn) {
            newTaskBtn.addEventListener('click', () => {
                this.showNewTaskModal();
            });
        }

        // New material button
        const newMaterialBtn = document.getElementById('newMaterialBtn');
        if (newMaterialBtn) {
            newMaterialBtn.addEventListener('click', () => {
                this.showNewMaterialModal();
            });
        }
    }

    async loadProjects() {
        if (!this.projectManager) return;

        try {
            const projects = await this.projectManager.getAllProjects();
            const projectSelector = document.getElementById('projectSelector');

            if (projectSelector) {
                // Clear existing options except the first one
                projectSelector.innerHTML = '<option value="">Select a project...</option>';

                // Add projects to selector
                projects.forEach(project => {
                    const option = document.createElement('option');
                    option.value = project.id;
                    option.textContent = project.name;
                    projectSelector.appendChild(option);
                });

                console.log(`✓ Loaded ${projects.length} projects`);
            }
        } catch (error) {
            console.error('Failed to load projects:', error);
        }
    }

    async selectProject(projectId) {
        if (!this.projectManager) return;

        try {
            await this.projectManager.setCurrentProject(projectId);
            console.log('✓ Project selected:', projectId);

            // Refresh the current view
            await this.projectManager.refreshCurrentView();

            if (typeof Notification !== 'undefined') {
                Notification.show('Project loaded', 'success');
            }
        } catch (error) {
            console.error('Failed to select project:', error);
            if (typeof Notification !== 'undefined') {
                Notification.show('Failed to load project', 'error');
            }
        }
    }

    switchTab(tabName) {
        // Update tab buttons
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Update tab content
        const tabContents = document.querySelectorAll('.tab-content');
        tabContents.forEach(content => {
            content.style.display = 'none';
        });

        const activeTab = document.getElementById(`${tabName}Tab`);
        if (activeTab) {
            activeTab.style.display = 'flex';
        }

        console.log('✓ Switched to tab:', tabName);
    }

    async switchView(viewType) {
        if (!this.projectManager) return;

        // Update view buttons
        const viewButtons = document.querySelectorAll('.view-btn');
        viewButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === viewType);
        });

        // Switch view in ProjectManager
        try {
            await this.projectManager.switchView(viewType);
            console.log('✓ Switched to view:', viewType);
        } catch (error) {
            console.error('Failed to switch view:', error);
        }
    }

    showNewProjectModal() {
        // Temporary simple prompt (will be replaced with proper modal in Phase 2)
        const projectName = prompt('Enter project name:');
        if (projectName && projectName.trim()) {
            this.createProject(projectName.trim());
        }
    }

    async createProject(projectName) {
        if (!this.projectManager) return;

        try {
            const projectId = await this.projectManager.createProject({
                name: projectName,
                description: '',
                status: 'active'
            });

            console.log('✓ Project created:', projectId);

            // Reload projects list
            await this.loadProjects();

            // Select the new project
            const projectSelector = document.getElementById('projectSelector');
            if (projectSelector) {
                projectSelector.value = projectId;
                await this.selectProject(projectId);
            }
        } catch (error) {
            console.error('Failed to create project:', error);
        }
    }

    showNewTaskModal() {
        if (!this.projectManager || !this.projectManager.currentProject) {
            alert('Please select a project first');
            return;
        }

        // Temporary simple prompt (will be replaced with proper modal)
        const taskTitle = prompt('Enter task title:');
        if (taskTitle && taskTitle.trim()) {
            this.createTask(taskTitle.trim());
        }
    }

    async createTask(taskTitle) {
        if (!this.projectManager) return;

        try {
            const taskId = await this.projectManager.createTask({
                title: taskTitle,
                description: '',
                status: 'todo',
                priority: 'medium'
            });

            console.log('✓ Task created:', taskId);
        } catch (error) {
            console.error('Failed to create task:', error);
        }
    }

    showNewMaterialModal() {
        if (!this.projectManager || !this.projectManager.currentProject) {
            alert('Please select a project first');
            return;
        }

        alert('Material tracking UI coming soon in Phase 6');
    }

    showTaskMenu(taskId) {
        // Temporary simple menu (will be replaced with proper context menu)
        const actions = ['Edit Task', 'Delete Task', 'View Details', 'Cancel'];
        const choice = prompt(`Task Actions:\n1. Edit Task\n2. Delete Task\n3. View Details\n\nEnter number (1-3):`);

        switch (choice) {
            case '1':
                this.editTaskPrompt(taskId);
                break;
            case '2':
                this.deleteTaskConfirm(taskId);
                break;
            case '3':
                this.viewTaskDetails(taskId);
                break;
        }
    }

    async editTaskPrompt(taskId) {
        const task = await this.projectManager.db.getTask(taskId);
        if (!task) return;

        const newTitle = prompt('Edit task title:', task.title);
        if (newTitle && newTitle.trim()) {
            await this.projectManager.updateTask(taskId, { title: newTitle.trim() });
        }
    }

    async deleteTaskConfirm(taskId) {
        if (!this.projectManager) return;
        await this.projectManager.deleteTask(taskId, false);
    }

    async viewTaskDetails(taskId) {
        const task = await this.projectManager.db.getTask(taskId);
        if (!task) return;

        const details = `
Task: ${task.title}
Description: ${task.description || 'No description'}
Status: ${task.status}
Priority: ${task.priority}
Progress: ${task.progress}%
Assigned to: ${task.assignedTo || 'Unassigned'}
Created by: ${task.createdBy}
        `;
        alert(details.trim());
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
