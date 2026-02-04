// グローバル状態管理
const state = {
  token: localStorage.getItem('token') || null,
  username: localStorage.getItem('username') || null,
  currentPage: 'hub',
  currentGame: null,
  gameMode: 'ai',
  stats: { wins: 0, losses: 0, draws: 0, gamesPlayed: 0 },
  socket: null,
  onlineRoom: null,
  playerIndex: null,
  gameHistory: []
};

// Socket.IO接続
if (state.token) {
  state.socket = io();
}

// ゲーム定義
const games = {
  'chess': { name: 'チェス', icon: '♔', category: 'board', online: false },
  'shogi': { name: '将棋', icon: '☗', category: 'board', online: false },
  'go': { name: '囲碁', icon: '⚫', category: 'board', online: false },
  'reversi': { name: 'リバーシ', icon: '⚫', category: 'board', online: true },
  'checkers': { name: 'チェッカー', icon: '⛃', category: 'board', online: false },
  'backgammon': { name: 'バックギャモン', icon: '⚅', category: 'board', online: false },
  'tic-tac-toe': { name: '三目並べ', icon: '⭕', category: 'board', online: true },
  'connect4': { name: '四目並べ', icon: '🔴', category: 'board', online: true },
  'poker': { name: 'ポーカー', icon: '🃏', category: 'card', online: true },
  'blackjack': { name: 'ブラックジャック', icon: '🂡', category: 'card', online: true },
  'baccarat': { name: 'バカラ', icon: '💎', category: 'card', online: false },
  'uno': { name: 'UNO', icon: '🎴', category: 'card', online: false },
  'hearts': { name: 'ハーツ', icon: '♥️', category: 'card', online: false },
  'spades': { name: 'スペード', icon: '♠️', category: 'card', online: false },
  'bridge': { name: 'ブリッジ', icon: '🌉', category: 'card', online: false },
  'roulette': { name: 'ルーレット', icon: '🎡', category: 'casino', online: false },
  'slots': { name: 'スロット', icon: '🎰', category: 'casino', online: false },
  'craps': { name: 'クラップス', icon: '🎲', category: 'casino', online: false },
  'sicbo': { name: '大小', icon: '🎲', category: 'casino', online: false },
  'keno': { name: 'キノ', icon: '🔢', category: 'casino', online: false },
  'liar-dice': { name: 'ライアーズダイス', icon: '🎲', category: 'dice', online: false },
  'yahtzee': { name: 'ヤッツィー', icon: '🎲', category: 'dice', online: false },
  'farkle': { name: 'ファークル', icon: '🎲', category: 'dice', online: false },
  'cho-han': { name: '丁半', icon: '🎲', category: 'dice', online: false },
  'mahjong': { name: '麻雀', icon: '🀄', category: 'other', online: false },
  'dominoes': { name: 'ドミノ', icon: '🁢', category: 'other', online: false },
  'minesweeper': { name: 'マインスイーパー', icon: '💣', category: 'other', online: false },
  'sudoku': { name: '数独', icon: '🔢', category: 'other', online: false },
  '2048': { name: '2048', icon: '2️⃣', category: 'other', online: false }
};

// 初期化
document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  initSidebar();
  initNavigation();
  
  if (state.token) {
    showApp();
    loadUserStats();
    initSocket();
  }
});

// 認証関連
function initAuth() {
  const authTabs = document.querySelectorAll('.auth-tab');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const verifyForm = document.getElementById('verifyForm');
  
  authTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      authTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      loginForm.classList.remove('active');
      registerForm.classList.remove('active');
      
      if (tabName === 'login') {
        loginForm.classList.add('active');
      } else {
        registerForm.classList.add('active');
      }
    });
  });
  
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        state.token = data.token;
        state.username = data.username;
        localStorage.setItem('token', data.token);
        localStorage.setItem('username', data.username);
        showApp();
        loadUserStats();
        initSocket();
      } else {
        showError('loginError', data.error);
      }
    } catch (err) {
      showError('loginError', 'サーバーエラーが発生しました');
    }
  });
  
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('registerUsername').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        registerForm.classList.remove('active');
        verifyForm.classList.add('active');
        verifyForm.dataset.email = email;
        
        if (data.devCode) {
          const codeDisplay = document.createElement('div');
          codeDisplay.className = 'dev-code-display';
          codeDisplay.innerHTML = `
            <div style="background: #10b981; color: white; padding: 15px; border-radius: 10px; margin-bottom: 20px;">
              <strong>開発環境用:</strong> 認証コード: <span style="font-size: 24px; letter-spacing: 3px;">${data.devCode}</span>
            </div>
          `;
          verifyForm.insertBefore(codeDisplay, verifyForm.firstChild);
        }
      } else {
        showError('registerError', data.error);
      }
    } catch (err) {
      showError('registerError', 'サーバーエラーが発生しました');
    }
  });
  
  verifyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = document.getElementById('verifyCode').value;
    const email = verifyForm.dataset.email;
    
    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        state.token = data.token;
        state.username = data.username;
        localStorage.setItem('token', data.token);
        localStorage.setItem('username', data.username);
        showApp();
        loadUserStats();
        initSocket();
      } else {
        showError('verifyError', data.error);
      }
    } catch (err) {
      showError('verifyError', 'サーバーエラーが発生しました');
    }
  });
  
  document.getElementById('logoutBtn').addEventListener('click', () => {
    state.token = null;
    state.username = null;
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    if (state.socket) {
      state.socket.disconnect();
    }
    location.reload();
  });
}

