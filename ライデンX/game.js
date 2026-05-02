const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// UI Elements
const scoreDisplay = document.getElementById('score-display');
const livesDisplay = document.getElementById('lives-display');
const bombsDisplay = document.getElementById('bombs-display');
const gameOverScreen = document.getElementById('game-over-screen');

// Game State
let GAME_STATE = {
    PLAYING: 0,
    GAME_OVER: 1
};
let currentState = GAME_STATE.PLAYING;
let score = 0;
let frameCount = 0;

// Input Handling
const keys = {};
window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (currentState === GAME_STATE.GAME_OVER && e.code === 'KeyR') {
        resetGame();
    }
});
window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// Mobile Touch Handling
const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
if (isTouchDevice) {
    const mobileControls = document.getElementById('mobile-controls');
    if (mobileControls) mobileControls.classList.remove('hidden');
    
    const touchHint = document.getElementById('game-over-touch-hint');
    if (touchHint) touchHint.classList.remove('hidden');

    const setupTouchButton = (btnId, keyName) => {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            keys[keyName] = true;
        }, { passive: false });
        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            keys[keyName] = false;
        }, { passive: false });
        btn.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            keys[keyName] = false;
        }, { passive: false });
    };

    setupTouchButton('btn-up', 'ArrowUp');
    setupTouchButton('btn-down', 'ArrowDown');
    setupTouchButton('btn-left', 'ArrowLeft');
    setupTouchButton('btn-right', 'ArrowRight');
    setupTouchButton('btn-shoot', 'Space');
    setupTouchButton('btn-bomb', 'KeyB');

    // Tap to restart on Game Over
    const gameOverScreenTouch = document.getElementById('game-over-screen');
    if (gameOverScreenTouch) {
        gameOverScreenTouch.addEventListener('touchstart', (e) => {
            if (currentState === GAME_STATE.GAME_OVER) {
                e.preventDefault();
                resetGame();
            }
        }, { passive: false });
    }
}

// Utility Functions
function drawGlow(x, y, radius, color, blur) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.shadowBlur = blur;
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
}

function rectIntersect(r1, r2) {
    return !(r2.x > r1.x + r1.width || 
             r2.x + r2.width < r1.x || 
             r2.y > r1.y + r1.height ||
             r2.y + r2.height < r1.y);
}

// Entities arrays
let projectiles = [];
let enemies = [];
let particles = [];
let enemyProjectiles = [];
let items = [];
let boss = null;
let wave = 1;

// Player Class
class Player {
    constructor() {
        this.width = 30;
        this.height = 40;
        this.x = canvas.width / 2 - this.width / 2;
        this.y = canvas.height - 80;
        this.speed = 5;
        this.color = '#00d2ff';
        this.lives = 3;
        this.bombs = 3;
        this.weaponLevel = 1;
        this.missileLevel = 0;
        this.shootCooldown = 0;
        this.maxShootCooldown = 10; // Frames between shots
        this.invulnerableTime = 0;
    }

    update() {
        // Movement
        if (keys['ArrowLeft'] || keys['KeyA']) this.x -= this.speed;
        if (keys['ArrowRight'] || keys['KeyD']) this.x += this.speed;
        if (keys['ArrowUp'] || keys['KeyW']) this.y -= this.speed;
        if (keys['ArrowDown'] || keys['KeyS']) this.y += this.speed;

        // Screen boundaries
        this.x = Math.max(0, Math.min(canvas.width - this.width, this.x));
        this.y = Math.max(0, Math.min(canvas.height - this.height, this.y));

        // Shooting
        if ((keys['Space'] || keys['KeyZ']) && this.shootCooldown <= 0) {
            this.shoot();
            this.shootCooldown = this.maxShootCooldown;
        }
        if (this.shootCooldown > 0) this.shootCooldown--;

        // Bomb
        if (keys['KeyB'] || keys['KeyX']) {
            this.useBomb();
            keys['KeyB'] = false; // Prevent holding
            keys['KeyX'] = false;
        }

        if (this.invulnerableTime > 0) this.invulnerableTime--;
        
        // Thruster particles
        if (frameCount % 2 === 0) {
            particles.push(new Particle(this.x + this.width / 2, this.y + this.height, 0, Math.random() * 2 + 2, '#00d2ff', 2));
        }
    }

