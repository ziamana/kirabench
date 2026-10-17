(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const overlay = document.getElementById("overlay");
  const restartBtn = document.getElementById("restart");

  const CELL = 20;
  const COLS = canvas.width / CELL; // 20
  const ROWS = canvas.height / CELL; // 20

  let snake, dir, nextDir, food, score, loop, running;

  function reset() {
    snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
    dir = { x: 1, y: 0 };
    nextDir = { x: 1, y: 0 };
    score = 0;
    scoreEl.textContent = score;
    placeFood();
    overlay.classList.add("hidden");
    running = true;
    if (loop) clearInterval(loop);
    loop = setInterval(tick, 100);
  }

  function placeFood() {
    let pos;
    do {
      pos = {
        x: Math.floor(Math.random() * COLS),
        y: Math.floor(Math.random() * ROWS),
      };
    } while (snake.some((s) => s.x === pos.x && s.y === pos.y));
    food = pos;
  }

  function tick() {
    if (!running) return;
    dir = nextDir;
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

    // Wall collision
    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
      return gameOver();
    }
    // Self collision
    if (snake.some((s) => s.x === head.x && s.y === head.y)) {
      return gameOver();
    }

    snake.unshift(head);

    if (head.x === food.x && head.y === food.y) {
      score += 1;
      scoreEl.textContent = score;
      placeFood();
    } else {
      snake.pop();
    }

    draw();
  }

  function draw() {
    ctx.fillStyle = "#0f0f1a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Food
    ctx.fillStyle = "#ff5252";
    ctx.fillRect(food.x * CELL, food.y * CELL, CELL, CELL);

    // Snake
    ctx.fillStyle = "#4caf50";
    for (const segment of snake) {
      ctx.fillRect(segment.x * CELL, segment.y * CELL, CELL, CELL);
    }
  }

  function gameOver() {
    running = false;
    if (loop) clearInterval(loop);
    draw();
    overlay.classList.remove("hidden");
  }

  function setDirection(x, y) {
    // Prevent reversing directly into itself
    if (x === -dir.x && y === -dir.y) return;
    nextDir = { x, y };
  }

  document.addEventListener("keydown", (e) => {
    switch (e.key) {
      case "ArrowUp": setDirection(0, -1); break;
      case "ArrowDown": setDirection(0, 1); break;
      case "ArrowLeft": setDirection(-1, 0); break;
      case "ArrowRight": setDirection(1, 0); break;
      default: return; // ignore other keys
    }
    e.preventDefault();
  });

  restartBtn.addEventListener("click", reset);

  reset();
  draw();
})();
