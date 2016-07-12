/**
 * @file
 * Snake on Espruino.
 *
 * Classic Snake game written in JavaScript for the Espruino microcontroller.
 *
 * @see http://www.espruino.com
 */

/**
 * Hardware settings.
 */
var PIN_CONTROLLER = 0,
    PIN_MATRIX = B15,
    MATRIX_WIDTH = 15,
    MATRIX_HEIGHT = 15,
    MATRIX_ROTATE = 0;


// Set up matrix - WS2812B chipset.
SPI2.setup({baud:3200000, mosi:PIN_MATRIX});
var m = Graphics.createArrayBuffer(MATRIX_WIDTH, MATRIX_HEIGHT, 24, {zigzag:true, color_order: 'bgr'});
m.flip = function(){
  SPI2.send4bit(m.buffer, 0b0001, 0b0011);
};
m.setRotation(MATRIX_ROTATE);


/**
 * Helper functions.
 */
m.drawCircle = function(posX, posY, radX){
  var radY = 0;
  // Decision criterion divided by 2 evaluated at radX=radX, radY=0 .
  var decisionOver2 = 1 - radX;

  while (radX >= radY) {
    m.setPixel(radX + posX,  radY + posY);
    m.setPixel(radY + posX,  radX + posY);
    m.setPixel(-radX + posX,  radY + posY);
    m.setPixel(-radY + posX,  radX + posY);
    m.setPixel(-radX + posX, -radY + posY);
    m.setPixel(-radY + posX, -radX + posY);
    m.setPixel(radX + posX, -radY + posY);
    m.setPixel(radY + posX, -radX + posY);
    radY++;

    if (decisionOver2 <= 0) {
      // Change in decision criterion for radY -> radY+1 .
      decisionOver2 += 2 * radY + 1;
    }
    else {
      radX--;
      // Change for radY -> radY+1, radX -> radX-1 .
      decisionOver2 += 2 * (radY - radX) + 1;
    }
  }
};


/**
 * Game settings.
 */
var game = {
  // Game play speed.
  speed: 15,
  // Game increase speed.
  speed_increase: 0.5,
  // Brightness 1 = 100%.
  brightness: 0.2,
  // Frames per second.
  fps: 30,
  // Current frame.
  frame: 1,
  // Score.
  score: 0,
  width: MATRIX_WIDTH,
  height: MATRIX_HEIGHT,
  // Global game timer in floating point micro seconds.
  timer: 0,
  // A global re-usable counter.
  counter: 0
};


/**
 * Snake class.
 */