    shoot() {
        if (this.weaponLevel === 1) {
            projectiles.push(new Projectile(this.x + 5, this.y, 0, -12, '#66fcf1'));
            projectiles.push(new Projectile(this.x + this.width - 5, this.y, 0, -12, '#66fcf1'));
        } else if (this.weaponLevel === 2) {
            projectiles.push(new Projectile(this.x + 5, this.y, -1.5, -12, '#66fcf1'));
            projectiles.push(new Projectile(this.x + this.width / 2, this.y, 0, -12, '#66fcf1'));
            projectiles.push(new Projectile(this.x + this.width - 5, this.y, 1.5, -12, '#66fcf1'));
        } else {
            projectiles.push(new Projectile(this.x, this.y, -3, -12, '#66fcf1'));
            projectiles.push(new Projectile(this.x + 5, this.y, -1.5, -12, '#66fcf1'));
            projectiles.push(new Projectile(this.x + this.width / 2, this.y, 0, -12, '#66fcf1'));
            projectiles.push(new Projectile(this.x + this.width - 5, this.y, 1.5, -12, '#66fcf1'));
            projectiles.push(new Projectile(this.x + this.width, this.y, 3, -12, '#66fcf1'));
        }

        if (this.missileLevel > 0) {
            let numMissiles = Math.min(this.missileLevel, 4);
            for(let i=0; i<numMissiles; i++) {
                let vx = (numMissiles === 1) ? 0 : -3 + (i * 6 / (numMissiles - 1));
                projectiles.push(new Missile(this.x + this.width/2, this.y, vx, -5, '#ff5722'));
            }
        }
    }

    useBomb() {
        if (this.bombs > 0) {
            this.bombs--;
            updateUI();
            // Destroy all enemies and bullets
            enemies.forEach(e => {
                score += e.scoreValue;
                createExplosion(e.x + e.width/2, e.y + e.height/2, 20, e.color);
            });
            enemies = [];
            enemyProjectiles = [];
            
            // Bomb visual effect
            let bombRadius = 10;
            const bombInterval = setInterval(() => {
                bombRadius += 30;
                drawGlow(canvas.width/2, canvas.height/2, bombRadius, '#ffeb3b', 50);
                if (bombRadius > Math.max(canvas.width, canvas.height)) {
                    clearInterval(bombInterval);
                }
            }, 16);
            
            this.invulnerableTime = 60; // 1 second invulnerability
        }
    }

    draw() {
        if (this.invulnerableTime > 0 && Math.floor(frameCount / 4) % 2 === 0) return; // Blink
        
        // Draw futuristic ship shape
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.moveTo(this.x + this.width / 2, this.y); // Nose
        ctx.lineTo(this.x + this.width, this.y + this.height); // Right wing
        ctx.lineTo(this.x + this.width / 2, this.y + this.height - 10); // Back indent
        ctx.lineTo(this.x, this.y + this.height); // Left wing
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0; // reset
    }
}

// Item Class
class Item {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type; // 0: Weapon, 1: Bomb, 2: Missile
        this.width = 20;
        this.height = 20;
        this.vy = 1.5;
        this.color = type === 0 ? '#4caf50' : (type === 1 ? '#ffeb3b' : '#ff5722');
        this.text = type === 0 ? 'P' : (type === 1 ? 'B' : 'M');
    }

    update() {
        this.y += this.vy;
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.fillStyle = '#000';
        ctx.font = '14px "Press Start 2P"';
        ctx.fillText(this.text, this.x + 3, this.y + 16);
        ctx.shadowBlur = 0;
    }
}

// Projectile Class
class Projectile {
    constructor(x, y, vx, vy, color) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.width = 4;
        this.height = 15;
        this.color = color;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fillRect(this.x - this.width/2, this.y, this.width, this.height);
        ctx.shadowBlur = 0;
    }
}

