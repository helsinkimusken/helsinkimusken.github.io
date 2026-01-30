// Firebase Database Management - Extended for Project Management
class Database {
    constructor() {
        this.db = null;
        this.useFirebase = false;
        this.localDB = null;

        // Firebase references
        this.recordsRef = null;  // Existing info-sharing records
        this.projectsRef = null;  // New: Project management
        this.tasksRef = null;     // New: Tasks
        this.materialsRef = null; // New: Materials
        this.milestonesRef = null; // New: Milestones
    }

    async init() {
        try {
            // Check if Firebase is configured
            if (typeof firebase !== 'undefined' && typeof firebaseConfig !== 'undefined') {
                // Initialize Firebase (should already be initialized in app.js)
                if (!firebase.apps.length) {
                    firebase.initializeApp(firebaseConfig);
                }
                this.db = firebase.database();

                // Set up all Firebase references
                this.recordsRef = this.db.ref('records');
                this.projectsRef = this.db.ref('projects');
                this.tasksRef = this.db.ref('tasks');
                this.materialsRef = this.db.ref('materials');
                this.milestonesRef = this.db.ref('milestones');

                this.useFirebase = true;
                console.log('✓ Database initialized successfully');

                // Set up real-time listener for records
                this.setupRealtimeListener();
            } else {
                console.warn('Firebase not configured. Using local IndexedDB only.');
                await this.initIndexedDB();
            }
        } catch (error) {
            console.error('Database initialization error:', error);
            console.warn('Falling back to IndexedDB');
            await this.initIndexedDB();
        }
    }

    async initIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('XteamDB', 2); // Version 2 for new stores

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.localDB = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create object stores if they don't exist
                if (!db.objectStoreNames.contains('records')) {
                    const recordsStore = db.createObjectStore('records', { keyPath: 'id', autoIncrement: true });
                    recordsStore.createIndex('timestamp', 'timestamp', { unique: false });
                    recordsStore.createIndex('category', 'category', { unique: false });
                    recordsStore.createIndex('userName', 'userName', { unique: false });
                }

                if (!db.objectStoreNames.contains('projects')) {
                    const projectsStore = db.createObjectStore('projects', { keyPath: 'id', autoIncrement: true });
                    projectsStore.createIndex('createdAt', 'createdAt', { unique: false });
                    projectsStore.createIndex('status', 'status', { unique: false });
                }

                if (!db.objectStoreNames.contains('tasks')) {
                    const tasksStore = db.createObjectStore('tasks', { keyPath: 'id', autoIncrement: true });
                    tasksStore.createIndex('projectId', 'projectId', { unique: false });
                    tasksStore.createIndex('status', 'status', { unique: false });
                    tasksStore.createIndex('dueDate', 'dueDate', { unique: false });
                }

                if (!db.objectStoreNames.contains('materials')) {
                    const materialsStore = db.createObjectStore('materials', { keyPath: 'id', autoIncrement: true });
                    materialsStore.createIndex('taskId', 'taskId', { unique: false });
                    materialsStore.createIndex('status', 'status', { unique: false });
                }

