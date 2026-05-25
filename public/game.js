// Game configuration
const config = {
    renderDistance: 10,
    maxFPS: 60,
    movementSpeed: 0.15
};

// Game state
const gameState = {
    connected: false,
    username: '',
    host: 'Respek.aternos.me',
    port: 58389,
    position: { x: 0, y: 64, z: 0 },
    rotation: { yaw: 0, pitch: 0 },
    health: 20,
    food: 20,
    velocity: { x: 0, y: 0, z: 0 },
    keys: {},
    ws: null,
    lastPingTime: 0,
    ping: 0
};

// Three.js setup
let scene, camera, renderer;
let terrain = {};
let frameCount = 0;
let lastFpsUpdate = 0;

function initThreeJS() {
    const canvas = document.getElementById('gameCanvas');
    
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 150, 300);
    
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(gameState.position.x, gameState.position.y + 1.6, gameState.position.z);
    
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowShadowMap;
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(100, 100, 100);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.left = -200;
    directionalLight.shadow.camera.right = 200;
    directionalLight.shadow.camera.top = 200;
    directionalLight.shadow.camera.bottom = -200;
    directionalLight.shadow.camera.far = 500;
    scene.add(directionalLight);
    
    // Generate initial terrain
    generateTerrain();
    
    // Input handling
    setupInput();
    
    // Animation loop
    animate();
}

function generateTerrain() {
    const chunkSize = 16;
    const blockSize = 1;
    const chunksToLoad = 4;
    
    for (let cx = -chunksToLoad; cx < chunksToLoad; cx++) {
        for (let cz = -chunksToLoad; cz < chunksToLoad; cz++) {
            for (let x = 0; x < chunkSize; x++) {
                for (let z = 0; z < chunkSize; z++) {
                    const worldX = cx * chunkSize + x;
                    const worldZ = cz * chunkSize + z;
                    const height = Math.sin(worldX * 0.1) * Math.cos(worldZ * 0.1) * 5 + 60;
                    
                    // Grass
                    const grassGeo = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
                    const grassMat = new THREE.MeshStandardMaterial({ color: 0x4a9d3f });
                    const grass = new THREE.Mesh(grassGeo, grassMat);
                    grass.position.set(worldX, height, worldZ);
                    grass.castShadow = true;
                    grass.receiveShadow = true;
                    scene.add(grass);
                    
                    // Dirt layers
                    for (let y = 1; y < 3; y++) {
                        const dirtGeo = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
                        const dirtMat = new THREE.MeshStandardMaterial({ color: 0x8b6f47 });
                        const dirt = new THREE.Mesh(dirtGeo, dirtMat);
                        dirt.position.set(worldX, height - y, worldZ);
                        dirt.castShadow = true;
                        dirt.receiveShadow = true;
                        scene.add(dirt);
                    }
                    
                    // Random trees
                    if (Math.random() < 0.02) {
                        createTree(worldX, height + 1, worldZ);
                    }
                }
            }
        }
    }
}

function createTree(x, y, z) {
    // Trunk
    const trunkGeo = new THREE.BoxGeometry(1, 4, 1);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x654321 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, y + 2, z);
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    scene.add(trunk);
    
    // Leaves
    const leavesGeo = new THREE.BoxGeometry(6, 5, 6);
    const leavesMat = new THREE.MeshStandardMaterial({ color: 0x228b22 });
    const leaves = new THREE.Mesh(leavesGeo, leavesMat);
    leaves.position.set(x, y + 5, z);
    leaves.castShadow = true;
    leaves.receiveShadow = true;
    scene.add(leaves);
}

function setupInput() {
    document.addEventListener('keydown', (e) => {
        gameState.keys[e.key.toLowerCase()] = true;
        
        if (e.key === 'c' || e.key === 'C') {
            const controlsInfo = document.getElementById('controlsInfo');
            controlsInfo.style.display = controlsInfo.style.display === 'none' ? 'block' : 'none';
        }
        
        if (e.key === 'e' || e.key === 'E') {
            disconnect();
        }
    });
    
    document.addEventListener('keyup', (e) => {
        gameState.keys[e.key.toLowerCase()] = false;
    });
    
    // Mouse movement
    let yaw = 0, pitch = 0;
    document.addEventListener('mousemove', (e) => {
        if (!gameState.connected) return;
        yaw += e.movementX * 0.003;
        pitch -= e.movementY * 0.003;
        pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));
    });
    
    // Pointer lock
    document.getElementById('gameCanvas').addEventListener('click', () => {
        if (gameState.connected) {
            document.getElementById('gameCanvas').requestPointerLock = 
                document.getElementById('gameCanvas').requestPointerLock || 
                document.getElementById('gameCanvas').mozRequestPointerLock;
            document.getElementById('gameCanvas').requestPointerLock();
        }
    });
}

