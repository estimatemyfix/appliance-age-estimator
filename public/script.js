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
    // Enhanced HTML formatting for the analysis content
    let formatted = content;
    
    // Convert markdown headers to proper HTML headers
    formatted = formatted.replace(/^## (.+)$/gm, '<h2 class="analysis-section-title">$1</h2>');
    formatted = formatted.replace(/^### (.+)$/gm, '<h3 class="analysis-subsection-title">$1</h3>');
    
    // Convert bold text
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong class="highlight">$1</strong>');
    
    // Create clickable Amazon links
    formatted = formatted.replace(
        /Amazon:\s*([^<\n]+)/g, 
        function(match, searchTerm) {
            const cleanTerm = searchTerm.replace(/[^\w\s-]/g, '').trim();
            const encodedTerm = encodeURIComponent(cleanTerm);
            return `<a href="https://www.amazon.com/s?k=${encodedTerm}" target="_blank" class="purchase-link amazon-link">
                <i class="fab fa-amazon"></i>
                <span>Buy on Amazon</span>
                <small>${cleanTerm}</small>
            </a>`;
        }
    );
    
    // Create clickable eBay links
    formatted = formatted.replace(
        /eBay:\s*([^<\n]+)/g, 
        function(match, searchTerm) {
            const cleanTerm = searchTerm.replace(/[^\w\s-]/g, '').trim();
            const encodedTerm = encodeURIComponent(cleanTerm);
            return `<a href="https://www.ebay.com/sch/i.html?_nkw=${encodedTerm}" target="_blank" class="purchase-link ebay-link">
                <i class="fas fa-gavel"></i>
                <span>Buy on eBay</span>
                <small>${cleanTerm}</small>
            </a>`;
        }
    );
    
    // Create YouTube repair video links - specifically for part replacement
    formatted = formatted.replace(
        /YouTube:\s*"([^"]+)"/g, 
        function(match, searchTerm) {
            // Enhance search term to focus on replacement/repair
            const repairTerm = searchTerm + " replacement repair how to replace";
            const encodedTerm = encodeURIComponent(repairTerm);
            return `<a href="https://www.youtube.com/results?search_query=${encodedTerm}" target="_blank" class="video-link youtube-link">
                <i class="fab fa-youtube"></i>
                <span>Watch Repair Video</span>
                <small>How to replace: ${searchTerm}</small>
            </a>`;
        }
    );
    
    // Convert price ranges to highlighted spans
    formatted = formatted.replace(/\$(\d+)-\$(\d+)/g, '<span class="price-range">$$$1-$$$2</span>');
    formatted = formatted.replace(/\$(\d+)/g, '<span class="price">$$$1</span>');
    
    // Convert part numbers to highlighted spans
    formatted = formatted.replace(/([A-Z0-9]{6,})/g, '<span class="part-number">$1</span>');
    
    // Create problem cards for numbered issues
    formatted = formatted.replace(
        /(\d+\.\s+)([^\n:]+):\s*([^\n]+)/g,
        function(match, number, problemTitle, description) {
            return `
                <div class="problem-card">
                    <div class="problem-header">
                        <span class="problem-number">${number.replace('.', '')}</span>
                        <h4 class="problem-title">${problemTitle}</h4>
                    </div>
                    <p class="problem-description">${description}</p>
                </div>
            `;
        }
    );
    
    // Convert bullet points to styled lists
    formatted = formatted.replace(/^[\s]*[-•]\s+(.+)$/gm, '<li class="styled-bullet">$1</li>');
    
    // Wrap consecutive list items in styled ul
    formatted = formatted.replace(
        /(<li class="styled-bullet">.*?<\/li>)(\s*<li class="styled-bullet">.*?<\/li>)*/gs,
        function(match) {
            return '<ul class="styled-list">' + match + '</ul>';
        }
    );
    
    // Convert warranty info to special cards
    formatted = formatted.replace(
        /(Warranty Status|Warranty Information):\s*([^\n]+)/gi,
        function(match, title, info) {
            const isActive = info.toLowerCase().includes('active') || info.toLowerCase().includes('covered');
            const statusClass = isActive ? 'warranty-active' : 'warranty-expired';
            return `
                <div class="warranty-card ${statusClass}">
                    <div class="warranty-icon">
                        <i class="fas fa-shield-${isActive ? 'check' : 'times'}"></i>
                    </div>
                    <div class="warranty-content">
                        <h4>Warranty Status</h4>
                        <p>${info}</p>
                    </div>
                </div>
            `;
        }
    );
    
    // Convert age information to special cards
    formatted = formatted.replace(
        /(Age|Manufacturing Date|Estimated Age):\s*([^\n]+)/gi,
        function(match, title, ageInfo) {
            return `
                <div class="age-card">
                    <div class="age-icon">
                        <i class="fas fa-calendar-alt"></i>
                    </div>
                    <div class="age-content">
                        <h4>Appliance Age</h4>
                        <p class="age-value">${ageInfo}</p>
                    </div>
                </div>
            `;
        }
    );
    
    // Clean up and structure the content
    formatted = formatted
        .replace(/\n\n+/g, '</p><p>')  // Convert double newlines to paragraphs
        .replace(/\n/g, '<br>')        // Convert single newlines to breaks
        .replace(/^/, '<p>')           // Add opening paragraph
        .replace(/$/, '</p>')          // Add closing paragraph
        .replace(/<p><\/p>/g, '')      // Remove empty paragraphs
        .replace(/<p>(<h[234])/g, '$1') // Don't wrap headers in paragraphs
        .replace(/(<\/h[234]>)<\/p>/g, '$1') // Don't wrap headers in paragraphs
        .replace(/<p>(<div)/g, '$1')   // Don't wrap divs in paragraphs  
        .replace(/(<\/div>)<\/p>/g, '$1') // Don't wrap divs in paragraphs
        .replace(/<p>(<ul)/g, '$1')    // Don't wrap lists in paragraphs
        .replace(/(<\/ul>)<\/p>/g, '$1'); // Don't wrap lists in paragraphs
    
    return formatted;
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