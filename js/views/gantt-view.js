// Gantt View
// Timeline visualization with task dependencies and milestones

class GanttView {
    constructor(projectManager) {
        this.projectManager = projectManager;
        this.container = document.getElementById('taskViewContainer');
        this.ganttInstance = null;
        this.currentTasks = [];
        this.currentMilestones = [];
        this.viewMode = 'Day'; // Day, Week, Month
    }

    // ============================================================
    // Render Methods
    // ============================================================

    async render(tasks, milestones = []) {
        if (!this.container) {
            console.error('Gantt container not found');
            return;
        }

        this.currentTasks = tasks || [];
        this.currentMilestones = milestones || [];

        if (tasks.length === 0) {
            this.renderEmptyState();
            return;
        }

        // Check if tasks have dates
        const tasksWithDates = tasks.filter(t => t.startDate && t.dueDate);
        if (tasksWithDates.length === 0) {
            this.renderNoDatesMessage();
            return;
        }

        // Build Gantt container
        const ganttHTML = `
            <div class="gantt-controls">
                <div class="gantt-view-modes">
                    <button class="gantt-mode-btn ${this.viewMode === 'Day' ? 'active' : ''}" data-mode="Day">Day</button>
                    <button class="gantt-mode-btn ${this.viewMode === 'Week' ? 'active' : ''}" data-mode="Week">Week</button>
                    <button class="gantt-mode-btn ${this.viewMode === 'Month' ? 'active' : ''}" data-mode="Month">Month</button>
                </div>
                <div class="gantt-actions">
                    <button class="btn btn-sm" onclick="window.xteamApp.showCriticalPath()">
                        <span class="icon">⚡</span> Critical Path
                    </button>
                </div>
            </div>
            <div class="gantt-chart-container">
                <svg id="ganttChart"></svg>
            </div>
            <div class="gantt-legend">
                <div class="legend-item">
                    <div class="legend-color" style="background: #3b82f6;"></div>
                    <span>Regular Task</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background: #ef4444;"></div>
                    <span>Critical Path</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background: #10b981;"></div>
                    <span>Milestone</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background: #6b7280;"></div>
                    <span>Completed</span>
                </div>
            </div>
        `;

        this.container.innerHTML = ganttHTML;

        // Set up view mode buttons
        this.setupViewModeButtons();

        // Initialize Frappe Gantt
        await this.initializeFrappeGantt(tasksWithDates, milestones);
    }

    renderEmptyState() {
        this.container.innerHTML = `
            <div class="empty-state">
                <p class="icon">📊</p>
                <p>No tasks in this project</p>
                <p class="hint">Create tasks to see the project timeline</p>
            </div>
        `;
    }

    renderNoDatesMessage() {
        this.container.innerHTML = `
            <div class="empty-state">
                <p class="icon">📅</p>
                <p>No tasks with dates</p>
                <p class="hint">Add start and due dates to tasks to see them on the timeline</p>
                <button class="btn btn-primary" onclick="window.xteamApp.addDatesToTasks()" style="margin-top: 15px;">
                    Add Dates to Tasks
                </button>
            </div>
        `;
    }

    // ============================================================
    // Frappe Gantt Integration
    // ============================================================

