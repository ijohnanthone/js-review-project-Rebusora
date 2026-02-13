// ================= ADMIN ACCOUNTS =================
const adminAccounts = [
    { username: "admin", password: "admin123" },
    { username: "manager", password: "manager123" }
];

// ================= EMPLOYEE STORAGE =================
let employeeRegistry = JSON.parse(localStorage.getItem('employees')) || [];

// ================= VIEW FUNCTIONS =================
function showHome() {
    document.getElementById('homeSection').style.display = 'block';
    document.getElementById('registerSection').style.display = 'none';
    document.getElementById('loginSection').style.display = 'none';
}

function showRegister() {
    document.getElementById('homeSection').style.display = 'none';
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('registerSection').style.display = 'block';
    document.getElementById('successMessage').style.display = 'none';
}

function showLogin() {
    document.getElementById('homeSection').style.display = 'none';
    document.getElementById('registerSection').style.display = 'none';
    document.getElementById('loginSection').style.display = 'block';
}

// ================= DOM READY =================
document.addEventListener('DOMContentLoaded', function () {

    // REGISTER
    const registerForm = document.getElementById('registerForm');

    registerForm.addEventListener('submit', function (e) {
        e.preventDefault();

        const firstName = document.getElementById('firstName').value;
        const lastName = document.getElementById('lastName').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        const newEmployee = {
            id: Date.now(),
            firstName,
            lastName,
            email,
            password
        };

        employeeRegistry.push(newEmployee);
        localStorage.setItem('employees', JSON.stringify(employeeRegistry));

        document.getElementById('successMessage').style.display = 'block';
        registerForm.reset();

        setTimeout(() => {
            showHome();
        }, 2000);
    });


    // LOGIN
    const loginForm = document.getElementById('loginForm');

    loginForm.addEventListener('submit', function (e) {
        e.preventDefault();

        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        const employee = employeeRegistry.find(emp =>
            emp.email === email && emp.password === password
        );

        if (employee) {
            localStorage.setItem('loggedInEmployee', JSON.stringify(employee));
            alert('Login successful!');
            showHome();
            loginForm.reset();
        } else {
            alert('Invalid email or password');
            document.getElementById('loginPassword').value = '';
        }
    });

});