function showError(elementId, message) {
  const errorEl = document.getElementById(elementId);
  errorEl.textContent = message;
  errorEl.classList.add('show');
  setTimeout(() => errorEl.classList.remove('show'), 3000);
}

function showApp() {
  document.getElementById('authModal').classList.remove('active');
  document.getElementById('mainApp').classList.remove('hidden');
  document.getElementById('usernameDisplay').textContent = state.username;
}

// Socket.IO初期化
function initSocket() {
  if (!state.socket) {
    state.socket = io();
  }
  
  state.socket.on('match-found', (data) => {
    state.onlineRoom = data.roomId;
    state.playerIndex = data.playerIndex;
    
    const container = document.getElementById('gameContainer');
    container.querySelector('.online-waiting').remove();
    
    renderOnlineGame(data.gameState);
  });
  
  state.socket.on('waiting-for-match', () => {
    const container = document.getElementById('gameContainer');
    container.innerHTML = `
      <div class="online-waiting">
        <div class="spinner"></div>
        <h2>対戦相手を探しています...</h2>
        <p class="online-status">マッチング待機中</p>
      </div>
    `;
  });
  
  state.socket.on('game-update', (data) => {
    updateOnlineGameState(data);
  });
  
  state.socket.on('game-over', (data) => {
    handleGameOver(data);
  });
  
  state.socket.on('opponent-disconnected', () => {
    alert('対戦相手が切断しました');
    navigateTo('hub');
  });
  
  state.socket.on('error', (data) => {
    showGameError(data.message);
  });
}

// サイドバー
function initSidebar() {
  const toggle = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');
  
  toggle.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    if (window.innerWidth <= 768) {
      sidebar.classList.toggle('mobile-open');
    }
  });
  
  const navHeaders = document.querySelectorAll('.nav-header');
  navHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const section = header.parentElement;
      const items = section.querySelector('.nav-items');
      
      if (items) {
        header.classList.toggle('active');
        items.classList.toggle('collapsed');
      } else {
        const sectionName = header.dataset.section;
        navigateTo(sectionName);
      }
    });
  });
  
  document.querySelectorAll('.category-card').forEach(card => {
    card.addEventListener('click', () => {
      const section = card.dataset.section;
      const navHeader = document.querySelector(`.nav-header[data-section="${section}"]`);
      if (navHeader && navHeader.parentElement.querySelector('.nav-items')) {
        navHeader.click();
      }
    });
  });
}

// ナビゲーション
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const gameId = item.dataset.game;
      loadGame(gameId);
      
      navItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
    });
  });
  
  document.getElementById('backBtn').addEventListener('click', () => {
    if (state.onlineRoom && state.socket) {
      state.socket.disconnect();
      state.socket = io();
      initSocket();
    }
    navigateTo('hub');
  });
  
  const modeBtns = document.querySelectorAll('.mode-btn');
  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      
      if (mode === 'online' && !games[state.currentGame]?.online) {
        alert('このゲームはまだオンライン対戦に対応していません');
        return;
      }
      
      state.gameMode = mode;
      modeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      loadGame(state.currentGame);
    });
  });
}

function navigateTo(pageName) {
  const pages = document.querySelectorAll('.page');
  pages.forEach(p => p.classList.remove('active'));
  
  const targetPage = document.getElementById(`${pageName}Page`);
  if (targetPage) {
    targetPage.classList.add('active');
    state.currentPage = pageName;
    
    if (pageName === 'stats') {
      loadUserStats();
      loadGameHistory();
    }
  }
}

// ゲーム読み込み
function loadGame(gameId) {
  state.currentGame = gameId;
  const game = games[gameId];
  
  document.getElementById('gameTitle').textContent = `${game.icon} ${game.name}`;
  navigateTo('game');
  
  const container = document.getElementById('gameContainer');
  
  if (state.gameMode === 'online') {
    container.innerHTML = `
      <div class="online-waiting">
        <div class="spinner"></div>
        <h2>マッチング開始...</h2>
      </div>
    `;
    
    setTimeout(() => {
      state.socket.emit('find-match', {
        gameType: gameId,
        username: state.username,
        token: state.token
      });
    }, 500);
  } else {
    container.innerHTML = generateGameUI(gameId);
    initGameLogic(gameId);
  }
}

