(function () {
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const gameOverEl = document.getElementById('game-over');
  const finalScoreEl = document.getElementById('final-score');
  const restartBtn = document.getElementById('restart-btn');

  const GRID_SIZE = 20;
  const TILE_COUNT = canvas.width / GRID_SIZE;
  const GAME_SPEED = 120; // ms per tick

  let snake, direction, nextDirection, food, score, gameLoop, isRunning;

  function init() {
    snake = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 }
    ];
    direction = { x: 1, y: 0 };
    nextDirection = { x: 1, y: 0 };
    score = 0;
    scoreEl.textContent = 'Score: 0';
    gameOverEl.classList.add('hidden');
    isRunning = true;
    placeFood();
    if (gameLoop) clearInterval(gameLoop);
    gameLoop = setInterval(update, GAME_SPEED);
  }

  function placeFood() {
    let valid = false;
    while (!valid) {
      food = {
        x: Math.floor(Math.random() * TILE_COUNT),
        y: Math.floor(Math.random() * TILE_COUNT)
      };
      valid = !snake.some(function (seg) {
        return seg.x === food.x && seg.y === food.y;
      });
    }
  }

  function update() {
    if (!isRunning) return;

    direction = nextDirection;

    var head = {
      x: snake[0].x + direction.x,
      y: snake[0].y + direction.y
    };

    // Wall collision
    if (head.x < 0 || head.x >= TILE_COUNT || head.y < 0 || head.y >= TILE_COUNT) {
      endGame();
      return;
    }

    // Self collision
    for (var i = 0; i < snake.length; i++) {
      if (snake[i].x === head.x && snake[i].y === head.y) {
        endGame();
        return;
      }
    }

    snake.unshift(head);

    // Eat food
    if (head.x === food.x && head.y === food.y) {
      score++;
      scoreEl.textContent = 'Score: ' + score;
      placeFood();
    } else {
      snake.pop();
    }

    draw();
  }

  function draw() {
    // Clear
    ctx.fillStyle = '#16213e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid lines (subtle)
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    for (var i = 0; i <= TILE_COUNT; i++) {
      ctx.beginPath();
      ctx.moveTo(i * GRID_SIZE, 0);
      ctx.lineTo(i * GRID_SIZE, canvas.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * GRID_SIZE);
      ctx.lineTo(canvas.width, i * GRID_SIZE);
      ctx.stroke();
    }

    // Draw food
    ctx.fillStyle = '#e74c3c';
    ctx.shadowColor = 'rgba(231, 76, 60, 0.7)';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(
      food.x * GRID_SIZE + GRID_SIZE / 2,
      food.y * GRID_SIZE + GRID_SIZE / 2,
      GRID_SIZE / 2 - 2,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.shadowBlur = 0;

    // Draw snake
    for (var j = 0; j < snake.length; j++) {
      var seg = snake[j];
      if (j === 0) {
        // Head
        ctx.fillStyle = '#00d26a';
        ctx.shadowColor = 'rgba(0, 210, 106, 0.5)';
        ctx.shadowBlur = 8;
      } else {
        // Body - gradient from bright to darker green
        var ratio = j / snake.length;
        var g = Math.round(210 - ratio * 80);
        ctx.fillStyle = 'rgb(0, ' + g + ', ' + Math.round(106 - ratio * 40) + ')';
        ctx.shadowBlur = 0;
      }

      var radius = 4;
      var x = seg.x * GRID_SIZE + 1;
      var y = seg.y * GRID_SIZE + 1;
      var w = GRID_SIZE - 2;
      var h = GRID_SIZE - 2;

      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + w - radius, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
      ctx.lineTo(x + w, y + h - radius);
      ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
      ctx.lineTo(x + radius, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  function endGame() {
    isRunning = false;
    clearInterval(gameLoop);
    finalScoreEl.textContent = 'Final Score: ' + score;
    gameOverEl.classList.remove('hidden');
  }

  // Keyboard controls
  document.addEventListener('keydown', function (e) {
    switch (e.key) {
      case 'ArrowUp':
        if (direction.y !== 1) nextDirection = { x: 0, y: -1 };
        e.preventDefault();
        break;
      case 'ArrowDown':
        if (direction.y !== -1) nextDirection = { x: 0, y: 1 };
        e.preventDefault();
        break;
      case 'ArrowLeft':
        if (direction.x !== 1) nextDirection = { x: -1, y: 0 };
        e.preventDefault();
        break;
      case 'ArrowRight':
        if (direction.x !== -1) nextDirection = { x: 1, y: 0 };
        e.preventDefault();
        break;
    }
  });

  restartBtn.addEventListener('click', init);

  // Start the game
  init();
})();
