// @ts-nocheck
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const session = require("express-session");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");

const app = express();

// Для работы на Render.com
const PORT = process.env.PORT || 3000;

// Для работы с SQLite на Render (дисковая БД)
// Используем одну инициализацию базы данных
const dbPath = process.env.DATABASE_URL?.replace('sqlite:', '') || './database.sqlite';
const db = new sqlite3.Database(dbPath);

// Настройки базы данных
db.run("PRAGMA encoding = 'UTF-8'");
db.run("PRAGMA case_sensitive_like = OFF");

// ============================================================
// НАСТРОЙКИ MIDDLEWARE
// ============================================================
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));

// Настройка сессий для Render (без secure в http)
app.use(session({
    secret: process.env.SESSION_SECRET || "plastinka-secret-key-2024",
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24,
        secure: false, // Важно для http на Render
        sameSite: 'lax'
    }
}));

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ============================================================
// СОЗДАНИЕ ПАПОК ДЛЯ ЗАГРУЗКИ ФАЙЛОВ
// ============================================================
const uploadDirs = ['public/uploads', 'public/audio', 'public/photo', 'public/avatars'];
uploadDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`📁 Создана папка: ${dir}`);
    }
});

// ============================================================
// НАСТРОЙКА MULTER ДЛЯ ЗАГРУЗКИ ФАЙЛОВ
// ============================================================
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (file.fieldname === "image" || file.fieldname === "product_image") cb(null, "public/uploads/");
        else if (file.fieldname === "player_image") cb(null, "public/photo/");
        else if (file.fieldname === "avatar") cb(null, "public/avatars/");
        else cb(null, "public/audio/");
    },
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// ============================================================
// MIDDLEWARE ДЛЯ ЗАЩИТЫ МАРШРУТОВ
// ============================================================
const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Требуется авторизация' });
        return res.redirect("/login");
    }
    next();
};

const requireAdmin = (req, res, next) => {
    if (!req.session.user) return res.redirect("/login");
    if (req.session.user.role !== "admin") {
        return res.status(403).send(`
<!DOCTYPE html>
<html>
<head><title>Доступ запрещен</title><meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>body{background:#0f0f0f;color:#fff;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;padding:20px;text-align:center}
.error-container{max-width:500px;padding:40px;background:#181818;border-radius:16px;box-shadow:0 0 40px rgba(255,0,0,0.15)}
h1{color:#ff0000;margin-bottom:20px} a{color:#fff;text-decoration:none;padding:10px 20px;background:linear-gradient(45deg,#ff0000,#990000);border-radius:8px;display:inline-block}
a:hover{transform:translateY(-2px);box-shadow:0 10px 20px rgba(255,0,0,0.3)}</style></head>
<body><div class="error-container"><h1>🚫 Доступ запрещен</h1><p>Страница только для администраторов.</p><a href="/">Вернуться на главную</a></div></body></html>
        `);
    }
    next();
};

// Определение мобильного устройства
app.use((req, res, next) => {
    req.isMobile = /mobile|android|iphone|ipad|phone/i.test(req.headers['user-agent'] || '');
    next();
});

