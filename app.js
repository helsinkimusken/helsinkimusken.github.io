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
        this.collaborationView = null;
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

            // Initialize Collaboration View (activities dashboard)
            if (typeof CollaborationView !== 'undefined') {
                this.collaborationView = new CollaborationView(this.projectManager);
                console.log('✓ CollaborationView initialized');
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

        // Project filter toggle
        const filterByProjectCheckbox = document.getElementById('filterByProject');
        if (filterByProjectCheckbox) {
            filterByProjectCheckbox.addEventListener('change', (e) => {
                const filterCategory = document.getElementById('filterCategory')?.value || '';
                this.loadRecords(filterCategory, e.target.checked);
            });
        }

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

            // Get current project ID
            const currentProjectId = this.projectManager?.currentProject?.id || null;

            const record = {
                textInput,
                barcodeInput,
                userName,
                category: category || 'other',
                timestamp: new Date().toISOString(),
                projectId: currentProjectId,
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

    async loadRecords(filterCategory = '', filterByProject = true) {
        try {
            let records;
            const currentProjectId = this.projectManager?.currentProject?.id;

            // Filter by project if enabled and a project is selected
            if (filterByProject && currentProjectId) {
                records = await this.db.getRecordsByProject(currentProjectId);
            } else {
                records = await this.db.getAllRecords();
            }

            const filteredRecords = filterCategory
                ? records.filter(r => r.category === filterCategory)
                : records;

            this.displayRecords(filteredRecords.reverse()); // Show newest first
            this.updateDashboard(records, currentProjectId); // Update dashboard with project context
            this.updateProjectIndicator(); // Update project indicator in info sharing panel
        } catch (error) {
            console.error('Error loading records:', error);
            Notification.show('Failed to load records', 'error');
        }
    }

    updateProjectIndicator() {
        const indicator = document.getElementById('currentProjectName');
        if (indicator) {
            const project = this.projectManager?.currentProject;
            indicator.textContent = project ? project.name : 'No project selected';
            indicator.classList.toggle('no-project', !project);
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
        const filterByProject = document.getElementById('filterByProject')?.checked ?? true;
        this.loadRecords(category, filterByProject);
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

    async updateDashboard(records, projectId = null) {
        try {
            // Get tasks for the current project
            let tasks = [];
            let milestones = [];

            if (projectId && this.db) {
                tasks = await this.db.getTasksByProject(projectId);
                milestones = await this.db.getMilestonesByProject(projectId);
            } else if (this.db) {
                tasks = await this.db.getAllTasks();
            }

            // Calculate deliverables (completed tasks and milestones)
            const completedTasks = tasks.filter(t => t.status === 'done');
            const completedMilestones = milestones.filter(m => m.status === 'completed');
            const deliverableCount = completedTasks.length + completedMilestones.length;

            // Calculate bottlenecks (blocked and overdue tasks)
            const now = Date.now();
            const blockedTasks = tasks.filter(t => t.status === 'blocked');
            const overdueTasks = tasks.filter(t =>
                t.status !== 'done' && t.dueDate && t.dueDate < now
            );
            const bottleneckCount = blockedTasks.length + overdueTasks.length;

            // Calculate achievements
            const achievementRecords = records.filter(r => r.category === 'achievement');
            const achievementCount = achievementRecords.length + completedMilestones.length;

            // Calculate overall progress
            const progress = tasks.length > 0
                ? Math.round((completedTasks.length / tasks.length) * 100)
                : 0;

            // Update stat cards
            const deliverableEl = document.getElementById('deliverableCount');
            const bottleneckEl = document.getElementById('bottleneckCount');
            const achievementEl = document.getElementById('achievementCount');
            const progressEl = document.getElementById('overallProgress');

            if (deliverableEl) deliverableEl.textContent = deliverableCount;
            if (bottleneckEl) bottleneckEl.textContent = bottleneckCount;
            if (achievementEl) achievementEl.textContent = achievementCount;
            if (progressEl) progressEl.textContent = `${progress}%`;

            // Render sections
            this.renderDeliverables(completedTasks, completedMilestones);
            this.renderBottlenecks(blockedTasks, overdueTasks);
            this.renderAchievements(achievementRecords, completedMilestones);

            // Update charts
            this.updateTaskStatusChart(tasks);
            this.updateCategoryChart(records);
            this.updateTimelineChart(records);
        } catch (error) {
            console.error('Error updating dashboard:', error);
        }
    }

    renderDeliverables(tasks, milestones) {
        const container = document.getElementById('deliverablesList');
        if (!container) return;

        const items = [
            ...milestones.map(m => ({
                type: 'milestone',
                icon: '🎯',
                title: m.name || m.title,
                date: m.completedAt || m.updatedAt
            })),
            ...tasks.map(t => ({
                type: 'task',
                icon: '✅',
                title: t.title,
                date: t.updatedAt
            }))
        ].sort((a, b) => (b.date || 0) - (a.date || 0)).slice(0, 10);

        if (items.length === 0) {
            container.innerHTML = '<p class="empty-message">No deliverables yet</p>';
            return;
        }

        container.innerHTML = items.map(item => `
            <div class="deliverable-item">
                <span class="icon">${item.icon}</span>
                <div class="item-details">
                    <div class="item-title">${this.escapeHtml(item.title)}</div>
                    <div class="item-meta">${item.type} - ${this.formatDate(item.date)}</div>
                </div>
            </div>
        `).join('');
    }

    renderBottlenecks(blockedTasks, overdueTasks) {
        const container = document.getElementById('bottlenecksList');
        if (!container) return;

        const items = [
            ...blockedTasks.map(t => ({
                type: 'blocked',
                icon: '🚫',
                title: t.title,
                reason: 'Task is blocked',
                priority: t.priority || 'medium'
            })),
            ...overdueTasks.filter(t => t.status !== 'blocked').map(t => ({
                type: 'overdue',
                icon: '⏰',
                title: t.title,
                reason: `Overdue since ${this.formatDate(t.dueDate)}`,
                priority: t.priority || 'medium'
            }))
        ];

        // Sort by priority (urgent > high > medium > low)
        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
        items.sort((a, b) => (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2));

        if (items.length === 0) {
            container.innerHTML = '<p class="empty-message">No bottlenecks - great work!</p>';
            return;
        }

        container.innerHTML = items.slice(0, 10).map(item => `
            <div class="bottleneck-item ${item.type}">
                <span class="icon">${item.icon}</span>
                <div class="item-details">
                    <div class="item-title">${this.escapeHtml(item.title)}</div>
                    <div class="item-meta">${item.reason}</div>
                </div>
                <span class="priority-badge priority-${item.priority}">${item.priority}</span>
            </div>
        `).join('');
    }

    renderAchievements(achievementRecords, completedMilestones) {
        const container = document.getElementById('achievementsList');
        if (!container) return;

        const items = [
            ...completedMilestones.map(m => ({
                icon: '🏆',
                title: m.name || m.title,
                description: 'Milestone completed',
                date: m.completedAt || m.updatedAt
            })),
            ...achievementRecords.map(r => ({
                icon: '⭐',
                title: (r.textInput || 'Achievement').substring(0, 50),
                description: `Reported by ${r.userName}`,
                date: new Date(r.timestamp).getTime()
            }))
        ].sort((a, b) => (b.date || 0) - (a.date || 0)).slice(0, 10);

        if (items.length === 0) {
            container.innerHTML = '<p class="empty-message">No achievements recorded yet</p>';
            return;
        }

        container.innerHTML = items.map(item => `
            <div class="achievement-item">
                <span class="icon">${item.icon}</span>
                <div class="item-details">
                    <div class="item-title">${this.escapeHtml(item.title)}</div>
                    <div class="item-meta">${item.description}</div>
                </div>
            </div>
        `).join('');
    }

    updateTaskStatusChart(tasks) {
        const statusCounts = {
            'To Do': tasks.filter(t => t.status === 'todo').length,
            'In Progress': tasks.filter(t => t.status === 'in-progress').length,
            'Blocked': tasks.filter(t => t.status === 'blocked').length,
            'Done': tasks.filter(t => t.status === 'done').length
        };

        this.drawPieChart('taskStatusChart', statusCounts, statusCounts, 'taskStatusLegend');
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatDate(timestamp) {
        if (!timestamp) return 'Unknown';
        const date = new Date(timestamp);
        return date.toLocaleDateString();
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
                } else {
                    // No project selected - clear the indicator
                    if (this.projectManager) {
                        this.projectManager.currentProject = null;
                    }
                    this.updateProjectIndicator();
                    this.loadRecords('', false); // Show all records
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

        // New activity button (Collaboration tab)
        const newActivityBtn = document.getElementById('newActivityBtn');
        if (newActivityBtn) {
            newActivityBtn.addEventListener('click', () => {
                this.showNewTaskModal(true);
            });
        }

        const refreshCollabBtn = document.getElementById('refreshCollabBtn');
        if (refreshCollabBtn) {
            refreshCollabBtn.addEventListener('click', async () => {
                await this.renderCollaborationDashboard();
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

                // Auto-select the first project if available
                if (projects.length > 0) {
                    projectSelector.value = projects[0].id;
                    await this.selectProject(projects[0].id);
                }
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

            // Update project indicator immediately
            this.updateProjectIndicator();

            // Refresh the current view
            await this.projectManager.refreshCurrentView();

            // If collaboration tab is active, refresh dashboard
            const activeTabBtn = document.querySelector('.tab-btn.active');
            const activeTab = activeTabBtn?.dataset?.tab;
            if (activeTab === 'collaboration') {
                await this.renderCollaborationDashboard();
            }

            // Refresh records filtered by the new project
            const filterByProject = document.getElementById('filterByProject')?.checked ?? true;
            await this.loadRecords('', filterByProject);

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

        // Render collaboration dashboard on entry
        if (tabName === 'collaboration') {
            this.renderCollaborationDashboard();
        }

        console.log('✓ Switched to tab:', tabName);
    }

    async renderCollaborationDashboard() {
        try {
            if (!this.collaborationView) return;
            await this.collaborationView.render();
        } catch (error) {
            console.error('Failed to render collaboration dashboard:', error);
            if (typeof Notification !== 'undefined') {
                Notification.show('Failed to render collaboration dashboard', 'error');
            }
        }
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

    showNewTaskModal(isActivity = false) {
        if (!this.projectManager || !this.projectManager.currentProject) {
            alert('Please select a project first');
            return;
        }

        // Create modal HTML
        const currentUser = window.authManager?.currentUser?.email || '';
        const today = new Date().toISOString().split('T')[0];

        const aspectOptions = [
            { key: 'business', label: 'Business' },
            { key: 'program', label: 'Program' },
            { key: 'docs-tools', label: 'Docs & Tools' },
            { key: 'design-dev', label: 'Design & Dev' },
            { key: 'logistics', label: 'Logistics' }
        ];

        const aspectSelect = `
            <div class="form-group">
                <label for="taskAspect">Aspect</label>
                <select id="taskAspect">
                    ${aspectOptions.map(o => `<option value="${o.key}" ${o.key === 'program' ? 'selected' : ''}>${o.label}</option>`).join('')}
                </select>
                <div class="hint" style="margin-top: 6px; color: #64748b; font-size: 0.8rem;">
                    Use Aspect to group activities (recommended for Biz-Plan-AAC collaboration projects).
                </div>
            </div>
        `;

        const modalHTML = `
            <div class="modal-overlay" id="taskModal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>${isActivity ? 'Create New Activity' : 'Create New Task'}</h3>
                        <button class="modal-close" onclick="document.getElementById('taskModal').remove()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label for="taskTitle">${isActivity ? 'Activity Title *' : 'Task Title *'}</label>
                            <input type="text" id="taskTitle" placeholder="${isActivity ? 'Enter activity title' : 'Enter task title'}" required>
                        </div>
                        <div class="form-group">
                            <label for="taskDescription">Description</label>
                            <textarea id="taskDescription" placeholder="Enter description (optional)"></textarea>
                        </div>
                        ${aspectSelect}
                        <div class="form-row">
                            <div class="form-group">
                                <label for="taskOwner">Owner (Responsible)</label>
                                <input type="email" id="taskOwner" placeholder="owner@email.com" value="${currentUser}">
                            </div>
                            <div class="form-group">
                                <label for="taskPriority">Priority</label>
                                <select id="taskPriority">
                                    <option value="low">Low</option>
                                    <option value="medium" selected>Medium</option>
                                    <option value="high">High</option>
                                    <option value="urgent">Urgent</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label for="taskStartDate">Start Date</label>
                                <input type="date" id="taskStartDate" value="${today}">
                            </div>
                            <div class="form-group">
                                <label for="taskDueDate">Due Date (Planned End)</label>
                                <input type="date" id="taskDueDate">
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="document.getElementById('taskModal').remove()">Cancel</button>
                        <button class="btn btn-primary" onclick="window.xteamApp.submitNewTask()">Create Task</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        document.getElementById('taskTitle').focus();
    }

    async submitNewTask() {
        const title = document.getElementById('taskTitle').value.trim();
        const description = document.getElementById('taskDescription').value.trim();
        const owner = document.getElementById('taskOwner').value.trim();
        const priority = document.getElementById('taskPriority').value;
        const startDateStr = document.getElementById('taskStartDate').value;
        const dueDateStr = document.getElementById('taskDueDate').value;
        const aspect = document.getElementById('taskAspect')?.value || 'program';

        if (!title) {
            alert('Please enter a task title');
            return;
        }

        const taskData = {
            title,
            description,
            owner: owner || (window.authManager?.currentUser?.email || 'unknown'),
            priority,
            aspect,
            startDate: startDateStr ? new Date(startDateStr).getTime() : Date.now(),
            dueDate: dueDateStr ? new Date(dueDateStr + 'T23:59:59').getTime() : null,
            status: 'todo'
        };

        try {
            const taskId = await this.projectManager.createTask(taskData);
            console.log('✓ Task created:', taskId);

            // Close modal
            document.getElementById('taskModal').remove();

            // Refresh the view
            await this.projectManager.refreshCurrentView();

            // Refresh collaboration dashboard if visible
            const activeTabBtn = document.querySelector('.tab-btn.active');
            if (activeTabBtn?.dataset?.tab === 'collaboration') {
                await this.renderCollaborationDashboard();
            }
        } catch (error) {
            console.error('Failed to create task:', error);
            alert('Failed to create task: ' + error.message);
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

        const agingDays = task.startDate ? Math.ceil((Date.now() - task.startDate) / (1000 * 60 * 60 * 24)) : 0;

        const details = `
Task: ${task.title}
Description: ${task.description || 'No description'}
Status: ${task.status}
Priority: ${task.priority}
Progress: ${task.progress}%

Creator: ${task.createdBy || 'Unknown'}
Owner: ${task.owner || 'Not assigned'}
Assigned to: ${task.assignedTo || 'Unassigned'}

Created: ${task.createdAt ? new Date(task.createdAt).toLocaleString() : 'Unknown'}
Start Date: ${task.startDate ? new Date(task.startDate).toLocaleDateString() : 'Not set'}
Due Date: ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'Not set'}
Aging: ${agingDays} days since start
        `;
        alert(details.trim());
    }

    async changeTaskStatus(taskId, newStatus) {
        if (!this.projectManager) return;

        try {
            await this.projectManager.moveTask(taskId, newStatus);
            console.log(`✓ Task status changed to: ${newStatus}`);

            // Refresh the view
            await this.projectManager.refreshCurrentView();
        } catch (error) {
            console.error('Failed to change task status:', error);
            if (typeof Notification !== 'undefined') {
                Notification.show('Failed to change status', 'error');
            }
        }
    }

    async showCriticalPath() {
        if (!this.projectManager || !this.projectManager.ganttView) {
            alert('Gantt view not available');
            return;
        }

        await this.projectManager.ganttView.highlightCriticalPath();
    }

    async addDatesToTasks() {
        if (!this.projectManager || !this.projectManager.currentProject) {
            alert('No project selected');
            return;
        }

        const tasks = await this.projectManager.getCurrentProjectTasks();
        const tasksWithoutDates = tasks.filter(t => !t.startDate || !t.dueDate);

        if (tasksWithoutDates.length === 0) {
            alert('All tasks already have dates');
            return;
        }

        const confirmed = confirm(`Add dates to ${tasksWithoutDates.length} task(s)? They will be scheduled starting today with 1-day duration.`);
        if (!confirmed) return;

        try {
            const today = Date.now();
            const oneDayMs = 24 * 60 * 60 * 1000;

            for (let i = 0; i < tasksWithoutDates.length; i++) {
                const task = tasksWithoutDates[i];
                const startDate = today + (i * oneDayMs);
                const dueDate = startDate + oneDayMs;

                await this.projectManager.updateTask(task.id, {
                    startDate,
                    dueDate
                });
            }

            if (typeof Notification !== 'undefined') {
                Notification.show(`Added dates to ${tasksWithoutDates.length} tasks`, 'success');
            }

            // Refresh the view
            await this.projectManager.refreshCurrentView();
        } catch (error) {
            console.error('Failed to add dates to tasks:', error);
            alert('Failed to add dates to tasks');
        }
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
