// DOM Elements
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const previewSection = document.getElementById('previewSection');
const imagesGrid = document.getElementById('imagesGrid');
const fileCount = document.getElementById('fileCount');
const customQuestion = document.getElementById('customQuestion');
const analyzeBtn = document.getElementById('analyzeBtn');
const paymentSection = document.getElementById('paymentSection');
const backToPreviewBtn = document.getElementById('backToPreview');
const loadingSection = document.getElementById('loadingSection');
const loadingMessage = document.getElementById('loadingMessage');
const loadingSubtext = document.getElementById('loadingSubtext');
const resultsSection = document.getElementById('resultsSection');
const analysisContent = document.getElementById('analysisContent');
const errorSection = document.getElementById('errorSection');
const errorMessage = document.getElementById('errorMessage');
const retryBtn = document.getElementById('retryBtn');
const newAnalysisBtn = document.getElementById('newAnalysisBtn');
const uploadSection = document.getElementById('uploadSection');

let currentFiles = [];
const MAX_FILES = 5;
let currentPaymentIntentId = null;

// Initialize Stripe (using config file)
const stripe = Stripe(CONFIG.STRIPE_PUBLISHABLE_KEY);
const elements = stripe.elements();
const cardElement = elements.create('card', {
    style: {
        base: {
            fontSize: '16px',
            color: '#424770',
            '::placeholder': {
                color: '#aab7c4',
            },
        },
        invalid: {
            color: '#9e2146',
        },
    },
});

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    
    // Mount Stripe card element
    if (document.getElementById('card-element')) {
        cardElement.mount('#card-element');
        
        // Handle real-time validation errors from the card Element
        cardElement.on('change', function(event) {
            const displayError = document.getElementById('card-errors');
            if (event.error) {
                displayError.textContent = event.error.message;
            } else {
                displayError.textContent = '';
            }
        });
    }
});

function initializeEventListeners() {
    // File input change
    fileInput.addEventListener('change', handleFileSelect);
    
    // Drag and drop events
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragenter', handleDragEnter);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);
    
    // Button clicks
    analyzeBtn.addEventListener('click', showPaymentForm);
    backToPreviewBtn.addEventListener('click', backToPreview);
    retryBtn.addEventListener('click', retryAnalysis);
    newAnalysisBtn.addEventListener('click', startNewAnalysis);
    
    // Payment form
    const paymentForm = document.getElementById('payment-form');
    paymentForm.addEventListener('submit', handlePaymentSubmit);
    
    // Prevent default drag behavior
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });
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
    }
    
    // Clear the input so the same files can be selected again if needed
    fileInput.value = '';
}

function displayFilePreviews() {
    // Clear existing previews
    imagesGrid.innerHTML = '';
    
    // Create preview for each file
    currentFiles.forEach((file, index) => {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            const previewDiv = document.createElement('div');
            previewDiv.className = 'image-preview';
            previewDiv.innerHTML = `
                <img src="${e.target.result}" alt="Appliance ${index + 1}">
                <div class="preview-overlay">
                    <button class="remove-btn" onclick="removeFile(${index})">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="file-info">
                    ${file.name} (${formatFileSize(file.size)})
                </div>
            `;
            imagesGrid.appendChild(previewDiv);
        };
        
        reader.readAsDataURL(file);
    });
    
    // Update file count
    updateFileCount();
    
    // Show preview section
    uploadArea.style.display = 'none';
    previewSection.style.display = 'block';
    hideAllSections();
}

// Make removeFile global so it can be called from onclick handlers
window.removeFile = function(index) {
    currentFiles.splice(index, 1);
    
    if (currentFiles.length === 0) {
        // Show upload area again
        uploadArea.style.display = 'block';
        previewSection.style.display = 'none';
        hideAllSections();
    } else {
        // Refresh previews
        displayFilePreviews();
    }
}

function updateFileCount() {
    const count = currentFiles.length;
    if (count === 0) {
        fileCount.textContent = 'No photos selected';
    } else if (count === 1) {
        fileCount.textContent = '1 appliance selected';
    } else {
        fileCount.textContent = `${count} appliances selected (${MAX_FILES - count} slots remaining)`;
    }
}

// This function is now replaced by displayFilePreviews()

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// removeFile function now takes an index parameter and is defined above