// Missile Class
class Missile {
    constructor(x, y, vx, vy, color) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.width = 6;
        this.height = 12;
        this.color = color;
        this.target = null;
        this.speed = 8;
    }

    update() {
        // Find nearest target if none or target dead
        if (!this.target || (enemies.indexOf(this.target) === -1 && boss !== this.target)) {
            let nearestDist = Infinity;
            this.target = null;
            enemies.forEach(e => {
                let dist = Math.hypot(e.x - this.x, e.y - this.y);
                if (dist < nearestDist) {
                    nearestDist = dist;
                    this.target = e;
                }
            });
            if (boss) {
                let dist = Math.hypot(boss.x + boss.width/2 - this.x, boss.y + boss.height/2 - this.y);
                if (dist < nearestDist) {
                    this.target = boss;
                }
            }
        }

        if (this.target) {
            let tx = this.target === boss ? boss.x + boss.width/2 : this.target.x + this.target.width/2;
            let ty = this.target === boss ? boss.y + boss.height/2 : this.target.y + this.target.height/2;
            let dx = tx - this.x;
            let dy = ty - this.y;
            let angle = Math.atan2(dy, dx);
            
            // Turn towards target
            let currentAngle = Math.atan2(this.vy, this.vx);
            let angleDiff = angle - currentAngle;
            
            // Normalize angle diff
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            
            let turnSpeed = 0.15;
            if (Math.abs(angleDiff) < turnSpeed) {
                currentAngle = angle;
            } else {
                currentAngle += Math.sign(angleDiff) * turnSpeed;
            }
            
            this.vx = Math.cos(currentAngle) * this.speed;
            this.vy = Math.sin(currentAngle) * this.speed;
            
            // Add smoke particle
            if (frameCount % 2 === 0) {
                particles.push(new Particle(this.x, this.y, 0, 0, '#aaa', 1));
            }
        }

        this.x += this.vx;
        this.y += this.vy;
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fillRect(this.x - this.width/2, this.y, this.width, this.height);
        ctx.shadowBlur = 0;
    }
}

// Enemy Projectile Class
class EnemyProjectile {
    constructor(x, y, vx, vy, color) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.radius = 4;
        this.color = color;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
    }

    draw() {
        drawGlow(this.x, this.y, this.radius, this.color, 10);
    }
}

// Enemy Class
class Enemy {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type; // 0: basic, 1: strong, 2: homing missile
        
        if (type === 0) {
            this.width = 30;
            this.height = 30;
            this.hp = 2 + Math.floor(wave / 2);
            this.color = '#ff3366'; // Reddish pink
            this.scoreValue = 100 * wave;
            this.vy = 2 + (wave * 0.2);
            this.vx = Math.sin(frameCount * 0.05) * 1.5;
            this.shootTimer = Math.random() * 120 + 60;
        } else if (type === 1) {
            this.width = 45;
            this.height = 40;
            this.hp = 5 + wave;
            this.color = '#aa00ff'; // Purple
            this.scoreValue = 300 * wave;
            this.vy = 1.5 + (wave * 0.1);
            this.vx = 0;
            this.shootTimer = Math.random() * 60 + 30;
        } else if (type === 2) {
            this.width = 12;
            this.height = 20;
            this.hp = 1; // Destructible
            this.color = '#ff5722'; // Orange red
            this.scoreValue = 50 * wave;
            this.vy = 3 + (wave * 0.2);
            this.vx = 0;
            this.speed = 3 + (wave * 0.2);
        }
    }

    update() {
        if (this.type === 0) {
            this.y += this.vy;
            this.x += Math.sin(frameCount * 0.05 + this.y * 0.02) * 2;
            if (wave >= 2) {
                this.shootTimer--;
                if (this.shootTimer <= 0) {
                    enemyProjectiles.push(new EnemyProjectile(this.x + this.width/2, this.y + this.height, 0, 4 + wave*0.5, '#ff3366'));
                    this.shootTimer = 120 + Math.random() * 60;
                }
            }
        } else if (this.type === 1) {
            this.y += this.vy;
            this.shootTimer--;
            if (this.shootTimer <= 0) {
                // Spread shot based on wave
                let dx = (player.x + player.width/2) - (this.x + this.width/2);
                let dy = (player.y + player.height/2) - (this.y + this.height/2);
                let dist = Math.sqrt(dx*dx + dy*dy);
                let numBullets = 1 + Math.floor((wave - 1) / 2) * 2; // 1, 1, 3, 3, 5...
                for (let i = -Math.floor(numBullets/2); i <= Math.floor(numBullets/2); i++) {
                    let spreadX = (dx/dist)*(4 + wave*0.2) + i*1.5;
                    let spreadY = (dy/dist)*(4 + wave*0.2);
                    enemyProjectiles.push(new EnemyProjectile(this.x + this.width/2, this.y + this.height, spreadX, spreadY, '#ffeb3b'));
                }
                this.shootTimer = Math.max(40, 90 - wave * 5);
            }
        } else if (this.type === 2) {
            // Homing missile logic
            let tx = player.x + player.width/2;
            let ty = player.y + player.height/2;
            let dx = tx - (this.x + this.width/2);
            let dy = ty - (this.y + this.height/2);
            let angle = Math.atan2(dy, dx);
            
            let currentAngle = Math.atan2(this.vy, this.vx);
            let angleDiff = angle - currentAngle;
            
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            
            let turnSpeed = 0.05 + (wave * 0.01);
            if (Math.abs(angleDiff) < turnSpeed) {
                currentAngle = angle;
            } else {
                currentAngle += Math.sign(angleDiff) * turnSpeed;
            }
            
            this.vx = Math.cos(currentAngle) * this.speed;
            this.vy = Math.sin(currentAngle) * this.speed;
            
            this.x += this.vx;
            this.y += this.vy;
            
            if (frameCount % 3 === 0) {
                particles.push(new Particle(this.x + this.width/2, this.y, 0, 0, '#aaa', 1));
            }
        }
        
        // Thruster particles
        if (this.type !== 2 && frameCount % 4 === 0) {
             particles.push(new Particle(this.x + this.width / 2, this.y, 0, -1, this.color, 1.5));
        }
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        
        if (this.type === 0) {
            // Triangle shape pointing down
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x + this.width, this.y);
            ctx.lineTo(this.x + this.width / 2, this.y + this.height);
            ctx.closePath();
            ctx.fill();
        } else if (this.type === 1) {
            // Hexagon or distinct shape
            ctx.fillRect(this.x, this.y, this.width, this.height);
        } else if (this.type === 2) {
            // Missile shape
            ctx.fillRect(this.x, this.y, this.width, this.height);
            ctx.fillStyle = '#fff';
            ctx.fillRect(this.x + 2, this.y + this.height, this.width - 4, 4); // thruster flame
        }
        ctx.shadowBlur = 0;
    }
}