function generateGameUI(gameId) {
  const templates = {
    'tic-tac-toe': `
      <div class="tic-tac-toe-board">
        <div class="board-grid">
          ${Array(9).fill(0).map((_, i) => `<div class="cell" data-index="${i}"></div>`).join('')}
        </div>
        <div class="game-status">あなたのターン (X)</div>
        <button class="btn-reset">リセット</button>
      </div>
      <style>
        .board-grid {
          display: grid;
          grid-template-columns: repeat(3, 120px);
          gap: 10px;
          margin: 30px auto;
          width: fit-content;
        }
        .cell {
          width: 120px;
          height: 120px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          border-radius: 15px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 60px;
          cursor: pointer;
          transition: all 0.3s;
          color: white;
        }
        .cell:hover:empty {
          transform: scale(1.05);
          box-shadow: 0 10px 20px rgba(0,0,0,0.2);
        }
        .cell.disabled {
          pointer-events: none;
          opacity: 0.7;
        }
        .game-status {
          text-align: center;
          font-size: 24px;
          font-weight: 600;
          margin: 20px 0;
        }
        .btn-reset {
          display: block;
          margin: 20px auto;
          padding: 15px 40px;
          background: #6366f1;
          color: white;
          border: none;
          border-radius: 10px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
        }
      </style>
    `,
    'connect4': `
      <div class="connect4-board">
        <div class="board-columns">
          ${Array(7).fill(0).map((_, i) => `
            <div class="column" data-column="${i}">
              ${Array(6).fill(0).map((_, j) => `<div class="cell" data-row="${j}" data-col="${i}"></div>`).join('')}
            </div>
          `).join('')}
        </div>
        <div class="game-status">あなたのターン 🔴</div>
        <button class="btn-reset">リセット</button>
      </div>
      <style>
        .board-columns {
          display: flex;
          gap: 10px;
          justify-content: center;
          margin: 30px auto;
        }
        .column {
          display: flex;
          flex-direction: column-reverse;
          gap: 10px;
          cursor: pointer;
        }
        .column:hover {
          opacity: 0.8;
        }
        .cell {
          width: 70px;
          height: 70px;
          background: #1e293b;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 40px;
          transition: all 0.3s;
        }
        .cell.player0 { background: #ef4444; }
        .cell.player1 { background: #f59e0b; }
      </style>
    `,
    'reversi': `
      <div class="reversi-board">
        <div class="board-grid-8x8">
          ${Array(64).fill(0).map((_, i) => `<div class="cell-reversi" data-index="${i}"></div>`).join('')}
        </div>
        <div class="game-status">あなたのターン ⚫</div>
        <div class="score-board">
          <div class="score">⚫: <span id="blackScore">2</span></div>
          <div class="score">⚪: <span id="whiteScore">2</span></div>
        </div>
      </div>
      <style>
        .board-grid-8x8 {
          display: grid;
          grid-template-columns: repeat(8, 60px);
          gap: 2px;
          background: #1e293b;
          padding: 2px;
          margin: 30px auto;
          width: fit-content;
        }
        .cell-reversi {
          width: 60px;
          height: 60px;
          background: #10b981;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 40px;
          cursor: pointer;
          transition: all 0.3s;
        }
        .cell-reversi:hover:empty {
          background: #059669;
        }
        .cell-reversi.player0::after { content: '⚫'; }
        .cell-reversi.player1::after { content: '⚪'; }
        .score-board {
          display: flex;
          justify-content: center;
          gap: 40px;
          margin-top: 20px;
          font-size: 24px;
          font-weight: 600;
        }
      </style>
    `,
    'slots': `
      <div class="slots-game">
        <div class="slot-machine">
          <div class="reel" id="reel1">🍒</div>
          <div class="reel" id="reel2">🍋</div>
          <div class="reel" id="reel3">🍊</div>
        </div>
        <div class="balance">残高: <span id="balance">1000</span> コイン</div>
        <button class="btn-spin">スピン (10コイン)</button>
      </div>
      <style>
        .slot-machine {
          display: flex;
          gap: 20px;
          justify-content: center;
          margin: 40px 0;
        }
        .reel {
          width: 150px;
          height: 150px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 80px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }
        .reel.spinning {
          animation: spin 0.5s ease;
        }
        @keyframes spin {
          0%, 100% { transform: rotateX(0); }
          50% { transform: rotateX(180deg); }
        }
        .balance {
          text-align: center;
          font-size: 24px;
          font-weight: 600;
          margin: 20px 0;
        }
        .btn-spin {
          display: block;
          margin: 20px auto;
          padding: 20px 50px;
          background: linear-gradient(135deg, #f59e0b, #ef4444);
          color: white;
          border: none;
          border-radius: 15px;
          font-size: 18px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 5px 15px rgba(0,0,0,0.3);
        }
      </style>
    `,
    'roulette': `
      <div class="roulette-game">
        <div class="roulette-wheel" id="wheel">
          <div class="wheel-center">🎯</div>
        </div>
        <div class="betting-area">
          <button class="bet-btn red" data-bet="red">赤</button>
          <button class="bet-btn black" data-bet="black">黒</button>
          <button class="bet-btn" data-bet="even">偶数</button>
          <button class="bet-btn" data-bet="odd">奇数</button>
        </div>
        <div class="result-display">結果: <span id="rouletteResult">-</span></div>
      </div>
      <style>
        .roulette-wheel {
          width: 300px;
          height: 300px;
          border-radius: 50%;
          background: conic-gradient(red 0deg 180deg, black 180deg 360deg);
          margin: 40px auto;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 10px 40px rgba(0,0,0,0.4);
          transition: transform 2s cubic-bezier(0.17, 0.67, 0.12, 0.99);
        }
        .wheel-center {
          width: 80px;
          height: 80px;
          background: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 40px;
        }
        .betting-area {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 15px;
          max-width: 400px;
          margin: 30px auto;
        }
        .bet-btn {
          padding: 20px;
          border: none;
          border-radius: 10px;
          font-size: 18px;
          font-weight: 600;
          cursor: pointer;
          background: #6366f1;
          color: white;
          transition: all 0.3s;
        }
        .bet-btn:hover {
          transform: translateY(-2px);
        }
        .bet-btn.red { background: #ef4444; }
        .bet-btn.black { background: #1e293b; }
        .result-display {
          text-align: center;
          font-size: 24px;
          font-weight: 600;
          margin-top: 20px;
        }
      </style>
    `
  };
  
  return templates[gameId] || `
    <div class="game-placeholder">
      <h2>${games[gameId].icon} ${games[gameId].name}</h2>
      <p>このゲームは開発中です。近日公開予定！</p>
    </div>
    <style>
      .game-placeholder {
        text-align: center;
        padding: 100px 20px;
      }
      .game-placeholder h2 {
        font-size: 48px;
        margin-bottom: 20px;
      }
    </style>
  `;
}

