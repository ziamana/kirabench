const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const GRID_SIZE = 20;
const CELL_SIZE = 20;
canvas.width = GRID_SIZE * CELL_SIZE;
canvas.height = GRID_SIZE * CELL_SIZE;

let snake = [
    {x: 10, y: 10},
    {x: 9, y: 10},
    {x: 8, y: 10}
];
let direction = {x: 1, y: 0};
let nextDirection = {x: 1, y: 0};
let food = null;
let score = 0;
let gameOver = false;

function spawnFood() {
    let pos;
    do {
        pos = {
            x: Math.floor(Math.random() * GRID_SIZE),
            y: Math.floor(Math.random() * GRID_SIZE)
        };
    } while (snake.some(seg => seg.x === pos.x && seg.y === pos.y));
    food = pos;
}

function draw() {
    ctx.fillStyle = '#34495e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (food) {
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(food.x * CELL_SIZE, food.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    }

    snake.forEach((seg, i) => {
        ctx.fillStyle = i === 0 ? '#2ecc71' : '#27ae60';
        ctx.fillRect(seg.x * CELL_SIZE, seg.y * CELL_SIZE, CELL_SIZE - 1, CELL_SIZE - 1);
    });

    document.getElementById('score').textContent = 'Score: ' + score;
}

function update() {
    if (gameOver) return;

    direction.x = nextDirection.x;
    direction.y = nextDirection.y;

    const head = {x: snake[0].x + direction.x, y: snake[0].y + direction.y};

    // Wall collision
    if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
        endGame();
        return;
    }

    // Self collision
    if (snake.some(seg => seg.x === head.x && seg.y === head.y)) {
        endGame();
        return;
    }

    snake.unshift(head);

    // Food check
    if (food && head.x === food.x && head.y === food.y) {
        score++;
        spawnFood();
    } else {
        snake.pop();
    }
}

function endGame() {
    gameOver = true;
    document.getElementById('message').innerHTML = 'Game Over! <button id="restart-btn">Restart</button>';
    document.getElementById('restart-btn').addEventListener('click', restart);
}

function restart() {
    snake = [{x: 10, y: 10}, {x: 9, y: 10}, {x: 8, y: 10}];
    direction = {x: 1, y: 0};
    nextDirection = {x: 1, y: 0};
    score = 0;
    gameOver = false;
    document.getElementById('message').innerHTML = '';
    spawnFood();
    draw();
}

document.addEventListener('keydown', (e) => {
    switch(e.key) {
        case 'ArrowUp':
            if (direction.y !== 1) nextDirection = {x: 0, y: -1};
            break;
        case 'ArrowDown':
            if (direction.y !== -1) nextDirection = {x: 0, y: 1};
            break;
        case 'ArrowLeft':
            if (direction.x !== 1) nextDirection = {x: -1, y: 0};
            break;
        case 'ArrowRight':
            if (direction.x !== -1) nextDirection = {x: 1, y: 0};
            break;
    }
});

spawnFood();
draw();
setInterval(update, 100);
