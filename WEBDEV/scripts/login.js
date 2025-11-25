/* scripts/login.js */

// 1. Listen for the Submit button click
document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault(); // Stop the form from refreshing the page
    
    const btn = document.querySelector('.btn-login');
    
    // Change button text to show it's working
    btn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Entering...';
    btn.style.opacity = '0.8';
    
    // 2. Wait 1.5 seconds to simulate loading
    setTimeout(() => {
        // 3. Set the token to "active"
        localStorage.setItem('slsu_token', 'active');
        
        // 4. Go to the main website
        window.location.href = 'index.html';
    }, 1500);
});

// Check if user is already logged in
if(localStorage.getItem('slsu_token') === 'active') {
    window.location.href = 'index.html';
}