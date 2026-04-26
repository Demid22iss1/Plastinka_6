const express = require("express");
const router = express.Router();

module.exports = (db, requireAuth, escapeHtml) => {
    
    // Добавление в корзину (POST форма)
    router.post("/add-to-cart", requireAuth, (req, res) => {
        const productId = req.body.id;
        const userId = req.session.user.id;
        
        if (!productId) {
            return res.redirect("/catalog?error=1");
        }
        
        db.get("SELECT * FROM carts WHERE user_id = ? AND product_id = ?", [userId, productId], (err, existing) => {
            if (err) {
                console.error("Ошибка проверки корзины:", err);
                return res.redirect("/catalog?error=1");
            }
            
            if (existing) {
                db.run("UPDATE carts SET quantity = quantity + 1 WHERE user_id = ? AND product_id = ?", [userId, productId], (err) => {
                    if (err) console.error("Ошибка обновления корзины:", err);
                    const referer = req.headers.referer || "/catalog";
                    res.redirect(referer);
                });
            } else {
                db.run("INSERT INTO carts (user_id, product_id, quantity) VALUES (?, ?, 1)", [userId, productId], (err) => {
                    if (err) console.error("Ошибка добавления в корзину:", err);
                    const referer = req.headers.referer || "/catalog";
                    res.redirect(referer);
                });
            }
        });
    });

    // API добавления в корзину (AJAX)
    router.post("/api/cart/add", requireAuth, (req, res) => {
        const { id } = req.body;
        const userId = req.session.user.id;
        
        if (!id) {
            return res.status(400).json({ error: "ID товара не указан" });
        }
        
        db.get("SELECT * FROM carts WHERE user_id = ? AND product_id = ?", [userId, id], (err, existing) => {
            if (err) {
                return res.status(500).json({ error: "Ошибка базы данных" });
            }
            
            if (existing) {
                db.run("UPDATE carts SET quantity = quantity + 1 WHERE user_id = ? AND product_id = ?", [userId, id], (err) => {
                    if (err) return res.status(500).json({ error: "Ошибка обновления" });
                    res.json({ success: true, message: "Количество увеличено" });
                });
            } else {
                db.run("INSERT INTO carts (user_id, product_id, quantity) VALUES (?, ?, 1)", [userId, id], (err) => {
                    if (err) return res.status(500).json({ error: "Ошибка добавления" });
                    res.json({ success: true, message: "Товар добавлен в корзину" });
                });
            }
        });
    });

    // Обновление количества
    router.post("/api/cart/update", requireAuth, (req, res) => {
        const { product_id, action } = req.body;
        const userId = req.session.user.id;
        
        db.get("SELECT * FROM carts WHERE user_id = ? AND product_id = ?", [userId, product_id], (err, cartItem) => {
            if (err || !cartItem) {
                return res.status(404).json({ error: "Товар не найден" });
            }
            
            let newQuantity = cartItem.quantity;
            if (action === 'increase') {
                newQuantity++;
            } else if (action === 'decrease') {
                newQuantity--;
            }
            
            if (newQuantity <= 0) {
                db.run("DELETE FROM carts WHERE user_id = ? AND product_id = ?", [userId, product_id], (err) => {
                    if (err) return res.status(500).json({ error: "Ошибка удаления" });
                    res.json({ success: true });
                });
            } else {
                db.run("UPDATE carts SET quantity = ? WHERE user_id = ? AND product_id = ?", [newQuantity, userId, product_id], (err) => {
                    if (err) return res.status(500).json({ error: "Ошибка обновления" });
                    res.json({ success: true });
                });
            }
        });
    });

    // Удаление из корзины
    router.post("/api/cart/remove", requireAuth, (req, res) => {
        const { product_id } = req.body;
        const userId = req.session.user.id;
        
        db.run("DELETE FROM carts WHERE user_id = ? AND product_id = ?", [userId, product_id], (err) => {
            if (err) return res.status(500).json({ error: "Ошибка удаления" });
            res.json({ success: true });
        });
    });

    // Альтернативные маршруты для совместимости
    router.post("/update-cart", requireAuth, (req, res) => {
        const { product_id, action } = req.body;
        const userId = req.session.user.id;
        
        db.get("SELECT * FROM carts WHERE user_id = ? AND product_id = ?", [userId, product_id], (err, cartItem) => {
            if (err || !cartItem) {
                return res.json({ success: false, error: "Товар не найден" });
            }
            
            let newQuantity = cartItem.quantity;
            if (action === 'increase') {
                newQuantity++;
            } else if (action === 'decrease') {
                newQuantity--;
            }
            
            if (newQuantity <= 0) {
                db.run("DELETE FROM carts WHERE user_id = ? AND product_id = ?", [userId, product_id], (err) => {
                    if (err) return res.json({ success: false });
                    res.json({ success: true });
                });
            } else {
                db.run("UPDATE carts SET quantity = ? WHERE user_id = ? AND product_id = ?", [newQuantity, userId, product_id], (err) => {
                    if (err) return res.json({ success: false });
                    res.json({ success: true });
                });
            }
        });
    });

    router.post("/remove-from-cart-ajax", requireAuth, (req, res) => {
        const { product_id } = req.body;
        const userId = req.session.user.id;
        
        db.run("DELETE FROM carts WHERE user_id = ? AND product_id = ?", [userId, product_id], (err) => {
            if (err) return res.json({ success: false });
            res.json({ success: true });
        });
    });

    // Страница корзины
    router.get("/cart", requireAuth, (req, res) => {
        const user = req.session.user;
        db.all("SELECT * FROM carts WHERE user_id = ?", [user.id], (err, cartItems) => {
            if (err || cartItems.length === 0) {
                // Пустая корзина
                const content = `
                    <div class="empty-cart-container" style="text-align:center;padding:60px 20px;">
                        <div class="empty-cart-icon" style="font-size:80px;margin-bottom:20px;">🛒</div>
                        <h3 style="margin-bottom:10px;">Ваша корзина пуста</h3>
                        <p style="color:#888;margin-bottom:20px;">Добавьте понравившиеся пластинки или проигрыватели</p>
                        <a href="/catalog" class="empty-cart-btn" style="display:inline-block;background:linear-gradient(45deg,#ff0000,#990000);color:white;padding:12px 24px;border-radius:30px;text-decoration:none;">Перейти в каталог</a>
                    </div>
                `;
                return res.send(require('./renderMobile')(req, user, 'Корзина', content, 'cart'));
            }

            const items = [];
            let totalItems = 0, totalPrice = 0;
            const promises = cartItems.map(item => new Promise(resolve => {
                const parts = item.product_id.split('_');
                const type = parts[0], id = parts[1];
                if (type === 'player') {
                    db.get("SELECT * FROM players WHERE id = ?", [id], (err, player) => {
                        if (player) {
                            items.push({ ...item, type: 'player', name: player.name, artist: 'Проигрыватель винила', price: player.price, image: player.image });
                            totalItems += item.quantity;
                            totalPrice += player.price * item.quantity;
                        }
                        resolve();
                    });
                } else {
                    db.get("SELECT * FROM products WHERE id = ?", [id], (err, product) => {
                        if (product) {
                            items.push({ ...item, type: 'product', name: product.name, artist: product.artist, price: product.price, image: product.image, audio: product.audio });
                            totalItems += item.quantity;
                            totalPrice += product.price * item.quantity;
                        }
                        resolve();
                    });
                }
            }));

            Promise.all(promises).then(() => {
                let itemsHtml = '';
                items.forEach(item => {
                    const imagePath = item.type === 'player' ? `/photo/${item.image}` : `/uploads/${item.image}`;
                    itemsHtml += `<div class="cart-item" style="display:flex;align-items:center;gap:12px;background:#1a1a1a;padding:12px;border-radius:12px;margin-bottom:12px;">
                        <img src="${imagePath}" style="width:70px;height:70px;object-fit:cover;border-radius:8px;">
                        <div style="flex:1;">
                            <div style="font-weight:bold;">${escapeHtml(item.name)}</div>
                            <div style="color:#888;font-size:12px;">${escapeHtml(item.artist)}</div>
                            <div style="color:#ff0000;font-weight:bold;">$${item.price}</div>
                            <div style="display:flex;align-items:center;gap:10px;margin-top:8px;">
                                <button class="quantity-btn" onclick="updateQuantity('${item.product_id}', 'decrease')" style="width:28px;height:28px;border-radius:50%;background:#333;border:none;color:white;">-</button>
                                <span>${item.quantity}</span>
                                <button class="quantity-btn" onclick="updateQuantity('${item.product_id}', 'increase')" style="width:28px;height:28px;border-radius:50%;background:#333;border:none;color:white;">+</button>
                            </div>
                        </div>
                        <button onclick="removeFromCart('${item.product_id}')" style="background:transparent;border:none;color:#ff4444;font-size:18px;cursor:pointer;"><i class="fas fa-trash"></i></button>
                    </div>`;
                });
                
                const content = `${itemsHtml}
                    <div style="background:#1a1a1a;padding:16px;border-radius:12px;margin-top:20px;display:flex;justify-content:space-between;">
                        <span>Итого:</span>
                        <span style="font-size:22px;font-weight:bold;color:#ff0000;">$${totalPrice}</span>
                    </div>
                    <button onclick="checkout()" style="width:100%;background:linear-gradient(45deg,#ff0000,#990000);border:none;color:white;padding:14px;border-radius:12px;font-weight:bold;font-size:16px;margin-top:16px;cursor:pointer;">Оформить заказ</button>
                    <script>
                    function updateQuantity(id,action){
                        fetch('/api/cart/update',{
                            method:'POST',
                            headers:{'Content-Type':'application/json'},
                            body:JSON.stringify({product_id:id,action:action})
                        }).then(()=>location.reload());
                    }
                    function removeFromCart(id){
                        if(confirm('Удалить товар из корзины?')){
                            fetch('/api/cart/remove',{
                                method:'POST',
                                headers:{'Content-Type':'application/json'},
                                body:JSON.stringify({product_id:id})
                            }).then(()=>location.reload());
                        }
                    }
                    function checkout(){
                        if(confirm('Подтвердите заказ')){
                            alert('✅ Заказ оформлен!');
                            window.location='/';
                        }
                    }
                    </script>
                `;
                res.send(require('./renderMobile')(req, user, 'Корзина', content, 'cart'));
            });
        });
    });

    return router;
};