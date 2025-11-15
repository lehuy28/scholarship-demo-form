// ==================== GLOBAL STATE ====================
let formData = {};
let images = [];

// ==================== FIREBASE IMPORTS ====================
import { 
    collection, 
    addDoc, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('scholarshipForm');
    const imageUpload = document.getElementById('imageUpload');
    
    // Form validation on input
    form.querySelectorAll('input, select, textarea').forEach(field => {
        field.addEventListener('blur', () => validateField(field));
        field.addEventListener('input', () => {
            if (field.classList.contains('error')) validateField(field);
        });
    });
    
    // Form submit
    form.addEventListener('submit', handleSubmit);
    
    // Image upload
    imageUpload.addEventListener('change', handleImageUpload);
});

// ==================== VALIDATION ====================
function validateField(field) {
    const errorMsg = field.closest('.form-question')?.querySelector('.error-msg');
    let isValid = true;
    let message = '';
    
    // Required check
    if (field.hasAttribute('required') && !field.value.trim()) {
        if (field.type === 'radio') {
            const checked = document.querySelector(`input[name="${field.name}"]:checked`);
            if (!checked) {
                isValid = false;
                message = 'Vui lòng chọn một tùy chọn';
            }
        } else if (field.type === 'checkbox' && field.name === 'agreement') {
            if (!field.checked) {
                isValid = false;
                message = 'Bạn phải đồng ý với cam kết';
            }
        } else {
            isValid = false;
            message = 'Trường này là bắt buộc';
        }
    }
    
    // Email validation
    if (field.type === 'email' && field.value && !isValidEmail(field.value)) {
        isValid = false;
        message = 'Email không hợp lệ';
    }
    
    // Phone validation
    if (field.name === 'phone' && field.value && !isValidPhone(field.value)) {
        isValid = false;
        message = 'Số điện thoại phải có 10-11 số và bắt đầu bằng 0';
    }
    
    // Student ID validation
    if (field.name === 'studentId' && field.value && !isValidStudentId(field.value)) {
        isValid = false;
        message = 'Mã SV phải có dạng XX1234 (2 chữ + số)';
    }
    
    // GPA validation
    if (field.name === 'gpa' && field.value) {
        const gpa = parseFloat(field.value);
        if (gpa < 0 || gpa > 4) {
            isValid = false;
            message = 'GPA phải từ 0.00 đến 4.00';
        }
    }
    
    // URL validation
    if (field.type === 'url' && field.value && !isValidURL(field.value)) {
        isValid = false;
        message = 'URL không hợp lệ';
    }
    
    // Update UI
    if (isValid) {
        field.classList.remove('error');
        if (errorMsg) errorMsg.textContent = '';
    } else {
        field.classList.add('error');
        if (errorMsg) errorMsg.textContent = message;
    }
    
    return isValid;
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone) {
    return /^0\d{9,10}$/.test(phone);
}

function isValidStudentId(id) {
    return /^[A-Z]{2}\d{4,8}$/i.test(id);
}

