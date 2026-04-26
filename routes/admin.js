const express = require("express");
const router = express.Router();

module.exports = (db, requireAdmin, upload, escapeHtml, bcrypt) => {
    
    // Главная админ панель
    router.get("/admin", requireAdmin, async (req, res) => {
        try {
            const products = await new Promise((resolve) => {
                db.all("SELECT * FROM products ORDER BY id DESC", [], (err, data) => resolve(data || []));
            });
            
            const players = await new Promise((resolve) => {
                db.all("SELECT * FROM players ORDER BY id DESC", [], (err, data) => resolve(data || []));
            });
            
            const users = await new Promise((resolve) => {
                db.all("SELECT id, username, role, avatar FROM users ORDER BY id DESC", [], (err, data) => resolve(data || []));
            });
            
            let productsRows = '';
            for (const p of products) {
                const rating = await new Promise((resolve) => {
                    db.get("SELECT AVG(rating) as avg_rating, COUNT(*) as votes_count FROM ratings WHERE product_id = ?", [p.id], (err, data) => {
                        resolve(data || { avg_rating: 0, votes_count: 0 });
                    });
                });
                const avgRating = rating.avg_rating ? parseFloat(rating.avg_rating).toFixed(1) : 0;
                
                productsRows += '<tr>' +
                    '<td><span class="badge product">📀 Пластинка</span></td>' +
                    '<td><img src="/uploads/' + escapeHtml(p.image) + '" class="table-img" style="width:50px;height:50px;object-fit:cover;border-radius:8px;" onerror="this.src=\'/photo/plastinka-audio.png\'"></td>' +
                    '<td><strong>' + escapeHtml(p.name) + '</strong></td>' +
                    '<td>' + escapeHtml(p.artist) + '</td>' +
                    '<td>' + escapeHtml(p.genre || '-') + '</td>' +
                    '<td>' + escapeHtml(p.year || '-') + '</td>' +
                    '<td>$' + p.price + '</td>' +
                    '<td>' + generateRatingStars(avgRating, rating.votes_count) + '</td>' +
                    '<td class="actions"><button class="edit-product" data-id="' + p.id + '"><i class="fas fa-edit"></i></button>' +
                    '<button class="delete-product" data-id="' + p.id + '"><i class="fas fa-trash"></i></button></td>' +
                '</tr>';
            }
            
            let playersRows = '';
            for (const p of players) {
                playersRows += '<tr>' +
                    '<td><span class="badge player">🎵 Проигрыватель</span></td>' +
                    '<td><img src="/photo/' + escapeHtml(p.image) + '" class="table-img" style="width:50px;height:50px;object-fit:cover;border-radius:8px;" onerror="this.src=\'/photo/logo.svg\'"></td>' +
                    '<td><strong>' + escapeHtml(p.name) + '</strong></td>' +
                    '<td>' + (escapeHtml(p.description) || 'Нет описания') + '</td>' +
                    '<td>$' + p.price + '</td>' +
                    '<td class="actions"><button class="edit-player" data-id="' + p.id + '"><i class="fas fa-edit"></i></button>' +
                    '<button class="delete-player" data-id="' + p.id + '"><i class="fas fa-trash"></i></button></td>' +
                '</tr>';
            }
            
            let usersRows = '';
            for (const u of users) {
                const reviewsCount = await new Promise((resolve) => {
                    db.get("SELECT COUNT(*) as count FROM ratings WHERE user_id = ?", [u.id], (err, data) => resolve(data?.count || 0));
                });
                const favoritesCount = await new Promise((resolve) => {
                    db.get("SELECT COUNT(*) as count FROM favorites WHERE user_id = ?", [u.id], (err, data) => resolve(data?.count || 0));
                });
                const cartCount = await new Promise((resolve) => {
                    db.get("SELECT SUM(quantity) as total FROM carts WHERE user_id = ?", [u.id], (err, data) => resolve(data?.total || 0));
                });
                
                usersRows += '<tr>' +
                    '<td><img src="/avatars/' + escapeHtml(u.avatar || 'default-avatar.png') + '" class="user-avatar-sm" style="width:40px;height:40px;border-radius:50%;object-fit:cover;" onerror="this.src=\'/avatars/default-avatar.png\'"></td>' +
                    '<td><strong>' + escapeHtml(u.username) + '</strong></td>' +
                    '<td><span class="badge ' + (u.role === 'admin' ? 'admin' : 'user') + '">' + (u.role === 'admin' ? '👑 Админ' : '👤 Пользователь') + '</span></td>' +
                    '<td><button class="reviews-btn" data-id="' + u.id + '" data-name="' + escapeHtml(u.username) + '"><i class="fas fa-star"></i> ' + reviewsCount + '</button></td>' +
                    '<td><button class="favorites-btn" data-id="' + u.id + '"><i class="fas fa-heart"></i> ' + favoritesCount + '</button></td>' +
                    '<td><button class="cart-btn" data-id="' + u.id + '"><i class="fas fa-shopping-cart"></i> ' + cartCount + '</button></td>' +
                    '<td class="actions"><button class="edit-user" data-id="' + u.id + '" data-name="' + escapeHtml(u.username) + '" data-role="' + u.role + '"><i class="fas fa-edit"></i></button>' +
                    (u.username !== 'admin' ? '<button class="delete-user" data-id="' + u.id + '"><i class="fas fa-trash"></i></button>' : '') + '</td>' +
                '</tr>';
            }
            
            res.send(adminPanelHTML(products.length, players.length, users.length, productsRows, playersRows, usersRows, escapeHtml(req.session.user.username)));
        } catch (error) {
            console.error('Admin panel error:', error);
            res.status(500).send('Ошибка загрузки админ панели');
        }
    });

    // Настройки главной страницы
    router.get("/admin/settings", requireAdmin, (req, res) => {
        db.get("SELECT value FROM site_settings WHERE key = 'homepage_products'", [], (err, setting) => {
            const currentMode = setting ? setting.value : 'last_added';
            res.send(`
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Настройки главной страницы</title><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
<style>
*{margin:0;padding:0;box-sizing:border-box;}body{background:linear-gradient(135deg,#0a0a0a 0%,#0f0f0f 100%);min-height:100vh;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#fff;}
.settings-container{max-width:700px;margin:60px auto;padding:0 20px;}.settings-card{background:rgba(24,24,24,0.95);backdrop-filter:blur(10px);border-radius:24px;border:1px solid rgba(255,0,0,0.2);overflow:hidden;}
.settings-header{background:linear-gradient(135deg,#1a1a1a 0%,#0f0f0f 100%);padding:32px;border-bottom:1px solid rgba(255,0,0,0.2);position:relative;}
.settings-header::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#ff0000,#ff4444,#ff0000);}
.settings-header h1{font-size:28px;font-weight:700;background:linear-gradient(135deg,#fff 0%,#ff4444 100%);-webkit-background-clip:text;background-clip:text;color:transparent;margin-bottom:8px;}
.settings-header p{color:#888;font-size:14px;}
.settings-body{padding:32px;}
.setting-option{background:#0a0a0a;border:1px solid #333;border-radius:16px;padding:20px;margin-bottom:16px;cursor:pointer;transition:all 0.2s ease;}
.setting-option:hover{border-color:#ff0000;transform:translateX(5px);}
.setting-option.selected{border-color:#ff0000;background:rgba(255,0,0,0.05);}
.setting-option input[type="radio"]{display:none;}
.setting-option label{display:flex;align-items:center;gap:15px;cursor:pointer;}
.option-icon{width:50px;height:50px;border-radius:12px;background:rgba(255,0,0,0.1);display:flex;align-items:center;justify-content:center;font-size:24px;color:#ff0000;}
.option-content{flex:1;}
.option-title{font-size:18px;font-weight:bold;margin-bottom:5px;}
.option-desc{font-size:13px;color:#888;}
.save-btn{width:100%;padding:16px;background:linear-gradient(135deg,#ff0000,#cc0000);border:none;border-radius:14px;color:white;font-size:16px;font-weight:bold;cursor:pointer;margin-top:20px;transition:0.2s;}
.save-btn:hover{transform:translateY(-2px);box-shadow:0 10px 25px rgba(255,0,0,0.3);}
.back-link{display:inline-block;margin-top:20px;color:#aaa;text-decoration:none;text-align:center;width:100%;}
.back-link:hover{color:#ff0000;}
.success-message{background:rgba(76,175,80,0.1);border:1px solid #4CAF50;color:#4CAF50;padding:12px;border-radius:8px;margin-bottom:20px;text-align:center;}
.admin-nav{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;padding:10px 20px;background:rgba(0,0,0,0.5);border-radius:12px;}
.back-to-site{color:#ff0000;text-decoration:none;display:inline-flex;align-items:center;gap:8px;}
@media(max-width:600px){.settings-container{margin:20px auto;}.settings-header{padding:24px;}.settings-header h1{font-size:24px;}.settings-body{padding:24px;}}
</style>
</head>
<body><div class="settings-container"><div class="admin-nav"><a href="/admin" class="back-to-site"><i class="fas fa-arrow-left"></i> ← Вернуться в админ-панель</a><a href="/" class="back-to-site"><i class="fas fa-home"></i> На сайт</a></div><div class="settings-card"><div class="settings-header"><h1><i class="fas fa-sliders-h"></i> Настройка главной страницы</h1><p>Выберите, какие пластинки отображать на главной</p></div><div class="settings-body">${req.query.saved ? '<div class="success-message"><i class="fas fa-check-circle"></i> Настройки сохранены!</div>' : ''}<form action="/admin/settings" method="POST"><div class="setting-option ${currentMode === 'last_added' ? 'selected' : ''}"><input type="radio" name="homepage_products" value="last_added" id="last_added" ${currentMode === 'last_added' ? 'checked' : ''}><label for="last_added"><div class="option-icon"><i class="fas fa-clock"></i></div><div class="option-content"><div class="option-title">Последние добавленные</div><div class="option-desc">Показывать 6 последних добавленных пластинок</div></div></label></div><div class="setting-option ${currentMode === 'popular' ? 'selected' : ''}"><input type="radio" name="homepage_products" value="popular" id="popular" ${currentMode === 'popular' ? 'checked' : ''}><label for="popular"><div class="option-icon"><i class="fas fa-fire"></i></div><div class="option-content"><div class="option-title">Популярные</div><div class="option-desc">Показывать самые популярные пластинки</div></div></label></div><div class="setting-option ${currentMode === 'all' ? 'selected' : ''}"><input type="radio" name="homepage_products" value="all" id="all" ${currentMode === 'all' ? 'checked' : ''}><label for="all"><div class="option-icon"><i class="fas fa-list"></i></div><div class="option-content"><div class="option-title">Все пластинки</div><div class="option-desc">Показывать все пластинки (до 12 штук)</div></div></label></div><button type="submit" class="save-btn"><i class="fas fa-save"></i> Сохранить настройки</button></form><a href="/admin" class="back-link"><i class="fas fa-arrow-left"></i> Вернуться в админ панель</a></div></div></div></body></html>
            `);
        });
    });

    router.post("/admin/settings", requireAdmin, (req, res) => {
        const { homepage_products } = req.body;
        db.run("INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)", ['homepage_products', homepage_products], (err) => {
            if (err) console.error("Ошибка сохранения настроек:", err);
            res.redirect("/admin/settings?saved=1");
        });
    });

    // API для админ панели
    router.post("/admin/get-item", requireAdmin, express.json(), (req, res) => {
        const { type, id } = req.body;
        const table = type === 'product' ? 'products' : 'players';
        db.get("SELECT * FROM " + table + " WHERE id = ?", [id], (err, item) => {
            res.json(item || {});
        });
    });

    router.post("/admin/save-item", requireAdmin, upload.fields([{ name: 'image' }, { name: 'audio' }]), (req, res) => {
        const { type, id, name, artist, genre, year, price, description } = req.body;
        const imageFile = req.files?.image?.[0];
        const audioFile = req.files?.audio?.[0];
        
        if (type === 'product') {
            if (id && id !== '' && id !== 'undefined') {
                let query = "UPDATE products SET name=?, artist=?, price=?, description=?, genre=?, year=?";
                let params = [name, artist, parseFloat(price), description || '', genre || '', year || ''];
                if (imageFile) { query += ", image=?"; params.push(imageFile.filename); }
                if (audioFile) { query += ", audio=?"; params.push(audioFile.filename); }
                query += " WHERE id=?";
                params.push(parseInt(id));
                db.run(query, params, (err) => res.json({ success: !err }));
            } else {
                db.run("INSERT INTO products (name, artist, price, image, audio, description, genre, year) VALUES (?,?,?,?,?,?,?,?)",
                    [name, artist, parseFloat(price), imageFile?.filename || null, audioFile?.filename || null, description || '', genre || '', year || ''],
                    (err) => res.json({ success: !err }));
            }
        } else {
            if (id && id !== '' && id !== 'undefined') {
                let query = "UPDATE players SET name=?, price=?, description=?";
                let params = [name, parseFloat(price), description || ''];
                if (imageFile) { query += ", image=?"; params.push(imageFile.filename); }
                query += " WHERE id=?";
                params.push(parseInt(id));
                db.run(query, params, (err) => res.json({ success: !err }));
            } else {
                db.run("INSERT INTO players (name, price, image, description) VALUES (?,?,?,?)",
                    [name, parseFloat(price), imageFile?.filename || null, description || ''],
                    (err) => res.json({ success: !err }));
            }
        }
    });

    router.post("/admin/delete-item", requireAdmin, express.json(), (req, res) => {
        const { type, id } = req.body;
        const table = type === 'product' ? 'products' : 'players';
        db.run("DELETE FROM " + table + " WHERE id=?", [id], (err) => res.json({ success: !err }));
    });

    router.post("/admin/update-user", requireAdmin, express.json(), (req, res) => {
        const { id, username, role, password } = req.body;
        if (password && password.trim()) {
            const hashedPassword = bcrypt.hashSync(password, 10);
            db.run("UPDATE users SET username=?, role=?, password=? WHERE id=?", [username, role, hashedPassword, id], (err) => res.json({ success: !err }));
        } else {
            db.run("UPDATE users SET username=?, role=? WHERE id=?", [username, role, id], (err) => res.json({ success: !err }));
        }
    });

    router.post("/admin/delete-user", requireAdmin, express.json(), (req, res) => {
        const { id } = req.body;
        db.run("DELETE FROM users WHERE id=? AND username!='admin'", [id], (err) => res.json({ success: !err }));
    });

    router.post("/admin/send-review-reply", requireAdmin, express.json(), (req, res) => {
        const { reviewId, productId, userId, reply } = req.body;
        db.run("UPDATE ratings SET admin_reply = ?, admin_reply_at = CURRENT_TIMESTAMP WHERE id = ?", [reply, reviewId], (err) => {
            if (err) {
                console.error('Error saving reply:', err);
                return res.json({ success: false });
            }
            res.json({ success: true });
        });
    });

    router.get("/admin/user-reviews/:userId", requireAdmin, (req, res) => {
        db.all("SELECT r.*, p.name as product_name, p.artist as product_artist, p.image as product_image FROM ratings r JOIN products p ON r.product_id=p.id WHERE r.user_id=? ORDER BY r.created_at DESC", [req.params.userId], (err, rows) => {
            res.json(rows || []);
        });
    });

    router.get("/admin/user-favorites/:userId", requireAdmin, async (req, res) => {
        db.all("SELECT f.*, f.added_at FROM favorites f WHERE f.user_id=?", [req.params.userId], async (err, favs) => {
            if (!favs || favs.length === 0) return res.json([]);
            const items = [];
            for (const fav of favs) {
                const productId = fav.product_id;
                if (productId.startsWith('product_')) {
                    const id = productId.replace('product_', '');
                    const product = await new Promise(resolve => db.get("SELECT name, artist, price, image FROM products WHERE id=?", [id], (err, data) => resolve(data)));
                    if (product) items.push({ ...fav, type: 'product', name: product.name, artist: product.artist, price: product.price, image: product.image });
                } else if (productId.startsWith('player_')) {
                    const id = productId.replace('player_', '');
                    const player = await new Promise(resolve => db.get("SELECT name, price, image FROM players WHERE id=?", [id], (err, data) => resolve(data)));
                    if (player) items.push({ ...fav, type: 'player', name: player.name, artist: 'Проигрыватель', price: player.price, image: player.image });
                }
            }
            res.json(items);
        });
    });

    router.get("/admin/user-cart/:userId", requireAdmin, async (req, res) => {
        db.all("SELECT * FROM carts WHERE user_id=?", [req.params.userId], async (err, carts) => {
            if (!carts || carts.length === 0) return res.json({ items: [] });
            const items = [];
            for (const cart of carts) {
                const productId = cart.product_id;
                if (productId.startsWith('product_')) {
                    const id = productId.replace('product_', '');
                    const product = await new Promise(resolve => db.get("SELECT name, artist, price, image FROM products WHERE id=?", [id], (err, data) => resolve(data)));
                    if (product) items.push({ ...cart, type: 'product', name: product.name, artist: product.artist, price: product.price, image: product.image });
                } else if (productId.startsWith('player_')) {
                    const id = productId.replace('player_', '');
                    const player = await new Promise(resolve => db.get("SELECT name, price, image FROM players WHERE id=?", [id], (err, data) => resolve(data)));
                    if (player) items.push({ ...cart, type: 'player', name: player.name, artist: 'Проигрыватель', price: player.price, image: player.image });
                }
            }
            res.json({ items });
        });
    });

    function generateRatingStars(rating, votesCount) {
        const fullStars = Math.floor(rating);
        let starsHtml = '';
        for (let i = 1; i <= 5; i++) {
            if (i <= fullStars) {
                starsHtml += '<i class="fas fa-star" style="color:#ff7a2f; font-size:12px;"></i>';
            } else {
                starsHtml += '<i class="far fa-star" style="color:#555; font-size:12px;"></i>';
            }
        }
        return '<div style="display:flex;align-items:center;gap:4px;">' + starsHtml + '<span style="font-size:11px;">' + rating + '</span><span style="font-size:10px;">(' + votesCount + ')</span></div>';
    }

    function adminPanelHTML(productCount, playerCount, userCount, productsRows, playersRows, usersRows, username) {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Админ панель · Plastinka</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: linear-gradient(135deg, #0a0a0a 0%, #0f0f0f 100%); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #fff; min-height: 100vh; }
        .admin-wrapper { max-width: 1400px; margin: 0 auto; padding: 20px; }
        .admin-header { background: rgba(24,24,24,0.95); border-radius: 20px; padding: 20px 30px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; border: 1px solid rgba(255,0,0,0.2); flex-wrap: wrap; gap: 15px; }
        .header-left h1 { font-size: 28px; background: linear-gradient(135deg, #fff, #ff4444); -webkit-background-clip: text; background-clip: text; color: transparent; }
        .header-left p { color: #888; font-size: 14px; margin-top: 5px; }
        .header-right { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }
        .admin-user { display: flex; align-items: center; gap: 10px; background: rgba(255,0,0,0.1); padding: 8px 16px; border-radius: 40px; }
        .logout-link { color: #ff4444; text-decoration: none; display: flex; align-items: center; gap: 8px; transition: 0.2s; padding: 8px 12px; border-radius: 8px; }
        .logout-link:hover { background: rgba(255,68,68,0.1); color: #ff0000; }
        .home-link { color: #4CAF50; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat-card { background: rgba(24,24,24,0.9); border-radius: 16px; padding: 20px; border: 1px solid rgba(255,0,0,0.15); transition: 0.2s; text-align: center; }
        .stat-card:hover { border-color: #ff0000; transform: translateY(-2px); }
        .stat-value { font-size: 32px; font-weight: 700; color: #ff4444; }
        .stat-label { color: #888; margin-top: 5px; }
        .tabs { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
        .tab-btn { background: rgba(24,24,24,0.9); border: 1px solid rgba(255,0,0,0.2); padding: 12px 24px; border-radius: 12px; color: #fff; cursor: pointer; font-size: 16px; font-weight: 500; transition: 0.2s; display: flex; align-items: center; gap: 8px; }
        .tab-btn:hover { border-color: #ff0000; background: rgba(255,0,0,0.1); }
        .tab-btn.active { background: linear-gradient(135deg, #ff0000, #990000); border-color: #ff0000; }
        .table-container { background: rgba(24,24,24,0.95); border-radius: 20px; border: 1px solid rgba(255,0,0,0.15); overflow-x: auto; margin-bottom: 30px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: rgba(0,0,0,0.4); padding: 15px; text-align: left; color: #ff4444; font-weight: 600; }
        td { padding: 12px 15px; border-bottom: 1px solid rgba(255,255,255,0.05); vertical-align: middle; }
        .table-img { width: 50px; height: 50px; object-fit: cover; border-radius: 8px; }
        .user-avatar-sm { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }
        .badge { display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; }
        .badge.product { background: rgba(76,175,80,0.2); color: #4CAF50; }
        .badge.player { background: rgba(255,122,47,0.2); color: #ff7a2f; }
        .badge.admin { background: rgba(244,67,54,0.2); color: #f44336; }
        .badge.user { background: rgba(33,150,243,0.2); color: #2196F3; }
        .stats-cell { text-align: center; }
        .stats-cell button { background: rgba(255,255,255,0.1); border: none; color: #fff; padding: 6px 12px; border-radius: 20px; cursor: pointer; transition: 0.2s; display: inline-flex; align-items: center; gap: 6px; font-size: 13px; }
        .stats-cell button:hover { background: #ff0000; transform: scale(1.05); }
        .actions { display: flex; gap: 8px; align-items: center; }
        .edit-product, .delete-product, .edit-player, .delete-player, .edit-user, .delete-user { width: 32px; height: 32px; border-radius: 8px; border: none; cursor: pointer; transition: 0.2s; display: inline-flex; align-items: center; justify-content: center; }
        .edit-product, .edit-player, .edit-user { background: rgba(255,193,7,0.15); color: #ffc107; }
        .edit-product:hover, .edit-player:hover, .edit-user:hover { background: #ffc107; color: #000; }
        .delete-product, .delete-player, .delete-user { background: rgba(244,67,54,0.15); color: #f44336; }
        .delete-product:hover, .delete-player:hover, .delete-user:hover { background: #f44336; color: #fff; }
        .action-buttons { display: flex; gap: 15px; flex-wrap: wrap; margin-bottom: 20px; }
        .btn-primary, .btn-secondary, .btn-settings { padding: 12px 24px; border-radius: 12px; border: none; cursor: pointer; font-size: 14px; font-weight: 600; text-decoration: none; display: inline-flex; align-items: center; gap: 8px; transition: 0.2s; }
        .btn-primary { background: linear-gradient(135deg, #4CAF50, #2e7d32); color: white; }
        .btn-secondary { background: linear-gradient(135deg, #ff7a2f, #cc5500); color: white; }
        .btn-settings { background: linear-gradient(135deg, #2196F3, #0d47a1); color: white; }
        .btn-primary:hover, .btn-secondary:hover, .btn-settings:hover { transform: translateY(-2px); filter: brightness(1.05); }
        .modal-overlay { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); backdrop-filter: blur(5px); z-index: 1000; justify-content: center; align-items: center; }
        .modal-overlay.active { display: flex; }
        .modal-content { background: linear-gradient(145deg, #2a2a2a, #1e1e1e); border-radius: 20px; padding: 30px; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto; border: 1px solid #ff7a2f; position: relative; }
        .modal-content h3 { color: #ff7a2f; margin-bottom: 20px; font-size: 24px; }
        .modal-content input, .modal-content select, .modal-content textarea { width: 100%; padding: 12px; margin-bottom: 15px; background: #111; border: 1px solid #333; border-radius: 8px; color: #fff; font-size: 14px; }
        .modal-content textarea { resize: vertical; min-height: 80px; }
        .modal-buttons { display: flex; gap: 10px; margin-top: 10px; }
        .modal-buttons button { flex: 1; padding: 12px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s; }
        .modal-buttons button[type="submit"] { background: linear-gradient(45deg, #ff0000, #990000); border: none; color: white; }
        .modal-buttons button[type="button"] { background: #333; border: none; color: #fff; }
        .modal-close { position: absolute; top: 15px; right: 15px; background: none; border: none; color: #fff; font-size: 30px; cursor: pointer; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: rgba(255, 0, 0, 0.1); transition: 0.3s; }
        .modal-close:hover { background: #ff0000; transform: rotate(90deg); }
        .user-data-item { background: rgba(0,0,0,0.3); border-radius: 12px; padding: 12px; margin-bottom: 10px; transition: 0.2s; }
        .user-data-item:hover { background: rgba(255,0,0,0.1); transform: translateX(5px); }
        .user-data-header { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
        .user-data-image { width: 50px; height: 50px; object-fit: cover; border-radius: 8px; }
        .user-data-info { flex: 1; }
        .user-data-name { font-weight: bold; color: #fff; }
        .user-data-artist { font-size: 12px; color: #888; }
        .user-data-rating { display: flex; align-items: center; gap: 4px; margin-top: 4px; }
        .user-data-comment { font-size: 13px; color: #ccc; margin-top: 8px; padding: 10px; background: rgba(0,0,0,0.3); border-radius: 8px; font-style: italic; }
        .user-data-date { font-size: 10px; color: #666; margin-top: 5px; }
        .admin-reply { margin-top: 10px; padding: 10px; background: rgba(255,122,47,0.1); border-radius: 8px; border-left: 3px solid #ff7a2f; }
        .admin-reply-text { font-size: 12px; color: #ff7a2f; margin-bottom: 5px; }
        .admin-reply-content { font-size: 13px; color: #ddd; }
        .reply-form { margin-top: 10px; display: flex; gap: 10px; }
        .reply-form input { flex: 1; padding: 8px; background: #111; border: 1px solid #333; border-radius: 8px; color: #fff; }
        .reply-form button { padding: 8px 15px; background: #ff7a2f; border: none; border-radius: 8px; color: #fff; cursor: pointer; }
        .reply-form button:hover { background: #ff0000; }
        .empty-data { text-align: center; padding: 40px; color: #888; }
        .tab-content { display: none; }
        .tab-content.active { display: block; }
        @media (max-width: 768px) {
            .admin-wrapper { padding: 10px; }
            .stats-grid { grid-template-columns: repeat(2, 1fr); }
            th, td { padding: 8px; font-size: 12px; }
        }
    </style>
</head>
<body>
<div class="admin-wrapper">
    <div class="admin-header">
        <div class="header-left">
            <h1><i class="fas fa-crown"></i> Админ панель</h1>
            <p>Управление каталогом и пользователями</p>
        </div>
        <div class="header-right">
            <div class="admin-user"><i class="fas fa-user-shield"></i><span>${username}</span></div>
            <a href="/" class="logout-link home-link"><i class="fas fa-home"></i> На сайт</a>
            <a href="/logout" class="logout-link"><i class="fas fa-sign-out-alt"></i> Выйти</a>
        </div>
    </div>
    
    <div class="stats-grid">
        <div class="stat-card"><div class="stat-value">${productCount}</div><div class="stat-label">📀 Пластинок</div></div>
        <div class="stat-card"><div class="stat-value">${playerCount}</div><div class="stat-label">🎵 Проигрывателей</div></div>
        <div class="stat-card"><div class="stat-value">${userCount}</div><div class="stat-label">👥 Пользователей</div></div>
        <div class="stat-card"><div class="stat-value">${productCount + playerCount}</div><div class="stat-label">📦 Всего товаров</div></div>
    </div>
    
    <div class="action-buttons">
        <button class="btn-primary" id="addProductBtn"><i class="fas fa-plus-circle"></i> Добавить пластинку</button>
        <button class="btn-secondary" id="addPlayerBtn"><i class="fas fa-plus-circle"></i> Добавить проигрыватель</button>
        <a href="/admin/settings" class="btn-settings"><i class="fas fa-sliders-h"></i> Настройки главной</a>
    </div>
    
    <div class="tabs">
        <button class="tab-btn active" data-tab="products"><i class="fas fa-record-vinyl"></i> Пластинки</button>
        <button class="tab-btn" data-tab="players"><i class="fas fa-headphones"></i> Проигрыватели</button>
        <button class="tab-btn" data-tab="users"><i class="fas fa-users"></i> Пользователи</button>
    </div>
    
    <div id="products-tab" class="tab-content active">
        <div class="table-container">
            <table>
                <thead><tr><th>Тип</th><th>Изображение</th><th>Название</th><th>Исполнитель</th><th>Жанр</th><th>Год</th><th>Цена</th><th>Рейтинг</th><th>Действия</th></tr></thead>
                <tbody>${productsRows || '<tr><td colspan="9">Нет пластинок</td>'}</tbody>
            </table>
        </div>
    </div>
    
    <div id="players-tab" class="tab-content">
        <div class="table-container">
            <table>
                <thead><tr><th>Тип</th><th>Изображение</th><th>Название</th><th>Описание</th><th>Цена</th><th>Действия</th></tr></thead>
                <tbody>${playersRows || '<tr><td colspan="6">Нет проигрывателей</td>'}</tbody>
            </table>
        </div>
    </div>
    
    <div id="users-tab" class="tab-content">
        <div class="table-container">
            <table>
                <thead>
                    <tr><th>Аватар</th><th>Имя</th><th>Роль</th><th>📝 Отзывы</th><th>❤️ Избранное</th><th>🛒 Корзина</th><th>Действия</th></tr>
                </thead>
                <tbody>${usersRows || '<tr><td colspan="7">Нет пользователей</td>'}</tbody>
            </table>
        </div>
    </div>
</div>

<!-- Модальные окна -->
<div id="itemModal" class="modal-overlay"><div class="modal-content"><button type="button" class="modal-close" onclick="closeModal('itemModal')">&times;</button><h3 id="modalTitle">Добавить товар</h3><form id="itemForm" enctype="multipart/form-data"><input type="hidden" id="itemId" name="id"><input type="hidden" id="itemType" name="type"><input type="text" id="itemName" name="name" placeholder="Название" required><input type="text" id="itemArtist" name="artist" placeholder="Исполнитель"><input type="text" id="itemGenre" name="genre" placeholder="Жанр"><input type="text" id="itemYear" name="year" placeholder="Год"><input type="number" id="itemPrice" name="price" placeholder="Цена" step="0.01" required><textarea id="itemDescription" name="description" placeholder="Описание"></textarea><input type="file" id="itemImage" name="image" accept="image/*"><input type="file" id="itemAudio" name="audio" accept="audio/*"><div class="modal-buttons"><button type="submit">Сохранить</button><button type="button" onclick="closeModal('itemModal')">Отмена</button></div></form></div></div>

<div id="userModal" class="modal-overlay"><div class="modal-content"><button type="button" class="modal-close" onclick="closeModal('userModal')">&times;</button><h3>Редактировать пользователя</h3><form id="userForm"><input type="hidden" id="editUserId"><input type="text" id="editUsername" placeholder="Имя пользователя" required><select id="editRole"><option value="user">Пользователь</option><option value="admin">Администратор</option></select><input type="password" id="editPassword" placeholder="Новый пароль"><div class="modal-buttons"><button type="submit">Сохранить</button><button type="button" onclick="closeModal('userModal')">Отмена</button></div></form></div></div>

<div id="reviewsModal" class="modal-overlay"><div class="modal-content"><button type="button" class="modal-close" onclick="closeModal('reviewsModal')">&times;</button><h3 id="reviewsTitle">Отзывы пользователя</h3><div id="reviewsList"></div></div></div>

<div id="favoritesModal" class="modal-overlay"><div class="modal-content"><button type="button" class="modal-close" onclick="closeModal('favoritesModal')">&times;</button><h3 id="favoritesTitle">Избранное пользователя</h3><div id="favoritesList"></div></div></div>

<div id="cartModal" class="modal-overlay"><div class="modal-content"><button type="button" class="modal-close" onclick="closeModal('cartModal')">&times;</button><h3 id="cartTitle">Корзина пользователя</h3><div id="cartList"></div><div id="cartTotal"></div></div></div>

<script>
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = function() {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            document.getElementById(this.dataset.tab + '-tab').classList.add('active');
        };
    });
    
    document.getElementById('addProductBtn').onclick = () => openAddModal('product');
    document.getElementById('addPlayerBtn').onclick = () => openAddModal('player');
    
    function openAddModal(type) {
        document.getElementById('modalTitle').innerText = type === 'product' ? 'Добавить пластинку' : 'Добавить проигрыватель';
        document.getElementById('itemType').value = type;
        document.getElementById('itemId').value = '';
        document.getElementById('itemForm').reset();
        document.getElementById('itemModal').classList.add('active');
    }
    
    document.querySelectorAll('.edit-product').forEach(btn => { btn.onclick = () => editItem('product', btn.dataset.id); });
    document.querySelectorAll('.edit-player').forEach(btn => { btn.onclick = () => editItem('player', btn.dataset.id); });
    
    function editItem(type, id) {
        fetch('/admin/get-item', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: type, id: id }) })
            .then(res => res.json()).then(data => {
                document.getElementById('modalTitle').innerText = type === 'product' ? 'Редактировать пластинку' : 'Редактировать проигрыватель';
                document.getElementById('itemType').value = type;
                document.getElementById('itemId').value = id;
                document.getElementById('itemName').value = data.name || '';
                document.getElementById('itemArtist').value = data.artist || '';
                document.getElementById('itemGenre').value = data.genre || '';
                document.getElementById('itemYear').value = data.year || '';
                document.getElementById('itemPrice').value = data.price || '';
                document.getElementById('itemDescription').value = data.description || '';
                document.getElementById('itemModal').classList.add('active');
            });
    }
    
    document.querySelectorAll('.delete-product').forEach(btn => { btn.onclick = () => { if(confirm('Удалить?')) deleteItem('product', btn.dataset.id); }; });
    document.querySelectorAll('.delete-player').forEach(btn => { btn.onclick = () => { if(confirm('Удалить?')) deleteItem('player', btn.dataset.id); }; });
    
    function deleteItem(type, id) {
        fetch('/admin/delete-item', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: type, id: id }) })
            .then(res => res.json()).then(data => { if(data.success) location.reload(); });
    }
    
    document.querySelectorAll('.edit-user').forEach(btn => {
        btn.onclick = function() {
            document.getElementById('editUserId').value = this.dataset.id;
            document.getElementById('editUsername').value = this.dataset.name;
            document.getElementById('editRole').value = this.dataset.role;
            document.getElementById('editPassword').value = '';
            document.getElementById('userModal').classList.add('active');
        };
    });
    
    document.querySelectorAll('.delete-user').forEach(btn => {
        btn.onclick = () => { if(confirm('Удалить пользователя?')) deleteUser(btn.dataset.id); };
    });
    
    function deleteUser(id) {
        fetch('/admin/delete-user', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: id }) })
            .then(res => res.json()).then(data => { if(data.success) location.reload(); });
    }
    
    function sendReply(reviewId, productId, userId) {
        var replyInput = document.getElementById('reply-input-' + reviewId);
        var replyText = replyInput.value.trim();
        if (!replyText) return;
        fetch('/admin/send-review-reply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reviewId: reviewId, productId: productId, userId: userId, reply: replyText }) })
            .then(res => res.json()).then(data => {
                if (data.success) {
                    var replyDiv = document.getElementById('reply-div-' + reviewId);
                    if (replyDiv) replyDiv.innerHTML = '<div class="admin-reply"><div class="admin-reply-text">👑 Администратор ответил:</div><div class="admin-reply-content">' + escapeHtml(replyText) + '</div></div>';
                    replyInput.value = '';
                } else alert('Ошибка отправки ответа');
            });
    }
    
    document.querySelectorAll('.reviews-btn').forEach(btn => {
        btn.onclick = function() {
            var userId = this.dataset.id, userName = this.dataset.name;
            document.getElementById('reviewsTitle').innerHTML = 'Отзывы пользователя: ' + userName;
            document.getElementById('reviewsList').innerHTML = '<div style="text-align:center;padding:20px;">Загрузка...</div>';
            document.getElementById('reviewsModal').classList.add('active');
            fetch('/admin/user-reviews/' + userId).then(res => res.json()).then(data => {
                if(data.length === 0) { document.getElementById('reviewsList').innerHTML = '<div class="empty-data">📝 Нет отзывов</div>'; return; }
                var html = '';
                for(var i=0; i<data.length; i++) {
                    var r = data[i], stars = '';
                    for(var s=1; s<=5; s++) stars += s <= r.rating ? '⭐' : '☆';
                    html += '<div class="user-data-item" data-review-id="' + r.id + '"><div class="user-data-header"><img src="/uploads/' + escapeHtml(r.product_image) + '" class="user-data-image"><div class="user-data-info"><div class="user-data-name">' + escapeHtml(r.product_name) + '</div><div class="user-data-artist">' + escapeHtml(r.product_artist) + '</div><div class="user-data-rating">' + stars + ' (' + r.rating + '/5)</div><div class="user-data-date">📅 ' + new Date(r.created_at).toLocaleDateString() + '</div></div></div>' + (r.comment ? '<div class="user-data-comment">💬 "' + escapeHtml(r.comment) + '"</div>' : '') + '<div id="reply-div-' + r.id + '">' + (r.admin_reply ? '<div class="admin-reply"><div class="admin-reply-text">👑 Администратор ответил:</div><div class="admin-reply-content">' + escapeHtml(r.admin_reply) + '</div></div>' : '') + '</div><div class="reply-form"><input type="text" id="reply-input-' + r.id + '" placeholder="Ответ администратора..."><button onclick="sendReply(' + r.id + ', ' + r.product_id + ', ' + userId + ')">📨 Ответить</button></div></div>';
                }
                document.getElementById('reviewsList').innerHTML = html;
            });
        };
    });
    
    document.querySelectorAll('.favorites-btn').forEach(btn => {
        btn.onclick = function() {
            var userId = this.dataset.id;
            document.getElementById('favoritesTitle').innerHTML = 'Избранное';
            document.getElementById('favoritesList').innerHTML = '<div style="text-align:center;padding:20px;">Загрузка...</div>';
            document.getElementById('favoritesModal').classList.add('active');
            fetch('/admin/user-favorites/' + userId).then(res => res.json()).then(data => {
                if(data.length === 0) { document.getElementById('favoritesList').innerHTML = '<div class="empty-data">❤️ Нет избранного</div>'; return; }
                var html = '';
                for(var i=0; i<data.length; i++) {
                    var item = data[i], imgPath = item.type === 'product' ? '/uploads/' + item.image : '/photo/' + item.image;
                    html += '<div class="user-data-item"><div class="user-data-header"><img src="' + imgPath + '" class="user-data-image"><div class="user-data-info"><div class="user-data-name">' + escapeHtml(item.name) + '</div><div class="user-data-artist">' + escapeHtml(item.artist) + '</div><div class="user-data-price">$' + item.price + '</div><div class="user-data-date">📅 ' + new Date(item.added_at).toLocaleDateString() + '</div></div></div></div>';
                }
                document.getElementById('favoritesList').innerHTML = html;
            });
        };
    });
    
    document.querySelectorAll('.cart-btn').forEach(btn => {
        btn.onclick = function() {
            var userId = this.dataset.id;
            document.getElementById('cartTitle').innerHTML = 'Корзина';
            document.getElementById('cartList').innerHTML = '<div style="text-align:center;padding:20px;">Загрузка...</div>';
            document.getElementById('cartModal').classList.add('active');
            fetch('/admin/user-cart/' + userId).then(res => res.json()).then(data => {
                if(data.items.length === 0) { document.getElementById('cartList').innerHTML = '<div class="empty-data">🛒 Корзина пуста</div>'; document.getElementById('cartTotal').innerHTML = ''; return; }
                var html = '', total = 0;
                for(var i=0; i<data.items.length; i++) {
                    var item = data.items[i], imgPath = item.type === 'product' ? '/uploads/' + item.image : '/photo/' + item.image, subtotal = item.price * item.quantity;
                    total += subtotal;
                    html += '<div class="user-data-item"><div class="user-data-header"><img src="' + imgPath + '" class="user-data-image"><div class="user-data-info"><div class="user-data-name">' + escapeHtml(item.name) + '</div><div class="user-data-artist">' + escapeHtml(item.artist) + '</div><div class="user-data-price">$' + item.price + ' × ' + item.quantity + ' = $' + subtotal + '</div></div></div></div>';
                }
                document.getElementById('cartList').innerHTML = html;
                document.getElementById('cartTotal').innerHTML = '<span style="color:#ff7a2f; text-align:right; display:block;">Итого: $' + total + '</span>';
            });
        };
    });
    
    function closeModal(modalId) { document.getElementById(modalId).classList.remove('active'); }
    
    document.getElementById('itemForm').onsubmit = function(e) {
        e.preventDefault();
        var formData = new FormData(this);
        fetch('/admin/save-item', { method: 'POST', body: formData }).then(res => res.json()).then(data => { if(data.success) location.reload(); else alert('Ошибка'); });
    };
    
    document.getElementById('userForm').onsubmit = function(e) {
        e.preventDefault();
        var data = { id: document.getElementById('editUserId').value, username: document.getElementById('editUsername').value, role: document.getElementById('editRole').value, password: document.getElementById('editPassword').value };
        fetch('/admin/update-user', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(res => res.json()).then(data => { if(data.success) location.reload(); else alert('Ошибка'); });
    };
    
    function escapeHtml(str) { if (!str) return ''; return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
</script>
</body>
</html>`;
    }

    return router;
};