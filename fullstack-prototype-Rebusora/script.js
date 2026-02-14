const KEYS = {
  storage: "ipt_demo_v1",
  legacyAccounts: "db_accounts",
  legacySession: "loggedInEmployee",
  authToken: "auth_token",
  unverified: "unverified_email"
};

const ROUTES = {
  "#/home": "homeSection",
  "#/register": "registerSection",
  "#/login": "loginSection",
  "#/profile": "profileSection",
  "#/requests": "requestsSection",
  "#/employees": "employeesSection",
  "#/accounts": "accountsSection",
  "#/departments": "departmentsSection"
};

const SEEDED_ADMINS = [
  { id: 9001, firstName: "System", lastName: "Admin", email: "admin@app.local", password: "admin123", role: "admin", verified: true },
  { id: 9002, firstName: "Team", lastName: "Manager", email: "manager@app.local", password: "manager123", role: "admin", verified: true }
];

const SEEDED_DEPARTMENTS = [
  { id: 1, name: "Engineering", description: "Software team" },
  { id: 2, name: "HR", description: "Human Resources" }
];

const state = { db: { accounts: [], departments: [], employees: [], requests: [] } };
const $ = (id) => document.getElementById(id);
const toEmail = (v) => String(v || "").trim().toLowerCase();

const normalizeAccount = (a) => ({ ...a, email: toEmail(a.email), role: a.role || "user", verified: typeof a.verified === "boolean" ? a.verified : true });
const normalizeDepartment = (d) => ({ id: d.id || Date.now(), name: String(d.name || "").trim(), description: String(d.description || "").trim() });
const normalizeEmployee = (e) => ({ id: e.id || Date.now(), userEmail: toEmail(e.userEmail), departmentId: Number(e.departmentId), position: String(e.position || "").trim(), hireDate: String(e.hireDate || "").trim() });
const normalizeRequest = (r) => ({ id: r.id || Date.now(), employeeEmail: toEmail(r.employeeEmail), type: r.type || "Equipment", items: Array.isArray(r.items) ? r.items : [], status: r.status || "pending", createdAt: r.createdAt || Date.now() });

function readJSON(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }
function readArray(key) { const v = readJSON(key); return Array.isArray(v) ? v : []; }

function dedupeAccounts(accounts) {
  const seen = new Set();
  return accounts.filter((a) => {
    if (!a.email || seen.has(a.email)) return false;
    seen.add(a.email);
    return true;
  });
}

function saveDB() {
  localStorage.setItem(KEYS.storage, JSON.stringify(state.db));
  localStorage.setItem(KEYS.legacyAccounts, JSON.stringify(state.db.accounts));
}

function showToast(message, type = "info") {
  const container = $("appToastContainer");
  if (!container || !window.bootstrap) return;
  const tone = ({ success: "text-bg-success", warning: "text-bg-warning", danger: "text-bg-danger", info: "text-bg-primary" })[type] || "text-bg-primary";
  const closeClass = type === "warning" ? "btn-close" : "btn-close btn-close-white";
  const toast = document.createElement("div");
  toast.className = `toast align-items-center border-0 ${tone}`;
  toast.setAttribute("role", "alert");
  toast.setAttribute("aria-live", "assertive");
  toast.setAttribute("aria-atomic", "true");
  toast.innerHTML = `<div class="d-flex"><div class="toast-body">${message}</div><button type="button" class="${closeClass} me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button></div>`;
  container.appendChild(toast);
  const inst = new window.bootstrap.Toast(toast, { delay: 2200 });
  toast.addEventListener("hidden.bs.toast", () => toast.remove());
  inst.show();
}

function initDB() {
  const stored = readJSON(KEYS.storage) || {};
  const migrated = dedupeAccounts([
    ...readArray(KEYS.legacyAccounts).map(normalizeAccount),
    ...readArray("employees").map((e) => normalizeAccount({ ...e, role: "user", verified: true })),
    ...(Array.isArray(stored.accounts) ? stored.accounts.map(normalizeAccount) : [])
  ]);
  state.db.accounts = migrated.some((a) => a.role === "admin") ? migrated : [...SEEDED_ADMINS.map(normalizeAccount), ...migrated];
  state.db.departments = Array.isArray(stored.departments) && stored.departments.length ? stored.departments.map(normalizeDepartment) : SEEDED_DEPARTMENTS.map(normalizeDepartment);
  state.db.employees = Array.isArray(stored.employees) ? stored.employees.map(normalizeEmployee) : [];
  state.db.requests = Array.isArray(stored.requests) ? stored.requests.map(normalizeRequest) : [];
  saveDB();
}