    async initializeFrappeGantt(tasks, milestones) {
        if (typeof Gantt === 'undefined') {
            console.error('Frappe Gantt library not loaded');
            this.container.innerHTML = `
                <div class="empty-state">
                    <p class="icon">⚠️</p>
                    <p>Gantt chart library not loaded</p>
                    <p class="hint">Please refresh the page</p>
                </div>
            `;
            return;
        }

        try {
            // Convert tasks to Gantt format
            const ganttTasks = this.convertToGanttFormat(tasks, milestones);

            // Create Gantt chart
            const chartElement = document.getElementById('ganttChart');
            if (!chartElement) {
                console.error('Gantt chart element not found');
                return;
            }

            // Clear any existing chart
            chartElement.innerHTML = '';

            // Initialize Gantt
            this.ganttInstance = new Gantt(chartElement, ganttTasks, {
                view_mode: this.viewMode,
                on_click: (task) => this.handleTaskClick(task),
                on_date_change: (task, start, end) => this.handleDateChange(task, start, end),
                on_progress_change: (task, progress) => this.handleProgressChange(task, progress),
                on_view_change: (mode) => {
                    this.viewMode = mode;
                },
                custom_popup_html: (task) => this.createTaskPopup(task)
            });

            console.log('✓ Gantt chart rendered with', ganttTasks.length, 'items');
        } catch (error) {
            console.error('Failed to initialize Gantt chart:', error);
            this.container.innerHTML = `
                <div class="empty-state">
                    <p class="icon">❌</p>
                    <p>Failed to render Gantt chart</p>
                    <p class="hint">${error.message}</p>
                </div>
            `;
        }
    }

    convertToGanttFormat(tasks, milestones) {
        const ganttTasks = [];

        // Add tasks
        tasks.forEach(task => {
            if (!task.startDate || !task.dueDate) return;

            const ganttTask = {
                id: task.id,
                name: task.title,
                start: this.formatDateForGantt(task.startDate),
                end: this.formatDateForGantt(task.dueDate),
                progress: task.progress || 0,
                dependencies: (task.dependencies || []).join(','),
                custom_class: this.getTaskClass(task)
            };

            ganttTasks.push(ganttTask);
        });

        // Add milestones
        milestones.forEach(milestone => {
            if (!milestone.targetDate) return;

            const ganttMilestone = {
                id: `milestone-${milestone.id}`,
                name: `◆ ${milestone.name}`,
                start: this.formatDateForGantt(milestone.targetDate),
                end: this.formatDateForGantt(milestone.targetDate),
                progress: milestone.status === 'completed' ? 100 : 0,
                custom_class: 'milestone'
            };

            ganttTasks.push(ganttMilestone);
        });

        return ganttTasks;
    }

    getTaskClass(task) {
        const classes = [];

        // Status-based classes
        if (task.status === 'done') {
            classes.push('task-done');
        } else if (task.status === 'blocked') {
            classes.push('task-blocked');
        } else if (task.status === 'in-progress') {
            classes.push('task-in-progress');
        }

        // Priority-based classes
        if (task.priority === 'urgent') {
            classes.push('task-urgent');
        } else if (task.priority === 'high') {
            classes.push('task-high');
        }

        // Overdue
        if (task.dueDate && task.dueDate < Date.now() && task.status !== 'done') {
            classes.push('task-overdue');
        }

        return classes.join(' ');
    }

