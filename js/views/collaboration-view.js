// Collaboration View
// Dedicated dashboard for managing collaboration activities across five aspects.

class CollaborationView {
    constructor(projectManager) {
        this.projectManager = projectManager;
        this.container = document.getElementById('collaborationDashboard');
        this.aspects = [
            { key: 'business', label: 'Business', icon: '💼' },
            { key: 'program', label: 'Program', icon: '🧭' },
            { key: 'docs-tools', label: 'Docs & Tools', icon: '📄' },
            { key: 'design-dev', label: 'Design & Dev', icon: '🛠️' },
            { key: 'logistics', label: 'Logistics', icon: '🚚' }
        ];
        this.statuses = [
            { key: 'todo', label: 'To Do' },
            { key: 'in-progress', label: 'In Progress' },
            { key: 'blocked', label: 'Blocked' },
            { key: 'done', label: 'Done' }
        ];
    }

    async render() {
        if (!this.container) return;

        if (!this.projectManager?.currentProject) {
            this.container.innerHTML = `
                <div class="empty-state">
                    <p class="icon">🤝</p>
                    <p>Select a project to view collaboration activities</p>
                    <p class="hint">Use the project selector above to choose your collaboration project</p>
                </div>
            `;
            return;
        }

        const tasks = await this.projectManager.getCurrentProjectTasks();
        const tasksByAspect = this.groupByAspect(tasks);

        const grid = this.aspects.map(a => this.renderAspectCard(a, tasksByAspect[a.key] || [])).join('');

        this.container.innerHTML = `
            <div class="aspect-grid">
                ${grid}
            </div>
        `;
    }

    groupByAspect(tasks) {
        const result = {};
        tasks.forEach(t => {
            const key = (t.aspect || '').toLowerCase().trim() || 'program';
            if (!result[key]) result[key] = [];
            result[key].push(t);
        });
        return result;
    }

    renderAspectCard(aspect, tasks) {
        const open = tasks.filter(t => t.status !== 'done');
        const overdue = open.filter(t => this.isOverdue(t.dueDate));

        const byStatus = {};
        this.statuses.forEach(s => { byStatus[s.key] = []; });
        tasks.forEach(t => {
            const st = t.status || 'todo';
            if (!byStatus[st]) byStatus.todo.push(t);
            else byStatus[st].push(t);
        });

        const miniColumns = this.statuses.map(s => this.renderMiniColumn(s, byStatus[s.key] || [])).join('');

        return `
            <div class="aspect-card" data-aspect="${aspect.key}">
                <div class="aspect-card-header">
                    <div class="aspect-name">${aspect.icon} ${aspect.label}</div>
                    <div class="aspect-stats">
                        <span title="Open">${open.length} open</span>
                        <span title="Overdue">${overdue.length} overdue</span>
                    </div>
                </div>
                <div class="aspect-body">
                    <div class="mini-columns">
                        ${miniColumns}
                    </div>
                </div>
            </div>
        `;
    }

    renderMiniColumn(status, tasks) {
        // Show up to 3 newest by updatedAt/createdAt/startDate
        const sorted = [...tasks].sort((a, b) => (this.getSortTs(b) - this.getSortTs(a)));
        const top = sorted.slice(0, 3);
        const items = top.map(t => this.renderMiniItem(t)).join('');
        const empty = `<div class="mini-empty">No items</div>`;

        return `
            <div class="mini-col" data-status="${status.key}">
                <div class="mini-col-title">
                    <span>${status.label}</span>
                    <span>${tasks.length}</span>
                </div>
                ${items || empty}
            </div>
        `;
    }

    renderMiniItem(task) {
        const due = task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '';
        const overdue = this.isOverdue(task.dueDate);
        const owner = task.owner || task.createdBy || '';
        const assigned = task.assignedTo || '';

        const duePill = due ? `<span class="pill ${overdue ? 'overdue' : ''}" title="Due date">📅 ${this.escapeHtml(due)}</span>` : '';
        const ownerPill = owner ? `<span class="pill" title="Owner">👑 ${this.escapeHtml(this.shortName(owner))}</span>` : '';
        const assignedPill = assigned ? `<span class="pill" title="Assignee">👤 ${this.escapeHtml(this.shortName(assigned))}</span>` : '';

        return `
            <div class="mini-item" title="${this.escapeHtml(task.title)}">
                <div class="mini-title">${this.escapeHtml(task.title)}</div>
                <div class="mini-meta">
                    ${duePill}
                    ${ownerPill}
                    ${assignedPill}
                </div>
            </div>
        `;
    }

    getSortTs(task) {
        return task.updatedAt || task.createdAt || task.startDate || 0;
    }

    isOverdue(dueDate) {
        if (!dueDate) return false;
        return Number(dueDate) < Date.now();
    }

    shortName(email) {
        if (!email) return '';
        const e = String(email);
        const name = e.split('@')[0] || e;
        return name.length > 16 ? name.slice(0, 16) + '…' : name;
    }

    escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}

