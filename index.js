
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const mainMenu = document.getElementById('main-menu');
    const gameContainer = document.getElementById('game-container');
    const statusDisplay = document.getElementById('status-display');
    const cells = document.querySelectorAll('.cell');
    const scoreXDisplay = document.getElementById('score-x');
    const scoreODisplay = document.getElementById('score-o');
    const scoreContainer = document.getElementById('score-container');

    // --- Buttonsaa ---
    const playCpuBtn = document.getElementById('play-cpu-btn');
    const play2pBtn = document.getElementById('play-2p-btn');
    const hostGameBtn = document.getElementById('host-game-btn');
    const joinGameBtn = document.getElementById('join-game-btn');
    const restartButton = document.getElementById('restart-button');
    const mainMenuButton = document.getElementById('main-menu-button');

    // --- Online Game UI ---
    const hostGameView = document.getElementById('host-game-view');
    const joinGameView = document.getElementById('join-game-view');
    const roomCodeDisplay = document.getElementById('room-code-display');
    const copyCodeBtn = document.getElementById('copy-code-btn');
    const hostStatus = document.getElementById('host-status');
    const hostBackBtn = document.getElementById('host-back-btn');
    const roomCodeInput = document.getElementById('room-code-input');
    const joinRoomBtn = document.getElementById('join-room-btn');
    const joinStatus = document.getElementById('join-status');
    const joinBackBtn = document.getElementById('join-back-btn');

    // --- Game State ---
    let gameActive = false;
    let currentPlayer = 'X';
    let gameState = ["", "", "", "", "", "", "", "", ""];
    let gameMode = null; // '2p', 'cpu', 'online'
    const cpuPlayer = 'O';
    let score = { X: 0, O: 0 };

    // --- Online Game State ---
    let peer;
    let conn;
    let playerSymbol = 'X'; // Host is 'X', joiner is 'O'
    let isMyTurn = false;
    const PEER_PREFIX = 'tictactoe-';

    const winningConditions = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
        [0, 4, 8], [2, 4, 6]             // diagonals
    ];

    // --- Message/UI Update Functions ---
    const winningMessage = () => `Player <span class="player-${currentPlayer.toLowerCase()}">${currentPlayer}</span> has won!`;
    const drawMessage = `Game ended in a draw!`;
    const currentPlayerTurn = () => `It's <span class="player-${currentPlayer.toLowerCase()}">${currentPlayer}</span>'s turn`;

    function updateScoreDisplay() {
        scoreXDisplay.textContent = score.X;
        scoreODisplay.textContent = score.O;
    }

    function updateScoreLabels() {
        const playerXLabel = scoreContainer.querySelector('.player-x');
        const playerOLabel = scoreContainer.querySelector('.player-o');
        if (gameMode === 'cpu') {
            playerXLabel.innerHTML = 'X (You)';
            playerOLabel.innerHTML = 'O (CPU)';
        } else if (gameMode === 'online') {
            playerXLabel.innerHTML = playerSymbol === 'X' ? 'X (You)' : 'X (Opponent)';
            playerOLabel.innerHTML = playerSymbol === 'O' ? 'O (You)' : 'O (Opponent)';
        } else {
            playerXLabel.innerHTML = 'X';
            playerOLabel.innerHTML = 'O';
        }
    }

    // --- View Management ---

    function showView(viewId) {
        mainMenu.classList.add('hidden');
        gameContainer.classList.add('hidden');
        hostGameView.classList.add('hidden');
        joinGameView.classList.add('hidden');
        const viewToShow = document.getElementById(viewId);
        if (viewToShow) {
            viewToShow.classList.remove('hidden');
        }
    }

    function showMainMenu() {
        gameMode = null;
        gameActive = false;
        showView('main-menu');
        restartButton.classList.remove('pulse');

        if (peer) {
            peer.destroy();
            peer = null;
        }

        // Reset score when returning to main menu
        score.X = 0;
        score.O = 0;
        updateScoreDisplay();
    }

    // --- Game Flow & State ---

    function startGame(mode) {
        gameMode = mode;
        showView('game-container');
        updateScoreLabels();
        handleRestartGame(true); // Initial start
    }

    function handleRestartGame(isInitialStart = false) {
        if (gameMode === 'online' && conn && conn.open && !isInitialStart) {
            conn.send({ type: 'restart' });
        }
    
        gameActive = true;
        currentPlayer = "X";
        gameState = ["", "", "", "", "", "", "", "", ""];
        
        if (gameMode === 'online') {
            isMyTurn = (playerSymbol === 'X'); // Host ('X') always starts
            statusDisplay.innerHTML = isMyTurn ? "Your turn" : "Opponent's turn...";
        } else {
            statusDisplay.innerHTML = currentPlayerTurn();
        }
        
        cells.forEach(cell => {
            cell.innerHTML = "";
            cell.classList.remove('x', 'o', 'winning-cell');
        });
        restartButton.classList.remove('pulse');
        
        if (gameMode === 'cpu' && currentPlayer === cpuPlayer) {
             setTimeout(makeCpuMove, 700);
        }
    }

    // --- Player & CPU & Online Actions ---
    
    function handleCellPlayed(cell, cellIndex, player) {
        gameState[cellIndex] = player;
        cell.innerHTML = `<span class="mark">${player}</span>`;
        cell.classList.add(player.toLowerCase());
        handleResultValidation(player);
    }

    function handleCellClick(event) {
        if (!gameActive) return;
        
        const clickedCell = event.target;
        const clickedCellIndex = parseInt(clickedCell.getAttribute('data-index'));

        if (gameState[clickedCellIndex] !== "") return;
        
        if (gameMode === 'online') {
            if (!isMyTurn) return;
            isMyTurn = false;
            handleCellPlayed(clickedCell, clickedCellIndex, playerSymbol);
            conn.send({ type: 'move', index: clickedCellIndex });
        } else {
            if (gameMode === 'cpu' && currentPlayer === cpuPlayer) return;
            handleCellPlayed(clickedCell, clickedCellIndex, currentPlayer);
        }
    }

    function handlePlayerChange() {
        // Only for local games. Online turn is handled by data events.
        if (gameMode === 'online') return;

        currentPlayer = currentPlayer === "X" ? "O" : "X";
        statusDisplay.innerHTML = currentPlayerTurn();

        if (gameMode === 'cpu' && currentPlayer === cpuPlayer && gameActive) {
            setTimeout(makeCpuMove, 700);
        }
    }

    // --- Result Validation ---

    function handleResultValidation(player) {
        let roundWon = false;
        let winningCombination = [];
        for (const winCondition of winningConditions) {
            const a = gameState[winCondition[0]];
            const b = gameState[winCondition[1]];
            const c = gameState[winCondition[2]];
            if (a === '' || b === '' || c === '') continue;
            if (a === b && b === c) {
                roundWon = true;
                winningCombination = winCondition;
                break;
            }
        }

        if (roundWon) {
            if (gameMode === 'online') {
                statusDisplay.innerHTML = player === playerSymbol ? 'You win!' : 'Opponent wins!';
            } else {
                statusDisplay.innerHTML = winningMessage();
            }
            score[player]++;
            updateScoreDisplay();
            gameActive = false;
            winningCombination.forEach(index => cells[index].classList.add('winning-cell'));
            restartButton.classList.add('pulse');
            return;
        }

        const roundDraw = !gameState.includes("");
        if (roundDraw) {
            statusDisplay.innerHTML = drawMessage;
            gameActive = false;
            restartButton.classList.add('pulse');
            return;
        }
        
        if (gameMode !== 'online') {
            handlePlayerChange();
        } else {
             statusDisplay.innerHTML = isMyTurn ? "Your turn" : "Opponent's turn...";
        }
    }

    // --- PeerJS / Online Logic ---

    function generateRoomCode() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    function initHostGame() {
        if (peer) peer.destroy();
        const roomCode = generateRoomCode();
        peer = new Peer(PEER_PREFIX + roomCode);

        peer.on('open', (id) => {
            roomCodeDisplay.textContent = roomCode;
            showView('host-game-view');
        });

        peer.on('connection', (newConn) => {
            if (conn && conn.open) {
                newConn.close();
                return;
            }
            conn = newConn;
            hostStatus.textContent = 'Player connected! Waiting for them to be ready...';
            
            conn.on('open', () => {
                playerSymbol = 'X';
                // Wait for the joiner to send a 'ready' signal.
            });
            conn.on('data', handleReceivedData);
            conn.on('close', handleDisconnect);
        });

        peer.on('error', handlePeerError);
    }

    function initJoinGame() {
        const roomCode = roomCodeInput.value.trim();
        if (!/^\d{6}$/.test(roomCode)) {
            joinStatus.textContent = 'Please enter a valid 6-digit code.';
            return;
        }

        if (peer) peer.destroy();
        peer = new Peer();

        peer.on('open', () => {
            joinStatus.textContent = 'Connecting...';
            conn = peer.connect(PEER_PREFIX + roomCode);
            conn.on('open', () => {
                playerSymbol = 'O';
                joinStatus.textContent = 'Connection established! Readying up...';
                // Let the host know we are ready to start.
                conn.send({ type: 'ready' });
            });
            conn.on('data', handleReceivedData);
            conn.on('close', handleDisconnect);
        });

        peer.on('error', handlePeerError);
    }

    function handleReceivedData(data) {
        switch (data.type) {
            case 'ready': // Host receives this from joiner
                if (playerSymbol === 'X') {
                    hostStatus.textContent = 'Player is ready! Starting game...';
                    // Now that joiner is ready, host initiates the game
                    conn.send({ type: 'init' });
                    startGame('online');
                }
                break;
            case 'init': // Joiner receives this from host
                startGame('online');
                break;
            case 'move':
                isMyTurn = true;
                const opponentSymbol = playerSymbol === 'X' ? 'O' : 'X';
                handleCellPlayed(cells[data.index], data.index, opponentSymbol);
                break;
            case 'restart':
                handleRestartGame(true);
                break;
        }
    }

    function handleDisconnect() {
        alert('Opponent has disconnected.');
        showMainMenu();
    }

    function handlePeerError(err) {
        console.error('PeerJS Error:', err.type, err);
        if (err.type === 'peer-unavailable') {
            joinStatus.textContent = 'Room not found. Check the code.';
        } else if (err.type === 'unavailable-id') {
            alert('This room code is already in use. Please try hosting again.');
            showMainMenu();
        } else {
            alert(`An error occurred: ${err.message}. Returning to menu.`);
            showMainMenu();
        }
    }

    // --- CPU AI Logic ---
    function findWinningOrBlockingMove(player) {
        for (const condition of winningConditions) {
            const parts = condition.map(index => gameState[index]);
            const emptyIndex = parts.indexOf("");
            if (emptyIndex !== -1) {
                const filledParts = parts.filter(p => p !== "");
                if (filledParts.length === 2 && filledParts[0] === player && filledParts[1] === player) {
                    return condition[emptyIndex];
                }
            }
        }
        return null;
    }

    function makeCpuMove() {
        if (!gameActive) return;
        let move = null;
        const humanPlayer = 'X';

        // Make a mistake sometimes
        if (Math.random() > 0.75) { 
            const availableCells = gameState.map((val, idx) => val === "" ? idx : null).filter(val => val !== null);
            if (availableCells.length > 0) move = availableCells[Math.floor(Math.random() * availableCells.length)];
        } else {
            // Find winning move
            move = findWinningOrBlockingMove(cpuPlayer);
            // Block opponent's winning move
            if (move === null) move = findWinningOrBlockingMove(humanPlayer);
            // Take center if available
            if (move === null && gameState[4] === "") move = 4;
            // Take a random corner
            if (move === null) {
                const corners = [0, 2, 6, 8].filter(idx => gameState[idx] === "");
                if (corners.length > 0) move = corners[Math.floor(Math.random() * corners.length)];
            }
        }
        
        // Failsafe: take any available spot
        if (move === null) {
            const available = gameState.map((val, idx) => val === "" ? idx : null).filter(val => val !== null);
            if (available.length > 0) move = available[Math.floor(Math.random() * available.length)];
        }
        
        if (move !== null) handleCellPlayed(cells[move], move, cpuPlayer);
    }

    // --- Event Listeners ---
    playCpuBtn.addEventListener('click', () => startGame('cpu'));
    play2pBtn.addEventListener('click', () => startGame('2p'));
    mainMenuButton.addEventListener('click', showMainMenu);
    cells.forEach(cell => cell.addEventListener('click', handleCellClick));
    restartButton.addEventListener('click', () => handleRestartGame(false));

    // Online listeners
    hostGameBtn.addEventListener('click', () => {
        hostStatus.textContent = 'Creating room...';
        initHostGame();
    });
    joinGameBtn.addEventListener('click', () => {
        joinStatus.textContent = '';
        roomCodeInput.value = '';
        showView('join-game-view');
    });
    copyCodeBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(roomCodeDisplay.textContent).then(() => {
            copyCodeBtn.textContent = 'Copied!';
            setTimeout(() => { copyCodeBtn.textContent = 'Copy' }, 2000);
        });
    });
    joinRoomBtn.addEventListener('click', initJoinGame);
    hostBackBtn.addEventListener('click', showMainMenu);
    joinBackBtn.addEventListener('click', showMainMenu);
    
    // --- Initial Setup ---
    updateScoreDisplay();
    showMainMenu();
});
