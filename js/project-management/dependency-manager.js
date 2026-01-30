// Dependency Manager
// Manages task dependencies, validates for circular dependencies, and calculates critical path

class DependencyManager {
    constructor(database) {
        this.db = database;
    }

    // ============================================================
    // Dependency Graph Building
    // ============================================================

    async buildDependencyGraph(tasks) {
        const graph = new Map();

        // Initialize graph with all task IDs
        tasks.forEach(task => {
            graph.set(task.id, {
                task: task,
                dependencies: task.dependencies || [],
                dependents: [] // Tasks that depend on this task
            });
        });

        // Build reverse dependencies (dependents)
        tasks.forEach(task => {
            const dependencies = task.dependencies || [];
            dependencies.forEach(depId => {
                const depNode = graph.get(depId);
                if (depNode) {
                    depNode.dependents.push(task.id);
                }
            });
        });

        return graph;
    }

    // ============================================================
    // Dependency Validation
    // ============================================================

    async validateDependency(taskId, dependencyTaskId) {
        try {
            // Check if dependency task exists
            const dependencyTask = await this.db.getTask(dependencyTaskId);
            if (!dependencyTask) {
                return {
                    valid: false,
                    error: 'Dependency task does not exist'
                };
            }

            // Check if tasks are in the same project
            const task = await this.db.getTask(taskId);
            if (task && task.projectId !== dependencyTask.projectId) {
                return {
                    valid: false,
                    error: 'Tasks must be in the same project'
                };
            }

            // Check for self-dependency
            if (taskId === dependencyTaskId) {
                return {
                    valid: false,
                    error: 'Task cannot depend on itself'
                };
            }

            return { valid: true };
        } catch (error) {
            return {
                valid: false,
                error: error.message
            };
        }
    }

    async validateDependencies(taskId, newDependencies) {
        try {
            // Validate each dependency
            for (const depId of newDependencies) {
                const validation = await this.validateDependency(taskId, depId);
                if (!validation.valid) {
                    return validation;
                }
            }

            // Check for circular dependencies
            const hasCircular = await this.detectCircularDependencies(taskId, newDependencies);
            if (hasCircular) {
                return {
                    valid: false,
                    error: 'Circular dependency detected. This would create an infinite loop.'
                };
            }

            return { valid: true };
        } catch (error) {
            return {
                valid: false,
                error: error.message
            };
        }
    }

    // ============================================================
    // Circular Dependency Detection
    // ============================================================

    async detectCircularDependencies(taskId, newDependencies) {
        try {
            // Get all tasks to build dependency graph
            const allTasks = await this.db.getAllTasks();

            // Build temporary graph with proposed dependencies
            const graph = new Map();
            allTasks.forEach(task => {
                if (task.id === taskId) {
                    graph.set(task.id, newDependencies);
                } else {
                    graph.set(task.id, task.dependencies || []);
                }
            });

            // Perform DFS to detect cycles
            const visited = new Set();
            const recursionStack = new Set();

            const hasCycle = (nodeId) => {
                if (!visited.has(nodeId)) {
                    visited.add(nodeId);
                    recursionStack.add(nodeId);

                    const neighbors = graph.get(nodeId) || [];
                    for (const neighborId of neighbors) {
                        if (!visited.has(neighborId)) {
                            if (hasCycle(neighborId)) {
                                return true;
                            }
                        } else if (recursionStack.has(neighborId)) {
                            // Back edge found - cycle detected
                            return true;
                        }
                    }
                }
                recursionStack.delete(nodeId);
                return false;
            };

            // Check starting from the task being modified
            return hasCycle(taskId);
        } catch (error) {
            console.error('Error detecting circular dependencies:', error);
            return false;
        }
    }

    // ============================================================
    // Topological Sort
    // ============================================================

