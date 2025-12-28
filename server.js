const express = require("express");
const session = require("express-session");
const multer = require("multer");
const fs = require("fs");
const { spawn } = require("child_process");
const path = require("path");

const app = express();
app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: "panelbot123",
    resave: false,
    saveUninitialized: true
}));

// === Login Admin ===
const ADMIN_USER = "admin";
const ADMIN_PASS = "23082012";

app.post("/login", (req, res) => {
    const { user, pass } = req.body;
    if(user === ADMIN_USER && pass === ADMIN_PASS){
        req.session.loggedIn = true;
        res.json({ success: true });
    } else res.json({ success: false });
});

function auth(req, res, next){
    if(req.session.loggedIn) next();
    else res.status(401).send("Unauthorized");
}

// === Multi Bot Management ===
let bots = {}; // {botName: {process, filePath}}

app.post("/start", auth, (req, res) => {
    const { bot } = req.body;
    const botPath = path.join(__dirname, "bots", bot);
    if(!fs.existsSync(botPath)) return res.json({ status: "Bot tidak ditemukan" });

    if(bots[bot] && bots[bot].process) return res.json({ status: "Bot sudah jalan" });

    const botProc = spawn("node", [botPath]);
    bots[bot] = { process: botProc, filePath: botPath };

    botProc.stdout.on("data", data => console.log(`[${bot}] ${data}`));
    botProc.stderr.on("data", data => console.error(`[${bot}] ERROR: ${data}`));

    botProc.on("close", () => {
        console.log(`[${bot}] Bot berhenti`);
        bots[bot].process = null;
        // auto restart
        setTimeout(() => {
            console.log(`[${bot}] Auto restart...`);
            const restartProc = spawn("node", [botPath]);
            bots[bot].process = restartProc;
            restartProc.stdout.on("data", d => console.log(`[${bot}] ${d}`));
            restartProc.stderr.on("data", d => console.error(`[${bot}] ERROR: ${d}`));
        }, 3000);
    });

    res.json({ status: "Bot dijalankan" });
});

app.post("/stop", auth, (req, res) => {
    const { bot } = req.body;
    if(!bots[bot] || !bots[bot].process) return res.json({ status: "Bot belum jalan" });
    bots[bot].process.kill();
    bots[bot].process = null;
    res.json({ status: "Bot dihentikan" });
});

app.get("/status", auth, (req, res) => {
    let status = {};
    Object.keys(bots).forEach(b => {
        status[b] = bots[b].process ? "Running" : "Stop";
    });
    res.json(status);
});

// === Upload Bot File ===
const upload = multer({ dest: "bots/" });
app.post("/upload", auth, upload.single("botfile"), (req,res) => {
    const oldPath = req.file.path;
    const newPath = path.join(__dirname, "bots", req.file.originalname);
    fs.renameSync(oldPath, newPath);
    res.json({ status: "Bot berhasil diupload", file: req.file.originalname });
});

// Jalankan server
app.listen(3000, () => console.log("Panel jalan di http://localhost:3000"));