function getCurrentUser() {
  const byToken = state.db.accounts.find((a) => a.email === toEmail(localStorage.getItem(KEYS.authToken)));
  if (byToken) return byToken;
  const legacy = readJSON(KEYS.legacySession);
  return legacy?.email ? state.db.accounts.find((a) => a.email === toEmail(legacy.email)) || null : null;
}

function setSession(user) {
  localStorage.setItem(KEYS.authToken, user.email);
  localStorage.setItem(KEYS.legacySession, JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem(KEYS.authToken);
  localStorage.removeItem(KEYS.legacySession);
}

function setAuthState(user) {
  const isAuth = Boolean(user);
  document.body.classList.toggle("not-authenticated", !isAuth);
  document.body.classList.toggle("authenticated", isAuth);
  document.body.classList.toggle("is-authenticated", isAuth);
  document.body.classList.toggle("is-admin", Boolean(isAuth && user.role === "admin"));
}

function renderProfile(user) {
  const node = $("profileMessage");
  if (!node) return;
  node.textContent = user ? `Logged in as ${user.firstName} ${user.lastName} (${user.email}) [${user.role}]` : "No active user.";
}

function renderVerifyBlock() {
  const box = $("verifyInlineBox");
  const msg = $("verifyEmailMessage");
  const btn = $("simulateVerifyBtn");
  if (!box || !msg || !btn) return;
  const pending = localStorage.getItem(KEYS.unverified);
  if (!pending) {
    box.style.display = "none";
    msg.textContent = "No pending verification.";
    btn.disabled = true;
    return;
  }
  box.style.display = "block";
  msg.textContent = `Pending verification for: ${pending}`;
  btn.disabled = false;
}

function normalizeHash(hash) { return ROUTES[hash] ? hash : "#/home"; }
function guardHash(hash, user) {
  const protectedRoutes = new Set(["#/profile", "#/requests", "#/employees", "#/accounts", "#/departments"]);
  const adminRoutes = new Set(["#/employees", "#/accounts", "#/departments"]);
  if (protectedRoutes.has(hash) && !user) return "#/home";
  if (adminRoutes.has(hash) && user && user.role !== "admin") return "#/home";
  return hash;
}

function setActiveRoute(hash) {
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
  const pageId = ROUTES[hash];
  if ($(pageId)) $(pageId).classList.add("active");
  document.querySelectorAll(".nav-link").forEach((l) => l.classList.remove("route-active"));
  const link = document.querySelector(`.nav-link[href='${hash}']`);
  if (link) link.classList.add("route-active");
}

function accountDisplayName(email) {
  const acc = state.db.accounts.find((a) => a.email === email);
  return acc ? `${acc.firstName || ""} ${acc.lastName || ""} (${acc.email})`.trim() : email;
}

function departmentNameById(id) {
  return state.db.departments.find((d) => Number(d.id) === Number(id))?.name || "Unknown";
}

function renderAccountsTable(currentUser) {
  const tbody = $("accountsTableBody");
  if (!tbody) return;
  tbody.innerHTML = state.db.accounts.map((a) => `<tr><td>${a.firstName || ""} ${a.lastName || ""}</td><td>${a.email}</td><td>${a.role}</td><td>${a.verified ? "Yes" : "No"}</td><td><button class="btn btn-sm btn-outline-success me-1" data-account-action="edit" data-email="${a.email}">Edit</button><button class="btn btn-sm btn-outline-primary me-1" data-account-action="reset" data-email="${a.email}">Reset Password</button><button class="btn btn-sm btn-outline-danger" data-account-action="delete" data-email="${a.email}">Delete</button></td></tr>`).join("");
  tbody.querySelectorAll("button[data-account-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.getAttribute("data-account-action");
      const email = toEmail(btn.getAttribute("data-email"));
      const target = state.db.accounts.find((a) => a.email === email);
      if (!target) return;
      if (action === "edit") { fillAccountForm(target); return; }
      if (action === "reset") {
        const pw = prompt(`New password for ${target.email} (min 6 chars):`);
        if (pw === null) return;
        if (pw.length < 6) return showToast("Password must be at least 6 characters.", "warning");
        target.password = pw; saveDB(); showToast("Password updated.", "success"); return;
      }
      if (currentUser && currentUser.email === target.email && currentUser.role === "admin") return showToast("Safety rule: admin cannot delete their own account.", "warning");
      if (!confirm(`Delete account: ${target.email}?`)) return;
      state.db.accounts = state.db.accounts.filter((a) => a.email !== target.email);
      state.db.employees = state.db.employees.filter((e) => e.userEmail !== target.email);
      if (localStorage.getItem(KEYS.unverified) === target.email) localStorage.removeItem(KEYS.unverified);
      saveDB();
      renderVerifyBlock();
      renderAccountsTable(currentUser);
      populateEmployeeOptions();
      renderEmployeesTable();
    });
  });
}