    async getTopologicalOrder(tasks) {
        try {
            const graph = await this.buildDependencyGraph(tasks);
            const visited = new Set();
            const result = [];

            const dfs = (taskId) => {
                if (visited.has(taskId)) {
                    return;
                }

                visited.add(taskId);
                const node = graph.get(taskId);

                if (node) {
                    // Visit all dependencies first
                    node.dependencies.forEach(depId => {
                        if (graph.has(depId)) {
                            dfs(depId);
                        }
                    });

                    // Add this task after its dependencies
                    result.push(taskId);
                }
            };

            // Process all tasks
            tasks.forEach(task => dfs(task.id));

            return result;
        } catch (error) {
            console.error('Error calculating topological order:', error);
            return [];
        }
    }

    // ============================================================
    // Critical Path Calculation
    // ============================================================

    async calculateCriticalPath(tasks) {
        try {
            if (tasks.length === 0) {
                return {
                    path: [],
                    duration: 0,
                    tasks: []
                };
            }

            const graph = await this.buildDependencyGraph(tasks);

            // Calculate earliest start times (forward pass)
            const earliestStart = new Map();
            const earliestFinish = new Map();

            const topologicalOrder = await this.getTopologicalOrder(tasks);

            topologicalOrder.forEach(taskId => {
                const node = graph.get(taskId);
                if (!node) return;

                const task = node.task;
                const duration = this.getTaskDuration(task);

                // Calculate earliest start
                let maxPredecessorFinish = 0;
                node.dependencies.forEach(depId => {
                    const depFinish = earliestFinish.get(depId) || 0;
                    maxPredecessorFinish = Math.max(maxPredecessorFinish, depFinish);
                });

                earliestStart.set(taskId, maxPredecessorFinish);
                earliestFinish.set(taskId, maxPredecessorFinish + duration);
            });

            // Calculate latest start times (backward pass)
            const latestStart = new Map();
            const latestFinish = new Map();

            // Find project end time
            const projectEnd = Math.max(...Array.from(earliestFinish.values()));

            // Initialize finish nodes with project end time
            topologicalOrder.reverse().forEach(taskId => {
                const node = graph.get(taskId);
                if (!node) return;

                const task = node.task;
                const duration = this.getTaskDuration(task);

                if (node.dependents.length === 0) {
                    latestFinish.set(taskId, projectEnd);
                } else {
                    const minSuccessorStart = Math.min(
                        ...node.dependents.map(depId => latestStart.get(depId) || projectEnd)
                    );
                    latestFinish.set(taskId, minSuccessorStart);
                }

                latestStart.set(taskId, latestFinish.get(taskId) - duration);
            });

            // Identify critical path tasks (where slack = 0)
            const criticalTasks = [];
            topologicalOrder.reverse(); // Back to original order

            topologicalOrder.forEach(taskId => {
                const es = earliestStart.get(taskId) || 0;
                const ls = latestStart.get(taskId) || 0;
                const slack = ls - es;

                if (Math.abs(slack) < 0.001) { // Account for floating point precision
                    const node = graph.get(taskId);
                    if (node) {
                        criticalTasks.push({
                            ...node.task,
                            earliestStart: es,
                            latestStart: ls,
                            slack: 0
                        });
                    }
                }
            });

            // Build critical path sequence
            const criticalPath = this.buildCriticalPathSequence(criticalTasks, graph);

            return {
                path: criticalPath.map(t => t.id),
                duration: projectEnd,
                tasks: criticalPath,
                totalTasks: tasks.length,
                criticalTasks: criticalTasks.length,
                projectEnd: projectEnd
            };
        } catch (error) {
            console.error('Error calculating critical path:', error);
            return {
                path: [],
                duration: 0,
                tasks: [],
                error: error.message
            };
        }
    }

