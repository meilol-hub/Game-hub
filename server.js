const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = 8000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

app.use(express.json());
app.use(express.static('public'));

// favicon.icoのエラーを防ぐ
app.get('/favicon.ico', (req, res) => res.status(204).end());

// データファイルのパス
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const GAMES_FILE = path.join(DATA_DIR, 'games.json');
const STATS_FILE = path.join(DATA_DIR, 'stats.json');

// データディレクトリの初期化
async function initDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    
    // ファイルが存在しない場合は初期化
    const files = [
      { path: USERS_FILE, data: {} },
      { path: GAMES_FILE, data: {} },
      { path: STATS_FILE, data: {} }
    ];
    
    for (const file of files) {
      try {
        await fs.access(file.path);
      } catch {
        await fs.writeFile(file.path, JSON.stringify(file.data, null, 2));
      }
    }
  } catch (err) {
    console.error('データディレクトリの初期化エラー:', err);
  }
}

// JSONファイルの読み書き
async function readJSON(filepath) {
  try {
    const data = await fs.readFile(filepath, 'utf8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function writeJSON(filepath, data) {
  await fs.writeFile(filepath, JSON.stringify(data, null, 2));
}

// メール送信設定
// .envファイルに以下の環境変数を設定してください:
// EMAIL_SERVICE=gmail (または smtp)
// EMAIL_USER=your-email@gmail.com
// EMAIL_PASS=your-app-password
// SMTP_HOST=smtp.gmail.com (smtpの場合)
// SMTP_PORT=587 (smtpの場合)

let transporter;

// メールサービスの設定
if (process.env.EMAIL_SERVICE === 'gmail') {
  // Gmailを使用
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
} else if (process.env.EMAIL_SERVICE === 'smtp') {
  // 独自SMTPサーバーを使用
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
} else {
  // 開発環境用 - Ethereal Email（テスト用メールサービス）
  console.log('⚠️  メール設定がありません。Etherealテストアカウントを作成中...');
  nodemailer.createTestAccount((err, account) => {
    if (err) {
      console.error('テストアカウント作成失敗:', err);
      return;
    }
    
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: account.user,
        pass: account.pass
      }
    });
    
    console.log('✅ Etherealテストアカウント作成成功');
    console.log('📧 テストメールURL: https://ethereal.email/messages');
    console.log(`ユーザー: ${account.user}`);
    console.log(`パスワード: ${account.pass}`);
  });
}

