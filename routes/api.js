const express = require("express");
const router = express.Router();

module.exports = (db, requireAuth, requireAdmin, upload, escapeHtml) => {
    
    // API для аватарки
    router.post("/upload-avatar", requireAuth, upload.single("avatar"), (req, res) => {
        if (!req.file) {
            return res.status(400).json({ error: "Файл не загружен" });
        }
        const avatarUrl = `/avatars/${req.file.filename}`;
        db.run("UPDATE users SET avatar = ? WHERE id = ?", [req.file.filename, req.session.user.id], (err) => {
            if (err) {
                return res.status(500).json({ error: "Ошибка сохранения аватара" });
            }
            req.session.user.avatar = req.file.filename;
            res.json({ success: true, avatar: avatarUrl });
        });
    });

    // API для избранного
    router.get("/favorites/status/:productId", requireAuth, (req, res) => {
        const productId = req.params.productId;
        const userId = req.session.user.id;
        
        db.get("SELECT 1 FROM favorites WHERE user_id = ? AND product_id = ?", 
            [userId, productId], 
            (err, fav) => {
                if (err) {
                    console.error("Ошибка проверки избранного:", err);
                    return res.json({ isFavorite: false });
                }
                res.json({ isFavorite: !!fav });
            });
    });

    router.get("/favorites/check/:productId", requireAuth, (req, res) => {
        const productId = req.params.productId;
        const userId = req.session.user.id;
        
        db.get("SELECT 1 FROM favorites WHERE user_id = ? AND product_id = ?", 
            [userId, productId], 
            (err, fav) => {
                if (err) {
                    console.error("Ошибка проверки избранного:", err);
                    return res.json({ isFavorite: false });
                }
                res.json({ isFavorite: !!fav });
            });
    });

    router.get("/favorites/count", requireAuth, (req, res) => {
        db.get("SELECT COUNT(*) as count FROM favorites WHERE user_id = ?", [req.session.user.id], (err, result) => {
            if (err) {
                return res.json({ count: 0 });
            }
            res.json({ count: result?.count || 0 });
        });
    });

    router.get("/favorites/list", requireAuth, (req, res) => {
        const userId = req.session.user.id;
        
        db.all(`
            SELECT f.*, p.name, p.artist, p.price, p.image, p.id as product_db_id
            FROM favorites f
            JOIN products p ON f.product_id = 'product_' || p.id
            WHERE f.user_id = ?
            ORDER BY f.added_at DESC
        `, [userId], (err, products) => {
            if (err) {
                console.error("Ошибка получения избранного:", err);
                return res.json({ success: false, favorites: [] });
            }
            
            db.all(`
                SELECT f.*, p.name, p.price, p.image, p.id as player_db_id
                FROM favorites f
                JOIN players p ON f.product_id = 'player_' || p.id
                WHERE f.user_id = ?
                ORDER BY f.added_at DESC
            `, [userId], (err2, players) => {
                if (err2) {
                    console.error("Ошибка получения избранных проигрывателей:", err2);
                }
                
                const allFavorites = [];
                
                if (products) {
                    products.forEach(p => {
                        allFavorites.push({
                            id: p.product_db_id,
                            type: 'product',
                            name: p.name,
                            artist: p.artist,
                            price: p.price,
                            image: p.image,
                            added_at: p.added_at
                        });
                    });
                }
                
                if (players) {
                    players.forEach(p => {
                        allFavorites.push({
                            id: p.player_db_id,
                            type: 'player',
                            name: p.name,
                            artist: 'Проигрыватель',
                            price: p.price,
                            image: p.image,
                            added_at: p.added_at
                        });
                    });
                }
                
                allFavorites.sort((a, b) => new Date(b.added_at) - new Date(a.added_at));
                
                res.json({ success: true, favorites: allFavorites });
            });
        });
    });

    router.post("/favorites/remove", requireAuth, (req, res) => {
        const userId = req.session.user.id;
        const { productId, type } = req.body;
        
        const fullProductId = type === 'product' ? `product_${productId}` : `player_${productId}`;
        
        db.run("DELETE FROM favorites WHERE user_id = ? AND product_id = ?", [userId, fullProductId], function(err) {
            if (err) {
                console.error("Ошибка удаления из избранного:", err);
                return res.json({ success: false, error: "Ошибка удаления" });
            }
            res.json({ success: true });
        });
    });

    router.post("/favorites/toggle", requireAuth, express.json(), (req, res) => {
        const { id } = req.body;
        const userId = req.session.user.id;
        
        if (!id) {
            return res.status(400).json({ error: "ID товара не указан" });
        }
        
        db.get("SELECT * FROM favorites WHERE user_id = ? AND product_id = ?", 
            [userId, id], 
            (err, fav) => {
                if (err) {
                    console.error("Ошибка проверки избранного:", err);
                    return res.status(500).json({ error: "Ошибка базы данных" });
                }
                
                if (fav) {
                    db.run("DELETE FROM favorites WHERE user_id = ? AND product_id = ?", 
                        [userId, id], 
                        function(err) {
                            if (err) {
                                console.error("Ошибка удаления из избранного:", err);
                                return res.status(500).json({ error: "Ошибка удаления" });
                            }
                            res.json({ success: true, action: "removed" });
                        });
                } else {
                    db.run("INSERT INTO favorites (user_id, product_id) VALUES (?, ?)", 
                        [userId, id], 
                        function(err) {
                            if (err) {
                                console.error("Ошибка добавления в избранное:", err);
                                return res.status(500).json({ error: "Ошибка добавления" });
                            }
                            res.json({ success: true, action: "added" });
                        });
                }
            });
    });

    // API для аватара
    router.get("/user-avatar", requireAuth, (req, res) => {
        db.get("SELECT avatar FROM users WHERE id = ?", [req.session.user.id], (err, user) => {
            if (err || !user) {
                return res.json({ avatar: "/avatars/default-avatar.png" });
            }
            res.json({ avatar: `/avatars/${user.avatar || 'default-avatar.png'}` });
        });
    });

    // Обновление профиля
    const bcrypt = require("bcryptjs");
    router.post("/update-profile", requireAuth, express.json(), (req, res) => {
        const { username, currentPassword, newPassword } = req.body;
        const userId = req.session.user.id;
        
        db.get("SELECT * FROM users WHERE id = ?", [userId], (err, user) => {
            if (err || !user) {
                return res.status(404).json({ error: "Пользователь не найден" });
            }
            
            if (username && username !== user.username) {
                db.get("SELECT id FROM users WHERE username = ? AND id != ?", [username, userId], (err, existing) => {
                    if (existing) {
                        return res.json({ success: false, error: "Имя пользователя уже занято" });
                    }
                    updateUser();
                });
            } else {
                updateUser();
            }
            
            function updateUser() {
                let updateQuery = "UPDATE users SET username = ? WHERE id = ?";
                let params = [username || user.username, userId];
                
                if (currentPassword && newPassword) {
                    if (bcrypt.compareSync(currentPassword, user.password)) {
                        const hashedPassword = bcrypt.hashSync(newPassword, 10);
                        updateQuery = "UPDATE users SET username = ?, password = ? WHERE id = ?";
                        params = [username || user.username, hashedPassword, userId];
                    } else {
                        return res.json({ success: false, error: "Неверный текущий пароль" });
                    }
                }
                
                db.run(updateQuery, params, function(err) {
                    if (err) {
                        return res.json({ success: false, error: "Ошибка обновления" });
                    }
                    req.session.user.username = username || user.username;
                    res.json({ success: true, username: req.session.user.username });
                });
            }
        });
    });

    // API для рейтинга
    router.get("/rating/:productId", (req, res) => {
        const productId = req.params.productId;
        
        db.get(`SELECT 
                    AVG(rating) as avg_rating, 
                    COUNT(*) as votes_count 
                FROM ratings 
                WHERE product_id = ?`, 
            [productId], 
            (err, result) => {
                if (err) {
                    console.error("Ошибка получения рейтинга:", err);
                    return res.json({ avg_rating: 0, votes_count: 0, comments: [] });
                }
                
                db.all(`SELECT r.rating, r.comment, r.created_at, u.username 
                        FROM ratings r
                        JOIN users u ON r.user_id = u.id
                        WHERE r.product_id = ? AND r.comment IS NOT NULL AND r.comment != ''
                        ORDER BY r.created_at DESC
                        LIMIT 10`, 
                    [productId],
                    (err2, comments) => {
                        res.json({
                            avg_rating: result?.avg_rating ? parseFloat(result.avg_rating).toFixed(1) : 0,
                            votes_count: result?.votes_count || 0,
                            comments: comments || []
                        });
                    });
            });
    });

    router.get("/rating/user/:productId", requireAuth, (req, res) => {
        const productId = req.params.productId;
        const userId = req.session.user.id;
        
        db.get(`SELECT rating, comment FROM ratings WHERE user_id = ? AND product_id = ?`, 
            [userId, productId], 
            (err, result) => {
                if (err) {
                    return res.json({ user_rating: null, user_comment: null });
                }
                res.json({ user_rating: result?.rating || null, user_comment: result?.comment || null });
            });
    });

    router.post("/rating/:productId", requireAuth, express.json(), (req, res) => {
        const productId = req.params.productId;
        const userId = req.session.user.id;
        const { rating, comment } = req.body;
        
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ error: "Оценка должна быть от 1 до 5" });
        }
        
        db.get("SELECT id FROM products WHERE id = ?", [productId], (err, product) => {
            if (err || !product) {
                return res.status(404).json({ error: "Товар не найден" });
            }
            
            db.run(`INSERT INTO ratings (user_id, product_id, rating, comment, updated_at) 
                    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT(user_id, product_id) 
                    DO UPDATE SET rating = ?, comment = ?, updated_at = CURRENT_TIMESTAMP`,
                [userId, productId, rating, comment || null, rating, comment || null],
                function(err) {
                    if (err) {
                        console.error("Ошибка сохранения оценки:", err);
                        return res.status(500).json({ error: "Ошибка сохранения оценки" });
                    }
                    
                    db.get(`SELECT AVG(rating) as avg_rating, COUNT(*) as votes_count 
                            FROM ratings WHERE product_id = ?`, 
                        [productId], 
                        (err, result) => {
                            db.all(`SELECT r.rating, r.comment, r.created_at, u.username 
                                    FROM ratings r
                                    JOIN users u ON r.user_id = u.id
                                    WHERE r.product_id = ? AND r.comment IS NOT NULL AND r.comment != ''
                                    ORDER BY r.created_at DESC
                                    LIMIT 10`, 
                                [productId],
                                (err2, comments) => {
                                    res.json({
                                        success: true,
                                        avg_rating: result?.avg_rating ? parseFloat(result.avg_rating).toFixed(1) : 0,
                                        votes_count: result?.votes_count || 0,
                                        comments: comments || []
                                    });
                                });
                        });
                });
        });
    });

    // Поиск
    router.get("/search", (req, res) => {
        const query = req.query.q || '';
        console.log('🔍 Поисковый запрос:', query);
        
        if (query.length < 1) {
            return res.json({ results: [] });
        }
        
        const searchPattern = `*${query}*`;
        
        db.all(`SELECT id, name, artist, price, image, audio, description, genre, year, 'product' as type 
                FROM products 
                WHERE name GLOB ? OR artist GLOB ? 
                LIMIT 10`, 
            [searchPattern, searchPattern], 
            (err, products) => {
                if (err) products = [];
                
                db.all(`SELECT id, name, 'Проигрыватель' as artist, price, image, description, 'player' as type 
                        FROM players 
                        WHERE name GLOB ? 
                        LIMIT 5`,
                    [searchPattern],
                    (err2, players) => {
                        if (err2) players = [];
                        const results = [...products, ...players];
                        res.json({ results: results });
                    });
            });
    });

    // Telegram авторизация
    const bcryptTelegram = require("bcryptjs");
    router.post("/telegram-auth", express.json(), (req, res) => {
        const { id, first_name, last_name, username, photo_url } = req.body;
        
        if (!id) {
            return res.json({ success: false, error: "No telegram id" });
        }
        
        db.get("SELECT * FROM users WHERE telegram_id = ?", [id], (err, user) => {
            if (err) {
                return res.json({ success: false, error: err.message });
            }
            
            if (user) {
                req.session.user = { 
                    id: user.id, 
                    username: user.username, 
                    role: user.role, 
                    avatar: user.avatar,
                    telegram_id: id
                };
                res.json({ success: true, isNew: false });
            } else {
                const newUsername = username || `tg_user_${id}`;
                const defaultPassword = Math.random().toString(36).substring(2, 15);
                const hash = bcryptTelegram.hashSync(defaultPassword, 10);
                
                const avatarFile = photo_url ? null : 'default-avatar.png';
                
                db.run(
                    "INSERT INTO users (username, password, role, telegram_id, avatar) VALUES (?, ?, 'user', ?, ?)",
                    [newUsername, hash, id, avatarFile || 'default-avatar.png'],
                    function(err) {
                        if (err) {
                            console.error("Ошибка регистрации Telegram пользователя:", err);
                            return res.json({ success: false, error: err.message });
                        }
                        
                        req.session.user = { 
                            id: this.lastID, 
                            username: newUsername, 
                            role: 'user', 
                            avatar: avatarFile || 'default-avatar.png',
                            telegram_id: id
                        };
                        res.json({ success: true, isNew: true });
                    }
                );
            }
        });
    });

    return router;
};