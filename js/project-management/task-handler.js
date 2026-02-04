// Task Handler
// Handles task-specific operations including CRUD, status updates, and task relationships

class TaskHandler {
    constructor(database) {
        this.db = database;
    }

    // ============================================================
    // Task CRUD Operations
    // ============================================================

    async createTask(taskData) {
        try {
            // Validate required fields
            if (!taskData.projectId) {
                throw new Error('Project ID is required');
            }
            if (!taskData.title) {
                throw new Error('Task title is required');
            }

            // Get current user
            const currentUser = window.authManager?.currentUser?.email || 'unknown';

            const task = {
                projectId: taskData.projectId,
                title: taskData.title,
                description: taskData.description || '',
                status: taskData.status || 'todo',
                priority: taskData.priority || 'medium',
                createdBy: currentUser,
                owner: taskData.owner || currentUser, // Task owner - who must deliver the result
                assignedTo: taskData.assignedTo || '', // Current assignee working on it
                dueDate: taskData.dueDate || null, // Planned end date
                startDate: taskData.startDate || Date.now(), // Start date (default to now)
                completedDate: null,
                progress: taskData.progress || 0,
                estimatedHours: taskData.estimatedHours || 0,
                actualHours: taskData.actualHours || 0,
                dependencies: taskData.dependencies || [],
                materialIds: taskData.materialIds || [],
                linkedRecords: taskData.linkedRecords || [],
                comments: []
            };

            const taskId = await this.db.addTask(task);
            console.log('✓ Task created by TaskHandler:', taskId);

            if (typeof Notification !== 'undefined') {
                Notification.show(`Task "${task.title}" created`, 'success');
            }

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
            await this.db.updateTask(taskId, updates);
            console.log('✓ Task updated by TaskHandler:', taskId);

            if (typeof Notification !== 'undefined') {
                Notification.show('Task updated', 'success');
            }
        } catch (error) {
            console.error('Failed to update task:', error);
            if (typeof Notification !== 'undefined') {
                Notification.show('Failed to update task: ' + error.message, 'error');
            }
            throw error;
        }
    }

    async deleteTask(taskId) {
        try {
            const task = await this.db.getTask(taskId);
            if (!task) {
                throw new Error('Task not found');
            }

            // Delete associated materials
            const materials = await this.db.getMaterialsByTask(taskId);
            for (const material of materials) {
                await this.db.deleteMaterial(material.id);
            }

            await this.db.deleteTask(taskId);
            console.log('✓ Task deleted by TaskHandler:', taskId);

            if (typeof Notification !== 'undefined') {
                Notification.show('Task deleted', 'success');
            }
        } catch (error) {
            console.error('Failed to delete task:', error);
            if (typeof Notification !== 'undefined') {
                Notification.show('Failed to delete task: ' + error.message, 'error');
            }
            throw error;
        }
    }

    async getTask(taskId) {
        return await this.db.getTask(taskId);
    }

    // ============================================================
    // Status Management
    // ============================================================

    async updateStatus(taskId, newStatus) {
        try {
            const validStatuses = ['todo', 'in-progress', 'blocked', 'done'];
            if (!validStatuses.includes(newStatus)) {
                throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
            }

            const updates = { status: newStatus };

            // If marking as done, set completion date
            if (newStatus === 'done') {
                updates.completedDate = Date.now();
                updates.progress = 100;
            }

            // If moving from done to another status, clear completion date
            const task = await this.db.getTask(taskId);
            if (task && task.status === 'done' && newStatus !== 'done') {
                updates.completedDate = null;
            }

            await this.db.updateTask(taskId, updates);
            console.log('✓ Task status updated:', newStatus);

            if (typeof Notification !== 'undefined') {
                Notification.show(`Task moved to ${newStatus}`, 'success');
            }
        } catch (error) {
            console.error('Failed to update task status:', error);
            if (typeof Notification !== 'undefined') {
                Notification.show('Failed to update status: ' + error.message, 'error');
            }
            throw error;
        }
    }