function initGameLogic(gameId) {
  if (gameId === 'tic-tac-toe') {
    initTicTacToe();
  } else if (gameId === 'connect4') {
    initConnect4();
  } else if (gameId === 'reversi') {
    initReversi();
  } else if (gameId === 'slots') {
    initSlots();
  } else if (gameId === 'roulette') {
    initRoulette();
  }
}

// 三目並べAI対戦
function initTicTacToe() {
  let board = Array(9).fill(null);
  let currentPlayer = 'X';
  let gameActive = true;
  
  const cells = document.querySelectorAll('.cell');
  const status = document.querySelector('.game-status');
  const resetBtn = document.querySelector('.btn-reset');
  
  cells.forEach(cell => {
    cell.addEventListener('click', async () => {
      if (!gameActive) return;
      
      const index = parseInt(cell.dataset.index);
      
      if (board[index] || checkWinner(board)) return;
      
      board[index] = 'X';
      cell.textContent = 'X';
      cell.classList.add('disabled');
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      if (checkWinner(board)) {
        status.textContent = 'あなたの勝ち! 🎉';
        gameActive = false;
        await saveGameResult('win', 'tic-tac-toe');
        return;
      }
      
      if (board.every(c => c)) {
        status.textContent = '引き分け!';
        gameActive = false;
        await saveGameResult('draw', 'tic-tac-toe');
        return;
      }
      
      status.textContent = 'AIが考え中...';
      cells.forEach(c => c.classList.add('disabled'));
      
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const aiMove = getAIMove(board);
      board[aiMove] = 'O';
      cells[aiMove].textContent = 'O';
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      cells.forEach(c => c.classList.remove('disabled'));
      
      if (checkWinner(board)) {
        status.textContent = 'AIの勝ち!';
        gameActive = false;
        await saveGameResult('loss', 'tic-tac-toe');
      } else if (board.every(c => c)) {
        status.textContent = '引き分け!';
        gameActive = false;
        await saveGameResult('draw', 'tic-tac-toe');
      } else {
        status.textContent = 'あなたのターン (X)';
      }
    });
  });
  
  resetBtn.addEventListener('click', () => {
    board = Array(9).fill(null);
    cells.forEach(cell => {
      cell.textContent = '';
      cell.classList.remove('disabled');
    });
    status.textContent = 'あなたのターン (X)';
    gameActive = true;
  });
}