// ============================================================
// ИНИЦИАЛИЗАЦИЯ БАЗЫ ДАННЫХ (ТАБЛИЦЫ И ТЕСТОВЫЕ ДАННЫЕ)
// ============================================================
db.serialize(() => {
    // Таблица products (пластинки)
    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        artist TEXT,
        price REAL,
        image TEXT,
        audio TEXT,
        description TEXT,
        genre TEXT,
        year TEXT
    )`);

    // Таблица players (проигрыватели)
    db.run(`CREATE TABLE IF NOT EXISTS players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        price REAL,
        image TEXT,
        description TEXT
    )`);

    // Таблица users (пользователи)
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT DEFAULT 'user',
        avatar TEXT DEFAULT 'default-avatar.png',
        telegram_id INTEGER
    )`);

    // Таблица carts (корзина)
    db.run(`CREATE TABLE IF NOT EXISTS carts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        product_id TEXT,
        quantity INTEGER DEFAULT 1,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE(user_id, product_id)
    )`);

    // Таблица favorites (избранное)
    db.run(`CREATE TABLE IF NOT EXISTS favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        product_id TEXT,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE(user_id, product_id)
    )`);

    // Таблица site_settings (настройки сайта)
    db.run(`CREATE TABLE IF NOT EXISTS site_settings (
        key TEXT PRIMARY KEY,
        value TEXT
    )`);

    // Таблица для рейтинга с комментариями
    db.run(`CREATE TABLE IF NOT EXISTS ratings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        product_id INTEGER,
        rating INTEGER CHECK(rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        admin_reply TEXT,
        admin_reply_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (product_id) REFERENCES products(id),
        UNIQUE(user_id, product_id)
    )`);
    
    console.log("⭐ Таблица рейтинга с комментариями создана");

    // Добавление настроек главной страницы по умолчанию
    db.get("SELECT COUNT(*) as count FROM site_settings WHERE key = 'homepage_products'", [], (err, result) => {
        if (!err && result.count === 0) {
            db.run("INSERT INTO site_settings (key, value) VALUES (?, ?)", ['homepage_products', 'last_added']);
            console.log("⚙️ Добавлены настройки сайта");
        }
    });

    // Добавление тестовых проигрывателей
    db.get("SELECT COUNT(*) as count FROM players", [], (err, result) => {
        if (!err && result.count === 0) {
            const players = [
                ['Pro-Ject Debut Carbon', 499, 'proigrvatel1.png', 'Высококачественный проигрыватель винила с углеволокновым тонармом. Обеспечивает чистое и детальное звучание.'],
                ['Audio-Technica AT-LP120', 299, 'proigrvatel2.png', 'Профессиональный проигрыватель с прямым приводом. Идеален для диджеев и аудиофилов.'],
                ['Rega Planar 3', 899, 'proigrvatel3.png', 'Легендарный британский проигрыватель. Ручная сборка, высокое качество звучания.']
            ];
            const stmt = db.prepare("INSERT INTO players (name, price, image, description) VALUES (?, ?, ?, ?)");
            players.forEach(p => stmt.run(p));
            stmt.finalize();
            console.log("🎵 Добавлены тестовые проигрыватели");
        }
    });

    // Добавление тестовых пластинок
    db.get("SELECT COUNT(*) as count FROM products", [], (err, result) => {
        if (!err && result.count === 0) {
            const products = [
                ['Dark Side of the Moon', 'Pink Floyd', 35, 'dark-side.png', 'dark-side.mp3', 'Легендарный альбом', 'Rock', '1973'],
                ['Abbey Road', 'The Beatles', 40, 'abbey-road.png', 'abbey-road.mp3', 'Последний записанный альбом', 'Rock', '1969'],
                ['Thriller', 'Michael Jackson', 45, 'thriller.png', 'thriller.mp3', 'Самый продаваемый альбом', 'Pop', '1982']
            ];
            const stmt = db.prepare("INSERT INTO products (name, artist, price, image, audio, description, genre, year) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
            products.forEach(p => stmt.run(p));
            stmt.finalize();
            console.log("📀 Добавлены тестовые пластинки");
        }
    });

    // Создание администратора
    db.get("SELECT COUNT(*) as count FROM users", [], (err, result) => {
        if (!err && result.count === 0) {
            const hash = bcrypt.hashSync("admin123", 10);
            db.run("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", ["admin", hash, "admin"]);
            console.log("👤 Создан пользователь admin с паролем admin123");
        }
    });
});

// ============================================================
// ЗДЕСЬ ВСТАВЬТЕ ВСЕ ВАШИ МАРШРУТЫ ИЗ ОРИГИНАЛЬНОГО ФАЙЛА
// (routes, API, catalog, cart, profile, admin, home и т.д.)
// ============================================================

// Простой маршрут для проверки работы
app.get("/", (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Plastinka</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {
                    background: linear-gradient(135deg, #0a0a0a 0%, #0f0f0f 100%);
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    color: #fff;
                    min-height: 100vh;
                    margin: 0;
                    padding: 0;
                }
                .container {
                    text-align: center;
                    padding: 50px 20px;
                }
                h1 {
                    font-size: 48px;
                    background: linear-gradient(135deg, #fff, #ff4444);
                    -webkit-background-clip: text;
                    background-clip: text;
                    color: transparent;
                    margin-bottom: 20px;
                }
                .buttons {
                    display: flex;
                    gap: 20px;
                    justify-content: center;
                    flex-wrap: wrap;
                    margin-top: 30px;
                }
                .btn {
                    padding: 12px 24px;
                    border-radius: 8px;
                    text-decoration: none;
                    font-weight: bold;
                    transition: all 0.3s;
                }
                .btn-primary {
                    background: linear-gradient(45deg, #ff0000, #990000);
                    color: white;
                }
                .btn-secondary {
                    background: #333;
                    color: white;
                }
                .btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 5px 15px rgba(255,0,0,0.3);
                }
                .status {
                    background: #1a1a1a;
                    padding: 20px;
                    border-radius: 12px;
                    margin-top: 40px;
                    display: inline-block;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🎵 Plastinka</h1>
                <p>Интернет-магазин виниловых пластинок</p>
                <div class="buttons">
                    <a href="/catalog" class="btn btn-primary">📀 Каталог</a>
                    <a href="/login" class="btn btn-secondary">🔐 Войти</a>
                    <a href="/register" class="btn btn-secondary">📝 Регистрация</a>
                </div>
                <div class="status">
                    ✅ Сервер работает!<br>
                    🚀 Render.com deployment successful
                </div>
            </div>
        </body>
        </html>
    `);
});

// Health check endpoint для Render
app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// ============================================================
// ЗАПУСК СЕРВЕРА
// ============================================================
app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`🌐 Локальный адрес: http://localhost:${PORT}`);
    console.log(`👤 Админ: admin / admin123`);
    console.log(`⭐ Система рейтинга из 5 звёзд с комментариями активна!`);
    console.log(`📁 База данных: ${dbPath}`);
});