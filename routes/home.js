const express = require("express");
const router = express.Router();

module.exports = (db, requireAuth, escapeHtml) => {
    
    function generateStarRatingHTML(rating, votesCount) {
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 >= 0.5;
        let starsHtml = '';
        
        for (let i = 1; i <= 5; i++) {
            if (i <= fullStars) {
                starsHtml += '<i class="fas fa-star star filled"></i>';
            } else if (i === fullStars + 1 && hasHalfStar) {
                starsHtml += '<i class="fas fa-star-half-alt star filled"></i>';
            } else {
                starsHtml += '<i class="far fa-star star"></i>';
            }
        }
        
        starsHtml += `<span class="rating-value">${rating}</span>`;
        starsHtml += `<span class="votes-count">(${votesCount})</span>`;
        return starsHtml;
    }
    
    router.get("/", (req, res) => {
        const user = req.session.user;
        const showNotification = req.query.added === '1';
        
        db.get("SELECT value FROM site_settings WHERE key = 'homepage_products'", [], (err, setting) => {
            const homepageMode = setting ? setting.value : 'last_added';
            
            let productsQuery = "SELECT * FROM products ORDER BY id DESC LIMIT 6";
            
            db.all(productsQuery, [], (err, products) => {
                if (err) products = [];
                
                const productPromises = products.map(product => {
                    return new Promise((resolve) => {
                        db.get(`SELECT AVG(rating) as avg_rating, COUNT(*) as votes_count 
                                FROM ratings WHERE product_id = ?`, 
                            [product.id], 
                            (err, rating) => {
                                product.avg_rating = rating?.avg_rating ? parseFloat(rating.avg_rating).toFixed(1) : 0;
                                product.votes_count = rating?.votes_count || 0;
                                resolve();
                            });
                    });
                });
                
                Promise.all(productPromises).then(() => {
                    db.all("SELECT * FROM players", [], (err, players) => {
                        if (err) players = [];
                        
                        let productHTML = "";
                        products.forEach(product => {
                            productHTML += `
<div class="benefit" 
     data-product-id="${product.id}"
     data-product-name="${escapeHtml(product.name)}"
     data-product-artist="${escapeHtml(product.artist)}"
     data-product-price="${product.price}"
     data-product-image="/uploads/${product.image}"
     data-product-description="${escapeHtml(product.description || 'Нет описания')}"
     data-product-genre="${escapeHtml(product.genre || 'Rock')}"
     data-product-year="${escapeHtml(product.year || '1970')}">
    <div class="image-container">
        <img src="/uploads/${product.image}" class="graf">
        <img src="/photo/plastinka-audio.png" class="plastinka">
        ${product.audio ? `<audio class="album-audio" src="/audio/${product.audio}" preload="auto"></audio>` : ""}
    </div>
    <div class="benefit-info">
        <div class="album-nazv-container">
            <span class="album-nazv">${escapeHtml(product.name)}</span>
        </div>
        <div class="album-title-container">
            <span class="album-title">${escapeHtml(product.artist)}</span>
        </div>
        <div class="rating-stars" data-product-id="${product.id}" data-rating="${product.avg_rating}">
            ${generateStarRatingHTML(product.avg_rating, product.votes_count)}
        </div>
        <div class="album-bottom">
            <span class="album-price">${product.price}$</span>
            <form action="/add-to-cart" method="POST" class="add-to-cart-form">
                <input type="hidden" name="id" value="product_${product.id}">
                <button type="submit" class="add-to-cart">
                    <img src="/photo/b_plus.svg" class="cart-icon">
                </button>
            </form>
        </div>
    </div>
</div>
`;
                        });
                        
                        let carouselItems = "";
                        for (let i = 0; i < 20; i++) {
                            players.forEach(player => {
                                carouselItems += `
<div class="card" 
     data-player-id="${player.id}"
     data-name="${escapeHtml(player.name)}"
     data-price="${player.price}"
     data-image="/photo/${player.image}"
     data-description="${escapeHtml(player.description || 'Высококачественный проигрыватель винила')}">
    <div class="circle orange"></div>
    <img src="/photo/${player.image}" alt="${player.name}" class="player-image">
    <button class="view-btn">Смотреть</button>
</div>
`;
                            });
                        }
                        
                        res.send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Plastinka</title>
<link rel="stylesheet" href="/style.css">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
<style>
@keyframes rotate {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

.notification {
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: linear-gradient(135deg, #4CAF50, #45a049);
    color: white;
    padding: 14px 20px;
    border-radius: 12px;
    box-shadow: 0 8px 20px rgba(0,0,0,0.3);
    z-index: 9999;
    display: flex;
    align-items: center;
    gap: 12px;
    transform: translateX(400px);
    animation: slideInRight 0.3s forwards, slideOutRight 0.3s 2.7s forwards;
    border-left: 4px solid #fff;
    font-weight: 500;
    backdrop-filter: blur(10px);
}
@keyframes slideInRight {
    to { transform: translateX(0); }
}
@keyframes slideOutRight {
    to { transform: translateX(400px); }
}
.notification-icon { font-size: 20px; }
.notification-content { display: flex; flex-direction: column; }
.notification-title { font-size: 14px; font-weight: bold; margin-bottom: 2px; }
.notification-message { font-size: 12px; opacity: 0.9; }
.notification-progress { position: absolute; bottom: 0; left: 0; height: 3px; background: rgba(255,255,255,0.5); animation: progress 3s linear forwards; border-radius: 0 0 0 12px; }
@keyframes progress { from { width: 100%; } to { width: 0%; } }

header {
    position: sticky;
    top: 0;
    z-index: 1000;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px 5%;
    background: #0a0a0a;
    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    min-height: 80px;
}

.logo {
    flex-shrink: 0;
    z-index: 2;
}
.logo img {
    height: 50px;
    width: auto;
    display: block;
}

.search-bar-desktop {
    position: absolute;
    left: 40%;
    transform: translateX(-50%);
    width: 100%;
    max-width: 500px;
    min-width: 250px;
    background: #1a1a1a;
    border-radius: 40px;
    padding: 10px 20px;
    display: flex;
    align-items: center;
    gap: 10px;
    border: 1px solid #333;
    transition: border-color 0.2s;
    z-index: 1;
}

.search-bar-desktop:hover,
.search-bar-desktop:focus-within {
    border-color: #ff0000;
    background: #111;
}

.search-bar-desktop i {
    color: #ff0000;
    font-size: 18px;
}

.search-bar-desktop input {
    flex: 1;
    background: transparent;
    border: none;
    color: white;
    font-size: 16px;
    outline: none;
}

.search-bar-desktop input::placeholder {
    color: #888;
}

.search-dropdown {
    display: none;
    position: absolute;
    top: calc(100% + 5px);
    left: 0;
    right: 0;
    background: #1a1a1a;
    border-radius: 12px;
    box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    z-index: 1000;
    max-height: 400px;
    overflow-y: auto;
    border: 1px solid #333;
}

.search-dropdown.show {
    display: block;
}

.search-result-item-dropdown {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border-bottom: 1px solid #333;
    cursor: pointer;
    transition: background 0.2s;
}

.search-result-item-dropdown:hover {
    background: #252525;
}

.search-result-image {
    width: 50px;
    height: 50px;
    object-fit: cover;
    border-radius: 8px;
}

.search-result-info {
    flex: 1;
}

.search-result-name {
    font-weight: bold;
    font-size: 14px;
    color: white;
}

.search-result-artist {
    font-size: 12px;
    color: #888;
}

.search-result-price {
    color: #ff0000;
    font-weight: bold;
    font-size: 14px;
}

.search-result-actions {
    display: flex;
    gap: 8px;
}

.search-cart-btn, .search-detail-btn {
    padding: 6px 12px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.2s;
}

.search-cart-btn {
    background: linear-gradient(45deg, #ff0000, #990000);
    color: white;
}

.search-detail-btn {
    background: #333;
    color: white;
}

.search-cart-btn:hover, .search-detail-btn:hover {
    transform: translateY(-1px);
    opacity: 0.9;
}

.search-no-results {
    padding: 20px;
    text-align: center;
    color: #888;
}

.search-catalog-btn {
    width: 100%;
    padding: 12px;
    background: linear-gradient(45deg, #ff0000, #640000);
    color: white;
    border: none;
    cursor: pointer;
    font-size: 14px;
    font-weight: bold;
    text-align: center;
    border-bottom-left-radius: 12px;
    border-bottom-right-radius: 12px;
    transition: all 0.2s;
}

.search-catalog-btn:hover {
    background: linear-gradient(45deg, #670000, #c80000);
    transform: translateY(-2px);
}

.right-icons {
    display: flex;
    gap: 20px;
    align-items: center;
    flex-shrink: 0;
    margin-left: auto;
    z-index: 2;
}

.right-icons a {
    display: flex;
    align-items: center;
    transition: all 0.25s ease;
    line-height: 0;
}

.right-icons a:hover {
    transform: scale(1.1);
    filter: drop-shadow(0 0 8px rgba(255, 0, 0, 0.5));
}

.right-icons img {
    height: 40px;
    width: auto;
    display: block;
}

@media (max-width: 700px) {
    header {
        padding: 10px 4%;
    }
    .logo img {
        height: 40px;
    }
    .search-bar-desktop {
        max-width: 350px;
    }
    .right-icons {
        gap: 15px;
    }
    .right-icons img {
        height: 36px;
    }
}

@media (max-width: 550px) {
    header {
        justify-content: center;
    }
    .search-bar-desktop {
        flex: 1 1 100%;
        max-width: 100%;
        order: 1;
        margin: 5px 0;
    }
    .right-icons {
        justify-content: center;
    }
}

@media (max-width: 480px) {
    .logo img {
        height: 36px;
    }
    .right-icons img {
        height: 34px;
    }
    .right-icons {
        gap: 12px;
    }
}

.player-carousel, .player-carousel2 { width: 100%; overflow: hidden; background: #1e1e1e; padding: 60px 0; position: relative; }
.player-carousel .carousel-track { display: flex; gap: 40px; width: max-content; animation: scrollLeft 60s linear infinite; will-change: transform; align-items: center; }
.player-carousel2 .carousel-track2 { display: flex; gap: 40px; width: max-content; animation: scrollRight 60s linear infinite; will-change: transform; align-items: center; }
.player-carousel:hover .carousel-track, .player-carousel2:hover .carousel-track2 { animation-play-state: paused; }
@keyframes scrollLeft { 0% { transform: translateX(0); } 100% { transform: translateX(calc(-50%)); } }
@keyframes scrollRight { 0% { transform: translateX(-50%); } 100% { transform: translateX(0); } }
.player-carousel .card, .player-carousel2 .card { position: relative; width: 280px; height: 350px; background: transparent; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: transform 0.3s ease; cursor: pointer; }
.player-carousel .card:hover, .player-carousel2 .card:hover { transform: translateY(-10px); z-index: 10; }
.player-carousel .circle, .player-carousel2 .circle { position: absolute; width: 260px; height: 260px; border-radius: 50%; transition: transform 0.4s ease; }
.player-carousel .card:hover .circle, .player-carousel2 .card:hover .circle { transform: scale(1.1); }
.player-carousel .orange, .player-carousel2 .orange { background: #ff7a2f; }
.player-carousel .player-image, .player-carousel2 .player-image { position: relative; width: 240px; height: auto; z-index: 2; pointer-events: none; object-fit: contain; transition: transform 0.3s ease; }
.player-carousel .view-btn, .player-carousel2 .view-btn { position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%) translateY(20px); background: linear-gradient(45deg, #D74307, #ff6b2b); color: white; border: none; border-radius: 30px; padding: 10px 25px; font-size: 14px; font-weight: bold; cursor: pointer; opacity: 0; visibility: hidden; transition: all 0.3s ease; z-index: 10; text-transform: uppercase; letter-spacing: 1px; box-shadow: 0 5px 15px rgba(215, 67, 7, 0.3); white-space: nowrap; }
.player-carousel .card:hover .view-btn, .player-carousel2 .card:hover .view-btn { opacity: 1; visibility: visible; transform: translateX(-50%) translateY(0); }
.player-carousel::before, .player-carousel::after, .player-carousel2::before, .player-carousel2::after { content: ''; position: absolute; top: 0; width: 150px; height: 100%; z-index: 10; pointer-events: none; }
.player-carousel::before, .player-carousel2::before { left: 0; background: linear-gradient(90deg, #1e1e1e 0%, transparent 100%); }
.player-carousel::after, .player-carousel2::after { right: 0; background: linear-gradient(-90deg, #1e1e1e 0%, transparent 100%); }

.modal-overlay { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.8); backdrop-filter: blur(5px); z-index: 1000; justify-content: center; align-items: center; }
.modal-overlay.active { display: flex; }
.modal-content { background: linear-gradient(145deg, #2a2a2a, #1e1e1e); border-radius: 20px; padding: 30px; max-width: 380px; width: 90%; position: relative; border: 1px solid #ff7a2f; box-shadow: 0 20px 40px rgba(255, 122, 47, 0.2); animation: modalAppear 0.3s ease; max-height: 85vh; overflow-y: auto; }
.modal-content::-webkit-scrollbar { width: 6px; }
.modal-content::-webkit-scrollbar-track { background: #1a1a1a; border-radius: 10px; }
.modal-content::-webkit-scrollbar-thumb { background: #ff7a2f; border-radius: 10px; }
.modal-content::-webkit-scrollbar-thumb:hover { background: #ff0000; }
@keyframes modalAppear { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
.modal-close { position: absolute; top: 15px; right: 15px; background: none; border: none; color: #fff; font-size: 30px; cursor: pointer; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: rgba(255, 0, 0, 0.1); transition: 0.3s; }
.modal-close:hover { background: #ff0000; transform: rotate(90deg); }
.modal-player-image { width: 100%; max-height: 300px; object-fit: contain; margin-bottom: 20px; border-radius: 12px; }
.modal-title { font-size: 24px; color: #ff7a2f; margin-bottom: 10px; font-weight: bold; }
.modal-description { color: #ccc; line-height: 1.6; margin-bottom: 20px; font-size: 14px; }
.modal-price { font-size: 28px; color: #fff; font-weight: bold; margin-bottom: 25px; }
.modal-price span { color: #ff7a2f; font-size: 18px; }
.modal-add-to-cart { width: 100%; padding: 12px; background: linear-gradient(45deg, #ff7a2f, #ff0000); border: none; border-radius: 10px; color: white; font-size: 16px; font-weight: bold; cursor: pointer; transition: 0.3s; text-transform: uppercase; letter-spacing: 1px; }
.modal-add-to-cart:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(255, 122, 47, 0.3); }

.catalog-title a { color: inherit; text-decoration: none; transition: 0.3s; }
.catalog-title a:hover { color: #ff0000; }

.modal-artist { color: #aaa; font-size: 16px; margin-bottom: 15px; }
.modal-tags { display: flex; gap: 10px; margin-bottom: 20px; }
.modal-tag { background: rgba(255, 122, 47, 0.2); padding: 5px 12px; border-radius: 20px; font-size: 12px; color: #ff7a2f; }
.modal-actions { display: flex; gap: 15px; margin-bottom: 15px; }
.modal-fav-btn { width: 50px; background: rgba(255, 255, 255, 0.1); border: 1px solid #ff0000; border-radius: 10px; color: #ff0000; font-size: 20px; cursor: pointer; transition: 0.3s; }
.modal-fav-btn:hover { background: #ff0000; color: white; }
.modal-play-btn { width: 100%; padding: 10px; background: rgba(255, 255, 255, 0.1); border: 1px solid #ff7a2f; border-radius: 10px; color: #ff7a2f; font-size: 14px; cursor: pointer; transition: 0.3s; }
.benefit { cursor: pointer; }

@media (max-width: 768px) {
    .player-carousel .card, .player-carousel2 .card { width: 220px; height: 280px; }
    .player-carousel .circle, .player-carousel2 .circle { width: 200px; height: 200px; }
    .player-carousel .player-image, .player-carousel2 .player-image { width: 180px; }
    .player-carousel .carousel-track, .player-carousel2 .carousel-track2 { gap: 30px; }
    .player-carousel::before, .player-carousel::after, .player-carousel2::before, .player-carousel2::after { width: 80px; }
    .modal-content { padding: 20px; }
    .modal-title { font-size: 22px; }
    .modal-price { font-size: 24px; }
    .rating-stars-large .star { font-size: 22px; }
}
@media (max-width: 480px) {
    .player-carousel .card, .player-carousel2 .card { width: 180px; height: 230px; }
    .player-carousel .circle, .player-carousel2 .circle { width: 160px; height: 160px; }
    .player-carousel .player-image, .player-carousel2 .player-image { width: 140px; }
    .player-carousel .carousel-track, .player-carousel2 .carousel-track2 { gap: 20px; }
    .player-carousel .view-btn, .player-carousel2 .view-btn { padding: 6px 15px; font-size: 12px; bottom: 10px; }
    .player-carousel::before, .player-carousel::after, .player-carousel2::before, .player-carousel2::after { width: 50px; }
}
</style>
</head>
<body>
<header>
    <div class="logo"><a href="/"><img src="/photo/logo.svg" alt="Plastinka"></a></div>
    <div class="search-bar-desktop" style="position: relative;">
        <i class="fas fa-search"></i>
        <input type="text" id="desktop-search-input" placeholder="Поиск пластинок..." autocomplete="off">
        <div id="search-dropdown" class="search-dropdown"></div>
    </div>
    <div class="right-icons">
        <a href="/catalog" class="catalog-btn">
            <img src="/photo/icon-katalog.png" alt="Каталог">
        </a>
        <a href="/profile" class="profile-btn">
            <img src="/photo/profile_icon.png" alt="Профиль">
        </a>
        <a href="/cart" class="cart-btn">
            <img src="/photo/knopka-korzina.svg" alt="Корзина">
        </a>
    </div>
</header>
<section class="hero"></section>
<section class="catalog-title-section"><h2 class="catalog-title"><a href="/catalog">КАТАЛОГ</a></h2></section>
<section class="benefits"><div class="benefits-grid">${productHTML || '<p style="text-align: center; color: #aaa; grid-column: 1/-1;">Товаров пока нет</p>'}</div></section>
<section class="catalog-title-section"><h2 class="catalog-title">ПРОИГРЫВАТЕЛИ</h2></section>
<section class="player-carousel"><div class="carousel-track">${carouselItems || '<p style="color: white; padding: 20px;">Проигрывателей пока нет</p>'}</div></section>
<section class="player-carousel2"><div class="carousel-track2">${carouselItems || '<p style="color: white; padding: 20px;">Проигрывателей пока нет</p>'}</div></section>
<div class="modal-overlay" id="playerModal"><div class="modal-content"><button class="modal-close" id="closeModal">&times;</button><img src="" alt="Проигрыватель" class="modal-player-image" id="modalImage"><h2 class="modal-title" id="modalTitle"></h2><p class="modal-description" id="modalDescription"></p><div class="modal-price" id="modalPrice"></div><form id="addToCartForm" method="POST" action="/add-to-cart"><input type="hidden" name="id" id="modalProductId" value=""><button type="submit" class="modal-add-to-cart" id="modalAddToCart">Добавить в корзину</button></form></div></div>
<div class="modal-overlay" id="productModalDesktop"><div class="modal-content"><button class="modal-close" id="closeProductModalDesktop">&times;</button><img src="" alt="Пластинка" class="modal-player-image" id="productModalImageDesktop"><h2 class="modal-title" id="productModalTitleDesktop"></h2><p class="modal-artist" id="productModalArtistDesktop"></p><div class="modal-tags" id="productModalTagsDesktop"></div><div class="rating-section" id="modalRatingSectionDesktop"><div class="rating-label">Средняя оценка:</div><div class="rating-stars-large" id="modalRatingStarsDesktop"></div><div class="rating-votes" id="modalRatingVotesDesktop"></div></div><div class="comments-list" id="modalCommentsListDesktop"></div><p class="modal-description" id="productModalDescriptionDesktop"></p><div class="modal-price" id="productModalPriceDesktop"></div><div class="modal-actions"><button onclick="addToCartFromModalDesktop()" class="modal-add-to-cart" style="flex:1;" id="productModalAddToCartDesktop"><i class="fas fa-shopping-cart"></i> В корзину</button><button onclick="toggleFavoriteFromModalDesktop()" class="modal-fav-btn" id="productModalFavBtnDesktop"><i class="fas fa-heart"></i></button></div><div id="productModalAudioDesktop" style="display:none;"></div><button onclick="playModalPreviewDesktop()" class="modal-play-btn" id="productModalPlayBtnDesktop" style="display:none;"><i class="fas fa-play"></i> Прослушать</button></div></div>
<section class="kurt"><div class="red-block"></div><div class="image-block left"><img src="/photo/left.png" alt="left"></div><div class="image-block right"><img src="/photo/right.png" alt="right"></div></section>
<section class="catalog-title-section2"><h3 class="catalog-title2">Для тех, для кого музыка <br> стала жизнью</h3></section>
<section class="music-section"><img src="/photo/figura.svg" class="figura" alt="figura"><div class="images-container"><img src="/photo/image 6.png" class="image" alt="image1"><img src="/photo/image 2.png" class="image" alt="image2"><img src="/photo/image 3.png" class="image" alt="image3"><img src="/photo/image 4.png" class="image" alt="image4"><img src="/photo/image 5.png" class="image" alt="image5"><img src="/photo/image 6.png" class="image" alt="image6"></div></section>
<footer><img src="/photo/logo-2.svg" class="footer-logo" alt="Plastinka"></footer>

<script>
let currentPlayingAudio = null;
let currentPlayingPlastinka = null;
let currentProductId = null;
let searchTimeout = null;
let currentModalProductId = null;
let currentUserRating = null;
let currentSelectedRating = null;
let currentFavoriteStatus = false;
let currentFavoriteBtn = null;

function showToast(message, isError) {
    const toast = document.createElement('div');
    toast.className = 'notification';
    toast.innerHTML = '<div class=\"notification-icon\">' + (isError ? '❌' : '✅') + '</div>' +
        '<div class=\"notification-content\">' +
        '<span class=\"notification-title\">' + (isError ? 'Ошибка' : 'Успешно') + '</span>' +
        '<span class=\"notification-message\">' + message + '</span>' +
        '</div><div class=\"notification-progress\"></div>';
    document.body.appendChild(toast);
    setTimeout(function() { 
        if (toast && toast.remove) toast.remove(); 
    }, 3000);
}

function renderComments(comments, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (!comments || comments.length === 0) {
        container.innerHTML = '<div class="no-comments">📝 Пока нет комментариев. Будьте первым!</div>';
        return;
    }
    
    let html = '';
    for (var i = 0; i < comments.length; i++) {
        var c = comments[i];
        var stars = '';
        for (var s = 1; s <= 5; s++) {
            if (s <= c.rating) {
                stars += '<i class="fas fa-star" style="color:#ff7a2f; font-size:10px;"></i>';
            } else {
                stars += '<i class="far fa-star" style="color:#555; font-size:10px;"></i>';
            }
        }
        html += '<div class="comment-item">' +
            '<div class="comment-header">' +
            '<span class="comment-user">' + escapeHtml(c.username) + '</span>' +
            '<span class="comment-date">' + new Date(c.created_at).toLocaleDateString() + '</span>' +
            '</div>' +
            '<div><span class="comment-rating">' + stars + '</span></div>' +
            '<div class="comment-text">' + escapeHtml(c.comment) + '</div>' +
            '</div>';
    }
    container.innerHTML = html;
}

function renderStarsInModal(containerId, rating, productId, isLarge) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    let starsHtml = '';
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    
    for (let i = 1; i <= 5; i++) {
        if (i <= fullStars) {
            starsHtml += '<i class="fas fa-star star filled" data-value="' + i + '"></i>';
        } else if (i === fullStars + 1 && hasHalfStar) {
            starsHtml += '<i class="fas fa-star-half-alt star filled" data-value="' + i + '"></i>';
        } else {
            starsHtml += '<i class="far fa-star star" data-value="' + i + '"></i>';
        }
    }
    
    container.innerHTML = starsHtml;
    
    const isLoggedIn = ${!!req.session.user};
    if (isLoggedIn) {
        const stars = container.querySelectorAll('.star');
        for (var j = 0; j < stars.length; j++) {
            var star = stars[j];
            star.style.cursor = 'pointer';
            star.addEventListener('mouseenter', function() {
                var value = parseInt(this.dataset.value);
                for (var k = 0; k < stars.length; k++) {
                    if (k < value) {
                        stars[k].classList.add('hover');
                    } else {
                        stars[k].classList.remove('hover');
                    }
                }
            });
            star.addEventListener('mouseleave', function() {
                for (var k = 0; k < stars.length; k++) {
                    stars[k].classList.remove('hover');
                }
            });
            star.addEventListener('click', function() {
                var value = parseInt(this.dataset.value);
                var commentSection = document.getElementById('modalCommentSectionDesktop');
                if (commentSection) commentSection.style.display = 'block';
                currentSelectedRating = value;
                for (var k = 0; k < stars.length; k++) {
                    if (k < value) {
                        stars[k].classList.add('filled');
                    } else {
                        stars[k].classList.remove('filled');
                    }
                }
            });
        }
    }
}

function updateCardRating(container, rating) {
    var stars = container.querySelectorAll('.star');
    var fullStars = Math.floor(rating);
    var hasHalfStar = rating % 1 >= 0.5;
    for (var i = 0; i < stars.length; i++) {
        if (i < fullStars) {
            stars[i].classList.add('filled');
        } else if (i === fullStars && hasHalfStar) {
            stars[i].classList.add('filled');
        } else {
            stars[i].classList.remove('filled');
        }
    }
    var ratingValue = container.querySelector('.rating-value');
    if (ratingValue) ratingValue.textContent = rating;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function openProductModal(id, name, artist, price, image, description, genre, year, audio) {
    currentProductId = 'product_' + id;
    currentModalProductId = id;
    document.getElementById('productModalImageDesktop').src = image;
    document.getElementById('productModalTitleDesktop').textContent = name;
    document.getElementById('productModalArtistDesktop').textContent = artist;
    document.getElementById('productModalTagsDesktop').innerHTML = '<span class=\"modal-tag\">' + genre + '</span><span class=\"modal-tag\">' + year + '</span>';
    document.getElementById('productModalDescriptionDesktop').textContent = description;
    document.getElementById('productModalPriceDesktop').innerHTML = price + ' <span>$</span>';
    
    fetch('/api/rating/' + id)
        .then(function(response) { return response.json(); })
        .then(function(data) {
            renderStarsInModal('modalRatingStarsDesktop', parseFloat(data.avg_rating), id, true);
            var votesSpan = document.getElementById('modalRatingVotesDesktop');
            if (votesSpan) votesSpan.textContent = '(' + data.votes_count + ' оценок)';
            renderComments(data.comments, 'modalCommentsListDesktop');
        });
    
    if (audio) {
        document.getElementById('productModalAudioDesktop').innerHTML = audio;
        document.getElementById('productModalPlayBtnDesktop').style.display = 'flex';
    } else {
        document.getElementById('productModalAudioDesktop').innerHTML = '';
        document.getElementById('productModalPlayBtnDesktop').style.display = 'none';
    }
    
    document.getElementById('modalCommentSectionDesktop').style.display = 'none';
    document.getElementById('modalCommentDesktop').value = '';
    currentSelectedRating = null;
    
    document.getElementById('productModalDesktop').classList.add('active');
    
    var track = document.querySelector('.player-carousel .carousel-track');
    var track2 = document.querySelector('.player-carousel2 .carousel-track2');
    if (track) track.style.animationPlayState = 'paused';
    if (track2) track2.style.animationPlayState = 'paused';
    updateFavoriteStatusDesktop(id);
}

function openPlayerModal(id, name, price, image, description) {
    document.getElementById('modalImage').src = image;
    document.getElementById('modalTitle').textContent = name;
    document.getElementById('modalDescription').textContent = description;
    document.getElementById('modalPrice').innerHTML = price + ' <span>$</span>';
    document.getElementById('modalProductId').value = 'player_' + id;
    document.getElementById('playerModal').classList.add('active');
    
    var track = document.querySelector('.player-carousel .carousel-track');
    var track2 = document.querySelector('.player-carousel2 .carousel-track2');
    if (track) track.style.animationPlayState = 'paused';
    if (track2) track2.style.animationPlayState = 'paused';
}

function performSearch(query) {
    var searchDropdown = document.getElementById('search-dropdown');
    if (!searchDropdown) return;
    
    if (query.length < 1) {
        searchDropdown.innerHTML = '';
        searchDropdown.classList.remove('show');
        return;
    }
    
    searchDropdown.innerHTML = '<div class=\"search-no-results\">🔍 Поиск...</div>';
    searchDropdown.classList.add('show');
    
    fetch('/api/search?q=' + encodeURIComponent(query))
        .then(function(response) { return response.json(); })
        .then(function(data) {
            if (!data.results || data.results.length === 0) {
                searchDropdown.innerHTML = '<div class=\"search-no-results\">🔍 Ничего не найдено</div>' +
                    '<button class=\"search-catalog-btn\" onclick=\"window.location.href=\\'/catalog\\'\">📀 Поиск в каталоге</button>';
                return;
            }
            
            var html = '';
            for (var i = 0; i < data.results.length; i++) {
                var item = data.results[i];
                var imagePath = item.type === 'product' ? '/uploads/' + item.image : '/photo/' + item.image;
                var productId = item.type + '_' + item.id;
                
                html += '<div class=\"search-result-item-dropdown\" data-type=\"' + item.type + '\" data-id=\"' + item.id + '\">';
                html += '<img src=\"' + imagePath + '\" class=\"search-result-image\" onerror=\"this.src=\\'/photo/plastinka-audio.png\\'\">';
                html += '<div class=\"search-result-info\">';
                html += '<div class=\"search-result-name\">' + escapeHtml(String(item.name)) + '</div>';
                html += '<div class=\"search-result-artist\">' + escapeHtml(String(item.artist)) + '</div>';
                html += '</div>';
                html += '<span class=\"search-result-price\">$' + item.price + '</span>';
                html += '<div class=\"search-result-actions\">';
                html += '<button class=\"search-cart-btn\" data-id=\"' + productId + '\">🛒</button>';
                html += '<button class=\"search-detail-btn\" data-id=\"' + item.id + '\" data-type=\"' + item.type + '\" data-name=\"' + escapeHtml(String(item.name)) + '\" data-artist=\"' + escapeHtml(String(item.artist)) + '\" data-price=\"' + item.price + '\" data-image=\"' + imagePath + '\" data-description=\"' + escapeHtml(String(item.description || 'Нет описания')) + '\" data-genre=\"' + (item.genre || 'Rock') + '\" data-year=\"' + (item.year || '1970') + '\" data-audio=\"' + (item.audio || '') + '\">📋</button>';
                html += '</div>';
                html += '</div>';
            }
            html += '<button class=\"search-catalog-btn\" onclick=\"window.location.href=\\'/catalog\\'\">Поиск в каталоге →</button>';
            searchDropdown.innerHTML = html;
            
            var cartBtns = searchDropdown.querySelectorAll('.search-cart-btn');
            for (var j = 0; j < cartBtns.length; j++) {
                cartBtns[j].addEventListener('click', function(e) {
                    e.stopPropagation();
                    var id = this.getAttribute('data-id');
                    fetch('/api/cart/add', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: id })
                    }).then(function() { showToast('Товар добавлен в корзину', false); });
                });
            }
            
            var detailBtns = searchDropdown.querySelectorAll('.search-detail-btn');
            for (var k = 0; k < detailBtns.length; k++) {
                detailBtns[k].addEventListener('click', function(e) {
                    e.stopPropagation();
                    searchDropdown.classList.remove('show');
                    
                    if (this.getAttribute('data-type') === 'product') {
                        openProductModal(
                            this.getAttribute('data-id'),
                            this.getAttribute('data-name'),
                            this.getAttribute('data-artist'),
                            this.getAttribute('data-price'),
                            this.getAttribute('data-image'),
                            this.getAttribute('data-description'),
                            this.getAttribute('data-genre'),
                            this.getAttribute('data-year'),
                            this.getAttribute('data-audio')
                        );
                    } else {
                        openPlayerModal(
                            this.getAttribute('data-id'),
                            this.getAttribute('data-name'),
                            this.getAttribute('data-price'),
                            this.getAttribute('data-image'),
                            this.getAttribute('data-description')
                        );
                    }
                });
            }
            
            var items = searchDropdown.querySelectorAll('.search-result-item-dropdown');
            for (var m = 0; m < items.length; m++) {
                items[m].addEventListener('click', function(e) {
                    if (e.target.tagName === 'BUTTON') return;
                    var detailBtn = this.querySelector('.search-detail-btn');
                    if (detailBtn) detailBtn.click();
                });
            }
        })
        .catch(function(error) {
            console.error('Ошибка:', error);
            searchDropdown.innerHTML = '<div class=\"search-no-results\">❌ Ошибка поиска</div>' +
                '<button class=\"search-catalog-btn\" onclick=\"window.location.href=\\'/catalog\\'\">📀 Поиск в каталоге</button>';
        });
}

document.addEventListener('DOMContentLoaded', function() {
    var searchInput = document.getElementById('desktop-search-input');
    var searchDropdown = document.getElementById('search-dropdown');
    
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            var query = this.value;
            if (searchTimeout) clearTimeout(searchTimeout);
            searchTimeout = setTimeout(function() { performSearch(query); }, 300);
        });
        
        searchInput.addEventListener('focus', function() {
            var query = this.value;
            if (query.length >= 1) performSearch(query);
        });
        
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                var query = encodeURIComponent(this.value);
                if (query) window.location.href = '/search-page?q=' + query;
            }
        });
    }
    
    document.addEventListener('click', function(e) {
        if (searchDropdown && !searchDropdown.contains(e.target) && e.target !== searchInput) {
            searchDropdown.classList.remove('show');
        }
    });
    
    var ratingContainers = document.querySelectorAll('.rating-stars');
    for (var r = 0; r < ratingContainers.length; r++) {
        var container = ratingContainers[r];
        var productId = container.dataset.productId;
        fetch('/api/rating/' + productId)
            .then(function(response) { return response.json(); })
            .then(function(data) {
                if (data.avg_rating) {
                    updateCardRating(container, parseFloat(data.avg_rating));
                    var ratingValue = container.querySelector('.rating-value');
                    if (ratingValue) ratingValue.textContent = data.avg_rating;
                    var votesSpan = container.querySelector('.votes-count');
                    if (votesSpan) votesSpan.textContent = '(' + data.votes_count + ')';
                }
            });
    }
});

document.querySelectorAll('.benefit').forEach(function(benefit) {
    var imageContainer = benefit.querySelector('.image-container');
    var audio = benefit.querySelector('.album-audio');
    var plastinka = benefit.querySelector('.plastinka');
    
    if (imageContainer && audio && plastinka) {
        imageContainer.addEventListener('mouseenter', function(e) {
            e.stopPropagation();
            if (currentPlayingAudio && currentPlayingAudio !== audio) { 
                currentPlayingAudio.pause(); 
                currentPlayingAudio.currentTime = 0; 
                if (currentPlayingPlastinka) currentPlayingPlastinka.style.animationPlayState = 'paused'; 
            }
            audio.currentTime = 0;
            audio.play().catch(function(err) { console.log('Audio play error:', err); });
            plastinka.style.animationPlayState = 'running';
            currentPlayingAudio = audio;
            currentPlayingPlastinka = plastinka;
        });
        
        imageContainer.addEventListener('mouseleave', function(e) {
            e.stopPropagation();
            audio.pause();
            audio.currentTime = 0;
            plastinka.style.animationPlayState = 'paused';
            if (currentPlayingAudio === audio) { 
                currentPlayingAudio = null; 
                currentPlayingPlastinka = null; 
            }
        });
    }
    
    benefit.addEventListener('click', function(e) {
        if (e.target.closest('.add-to-cart-form')) return;
        openProductModal(
            this.dataset.productId,
            this.dataset.productName,
            this.dataset.productArtist,
            this.dataset.productPrice,
            this.dataset.productImage,
            this.dataset.productDescription,
            this.dataset.productGenre,
            this.dataset.productYear,
            ''
        );
    });
});

async function updateFavoriteStatusDesktop(productId) {
    try {
        const response = await fetch('/api/favorites/status/product_' + productId);
        const data = await response.json();
        const favBtn = document.getElementById('productModalFavBtnDesktop');
        if (favBtn) {
            if (data.isFavorite) {
                favBtn.style.color = '#ff0000';
                favBtn.style.background = 'rgba(255, 0, 0, 0.2)';
                favBtn.style.border = '1px solid #ff0000';
            } else {
                favBtn.style.color = '#fff';
                favBtn.style.background = 'rgba(255, 255, 255, 0.1)';
                favBtn.style.border = '1px solid #ff0000';
            }
        }
    } catch (error) {
        console.error('Ошибка проверки статуса избранного:', error);
    }
}

function addToCartFromModalDesktop() { 
    fetch('/api/cart/add', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ id: currentProductId }) 
    }).then(function() { 
        showToast('Товар добавлен в корзину', false);
        closeProductModalDesktop(); 
    }); 
}
function toggleFavoriteFromModalDesktop() { 
    const fullProductId = 'product_' + currentModalProductId;
    fetch('/api/favorites/toggle', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ id: fullProductId }) 
    }).then(function(response) { 
        return response.json();
    }).then(function(data) { 
        if (data.success) {
            const favBtn = document.getElementById('productModalFavBtnDesktop');
            if (favBtn && favBtn.style.color === 'rgb(255, 0, 0)') {
                showToast('Удалено из избранного', false);
            } else {
                showToast('Добавлено в избранное', false);
            }
            if (currentModalProductId) {
                updateFavoriteStatusDesktop(currentModalProductId);
            }
        }
    }).catch(function(error) {
        console.error('Ошибка:', error);
        showToast('Ошибка при изменении избранного', true);
    }); 
}

function playModalPreviewDesktop() { 
    var audioFile = document.getElementById('productModalAudioDesktop').innerText; 
    if (audioFile) { 
        var audio = new Audio('/audio/' + audioFile); 
        audio.play(); 
    } 
}

function closeProductModalDesktop() {
    document.getElementById('productModalDesktop').classList.remove('active');
    var track = document.querySelector('.player-carousel .carousel-track');
    var track2 = document.querySelector('.player-carousel2 .carousel-track2');
    if (track) track.style.animationPlayState = 'running';
    if (track2) track2.style.animationPlayState = 'running';
}

function submitRatingWithCommentDesktop() {
    var comment = document.getElementById('modalCommentDesktop').value;
    var productId = currentModalProductId;
    var rating = currentSelectedRating;
    
    if (!rating) {
        showToast('⭐ Сначала выберите оценку!', true);
        return;
    }
    
    fetch('/api/rating/' + productId, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: rating, comment: comment || '' })
    })
    .then(function(response) { return response.json(); })
    .then(function(data) {
        if (data.success) {
            showToast('⭐ Спасибо за оценку и отзыв!', false);
            renderStarsInModal('modalRatingStarsDesktop', parseFloat(data.avg_rating), productId, true);
            var votesSpan = document.getElementById('modalRatingVotesDesktop');
            if (votesSpan) votesSpan.textContent = '(' + data.votes_count + ' оценок)';
            renderComments(data.comments, 'modalCommentsListDesktop');
            document.getElementById('modalCommentSectionDesktop').style.display = 'none';
            document.getElementById('modalCommentDesktop').value = '';
            currentSelectedRating = null;
            
            var productCardStars = document.querySelector('.rating-stars[data-product-id="' + productId + '"]');
            if (productCardStars) {
                updateCardRating(productCardStars, parseFloat(data.avg_rating));
            }
        }
    })
    .catch(function(error) {
        console.error('Ошибка:', error);
        showToast('Ошибка при сохранении оценки', true);
    });
}

var modalDesktop = document.getElementById('productModalDesktop');
var closeProductBtn = document.getElementById('closeProductModalDesktop');
if (modalDesktop && closeProductBtn) {
    closeProductBtn.addEventListener('click', closeProductModalDesktop);
    modalDesktop.addEventListener('click', function(e) {
        if (e.target === modalDesktop) closeProductModalDesktop();
    });
}

var track = document.querySelector('.player-carousel .carousel-track');
var track2 = document.querySelector('.player-carousel2 .carousel-track2');
if (track) { 
    track.addEventListener('mouseenter', function() { track.style.animationPlayState = 'paused'; }); 
    track.addEventListener('mouseleave', function() { track.style.animationPlayState = 'running'; }); 
}
if (track2) { 
    track2.addEventListener('mouseenter', function() { track2.style.animationPlayState = 'paused'; }); 
    track2.addEventListener('mouseleave', function() { track2.style.animationPlayState = 'running'; }); 
}

var modal = document.getElementById('playerModal');
var closeBtn = document.getElementById('closeModal');

function closeModal() { 
    modal.classList.remove('active'); 
    if (track) track.style.animationPlayState = 'running'; 
    if (track2) track2.style.animationPlayState = 'running'; 
}

if (closeBtn) closeBtn.addEventListener('click', closeModal);
if (modal) modal.addEventListener('click', function(e) { if (e.target === modal) closeModal(); });

var viewBtns = document.querySelectorAll('.view-btn');
for (var i = 0; i < viewBtns.length; i++) {
    viewBtns[i].addEventListener('click', function(e) { 
        e.stopPropagation(); 
        var card = this.closest('.card'); 
        if (!card) return; 
        openPlayerModal(
            card.dataset.playerId,
            card.dataset.name,
            card.dataset.price,
            card.dataset.image,
            card.dataset.description
        );
    });
}

document.addEventListener('keydown', function(e) { 
    if (e.key === 'Escape' && modal && modal.classList.contains('active')) closeModal(); 
    if (e.key === 'Escape' && document.getElementById('productModalDesktop') && document.getElementById('productModalDesktop').classList.contains('active')) closeProductModalDesktop(); 
});

var addToCartForm = document.getElementById('addToCartForm');
if (addToCartForm) {
    addToCartForm.addEventListener('submit', function() { setTimeout(closeModal, 100); });
}

function addToCartMobile(id) {
    fetch('/api/cart/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: id })
    }).then(function() { showToastMobile('Товар добавлен в корзину', false); });
}

function toggleFavoriteMobile(id) {
    fetch('/api/favorites/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: id })
    }).then(function() { showToastMobile('Добавлено в избранное', false); });
}

function showToastMobile(message, isError) {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.innerHTML = '<div style="display:flex;align-items:center;gap:8px">' + 
        '<span>' + (isError ? '❌' : '✅') + '</span>' + 
        '<span>' + message + '</span>' + 
        '</div>';
    document.body.appendChild(toast);
    setTimeout(function() { 
        if (toast && toast.remove) toast.remove(); 
    }, 3000);
}
</script>
</body>
</html>
                        `);
                    });
                });
            });
        });
    });
    
    return router;
};