// Connect4 AI対戦
function initConnect4() {
  let board = Array(42).fill(null);
  let gameActive = true;
  
  const columns = document.querySelectorAll('.column');
  const status = document.querySelector('.game-status');
  const resetBtn = document.querySelector('.btn-reset');
  
  columns.forEach(column => {
    column.addEventListener('click', async () => {
      if (!gameActive) return;
      
      const col = parseInt(column.dataset.column);
      const row = findEmptyRow(board, col);
      
      if (row === -1) return;
      
      board[row * 7 + col] = 0;
      const cell = column.querySelector(`[data-row="${row}"]`);
      cell.classList.add('player0');
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      if (checkConnect4Winner(board, row, col, 0)) {
        status.textContent = 'あなたの勝ち! 🎉';
        gameActive = false;
        await saveGameResult('win', 'connect4');
        return;
      }
      
      if (board.every(c => c !== null)) {
        status.textContent = '引き分け!';
        gameActive = false;
        await saveGameResult('draw', 'connect4');
        return;
      }
      
      status.textContent = 'AIが考え中...';
      columns.forEach(c => c.style.pointerEvents = 'none');
      
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const aiCol = getRandomEmptyColumn(board);
      const aiRow = findEmptyRow(board, aiCol);
      
      if (aiRow !== -1) {
        board[aiRow * 7 + aiCol] = 1;
        const aiCell = columns[aiCol].// app.jsの続き - Connect4以降のゲームロジック

querySelector(`[data-row="${aiRow}"]`);
        aiCell.classList.add('player1');
        
        await new Promise(resolve => setTimeout(resolve, 300));
        
        columns.forEach(c => c.style.pointerEvents = 'auto');
        
        if (checkConnect4Winner(board, aiRow, aiCol, 1)) {
          status.textContent = 'AIの勝ち!';
          gameActive = false;
          await saveGameResult('loss', 'connect4');
        } else if (board.every(c => c !== null)) {
          status.textContent = '引き分け!';
          gameActive = false;
          await saveGameResult('draw', 'connect4');
        } else {
          status.textContent = 'あなたのターン 🔴';
        }
      }
    });
  });
  
  resetBtn.addEventListener('click', () => {
    board = Array(42).fill(null);
    document.querySelectorAll('.cell').forEach(cell => {
      cell.classList.remove('player0', 'player1');
    });
    status.textContent = 'あなたのターン 🔴';
    gameActive = true;
    columns.forEach(c => c.style.pointerEvents = 'auto');
  });
}

function findEmptyRow(board, col) {
  for (let row = 5; row >= 0; row--) {
    if (board[row * 7 + col] === null) {
      return row;
    }
  }
  return -1;
}

function getRandomEmptyColumn(board) {
  const emptyCols = [];
  for (let col = 0; col < 7; col++) {
    if (board[col] === null) {
      emptyCols.push(col);
    }
  }
  return emptyCols[Math.floor(Math.random() * emptyCols.length)];
}

function checkConnect4Winner(board, row, col, player) {
  const directions = [[0,1], [1,0], [1,1], [1,-1]];
  
  for (const [dr, dc] of directions) {
    let count = 1;
    
    for (let i = 1; i < 4; i++) {
      const r = row + dr * i;
      const c = col + dc * i;
      if (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r * 7 + c] === player) {
        count++;
      } else break;
    }
    
    for (let i = 1; i < 4; i++) {
      const r = row - dr * i;
      const c = col - dc * i;
      if (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r * 7 + c] === player) {
        count++;
      } else break;
    }
    
    if (count >= 4) return true;
  }
  return false;
}

