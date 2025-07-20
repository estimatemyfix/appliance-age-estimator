// DOM Elements
const uploadArea = document.getElementById('uploadArea');
const imageInput = document.getElementById('imageInput'); // Changed from fileInput
const previewGrid = document.getElementById('previewGrid'); // Changed from imagesGrid
const customQuestions = document.getElementById('customQuestions'); // Changed from customQuestion
const analyzeBtn = document.getElementById('analyzeBtn');
const paymentSection = document.getElementById('paymentSection');
const loadingOverlay = document.getElementById('loadingOverlay'); // Changed from loadingSection
const loadingText = document.getElementById('loadingText'); // Changed from loadingMessage
const results = document.getElementById('results'); // Changed from resultsSection

let currentFiles = [];
const MAX_FILES = 5;
let currentPaymentIntentId = null;

// Initialize Stripe (using config file)
const stripe = Stripe(CONFIG.STRIPE_PUBLISHABLE_KEY);
let elements, paymentElement;

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    console.log('App initialized');
});

function initializeEventListeners() {
    // File input change
    if (imageInput) {
        imageInput.addEventListener('change', handleFileSelect);
    }
    
    // Drag and drop events
    if (uploadArea) {
        uploadArea.addEventListener('dragover', handleDragOver);
        uploadArea.addEventListener('dragenter', handleDragEnter);
        uploadArea.addEventListener('dragleave', handleDragLeave);
        uploadArea.addEventListener('drop', handleDrop);
        uploadArea.addEventListener('click', () => imageInput.click());
    }
    
    // Button clicks
    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', handleAnalyzeClick);
    }
    
    // Prevent default drag behavior
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        if (uploadArea) {
            uploadArea.addEventListener(eventName, preventDefaults, false);
        }
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    console.log('Event listeners initialized');
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function handleDragEnter(e) {
    uploadArea.classList.add('drag-over');
}

function handleDragOver(e) {
    uploadArea.classList.add('drag-over');
}

function handleDragLeave(e) {
    uploadArea.classList.remove('drag-over');
}

function handleDrop(e) {
    uploadArea.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
}

function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    handleFiles(files);
}

function handleFiles(files) {
    console.log('Handling files:', files);
    
    // Filter valid image files
    const validFiles = files.filter(file => {
        if (!file.type.startsWith('image/')) {
            showNotification(`${file.name} is not a valid image file`, 'error');
            return false;
        }
        if (file.size > 10 * 1024 * 1024) {
            showNotification(`${file.name} is too large (max 10MB)`, 'error');
            return false;
        }
        return true;
    });
    
    // Check total file limit
    const totalFiles = currentFiles.length + validFiles.length;
    if (totalFiles > MAX_FILES) {
        const remainingSlots = MAX_FILES - currentFiles.length;
        showNotification(`You can only upload ${MAX_FILES} images total. ${remainingSlots} slots remaining.`, 'error');
        validFiles.splice(remainingSlots);
    }
    
    // Add valid files to current files
    validFiles.forEach(file => {
        if (currentFiles.length < MAX_FILES) {
            currentFiles.push(file);
        }
    });
    
    if (currentFiles.length > 0) {
        displayFilePreviews();
        enableAnalyzeButton();
    }
    
    // Clear the input so the same files can be selected again if needed
    if (imageInput) {
        imageInput.value = '';
    }
}

function displayFilePreviews() {
    if (!previewGrid) return;
    
    // Clear existing previews
    previewGrid.innerHTML = '';
    
    // Create preview for each file
    currentFiles.forEach((file, index) => {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            const previewDiv = document.createElement('div');
            previewDiv.className = 'image-preview-card';
            previewDiv.innerHTML = `
                <div class="preview-image">
                    <img src="${e.target.result}" alt="Appliance ${index + 1}">
                    <button class="remove-btn" onclick="removeFile(${index})">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="preview-info">
                    <span class="file-name">${file.name}</span>
                    <span class="file-size">${formatFileSize(file.size)}</span>
                </div>
            `;
            previewGrid.appendChild(previewDiv);
        };
        
        reader.readAsDataURL(file);
    });
    
    // Show preview grid
    previewGrid.style.display = 'grid';
    
    console.log('Displayed previews for', currentFiles.length, 'files');
}

