// Admin credentials (using array/list)
const adminAccounts = [
    { username: "admin", password: "admin123" },
    { username: "manager", password: "manager123" }
];

// Employee registry (stores registered employees)
let employeeRegistry = JSON.parse(localStorage.getItem('employees')) || [];

// Toggle Views
function showLogin() {
    document.getElementById('homeSection').style.display = 'none';
    document.getElementById('registerSection').style.display = 'none';
    document.getElementById('loginSection').style.display = 'block';
}

function showRegister() {
    document.getElementById('homeSection').style.display = 'none';
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('registerSection').style.display = 'block';
    document.getElementById('successMessage').style.display = 'none';
}

// Handle Employee Registration
const registerForm = document.getElementById('registerForm');
if (registerForm) {
    registerForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const firstName = document.getElementById('firstName').value;
        const lastName = document.getElementById('lastName').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        // Create new employee object
        const newEmployee = {
            id: Date.now(),
            firstName: firstName,
            lastName: lastName,
            email: email,
            password: password
        };

        // Add to registry
        employeeRegistry.push(newEmployee);
        localStorage.setItem('employees', JSON.stringify(employeeRegistry));

        // Show success message
        const successMessage = document.getElementById('successMessage');
        successMessage.style.display = 'block';

        // Clear form
        registerForm.reset();

        // Reset after 2 seconds
        setTimeout(() => {
            document.getElementById('homeSection').style.display = 'block';
            document.getElementById('registerSection').style.display = 'none';
            document.getElementById('successMessage').style.display = 'none';
        }, 2000);
    });
}

// Handle Login
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        // Check if employee exists
        const employee = employeeRegistry.find(emp => 
            emp.email === email && emp.password === password
        );

        if (employee) {
            localStorage.setItem('loggedInEmployee', JSON.stringify(employee));
            alert('Login successful!');
            document.getElementById('homeSection').style.display = 'block';
            document.getElementById('loginSection').style.display = 'none';
            loginForm.reset();
        } else {
            alert('Invalid email or password');
            document.getElementById('loginPassword').value = '';
        }
    });
}