// リバーシAI対戦
function initReversi() {
  let board = Array(64).fill(null);
  board[27] = 0; board[28] = 1;
  board[35] = 1; board[36] = 0;
  
  let gameActive = true;
  const cells = document.querySelectorAll('.cell-reversi');
  const status = document.querySelector('.game-status');
  
  updateReversiBoard();
  
  cells.forEach(cell => {
    cell.addEventListener('click', async () => {
      if (!gameActive) return;
      
      const index = parseInt(cell.dataset.index);
      const flips = getValidFlips(board, index, 0);
      
      if (flips.length === 0) return;
      
      board[index] = 0;
      flips.forEach(pos => board[pos] = 0);
      
      updateReversiBoard();
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (isGameOver()) {
        endReversiGame();
        return;
      }
      
      status.textContent = 'AIが考え中...';
      cells.forEach(c => c.style.pointerEvents = 'none');
      
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const aiMove = getBestReversiMove(board, 1);
      if (aiMove !== -1) {
        const aiFlips = getValidFlips(board, aiMove, 1);
        board[aiMove] = 1;
        aiFlips.forEach(pos => board[pos] = 1);
      }
      
      updateReversiBoard();
      await new Promise(resolve => setTimeout(resolve, 300));
      
      cells.forEach(c => c.style.pointerEvents = 'auto');
      
      if (isGameOver()) {
        endReversiGame();
      } else {
        status.textContent = 'あなたのターン ⚫';
      }
    });
  });
  
  function updateReversiBoard() {
    cells.forEach((cell, i) => {
      cell.className = 'cell-reversi';
      if (board[i] === 0) cell.classList.add('player0');
      else if (board[i] === 1) cell.classList.add('player1');
    });
    
    const blackCount = board.filter(c => c === 0).length;
    const whiteCount = board.filter(c => c === 1).length;
    document.getElementById('blackScore').textContent = blackCount;
    document.getElementById('whiteScore').textContent = whiteCount;
  }
  
  function isGameOver() {
    return board.every(c => c !== null) || 
           (!hasValidMove(board, 0) && !hasValidMove(board, 1));
  }
  
  async function endReversiGame() {
    const blackCount = board.filter(c => c === 0).length;
    const whiteCount = board.filter(c => c === 1).length;
    
    gameActive = false;
    
    if (blackCount > whiteCount) {
      status.textContent = 'あなたの勝ち! 🎉';
      await saveGameResult('win', 'reversi');
    } else if (whiteCount > blackCount) {
      status.textContent = 'AIの勝ち!';
      await saveGameResult('loss', 'reversi');
    } else {
      status.textContent = '引き分け!';
      await saveGameResult('draw', 'reversi');
    }
  }
  
  function getBestReversiMove(board, player) {
    let bestMove = -1;
    let maxFlips = 0;
    
    for (let i = 0; i < 64; i++) {
      const flips = getValidFlips(board, i, player);
      if (flips.length > maxFlips) {
        maxFlips = flips.length;
        bestMove = i;
      }
    }
    
    return bestMove;
  }
}

function getValidFlips(board, position, player) {
  if (board[position] !== null) return [];
  
  const row = Math.floor(position / 8);
  const col = position % 8;
  const directions = [
    [-1,-1], [-1,0], [-1,1],
    [0,-1],          [0,1],
    [1,-1],  [1,0],  [1,1]
  ];
  
  const allFlips = [];
  
  for (const [dr, dc] of directions) {
    const flips = [];
    let r = row + dr;
    let c = col + dc;
    
    while (r >= 0 && r < 8 && c >= 0 && c < 8) {
      const pos = r * 8 + c;
      if (board[pos] === null) break;
      if (board[pos] === player) {
        if (flips.length > 0) {
          allFlips.push(...flips);
        }
        break;
      }
      flips.push(pos);
      r += dr;
      c += dc;
    }
  }
  
  return allFlips;
}

function hasValidMove(board, player) {
  for (let i = 0; i < 64; i++) {
    if (getValidFlips(board, i, player).length > 0) {
      return true;
    }
  }
  return false;
}

function getAIMove(board) {
  const empty = [];
  board.forEach((cell, i) => {
    if (!cell) empty.push(i);
  });
  return empty[Math.floor(Math.random() * empty.length)];
}

function checkWinner(board) {
  const lines = [
    [0,1,2], [3,4,5], [6,7,8],
    [0,3,6], [1,4,7], [2,5,8],
    [0,4,8], [2,4,6]
  ];
  
  for (const [a,b,c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
}

// スロットゲーム
function initSlots() {
  let balance = 1000;
  const symbols = ['🍒', '🍋', '🍊', '🍉', '⭐', '💎', '7️⃣'];
  
  const spinBtn = document.querySelector('.btn-spin');
  const balanceEl = document.getElementById('balance');
  const reels = [
    document.getElementById('reel1'),
    document.getElementById('reel2'),
    document.getElementById('reel3')
  ];
  
  spinBtn.addEventListener('click', async () => {
    if (balance < 10) {
      alert('残高不足です!');
      return;
    }
    
    balance -= 10;
    balanceEl.textContent = balance;
    spinBtn.disabled = true;
    
    const results = [];
    
    for (let i = 0; i < reels.length; i++) {
      reels[i].classList.add('spinning');
      
      await new Promise(resolve => setTimeout(resolve, i * 200));
      
      const symbol = symbols[Math.floor(Math.random() * symbols.length)];
      results.push(symbol);
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      reels[i].textContent = symbol;
      reels[i].classList.remove('spinning');
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    if (results[0] === results[1] && results[1] === results[2]) {
      const win = 100;
      balance += win;
      balanceEl.textContent = balance;
      alert(`🎉 大当たり! ${win}コイン獲得!`);
      await saveGameResult('win', 'slots');
    } else {
      await saveGameResult('loss', 'slots');
    }
    
    spinBtn.disabled = false;
  });
}

// ルーレットゲーム
function initRoulette() {
  const wheel = document.getElementById('wheel');
  const resultEl = document.getElementById('rouletteResult');
  const betBtns = document.querySelectorAll('.bet-btn');
  
  betBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const bet = btn.dataset.bet;
      
      betBtns.forEach(b => b.disabled = true);
      
      const rotation = Math.floor(Math.random() * 360) + 720;
      wheel.style.transform = `rotate(${rotation}deg)`;
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const number = Math.floor(Math.random() * 37);
      const isRed = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(number);
      const isEven = number % 2 === 0 && number !== 0;
      
      resultEl.textContent = number;
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      let win = false;
      if (bet === 'red' && isRed) win = true;
      if (bet === 'black' && !isRed && number !== 0) win = true;
      if (bet === 'even' && isEven) win = true;
      if (bet === 'odd' && !isEven && number !== 0) win = true;
      
      if (win) {
        alert('🎉 当たり!');
        await saveGameResult('win', 'roulette');
      } else {
        alert('外れ...');
        await saveGameResult('loss', 'roulette');
      }
      
      wheel.style.transform = 'rotate(0deg)';
      betBtns.forEach(b => b.disabled = false);
    });
  });
}