                if (!db.objectStoreNames.contains('milestones')) {
                    const milestonesStore = db.createObjectStore('milestones', { keyPath: 'id', autoIncrement: true });
                    milestonesStore.createIndex('projectId', 'projectId', { unique: false });
                }
            };
        });
    }

    setupRealtimeListener() {
        if (!this.useFirebase) return;

        // Listen for records changes (existing info-sharing system)
        this.recordsRef.on('value', (snapshot) => {
            if (window.xteamApp) {
                window.xteamApp.onDataChanged();
            }
        });
    }

    // ============================================================
    // EXISTING METHODS - Info Sharing Records (Backward Compatible)
    // ============================================================

    async addRecord(record) {
        if (this.useFirebase) {
            const newRecordRef = this.recordsRef.push();
            record.id = newRecordRef.key;
            await newRecordRef.set(record);
            console.log('✓ Record saved to Firebase');
            return record.id;
        } else {
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
            return new Promise((resolve, reject) => {
                const transaction = this.localDB.transaction(['records'], 'readwrite');
                const objectStore = transaction.objectStore('records');
                const request = objectStore.clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }
    }

    // ============================================================
    // NEW METHODS - Project Management
    // ============================================================

    // ---------- Projects ----------

    async addProject(project) {
        const timestamp = Date.now();
        const projectData = {
            ...project,
            createdAt: timestamp,
            updatedAt: timestamp
        };

        if (this.useFirebase) {
            const newProjectRef = this.projectsRef.push();
            projectData.id = newProjectRef.key;
            await newProjectRef.set(projectData);
            console.log('✓ Project saved to Firebase');
            return projectData.id;
        } else {
            return new Promise((resolve, reject) => {
                const transaction = this.localDB.transaction(['projects'], 'readwrite');
                const objectStore = transaction.objectStore('projects');
                const request = objectStore.add(projectData);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }
    }

    async getProject(projectId) {
        if (this.useFirebase) {
            const snapshot = await this.projectsRef.child(projectId).once('value');
            if (snapshot.exists()) {
                return { id: snapshot.key, ...snapshot.val() };
            }
            return null;
        } else {
            return new Promise((resolve, reject) => {
                const transaction = this.localDB.transaction(['projects'], 'readonly');
                const objectStore = transaction.objectStore('projects');
                const request = objectStore.get(projectId);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }
    }

    async getAllProjects() {
        if (this.useFirebase) {
            const snapshot = await this.projectsRef.once('value');
            const projects = [];
            snapshot.forEach((childSnapshot) => {
                projects.push({
                    id: childSnapshot.key,
                    ...childSnapshot.val()
                });
            });
            return projects;
        } else {
            return new Promise((resolve, reject) => {
                const transaction = this.localDB.transaction(['projects'], 'readonly');
                const objectStore = transaction.objectStore('projects');
                const request = objectStore.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }
    }

    async updateProject(projectId, updates) {
        updates.updatedAt = Date.now();

        if (this.useFirebase) {
            await this.projectsRef.child(projectId).update(updates);
            console.log('✓ Project updated in Firebase');
        } else {
            return new Promise((resolve, reject) => {
                const transaction = this.localDB.transaction(['projects'], 'readwrite');
                const objectStore = transaction.objectStore('projects');
                const getRequest = objectStore.get(projectId);
                getRequest.onsuccess = () => {
                    const project = { ...getRequest.result, ...updates };
                    const putRequest = objectStore.put(project);
                    putRequest.onsuccess = () => resolve();
                    putRequest.onerror = () => reject(putRequest.error);
                };
                getRequest.onerror = () => reject(getRequest.error);
            });
        }
    }

    async deleteProject(projectId) {
        if (this.useFirebase) {
            await this.projectsRef.child(projectId).remove();
            console.log('✓ Project deleted from Firebase');
        } else {
            return new Promise((resolve, reject) => {
                const transaction = this.localDB.transaction(['projects'], 'readwrite');
                const objectStore = transaction.objectStore('projects');
                const request = objectStore.delete(projectId);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }
    }

    // ---------- Tasks ----------

    async addTask(task) {
        const timestamp = Date.now();
        const taskData = {
            ...task,
            createdAt: timestamp,
            updatedAt: timestamp,
            status: task.status || 'todo',
            priority: task.priority || 'medium',
            progress: task.progress || 0,
            dependencies: task.dependencies || [],
            materialIds: task.materialIds || [],
            linkedRecords: task.linkedRecords || [],
            comments: task.comments || []
        };

        if (this.useFirebase) {
            const newTaskRef = this.tasksRef.push();
            taskData.id = newTaskRef.key;
            await newTaskRef.set(taskData);
            console.log('✓ Task saved to Firebase');
            return taskData.id;
        } else {
            return new Promise((resolve, reject) => {
                const transaction = this.localDB.transaction(['tasks'], 'readwrite');
                const objectStore = transaction.objectStore('tasks');
                const request = objectStore.add(taskData);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }
    }

    async getTask(taskId) {
        if (this.useFirebase) {
            const snapshot = await this.tasksRef.child(taskId).once('value');
            if (snapshot.exists()) {
                return { id: snapshot.key, ...snapshot.val() };
            }
            return null;
        } else {
            return new Promise((resolve, reject) => {
                const transaction = this.localDB.transaction(['tasks'], 'readonly');
                const objectStore = transaction.objectStore('tasks');
                const request = objectStore.get(taskId);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }
    }

    async getTasksByProject(projectId) {
        if (this.useFirebase) {
            const snapshot = await this.tasksRef.orderByChild('projectId').equalTo(projectId).once('value');
            const tasks = [];
            snapshot.forEach((childSnapshot) => {
                tasks.push({
                    id: childSnapshot.key,
                    ...childSnapshot.val()
                });
            });
            return tasks;
        } else {
            return new Promise((resolve, reject) => {
                const transaction = this.localDB.transaction(['tasks'], 'readonly');
                const objectStore = transaction.objectStore('tasks');
                const index = objectStore.index('projectId');
                const request = index.getAll(projectId);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }
    }

    async getAllTasks() {
        if (this.useFirebase) {
            const snapshot = await this.tasksRef.once('value');
            const tasks = [];
            snapshot.forEach((childSnapshot) => {
                tasks.push({
                    id: childSnapshot.key,
                    ...childSnapshot.val()
                });
            });
            return tasks;
        } else {
            return new Promise((resolve, reject) => {
                const transaction = this.localDB.transaction(['tasks'], 'readonly');
                const objectStore = transaction.objectStore('tasks');
                const request = objectStore.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }
    }

    async updateTask(taskId, updates) {
        updates.updatedAt = Date.now();

        if (this.useFirebase) {
            await this.tasksRef.child(taskId).update(updates);
            console.log('✓ Task updated in Firebase');
        } else {
            return new Promise((resolve, reject) => {
                const transaction = this.localDB.transaction(['tasks'], 'readwrite');
                const objectStore = transaction.objectStore('tasks');
                const getRequest = objectStore.get(taskId);
                getRequest.onsuccess = () => {
                    const task = { ...getRequest.result, ...updates };
                    const putRequest = objectStore.put(task);
                    putRequest.onsuccess = () => resolve();
                    putRequest.onerror = () => reject(putRequest.error);
                };
                getRequest.onerror = () => reject(getRequest.error);
            });
        }
    }

    async deleteTask(taskId) {
        if (this.useFirebase) {
            await this.tasksRef.child(taskId).remove();
            console.log('✓ Task deleted from Firebase');
        } else {
            return new Promise((resolve, reject) => {
                const transaction = this.localDB.transaction(['tasks'], 'readwrite');
                const objectStore = transaction.objectStore('tasks');
                const request = objectStore.delete(taskId);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }
    }

    // ---------- Materials ----------

    async addMaterial(material) {
        const timestamp = Date.now();
        const materialData = {
            ...material,
            createdAt: timestamp,
            updatedAt: timestamp,
            status: material.status || 'pending',
            documents: material.documents || []
        };

        if (this.useFirebase) {
            const newMaterialRef = this.materialsRef.push();
            materialData.id = newMaterialRef.key;
            await newMaterialRef.set(materialData);
            console.log('✓ Material saved to Firebase');
            return materialData.id;
        } else {
            return new Promise((resolve, reject) => {
                const transaction = this.localDB.transaction(['materials'], 'readwrite');
                const objectStore = transaction.objectStore('materials');
                const request = objectStore.add(materialData);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }
    }

    async getMaterial(materialId) {
        if (this.useFirebase) {
            const snapshot = await this.materialsRef.child(materialId).once('value');
            if (snapshot.exists()) {
                return { id: snapshot.key, ...snapshot.val() };
            }
            return null;
        } else {
            return new Promise((resolve, reject) => {
                const transaction = this.localDB.transaction(['materials'], 'readonly');
                const objectStore = transaction.objectStore('materials');
                const request = objectStore.get(materialId);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }
    }

    async getMaterialsByTask(taskId) {
        if (this.useFirebase) {
            const snapshot = await this.materialsRef.orderByChild('taskId').equalTo(taskId).once('value');
            const materials = [];
            snapshot.forEach((childSnapshot) => {
                materials.push({
                    id: childSnapshot.key,
                    ...childSnapshot.val()
                });
            });
            return materials;
        } else {
            return new Promise((resolve, reject) => {
                const transaction = this.localDB.transaction(['materials'], 'readonly');
                const objectStore = transaction.objectStore('materials');
                const index = objectStore.index('taskId');
                const request = index.getAll(taskId);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }
    }

    async updateMaterial(materialId, updates) {
        updates.updatedAt = Date.now();

        if (this.useFirebase) {
            await this.materialsRef.child(materialId).update(updates);
            console.log('✓ Material updated in Firebase');
        } else {
            return new Promise((resolve, reject) => {
                const transaction = this.localDB.transaction(['materials'], 'readwrite');
                const objectStore = transaction.objectStore('materials');
                const getRequest = objectStore.get(materialId);
                getRequest.onsuccess = () => {
                    const material = { ...getRequest.result, ...updates };
                    const putRequest = objectStore.put(material);
                    putRequest.onsuccess = () => resolve();
                    putRequest.onerror = () => reject(putRequest.error);
                };
                getRequest.onerror = () => reject(getRequest.error);
            });
        }
    }

    async deleteMaterial(materialId) {
        if (this.useFirebase) {
            await this.materialsRef.child(materialId).remove();
            console.log('✓ Material deleted from Firebase');
        } else {
            return new Promise((resolve, reject) => {
                const transaction = this.localDB.transaction(['materials'], 'readwrite');
                const objectStore = transaction.objectStore('materials');
                const request = objectStore.delete(materialId);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }
    }

    // ---------- Milestones ----------

    async addMilestone(milestone) {
        const timestamp = Date.now();
        const milestoneData = {
            ...milestone,
            createdAt: timestamp,
            updatedAt: timestamp,
            status: milestone.status || 'pending',
            linkedTasks: milestone.linkedTasks || []
        };

        if (this.useFirebase) {
            const newMilestoneRef = this.milestonesRef.push();
            milestoneData.id = newMilestoneRef.key;
            await newMilestoneRef.set(milestoneData);
            console.log('✓ Milestone saved to Firebase');
            return milestoneData.id;
        } else {
            return new Promise((resolve, reject) => {
                const transaction = this.localDB.transaction(['milestones'], 'readwrite');
                const objectStore = transaction.objectStore('milestones');
                const request = objectStore.add(milestoneData);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }
    }

    async getMilestonesByProject(projectId) {
        if (this.useFirebase) {
            const snapshot = await this.milestonesRef.orderByChild('projectId').equalTo(projectId).once('value');
            const milestones = [];
            snapshot.forEach((childSnapshot) => {
                milestones.push({
                    id: childSnapshot.key,
                    ...childSnapshot.val()
                });
            });
            return milestones;
        } else {
            return new Promise((resolve, reject) => {
                const transaction = this.localDB.transaction(['milestones'], 'readonly');
                const objectStore = transaction.objectStore('milestones');
                const index = objectStore.index('projectId');
                const request = index.getAll(projectId);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }
    }

    async updateMilestone(milestoneId, updates) {
        updates.updatedAt = Date.now();

        if (this.useFirebase) {
            await this.milestonesRef.child(milestoneId).update(updates);
            console.log('✓ Milestone updated in Firebase');
        } else {
            return new Promise((resolve, reject) => {
                const transaction = this.localDB.transaction(['milestones'], 'readwrite');
                const objectStore = transaction.objectStore('milestones');
                const getRequest = objectStore.get(milestoneId);
                getRequest.onsuccess = () => {
                    const milestone = { ...getRequest.result, ...updates };
                    const putRequest = objectStore.put(milestone);
                    putRequest.onsuccess = () => resolve();
                    putRequest.onerror = () => reject(putRequest.error);
                };
                getRequest.onerror = () => reject(getRequest.error);
            });
        }
    }

    async deleteMilestone(milestoneId) {
        if (this.useFirebase) {
            await this.milestonesRef.child(milestoneId).remove();
            console.log('✓ Milestone deleted from Firebase');
        } else {
            return new Promise((resolve, reject) => {
                const transaction = this.localDB.transaction(['milestones'], 'readwrite');
                const objectStore = transaction.objectStore('milestones');
                const request = objectStore.delete(milestoneId);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }
    }

    // ---------- Dependency Validation ----------

    async validateTaskDependencies(taskId, newDependencies) {
        // Build dependency graph for cycle detection
        const allTasks = await this.getAllTasks();

        // Create adjacency list
        const graph = new Map();
        allTasks.forEach(task => {
            graph.set(task.id, task.dependencies || []);
        });

        // Add proposed dependencies
        graph.set(taskId, newDependencies);

        // Check for cycles using DFS
        const visited = new Set();
        const recursionStack = new Set();

        const hasCycle = (node) => {
            if (!visited.has(node)) {
                visited.add(node);
                recursionStack.add(node);

                const neighbors = graph.get(node) || [];
                for (const neighbor of neighbors) {
                    if (!visited.has(neighbor) && hasCycle(neighbor)) {
                        return true;
                    } else if (recursionStack.has(neighbor)) {
                        return true;
                    }
                }
            }
            recursionStack.delete(node);
            return false;
        };

        // Check if adding these dependencies creates a cycle
        if (hasCycle(taskId)) {
            return {
                valid: false,
                error: 'Circular dependency detected'
            };
        }

        return {
            valid: true
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Database;
}