var snake = {

  // Snake settings.
  // Direction: Up 1, Right 2, Down 3, Left 4.
  direction: 2,
  direction_next: 0,
  snake: [],
  snakeHit: [],
  snakeColor: [1, 1, 1],
  growing: false,
  is_alive: true,

  /**
   * Draw the block onto the matrix.
   */
  draw: function() {
    this.setColor();
    var i = 0;

    // Draw snake.
    for (i = 0; i < this.snake.length; i++) {
      m.setPixel(this.snake[i][0], this.snake[i][1]);
    }
    // If the snake hit something draw it.
    for (i = 0; i < this.snakeHit.length; i++) {
      this.setColor('hit');
      m.setPixel(this.snakeHit[i][0], this.snakeHit[i][1]);
    }
  },


  /**
   * Move snake.
   */
  move: function() {
    var nextPixel = [];

    // Is the snake going where the player told it to go next?
    if (this.direction_next > 0 && this.direction_next !== this.direction) {
      this.direction = this.direction_next;
      this.direction_next = 0;
    }

    switch (this.direction) {
      // Up.
      case 1:
        nextPixel = [this.snake[0][0], this.snake[0][1] - 1];
        break;

      // Right.
      case 2:
        nextPixel = [this.snake[0][0] + 1, this.snake[0][1]];
        break;

      // Down.
      case 3:
        nextPixel = [this.snake[0][0], this.snake[0][1] + 1];
        break;

      // Left.
      case 4:
        nextPixel = [this.snake[0][0] - 1, this.snake[0][1]];
        break;
    }

    // Check collosions.
    if (this.hitDetection(nextPixel)) {
      // Snake died.
      this.is_alive = false;
    }
    else {
      this.snake.unshift([nextPixel[0], nextPixel[1]]);

      // Move last pixel or grow?
      if (this.growing) {
        // Don't remove tail and set growing to false for next tick.
        this.growing = false;
      }
      else {
        // Remove last pixel.
        this.snake.pop();
      }
    }
  },


  dying: function() {
    // Set timer.
    if (game.counter === 0) {
      game.counter = game.timer;
    }

    // After waiting 1 second, and every X ticks remove a pice from the end of snake.
    if (game.timer >= (game.counter + 1000) && Math.floor(game.frame) % Math.floor(game.fps / 6) === 0) {
      // Remove last part of the snake.
      this.snake.pop();

      // When snake is gone end the game.
      if (this.snake.length <= 0) {
        // Clear snake hit array.
        this.snakeHit = [];
        // Reset counter.
        game.counter = 0;
        state.current = 'gameover';
      }
    }
  },


  /**
   * Check this block is in bounds.
   */
  hitDetection: function(pixel) {
    // Hit walls?
    if (pixel[0] < 0 ||
        pixel[0] >= game.width ||
        pixel[1] < 0 ||
        pixel[1] >= game.height) {
      // Hit wall.
      this.snakeHit.push(this.snake[0]);
      return true;
    }
    // Hit apple?
    else if (pixel[0] === apple.apple[0] && pixel[1] === apple.apple[1]) {
      apple.eat();
    }
    // Hit self?
    else if (JSON.stringify(this.snake).indexOf('[' + pixel[0] + ',' + pixel[1] + ']') >= 0) {
      this.snakeHit.push([pixel[0], pixel[1]]);
      return true;
    }
  },


  /**
   * Check this block is in bounds.
   */
  grow: function() {
    this.growing = true;
  },


  /**
   * Add the snake.
   */
  create: function() {
    // Snake starting point and size.
    game.speed = 15;
    this.direction = 2;
    this.direction_next = 0;
    this.snake = [[3,1], [2,1], [1,1]];
    this.is_alive = true;
  },


  /**
   * Set snake colour before output.
   */
  setColor: function(status) {

    switch (status) {
      case 'hit':
        // Hit - red.
        m.setColor(1 * game.brightness,
                   0 * game.brightness,
                   0 * game.brightness);
        break;

      default:
        // Default snake white.
        m.setColor(this.snakeColor[0] * game.brightness,
                   this.snakeColor[1] * game.brightness,
                   this.snakeColor[2] * game.brightness);
        break;
    }
  }
};


/**
 * Apple class.
 */
