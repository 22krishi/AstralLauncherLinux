const { ipcRenderer } = require('electron');

// DOM Elemek
const authContainer = document.getElementById('authContainer');
const mainDashboard = document.getElementById('mainDashboard');
const usernameInput = document.getElementById('usernameInput');
const passwordInput = document.getElementById('passwordInput');
const loginBtn = document.getElementById('loginBtn');
const statusText = document.getElementById('statusText');
const logoutBtn = document.getElementById('logoutBtn');
const playBtn = document.getElementById('playBtn');

// Ablak kezelő gombok
document.getElementById('minBtn').addEventListener('click', () => ipcRenderer.send('window-minimize'));
document.getElementById('closeBtn').addEventListener('click', () => ipcRenderer.send('window-close'));

let activeUsername = '';

// Oldal betöltésekor ellenőrzés
window.addEventListener('DOMContentLoaded', async () => {
    const savedUser = localStorage.getItem('astral_remembered_user');
    if (savedUser) {
        activeUsername = savedUser;
        showDashboard(activeUsername);
    }

    // Rendszer memória lekérdezése a RAM csúszkához
    const totalMemoryMB = await ipcRenderer.invoke('get-system-memory');
    const ramSlider = document.getElementById('ramSlider');
    const ramValue = document.getElementById('ramValue');
    
    if (ramSlider && ramValue) {
        const recommendedRam = Math.min(Math.floor(totalMemoryMB / 2), 4096);
        ramSlider.max = Math.floor(totalMemoryMB / 1024); // GB-ban
        ramSlider.value = Math.floor(recommendedRam / 1024);
        ramValue.innerText = ramSlider.value + ' GB';

        ramSlider.addEventListener('input', (e) => {
            ramValue.innerText = e.target.value + ' GB';
        });
    }
});

// Bejelentkezés gomb
loginBtn.addEventListener('click', async () => {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
        statusText.innerText = 'Minden mezőt tölts ki a belépéshez!';
        return;
    }

    statusText.innerText = 'Bejelentkezés...';

    const result = await ipcRenderer.invoke('login-user', { username, password });

    if (result.success) {
        activeUsername = username;
        localStorage.setItem('astral_remembered_user', username);
        showDashboard(username);
    } else {
        statusText.innerText = result.message;
    }
});

// Kijelentkezés
logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('astral_remembered_user');
    activeUsername = '';
    passwordInput.value = '';
    mainDashboard.classList.remove('active');
    authContainer.style.display = 'block';
    statusText.innerText = '';
});

// Fő képernyő megjelenítése és adatok betöltése
async function showDashboard(username) {
    authContainer.style.display = 'none';
    mainDashboard.classList.add('active');
    document.getElementById('loggedInUserText').innerText = username;

    // LuckPerms rang és skin lekérdezése
    const customData = await ipcRenderer.invoke('get-user-customizations', { username });
    
    document.getElementById('userRankText').innerText = customData.rankDisplayName;
    
    const skinImg = document.getElementById('userSkinImg');
    if (skinImg) skinImg.src = customData.skinUrl;

    const rankImg = document.getElementById('userRankImg');
    if (rankImg && customData.hasRankImage) {
        rankImg.src = customData.rankImageUrl;
        rankImg.style.display = 'block';
    }
}

// Menüpontok váltása (Sidebar)
document.querySelectorAll('.menu-item').forEach(button => {
    button.addEventListener('click', () => {
        const targetView = button.getAttribute('data-target');
        
        document.querySelectorAll('.view-content').forEach(view => view.style.display = 'none');
        document.querySelectorAll('.menu-item').forEach(btn => btn.classList.remove('active'));
        
        const target = document.getElementById(targetView);
        if (target) target.style.display = 'block';
        button.classList.add('active');

        // Ha a modok nézetre kattintottak, betöltjük a modokat
        if (targetView === 'mods-view') {
            loadModsList();
        }
    });
});

// ---- MODOK LISTÁZÁSA ÉS KEZELÉSE ----
async function loadModsList() {
    const grid = document.getElementById('mods-grid');
    if (!grid) return;

    grid.innerHTML = '<p style="color: #8fa3bf; font-size: 13px;">Modok betöltése...</p>';

    const mods = await ipcRenderer.invoke('get-mods');
    grid.innerHTML = '';

    if (mods.length === 0) {
        grid.innerHTML = '<p style="color: #8fa3bf; font-size: 13px;">Nincsenek elérhető modok.</p>';
        return;
    }

    mods.forEach(mod => {
        const card = document.createElement('div');
        card.className = 'mod-card';
        card.innerHTML = `
            <div class="mod-card-top">
                <span class="mod-title">${mod.name}</span>
                <label class="switch">
                    <input type="checkbox" ${mod.enabled ? 'checked' : ''} data-filename="${mod.fileName}">
                    <span class="slider"></span>
                </label>
            </div>
            <span class="mod-desc">${mod.desc}</span>
        `;

        const checkbox = card.querySelector('input');
        checkbox.addEventListener('change', async (e) => {
            const enable = e.target.checked;
            const res = await ipcRenderer.invoke('toggle-mod', { 
                fileName: mod.fileName, 
                enable: enable 
            });
            if (!res.success) {
                alert('Hiba történt: ' + res.error);
                e.target.checked = !enable;
            }
        });

        grid.appendChild(card);
    });
}

// Mod kereső mező
document.getElementById('mod-search-input')?.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    document.querySelectorAll('.mod-card').forEach(card => {
        const title = card.querySelector('.mod-title').textContent.toLowerCase();
        card.style.display = title.includes(term) ? 'flex' : 'none';
    });
});

// Játék indítása
playBtn.addEventListener('click', () => {
    const ramSlider = document.getElementById('ramSlider');
    const allocatedRam = ramSlider ? parseInt(ramSlider.value) : 2;

    playBtn.innerText = 'JÁTÉK INDÍTÁSA...';
    playBtn.disabled = true;
    playBtn.style.opacity = '0.6';
    statusText.innerText = 'Minecraft előkészítése...';

    ipcRenderer.send('launch-game', { 
        username: activeUsername, 
        allocatedRam: parseInt(ramSlider.value) 
    });
});

ipcRenderer.on('launch-success', (event, message) => {
    playBtn.innerText = 'FUT A JÁTÉK';
    statusText.innerText = message;
});

ipcRenderer.on('launch-error', (event, errorMessage) => {
    alert(errorMessage);
    playBtn.innerText = 'JÁTÉK INDÍTÁSA';
    playBtn.disabled = false;
    playBtn.style.opacity = '1';
    statusText.innerText = errorMessage;
});

ipcRenderer.on('reset-play-button', () => {
    playBtn.innerText = 'JÁTÉK INDÍTÁSA';
    playBtn.disabled = false;
    playBtn.style.opacity = '1';
    statusText.innerText = 'A játék bezáródott.';
});