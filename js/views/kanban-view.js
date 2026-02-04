// Kanban View
// Visual drag-and-drop board for task management with columns for each status

class KanbanView {
    constructor(projectManager) {
        this.projectManager = projectManager;
        this.container = document.getElementById('taskViewContainer');
        this.currentTasks = [];
        this.draggedTask = null;
    }

    // ============================================================
    // Render Methods
    // ============================================================

    async render(tasks) {
        if (!this.container) {
            console.error('Kanban container not found');
            return;
        }

        this.currentTasks = tasks || [];

        if (tasks.length === 0) {
            this.renderEmptyState();
            return;
        }

        // Group tasks by status
        const tasksByStatus = this.groupTasksByStatus(tasks);

        // Build Kanban board HTML
        const kanbanHTML = `
            <div class="kanban-board">
                ${this.renderColumn('todo', 'To Do', tasksByStatus.todo || [])}
                ${this.renderColumn('in-progress', 'In Progress', tasksByStatus['in-progress'] || [])}
                ${this.renderColumn('blocked', 'Blocked', tasksByStatus.blocked || [])}
                ${this.renderColumn('done', 'Done', tasksByStatus.done || [])}
            </div>
        `;

        this.container.innerHTML = kanbanHTML;

        // Set up drag-and-drop
        this.setupDragAndDrop();
    }

    renderEmptyState() {
        this.container.innerHTML = `
            <div class="empty-state">
                <p class="icon">🎯</p>
                <p>No tasks in this project</p>
                <p class="hint">Create your first task to get started</p>
            </div>
        `;
    }

    groupTasksByStatus(tasks) {
        const grouped = {
            'todo': [],
            'in-progress': [],
            'blocked': [],
            'done': []
        };

        tasks.forEach(task => {
            const status = task.status || 'todo';
            if (grouped[status]) {
                grouped[status].push(task);
            } else {
                grouped['todo'].push(task);
            }
        });

        return grouped;
    }

    renderColumn(status, title, tasks) {
        const taskCards = tasks.map(task => this.renderTaskCard(task)).join('');
        const taskCount = tasks.length;
        const columnClass = `kanban-column status-${status}`;

        return `
            <div class="${columnClass}" data-status="${status}">
                <div class="column-header">
                    <h3 class="column-title">
                        ${this.getStatusIcon(status)} ${title}
                        <span class="task-count">${taskCount}</span>
                    </h3>
                </div>
                <div class="column-content" data-status="${status}">
                    ${taskCards || '<div class="column-empty">Drop tasks here</div>'}
                </div>
            </div>
        `;
    }

