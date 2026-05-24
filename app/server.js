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

// TODO: Реалізувати GET /notes
// TODO: Реалізувати POST /notes
// TODO: Реалізувати GET /notes/:id


app.listen(PORT, '127.0.0.1', () => {
    console.log(`[App] Server is running on http://127.0.0.1:${PORT}`);
    console.log(`[Config] DB Host: ${DB_HOST}, DB User: ${DB_USER}`);
});