// Project Management Controller
// Main controller for project management features including projects, tasks, and timeline views

class ProjectManager {
    constructor(database) {
        this.db = database;
        this.currentProject = null;
        this.currentView = 'kanban'; // Default view: kanban, gantt, list
        this.taskHandler = null;
        this.dependencyManager = null;
        this.materialTracker = null;

        // View instances (will be initialized when views are loaded)
        this.kanbanView = null;
        this.ganttView = null;
        this.listView = null;
    }

    // ============================================================
    // Initialization
    // ============================================================

    async init() {
        try {
            // Initialize dependent managers
            if (typeof TaskHandler !== 'undefined') {
                this.taskHandler = new TaskHandler(this.db);
            }
            if (typeof DependencyManager !== 'undefined') {
                this.dependencyManager = new DependencyManager(this.db);
            }
            if (typeof MaterialTracker !== 'undefined') {
                this.materialTracker = new MaterialTracker(this.db);
            }

            // Initialize views
            if (typeof KanbanView !== 'undefined') {
                this.kanbanView = new KanbanView(this);
                console.log('✓ KanbanView initialized');
            }
            if (typeof GanttView !== 'undefined') {
                this.ganttView = new GanttView(this);
                console.log('✓ GanttView initialized');
            }

            console.log('✓ ProjectManager initialized');
        } catch (error) {
            console.error('Failed to initialize ProjectManager:', error);
            throw error;
        }
    }

    // ============================================================
    // Project Management
    // ============================================================

    async createProject(projectData) {
        try {
            // Validate required fields
            if (!projectData.name) {
                throw new Error('Project name is required');
            }

            // Get current user from auth manager
            const currentUser = window.authManager?.currentUser?.email || 'unknown';

            const project = {
                name: projectData.name,
                description: projectData.description || '',
                status: projectData.status || 'active',
                createdBy: currentUser,
                ...projectData
            };

            const projectId = await this.db.addProject(project);
            console.log('✓ Project created:', projectId);

            // Set as current project
            this.currentProject = { ...project, id: projectId };

            // Notify success
            if (typeof Notification !== 'undefined') {
                Notification.show(`Project "${project.name}" created successfully`, 'success');
            }

            return projectId;
        } catch (error) {
            console.error('Failed to create project:', error);
            if (typeof Notification !== 'undefined') {
                Notification.show('Failed to create project: ' + error.message, 'error');
            }
            throw error;
        }
    }

    async updateProject(projectId, updates) {
        try {
            await this.db.updateProject(projectId, updates);
            console.log('✓ Project updated:', projectId);

            // Update current project if it's the one being updated
            if (this.currentProject && this.currentProject.id === projectId) {
                this.currentProject = { ...this.currentProject, ...updates };
            }

            if (typeof Notification !== 'undefined') {
                Notification.show('Project updated successfully', 'success');
            }
        } catch (error) {
            console.error('Failed to update project:', error);
            if (typeof Notification !== 'undefined') {
                Notification.show('Failed to update project: ' + error.message, 'error');
            }
            throw error;
        }
    }

    async deleteProject(projectId) {
        try {
            // Get all tasks for this project
            const tasks = await this.db.getTasksByProject(projectId);

            // Warn if project has tasks
            if (tasks.length > 0) {
                const confirmed = confirm(
                    `This project has ${tasks.length} task(s). Deleting the project will also delete all associated tasks, materials, and milestones. Continue?`
                );
                if (!confirmed) {
                    return false;
                }

                // Delete all tasks and their associated data
                for (const task of tasks) {
                    await this.deleteTask(task.id, true); // Skip confirmation
                }
            }

            // Delete milestones
            const milestones = await this.db.getMilestonesByProject(projectId);
            for (const milestone of milestones) {
                await this.db.deleteMilestone(milestone.id);
            }

            // Delete the project
            await this.db.deleteProject(projectId);
            console.log('✓ Project deleted:', projectId);

            // Clear current project if it's the one being deleted
            if (this.currentProject && this.currentProject.id === projectId) {
                this.currentProject = null;
            }

            if (typeof Notification !== 'undefined') {
                Notification.show('Project deleted successfully', 'success');
            }

            return true;
        } catch (error) {
            console.error('Failed to delete project:', error);
            if (typeof Notification !== 'undefined') {
                Notification.show('Failed to delete project: ' + error.message, 'error');
            }
            throw error;
        }
    }

    async getProject(projectId) {
        return await this.db.getProject(projectId);
    }

    async getAllProjects() {
        return await this.db.getAllProjects();
    }