    renderTaskCard(task) {
        const priorityClass = `priority-${task.priority || 'medium'}`;
        const priorityIcon = this.getPriorityIcon(task.priority);

        const aspectBadge = task.aspect ?
            `<span class="task-badge" title="Aspect: ${this.escapeHtml(task.aspect)}">
                <span class="icon">🤝</span> ${this.escapeHtml(task.aspect)}
            </span>` : '';

        // Creator and Owner info - owner defaults to creator if not set
        const effectiveOwner = task.owner || task.createdBy;

        const creatorDisplay = task.createdBy ?
            `<div class="task-meta-item" title="Created by: ${task.createdBy}">
                <span class="meta-label">Creator:</span> ${this.getShortName(task.createdBy)}
            </div>` : '';

        const ownerDisplay = effectiveOwner ?
            `<div class="task-meta-item task-owner" title="Owner: ${effectiveOwner}">
                <span class="meta-label">Owner:</span> ${this.getShortName(effectiveOwner)}
            </div>` : '';

        const assigneeDisplay = task.assignedTo ?
            `<div class="task-assignee" title="Assigned to: ${task.assignedTo}">
                <span class="icon">👤</span> ${this.getShortName(task.assignedTo)}
            </div>` : '';

        // Date displays - use createdAt as fallback for startDate
        const effectiveStartDate = task.startDate || task.createdAt;

        const createdDateDisplay = task.createdAt ?
            `<div class="task-meta-item" title="Created: ${this.formatFullDate(task.createdAt)}">
                <span class="meta-label">Created:</span> ${this.formatDate(task.createdAt)}
            </div>` : '';

        const startDateDisplay = effectiveStartDate ?
            `<div class="task-meta-item" title="Start: ${this.formatFullDate(effectiveStartDate)}">
                <span class="meta-label">Start:</span> ${this.formatDate(effectiveStartDate)}
            </div>` : '';

        const dueDateDisplay = task.dueDate ?
            `<div class="task-due-date ${this.isDueOverdue(task.dueDate) ? 'overdue' : ''}">
                <span class="icon">📅</span> ${this.formatDate(task.dueDate)}
            </div>` : '';

        // Aging days calculation - use createdAt as fallback
        const agingDays = this.calculateAgingDays(effectiveStartDate);
        const agingDisplay = effectiveStartDate && task.status !== 'done' ?
            `<div class="task-aging ${this.getAgingClass(agingDays)}" title="Days since start">
                <span class="icon">⏱️</span> ${agingDays}d
            </div>` : '';

        const progressBar = task.progress > 0 ?
            `<div class="task-progress-bar">
                <div class="progress-fill" style="width: ${task.progress}%"></div>
            </div>` : '';

        const dependencyBadge = (task.dependencies && task.dependencies.length > 0) ?
            `<span class="task-badge" title="${task.dependencies.length} dependencies">
                <span class="icon">🔗</span> ${task.dependencies.length}
            </span>` : '';

        // Status change buttons
        const statusButtons = this.renderStatusButtons(task);

        return `
            <div class="task-card ${priorityClass}"
                 draggable="true"
                 data-task-id="${task.id}"
                 data-status="${task.status}">
                <div class="task-card-header">
                    <div class="task-priority">${priorityIcon}</div>
                    <button class="task-menu-btn" onclick="window.xteamApp.showTaskMenu('${task.id}')" title="Task options">⋮</button>
                </div>
                <div class="task-card-title">${this.escapeHtml(task.title)}</div>
                ${task.description ? `<div class="task-card-description">${this.escapeHtml(task.description)}</div>` : ''}

                <div class="task-meta-section">
                    ${creatorDisplay}
                    ${ownerDisplay}
                    ${createdDateDisplay}
                    ${startDateDisplay}
                </div>

                ${progressBar}

                <div class="task-card-footer">
                    ${assigneeDisplay}
                    ${dueDateDisplay}
                    ${agingDisplay}
                    ${aspectBadge}
                    ${dependencyBadge}
                </div>

                ${statusButtons}
            </div>
        `;
    }

    renderStatusButtons(task) {
        const statuses = [
            { key: 'todo', label: 'To Do', icon: '📝', color: '#6b7280' },
            { key: 'in-progress', label: 'In Progress', icon: '🔄', color: '#3b82f6' },
            { key: 'blocked', label: 'Blocked', icon: '🚫', color: '#ef4444' },
            { key: 'done', label: 'Done', icon: '✅', color: '#10b981' }
        ];

        const buttons = statuses.map(s => {
            const isActive = task.status === s.key;
            return `<button
                class="status-btn ${isActive ? 'active' : ''}"
                data-status="${s.key}"
                onclick="window.xteamApp.changeTaskStatus('${task.id}', '${s.key}')"
                title="${s.label}"
                style="--status-color: ${s.color}">
                ${s.icon}
            </button>`;
        }).join('');

        return `<div class="task-status-buttons">${buttons}</div>`;
    }

