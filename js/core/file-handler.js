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
            if (file.type.startsWith('image/') || file.size < 100 * 1024 * 1024) { // Images or files < 100MB
                fileData.data = await this.fileToBase64(file);
            } else {
                // For larger files, store metadata only
                fileData.data = null;
                fileData.note = 'File too large to store in browser database (limit 100MB)';
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

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FileHandler;
}