var apple = {

  apple: [],
  appleColor: [0, 1, 0],
  removing: [],
  removingStep: 0,


  /**
   * Add a new apple.
   */
  add: function() {
    // Pick random point and check is free.
    var x = Math.floor(Math.random() * game.width),
        y = Math.floor(Math.random() * game.height);

    // Ensure snake hasn't moved.
    snake.draw();

    // If space is occupied try again.
    if (m.getPixel(x, y) > 0) {
      this.add();
    }
    else {
      // Space is free, add apple.
      this.apple = [x, y];
      this.draw();
    }
  },


  /**
   * Draw apple.
   */
  draw: function() {
    // Fade in/out apple.
    var dim = 1;
    if (game.frame > game.fps / 2) {
      dim = game.frame / game.fps;
    }
    else {
      dim = 1 - (game.frame / game.fps);
    }

    // Print pixels.
    this.setColor(dim);
    m.setPixel(this.apple[0], this.apple[1]);

    // Removing apple.
    var removingMax = Math.floor(Math.min(game.width, game.height) / 2);
    if (this.removingStep > removingMax) {
      // Remove removing animastio when completed.
      this.removingStep = 0;
    }
    else if (this.removingStep > 0) {
      // Animate removing.
      dim = (8 - this.removingStep) / removingMax;
      this.setColor(dim);
      m.drawCircle(this.removing[0], this.removing[1], this.removingStep);
      this.removingStep++;
    }
  },


  /**
   * Eat apple.
   */
  eat: function() {

    // Grow snake.
    snake.grow();
    // Remove apple.
    this.remove();
    // Add new apple.
    this.add();
    // Increase score.
    game.score++;
    // Increase speed.
    game.speed -= game.speed_increase;
  },


  /**
   * Remove current Apple.
   */
  remove: function() {
    // Set apple to be removed.
    this.removing = [this.apple[0], this.apple[1]];
    this.removingStep = 1;
  },

  /**
   * Set apple color.
   */
  setColor: function(dim) {
    m.setColor(this.appleColor[0] * game.brightness * dim,
               this.appleColor[1] * game.brightness * dim,
               this.appleColor[2] * game.brightness * dim);
  }
};


var animations = {

  cross_clear_settings: {
    vertical: 0,
    horizontal: Math.round(game.height / -4)
  },

  cross_clear: function() {
    m.setColor(0.1 * game.brightness,
               0.5 * game.brightness,
               0.1 * game.brightness);

    // Horizontal.
    m.drawLine(0, this.cross_clear_settings.vertical, game.width, this.cross_clear_settings.vertical);
    // Vertical.
    m.drawLine(this.cross_clear_settings.horizontal, 0, this.cross_clear_settings.horizontal, game.height);

    this.cross_clear_settings.vertical++;
    this.cross_clear_settings.horizontal++;

    // Check if completed.
    if (this.cross_clear_settings.vertical >= game.width && this.cross_clear_settings.horizontal >= game.height) {

      // Reset cross clear settings.
      this.cross_clear_settings.vertical = 0;
      this.cross_clear_settings.horizontal = Math.round(game.height / -4);

      // Restart game.
      state.current = 'start';
    }
  }
};


var state = {
  // The current state.
  current: '',

  // Start the game.
  start: function() {
    m.clear();
    m.flip();

    snake.create();
    apple.add();
    // Change state to playing.
    this.current = 'playing';
  },

  playing: function() {

    // Move Snake?
    if (snake.is_alive && Math.floor(game.frame % game.speed) === 0) {
      snake.move();
    }
    else if (!snake.is_alive) {
      snake.dying();
    }

    // Output snake and apple.
    snake.draw();
    apple.draw();
  },

  // Game is over.
  gameover: function() {
    animations.cross_clear();
  },

  // Output.
  output: function() {
    this[this.current]();
  }
};


// Control setup.
digitalWrite(A5, 0);
digitalWrite(B10, 1);
// Read controls function.
var controls = {
  // Check for control input and change
  // snake direction if is not opposite of current.
  action: function() {
    var axesX = analogRead(B1),
        axesY = analogRead(A7);

    if (axesX < 0.1) {
      if (snake.direction != 4) {
        snake.direction_next = 2;
      }
    }
    else if (axesX > 0.9) {
      if (snake.direction != 2) {
        snake.direction_next = 4;
      }
    }
    else if (axesY < 0.1) {
      if (snake.direction != 1) {
        snake.direction_next = 3;
      }
    }
    else if (axesY > 0.9) {
      if (snake.direction != 3) {
        snake.direction_next = 1;
      }
    }
  }
};


function tick() {
  // Clear matrix.
  m.clear();

  // Check for control input.
  controls.action();

  // Send to matrix.
  state.output();
  m.flip();

  // Update FPS.
  game.frame++;
  if (game.frame > game.fps) {
    game.frame = 1;
  }

  // Update global timer.
  game.timer += new Date();
}

state.current = 'start';
game.tick = setInterval(tick, 1000 / game.fps);