// オンラインゲーム関連
function renderOnlineGame(gameState) {
  const container = document.getElementById('gameContainer');
  const game = games[state.currentGame];
  
  const playerNames = ['プレイヤー1', 'プレイヤー2'];
  
  container.innerHTML = `
    <div class="player-info">
      <div class="player-badge">
        <div class="player-avatar">👤</div>
        <div class="player-name">${playerNames[0]}</div>
      </div>
      <div class="turn-indicator" id="turnIndicator">待機中...</div>
      <div class="player-badge">
        <div class="player-avatar">🤖</div>
        <div class="player-name">${playerNames[1]}</div>
      </div>
    </div>
    <div id="onlineGameBoard"></div>
  `;
  
  const board = document.getElementById('onlineGameBoard');
  
  if (state.currentGame === 'tic-tac-toe') {
    board.innerHTML = `
      <div class="board-grid">
        ${Array(9).fill(0).map((_, i) => `<div class="cell" data-index="${i}"></div>`).join('')}
      </div>
    `;
    renderTicTacToeOnline(gameState);
  } else if (state.currentGame === 'connect4') {
    board.innerHTML = `
      <div class="board-columns">
        ${Array(7).fill(0).map((_, i) => `
          <div class="column" data-column="${i}">
            ${Array(6).fill(0).map((_, j) => `<div class="cell" data-row="${j}" data-col="${i}"></div>`).join('')}
          </div>
        `).join('')}
      </div>
    `;
    renderConnect4Online(gameState);
  } else if (state.currentGame === 'reversi') {
    board.innerHTML = `
      <div class="board-grid-8x8">
        ${Array(64).fill(0).map((_, i) => `<div class="cell-reversi" data-index="${i}"></div>`).join('')}
      </div>
      <div class="score-board">
        <div class="score">⚫: <span id="blackScore">2</span></div>
        <div class="score">⚪: <span id="whiteScore">2</span></div>
      </div>
    `;
    renderReversiOnline(gameState);
  }
}

function renderTicTacToeOnline(gameState) {
  const cells = document.querySelectorAll('.cell');
  
  cells.forEach((cell, i) => {
    if (gameState.board[i] === 0) cell.textContent = 'X';
    else if (gameState.board[i] === 1) cell.textContent = 'O';
    
    cell.addEventListener('click', () => {
      if (gameState.board[i] !== null) return;
      
      state.socket.emit('game-action', {
        roomId: state.onlineRoom,
        action: { position: i }
      });
    });
  });
}

function renderConnect4Online(gameState) {
  const columns = document.querySelectorAll('.column');
  const cells = document.querySelectorAll('.cell');
  
  cells.forEach((cell, i) => {
    if (gameState.board[i] === 0) cell.classList.add('player0');
    else if (gameState.board[i] === 1) cell.classList.add('player1');
  });
  
  columns.forEach(column => {
    column.addEventListener('click', () => {
      const col = parseInt(column.dataset.column);
      
      state.socket.emit('game-action', {
        roomId: state.onlineRoom,
        action: { column: col }
      });
    });
  });
}

function renderReversiOnline(gameState) {
  const cells = document.querySelectorAll('.cell-reversi');
  
  cells.forEach((cell, i) => {
    cell.className = 'cell-reversi';
    if (gameState.board[i] === 0) cell.classList.add('player0');
    else if (gameState.board[i] === 1) cell.classList.add('player1');
    
    cell.addEventListener('click', () => {
      state.socket.emit('game-action', {
        roomId: state.onlineRoom,
        action: { position: i }
      });
    });
  });
  
  const blackCount = gameState.board.filter(c => c === 0).length;
  const whiteCount = gameState.board.filter(c => c === 1).length;
  document.getElementById('blackScore').textContent = blackCount;
  document.getElementById('whiteScore').textContent = whiteCount;
}

