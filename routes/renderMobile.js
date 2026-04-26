function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

module.exports = (req, user, title, content, activeTab) => {
    const showNotification = req.query.added === '1';
    
    return `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=yes, viewport-fit=cover"><title>${escapeHtml(title)} · Plastinka</title><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <style>
    *{margin:0;padding:0;box-sizing:border-box;}body{background:#0f0f0f;color:white;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;padding-bottom:70px;min-height:100vh;}
    .top-bar{background:#0a0a0a;padding:12px 16px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:100;border-bottom:1px solid #222;}
    .top-bar .logo{height:32px;width:auto;}
    .search-bar{flex:1;background:#1a1a1a;border-radius:20px;padding:8px 16px;display:flex;align-items:center;gap:8px;color:#888;font-size:14px;border:1px solid #333;cursor:pointer;}
    .search-bar i{color:#ff0000;}
    .content{padding:16px;}
    .section-title{font-size:20px;font-weight:bold;margin:20px 0 16px;color:white;letter-spacing:1px;position:relative;padding-left:12px;}
    .section-title::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:linear-gradient(180deg,#ff0000,#990000);border-radius:2px;}
    .products-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:20px;}
    .product-card{background:#1a1a1a;border-radius:12px;overflow:hidden;border:1px solid #333;transition:transform 0.2s,border-color 0.2s;cursor:pointer;}
    .product-card:hover{transform:translateY(-2px);border-color:#ff0000;}
    .product-image{position:relative;aspect-ratio:1;background:#111;}
    .product-image img{width:100%;height:100%;object-fit:cover;}
    .vinyl-overlay{position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.2s;}
    .product-card:hover .vinyl-overlay{opacity:1;}
    .vinyl-icon{width:50px;height:50px;animation:spin 4s linear infinite;}@keyframes spin{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}
    .product-info{padding:12px;}
    .product-name{font-weight:bold;font-size:14px;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .product-artist{font-size:12px;color:#888;margin-bottom:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .product-price{color:#ff0000;font-weight:bold;font-size:16px;margin-bottom:8px;}
    .product-actions{display:flex;gap:8px;}
    .action-btn{flex:1;background:#333;border:none;color:white;padding:8px;border-radius:8px;font-size:14px;cursor:pointer;transition:0.2s;}
    .action-btn.primary{background:linear-gradient(45deg,#ff0000,#990000);}
    .action-btn:hover{opacity:0.8;}
    .bottom-nav{position:fixed;bottom:0;left:0;right:0;background:#0a0a0a;display:flex;justify-content:space-around;padding:8px 0 12px;border-top:1px solid #222;z-index:1000;}
    .nav-item{color:#888;text-decoration:none;display:flex;flex-direction:column;align-items:center;gap:4px;font-size:11px;flex:1;transition:color 0.2s;}
    .nav-item i{font-size:20px;}
    .nav-item.active{color:#ff0000;}
    .auth-prompt{background:linear-gradient(45deg,#ff0000,#990000);padding:20px;border-radius:12px;text-align:center;margin-top:20px;}
    .auth-prompt p{margin-bottom:12px;font-size:14px;}
    .auth-btn{display:inline-block;background:white;color:#ff0000;padding:10px 30px;border-radius:30px;text-decoration:none;font-weight:bold;font-size:14px;}
    .toast-notification{position:fixed;bottom:20px;right:20px;background:#4CAF50;color:white;padding:12px 20px;border-radius:12px;z-index:3000;animation:fadeInOut 3s;font-size:14px;}@keyframes fadeInOut{0%{opacity:0;bottom:0;}10%{opacity:1;bottom:20px;}90%{opacity:1;bottom:20px;}100%{opacity:0;bottom:0;}}
    @media (max-width: 480px){.products-grid{grid-template-columns:1fr;}}
    </style>
    </head>
    <body>
    ${showNotification ? '<div class="toast-notification">✅ Товар добавлен в корзину!</div>' : ''}
    <div class="top-bar">
        <img src="/photo/logo.svg" class="logo" alt="Plastinka">
        <div class="search-bar" onclick="window.location='/catalog'">
            <i class="fas fa-search"></i>
            <span>Поиск</span>
        </div>
    </div>
    <div class="content">${content}</div>
    <nav class="bottom-nav">
        <a href="/" class="nav-item ${activeTab === 'home' ? 'active' : ''}"><i class="fas fa-home"></i><span>Главная</span></a>
        <a href="/catalog" class="nav-item ${activeTab === 'catalog' ? 'active' : ''}"><i class="fas fa-record-vinyl"></i><span>Каталог</span></a>
        <a href="/favorites" class="nav-item ${activeTab === 'favorites' ? 'active' : ''}"><i class="fas fa-heart"></i><span>Избранное</span></a>
        <a href="/cart" class="nav-item ${activeTab === 'cart' ? 'active' : ''}"><i class="fas fa-shopping-cart"></i><span>Корзина</span></a>
        <a href="/profile" class="nav-item ${activeTab === 'profile' ? 'active' : ''}"><i class="fas fa-user"></i><span>Профиль</span></a>
    </nav>
    </body>
    </html>`;
};