// Boss Class
class Boss {
    constructor() {
        this.width = 200;
        this.height = 100;
        this.x = canvas.width / 2 - this.width / 2;
        this.y = -200;
        this.targetY = 50;
        this.maxHp = 100 + (wave - 1) * 50;
        this.hp = this.maxHp;
        this.color = '#ff9800'; // Orange
        this.scoreValue = 5000 * wave;
        this.state = 'entering';
        this.timer = 0;
    }

    update() {
        if (this.state === 'entering') {
            this.y += 1;
            if (this.y >= this.targetY) {
                this.state = 'pattern1';
            }
        } else {
            this.timer++;
            // Hover movement
            this.x = (canvas.width / 2 - this.width / 2) + Math.sin(this.timer * 0.02) * 150;
            
            // Pattern 1: Spread shot
            if (this.state === 'pattern1' && this.timer % Math.max(30, 60 - wave * 5) === 0) {
                let spreadCount = 2 + Math.floor(wave / 2);
                for (let i = -spreadCount; i <= spreadCount; i++) {
                    enemyProjectiles.push(new EnemyProjectile(this.x + this.width/2, this.y + this.height, i * 1.5, 5 + wave*0.5, '#ff3366'));
                }
            }
            
            // Pattern 2: Aimed burst + Missiles
            if (this.state === 'pattern2') {
                if (this.timer % 120 < 40 && this.timer % Math.max(5, 10 - wave) === 0) {
                    let dx = (player.x + player.width/2) - (this.x + this.width/2);
                    let dy = (player.y + player.height/2) - (this.y + this.height/2);
                    let dist = Math.sqrt(dx*dx + dy*dy);
                    enemyProjectiles.push(new EnemyProjectile(this.x + this.width/2, this.y + this.height, (dx/dist)*(6 + wave*0.5), (dy/dist)*(6 + wave*0.5), '#ffeb3b'));
                }
                // Spawn homing missiles
                if (wave >= 2 && this.timer % Math.max(60, 120 - wave * 10) === 0) {
                    enemies.push(new Enemy(this.x + 20, this.y + this.height, 2));
                    enemies.push(new Enemy(this.x + this.width - 20, this.y + this.height, 2));
                }
            }
            
            // Enrage phase change
            if (this.hp < this.maxHp / 2 && this.state === 'pattern1') {
                this.state = 'pattern2';
                this.color = '#f44336';
            }
        }
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 20;
        ctx.shadowColor = this.color;
        
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.fillRect(this.x + 20, this.y + this.height, 40, 30);
        ctx.fillRect(this.x + this.width - 60, this.y + this.height, 40, 30);
        
        ctx.shadowBlur = 0;
        
        if (this.y >= 0) {
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(this.x, this.y - 15, this.width, 5);
            ctx.fillStyle = '#00ff00';
            ctx.fillRect(this.x, this.y - 15, this.width * (this.hp / this.maxHp), 5);
        }
    }
}

