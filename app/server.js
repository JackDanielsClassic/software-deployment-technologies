const express = require('express');
const mariadb = require('mariadb');

const app = express();
app.use(express.json());

const getArg = (argName, defaultValue) => {
    const arg = process.argv.find(a => a.startsWith(`--${argName}=`));
    return arg ? arg.split('=')[1] : defaultValue;
};

const PORT = getArg('port', 3000);
const DB_HOST = getArg('db-host', '127.0.0.1');
const DB_USER = getArg('db-user', 'root');
const DB_PASS = getArg('db-pass', '');
const DB_NAME = getArg('db-name', 'notes_db');

const pool = mariadb.createPool({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASS,
    database: DB_NAME,
    connectionLimit: 5
});

app.get('/health/alive', (req, res) => {
    res.status(200).send('OK');
});

app.get('/health/ready', async (req, res) => {
    try {
        const conn = await pool.getConnection();
        await conn.ping(); // Перевіряємо чи база відповідає
        conn.release();
        res.status(200).send('OK');
    } catch (err) {
        console.error('Database connection failed:', err);
        res.status(500).send('Database connection failed');
    }
});

const sendResponse = (req, res, data, htmlBuilder) => {
    const format = req.accepts(['json', 'html']);
    if (format === 'html') {
        res.type('text/html').send(htmlBuilder(data));
    } else {
        res.json(data);
    }
};

app.get('/', (req, res) => {
    const acceptsHTML = req.accepts('text/html');

    if (acceptsHTML) {
        res.send(`
            <h1>Notes Service API</h1>
            <ul>
                <li>GET /notes - Вивести список усіх нотаток</li>
                <li>POST /notes - Створити нову нотатку</li>
                <li>GET /notes/&lt;id&gt; - Вивести повний вміст нотатки</li>
                <li>GET /health/alive - Health check (liveness)</li>
                <li>GET /health/ready - Health check (readiness)</li>
            </ul>
        `);
    } else {
        res.status(406).send('Not Acceptable: Only text/html is supported on this endpoint.');
    }
});

app.get('/notes', async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT id, title FROM notes');

        sendResponse(req, res, rows, (data) => {
            let tableRows = data.map(n => `<tr><td>${n.id}</td><td>${n.title}</td></tr>`).join('');
            return `<table border="1"><tr><th>ID</th><th>Title</th></tr>${tableRows}</table>`;
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error retrieving notes');
    } finally {
        if (conn) conn.release();
    }
});

app.post('/notes', async (req, res) => {
    const { title, content } = req.body;
    if (!title || !content) {
        return res.status(400).send('Title and content are required');
    }

    let conn;
    try {
        conn = await pool.getConnection();
        const result = await conn.query('INSERT INTO notes (title, content) VALUES (?, ?)', [title, content]);

        const newNote = { id: Number(result.insertId), title, content };

        sendResponse(req, res, newNote, (data) => {
            return `<h2>Note created successfully!</h2><p>ID: ${data.id}</p><p>Title: ${data.title}</p>`;
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error creating note');
    } finally {
        if (conn) conn.release();
    }
});

app.get('/notes/:id', async (req, res) => {
    let conn;
    try {
        conn = await pool.getConnection();
        const rows = await conn.query('SELECT id, title, content, created_at FROM notes WHERE id = ?', [req.params.id]);

        if (rows.length === 0) {
            return res.status(404).send('Note not found');
        }

        const note = rows[0];

        sendResponse(req, res, note, (data) => {
            return `
                <table border="1">
                    <tr><th>ID</th><td>${data.id}</td></tr>
                    <tr><th>Title</th><td>${data.title}</td></tr>
                    <tr><th>Created At</th><td>${data.created_at}</td></tr>
                    <tr><th>Content</th><td>${data.content}</td></tr>
                </table>`;
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error retrieving note');
    } finally {
        if (conn) conn.release();
    }
});


app.listen(PORT, '127.0.0.1', () => {
    if (process.env.LISTEN_FDS === '1') {
        app.listen({ fd: 3 }, () => {
            console.log(`[App] Server is running via Systemd Socket Activation`);
            console.log(`[Config] DB Host: ${DB_HOST}, DB User: ${DB_USER}`);
        });
    } else {
        app.listen(PORT, '127.0.0.1', () => {
            console.log(`[App] Server is running on http://127.0.0.1:${PORT}`);
            console.log(`[Config] DB Host: ${DB_HOST}, DB User: ${DB_USER}`);
        });
    }
});