    async setCurrentProject(projectId) {
        try {
            const project = await this.db.getProject(projectId);
            if (project) {
                this.currentProject = project;
                console.log('✓ Current project set:', project.name);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Failed to set current project:', error);
            throw error;
        }
    }

    // ============================================================
    // Task Management
    // ============================================================

    async createTask(taskData) {
        try {
            if (!this.currentProject) {
                throw new Error('No project selected. Please select a project first.');
            }

            // Validate dependencies if provided
            if (taskData.dependencies && taskData.dependencies.length > 0) {
                if (this.dependencyManager) {
                    const validation = await this.dependencyManager.validateDependencies(
                        null, // New task, no ID yet
                        taskData.dependencies
                    );
                    if (!validation.valid) {
                        throw new Error(validation.error);
                    }
                }
            }

            // Get current user
            const currentUser = window.authManager?.currentUser?.email || 'unknown';

            const task = {
                projectId: this.currentProject.id,
                title: taskData.title,
                description: taskData.description || '',
                status: taskData.status || 'todo',
                priority: taskData.priority || 'medium',
                assignedTo: taskData.assignedTo || '',
                createdBy: currentUser,
                dueDate: taskData.dueDate || null,
                startDate: taskData.startDate || null,
                dependencies: taskData.dependencies || [],
                ...taskData
            };

            const taskId = await this.db.addTask(task);
            console.log('✓ Task created:', taskId);

            if (typeof Notification !== 'undefined') {
                Notification.show(`Task "${task.title}" created successfully`, 'success');
            }

            // Refresh current view
            await this.refreshCurrentView();

            return taskId;
        } catch (error) {
            console.error('Failed to create task:', error);
            if (typeof Notification !== 'undefined') {
                Notification.show('Failed to create task: ' + error.message, 'error');
            }
            throw error;
        }
    }

    async updateTask(taskId, updates) {
        try {
            // Validate dependencies if being updated
            if (updates.dependencies) {
                if (this.dependencyManager) {
                    const validation = await this.dependencyManager.validateDependencies(
                        taskId,
                        updates.dependencies
                    );
                    if (!validation.valid) {
                        throw new Error(validation.error);
                    }
                }
            }

            await this.db.updateTask(taskId, updates);
            console.log('✓ Task updated:', taskId);

            if (typeof Notification !== 'undefined') {
                Notification.show('Task updated successfully', 'success');
            }

            // Refresh current view
            await this.refreshCurrentView();
        } catch (error) {
            console.error('Failed to update task:', error);
            if (typeof Notification !== 'undefined') {
                Notification.show('Failed to update task: ' + error.message, 'error');
            }
            throw error;
        }
    }

    async moveTask(taskId, newStatus) {
        try {
            await this.updateTask(taskId, { status: newStatus });
            console.log('✓ Task moved to:', newStatus);
        } catch (error) {
            console.error('Failed to move task:', error);
            throw error;
        }
    }

    async assignTask(taskId, assignedTo) {
        try {
            await this.updateTask(taskId, { assignedTo });
            console.log('✓ Task assigned to:', assignedTo);
        } catch (error) {
            console.error('Failed to assign task:', error);
            throw error;
        }
    }

    async deleteTask(taskId, skipConfirmation = false) {
        try {
            if (!skipConfirmation) {
                const confirmed = confirm('Are you sure you want to delete this task?');
                if (!confirmed) {
                    return false;
                }
            }

            // Delete associated materials
            const materials = await this.db.getMaterialsByTask(taskId);
            for (const material of materials) {
                await this.db.deleteMaterial(material.id);
            }

            // Delete the task
            await this.db.deleteTask(taskId);
            console.log('✓ Task deleted:', taskId);

            if (typeof Notification !== 'undefined') {
                Notification.show('Task deleted successfully', 'success');
            }

            // Refresh current view
            await this.refreshCurrentView();

            return true;
        } catch (error) {
            console.error('Failed to delete task:', error);
            if (typeof Notification !== 'undefined') {
                Notification.show('Failed to delete task: ' + error.message, 'error');
            }
            throw error;
        }
    }

    async getTasksByProject(projectId) {
        return await this.db.getTasksByProject(projectId);
    }

    async getCurrentProjectTasks() {
        if (!this.currentProject) {
            return [];
        }
        return await this.db.getTasksByProject(this.currentProject.id);
    }

    // ============================================================
    // Material Management
    // ============================================================

    async addMaterialToTask(taskId, materialData) {
        try {
            if (this.materialTracker) {
                return await this.materialTracker.addMaterial(taskId, materialData);
            } else {
                // Fallback if MaterialTracker not loaded
                const currentUser = window.authManager?.currentUser?.email || 'unknown';
                const material = {
                    taskId,
                    createdBy: currentUser,
                    ...materialData
                };
                const materialId = await this.db.addMaterial(material);
                console.log('✓ Material added:', materialId);
                return materialId;
            }
        } catch (error) {
            console.error('Failed to add material:', error);
            throw error;
        }
    }

    async updateMaterialStatus(materialId, status) {
        try {
            if (this.materialTracker) {
                return await this.materialTracker.updateMaterialStatus(materialId, status);
            } else {
                // Fallback
                await this.db.updateMaterial(materialId, { status });
                console.log('✓ Material status updated:', status);
            }
        } catch (error) {
            console.error('Failed to update material status:', error);
            throw error;
        }
    }

    // ============================================================
    // View Management
    // ============================================================

    async switchView(viewType) {
        try {
            if (!['kanban', 'gantt', 'list'].includes(viewType)) {
                throw new Error('Invalid view type. Must be: kanban, gantt, or list');
            }

            this.currentView = viewType;
            console.log('✓ Switched to view:', viewType);

            // Render the selected view
            await this.refreshCurrentView();
        } catch (error) {
            console.error('Failed to switch view:', error);
            throw error;
        }
    }

    async refreshCurrentView() {
        if (!this.currentProject) {
            console.warn('No current project selected');
            return;
        }

        try {
            const tasks = await this.getCurrentProjectTasks();

            switch (this.currentView) {
                case 'kanban':
                    if (this.kanbanView) {
                        await this.kanbanView.render(tasks);
                    }
                    break;
                case 'gantt':
                    if (this.ganttView) {
                        const milestones = await this.db.getMilestonesByProject(this.currentProject.id);
                        await this.ganttView.render(tasks, milestones);
                    }
                    break;
                case 'list':
                    if (this.listView) {
                        await this.listView.render(tasks);
                    }
                    break;
            }
        } catch (error) {
            console.error('Failed to refresh view:', error);
        }
    }

    // ============================================================
    // Timeline & Analytics
    // ============================================================

    async getProjectTimeline() {
        if (!this.currentProject) {
            return null;
        }

        try {
            const tasks = await this.getCurrentProjectTasks();
            const milestones = await this.db.getMilestonesByProject(this.currentProject.id);

            // Calculate timeline metrics
            const timeline = {
                projectId: this.currentProject.id,
                projectName: this.currentProject.name,
                totalTasks: tasks.length,
                completedTasks: tasks.filter(t => t.status === 'done').length,
                inProgressTasks: tasks.filter(t => t.status === 'in-progress').length,
                blockedTasks: tasks.filter(t => t.status === 'blocked').length,
                todoTasks: tasks.filter(t => t.status === 'todo').length,
                totalMilestones: milestones.length,
                completedMilestones: milestones.filter(m => m.status === 'completed').length,
                tasks,
                milestones
            };

            // Calculate earliest start and latest end dates
            const taskDates = tasks
                .filter(t => t.startDate || t.dueDate)
                .flatMap(t => [t.startDate, t.dueDate].filter(Boolean));

            if (taskDates.length > 0) {
                timeline.startDate = Math.min(...taskDates);
                timeline.endDate = Math.max(...taskDates);
            }

            return timeline;
        } catch (error) {
            console.error('Failed to get project timeline:', error);
            throw error;
        }
    }

    async getCriticalPath() {
        if (!this.currentProject) {
            return null;
        }

        try {
            if (this.dependencyManager) {
                const tasks = await this.getCurrentProjectTasks();
                return await this.dependencyManager.calculateCriticalPath(tasks);
            } else {
                console.warn('DependencyManager not available for critical path calculation');
                return null;
            }
        } catch (error) {
            console.error('Failed to calculate critical path:', error);
            throw error;
        }
    }

    // ============================================================
    // Utility Methods
    // ============================================================

    async getProjectStats() {
        if (!this.currentProject) {
            return null;
        }

        try {
            const tasks = await this.getCurrentProjectTasks();
            const materials = [];

            // Get materials for all tasks
            for (const task of tasks) {
                const taskMaterials = await this.db.getMaterialsByTask(task.id);
                materials.push(...taskMaterials);
            }

            return {
                projectId: this.currentProject.id,
                projectName: this.currentProject.name,
                totalTasks: tasks.length,
                completedTasks: tasks.filter(t => t.status === 'done').length,
                inProgressTasks: tasks.filter(t => t.status === 'in-progress').length,
                blockedTasks: tasks.filter(t => t.status === 'blocked').length,
                totalMaterials: materials.length,
                receivedMaterials: materials.filter(m => m.status === 'received').length,
                pendingMaterials: materials.filter(m => m.status === 'pending').length,
                delayedMaterials: materials.filter(m => m.status === 'delayed').length,
                overallProgress: tasks.length > 0
                    ? Math.round((tasks.filter(t => t.status === 'done').length / tasks.length) * 100)
                    : 0
            };
        } catch (error) {
            console.error('Failed to get project stats:', error);
            throw error;
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProjectManager;
}