function updateOnlineGameState(data) {
  const { gameState, currentTurn } = data;
  
  const indicator = document.getElementById('turnIndicator');
  if (currentTurn === state.playerIndex) {
    indicator.textContent = 'あなたのターン';
    indicator.classList.remove('waiting');
  } else {
    indicator.textContent = '相手のターン';
    indicator.classList.add('waiting');
  }
  
  if (state.currentGame === 'tic-tac-toe') {
    const cells = document.querySelectorAll('.cell');
    cells.forEach((cell, i) => {
      cell.textContent = '';
      if (gameState.board[i] === 0) cell.textContent = 'X';
      else if (gameState.board[i] === 1) cell.textContent = 'O';
    });
  } else if (state.currentGame === 'connect4') {
    const cells = document.querySelectorAll('.cell');
    cells.forEach((cell, i) => {
      cell.classList.remove('player0', 'player1');
      if (gameState.board[i] === 0) cell.classList.add('player0');
      else if (gameState.board[i] === 1) cell.classList.add('player1');
    });
  } else if (state.currentGame === 'reversi') {
    const cells = document.querySelectorAll('.cell-reversi');
    cells.forEach((cell, i) => {
      cell.className = 'cell-reversi';
      if (gameState.board[i] === 0) cell.classList.add('player0');
      else if (gameState.board[i] === 1) cell.classList.add('player1');
    });
    
    const blackCount = gameState.board.filter(c => c === 0).length;
    const whiteCount = gameState.board.filter(c => c === 1).length;
    document.getElementById('blackScore').textContent = blackCount;
    document.getElementById('whiteScore').textContent = whiteCount;
  }
}

function handleGameOver(data) {
  const { winner, reason } = data;
  
  let message = '';
  if (winner === state.playerIndex) {
    message = '🎉 勝利!';
  } else if (winner === -1) {
    message = '引き分け!';
  } else {
    message = '敗北...';
  }
  
  setTimeout(() => {
    alert(message);
    navigateTo('hub');
  }, 1000);
}

function showGameError(message) {
  alert(message);
}

// 統計読み込み
async function loadUserStats() {
  try {
    const res = await fetch('/api/stats', {
      headers: {
        'Authorization': `Bearer ${state.token}`
      }
    });
    
    if (res.ok) {
      const stats = await res.json();
      state.stats = stats;
      updateStatsDisplay();
    }
  } catch (err) {
    console.error('統計の読み込みエラー:', err);
  }
}

function updateStatsDisplay() {
  const { wins, losses, draws, gamesPlayed } = state.stats;
  
  document.getElementById('quickWins').textContent = wins;
  document.getElementById('quickLosses').textContent = losses;
  document.getElementById('totalGames').textContent = gamesPlayed;
  document.getElementById('totalWins').textContent = wins;
  document.getElementById('totalLosses').textContent = losses;
  document.getElementById('totalDraws').textContent = draws;
  
  const winRate = gamesPlayed > 0 ? ((wins / gamesPlayed) * 100).toFixed(1) : 0;
  document.getElementById('winRate').textContent = `${winRate}%`;
}

async function loadGameHistory() {
  state.gameHistory = JSON.parse(localStorage.getItem('gameHistory') || '[]');
  
  const historyList = document.getElementById('gameHistoryList');
  
  if (state.gameHistory.length === 0) {
    historyList.innerHTML = '<p class="no-data">まだゲームをプレイしていません</p>';
    return;
  }
  
  historyList.innerHTML = state.gameHistory.slice(-10).reverse().map(game => `
    <div class="history-item">
      <div class="history-game">${games[game.type]?.icon || '🎮'} ${games[game.type]?.name || game.type}</div>
      <div class="history-result ${game.result}">${game.result === 'win' ? '勝利' : game.result === 'loss' ? '敗北' : '引き分け'}</div>
    </div>
  `).join('');
}

// ゲーム結果保存
async function saveGameResult(result, gameType) {
  try {
    const res = await fetch('/api/game-result', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${state.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ result, gameType })
    });
    
    if (res.ok) {
      const data = await res.json();
      state.stats = data.stats;
      updateStatsDisplay();
      
      state.gameHistory.push({
        type: gameType,
        result,
        timestamp: Date.now()
      });
      localStorage.setItem('gameHistory', JSON.stringify(state.gameHistory));
    }
  } catch (err) {
    console.error('結果保存エラー:', err);
  }
}