function resetAccountForm() {
  if ($("accountEditEmail")) $("accountEditEmail").value = "";
  if ($("accountFirstNameInput")) $("accountFirstNameInput").value = "";
  if ($("accountLastNameInput")) $("accountLastNameInput").value = "";
  if ($("accountEmailInput")) $("accountEmailInput").value = "";
  if ($("accountPasswordInput")) $("accountPasswordInput").value = "";
  if ($("accountRoleSelect")) $("accountRoleSelect").value = "user";
  if ($("accountVerifiedCheck")) $("accountVerifiedCheck").checked = false;
}

function fillAccountForm(a) {
  if ($("accountEditEmail")) $("accountEditEmail").value = a.email;
  if ($("accountFirstNameInput")) $("accountFirstNameInput").value = a.firstName || "";
  if ($("accountLastNameInput")) $("accountLastNameInput").value = a.lastName || "";
  if ($("accountEmailInput")) $("accountEmailInput").value = a.email;
  if ($("accountPasswordInput")) $("accountPasswordInput").value = "";
  if ($("accountRoleSelect")) $("accountRoleSelect").value = a.role || "user";
  if ($("accountVerifiedCheck")) $("accountVerifiedCheck").checked = Boolean(a.verified);
}

function renderDepartmentsTable() {
  const tbody = $("departmentsTableBody");
  if (!tbody) return;
  tbody.innerHTML = state.db.departments.map((d) => `<tr><td>${d.name}</td><td>${d.description || ""}</td><td><button class="btn btn-sm btn-outline-primary me-1" data-dept-action="edit" data-dept-id="${d.id}">Edit</button><button class="btn btn-sm btn-outline-danger" data-dept-action="delete" data-dept-id="${d.id}">Delete</button></td></tr>`).join("");
  tbody.querySelectorAll("button[data-dept-action]").forEach((btn) => btn.addEventListener("click", () => {
    const action = btn.getAttribute("data-dept-action");
    const deptId = Number(btn.getAttribute("data-dept-id"));
    const dept = state.db.departments.find((d) => Number(d.id) === deptId);
    if (!dept) return;
    if (action === "edit") return fillDepartmentForm(dept);
    if (state.db.employees.some((e) => Number(e.departmentId) === deptId)) return showToast("Department is linked to employees.", "warning");
    state.db.departments = state.db.departments.filter((d) => Number(d.id) !== deptId);
    saveDB();
    renderDepartmentsTable();
    populateEmployeeOptions();
    resetDepartmentForm();
  }));
}

function resetDepartmentForm() {
  if ($("departmentEditId")) $("departmentEditId").value = "";
  if ($("departmentNameInput")) $("departmentNameInput").value = "";
  if ($("departmentDescriptionInput")) $("departmentDescriptionInput").value = "";
}

