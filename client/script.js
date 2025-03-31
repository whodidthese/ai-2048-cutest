document.addEventListener('DOMContentLoaded', () => {
	// --- DOM Elements ---
	const tileContainer = document.getElementById('tile-container');
	const currentScoreEl = document.getElementById('current-score');
	const bestScoreEl = document.getElementById('best-score');
	const newGameButton = document.getElementById('new-game-button');
	// (Add references for overlay elements later)
	const resultsOverlay = document.getElementById('results-overlay');
	const resultsMessage = document.getElementById('results-message');
	const finalScoreEl = document.getElementById('final-score');
	const nicknameSection = document.getElementById('nickname-section');
	const nicknameText = document.getElementById('nickname-text');
	const regenerateNicknameBtn = document.getElementById('regenerate-nickname-btn');
	const confirmNicknameBtn = document.getElementById('confirm-nickname-btn');
	const nicknameSavedMessage = document.getElementById('nickname-saved-message');
	const leaderboardSection = document.getElementById('leaderboard-section');
	const leaderboardLoading = document.getElementById('leaderboard-loading');
	const leaderboardError = document.getElementById('leaderboard-error');
	const leaderboardList = document.getElementById('leaderboard-list');
	const playAgainBtn = document.getElementById('play-again-btn');

	// --- Game Variables ---
	const GRID_SIZE = 4;
	const SWIPE_THRESHOLD = 30; // Minimum pixels for a swipe
	const API_BASE_URL = 'http://localhost:3330'; // Use your server's port
	// --- Local Storage Keys ---
	const BEST_SCORE_KEY = 'ai2048CutestBestScore';
	const NICKNAME_KEY = 'ai2048CutestNickname';
	const LOCAL_LEADERBOARD_KEY = 'ai2048CutestLocalLeaderboard'; // For fallback

	let board = []; // 2D array representing the grid
	let score = 0;
	let bestScore = 0;
	let isGameOver = false;
	let touchStartX = 0;
	let touchStartY = 0;

	let currentNickname = ''; // Store the currently displayed/chosen nickname

	let mergedTilesTracker = []; // Array of {r, c} coordinates that merged this turn

	// --- Add Nickname Generation Data ---
	const actions = ["Sleeping", "Dancing", "Jumping", "Running", "Flying", "Swimming", "Singing", "Reading", "Drawing", "Painting", "Fishing", "Hiking", "Baking", "Cooking", "Eating", "Dreaming", "Winking", "Smiling", "Laughing", "Floating", "Hopping", "Skipping", "Waving", "Hugging", "Cuddling", "Napping", "Stargazing", "Sipping", "Munching", "Playing"];
	const colors = ["Pink", "Blue", "Green", "Yellow", "Purple", "Orange", "Mint", "Peach", "Lavender", "Coral"];
	const cuteThings = ["Bunny", "Kitten", "Puppy", "Panda", "Bear", "Fox", "Hedgehog", "Piggy", "Duckling", "Lamb", "Owl", "Chipmunk", "Hamster", "Penguin", "Koala", "Cupcake", "Muffin", "Cookie", "Donut", "Macaron", "Pudding", "Brownie", "Cheesecake", "Mochi", "Eclair", "Waffle", "Pancake", "Sundae", "Marshmallow", "Jellybean"];

	// --- Initialization ---
	function setupGame() {
		loadBestScore(); // Load best score from local storage first
		initGame();      // Initialize the first game state
		addEventListeners(); // Setup button listeners
	}

	function addEventListeners() {
		newGameButton.addEventListener('click', initGame);
		playAgainBtn.addEventListener('click', initGame); // Play Again button starts new game
		regenerateNicknameBtn.addEventListener('click', generateAndDisplayNickname);
		confirmNicknameBtn.addEventListener('click', handleConfirmAndSubmit);

		// Keyboard Input
		document.addEventListener('keydown', handleKeyDown);

		// Touch Input
		const gameArea = document.querySelector('.game-container'); // Target the game area for swipes
		if (gameArea) {
			gameArea.addEventListener('touchstart', handleTouchStart, { passive: false }); // passive: false to allow preventDefault
			gameArea.addEventListener('touchmove', handleTouchMove, { passive: false });   // passive: false to allow preventDefault
			gameArea.addEventListener('touchend', handleTouchEnd);
		} else {
			console.error("Game container not found for touch events.");
		}
	}

	// --- Game Logic Functions ---

	/**
	 * Initializes the game state for a new game.
	 */
	function initGame() {
		board = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
		score = 0;
		isGameOver = false;
		// (Hide overlay later)

		mergedTilesTracker = []; // Reset tracker
		hideResultsScreen(); // Hide overlay when starting new game

		// Spawn two initial tiles
		spawnTile();
		spawnTile();

		updateScoreDisplay();
		drawBoard();
		console.log("New game started!");
		console.log(board.map(row => row.join("\t")).join("\n")); // Log initial board state
	}

	/**
	 * Finds all empty cells on the board.
	 * @returns {Array} An array of objects {r, c} representing empty cell coordinates.
	 */
	function getEmptyCells() {
		const emptyCells = [];
		for (let r = 0; r < GRID_SIZE; r++) {
			for (let c = 0; c < GRID_SIZE; c++) {
				if (board[r][c] === 0) {
					emptyCells.push({ r, c });
				}
			}
		}
		return emptyCells;
	}

	/**
	 * Spawns a new tile (90% '2', 10% '4') in a random empty cell.
	 */
	function spawnTile() {
		const emptyCells = getEmptyCells();
		if (emptyCells.length === 0) {
			console.log("No empty cells to spawn a new tile.");
			// Potentially check for game over here later
			return;
		}

		const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
		const newValue = Math.random() < 0.9 ? 2 : 4; // 90% chance for 2, 10% for 4

		board[randomCell.r][randomCell.c] = newValue;

		// Note: We only update the board array here. drawBoard() will handle visuals.
		// For animations later, we might create the tile element here.
	}

	/**
	 * Updates the score display in the UI and checks/updates best score.
	 */
	function updateScoreDisplay() {
		currentScoreEl.textContent = score;
		if (score > bestScore) {
			bestScore = score;
			bestScoreEl.textContent = bestScore;
			saveBestScore(); // Save new best score to local storage
		}
	}

	/**
	 * Clears the tile container and redraws all tiles based on the current board state.
	 * (Simple redraw approach - will be refined for animations later)
	 */
	function drawBoard() {
		tileContainer.innerHTML = ''; // Clear previous tiles

		// --- Get computed size values from actual elements ---
		const gridBackground = document.querySelector('.grid-background');
		const firstCell = document.querySelector('.grid-cell'); // Get a sample cell

		let tileGap = NaN;
		let cellSize = NaN;

		// Ensure the elements exist before trying to get styles
		if (gridBackground && firstCell) {
			const gridStyles = getComputedStyle(gridBackground);
			// 'gap' can be complex; try reading 'row-gap' or 'column-gap' specifically.
			// If 'gap' returns two values (e.g., "10px 15px"), parseFloat only gets the first.
			// Reading 'row-gap' is usually sufficient if row and column gaps are the same.
			const gapValueString = gridStyles.getPropertyValue('row-gap'); // Or 'column-gap', should be same if 'gap' was used
			tileGap = parseFloat(gapValueString);

			const cellStyles = getComputedStyle(firstCell);
			const cellSizeString = cellStyles.getPropertyValue('width'); // Read the width of a cell
			cellSize = parseFloat(cellSizeString);

			console.log("Computed gap (row-gap):", gapValueString, "-> Parsed:", tileGap); // Debug log
			console.log("Computed cell width:", cellSizeString, "-> Parsed:", cellSize); // Debug log

		} else {
			// Fallback if elements aren't found (shouldn't happen if HTML is correct)
			console.error("Could not find .grid-background or .grid-cell to compute sizes.");
			// Assign default values ONLY as a last resort for testing
			// tileGap = 10;
			// cellSize = 80;
		}
		// --- End computed size retrieval ---


		// --- Add a check for NaN ---
		// This check is important in case the elements weren't found or styles were invalid
		if (isNaN(tileGap) || isNaN(cellSize)) {
			console.error("Error: tileGap or cellSize is NaN after reading element styles. Cannot calculate positions.", { tileGap, cellSize });
			// Stop the function or use hardcoded fallbacks if essential for testing,
			// but ideally, the cause of NaN should be fixed (e.g., CSS loading).
			return; // Stop drawing if sizes are invalid
		}
		// --- End NaN check ---


		const addedTiles = [];
		for (let r = 0; r < GRID_SIZE; r++) {
			for (let c = 0; c < GRID_SIZE; c++) {
				const value = board[r][c];
				if (value !== 0) {
					const tile = document.createElement('div');
					tile.classList.add('tile');
					tile.classList.add(`tile-${value > 2048 ? 'super' : value}`);
					tile.textContent = value;

					// Use the successfully parsed numerical values
					const topPos = r * (cellSize + tileGap) + tileGap;
					const leftPos = c * (cellSize + tileGap) + tileGap;

					tile.style.setProperty('--x', `${leftPos}px`);
					tile.style.setProperty('--y', `${topPos}px`);
					tile.style.top = `${topPos}px`;
					tile.style.left = `${leftPos}px`;

					tileContainer.appendChild(tile);
					addedTiles.push(tile);

					// Remove animation class... (existing code, if needed for merge later)
					// if (tile.classList.contains('tile-merged')) { ... }
				}
			}
		}
		// Add spawn animation... (existing code)
	}

	// --- Local Storage Functions ---

	/**
	 * Loads the best score from local storage.
	 */
	function loadBestScore() {
		const savedBestScore = localStorage.getItem(BEST_SCORE_KEY);
		bestScore = savedBestScore ? parseInt(savedBestScore, 10) : 0;
		bestScoreEl.textContent = bestScore;
	}

	/**
	 * Saves the current best score to local storage.
	 */
	function saveBestScore() {
		localStorage.setItem(BEST_SCORE_KEY, bestScore.toString());
	}

	// --- Movement Logic ---

	/**
	 * Processes a single line (row or column) for sliding and merging.
	 * Slides tiles towards the beginning of the array and merges identical neighbors.
	 * @param {Array<number>} line - The row or column to process.
	 * @returns {object} - { newLine: Array<number>, scoreGained: number, moved: boolean }
	 */
	// Reverted to simpler signature - Removed axis, index parameters and internal tracking logic
	function slideAndMergeLine(line) {
		let scoreGained = 0;
		let moved = false;

		// 1. Filter out zeros
		let filteredLine = line.filter(val => val !== 0);
		// Check if different from original line length OR if order changed before merge
		if (filteredLine.length !== line.length) {
			moved = true;
		}

		// 2. Merge identical adjacent tiles
		for (let i = 0; i < filteredLine.length - 1; i++) {
			if (filteredLine[i] !== 0 && filteredLine[i] === filteredLine[i + 1]) {
				filteredLine[i] *= 2;
				scoreGained += filteredLine[i];
				filteredLine[i + 1] = 0; // Mark second tile for removal
				moved = true; // Merge counts as movement
			}
		}

		// 3. Filter out zeros created by merging
		let mergedLine = filteredLine.filter(val => val !== 0);

		// 4. Create the new line array with padding
		const newLine = Array(GRID_SIZE).fill(0);
		for (let i = 0; i < mergedLine.length; i++) {
			newLine[i] = mergedLine[i];
		}

		// Final check: Compare newLine to original line to catch pure slides
		if (!moved) {
			for (let i = 0; i < GRID_SIZE; ++i) {
				if (line[i] !== newLine[i]) {
					moved = true;
					break;
				}
			}
		}
		return { newLine, scoreGained, moved };
	}

	// --- Update move functions to call the simpler slideAndMergeLine ---
	function moveLeft() {
		let boardChanged = false;
		let currentTurnScore = 0;
		for (let r = 0; r < GRID_SIZE; r++) {
			const result = slideAndMergeLine(board[r]); // Simplified call
			if (result.moved) {
				board[r] = result.newLine;
				currentTurnScore += result.scoreGained;
				boardChanged = true;
			}
		}
		if (boardChanged) score += currentTurnScore;
		return boardChanged;
	}

	function moveRight() {
		let boardChanged = false;
		let currentTurnScore = 0;
		for (let r = 0; r < GRID_SIZE; r++) {
			const originalRow = board[r];
			const reversedRow = [...originalRow].reverse();
			const result = slideAndMergeLine(reversedRow); // Simplified call
			if (result.moved) {
				board[r] = result.newLine.reverse();
				currentTurnScore += result.scoreGained;
				boardChanged = true;
			}
		}
		if (boardChanged) score += currentTurnScore;
		return boardChanged;
	}

	function moveUp() {
		let boardChanged = false;
		let currentTurnScore = 0;
		for (let c = 0; c < GRID_SIZE; c++) {
			let columnLine = [];
			for (let r = 0; r < GRID_SIZE; r++) columnLine.push(board[r][c]);
			const result = slideAndMergeLine(columnLine); // Simplified call
			if (result.moved) {
				for (let r = 0; r < GRID_SIZE; r++) board[r][c] = result.newLine[r];
				currentTurnScore += result.scoreGained;
				boardChanged = true;
			}
		}
		if (boardChanged) score += currentTurnScore;
		return boardChanged;
	}

	function moveDown() {
		let boardChanged = false;
		let currentTurnScore = 0;
		for (let c = 0; c < GRID_SIZE; c++) {
			let columnLine = [];
			for (let r = 0; r < GRID_SIZE; r++) columnLine.push(board[r][c]);
			const reversedColumn = columnLine.reverse();
			const result = slideAndMergeLine(reversedColumn); // Simplified call
			if (result.moved) {
				const finalColumn = result.newLine.reverse();
				for (let r = 0; r < GRID_SIZE; r++) board[r][c] = finalColumn[r];
				currentTurnScore += result.scoreGained;
				boardChanged = true;
			}
		}
		if (boardChanged) score += currentTurnScore;
		return boardChanged;
	}

	// --- Game Over Check (Placeholder - needs refinement) ---
	/**
	 * Checks if the game is over (no empty cells and no possible merges).
	 * @returns {boolean} - True if game over, false otherwise.
	 */
	function checkGameOver() {
		// 1. Check for empty cells
		if (getEmptyCells().length > 0) {
			return false; // Not game over if there are empty cells
		}

		// 2. Check for possible merges horizontally and vertically
		for (let r = 0; r < GRID_SIZE; r++) {
			for (let c = 0; c < GRID_SIZE; c++) {
				const currentTile = board[r][c];
				// Check right neighbor
				if (c < GRID_SIZE - 1 && currentTile === board[r][c + 1]) {
					return false; // Possible horizontal merge
				}
				// Check bottom neighbor
				if (r < GRID_SIZE - 1 && currentTile === board[r + 1][c]) {
					return false; // Possible vertical merge
				}
			}
		}

		// If no empty cells and no possible merges, game is over
		isGameOver = true;
		return true;
	}

	/**
	 * Handles the actions after a successful move.
	 */
	function handleMoveSuccess() {
		spawnTile();
		updateScoreDisplay();
		drawBoard(); // Redraw after spawning
		console.log(board.map(row => row.join("\t")).join("\n")); // Log board state

		if (checkGameOver()) {
			// Trigger game over sequence (show overlay etc.)
			console.log("Game Over!");
			showResultsScreen('Game Over!');
		}
	}

	// --- Input Handlers ---

	/**
	 * Handles keyboard arrow key presses.
	 * @param {KeyboardEvent} event - The keydown event object.
	 */
	function handleKeyDown(event) {
		if (isGameOver) return; // Ignore input if game is over

		let boardChanged = false;
		// Prevent default scrolling behavior for arrow keys
		switch (event.key) {
			case "ArrowUp":
				event.preventDefault();
				boardChanged = moveUp();
				break;
			case "ArrowDown":
				event.preventDefault();
				boardChanged = moveDown();
				break;
			case "ArrowLeft":
				event.preventDefault();
				boardChanged = moveLeft();
				break;
			case "ArrowRight":
				event.preventDefault();
				boardChanged = moveRight();
				break;
			default:
				return; // Ignore other keys
		}

		if (boardChanged) {
			handleMoveSuccess();
		}
	}

	/**
	 * Records the starting position of a touch.
	 * @param {TouchEvent} event - The touchstart event object.
	 */
	function handleTouchStart(event) {
		if (isGameOver) return;
		// Use the first touch point
		touchStartX = event.touches[0].clientX;
		touchStartY = event.touches[0].clientY;
		// event.preventDefault(); // Prevent scroll only if needed - test carefully
		// May uncomment if swipe causes page scroll
	}

	/**
	* Prevents scrolling while swiping over the game board.
	* @param {TouchEvent} event - The touchmove event object.
	*/
	function handleTouchMove(event) {
		if (isGameOver) return;
		// Prevent scrolling the page while swiping within the game container
		event.preventDefault();
	}


	/**
	 * Determines swipe direction and triggers movement after touch ends.
	 * @param {TouchEvent} event - The touchend event object.
	 */
	function handleTouchEnd(event) {
		if (isGameOver || touchStartX === 0 || touchStartY === 0) {
			// Reset start points just in case
			touchStartX = 0;
			touchStartY = 0;
			return; // Ignore if game over or no start data
		}


		const touchEndX = event.changedTouches[0].clientX;
		const touchEndY = event.changedTouches[0].clientY;

		const dx = touchEndX - touchStartX;
		const dy = touchEndY - touchStartY;

		let boardChanged = false;

		// Determine if horizontal or vertical swipe is dominant
		if (Math.abs(dx) > Math.abs(dy)) {
			// Horizontal Swipe
			if (Math.abs(dx) > SWIPE_THRESHOLD) { // Check threshold
				if (dx > 0) {
					boardChanged = moveRight();
					console.log("Swipe Right");
				} else {
					boardChanged = moveLeft();
					console.log("Swipe Left");
				}
			}
		} else {
			// Vertical Swipe
			if (Math.abs(dy) > SWIPE_THRESHOLD) { // Check threshold
				if (dy > 0) {
					boardChanged = moveDown();
					console.log("Swipe Down");
				} else {
					boardChanged = moveUp();
					console.log("Swipe Up");
				}
			}
		}

		// Reset start points after processing
		touchStartX = 0;
		touchStartY = 0;

		if (boardChanged) {
			// Delay slightly to let the visual swipe feel complete before tile moves? Optional.
			// setTimeout(handleMoveSuccess, 50);
			handleMoveSuccess();
		}
	}

	/**
	 * Generates a random nickname.
	 * @returns {string} A randomly generated nickname.
	 */
	function generateNickname() {
		const action = actions[Math.floor(Math.random() * actions.length)];
		const color = colors[Math.floor(Math.random() * colors.length)];
		const thing = cuteThings[Math.floor(Math.random() * cuteThings.length)];
		return `${action} ${color} ${thing}`;
	}

	/**
	 * Generates and displays a nickname in the UI.
	 */
	function generateAndDisplayNickname() {
		currentNickname = generateNickname();
		nicknameText.textContent = currentNickname;

		// confirmNicknameBtn.disabled = false; // Enable confirm button
		confirmNicknameBtn.classList.remove('hidden');

		nicknameSavedMessage.classList.add('hidden'); // Hide saved message
	}

	/**
	 * Loads nickname from local storage or generates a new one.
	 */
	function loadOrGenerateNickname() {
		const savedNickname = localStorage.getItem(NICKNAME_KEY);
		if (savedNickname) {
			currentNickname = savedNickname;
			nicknameText.textContent = currentNickname;
			// Maybe show that it's a saved nickname?
			// confirmNicknameBtn.disabled = false; // Still allow submission
			confirmNicknameBtn.classList.remove('hidden');
		} else {
			generateAndDisplayNickname();
		}
	}

	/**
	 * Saves ONLY the nickname to local storage.
	 */
	function saveNicknameLocally(nickname) {
		if (nickname) {
			localStorage.setItem(NICKNAME_KEY, nickname);
			console.log("Nickname saved locally:", nickname);
		}
	}

	/**
	 * Handles the click on the "Confirm & Submit" button.
	 * Saves nickname locally and attempts to submit score to server.
	 */
	function handleConfirmAndSubmit() {
		if (!currentNickname || isNaN(score)) {
			console.error("Cannot submit score: Nickname or score is invalid.");
			return;
		}

		// Disable buttons immediately to prevent multiple clicks
		// confirmNicknameBtn.disabled = true;
		// regenerateNicknameBtn.disabled = true;

		confirmNicknameBtn.classList.add('hidden');
		regenerateNicknameBtn.classList.add('hidden');

		nicknameSavedMessage.classList.remove('hidden'); // Show saved message
		nicknameSavedMessage.textContent = "Submitting..."; // Change message


		// 1. Save nickname locally regardless of submission success
		saveNicknameLocally(currentNickname);

		// 2. Attempt to submit score to server (which will then try to fetch leaderboard)
		submitScoreToServer(currentNickname, score);

		// Hide submitting message after a delay? Or let API functions handle UI updates.
		// Let's remove the timeout here and rely on leaderboard display functions for UI feedback.
		// setTimeout(() => {
		//     nicknameSavedMessage.classList.add('hidden');
		// }, 2000);
		// Instead: Clear message on successful display or error display later
	}

	// --- Add Results Screen Functions ---

	/**
	 * Shows the results screen overlay.
	 * @param {string} message - The message to display (e.g., 'Game Over!').
	 */
	function showResultsScreen(message) {
		isGameOver = true;
		resultsMessage.textContent = message;
		finalScoreEl.textContent = score;

		loadOrGenerateNickname();
		// regenerateNicknameBtn.disabled = false;
		regenerateNicknameBtn.classList.remove('hidden');

		// confirmNicknameBtn.disabled = false;
		confirmNicknameBtn.classList.remove('hidden');

		nicknameSavedMessage.classList.add('hidden');
		nicknameSavedMessage.textContent = "Nickname saved!"; // Reset message text

		// Reset Leaderboard display
		leaderboardList.innerHTML = ''; // Clear previous list
		const existingPlayerScoreMsg = leaderboardSection.querySelector('p.player-current-score'); // Add specific class
		if (existingPlayerScoreMsg && existingPlayerScoreMsg.textContent.startsWith('Your score:')) {
			leaderboardSection.removeChild(existingPlayerScoreMsg);
		}
		leaderboardError.classList.add('hidden'); // Hide errors
		leaderboardLoading.classList.remove('hidden'); // Show loading initially

		// --- Trigger initial leaderboard fetch immediately ---
		fetchLeaderboardFromServer(); // <--- ADD THIS CALL HERE

		resultsOverlay.classList.remove('hidden');
	}

	/**
	 * Hides the results screen overlay.
	 */
	function hideResultsScreen() {
		resultsOverlay.classList.add('hidden');
	}

	/**
	 * Hides nickname action buttons and messages after submission attempt.
	 */
	function finalizeNicknameDisplay() {
		nicknameSavedMessage.classList.add('hidden');
		// Maybe display the confirmed nickname more plainly without buttons
	}

	// --- Local Leaderboard (Fallback) Functions ---

	/**
	 * Loads the local leaderboard array from localStorage.
	 * @returns {Array<object>} The leaderboard array or empty array if none exists.
	 */
	function loadLocalLeaderboard() {
		try {
			const storedLeaderboard = localStorage.getItem(LOCAL_LEADERBOARD_KEY);
			return storedLeaderboard ? JSON.parse(storedLeaderboard) : [];
		} catch (e) {
			console.error("Error parsing local leaderboard:", e);
			return [];
		}
	}

	/**
	 * Saves the local leaderboard array to localStorage.
	 * @param {Array<object>} leaderboardArray - The leaderboard array to save.
	 */
	function saveLocalLeaderboard(leaderboardArray) {
		try {
			localStorage.setItem(LOCAL_LEADERBOARD_KEY, JSON.stringify(leaderboardArray));
		} catch (e) {
			console.error("Error saving local leaderboard:", e);
		}
	}

	/**
	 * Updates the local leaderboard with a new score if it qualifies.
	 * @param {string} nickname - The player's nickname.
	 * @param {number} score - The player's score.
	 * @returns {Array<object>} The updated local leaderboard array (top 10).
	 */
	function updateLocalLeaderboard(nickname, score) {
		const leaderboard = loadLocalLeaderboard();
		const newEntry = { nickname, score, timestamp: new Date().toISOString() };

		leaderboard.push(newEntry);
		// Sort by score descending, then by timestamp ascending for ties (optional)
		leaderboard.sort((a, b) => b.score - a.score || new Date(a.timestamp) - new Date(b.timestamp));
		const updatedTop10 = leaderboard.slice(0, 10); // Keep only top 10
		saveLocalLeaderboard(updatedTop10);
		return updatedTop10;
	}

	/**
	 * Displays the local leaderboard and the player's current score as a fallback.
	 * @param {string} playerNickname - The nickname of the current player.
	 * @param {number} playerScore - The score of the current player.
	 */
	function displayLocalLeaderboard(playerNickname, playerScore) {
		console.log("Displaying local leaderboard as fallback.");
		const localTop10 = updateLocalLeaderboard(playerNickname, playerScore); // Update with current score attempt

		leaderboardLoading.classList.add('hidden');
		leaderboardError.classList.remove('hidden');
		leaderboardError.textContent = "Server unavailable. Showing local high scores."; // Inform user
		leaderboardList.innerHTML = ''; // Clear previous list

		// Clear any previously added local score message
		const existingPlayerScore = leaderboardSection.querySelector('p');
		if (existingPlayerScore && existingPlayerScore.textContent.startsWith('Your score:')) {
			leaderboardSection.removeChild(existingPlayerScore);
		}

		// Optional: Display player's current score clearly
		const playerScoreItem = document.createElement('p');
		playerScoreItem.style.fontWeight = 'bold';
		playerScoreItem.style.textAlign = 'center';
		playerScoreItem.style.marginBottom = '10px';
		playerScoreItem.textContent = `Your score: ${playerNickname} - ${playerScore}`;

		// Prepend it before the list if desired
		leaderboardSection.insertBefore(playerScoreItem, leaderboardList);

		if (localTop10.length === 0) {
			leaderboardList.innerHTML = '<li>No local scores saved yet.</li>';
			return;
		}

		// Populate the list
		localTop10.forEach((entry, index) => {
			const li = document.createElement('li');
			const rank = index + 1;
			// Highlight player's score if it's in the local top 10? (Optional enhancement)
			// Example: ${entry.nickname === playerNickname && entry.score === playerScore ? ' class="player-score"' : ''}
			li.innerHTML = `<span><span class="math-inline">${rank}.</span> <span class="nickname">${entry.nickname}</span></span> <span>${entry.score}</span>`;
			leaderboardList.appendChild(li);
		});

		finalizeNicknameDisplay();
	}

	// --- Leaderboard Display ---

	/**
	 * Displays the top 10 leaderboard fetched from the server.
	 * @param {Array<object>} top10 - Array of { nickname, score } objects.
	 */
	function displayServerLeaderboard(top10) {
		console.log("Displaying server leaderboard:", top10);
		leaderboardLoading.classList.add('hidden');
		leaderboardError.classList.add('hidden'); // Hide error message
		leaderboardList.innerHTML = ''; // Clear previous list

		// Clear any previously added local score message
		const existingPlayerScore = leaderboardSection.querySelector('p');
		if (existingPlayerScore && existingPlayerScore.textContent.startsWith('Your score:')) {
			leaderboardSection.removeChild(existingPlayerScore);
		}

		if (!top10 || top10.length === 0) {
			leaderboardList.innerHTML = '<li>Leaderboard is empty!</li>';
			// return;
		}
		else {
			top10.forEach((entry, index) => {
				const li = document.createElement('li');
				const rank = index + 1;
				// Add HTML structure for rank, nickname, score
				li.innerHTML = `<span><span class="math-inline">${rank}.</span> <span class="nickname">${entry.nickname}</span></span> <span>${entry.score}</span>`;
				leaderboardList.appendChild(li);
			});
		}

		finalizeNicknameDisplay();
	}

	// --- API Interaction ---

	/**
	 * Attempts to submit the score to the server.
	 * On failure, triggers local leaderboard display.
	 * On success, triggers fetching the server leaderboard.
	 * @param {string} nickname - The player's confirmed nickname.
	 * @param {number} score - The player's final score.
	 */
	async function submitScoreToServer(nickname, score) {
		console.log(`Submitting score for ${nickname}: ${score}`);
		try {
			const response = await fetch(`${API_BASE_URL}/api/scores`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ nickname, score }),
			});

			if (!response.ok) {
				// Handle server-side errors (like 400 validation, 500 internal)
				const errorData = await response.json().catch(() => ({})); // Try to parse error, default to empty object
				console.error(`Error submitting score: ${response.status} ${response.statusText}`, errorData);
				throw new Error(`Server error ${response.status}: ${errorData.message || response.statusText}`);
			}

			const result = await response.json();
			console.log('Score submission successful:', result);
			// If score submission worked, fetch the updated leaderboard
			await fetchLeaderboardFromServer();

		} catch (error) {
			console.error('Failed to submit score or fetch leaderboard after submission:', error);
			// Fallback to local leaderboard display
			displayLocalLeaderboard(nickname, score);
		}
	}

	/**
	 * Attempts to fetch the top 10 leaderboard from the server.
	 * On failure, triggers local leaderboard display.
	 * On success, triggers server leaderboard display.
	 */
	async function fetchLeaderboardFromServer() {
		console.log("Fetching leaderboard from server...");
		try {
			const response = await fetch(`${API_BASE_URL}/api/leaderboard`);

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				console.error(`Error fetching leaderboard: ${response.status} ${response.statusText}`, errorData);
				throw new Error(`Server error ${response.status}: ${errorData.message || response.statusText}`);
			}

			const data = await response.json();
			if (data && data.top10) {
				displayServerLeaderboard(data.top10);
			} else {
				throw new Error("Invalid leaderboard data format received from server.");
			}

		} catch (error) {
			console.error('Failed to fetch server leaderboard:', error);
			// Fallback to local leaderboard display (using currentNickname/score which should still be available)
			// Note: If this fails *after* score submission, updateLocalLeaderboard might add the score again,
			// but the sorting/slicing should handle duplicates based on timestamp if needed.
			displayLocalLeaderboard(currentNickname, score);
		}
	}

	// --- Start the Game ---
	setupGame();

}); // End DOMContentLoaded