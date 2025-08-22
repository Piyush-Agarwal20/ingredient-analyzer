class IngredientChecker {
    constructor() {
        this.apiUrl = 'https://practicefoote.xyz/webhook-test/7caac64c-2c03-46a1-a8cf-305e76fdee63';
        
        // Cloudinary configuration - you'll provide these
        this.cloudinaryConfig = {
            cloudName: 'YOUR_CLOUD_NAME',    // Get from cloudinary dashboard
            uploadPreset: 'YOUR_UPLOAD_PRESET', // Create an unsigned upload preset
            apiKey: 'YOUR_API_KEY',          // Optional: for signed uploads
            apiSecret: 'YOUR_API_SECRET'     // Optional: for signed uploads (keep secure)
        };
        
        this.currentImage = null;
        this.initializeElements();
        this.bindEvents();
    }

    initializeElements() {
        this.uploadSection = document.getElementById('uploadSection');
        this.loadingSection = document.getElementById('loadingSection');
        this.resultsSection = document.getElementById('resultsSection');
        this.errorSection = document.getElementById('errorSection');
        
        this.uploadArea = document.getElementById('uploadArea');
        this.imageInput = document.getElementById('imageInput');
        this.uploadBtn = document.getElementById('uploadBtn');
        this.resultsContainer = document.getElementById('resultsContainer');
        this.resetBtn = document.getElementById('resetBtn');
        this.retryBtn = document.getElementById('retryBtn');
        this.errorText = document.getElementById('errorText');
    }

    bindEvents() {
        this.uploadBtn.addEventListener('click', () => this.imageInput.click());
        this.imageInput.addEventListener('change', (e) => this.handleFileSelect(e));
        this.resetBtn.addEventListener('click', () => this.resetApp());
        this.retryBtn.addEventListener('click', () => this.resetApp());

        this.uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.uploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        this.uploadArea.addEventListener('drop', (e) => this.handleDrop(e));
        this.uploadArea.addEventListener('click', () => this.imageInput.click());
    }

    handleDragOver(e) {
        e.preventDefault();
        this.uploadArea.classList.add('dragover');
    }

    handleDragLeave(e) {
        e.preventDefault();
        this.uploadArea.classList.remove('dragover');
    }

    handleDrop(e) {
        e.preventDefault();
        this.uploadArea.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.processFile(files[0]);
        }
    }

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            this.processFile(file);
        }
    }

    processFile(file) {
        if (!this.validateFile(file)) {
            this.showError('Please select a valid image file (JPG, PNG, GIF, WebP)');
            return;
        }

        if (file.size > 10 * 1024 * 1024) { // 10MB limit
            this.showError('File size must be less than 10MB');
            return;
        }

        this.currentImage = file;
        this.analyzeImage();
    }

    validateFile(file) {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        return allowedTypes.includes(file.type);
    }

    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }

    async uploadToCloudinary(file) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', this.cloudinaryConfig.uploadPreset);
            
            // Optional: Add folder organization
            formData.append('folder', 'ingredient-checker');
            
            // Optional: Add tags for better organization
            formData.append('tags', 'ingredient,food,analysis');
            
            const response = await fetch(
                `https://api.cloudinary.com/v1_1/${this.cloudinaryConfig.cloudName}/image/upload`,
                {
                    method: 'POST',
                    body: formData
                }
            );
            
            if (!response.ok) {
                throw new Error(`Cloudinary upload failed: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.error) {
                throw new Error('Cloudinary upload failed: ' + result.error.message);
            }
            
            // Return the secure URL (HTTPS)
            return result.secure_url;
            
        } catch (error) {
            console.error('Cloudinary upload error:', error);
            throw new Error('Failed to upload image to Cloudinary. Please try again.');
        }
    }

    async analyzeImage() {
        if (!this.apiUrl || this.apiUrl.trim() === '') {
            this.showError('API URL not configured. Please check your configuration.');
            return;
        }

        if (!this.cloudinaryConfig.cloudName || this.cloudinaryConfig.cloudName === 'YOUR_CLOUD_NAME') {
            this.showError('Cloudinary not configured. Please set your cloud name and upload preset.');
            return;
        }

        this.showSection('loading');

        try {
            // Step 1: Upload image to Cloudinary and get URL
            const imageUrl = await this.uploadToCloudinary(this.currentImage);
            
            // Step 2: Send image URL to your API
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    imageUrl: imageUrl,
                    filename: this.currentImage.name,
                    mimeType: this.currentImage.type
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            this.displayResults(result);
        } catch (error) {
            console.error('Analysis error:', error);
            this.showError(this.getErrorMessage(error));
        }
    }

    getErrorMessage(error) {
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            return 'Unable to connect to the analysis service. Please check your internet connection and try again.';
        } else if (error.message.includes('404')) {
            return 'Analysis service not found. Please check the API configuration.';
        } else if (error.message.includes('500')) {
            return 'Server error occurred during analysis. Please try again later.';
        } else if (error.message.includes('timeout')) {
            return 'Analysis request timed out. Please try again with a smaller image.';
        } else {
            return 'An error occurred during analysis. Please try again.';
        }
    }

    displayResults(data) {
        if (!data || !Array.isArray(data) || data.length === 0) {
            this.showError('No ingredients found in the image. Please try with a clearer image of ingredient labels.');
            return;
        }

        this.resultsContainer.innerHTML = '';

        data.forEach(ingredient => {
            const ingredientElement = this.createIngredientElement(ingredient);
            this.resultsContainer.appendChild(ingredientElement);
        });

        this.showSection('results');
    }

    createIngredientElement(ingredient) {
        const { name, status, reason } = ingredient;
        
        const element = document.createElement('div');
        element.className = 'ingredient-item';
        element.style.backgroundColor = this.getStatusBackgroundColor(status);

        const statusClass = this.getStatusClass(status);
        const statusIcon = this.getStatusIcon(status);

        element.innerHTML = `
            <div class="status-indicator ${statusClass}">
                ${statusIcon}
            </div>
            <div class="ingredient-content">
                <div class="ingredient-name">${this.sanitizeText(name)}</div>
                <div class="ingredient-status" style="color: ${this.getStatusColor(status)}">
                    ${this.sanitizeText(status)}
                </div>
                <div class="ingredient-reason">
                    ${this.sanitizeText(reason)}
                </div>
            </div>
        `;

        return element;
    }

    getStatusClass(status) {
        const statusMap = {
            'healthy': 'status-healthy',
            'good to eat': 'status-good',
            'good': 'status-good',
            'neutral': 'status-neutral',
            'bad': 'status-bad',
            'very bad': 'status-very-bad',
            'don\'t touch': 'status-dont-touch',
            'dont touch': 'status-dont-touch'
        };
        return statusMap[status.toLowerCase()] || 'status-neutral';
    }

    getStatusColor(status) {
        const colorMap = {
            'healthy': '#27ae60',
            'good to eat': '#2ecc71',
            'good': '#2ecc71',
            'neutral': '#f39c12',
            'bad': '#e74c3c',
            'very bad': '#c0392b',
            'don\'t touch': '#8e44ad',
            'dont touch': '#8e44ad'
        };
        return colorMap[status.toLowerCase()] || '#f39c12';
    }

    getStatusBackgroundColor(status) {
        const bgColorMap = {
            'healthy': 'rgba(39, 174, 96, 0.05)',
            'good to eat': 'rgba(46, 204, 113, 0.05)',
            'good': 'rgba(46, 204, 113, 0.05)',
            'neutral': 'rgba(243, 156, 18, 0.05)',
            'bad': 'rgba(231, 76, 60, 0.05)',
            'very bad': 'rgba(192, 57, 43, 0.05)',
            'don\'t touch': 'rgba(142, 68, 173, 0.05)',
            'dont touch': 'rgba(142, 68, 173, 0.05)'
        };
        return bgColorMap[status.toLowerCase()] || 'rgba(243, 156, 18, 0.05)';
    }

    getStatusIcon(status) {
        const iconMap = {
            'healthy': '✓',
            'good to eat': '✓',
            'good': '✓',
            'neutral': '?',
            'bad': '!',
            'very bad': '!!',
            'don\'t touch': '✕',
            'dont touch': '✕'
        };
        return iconMap[status.toLowerCase()] || '?';
    }

    sanitizeText(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showSection(section) {
        this.hideAllSections();
        
        switch (section) {
            case 'upload':
                this.uploadSection.classList.remove('hidden');
                break;
            case 'loading':
                this.loadingSection.classList.remove('hidden');
                break;
            case 'results':
                this.resultsSection.classList.remove('hidden');
                break;
            case 'error':
                this.errorSection.classList.remove('hidden');
                break;
        }
    }

    hideAllSections() {
        this.uploadSection.classList.add('hidden');
        this.loadingSection.classList.add('hidden');
        this.resultsSection.classList.add('hidden');
        this.errorSection.classList.add('hidden');
    }

    showError(message) {
        this.errorText.textContent = message;
        this.showSection('error');
    }

    resetApp() {
        this.currentImage = null;
        this.imageInput.value = '';
        this.resultsContainer.innerHTML = '';
        this.showSection('upload');
    }

    setApiUrl(url) {
        this.apiUrl = url;
    }

    setCloudinaryConfig(config) {
        this.cloudinaryConfig = { ...this.cloudinaryConfig, ...config };
        console.log('Cloudinary configuration updated');
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.ingredientChecker = new IngredientChecker();
    
    // Example of how to set the API URL when provided
    // window.ingredientChecker.setApiUrl('YOUR_API_URL_HERE');
    
    console.log('Ingredient Checker initialized. Set API URL using: window.ingredientChecker.setApiUrl("your-api-url")');
});

// Example usage for testing (remove in production)
// Simulate API response for testing
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.testAnalysis = function() {
        const mockData = [
            {
                name: "High Fructose Corn Syrup",
                status: "very bad",
                reason: "Highly processed sweetener linked to obesity, diabetes, and metabolic disorders. Avoid when possible."
            },
            {
                name: "Organic Quinoa",
                status: "healthy",
                reason: "Complete protein source, rich in fiber, vitamins and minerals. Excellent nutritional choice."
            },
            {
                name: "Natural Flavoring",
                status: "neutral",
                reason: "Generally recognized as safe, but can be ambiguous. May contain allergens or additives."
            },
            {
                name: "Trans Fat",
                status: "don't touch",
                reason: "Artificial fats that increase bad cholesterol and heart disease risk. Banned in many countries."
            },
            {
                name: "Vitamin C",
                status: "good",
                reason: "Essential antioxidant vitamin that supports immune system and collagen production."
            }
        ];
        
        if (window.ingredientChecker) {
            window.ingredientChecker.displayResults(mockData);
        }
    };
}