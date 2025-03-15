require("dotenv").config();
const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const WebSocket = require("ws");
const bcrypt = require("bcrypt");

const app = express();
const PORT = 5000;
const SALT_ROUNDS = 10;

// Allow frontend to access backend
app.use(cors());
app.use(express.json());

// MySQL Connection
const db = mysql.createConnection({
    host: "localhost",
    user: "root", // Change if necessary
    password: "Brian23@", // Your MySQL password
    database: "investxpro",
});

db.connect(err => {
    if (err) {
        console.error("Database connection failed:", err);
    } else {
        console.log("✅ Connected to MySQL");
    }
});

// WebSocket Server (For Login/Signup)
const wss = new WebSocket.Server({ port: 5001 });

wss.on("connection", ws => {
    console.log("New WebSocket connection");

    ws.on("message", async message => {
        const data = JSON.parse(message);
        
        if (data.type === "signup") {
            try {
                // Check if email already exists
                db.query("SELECT * FROM users WHERE email = ?", [data.email], async (err, results) => {
                    if (err) {
                        ws.send(JSON.stringify({ status: "error", message: "Database error" }));
                        return;
                    }
                    if (results.length > 0) {
                        ws.send(JSON.stringify({ status: "error", message: "Email already in use" }));
                        return;
                    }
                    
                    // Hash password
                    const hashedPassword = await bcrypt.hash(data.password, SALT_ROUNDS);
                    
                    // Insert user into database
                    db.query("INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
                    [data.username, data.email, hashedPassword], (err) => {
                        if (err) {
                            ws.send(JSON.stringify({ status: "error", message: "Signup failed" }));
                        } else {
                            ws.send(JSON.stringify({ status: "success", message: "Signup successful" }));
                        }
                    });
                });
            } catch (error) {
                ws.send(JSON.stringify({ status: "error", message: "Internal server error" }));
            }
        }

        if (data.type === "login") {
            db.query("SELECT * FROM users WHERE email = ?", [data.email], async (err, results) => {
                if (err || results.length === 0) {
                    ws.send(JSON.stringify({ status: "error", message: "Invalid email or password" }));
                    return;
                }
                
                const user = results[0];
                const match = await bcrypt.compare(data.password, user.password_hash);
                
                if (match) {
                    ws.send(JSON.stringify({ status: "success", message: "Login successful", userId: user.id, username: user.username }));
                } else {
                    ws.send(JSON.stringify({ status: "error", message: "Invalid email or password" }));
                }
            });
        }
    });
});

// Fetch User Investments
app.get("/investments/:userId", (req, res) => {
    const userId = req.params.userId;
    db.query("SELECT * FROM investments WHERE user_id = ?", [userId], (err, results) => {
        if (err) return res.status(500).json({ status: "error", message: "Database error" });
        res.json({ status: "success", investments: results });
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});