// メール送信関数
async function sendVerificationEmail(email, code, username) {
  const mailOptions = {
    from: process.env.EMAIL_USER || '"GameHub" <noreply@gamehub.com>',
    to: email,
    subject: '🎮 GameHub - メール認証コード',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: 'Segoe UI', Arial, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
                <!-- ヘッダー -->
                <tr>
                  <td style="padding: 40px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 32px;">🎮 GameHub</h1>
                  </td>
                </tr>
                
                <!-- メインコンテンツ -->
                <tr>
                  <td style="background-color: white; padding: 40px;">
                    <h2 style="color: #1e293b; margin: 0 0 20px 0; font-size: 24px;">
                      ようこそ、${username}さん！
                    </h2>
                    
                    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                      GameHubへのご登録ありがとうございます。<br>
                      以下の認証コードを入力して、登録を完了してください。
                    </p>
                    
                    <!-- 認証コード -->
                    <div style="background: linear-gradient(135deg, #667eea, #764ba2); padding: 30px; border-radius: 15px; text-align: center; margin: 30px 0;">
                      <p style="color: rgba(255,255,255,0.9); margin: 0 0 10px 0; font-size: 14px; letter-spacing: 1px;">認証コード</p>
                      <h1 style="color: white; margin: 0; font-size: 48px; letter-spacing: 8px; font-weight: 700;">
                        ${code}
                      </h1>
                    </div>
                    
                    <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 8px; margin: 30px 0;">
                      <p style="color: #92400e; margin: 0; font-size: 14px;">
                        ⏱️ このコードは<strong>10分間</strong>有効です。
                      </p>
                    </div>
                    
                    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 30px 0 0 0;">
                      30種類以上のゲームで、AIと対戦をお楽しみください！
                    </p>
                    
                    <ul style="color: #475569; font-size: 14px; line-height: 1.8; margin: 20px 0;">
                      <li>♟️ ボードゲーム（チェス、将棋、囲碁など）</li>
                      <li>🃏 カードゲーム（ポーカー、ブラックジャックなど）</li>
                      <li>🎰 カジノゲーム（ルーレット、スロットなど）</li>
                      <li>🎲 サイコロゲーム</li>
                      <li>🎯 パズルゲーム</li>
                    </ul>
                  </td>
                </tr>
                
                <!-- フッター -->
                <tr>
                  <td style="background-color: #1e293b; padding: 30px; text-align: center;">
                    <p style="color: #94a3b8; font-size: 12px; margin: 0 0 10px 0;">
                      このメールに心当たりがない場合は、無視していただいて構いません。
                    </p>
                    <p style="color: #64748b; font-size: 12px; margin: 0;">
                      © ${new Date().getFullYear()} GameHub. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `
GameHub へようこそ、${username}さん！

アカウント登録ありがとうございます。
以下の認証コードを入力して、登録を完了してください：

認証コード: ${code}

このコードは10分間有効です。

このメールに心当たりがない場合は、無視してください。
    `
  };
  
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('\n✅ メール送信成功!');
    console.log(`📧 送信先: ${email}`);
    console.log(`📨 Message ID: ${info.messageId}`);
    
    // Etherealの場合、プレビューURLを表示
    if (nodemailer.getTestMessageUrl(info)) {
      console.log(`🔗 プレビューURL: ${nodemailer.getTestMessageUrl(info)}`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ メール送信エラー:', error);
    throw error;
  }
}

// 認証ミドルウェア
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'トークンが必要です' });
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: '無効なトークンです' });
    req.user = user;
    next();
  });
}