    buildCriticalPathSequence(criticalTasks, graph) {
        if (criticalTasks.length === 0) {
            return [];
        }

        // Build sequence by following dependencies
        const taskMap = new Map(criticalTasks.map(t => [t.id, t]));
        const visited = new Set();
        const sequence = [];

        const findNextTask = (currentTaskId) => {
            const node = graph.get(currentTaskId);
            if (!node) return null;

            // Find next critical task in dependents
            for (const dependentId of node.dependents) {
                if (taskMap.has(dependentId) && !visited.has(dependentId)) {
                    return dependentId;
                }
            }
            return null;
        };

        // Find starting task (no dependencies or no critical dependencies)
        let currentTaskId = null;
        for (const task of criticalTasks) {
            const node = graph.get(task.id);
            if (!node) continue;

            const hasCriticalDependency = node.dependencies.some(depId => taskMap.has(depId));
            if (!hasCriticalDependency) {
                currentTaskId = task.id;
                break;
            }
        }

        // Build sequence
        while (currentTaskId && taskMap.has(currentTaskId)) {
            visited.add(currentTaskId);
            sequence.push(taskMap.get(currentTaskId));
            currentTaskId = findNextTask(currentTaskId);
        }

        // Add any remaining critical tasks not in sequence
        criticalTasks.forEach(task => {
            if (!visited.has(task.id)) {
                sequence.push(task);
            }
        });

        return sequence;
    }

    getTaskDuration(task) {
        // Calculate duration in days
        if (task.startDate && task.dueDate) {
            const msPerDay = 1000 * 60 * 60 * 24;
            return Math.max(1, Math.ceil((task.dueDate - task.startDate) / msPerDay));
        } else if (task.estimatedHours) {
            // Convert hours to days (8 hours per day)
            return Math.max(1, Math.ceil(task.estimatedHours / 8));
        }
        // Default to 1 day if no duration information
        return 1;
    }

    // ============================================================
    // Dependency Analysis
    // ============================================================

    async getDependencyChain(taskId) {
        try {
            const task = await this.db.getTask(taskId);
            if (!task) {
                return [];
            }

            const chain = [];
            const visited = new Set();

            const buildChain = async (currentTaskId) => {
                if (visited.has(currentTaskId)) {
                    return;
                }

                visited.add(currentTaskId);
                const currentTask = await this.db.getTask(currentTaskId);

                if (currentTask) {
                    chain.push(currentTask);

                    // Recursively get dependencies
                    const dependencies = currentTask.dependencies || [];
                    for (const depId of dependencies) {
                        await buildChain(depId);
                    }
                }
            };

            await buildChain(taskId);
            return chain;
        } catch (error) {
            console.error('Error getting dependency chain:', error);
            return [];
        }
    }

    async getDependentTasks(taskId) {
        try {
            const allTasks = await this.db.getAllTasks();
            return allTasks.filter(task => {
                const dependencies = task.dependencies || [];
                return dependencies.includes(taskId);
            });
        } catch (error) {
            console.error('Error getting dependent tasks:', error);
            return [];
        }
    }

    async getBlockingTasks(taskId) {
        try {
            const task = await this.db.getTask(taskId);
            if (!task || !task.dependencies) {
                return [];
            }

            const blockingTasks = [];
            for (const depId of task.dependencies) {
                const depTask = await this.db.getTask(depId);
                if (depTask && depTask.status !== 'done') {
                    blockingTasks.push(depTask);
                }
            }

            return blockingTasks;
        } catch (error) {
            console.error('Error getting blocking tasks:', error);
            return [];
        }
    }

    // ============================================================
    // Utility Methods
    // ============================================================

    async canStartTask(taskId) {
        const blockingTasks = await this.getBlockingTasks(taskId);
        return blockingTasks.length === 0;
    }

    async getTaskSlack(taskId, criticalPath) {
        try {
            const task = await this.db.getTask(taskId);
            if (!task) {
                return null;
            }

            // If task is on critical path, slack is 0
            if (criticalPath && criticalPath.path.includes(taskId)) {
                return 0;
            }

            // Calculate slack based on dependent tasks
            const dependents = await this.getDependentTasks(taskId);
            if (dependents.length === 0) {
                return null; // No slack calculation possible
            }

            // Simplified slack calculation
            const taskDuration = this.getTaskDuration(task);
            const minDependentStart = Math.min(
                ...dependents.map(t => t.startDate || t.dueDate || Infinity)
            );

            if (minDependentStart === Infinity) {
                return null;
            }

            const taskEnd = (task.dueDate || task.startDate || 0) + taskDuration;
            return Math.max(0, Math.floor((minDependentStart - taskEnd) / (1000 * 60 * 60 * 24)));
        } catch (error) {
            console.error('Error calculating task slack:', error);
            return null;
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DependencyManager;
}