// Particle Class
class Particle {
    constructor(x, y, vx, vy, color, life) {
        this.x = x;
        this.y = y;
        this.vx = vx + (Math.random() - 0.5) * 1;
        this.vy = vy + (Math.random() - 0.5) * 1;
        this.color = color;
        this.life = life;
        this.maxLife = life;
        this.size = Math.random() * 3 + 1;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= 0.1;
    }

    draw() {
        ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
        drawGlow(this.x, this.y, this.size, this.color, 5);
        ctx.globalAlpha = 1.0;
    }
}

function createExplosion(x, y, numParticles, color) {
    for (let i = 0; i < numParticles; i++) {
        particles.push(new Particle(x, y, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, color, 2 + Math.random() * 2));
    }
}

let player = new Player();

// Starfield background
const stars = Array(100).fill().map(() => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    speed: Math.random() * 2 + 0.5,
    size: Math.random() * 2
}));

function drawBackground() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'; // Trail effect
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#ffffff';
    stars.forEach(star => {
        star.y += star.speed;
        if (star.y > canvas.height) {
            star.y = 0;
            star.x = Math.random() * canvas.width;
        }
        ctx.fillRect(star.x, star.y, star.size, star.size);
    });
}

function updateUI() {
    scoreDisplay.innerText = `SCORE: ${score.toString().padStart(6, '0')}`;
    livesDisplay.innerText = `LIVES: ${'♥ '.repeat(Math.max(0, player.lives))}`;
    bombsDisplay.innerText = `BOMBS: ${'★ '.repeat(player.bombs)}`;
}

function checkCollisions() {
    // Player Projectiles vs Enemies
    for (let i = projectiles.length - 1; i >= 0; i--) {
        let p = projectiles[i];
        let pRect = {x: p.x - p.width/2, y: p.y, width: p.width, height: p.height};
        
        for (let j = enemies.length - 1; j >= 0; j--) {
            let e = enemies[j];
            let eRect = {x: e.x, y: e.y, width: e.width, height: e.height};
            
            if (rectIntersect(pRect, eRect)) {
                projectiles.splice(i, 1);
                e.hp--;
                
                // Hit effect
                createExplosion(p.x, p.y, 3, '#fff');
                
                if (e.hp <= 0) {
                    enemies.splice(j, 1);
                    score += e.scoreValue;
                    createExplosion(e.x + e.width/2, e.y + e.height/2, 15, e.color);
                    // 15% chance to drop item
                    if (Math.random() < 0.15) {
                        let r = Math.random();
                        let itemType = r < 0.5 ? 0 : (r < 0.75 ? 1 : 2);
                        items.push(new Item(e.x + e.width/2 - 10, e.y + e.height/2 - 10, itemType));
                    }
                    updateUI();
                }
                break;
            }
        }
        
        // Player projectiles vs Boss
        if (boss && rectIntersect(pRect, {x: boss.x, y: boss.y, width: boss.width, height: boss.height})) {
            projectiles.splice(i, 1);
            if (boss.state !== 'entering') {
                boss.hp--;
                createExplosion(p.x, p.y, 5, '#fff');
                
                if (boss.hp <= 0) {
                    score += boss.scoreValue;
                    createExplosion(boss.x + boss.width/2, boss.y + boss.height/2, 100, boss.color);
                    boss = null;
                    wave++;
                    updateUI();
                }
            }
        }
    }
    
    if (player.invulnerableTime <= 0) {
        let playerRect = {x: player.x + 5, y: player.y + 10, width: player.width - 10, height: player.height - 15}; // Make hitbox slightly smaller
        
        // Enemies vs Player
        for (let i = enemies.length - 1; i >= 0; i--) {
            let e = enemies[i];
            let eRect = {x: e.x, y: e.y, width: e.width, height: e.height};
            if (rectIntersect(playerRect, eRect)) {
                handlePlayerHit();
                enemies.splice(i, 1);
                createExplosion(e.x + e.width/2, e.y + e.height/2, 15, e.color);
                break;
            }
        }

        // Enemy Projectiles vs Player
        for (let i = enemyProjectiles.length - 1; i >= 0; i--) {
            let ep = enemyProjectiles[i];
            // Simple circle vs rect collision
            let testX = ep.x;
            let testY = ep.y;
            
            if (ep.x < playerRect.x) testX = playerRect.x;
            else if (ep.x > playerRect.x + playerRect.width) testX = playerRect.x + playerRect.width;
            if (ep.y < playerRect.y) testY = playerRect.y;
            else if (ep.y > playerRect.y + playerRect.height) testY = playerRect.y + playerRect.height;
            
            let distX = ep.x - testX;
            let distY = ep.y - testY;
            let distance = Math.sqrt((distX*distX) + (distY*distY));
            
            if (distance <= ep.radius) {
                handlePlayerHit();
                enemyProjectiles.splice(i, 1);
                break;
            }
        }
        
        // Items vs Player
        for (let i = items.length - 1; i >= 0; i--) {
            let item = items[i];
            let itemRect = {x: item.x, y: item.y, width: item.width, height: item.height};
            if (rectIntersect(playerRect, itemRect)) {
                if (item.type === 0) {
                    if (player.weaponLevel < 3) player.weaponLevel++;
                    score += 500;
                } else if (item.type === 1) {
                    player.bombs++;
                } else if (item.type === 2) {
                    if (player.missileLevel < 4) player.missileLevel++;
                    score += 500;
                }
                items.splice(i, 1);
                updateUI();
                createExplosion(item.x + 10, item.y + 10, 10, item.color);
            }
        }
    }
}