function enableAnalyzeButton() {
    if (analyzeBtn) {
        analyzeBtn.disabled = false;
        analyzeBtn.classList.add('enabled');
        console.log('Analyze button enabled');
    }
}

function disableAnalyzeButton() {
    if (analyzeBtn) {
        analyzeBtn.disabled = true;
        analyzeBtn.classList.remove('enabled');
    }
}

// Make removeFile global so it can be called from onclick handlers
window.removeFile = function(index) {
    currentFiles.splice(index, 1);
    
    if (currentFiles.length === 0) {
        // Hide preview grid
        if (previewGrid) {
            previewGrid.style.display = 'none';
        }
        disableAnalyzeButton();
    } else {
        displayFilePreviews();
    }
    
    console.log('Removed file, remaining:', currentFiles.length);
};

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function showNotification(message, type = 'info') {
    // Create a premium notification
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    const colors = {
        error: 'linear-gradient(135deg, #ff4757, #ff3838)',
        success: 'linear-gradient(135deg, #2ed573, #17a2b8)', 
        info: 'linear-gradient(135deg, #667eea, #764ba2)'
    };
    
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${type === 'error' ? 'exclamation-circle' : type === 'success' ? 'check-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        </div>
        <button class="notification-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: ${colors[type] || colors.info};
        color: white;
        padding: 16px 20px;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3), 0 0 20px rgba(102, 126, 234, 0.2);
        z-index: 10000;
        font-weight: 500;
        min-width: 300px;
        max-width: 400px;
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255,255,255,0.1);
        animation: slideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
    `;
    
    // Add animation styles
    if (!document.querySelector('#notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            .notification-content {
                display: flex;
                align-items: center;
                gap: 12px;
                flex: 1;
            }
            
            .notification-close {
                background: rgba(255,255,255,0.2);
                border: none;
                border-radius: 50%;
                width: 24px;
                height: 24px;
                color: white;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                transition: background 0.2s ease;
            }
            
            .notification-close:hover {
                background: rgba(255,255,255,0.3);
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideInRight 0.3s reverse';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }
    }, 5000);
}

async function handleAnalyzeClick() {
    console.log('Analyze button clicked');
    
    if (currentFiles.length === 0) {
        showNotification('Please upload at least one image', 'error');
        return;
    }

    // TESTING MODE - Skip payment for now
    const TESTING_MODE = true; // Set to false to enable payments
    
    if (TESTING_MODE) {
        showNotification('Testing mode - analyzing without payment', 'info');
        currentPaymentIntentId = 'test_' + Date.now();
        await performAnalysis();
        return;
    }

    // Show loading
    showLoading('Processing your images...');
    
    try {
        // Create payment intent first
        const response = await fetch('/.netlify/functions/create-payment-intent', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                amount: 299, // $2.99 in cents
                currency: 'usd'
            }),
        });

        const { clientSecret, paymentIntentId } = await response.json();
        currentPaymentIntentId = paymentIntentId;
        
        // Hide loading and show payment
        hideLoading();
        showPaymentForm(clientSecret);
        
    } catch (error) {
        console.error('Error creating payment intent:', error);
        hideLoading();
        showNotification('Error setting up payment. Please try again.', 'error');
    }
}

function showPaymentForm(clientSecret) {
    if (!paymentSection) return;
    
    // Initialize Stripe elements for payment
    elements = stripe.elements({
        clientSecret: clientSecret
    });
    
    paymentElement = elements.create('payment');
    const paymentElementDiv = document.getElementById('payment-element');
    
    if (paymentElementDiv) {
        paymentElement.mount('#payment-element');
    }
    
    // Show payment section
    paymentSection.style.display = 'block';
    paymentSection.scrollIntoView({ behavior: 'smooth' });
    
    // Handle payment form submission
    const submitPaymentBtn = document.getElementById('submit-payment');
    if (submitPaymentBtn) {
        submitPaymentBtn.onclick = handlePaymentSubmit;
    }
}

async function handlePaymentSubmit(event) {
    event.preventDefault();
    
    if (!stripe || !elements) {
        showNotification('Payment system not ready. Please try again.', 'error');
        return;
    }
    
    showLoading('Processing payment...');
    
    const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
            return_url: window.location.origin + '/payment-success',
        },
        redirect: 'if_required'
    });
    
    if (error) {
        hideLoading();
        showNotification(`Payment failed: ${error.message}`, 'error');
    } else {
        // Payment succeeded, now analyze the images
        await performAnalysis();
    }
}

async function performAnalysis() {
    showLoading('AI is analyzing your appliance...');
    updateLoadingText('Identifying appliance model...');
    
    try {
        // Prepare form data
        const formData = new FormData();
        
        // Add images
        currentFiles.forEach((file, index) => {
            formData.append('images', file);
        });
        
        // Add custom questions if any
        const customQuestionsValue = customQuestions ? customQuestions.value.trim() : '';
        if (customQuestionsValue) {
            formData.append('customQuestions', customQuestionsValue);
        }
        
        // Add payment intent ID
        if (currentPaymentIntentId) {
            formData.append('paymentIntentId', currentPaymentIntentId);
        }
        
        // Update loading text
        updateLoadingText('AI is analyzing your images...');
        
        // Send request to Netlify function
        const response = await fetch('/.netlify/functions/analyze-appliance', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        // Hide loading and show results
        hideLoading();
        hidePaymentForm();
        displayResults(result);
        
    } catch (error) {
        console.error('Analysis error:', error);
        hideLoading();
        showNotification('Analysis failed. Please try again or contact support.', 'error');
    }
}

function showLoading(message = 'Processing...') {
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
        updateLoadingText(message);
    }
}

function hideLoading() {
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
}

function updateLoadingText(text) {
    if (loadingText) {
        loadingText.textContent = text;
    }
}

function hidePaymentForm() {
    if (paymentSection) {
        paymentSection.style.display = 'none';
    }
}

function displayResults(analysisResult) {
    if (!results) return;
    
    console.log('Displaying results:', analysisResult);
    
    // Format and display the analysis
    results.innerHTML = `
        <div class="results-container">
            <div class="results-header">
                <h2><i class="fas fa-check-circle"></i> Analysis Complete</h2>
                <button class="new-analysis-btn" onclick="startNewAnalysis()">
                    <i class="fas fa-plus"></i> Analyze Another
                </button>
            </div>
            <div class="analysis-results">
                ${formatAnalysisContent(analysisResult.analysis)}
            </div>
        </div>
    `;
    
    // Show results section
    results.style.display = 'block';
    results.scrollIntoView({ behavior: 'smooth' });
}

function formatAnalysisContent(content) {
    // Basic HTML formatting for the analysis content
    return content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>')
        .replace(/^/, '<p>')
        .replace(/$/, '</p>');
}

window.startNewAnalysis = function() {
    // Reset everything
    currentFiles = [];
    currentPaymentIntentId = null;
    
    // Hide results
    if (results) {
        results.style.display = 'none';
    }
    
    // Hide payment form
    hidePaymentForm();
    
    // Hide preview grid
    if (previewGrid) {
        previewGrid.style.display = 'none';
    }
    
    // Clear custom questions
    if (customQuestions) {
        customQuestions.value = '';
    }
    
    // Reset analyze button
    disableAnalyzeButton();
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    console.log('Started new analysis');
}; 