// ユーザー登録
app.post('/api/register', async (req, res) => {
  try {
    const { email, password, username } = req.body;
    
    const users = await readJSON(USERS_FILE);
    
    if (users[email]) {
      return res.status(400).json({ error: 'このメールは既に登録されています' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    users[email] = {
      email,
      username,
      password: hashedPassword,
      verificationCode,
      verified: false,
      codeExpiry: Date.now() + 10 * 60 * 1000, // 10分後に期限切れ
      createdAt: new Date().toISOString(),
      stats: { wins: 0, losses: 0, draws: 0, gamesPlayed: 0 }
    };
    
    await writeJSON(USERS_FILE, users);
    
    // メール送信
    try {
      await sendVerificationEmail(email, verificationCode, username);
      res.json({ 
        message: 'メールを送信しました。受信箱を確認してください。', 
        email
      });
    } catch (emailError) {
      // メール送信に失敗してもユーザーは作成済みなので、コンソールにコードを表示
      console.error('メール送信失敗、コンソールに表示:', verificationCode);
      res.json({ 
        message: 'メール送信に失敗しました。認証コード: ' + verificationCode, 
        email,
        devCode: verificationCode // フォールバック用
      });
    }
  } catch (err) {
    console.error('登録エラー:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

// メール認証
app.post('/api/verify', async (req, res) => {
  try {
    const { email, code } = req.body;
    
    const users = await readJSON(USERS_FILE);
    const user = users[email];
    
    if (!user) {
      return res.status(404).json({ error: 'ユーザーが見つかりません' });
    }
    
    if (user.verified) {
      return res.status(400).json({ error: '既に認証済みです' });
    }
    
    // コードの期限チェック
    if (user.codeExpiry && Date.now() > user.codeExpiry) {
      return res.status(400).json({ error: '認証コードの有効期限が切れています' });
    }
    
    if (user.verificationCode === code.toUpperCase()) {
      users[email].verified = true;
      delete users[email].verificationCode;
      delete users[email].codeExpiry;
      await writeJSON(USERS_FILE, users);
      
      const token = jwt.sign({ email, username: user.username }, JWT_SECRET);
      
      res.json({ message: '認証成功', token, username: user.username });
    } else {
      res.status(400).json({ error: '認証コードが間違っています' });
    }
  } catch (err) {
    console.error('認証エラー:', err);
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

// ログイン
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const users = await readJSON(USERS_FILE);
    const user = users[email];
    
    if (!user) {
      return res.status(401).json({ error: 'メールまたはパスワードが間違っています' });
    }
    
    if (!user.verified) {
      return res.status(403).json({ error: 'メール認証が完了していません' });
    }
    
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'メールまたはパスワードが間違っています' });
    }
    
    const token = jwt.sign({ email, username: user.username }, JWT_SECRET);
    
    res.json({ token, username: user.username });
  } catch (err) {
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

// ユーザー統計取得
app.get('/api/stats', authenticateToken, async (req, res) => {
  try {
    const users = await readJSON(USERS_FILE);
    const user = users[req.user.email];
    
    if (!user) {
      return res.status(404).json({ error: 'ユーザーが見つかりません' });
    }
    
    res.json(user.stats);
  } catch (err) {
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

// ゲーム結果保存
app.post('/api/game-result', authenticateToken, async (req, res) => {
  try {
    const { result, gameType } = req.body; // result: 'win', 'loss', 'draw'
    
    const users = await readJSON(USERS_FILE);
    const user = users[req.user.email];
    
    if (!user) {
      return res.status(404).json({ error: 'ユーザーが見つかりません' });
    }
    
    user.stats.gamesPlayed++;
    if (result === 'win') user.stats.wins++;
    else if (result === 'loss') user.stats.losses++;
    else if (result === 'draw') user.stats.draws++;
    
    await writeJSON(USERS_FILE, users);
    
    // ゲーム履歴保存
    const games = await readJSON(GAMES_FILE);
    if (!games[req.user.email]) games[req.user.email] = [];
    
    games[req.user.email].push({
      gameType,
      result,
      timestamp: new Date().toISOString()
    });
    
    await writeJSON(GAMES_FILE, games);
    
    res.json({ message: '結果を保存しました', stats: user.stats });
  } catch (err) {
    res.status(500).json({ error: 'サーバーエラー' });
  }
});

// AI対戦エンドポイント（各ゲーム用）
app.post('/api/ai-move/:game', authenticateToken, async (req, res) => {
  const { game } = req.params;
  const { gameState } = req.body;
  
  // ゲームごとのAIロジック（簡易版）
  let aiMove;
  
  switch(game) {
    case 'tic-tac-toe':
      aiMove = getRandomEmptyCell(gameState.board);
      break;
    case 'chess':
      aiMove = { from: 'e2', to: 'e4' }; // 簡易的な例
      break;
    default:
      aiMove = { type: 'random' };
  }
  
  res.json({ move: aiMove });
});

function getRandomEmptyCell(board) {
  const empty = [];
  for (let i = 0; i < board.length; i++) {
    if (!board[i]) empty.push(i);
  }
  return empty[Math.floor(Math.random() * empty.length)];
}

// サーバー起動
initDataDir().then(() => {
  server.listen(PORT, () => {
    console.log(`サーバーが起動しました: http://localhost:${PORT}`);
  });
});

// オンライン対戦用のゲームルーム管理
const gameRooms = new Map();
const waitingPlayers = new Map();

// Socket.IO接続
io.on('connection', (socket) => {
  console.log('プレイヤー接続:', socket.id);
  
  // マッチング要求
  socket.on('find-match', (data) => {
    const { gameType, username, token } = data;
    
    // 既に待機中のプレイヤーを探す
    const waitingKey = `${gameType}`;
    if (waitingPlayers.has(waitingKey)) {
      const opponent = waitingPlayers.get(waitingKey);
      waitingPlayers.delete(waitingKey);
      
      // ゲームルーム作成
      const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const room = {
        id: roomId,
        gameType,
        players: [
          { id: opponent.id, username: opponent.username, ready: true },
          { id: socket.id, username, ready: true }
        ],
        gameState: initializeGameState(gameType),
        currentTurn: 0,
        createdAt: Date.now()
      };
      
      gameRooms.set(roomId, room);
      
      // 両プレイヤーをルームに参加
      opponent.socket.join(roomId);
      socket.join(roomId);
      
      // マッチング成功を通知
      opponent.socket.emit('match-found', {
        roomId,
        opponent: username,
        playerIndex: 0,
        gameState: room.gameState
      });
      
      socket.emit('match-found', {
        roomId,
        opponent: opponent.username,
        playerIndex: 1,
        gameState: room.gameState
      });
      
      console.log(`マッチング成功: ${opponent.username} vs ${username} (${gameType})`);
    } else {
      // 待機リストに追加
      waitingPlayers.set(waitingKey, { id: socket.id, username, socket, gameType });
      socket.emit('waiting-for-match');
      console.log(`${username} が ${gameType} のマッチング待機中`);
    }
  });
  
  // ゲームアクション
  socket.on('game-action', (data) => {
    const { roomId, action } = data;
    const room = gameRooms.get(roomId);
    
    if (!room) return;
    
    // アクションを処理（遅延を追加して貫通防止）
    setTimeout(() => {
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      
      // ターンチェック
      if (playerIndex !== room.currentTurn) {
        socket.emit('error', { message: 'あなたのターンではありません' });
        return;
      }
      
      // ゲーム状態を更新
      const result = processGameAction(room.gameType, room.gameState, action, playerIndex);
      
      if (result.valid) {
        room.gameState = result.newState;
        room.currentTurn = (room.currentTurn + 1) % room.players.length;
        
        // 全プレイヤーに更新を通知
        io.to(roomId).emit('game-update', {
          gameState: room.gameState,
          currentTurn: room.currentTurn,
          lastAction: action
        });
        
        // ゲーム終了チェック
        if (result.gameOver) {
          io.to(roomId).emit('game-over', {
            winner: result.winner,
            reason: result.reason
          });
          
          // 結果を保存
          room.players.forEach((player, idx) => {
            const isWinner = result.winner === idx;
            saveOnlineGameResult(player.username, isWinner ? 'win' : 'loss', room.gameType);
          });
          
          // ルームを削除
          setTimeout(() => gameRooms.delete(roomId), 5000);
        }
      } else {
        socket.emit('error', { message: result.error || '無効な操作です' });
      }
    }, 100); // 100ms遅延で貫通防止
  });
  
  // プレイヤーの切断
  socket.on('disconnect', () => {
    console.log('プレイヤー切断:', socket.id);
    
    // 待機リストから削除
    for (const [key, player] of waitingPlayers.entries()) {
      if (player.id === socket.id) {
        waitingPlayers.delete(key);
        break;
      }
    }
    
    // ゲームルームから削除
    for (const [roomId, room] of gameRooms.entries()) {
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        // 相手に通知
        io.to(roomId).emit('opponent-disconnected');
        gameRooms.delete(roomId);
        break;
      }
    }
  });
});

// ゲーム状態の初期化
function initializeGameState(gameType) {
  switch(gameType) {
    case 'tic-tac-toe':
      return { board: Array(9).fill(null), moves: 0 };
    case 'connect4':
      return { board: Array(42).fill(null), moves: 0 };
    case 'reversi':
      const board = Array(64).fill(null);
      board[27] = 0; board[28] = 1;
      board[35] = 1; board[36] = 0;
      return { board, moves: 0 };
    case 'poker':
      return { 
        deck: shuffleDeck(),
        playerHands: [[], []],
        communityCards: [],
        pot: 0,
        bets: [0, 0],
        phase: 'preflop'
      };
    case 'blackjack':
      const deck = shuffleDeck();
      return {
        deck,
        playerHands: [[deck.pop(), deck.pop()], [deck.pop(), deck.pop()]],
        dealerHand: [deck.pop()],
        phase: 'betting'
      };
    default:
      return { board: [], moves: 0 };
  }
}

// ゲームアクションの処理
function processGameAction(gameType, state, action, playerIndex) {
  switch(gameType) {
    case 'tic-tac-toe':
      return processTicTacToe(state, action, playerIndex);
    case 'connect4':
      return processConnect4(state, action, playerIndex);
    case 'reversi':
      return processReversi(state, action, playerIndex);
    case 'poker':
      return processPoker(state, action, playerIndex);
    case 'blackjack':
      return processBlackjack(state, action, playerIndex);
    default:
      return { valid: false, error: 'ゲームタイプが不明です' };
  }
}

// 三目並べロジック
function processTicTacToe(state, action, playerIndex) {
  const { position } = action;
  
  if (state.board[position] !== null) {
    return { valid: false, error: '既に置かれています' };
  }
  
  const newBoard = [...state.board];
  newBoard[position] = playerIndex;
  
  const winner = checkTicTacToeWinner(newBoard);
  const gameOver = winner !== null || newBoard.every(cell => cell !== null);
  
  return {
    valid: true,
    newState: { board: newBoard, moves: state.moves + 1 },
    gameOver,
    winner: winner !== null ? winner : (gameOver ? -1 : null),
    reason: winner !== null ? 'win' : (gameOver ? 'draw' : null)
  };
}

function checkTicTacToeWinner(board) {
  const lines = [
    [0,1,2], [3,4,5], [6,7,8],
    [0,3,6], [1,4,7], [2,5,8],
    [0,4,8], [2,4,6]
  ];
  
  for (const [a,b,c] of lines) {
    if (board[a] !== null && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
}

// 四目並べロジック
function processConnect4(state, action, playerIndex) {
  const { column } = action;
  
  if (column < 0 || column > 6) {
    return { valid: false, error: '無効な列です' };
  }
  
  const newBoard = [...state.board];
  
  // 列の一番下から空いている場所を探す
  let row = -1;
  for (let r = 5; r >= 0; r--) {
    if (newBoard[r * 7 + column] === null) {
      row = r;
      break;
    }
  }
  
  if (row === -1) {
    return { valid: false, error: '列が満杯です' };
  }
  
  newBoard[row * 7 + column] = playerIndex;
  
  const winner = checkConnect4Winner(newBoard, row, column, playerIndex);
  const gameOver = winner !== null || newBoard.every(cell => cell !== null);
  
  return {
    valid: true,
    newState: { board: newBoard, moves: state.moves + 1 },
    gameOver,
    winner: winner ? playerIndex : (gameOver ? -1 : null),
    reason: winner ? 'win' : (gameOver ? 'draw' : null)
  };
}

function checkConnect4Winner(board, row, col, player) {
  const directions = [
    [0, 1], [1, 0], [1, 1], [1, -1]
  ];
  
  for (const [dr, dc] of directions) {
    let count = 1;
    
    for (let i = 1; i < 4; i++) {
      const r = row + dr * i;
      const c = col + dc * i;
      if (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r * 7 + c] === player) {
        count++;
      } else {
        break;
      }
    }
    
    for (let i = 1; i < 4; i++) {
      const r = row - dr * i;
      const c = col - dc * i;
      if (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r * 7 + c] === player) {
        count++;
      } else {
        break;
      }
    }
    
    if (count >= 4) return true;
  }
  
  return false;
}

// リバーシロジック
function processReversi(state, action, playerIndex) {
  const { position } = action;
  const newBoard = [...state.board];
  
  const flips = getValidFlips(newBoard, position, playerIndex);
  
  if (flips.length === 0) {
    return { valid: false, error: '無効な手です' };
  }
  
  newBoard[position] = playerIndex;
  flips.forEach(pos => newBoard[pos] = playerIndex);
  
  const gameOver = newBoard.every(cell => cell !== null) || 
                   !hasValidMove(newBoard, 1 - playerIndex);
  
  let winner = null;
  if (gameOver) {
    const count0 = newBoard.filter(c => c === 0).length;
    const count1 = newBoard.filter(c => c === 1).length;
    winner = count0 > count1 ? 0 : (count1 > count0 ? 1 : -1);
  }
  
  return {
    valid: true,
    newState: { board: newBoard, moves: state.moves + 1 },
    gameOver,
    winner,
    reason: winner !== null && winner !== -1 ? 'win' : 'draw'
  };
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

// ポーカーロジック
function shuffleDeck() {
  const suits = ['♠', '♥', '♦', '♣'];
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const deck = [];
  
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ suit, rank, value: ranks.indexOf(rank) + 2 });
    }
  }
  
  // シャッフル
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  
  return deck;
}

function processPoker(state, action, playerIndex) {
  // 簡易ポーカーロジック
  const { type, amount } = action;
  
  const newState = { ...state };
  
  if (type === 'bet') {
    newState.bets[playerIndex] += amount;
    newState.pot += amount;
  } else if (type === 'fold') {
    return {
      valid: true,
      newState: state,
      gameOver: true,
      winner: 1 - playerIndex,
      reason: 'fold'
    };
  } else if (type === 'call') {
    const toCall = Math.max(...newState.bets) - newState.bets[playerIndex];
    newState.bets[playerIndex] += toCall;
    newState.pot += toCall;
  }
  
  return { valid: true, newState, gameOver: false };
}

function processBlackjack(state, action, playerIndex) {
  const { type } = action;
  const newState = { ...state };
  
  if (type === 'hit') {
    newState.playerHands[playerIndex].push(newState.deck.pop());
    
    const handValue = calculateBlackjackValue(newState.playerHands[playerIndex]);
    if (handValue > 21) {
      return {
        valid: true,
        newState,
        gameOver: true,
        winner: 1 - playerIndex,
        reason: 'bust'
      };
    }
  } else if (type === 'stand') {
    // ディーラーのターン
    while (calculateBlackjackValue(newState.dealerHand) < 17) {
      newState.dealerHand.push(newState.deck.pop());
    }
    
    const playerValue = calculateBlackjackValue(newState.playerHands[playerIndex]);
    const dealerValue = calculateBlackjackValue(newState.dealerHand);
    
    let winner = null;
    if (dealerValue > 21) {
      winner = playerIndex;
    } else if (playerValue > dealerValue) {
      winner = playerIndex;
    } else if (dealerValue > playerValue) {
      winner = 1 - playerIndex;
    } else {
      winner = -1;
    }
    
    return {
      valid: true,
      newState,
      gameOver: true,
      winner,
      reason: 'stand'
    };
  }
  
  return { valid: true, newState, gameOver: false };
}

function calculateBlackjackValue(hand) {
  let value = 0;
  let aces = 0;
  
  for (const card of hand) {
    if (card.rank === 'A') {
      aces++;
      value += 11;
    } else if (['J', 'Q', 'K'].includes(card.rank)) {
      value += 10;
    } else {
      value += parseInt(card.rank);
    }
  }
  
  while (value > 21 && aces > 0) {
    value -= 10;
    aces--;
  }
  
  return value;
}

// オンラインゲーム結果保存
async function saveOnlineGameResult(username, result, gameType) {
  try {
    const users = await readJSON(USERS_FILE);
    
    for (const [email, user] of Object.entries(users)) {
      if (user.username === username) {
        if (result === 'win') user.stats.wins++;
        else if (result === 'loss') user.stats.losses++;
        else user.stats.draws++;
        user.stats.gamesPlayed++;
        break;
      }
    }
    
    await writeJSON(USERS_FILE, users);
  } catch (err) {
    console.error('オンライン結果保存エラー:', err);
  }
}