    async updateProgress(taskId, progress) {
        try {
            if (progress < 0 || progress > 100) {
                throw new Error('Progress must be between 0 and 100');
            }

            const updates = { progress };

            // Auto-update status based on progress
            if (progress === 0) {
                updates.status = 'todo';
            } else if (progress === 100) {
                updates.status = 'done';
                updates.completedDate = Date.now();
            } else if (progress > 0 && progress < 100) {
                const task = await this.db.getTask(taskId);
                if (task && task.status === 'todo') {
                    updates.status = 'in-progress';
                }
            }

            await this.db.updateTask(taskId, updates);
            console.log('✓ Task progress updated:', progress);
        } catch (error) {
            console.error('Failed to update task progress:', error);
            throw error;
        }
    }

    // ============================================================
    // Dependency Management
    // ============================================================

    async addDependency(taskId, dependencyTaskId) {
        try {
            const task = await this.db.getTask(taskId);
            if (!task) {
                throw new Error('Task not found');
            }

            const dependencies = task.dependencies || [];

            // Check if dependency already exists
            if (dependencies.includes(dependencyTaskId)) {
                throw new Error('This dependency already exists');
            }

            // Add the dependency
            dependencies.push(dependencyTaskId);

            // Validate for circular dependencies
            const validation = await this.db.validateTaskDependencies(taskId, dependencies);
            if (!validation.valid) {
                throw new Error(validation.error);
            }

            await this.db.updateTask(taskId, { dependencies });
            console.log('✓ Dependency added:', dependencyTaskId);

            if (typeof Notification !== 'undefined') {
                Notification.show('Dependency added', 'success');
            }
        } catch (error) {
            console.error('Failed to add dependency:', error);
            if (typeof Notification !== 'undefined') {
                Notification.show('Failed to add dependency: ' + error.message, 'error');
            }
            throw error;
        }
    }

    async removeDependency(taskId, dependencyTaskId) {
        try {
            const task = await this.db.getTask(taskId);
            if (!task) {
                throw new Error('Task not found');
            }

            const dependencies = (task.dependencies || []).filter(id => id !== dependencyTaskId);
            await this.db.updateTask(taskId, { dependencies });

            console.log('✓ Dependency removed:', dependencyTaskId);

            if (typeof Notification !== 'undefined') {
                Notification.show('Dependency removed', 'success');
            }
        } catch (error) {
            console.error('Failed to remove dependency:', error);
            if (typeof Notification !== 'undefined') {
                Notification.show('Failed to remove dependency: ' + error.message, 'error');
            }
            throw error;
        }
    }

    async validateDependencies(taskId, dependencies) {
        return await this.db.validateTaskDependencies(taskId, dependencies);
    }

    async detectCircularDependencies(taskId, newDependencies) {
        const validation = await this.db.validateTaskDependencies(taskId, newDependencies);
        return !validation.valid;
    }

    // ============================================================
    // Comments
    // ============================================================

    async addComment(taskId, commentText) {
        try {
            const task = await this.db.getTask(taskId);
            if (!task) {
                throw new Error('Task not found');
            }

            const currentUser = window.authManager?.currentUser?.email || 'unknown';
            const comments = task.comments || [];

            const newComment = {
                userId: currentUser,
                text: commentText,
                timestamp: Date.now()
            };

            comments.push(newComment);
            await this.db.updateTask(taskId, { comments });

            console.log('✓ Comment added to task:', taskId);
        } catch (error) {
            console.error('Failed to add comment:', error);
            throw error;
        }
    }

    async getComments(taskId) {
        try {
            const task = await this.db.getTask(taskId);
            return task ? (task.comments || []) : [];
        } catch (error) {
            console.error('Failed to get comments:', error);
            throw error;
        }
    }

    // ============================================================
    // Assignment & Tracking
    // ============================================================

    async assignTask(taskId, assignedTo) {
        try {
            await this.db.updateTask(taskId, { assignedTo });
            console.log('✓ Task assigned to:', assignedTo);

            if (typeof Notification !== 'undefined') {
                Notification.show(`Task assigned to ${assignedTo}`, 'success');
            }
        } catch (error) {
            console.error('Failed to assign task:', error);
            throw error;
        }
    }

    async updateEstimatedHours(taskId, hours) {
        try {
            await this.db.updateTask(taskId, { estimatedHours: hours });
            console.log('✓ Estimated hours updated:', hours);
        } catch (error) {
            console.error('Failed to update estimated hours:', error);
            throw error;
        }
    }

    async updateActualHours(taskId, hours) {
        try {
            await this.db.updateTask(taskId, { actualHours: hours });
            console.log('✓ Actual hours updated:', hours);
        } catch (error) {
            console.error('Failed to update actual hours:', error);
            throw error;
        }
    }