    formatDateForGantt(timestamp) {
        if (!timestamp) return null;
        const date = new Date(timestamp);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    createTaskPopup(task) {
        const originalTask = this.currentTasks.find(t => t.id === task.id);
        if (!originalTask) {
            return `
                <div class="gantt-popup">
                    <h3>${task.name}</h3>
                    <p>Progress: ${task.progress}%</p>
                </div>
            `;
        }

        const assignee = originalTask.assignedTo || 'Unassigned';
        const priority = originalTask.priority || 'medium';
        const status = originalTask.status || 'todo';

        return `
            <div class="gantt-popup">
                <h3>${task.name}</h3>
                <div class="popup-details">
                    <p><strong>Status:</strong> ${this.formatStatus(status)}</p>
                    <p><strong>Priority:</strong> ${this.formatPriority(priority)}</p>
                    <p><strong>Assigned to:</strong> ${assignee}</p>
                    <p><strong>Progress:</strong> ${task.progress}%</p>
                    <p><strong>Duration:</strong> ${this.calculateDuration(originalTask.startDate, originalTask.dueDate)} days</p>
                </div>
            </div>
        `;
    }

    formatStatus(status) {
        const statusMap = {
            'todo': '📝 To Do',
            'in-progress': '🔄 In Progress',
            'blocked': '🚫 Blocked',
            'done': '✅ Done'
        };
        return statusMap[status] || status;
    }

    formatPriority(priority) {
        const priorityMap = {
            'low': '🟢 Low',
            'medium': '🟡 Medium',
            'high': '🟠 High',
            'urgent': '🔴 Urgent'
        };
        return priorityMap[priority] || priority;
    }

    calculateDuration(startDate, endDate) {
        if (!startDate || !endDate) return 0;
        const diff = endDate - startDate;
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    }

    // ============================================================
    // Event Handlers
    // ============================================================

    setupViewModeButtons() {
        const modeButtons = this.container.querySelectorAll('.gantt-mode-btn');
        modeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                this.changeViewMode(mode);
            });
        });
    }

    changeViewMode(mode) {
        this.viewMode = mode;

        // Update button states
        const modeButtons = this.container.querySelectorAll('.gantt-mode-btn');
        modeButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });

        // Update Gantt chart
        if (this.ganttInstance) {
            this.ganttInstance.change_view_mode(mode);
        }
    }

    async handleTaskClick(task) {
        console.log('Task clicked:', task);
        // Show task details
        if (window.xteamApp) {
            await window.xteamApp.viewTaskDetails(task.id);
        }
    }

    async handleDateChange(task, start, end) {
        console.log('Date changed:', task.id, start, end);

        try {
            await this.projectManager.updateTask(task.id, {
                startDate: new Date(start).getTime(),
                dueDate: new Date(end).getTime()
            });

            if (typeof Notification !== 'undefined') {
                Notification.show('Task dates updated', 'success');
            }
        } catch (error) {
            console.error('Failed to update task dates:', error);
            if (typeof Notification !== 'undefined') {
                Notification.show('Failed to update dates', 'error');
            }
        }
    }

    async handleProgressChange(task, progress) {
        console.log('Progress changed:', task.id, progress);

        try {
            await this.projectManager.updateTask(task.id, {
                progress: progress
            });

            if (typeof Notification !== 'undefined') {
                Notification.show('Task progress updated', 'success');
            }
        } catch (error) {
            console.error('Failed to update task progress:', error);
            if (typeof Notification !== 'undefined') {
                Notification.show('Failed to update progress', 'error');
            }
        }
    }

    // ============================================================
    // Critical Path
    // ============================================================

    async highlightCriticalPath() {
        if (!this.projectManager || !this.projectManager.dependencyManager) {
            console.warn('DependencyManager not available');
            return;
        }

        try {
            const criticalPath = await this.projectManager.getCriticalPath();

            if (!criticalPath || !criticalPath.tasks || criticalPath.tasks.length === 0) {
                if (typeof Notification !== 'undefined') {
                    Notification.show('No critical path found', 'info');
                }
                return;
            }

            // Highlight critical path tasks
            const criticalTaskIds = criticalPath.tasks.map(t => t.id);

            // Add critical-path class to Gantt bars
            if (this.ganttInstance) {
                // Frappe Gantt doesn't have a direct API for this
                // We'll need to add custom classes through CSS
                const ganttBars = this.container.querySelectorAll('.bar-wrapper');
                ganttBars.forEach(bar => {
                    const taskId = bar.getAttribute('data-id');
                    if (criticalTaskIds.includes(taskId)) {
                        bar.classList.add('critical-path');
                    } else {
                        bar.classList.remove('critical-path');
                    }
                });
            }

            if (typeof Notification !== 'undefined') {
                Notification.show(`Critical path: ${criticalPath.tasks.length} tasks, ${Math.round(criticalPath.duration)} days`, 'success');
            }

            console.log('✓ Critical path highlighted:', criticalPath);
        } catch (error) {
            console.error('Failed to highlight critical path:', error);
        }
    }

    // ============================================================
    // Utility Methods
    // ============================================================

    refresh() {
        if (this.ganttInstance) {
            this.ganttInstance.refresh(this.convertToGanttFormat(this.currentTasks, this.currentMilestones));
        }
    }

    destroy() {
        if (this.ganttInstance) {
            // Frappe Gantt doesn't have a destroy method, just clear the container
            this.ganttInstance = null;
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GanttView;
}