function showPaymentForm() {
    if (currentFiles.length === 0) {
        showError('Please select at least one appliance photo first.');
        return;
    }
    
    // TEMPORARY: Skip payment for testing - REMOVE THIS LATER
    const TESTING_MODE = true; // Set to false to enable payments
    
    if (TESTING_MODE) {
        // Skip payment and go straight to analysis
        currentPaymentIntentId = 'test_payment_' + Date.now(); // Fake payment ID for testing
        analyzeAppliance();
        return;
    }
    
    hideAllSections();
    uploadSection.style.display = 'none';
    paymentSection.style.display = 'block';
}

function backToPreview() {
    hideAllSections();
    uploadSection.style.display = 'block';
    previewSection.style.display = 'block';
}

async function handlePaymentSubmit(event) {
    event.preventDefault();
    
    const submitButton = document.getElementById('submit-payment');
    const cardErrors = document.getElementById('card-errors');
    
    submitButton.disabled = true;
    submitButton.textContent = 'Processing...';
    cardErrors.textContent = '';
    
    try {
        // Create payment intent
        const response = await fetch('/.netlify/functions/create-payment-intent', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        const { clientSecret } = await response.json();
        
        // Confirm payment with Stripe
        const result = await stripe.confirmCardPayment(clientSecret, {
            payment_method: {
                card: cardElement
            }
        });
        
        if (result.error) {
            // Show error to customer
            cardErrors.textContent = result.error.message;
        } else {
            // Payment successful
            currentPaymentIntentId = result.paymentIntent.id;
            await analyzeAppliance();
        }
    } catch (error) {
        console.error('Payment error:', error);
        cardErrors.textContent = 'Payment failed. Please try again.';
    }
    
    submitButton.disabled = false;
    submitButton.innerHTML = '<i class="fas fa-shield-alt"></i> Pay $2.99 & Analyze';
}

async function analyzeAppliance() {
    if (currentFiles.length === 0 || !currentPaymentIntentId) {
        showError('Payment required. Please complete payment first.');
        return;
    }
    
    // Show loading state
    const applianceText = currentFiles.length === 1 ? 'appliance' : 'appliances';
    showLoading(`Analyzing your ${applianceText}...`, `Our AI is examining ${currentFiles.length} photo${currentFiles.length > 1 ? 's' : ''} to provide detailed insights`);
    
    try {
        const formData = new FormData();
        
        // Add all photos with consistent naming
        currentFiles.forEach((file, index) => {
            formData.append('photos', file); // Use array-style naming
            console.log(`Adding photo ${index + 1}:`, file.name); // Debug log
        });
        
        // NUCLEAR OPTION: Encode custom question in URL parameter instead of multipart body
        const question = customQuestion.value.trim();
        let endpoint = window.location.hostname.includes('netlify') || window.location.hostname.includes('localhost') === false
            ? '/.netlify/functions/analyze-appliance' 
            : '/analyze-appliance';
            
        if (question) {
            // Encode the question in the URL to bypass multipart parsing issues
            const encodedQuestion = encodeURIComponent(question);
            endpoint += `?custom_question=${encodedQuestion}`;
            console.log('Adding custom question to URL:', question); // Debug log
            console.log('Encoded URL:', endpoint); // Debug log
        } else {
            console.log('No custom question provided'); // Debug log
        }
        
        formData.append('payment_intent_id', currentPaymentIntentId);
        formData.append('total_files', currentFiles.length.toString());
        
        // Use the endpoint with encoded question (if any)
        const response = await fetch(endpoint, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            showResults(result.analysis);
        } else if (result.requiresPayment) {
            // Reset and show payment form again
            currentPaymentIntentId = null;
            showError('Payment verification failed. Please try payment again.');
            setTimeout(() => showPaymentForm(), 2000);
        } else {
            throw new Error(result.error || 'Failed to analyze appliances');
        }
        
    } catch (error) {
        console.error('Analysis error:', error);
        showError(error.message || 'Failed to analyze appliances. Please try again.');
    }
}

function showLoading(message = 'Processing payment...', subtext = 'Please wait while we process your payment') {
    hideAllSections();
    uploadSection.style.display = 'none';
    loadingMessage.textContent = message;
    loadingSubtext.textContent = subtext;
    loadingSection.style.display = 'block';
    
    // Disable analyze button
    analyzeBtn.disabled = true;
}

function showResults(analysis) {
    hideAllSections();
    uploadSection.style.display = 'none';
    
    // Format and display analysis with proper HTML formatting
    const formattedAnalysis = formatAnalysisText(analysis);
    analysisContent.innerHTML = formattedAnalysis;
    resultsSection.style.display = 'block';
    
    // Re-enable analyze button
    analyzeBtn.disabled = false;
}

function formatAnalysisText(text) {
    // Convert markdown-style formatting to HTML
    let formatted = text
        // Convert ## headers to h2
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        // Convert ### headers to h3
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        // Convert **bold** text
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        // Convert [link](url) to proper links
        .replace(/\[(.+?)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
        // Convert bullet points
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        // Handle dividers
        .replace(/^---$/gm, '<hr class="divider">')
        // Convert newlines to <br> and paragraphs
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');

    // Wrap in paragraph tags
    formatted = '<p>' + formatted + '</p>';
    
    // Fix empty paragraphs
    formatted = formatted.replace(/<p><\/p>/g, '');
    formatted = formatted.replace(/<p><br>/g, '<p>');
    formatted = formatted.replace(/<br><\/p>/g, '</p>');
    
    // Wrap consecutive list items in ul tags
    formatted = formatted.replace(/(<li>.*?<\/li>)(?:\s*<br>\s*<li>.*?<\/li>)*/g, function(match) {
        const items = match.match(/<li>.*?<\/li>/g) || [];
        return '<ul>' + items.join('') + '</ul>';
    });
    
    // Clean up any remaining <br> tags around headers and lists
    formatted = formatted.replace(/<br>\s*(<h[23]>)/g, '$1');
    formatted = formatted.replace(/(<\/h[23]>)\s*<br>/g, '$1');
    formatted = formatted.replace(/<br>\s*(<ul>)/g, '$1');
    formatted = formatted.replace(/(<\/ul>)\s*<br>/g, '$1');
    
    // Special handling for business section
    formatted = formatted.replace(
        /(## 🏢 PROFESSIONAL SERVICES.*?)(<hr class="divider">)/s,
        '<div class="business-section">$1</div>$2'
    );
    
    // Add footer class to the last line
    formatted = formatted.replace(
        /(<p>\*Analysis provided by AI-powered appliance assessment technology\*<\/p>)/,
        '<div class="analysis-footer">$1</div>'
    );
    
    return formatted;
}

function showError(message) {
    hideAllSections();
    errorMessage.textContent = message;
    errorSection.style.display = 'block';
    
    // Re-enable analyze button
    analyzeBtn.disabled = false;
}

function hideAllSections() {
    paymentSection.style.display = 'none';
    loadingSection.style.display = 'none';
    resultsSection.style.display = 'none';
    errorSection.style.display = 'none';
}

function retryAnalysis() {
    if (currentFile) {
        analyzeAppliance();
    } else {
        startNewAnalysis();
    }
}

function startNewAnalysis() {
    // Reset everything
    currentPaymentIntentId = null;
    currentFiles = [];
    customQuestion.value = '';
    imagesGrid.innerHTML = '';
    hideAllSections();
    uploadSection.style.display = 'block';
    uploadArea.style.display = 'block';
    previewSection.style.display = 'none';
    analyzeBtn.disabled = false;
}

// Utility functions
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">&times;</button>
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Add some additional CSS for notifications
const notificationStyles = `
    <style>
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        border-radius: 8px;
        padding: 15px 20px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        display: flex;
        align-items: center;
        justify-content: space-between;
        z-index: 1000;
        min-width: 300px;
        animation: slideInRight 0.3s ease;
    }
    
    .notification-error {
        border-left: 4px solid #ff4757;
    }
    
    .notification-success {
        border-left: 4px solid #2ed573;
    }
    
    .notification-info {
        border-left: 4px solid #667eea;
    }
    
    .notification button {
        background: none;
        border: none;
        font-size: 1.2rem;
        cursor: pointer;
        color: #999;
        margin-left: 15px;
    }
    
    .notification button:hover {
        color: #333;
    }
    
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
    </style>
`;

document.head.insertAdjacentHTML('beforeend', notificationStyles);

// Handle online/offline status
window.addEventListener('online', () => {
    showNotification('Connection restored!', 'success');
});

window.addEventListener('offline', () => {
    showNotification('Connection lost. Please check your internet connection.', 'error');
}); 