function animate() {
    requestAnimationFrame(animate);
    
    if (gameState.connected) {
        // Update position
        const moveSpeed = config.movementSpeed;
        if (gameState.keys['w']) gameState.position.z -= moveSpeed;
        if (gameState.keys['s']) gameState.position.z += moveSpeed;
        if (gameState.keys['a']) gameState.position.x -= moveSpeed;
        if (gameState.keys['d']) gameState.position.x += moveSpeed;
        if (gameState.keys[' ']) gameState.position.y += moveSpeed;
        if (gameState.keys['shift']) gameState.position.y -= moveSpeed;
        
        // Update camera
        camera.position.set(
            gameState.position.x,
            gameState.position.y + 1.6,
            gameState.position.z
        );
        
        // Update HUD
        document.getElementById('posX').textContent = gameState.position.x.toFixed(1);
        document.getElementById('posY').textContent = gameState.position.y.toFixed(1);
        document.getElementById('posZ').textContent = gameState.position.z.toFixed(1);
        
        // FPS counter
        frameCount++;
        const now = performance.now();
        if (now - lastFpsUpdate >= 1000) {
            document.getElementById('fps').textContent = frameCount;
            frameCount = 0;
            lastFpsUpdate = now;
        }
    }
    
    renderer.render(scene, camera);
}

// WebSocket connection
function connectToServer() {
    const username = document.getElementById('username').value;
    
    if (!username) {
        showError('Пожалуйста, введи никнейм');
        return;
    }
    
    gameState.username = username;
    
    // Определяем URL для подключения
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    
    // Если мы на GitHub Pages - подключаемся к Render серверу
    let wsUrl;
    if (window.location.hostname.includes('github.io')) {
        wsUrl = 'wss://minecraft-web-client-1pka.onrender.com';
    } else {
        // Если локально - подключаемся к localhost
        wsUrl = `${protocol}//${window.location.host}`;
    }
    
    console.log('Подключение к:', wsUrl);
    
    gameState.ws = new WebSocket(wsUrl);
    
    gameState.ws.onopen = () => {
        console.log('WebSocket подключен');
        gameState.ws.send(JSON.stringify({
            type: 'connect',
            host: gameState.host,
            port: gameState.port,
            username
        }));
        showStatus('⏳ Подключение к серверу...');
    };
    
    gameState.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleServerMessage(data);
    };
    
    gameState.ws.onerror = (error) => {
        console.error('WebSocket ошибка:', error);
        showError('Ошибка подключения к серверу');
    };
    
    gameState.ws.onclose = () => {
        console.log('WebSocket отключен');
        gameState.connected = false;
    };
}

function handleServerMessage(data) {
    switch (data.type) {
        case 'connected':
            gameState.connected = true;
            document.getElementById('loginScreen').classList.remove('active');
            document.getElementById('gameHUD').style.display = 'flex';
            document.getElementById('disconnectBtn').style.display = 'block';
            document.getElementById('controlsInfo').style.display = 'block';
            document.getElementById('hudUsername').textContent = gameState.username;
            document.getElementById('hudServer').textContent = `${gameState.host}:${gameState.port}`;
            showStatus(`✅ Подключено к ${gameState.host}:${gameState.port}`);
            break;
        
        case 'position':
            gameState.position = { x: data.x, y: data.y, z: data.z };
            break;
        
        case 'health':
            gameState.health = data.health;
            gameState.food = data.food;
            document.getElementById('health').textContent = data.health;
            document.getElementById('food').textContent = data.food;
            break;
        
        case 'error':
            showError(data.message);
            break;
        
        case 'disconnected':
            gameState.connected = false;
            showStatus(`⚠️ Отключено: ${data.reason}`);
            break;
    }
}

function disconnect() {
    if (gameState.ws) {
        gameState.ws.send(JSON.stringify({ type: 'disconnect' }));
        gameState.ws.close();
    }
    
    gameState.connected = false;
    document.getElementById('loginScreen').classList.add('active');
    document.getElementById('gameHUD').style.display = 'none';
    document.getElementById('disconnectBtn').style.display = 'none';
    document.getElementById('controlsInfo').style.display = 'none';
}

function showError(message) {
    const errorDiv = document.getElementById('loginError');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

function showStatus(message) {
    const statusDiv = document.getElementById('connectionStatus');
    statusDiv.textContent = message;
    statusDiv.classList.add('active');
    setTimeout(() => {
        statusDiv.classList.remove('active');
    }, 5000);
}

// Form submission
document.getElementById('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const btn = document.getElementById('loginForm').querySelector('button');
    btn.disabled = true;
    connectToServer();
});

// Disconnect button
document.getElementById('disconnectBtn').addEventListener('click', disconnect);

// Window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Initialize when page loads
window.addEventListener('load', () => {
    initThreeJS();
});