function fillDepartmentForm(d) {
  if ($("departmentEditId")) $("departmentEditId").value = String(d.id);
  if ($("departmentNameInput")) $("departmentNameInput").value = d.name;
  if ($("departmentDescriptionInput")) $("departmentDescriptionInput").value = d.description || "";
}

function populateEmployeeOptions() {
  const emails = $("employeeUserEmailOptions");
  const dept = $("employeeDepartmentSelect");
  if (!emails || !dept) return;
  emails.innerHTML = state.db.accounts.filter((a) => a.role !== "admin").map((a) => `<option value="${a.email}"></option>`).join("");
  dept.innerHTML = state.db.departments.map((d) => `<option value="${d.id}">${d.name}</option>`).join("");
}

function resetEmployeeForm() {
  if ($("employeeEditId")) $("employeeEditId").value = "";
  if ($("employeeIdInput")) $("employeeIdInput").value = "";
  if ($("employeeUserEmailInput")) $("employeeUserEmailInput").value = "";
  if ($("employeePositionInput")) $("employeePositionInput").value = "";
  if ($("employeeHireDateInput")) $("employeeHireDateInput").value = "";
  if ($("employeeDepartmentSelect") && $("employeeDepartmentSelect").options.length > 0) $("employeeDepartmentSelect").selectedIndex = 0;
}

function renderEmployeesTable() {
  const tbody = $("employeesTableBody");
  if (!tbody) return;
  tbody.innerHTML = state.db.employees.map((e) => `<tr><td>${e.id}</td><td>${accountDisplayName(e.userEmail)}</td><td>${e.position}</td><td>${departmentNameById(e.departmentId)}</td><td>${e.hireDate || ""}</td><td><button class="btn btn-sm btn-outline-success me-1" data-emp-action="edit" data-emp-id="${e.id}">Edit</button><button class="btn btn-sm btn-outline-danger" data-emp-action="delete" data-emp-id="${e.id}">Delete</button></td></tr>`).join("");
  tbody.querySelectorAll("button[data-emp-action]").forEach((btn) => btn.addEventListener("click", () => {
    const action = btn.getAttribute("data-emp-action");
    const id = Number(btn.getAttribute("data-emp-id"));
    const row = state.db.employees.find((e) => Number(e.id) === id);
    if (!row) return;
    if (action === "delete") {
      state.db.employees = state.db.employees.filter((e) => Number(e.id) !== id);
      saveDB();
      return renderEmployeesTable();
    }
    if ($("employeeEditId")) $("employeeEditId").value = String(row.id);
    if ($("employeeIdInput")) $("employeeIdInput").value = String(row.id);
    if ($("employeeUserEmailInput")) $("employeeUserEmailInput").value = row.userEmail;
    if ($("employeeDepartmentSelect")) $("employeeDepartmentSelect").value = String(row.departmentId);
    if ($("employeePositionInput")) $("employeePositionInput").value = row.position;
    if ($("employeeHireDateInput")) $("employeeHireDateInput").value = row.hireDate || "";
  }));
}

function statusBadgeClass(status) { return status === "approved" ? "bg-success" : status === "rejected" ? "bg-danger" : "bg-warning text-dark"; }

function createRequestItemRow(item = { name: "", quantity: 1 }) {
  const row = document.createElement("div");
  row.className = "row g-2 align-items-center mb-2 request-item-row";
  row.innerHTML = `<div class="col-md-7"><input type="text" class="form-control request-item-name" placeholder="Item name" value="${item.name || ""}" required></div><div class="col-md-3"><input type="number" min="1" class="form-control request-item-qty" placeholder="Qty" value="${item.quantity || 1}" required></div><div class="col-md-2 d-grid"><button type="button" class="btn btn-outline-danger remove-request-item-btn">Remove</button></div>`;
  return row;
}

function resetRequestBuilder() {
  if ($("requestType")) $("requestType").value = "Equipment";
  const container = $("requestItemsContainer");
  if (!container) return;
  container.innerHTML = "";
  container.appendChild(createRequestItemRow());
}