    async updateDates(taskId, startDate, dueDate) {
        try {
            const updates = {};
            if (startDate !== undefined) {
                updates.startDate = startDate;
            }
            if (dueDate !== undefined) {
                updates.dueDate = dueDate;
            }

            await this.db.updateTask(taskId, updates);
            console.log('✓ Task dates updated');
        } catch (error) {
            console.error('Failed to update task dates:', error);
            throw error;
        }
    }

    // ============================================================
    // Linking & Relationships
    // ============================================================

    async linkRecord(taskId, recordId) {
        try {
            const task = await this.db.getTask(taskId);
            if (!task) {
                throw new Error('Task not found');
            }

            const linkedRecords = task.linkedRecords || [];
            if (!linkedRecords.includes(recordId)) {
                linkedRecords.push(recordId);
                await this.db.updateTask(taskId, { linkedRecords });
                console.log('✓ Record linked to task:', recordId);
            }
        } catch (error) {
            console.error('Failed to link record:', error);
            throw error;
        }
    }

    async unlinkRecord(taskId, recordId) {
        try {
            const task = await this.db.getTask(taskId);
            if (!task) {
                throw new Error('Task not found');
            }

            const linkedRecords = (task.linkedRecords || []).filter(id => id !== recordId);
            await this.db.updateTask(taskId, { linkedRecords });
            console.log('✓ Record unlinked from task:', recordId);
        } catch (error) {
            console.error('Failed to unlink record:', error);
            throw error;
        }
    }

    async linkMaterial(taskId, materialId) {
        try {
            const task = await this.db.getTask(taskId);
            if (!task) {
                throw new Error('Task not found');
            }

            const materialIds = task.materialIds || [];
            if (!materialIds.includes(materialId)) {
                materialIds.push(materialId);
                await this.db.updateTask(taskId, { materialIds });
                console.log('✓ Material linked to task:', materialId);
            }
        } catch (error) {
            console.error('Failed to link material:', error);
            throw error;
        }
    }

    // ============================================================
    // Filtering & Search
    // ============================================================

    async getTasksByStatus(projectId, status) {
        try {
            const tasks = await this.db.getTasksByProject(projectId);
            return tasks.filter(task => task.status === status);
        } catch (error) {
            console.error('Failed to get tasks by status:', error);
            throw error;
        }
    }

    async getTasksByAssignee(projectId, assignedTo) {
        try {
            const tasks = await this.db.getTasksByProject(projectId);
            return tasks.filter(task => task.assignedTo === assignedTo);
        } catch (error) {
            console.error('Failed to get tasks by assignee:', error);
            throw error;
        }
    }

    async getOverdueTasks(projectId) {
        try {
            const tasks = await this.db.getTasksByProject(projectId);
            const now = Date.now();
            return tasks.filter(task =>
                task.dueDate &&
                task.dueDate < now &&
                task.status !== 'done'
            );
        } catch (error) {
            console.error('Failed to get overdue tasks:', error);
            throw error;
        }
    }

    async getBlockedTasks(projectId) {
        try {
            return await this.getTasksByStatus(projectId, 'blocked');
        } catch (error) {
            console.error('Failed to get blocked tasks:', error);
            throw error;
        }
    }

    // ============================================================
    // Bulk Operations
    // ============================================================

    async bulkUpdateStatus(taskIds, newStatus) {
        try {
            const results = [];
            for (const taskId of taskIds) {
                try {
                    await this.updateStatus(taskId, newStatus);
                    results.push({ taskId, success: true });
                } catch (error) {
                    results.push({ taskId, success: false, error: error.message });
                }
            }
            console.log('✓ Bulk status update completed');
            return results;
        } catch (error) {
            console.error('Failed to bulk update status:', error);
            throw error;
        }
    }

    async bulkAssign(taskIds, assignedTo) {
        try {
            const results = [];
            for (const taskId of taskIds) {
                try {
                    await this.assignTask(taskId, assignedTo);
                    results.push({ taskId, success: true });
                } catch (error) {
                    results.push({ taskId, success: false, error: error.message });
                }
            }
            console.log('✓ Bulk assign completed');
            return results;
        } catch (error) {
            console.error('Failed to bulk assign:', error);
            throw error;
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TaskHandler;
}