function handlePlayerHit() {
    createExplosion(player.x + player.width/2, player.y + player.height/2, 30, player.color);
    player.lives--;
    updateUI();
    
    if (player.lives < 0) {
        currentState = GAME_STATE.GAME_OVER;
        gameOverScreen.classList.remove('hidden');
    } else {
        player.invulnerableTime = 120; // 2 seconds
        // reset position slightly?
    }
}

function spawnEnemies() {
    if (boss) return; // Do not spawn regular enemies during boss fight
    
    // Spawn Boss after 30 seconds (1800 frames) or if score is high
    if (frameCount > 0 && frameCount % 1800 === 0) {
        boss = new Boss();
        return;
    }

    if (frameCount % Math.max(20, 60 - wave * 5) === 0) {
        // Basic enemy
        enemies.push(new Enemy(Math.random() * (canvas.width - 30), -30, 0));
    }
    
    if (frameCount > 300 && frameCount % Math.max(60, 180 - wave * 10) === 0) {
        // Stronger enemy
        enemies.push(new Enemy(Math.random() * (canvas.width - 45), -40, 1));
    }

    if (wave >= 2 && frameCount > 600 && frameCount % Math.max(90, 240 - wave * 15) === 0) {
        // Homing missile enemy
        enemies.push(new Enemy(Math.random() * (canvas.width - 20), -20, 2));
    }
}

function resetGame() {
    player = new Player();
    projectiles = [];
    enemies = [];
    enemyProjectiles = [];
    particles = [];
    items = [];
    boss = null;
    score = 0;
    frameCount = 0;
    wave = 1;
    currentState = GAME_STATE.PLAYING;
    gameOverScreen.classList.add('hidden');
    updateUI();
}

function gameLoop() {
    if (currentState === GAME_STATE.PLAYING) {
        // Update
        player.update();
        
        for (let i = projectiles.length - 1; i >= 0; i--) {
            let p = projectiles[i];
            p.update();
            if (p.y < -20 || p.y > canvas.height + 20 || p.x < -20 || p.x > canvas.width + 20) {
                projectiles.splice(i, 1);
            }
        }

        enemyProjectiles.forEach((p, index) => {
            p.update();
            if (p.y > canvas.height + 20) enemyProjectiles.splice(index, 1);
        });
        
        enemies.forEach((e, index) => {
            e.update();
            if (e.y > canvas.height + 50) enemies.splice(index, 1);
        });
        
        items.forEach((item, index) => {
            item.update();
            if (item.y > canvas.height + 20) items.splice(index, 1);
        });
        
        particles.forEach((p, index) => {
            p.update();
            if (p.life <= 0) particles.splice(index, 1);
        });

        if (boss) {
            boss.update();
        }

        spawnEnemies();
        checkCollisions();
        
        frameCount++;
    }

    // Draw
    drawBackground();
    
    if (currentState === GAME_STATE.PLAYING || (currentState === GAME_STATE.GAME_OVER && player.lives >= 0)) {
        player.draw();
    }
    
    projectiles.forEach(p => p.draw());
    enemyProjectiles.forEach(p => p.draw());
    enemies.forEach(e => e.draw());
    items.forEach(item => item.draw());
    if (boss) boss.draw();
    particles.forEach(p => p.draw());

    requestAnimationFrame(gameLoop);
}

// Start
updateUI();
gameLoop();