function renderMyRequests(user) {
  const tbody = $("requestsTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!user) return;
  tbody.innerHTML = state.db.requests.filter((r) => r.employeeEmail === user.email).sort((a, b) => Number(b.createdAt) - Number(a.createdAt)).map((r) => {
    const items = r.items.map((i) => `${i.name} x${i.quantity}`).join(", ");
    return `<tr><td>${new Date(r.createdAt).toLocaleString()}</td><td>${r.type}</td><td>${items}</td><td><span class="badge ${statusBadgeClass(r.status)}">${String(r.status).toUpperCase()}</span></td></tr>`;
  }).join("");
}

function renderAdminRequests(user) {
  const tbody = $("adminRequestsTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!user || user.role !== "admin") return;
  tbody.innerHTML = state.db.requests.slice().sort((a, b) => Number(b.createdAt) - Number(a.createdAt)).map((r) => {
    const items = r.items.map((i) => `${i.name} x${i.quantity}`).join(", ");
    return `<tr><td>${r.employeeEmail}</td><td>${new Date(r.createdAt).toLocaleString()}</td><td>${r.type}</td><td>${items}</td><td><span class="badge ${statusBadgeClass(r.status)}">${String(r.status).toUpperCase()}</span></td><td><button class="btn btn-sm btn-outline-success me-1" data-request-action="approve" data-request-id="${r.id}">Approve</button><button class="btn btn-sm btn-outline-danger" data-request-action="reject" data-request-id="${r.id}">Reject</button></td></tr>`;
  }).join("");
  tbody.querySelectorAll("button[data-request-action]").forEach((btn) => btn.addEventListener("click", () => {
    const action = btn.getAttribute("data-request-action");
    const id = Number(btn.getAttribute("data-request-id"));
    const req = state.db.requests.find((r) => Number(r.id) === id);
    if (!req) return;
    req.status = action === "approve" ? "approved" : "rejected";
    saveDB();
    renderMyRequests(user);
    renderAdminRequests(user);
    showToast(`Request ${action === "approve" ? "approved" : "rejected"}.`, action === "approve" ? "success" : "danger");
  }));
}

function renderAdminViews(user) {
  renderAccountsTable(user);
  renderDepartmentsTable();
  populateEmployeeOptions();
  renderEmployeesTable();
}

function renderRoute(hash, user) {
  if (hash === "#/register") renderVerifyBlock();
  if (hash === "#/profile") renderProfile(user);
  if (hash === "#/requests") { renderMyRequests(user); renderAdminRequests(user); }
  if (hash === "#/employees" || hash === "#/accounts" || hash === "#/departments") renderAdminViews(user);
}

function handleRouting() {
  const user = getCurrentUser();
  setAuthState(user);
  renderProfile(user);
  const hash = normalizeHash(window.location.hash || "#/home");
  const guarded = guardHash(hash, user);
  if (guarded !== hash) { window.location.hash = guarded; return; }
  setActiveRoute(hash);
  renderRoute(hash, user);
}

function logout() {
  clearSession();
  setAuthState(null);
  renderProfile(null);
  window.location.hash = "#/home";
}

function bindEvents() {
  $("logoutLink")?.addEventListener("click", (e) => { e.preventDefault(); logout(); });

  $("registerForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const firstName = String($("firstName")?.value || "").trim();
    const lastName = String($("lastName")?.value || "").trim();
    const email = toEmail($("email")?.value);
    const password = String($("password")?.value || "");
    if (password.length <= 6) return showToast("Password must be longer than 6 characters.", "warning");
    if (state.db.accounts.some((a) => a.email === email)) return showToast("Email is already in use.", "warning");
    state.db.accounts.push(normalizeAccount({ id: Date.now(), firstName, lastName, email, password, role: "user", verified: false }));
    saveDB();
    localStorage.setItem(KEYS.unverified, email);
    $("registerForm")?.reset();
    renderVerifyBlock();
    showToast("Registration saved. Please verify your email.", "info");
    window.location.hash = "#/register";
  });

  $("simulateVerifyBtn")?.addEventListener("click", () => {
    const pending = localStorage.getItem(KEYS.unverified);
    if (!pending) return showToast("No pending verification.", "warning");
    const target = state.db.accounts.find((a) => a.email === toEmail(pending));
    if (!target) {
      localStorage.removeItem(KEYS.unverified);
      renderVerifyBlock();
      return showToast("Account not found.", "danger");
    }
    target.verified = true;
    saveDB();
    localStorage.removeItem(KEYS.unverified);
    renderVerifyBlock();
    showToast("Email verified. Please login.", "success");
    window.location.hash = "#/login";
  });

  $("loginForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = toEmail($("loginEmail")?.value);
    const password = String($("loginPassword")?.value || "");
    const account = state.db.accounts.find((a) => a.email === email && a.password === password);
    if (!account) {
      if ($("loginPassword")) $("loginPassword").value = "";
      return showToast("Invalid email or password.", "danger");
    }
    if (!account.verified) {
      localStorage.setItem(KEYS.unverified, account.email);
      renderVerifyBlock();
      showToast("Please verify your email before login.", "warning");
      window.location.hash = "#/register";
      return;
    }
    setSession(account);
    $("loginForm")?.reset();
    window.location.hash = account.role === "admin" ? "#/employees" : "#/profile";
  });

  $("addAccountBtn")?.addEventListener("click", resetAccountForm);
  $("cancelAccountEditBtn")?.addEventListener("click", resetAccountForm);
  $("accountForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const currentUser = getCurrentUser();
    if (!currentUser || currentUser.role !== "admin") return showToast("Admin access required.", "danger");

    const originalEmail = toEmail($("accountEditEmail")?.value);
    const email = toEmail($("accountEmailInput")?.value);
    const firstName = String($("accountFirstNameInput")?.value || "").trim();
    const lastName = String($("accountLastNameInput")?.value || "").trim();
    const password = String($("accountPasswordInput")?.value || "");
    const role = String($("accountRoleSelect")?.value || "user");
    const verified = Boolean($("accountVerifiedCheck")?.checked);
    const isEdit = Boolean(originalEmail);

    if (!["user", "admin"].includes(role)) return showToast("Role must be user or admin.", "warning");
    if (state.db.accounts.some((a) => a.email === email && a.email !== originalEmail)) return showToast("Email is already in use.", "warning");

    if (isEdit) {
      const target = state.db.accounts.find((a) => a.email === originalEmail);
      if (!target) return showToast("Account not found.", "danger");
      if (currentUser.email === target.email && role !== "admin") return showToast("Safety rule: admin cannot remove own admin role.", "warning");
      if (currentUser.email === target.email && email !== originalEmail) return showToast("Safety rule: cannot change your own login email.", "warning");
      if (password && password.length < 6) return showToast("Password must be at least 6 characters.", "warning");

      target.firstName = firstName;
      target.lastName = lastName;
      target.email = email;
      target.role = role;
      target.verified = verified;
      if (password) target.password = password;
      if (currentUser.email === target.email) setSession(target);
      saveDB();
      renderAdminViews(currentUser);
      resetAccountForm();
      return showToast("Account updated.", "success");
    }

    if (password.length < 6) return showToast("Password must be at least 6 characters.", "warning");
    state.db.accounts.push(normalizeAccount({ id: Date.now(), firstName, lastName, email, password, role, verified }));
    saveDB();
    renderAdminViews(currentUser);
    resetAccountForm();
    showToast("Account created.", "success");
  });

  $("addDepartmentBtn")?.addEventListener("click", resetDepartmentForm);
  $("cancelDepartmentEditBtn")?.addEventListener("click", resetDepartmentForm);
  $("departmentForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const editId = Number($("departmentEditId")?.value || 0);
    const name = String($("departmentNameInput")?.value || "").trim();
    const description = String($("departmentDescriptionInput")?.value || "").trim();
    if (!name || !description) return;
    if (state.db.departments.some((d) => d.name.toLowerCase() === name.toLowerCase() && Number(d.id) !== editId)) return showToast("Department already exists.", "warning");
    if (editId) {
      const target = state.db.departments.find((d) => Number(d.id) === editId);
      if (!target) return showToast("Department not found.", "danger");
      target.name = name;
      target.description = description;
    } else {
      state.db.departments.push(normalizeDepartment({ id: Date.now(), name, description }));
    }
    saveDB();
    renderDepartmentsTable();
    populateEmployeeOptions();
    resetDepartmentForm();
    showToast(editId ? "Department updated." : "Department added.", "success");
  });

  $("addEmployeeBtn")?.addEventListener("click", resetEmployeeForm);
  $("cancelEmployeeEditBtn")?.addEventListener("click", resetEmployeeForm);
  $("employeeForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const editId = Number($("employeeEditId")?.value || 0);
    const userEmail = toEmail($("employeeUserEmailInput")?.value);
    const departmentId = Number($("employeeDepartmentSelect")?.value);
    const position = String($("employeePositionInput")?.value || "").trim();
    const hireDate = String($("employeeHireDateInput")?.value || "");
    if (!userEmail || !departmentId || !position || !hireDate) return showToast("Complete all employee fields.", "warning");
    if (!state.db.accounts.find((a) => a.email === userEmail && a.role !== "admin")) return showToast("User email must match an existing non-admin account.", "warning");

    if (editId) {
      const target = state.db.employees.find((e2) => Number(e2.id) === editId);
      if (!target) return;
      target.userEmail = userEmail;
      target.departmentId = departmentId;
      target.position = position;
      target.hireDate = hireDate;
    } else {
      if (state.db.employees.some((e2) => e2.userEmail === userEmail)) return showToast("User already linked. Use Edit.", "warning");
      const id = Date.now();
      state.db.employees.push(normalizeEmployee({ id, userEmail, departmentId, position, hireDate }));
      if ($("employeeIdInput")) $("employeeIdInput").value = String(id);
    }
    saveDB();
    renderEmployeesTable();
    resetEmployeeForm();
    showToast("Employee saved.", "success");
  });

  $("openRequestModalBtn")?.addEventListener("click", resetRequestBuilder);
  $("addRequestItemBtn")?.addEventListener("click", () => $("requestItemsContainer")?.appendChild(createRequestItemRow()));
  $("requestItemsContainer")?.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement) || !target.classList.contains("remove-request-item-btn")) return;
    const rows = document.querySelectorAll("#requestItemsContainer .request-item-row");
    if (rows.length <= 1) return showToast("At least one item is required.", "warning");
    target.closest(".request-item-row")?.remove();
  });

  $("requestForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const user = getCurrentUser();
    if (!user) { showToast("Login required.", "warning"); window.location.hash = "#/login"; return; }
    const rows = Array.from(document.querySelectorAll("#requestItemsContainer .request-item-row"));
    const items = rows.map((row) => ({
      name: String(row.querySelector(".request-item-name")?.value || "").trim(),
      quantity: Number(row.querySelector(".request-item-qty")?.value || 0)
    })).filter((i) => i.name && i.quantity > 0);
    if (!items.length) return showToast("Add at least one valid item.", "warning");
    state.db.requests.push(normalizeRequest({ id: Date.now(), employeeEmail: user.email, type: String($("requestType")?.value || "Equipment"), items, status: "pending", createdAt: Date.now() }));
    saveDB();
    renderMyRequests(user);
    renderAdminRequests(user);
    resetRequestBuilder();
    showToast("Request submitted.", "success");
    if ($("newRequestModal") && window.bootstrap) {
      const modal = window.bootstrap.Modal.getInstance($("newRequestModal"));
      if (modal) modal.hide();
    }
  });
}

function handleRoute() {
  const user = getCurrentUser();
  setAuthState(user);
  renderProfile(user);
  const hash = normalizeHash(window.location.hash || "#/home");
  const safeHash = guardHash(hash, user);
  if (safeHash !== hash) { window.location.hash = safeHash; return; }
  setActiveRoute(hash);
  if (hash === "#/register") renderVerifyBlock();
  if (hash === "#/requests") { renderMyRequests(user); renderAdminRequests(user); }
  if (hash === "#/employees" || hash === "#/accounts" || hash === "#/departments") renderAdminViews(user);
}

document.addEventListener("DOMContentLoaded", () => {
  initDB();
  bindEvents();
  window.addEventListener("hashchange", handleRoute);
  if (!window.location.hash) window.location.hash = "#/home";
  handleRoute();
});