function isValidURL(url) {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

// ==================== FORM SUBMISSION ====================
async function handleSubmit(e) {
    e.preventDefault();
    
    const form = e.target;
    const submitBtn = document.getElementById('submitBtn');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoading = submitBtn.querySelector('.btn-loading');
    const formElements = form.querySelectorAll('input, select, textarea');
    let isValid = true;
    
    // Validate all fields
    formElements.forEach(field => {
        if (!validateField(field)) isValid = false;
    });
    
    if (!isValid) {
        // Scroll to first error
        const firstError = form.querySelector('.error');
        if (firstError) {
            firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
    }
    
    // Show loading
    submitBtn.disabled = true;
    btnText.style.display = 'none';
    btnLoading.style.display = 'inline';
    
    try {
        // Collect form data
        collectFormData(form);
        
        // Calculate score
        const score = calculateScore();
        formData.score = score;
        formData.submittedAt = new Date().toISOString();
        formData.createdAt = serverTimestamp();
        
        // Save to Firebase
        const docRef = await addDoc(collection(window.db, 'scholarships'), formData);
        
        console.log('✅ Document written with ID:', docRef.id);
        console.log('📋 Form Data:', formData);
        console.log('🖼️ Images:', images);
        
        // Show success modal
        showSuccessModal(score);
        
        // Reset form
        form.reset();
        images = [];
        document.getElementById('imagePreview').innerHTML = '';
        document.getElementById('achievementsList').innerHTML = 
            '<input type="text" class="achievement-input" placeholder="VD: Giải nhất Olympic Tin học sinh viên 2024">';
        document.getElementById('evidenceList').innerHTML = 
            '<input type="url" class="evidence-input" placeholder="https://drive.google.com/...">';
        
    } catch (error) {
        console.error('❌ Error adding document:', error);
        alert('Có lỗi xảy ra khi nộp đơn. Vui lòng thử lại!\n\nLỗi: ' + error.message);
    } finally {
        // Hide loading
        submitBtn.disabled = false;
        btnText.style.display = 'inline';
        btnLoading.style.display = 'none';
    }
}

function collectFormData(form) {
    formData = {};
    
    // Get all form elements
    const formElements = form.querySelectorAll('input, select, textarea');
    
    formElements.forEach(field => {
        const name = field.name;
        if (!name) return;
        
        if (field.type === 'checkbox') {
            if (name === 'situation') {
                if (!formData.situations) formData.situations = [];
                if (field.checked) formData.situations.push(field.value);
            } else if (name === 'agreement') {
                formData.agreement = field.checked;
            }
        } else if (field.type === 'radio') {
            if (field.checked) formData[name] = field.value;
        } else if (field.type !== 'file') {
            formData[name] = field.value;
        }
    });
    
    // Collect achievements
    const achievements = [];
    document.querySelectorAll('.achievement-input').forEach(input => {
        if (input.value.trim()) achievements.push(input.value.trim());
    });
    formData.achievements = achievements;
    
    // Collect evidence links
    const evidences = [];
    document.querySelectorAll('.evidence-input').forEach(input => {
        if (input.value.trim()) evidences.push(input.value.trim());
    });
    formData.evidences = evidences;
    
    // Add image info (not actual data, just metadata)
    formData.imageCount = images.length;
    formData.imageNames = images.map(img => img.name);
}

// ==================== SCORING ====================
function calculateScore() {
    let score = 0;
    
    // GPA (40 points)
    const gpa = parseFloat(formData.gpa) || 0;
    score += (gpa / 4.0) * 40;
    
    // Academic Rank (10 points)
    const rankScores = { excellent: 10, good: 7, fair: 5, average: 3 };
    score += rankScores[formData.rank] || 0;
    
    // Family Income (15 points)
    const income = parseInt(formData.income) || 0;
    if (income < 3000000) score += 15;
    else if (income < 5000000) score += 10;
    else if (income < 8000000) score += 5;
    else score += 2;
    
    // Special Situations (10 points)
    const situations = formData.situations?.length || 0;
    score += Math.min(situations * 2, 10);
    
    // Achievements (15 points)
    const achievements = formData.achievements?.length || 0;
    score += Math.min(achievements * 3, 15);
    
    // Evidence Links (10 points)
    const evidences = formData.evidences?.length || 0;
    score += Math.min(evidences * 2, 10);
    
    return Math.round(score);
}

// ==================== DYNAMIC FIELDS ====================
window.addAchievement = function() {
    const list = document.getElementById('achievementsList');
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'achievement-input';
    input.placeholder = 'VD: Giải nhất Olympic Tin học sinh viên 2024';
    list.appendChild(input);
    input.focus();
}

window.addEvidence = function() {
    const list = document.getElementById('evidenceList');
    const input = document.createElement('input');
    input.type = 'url';
    input.className = 'evidence-input';
    input.placeholder = 'https://drive.google.com/...';
    list.appendChild(input);
    input.focus();
}

// ==================== IMAGE UPLOAD ====================
function handleImageUpload(e) {
    const files = Array.from(e.target.files);
    const preview = document.getElementById('imagePreview');
    
    files.forEach(file => {
        if (!file.type.startsWith('image/')) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = {
                name: file.name,
                size: file.size,
                data: event.target.result
            };
            images.push(img);
            
            // Create preview
            const div = document.createElement('div');
            div.className = 'preview-item';
            div.innerHTML = `
                <img src="${img.data}" alt="${img.name}">
                <button type="button" class="preview-remove" onclick="removeImage(${images.length - 1})">×</button>
            `;
            preview.appendChild(div);
        };
        reader.readAsDataURL(file);
    });
}

window.removeImage = function(index) {
    images.splice(index, 1);
    
    // Rebuild preview
    const preview = document.getElementById('imagePreview');
    preview.innerHTML = '';
    images.forEach((img, i) => {
        const div = document.createElement('div');
        div.className = 'preview-item';
        div.innerHTML = `
            <img src="${img.data}" alt="${img.name}">
            <button type="button" class="preview-remove" onclick="removeImage(${i})">×</button>
        `;
        preview.appendChild(div);
    });
}

// ==================== MODAL ====================
function showSuccessModal(score) {
    const modal = document.getElementById('modal');
    const scoreValue = document.getElementById('scoreValue');
    const scoreText = document.getElementById('scoreText');
    
    scoreValue.textContent = score;
    
    // Score description
    let text = '';
    if (score >= 85) text = '🎉 Xuất sắc! Bạn có khả năng cao được nhận học bổng.';
    else if (score >= 70) text = '👍 Tốt! Hồ sơ của bạn đạt yêu cầu xét học bổng.';
    else if (score >= 55) text = '📝 Khá! Bạn có cơ hội được xét học bổng.';
    else text = '💪 Hồ sơ cần cải thiện để tăng cơ hội nhận học bổng.';
    
    scoreText.textContent = text;
    modal.classList.add('show');
}

window.closeModal = function() {
    document.getElementById('modal').classList.remove('show');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Close modal on backdrop click
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('show');
    }
});

// ==================== UTILITY ====================
window.clearForm = function() {
    if (!confirm('Bạn có chắc muốn xóa toàn bộ form?')) return;
    
    const form = document.getElementById('scholarshipForm');
    form.reset();
    
    // Clear errors
    form.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
    form.querySelectorAll('.error-msg').forEach(el => el.textContent = '');
    
    // Reset dynamic fields
    document.getElementById('achievementsList').innerHTML = 
        '<input type="text" class="achievement-input" placeholder="VD: Giải nhất Olympic Tin học sinh viên 2024">';
    document.getElementById('evidenceList').innerHTML = 
        '<input type="url" class="evidence-input" placeholder="https://drive.google.com/...">';
    
    // Clear images
    images = [];
    document.getElementById('imagePreview').innerHTML = '';
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}