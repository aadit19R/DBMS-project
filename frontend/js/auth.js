import { apiFetch, API } from './api.js';

export function showAuthForm(id) {
  ["login-form", "register-form", "forgot-password-form", "reset-password-form"].forEach(formId => {
    document.getElementById(formId).classList.add("hidden");
  });
  document.getElementById(id).classList.remove("hidden");
}

export async function login() {
  const userInput = document.getElementById("login-username").value.trim();
  const passInput = document.getElementById("login-password").value.trim();
  const errorBox  = document.getElementById("login-error");

  errorBox.classList.add("hidden");
  if (!userInput || !passInput) {
    errorBox.textContent = "Please enter both username and password.";
    errorBox.classList.remove("hidden");
    return;
  }

  try {
    const res = await fetch(`${API}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: userInput, password: passInput })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");

    localStorage.setItem("jwt_token", data.access_token);
    localStorage.setItem("user_role", data.role);
    document.getElementById("login-username").value = "";
    document.getElementById("login-password").value = "";
    initAuth();
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.remove("hidden");
  }
}

export function logout() {
  localStorage.removeItem("jwt_token");
  localStorage.removeItem("user_role");
  initAuth();
}

export async function register() {
  const nameInput     = document.getElementById("reg-name").value.trim();
  const emailInput    = document.getElementById("reg-email").value.trim();
  const usernameInput = document.getElementById("reg-username").value.trim();
  const passInput     = document.getElementById("reg-password").value.trim();
  const errorBox      = document.getElementById("register-error");

  errorBox.classList.add("hidden");
  if (!nameInput || !emailInput || !usernameInput || !passInput) {
    errorBox.textContent = "Please fill in all fields.";
    errorBox.classList.remove("hidden");
    return;
  }

  try {
    const res = await fetch(`${API}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nameInput, email: emailInput, username: usernameInput, password: passInput })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Registration failed");

    // Auto-login after successful registration
    document.getElementById("login-username").value = usernameInput;
    document.getElementById("login-password").value = passInput;
    login();
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.remove("hidden");
  }
}

export async function forgotPassword() {
  const emailInput = document.getElementById("forgot-email").value.trim();
  const msgBox     = document.getElementById("forgot-message");

  msgBox.classList.add("hidden");
  msgBox.className = "hidden mb-4 text-sm px-3 py-2 rounded";
  if (!emailInput) {
    msgBox.textContent = "Please enter your email.";
    msgBox.classList.add("bg-red-50", "text-red-600", "border-red-200", "border");
    msgBox.classList.remove("hidden");
    return;
  }

  try {
    const res = await fetch(`${API}/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: emailInput })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed");

    msgBox.textContent = data.message;
    msgBox.classList.add("bg-green-50", "text-green-600", "border-green-200", "border");
    msgBox.classList.remove("hidden");
  } catch (err) {
    msgBox.textContent = err.message;
    msgBox.classList.add("bg-red-50", "text-red-600", "border-red-200", "border");
    msgBox.classList.remove("hidden");
  }
}

export async function resetPassword() {
  const passInput  = document.getElementById("reset-password").value.trim();
  const errorBox   = document.getElementById("reset-error");
  const successBox = document.getElementById("reset-success");

  errorBox.classList.add("hidden");
  successBox.classList.add("hidden");

  if (!passInput) {
    errorBox.textContent = "Please enter a new password.";
    errorBox.classList.remove("hidden");
    return;
  }

  const token = new URLSearchParams(window.location.search).get('reset_token');

  try {
    const res = await fetch(`${API}/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, new_password: passInput })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed");

    successBox.textContent = data.message;
    successBox.classList.remove("hidden");
    document.getElementById("reset-password").value = "";
    window.history.replaceState({}, document.title, "/");
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.classList.remove("hidden");
  }
}

export function initAuth() {
  const token = localStorage.getItem("jwt_token");
  const role  = localStorage.getItem("user_role");
  const loginSection = document.getElementById("login-section");
  const appContainer = document.getElementById("app-container");

  if (!token) {
    loginSection.classList.remove("hidden");
    appContainer.classList.add("hidden");
    const resetToken = new URLSearchParams(window.location.search).get('reset_token');
    showAuthForm(resetToken ? 'reset-password-form' : 'login-form');
  } else {
    loginSection.classList.add("hidden");
    appContainer.classList.remove("hidden");

    if (role === "admin") {
      document.getElementById("nav-admin").classList.remove("hidden");
      document.getElementById("nav-user").classList.add("hidden");
      if (window.showSection) window.showSection("dashboard");
      if (window.loadDashboard) window.loadDashboard();
    } else {
      document.getElementById("nav-admin").classList.add("hidden");
      document.getElementById("nav-user").classList.remove("hidden");
      if (window.showSection) window.showSection("storefront");
    }
  }
}

window.showAuthForm = showAuthForm;
window.login = login;
window.logout = logout;
window.register = register;
window.forgotPassword = forgotPassword;
window.resetPassword = resetPassword;
