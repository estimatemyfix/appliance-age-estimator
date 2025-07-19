// DOM Elements
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const previewSection = document.getElementById('previewSection');
const previewImage = document.getElementById('previewImage');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const removeBtn = document.getElementById('removeBtn');
const analyzeBtn = document.getElementById('analyzeBtn');
const loadingSection = document.getElementById('loadingSection');
const resultsSection = document.getElementById('resultsSection');
const analysisContent = document.getElementById('analysisContent');
const errorSection = document.getElementById('errorSection');
const errorMessage = document.getElementById('errorMessage');
const retryBtn = document.getElementById('retryBtn');
const newAnalysisBtn = document.getElementById('newAnalysisBtn');
const uploadSection = document.getElementById('uploadSection');

let currentFile = null;

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
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
    removeBtn.addEventListener('click', removeFile);
    analyzeBtn.addEventListener('click', analyzeAppliance);
    retryBtn.addEventListener('click', retryAnalysis);
    newAnalysisBtn.addEventListener('click', startNewAnalysis);
    
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
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        handleFile(file);
    }
}

function handleFile(file) {
    // Validate file type
    if (!file.type.startsWith('image/')) {
        showError('Please select a valid image file.');
        return;
    }
    
    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
        showError('File size too large. Please select an image smaller than 10MB.');
        return;
    }
    
    currentFile = file;
    displayFilePreview(file);
}

function displayFilePreview(file) {
    const reader = new FileReader();
    
    reader.onload = function(e) {
        previewImage.src = e.target.result;
        fileName.textContent = `📁 ${file.name}`;
        fileSize.textContent = `📏 ${formatFileSize(file.size)}`;
        
        // Hide upload area and show preview
        uploadArea.style.display = 'none';
        previewSection.style.display = 'block';
        
        // Hide other sections
        hideAllSections();
    };
    
    reader.readAsDataURL(file);
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function removeFile() {
    currentFile = null;
    fileInput.value = '';
    previewImage.src = '';
    
    // Show upload area and hide preview
    uploadArea.style.display = 'block';
    previewSection.style.display = 'none';
    
    // Hide other sections
    hideAllSections();
}

async function analyzeAppliance() {
    if (!currentFile) {
        showError('Please select a file first.');
        return;
    }
    
    // Show loading state
    showLoading();
    
    try {
        const formData = new FormData();
        formData.append('photo', currentFile);
        
        // Try Netlify function first, fallback to local server
        const endpoint = window.location.hostname.includes('netlify') || window.location.hostname.includes('localhost') === false
            ? '/.netlify/functions/analyze-appliance' 
            : '/analyze-appliance';
            
        const response = await fetch(endpoint, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            showResults(result.analysis);
        } else {
            throw new Error(result.error || 'Failed to analyze appliance');
        }
        
    } catch (error) {
        console.error('Analysis error:', error);
        showError(error.message || 'Failed to analyze appliance. Please try again.');
    }
}

function showLoading() {
    hideAllSections();
    uploadSection.style.display = 'none';
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
    removeFile();
    hideAllSections();
    uploadSection.style.display = 'block';
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