require('dotenv').config();

const express = require('express');
const sqlite3 = require('sqlite3').verbose(); // Use verbose for more detailed errors
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3330; // Use environment variable or default to 3330

// --- Database Setup ---
// Creates leaderboard.db file in the same directory if it doesn't exist
const db = new sqlite3.Database('./leaderboard.db', sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
	if (err) {
		console.error("Error connecting to database:", err.message);
	} else {
		console.log('Connected to the SQLite database.');
		// Run table creation logic after connection is established
		setupDatabaseSchema();
	}
});

// Function to setup database schema
function setupDatabaseSchema() {
	db.serialize(() => {
		// Create the scores table if it doesn't exist
		db.run(`CREATE TABLE IF NOT EXISTS scores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nickname TEXT NOT NULL,
            score INTEGER NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
			if (err) {
				console.error("Error creating scores table:", err.message);
			} else {
				console.log("Scores table checked/created successfully.");
				// Create an index on the score column for faster sorting if it doesn't exist
				db.run(`CREATE INDEX IF NOT EXISTS idx_score ON scores (score DESC)`, (err) => {
					if (err) {
						console.error("Error creating score index:", err.message);
					} else {
						console.log("Score index checked/created successfully.");
					}
				});
			}
		});
	});
}


// --- Middleware ---
// Enable CORS for all origins (adjust for production later if needed)
app.use(cors());
// Enable parsing of JSON request bodies
app.use(express.json());


// --- API Routes ---

/**
 * POST /api/scores
 * Receives a score submission from the client.
 * Expects JSON body: { "nickname": "string", "score": number }
 */
app.post('/api/scores', (req, res) => {
	const { nickname, score } = req.body;

	// --- Basic Input Validation ---
	let errorMessages = [];
	if (typeof nickname !== 'string' || nickname.trim().length === 0) {
		errorMessages.push('Nickname is required and must be a non-empty string.');
	} else if (nickname.trim().length > 50) { // Optional: Add length limit
		errorMessages.push('Nickname cannot exceed 50 characters.');
	}
	if (typeof score !== 'number' || !Number.isInteger(score) || score < 0) {
		errorMessages.push('Score is required and must be a non-negative integer.');
	}

	if (errorMessages.length > 0) {
		console.warn("Score submission validation failed:", errorMessages);
		// 400 Bad Request
		return res.status(400).json({ message: 'Invalid input.', errors: errorMessages });
	}

	const cleanNickname = nickname.trim();
	console.log(`Attempting to insert score: Nickname=${cleanNickname}, Score=${score}`);

	// --- Database Insertion ---
	const sql = `INSERT INTO scores (nickname, score) VALUES (?, ?)`;
	// Use prepare + run for security (prevents SQL injection)
	const stmt = db.prepare(sql);

	// Use function() callback to potentially access this.lastID or this.changes
	stmt.run(cleanNickname, score, function (err) {
		if (err) {
			console.error("Database error inserting score:", err.message);
			// 500 Internal Server Error
			return res.status(500).json({ message: 'Database error occurred while submitting score.' });
		}
		console.log(`Score inserted successfully. Row ID: ${this.lastID}, Changes: ${this.changes}`);
		// 201 Created
		res.status(201).json({
			message: 'Score submitted successfully!',
			id: this.lastID,
			nickname: cleanNickname,
			score: score
		});
	});
	// Finalize the statement to release resources
	stmt.finalize();
});

/**
 * GET /api/leaderboard
 * Retrieves the top 10 scores from the database.
 * Returns JSON: { "top10": [ { "nickname": "string", "score": number }, ... ] }
 */
app.get('/api/leaderboard', (req, res) => {
	console.log("Received leaderboard request.");

	const sql = `SELECT nickname, score FROM scores ORDER BY score DESC LIMIT 10`;

	// Use db.all to fetch all rows that match the query
	db.all(sql, [], (err, rows) => { // Parameters array is empty for this query
		if (err) {
			console.error("Database error fetching leaderboard:", err.message);
			// 500 Internal Server Error
			return res.status(500).json({ message: 'Database error occurred while fetching leaderboard.' });
		}

		console.log(`Leaderboard data fetched successfully. Row count: ${rows.length}`);
		// 200 OK - Send data nested under 'top10' key
		res.status(200).json({ top10: rows });
	});
});


// --- Basic Root Route (Optional - for testing server is up) ---
app.get('/', (req, res) => {
	res.send('AI 2048 Cutest Leaderboard Server is running!');
});

// --- Start Server ---
app.listen(port, () => {
	console.log(`Server listening at PORT: ${port}`);
});

// --- Graceful Database Closing (Optional but recommended) ---
process.on('SIGINT', () => {
	db.close((err) => {
		if (err) {
			return console.error("Error closing database:", err.message);
		}
		console.log('Closed the database connection.');
		process.exit(0);
	});
});