    calculateAgingDays(startDate) {
        if (!startDate) return 0;
        const start = new Date(startDate);
        const now = new Date();
        const diffTime = Math.abs(now - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    }

    getAgingClass(days) {
        if (days <= 3) return 'aging-ok';
        if (days <= 7) return 'aging-warning';
        return 'aging-critical';
    }

    formatFullDate(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        return date.toLocaleString();
    }

    // ============================================================
    // Drag and Drop Setup
    // ============================================================

    setupDragAndDrop() {
        // Task cards (draggable)
        const taskCards = this.container.querySelectorAll('.task-card');
        taskCards.forEach(card => {
            card.addEventListener('dragstart', (e) => this.handleDragStart(e));
            card.addEventListener('dragend', (e) => this.handleDragEnd(e));
        });

        // Column content (drop zones)
        const columns = this.container.querySelectorAll('.column-content');
        columns.forEach(column => {
            column.addEventListener('dragover', (e) => this.handleDragOver(e));
            column.addEventListener('drop', (e) => this.handleDrop(e));
            column.addEventListener('dragenter', (e) => this.handleDragEnter(e));
            column.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        });
    }

    handleDragStart(e) {
        const taskCard = e.target.closest('.task-card');
        if (!taskCard) return;

        this.draggedTask = {
            id: taskCard.dataset.taskId,
            status: taskCard.dataset.status,
            element: taskCard
        };

        taskCard.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', taskCard.innerHTML);
    }

    handleDragEnd(e) {
        const taskCard = e.target.closest('.task-card');
        if (taskCard) {
            taskCard.classList.remove('dragging');
        }

        // Remove drag-over classes from all columns
        const columns = this.container.querySelectorAll('.column-content');
        columns.forEach(col => col.classList.remove('drag-over'));

        this.draggedTask = null;
    }

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }

    handleDragEnter(e) {
        const column = e.target.closest('.column-content');
        if (column && this.draggedTask) {
            column.classList.add('drag-over');
        }
    }

    handleDragLeave(e) {
        const column = e.target.closest('.column-content');
        if (column && e.target === column) {
            column.classList.remove('drag-over');
        }
    }

    async handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();

        const column = e.target.closest('.column-content');
        if (!column || !this.draggedTask) return;

        const newStatus = column.dataset.status;
        const oldStatus = this.draggedTask.status;

        // Remove drag-over class
        column.classList.remove('drag-over');

        // Don't do anything if dropped in same column
        if (newStatus === oldStatus) {
            return;
        }

        // Update task status
        try {
            await this.updateTaskStatus(this.draggedTask.id, newStatus);
            console.log(`✓ Task moved from ${oldStatus} to ${newStatus}`);
        } catch (error) {
            console.error('Failed to update task status:', error);
            if (typeof Notification !== 'undefined') {
                Notification.show('Failed to move task', 'error');
            }
        }
    }

    async updateTaskStatus(taskId, newStatus) {
        if (!this.projectManager) return;

        await this.projectManager.moveTask(taskId, newStatus);

        // Refresh the view
        const tasks = await this.projectManager.getCurrentProjectTasks();
        await this.render(tasks);
    }

    // ============================================================
    // Helper Methods
    // ============================================================

    getStatusIcon(status) {
        const icons = {
            'todo': '📝',
            'in-progress': '🔄',
            'blocked': '🚫',
            'done': '✅'
        };
        return icons[status] || '📋';
    }

    getPriorityIcon(priority) {
        const icons = {
            'low': '🟢',
            'medium': '🟡',
            'high': '🟠',
            'urgent': '🔴'
        };
        return icons[priority] || '🟡';
    }

    getShortName(email) {
        if (!email) return 'Unassigned';
        const name = email.split('@')[0];
        return name.charAt(0).toUpperCase() + name.slice(1);
    }

    formatDate(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Check if today
        if (date.toDateString() === today.toDateString()) {
            return 'Today';
        }

        // Check if tomorrow
        if (date.toDateString() === tomorrow.toDateString()) {
            return 'Tomorrow';
        }

        // Format as MM/DD
        const month = date.getMonth() + 1;
        const day = date.getDate();
        return `${month}/${day}`;
    }

    isDueOverdue(dueDate) {
        if (!dueDate) return false;
        return dueDate < Date.now();
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ============================================================
    // Task Actions
    // ============================================================

    async showTaskDetails(taskId) {
        // To be implemented: show task details modal
        console.log('Show task details:', taskId);
    }

    async editTask(taskId) {
        // To be implemented: show edit task modal
        console.log('Edit task:', taskId);
    }

    async deleteTask(taskId) {
        if (!this.projectManager) return;

        const confirmed = confirm('Are you sure you want to delete this task?');
        if (!confirmed) return;

        try {
            await this.projectManager.deleteTask(taskId);
            console.log('✓ Task deleted:', taskId);

            // Refresh the view
            const tasks = await this.projectManager.getCurrentProjectTasks();
            await this.render(tasks);
        } catch (error) {
            console.error('Failed to delete task:', error);
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = KanbanView;
}
