const express = require("express");
const router = express.Router();

module.exports = (db, requireAuth, escapeHtml) => {
    
    const DEFAULT_COVER = "/uploads/666.png";
    
    function buildCatalogQuery(genre, minPrice, maxPrice, sort, search) {
        let sql = "SELECT * FROM products WHERE 1=1";
        const params = [];
        
        if (search && search.trim()) {
            sql += " AND (name LIKE ? OR artist LIKE ?)";
            const searchTerm = `%${search.trim()}%`;
            params.push(searchTerm, searchTerm);
        }
        
        if (genre && genre !== 'all') { 
            sql += " AND genre = ?"; 
            params.push(genre); 
        }
        if (minPrice) { 
            sql += " AND price >= ?"; 
            params.push(parseFloat(minPrice)); 
        }
        if (maxPrice) { 
            sql += " AND price <= ?"; 
            params.push(parseFloat(maxPrice)); 
        }
        
        switch(sort) {
            case 'price_asc': sql += " ORDER BY price ASC"; break;
            case 'price_desc': sql += " ORDER BY price DESC"; break;
            case 'name_asc': sql += " ORDER BY name ASC"; break;
            case 'name_desc': sql += " ORDER BY name DESC"; break;
            case 'artist_asc': sql += " ORDER BY artist ASC"; break;
            case 'artist_desc': sql += " ORDER BY artist DESC"; break;
            case 'year_desc': sql += " ORDER BY year DESC"; break;
            case 'year_asc': sql += " ORDER BY year ASC"; break;
            default: sql += " ORDER BY id DESC";
        }
        return { sql, params };
    }
    
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
    
    router.get("/catalog", (req, res) => {
        const user = req.session.user;
        const { genre, minPrice, maxPrice, sort, search } = req.query;
        const { sql, params } = buildCatalogQuery(genre, minPrice, maxPrice, sort, search);
        
        db.all(sql, params, (err, products) => {
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
                db.all("SELECT DISTINCT genre FROM products WHERE genre IS NOT NULL AND genre != ''", [], (err, genresResult) => {
                    const genres = genresResult ? genresResult.map(g=>g.genre) : ['Rock','Pop','Jazz','Electronic','Classical'];
                    
                    // Десктопная версия каталога
                    let productsHTML = "";
                    products.forEach(p => {
                        const coverImage = p.image ? `/uploads/${p.image}` : DEFAULT_COVER;
                        productsHTML += `
                        <div class="catalog-item" data-id="${p.id}" data-name="${escapeHtml(p.name)}" data-artist="${escapeHtml(p.artist)}" data-price="${p.price}" data-image="${coverImage}" data-description="${escapeHtml(p.description || 'Нет описания')}" data-genre="${escapeHtml(p.genre || 'Rock')}" data-year="${escapeHtml(p.year || '1970')}" data-audio="${p.audio || ''}">
                            <div class="image-container vinyl-container">
                                <img src="${coverImage}" class="catalog-album-cover" onerror="this.src='${DEFAULT_COVER}'">
                                <img src="/photo/plastinka-audio.png" class="vinyl-disc-small">
                                ${p.audio ? `<audio class="album-audio" src="/audio/${p.audio}"></audio>` : ''}
                            </div>
                            <div class="catalog-item-info">
                                <div class="catalog-item-name">${escapeHtml(p.name)}</div>
                                <div class="catalog-item-artist">${escapeHtml(p.artist)}</div>
                                <div class="rating-stars" data-product-id="${p.id}" data-rating="${p.avg_rating}">${generateStarRatingHTML(p.avg_rating, p.votes_count)}</div>
                                <div class="catalog-item-price">$${p.price}</div>
                                <div class="catalog-item-actions">
                                    <form action="/add-to-cart" method="POST">
                                        <input type="hidden" name="id" value="product_${p.id}">
                                        <button type="submit" class="catalog-cart-btn"><i class="fas fa-shopping-cart"></i> В корзину</button>
                                    </form>
                                    <button onclick="toggleFavorite('product_${p.id}')" class="catalog-fav-btn"><i class="fas fa-heart"></i></button>
                                </div>
                            </div>
                        </div>`;
                    });
                    
                    res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Каталог пластинок · Plastinka</title>
    <link rel="stylesheet" href="/style.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <style>
        .catalog-container{max-width:1400px;margin:0 auto;padding:20px}
        .catalog-header h1{text-align:center;color:white;font-weight:bold;margin-bottom:20px}
        .big-search{margin-bottom:20px}
        .big-search form{display:flex;gap:10px}
        .big-search input{flex:1;background:#1a1a1a;border:1px solid #333;border-radius:40px;padding:14px 20px;color:white;font-size:16px;outline:none;transition:border-color 0.2s}
        .big-search input:focus{border-color:#ff0000}
        .big-search button{background:linear-gradient(45deg,#ff0000,#990000);border:none;border-radius:40px;padding:0 24px;color:white;font-weight:bold;cursor:pointer;transition:transform 0.2s}
        .big-search button:hover{transform:scale(1.02)}
        .filter-btn{width:100%;background:#1a1a1a;border:1px solid #333;border-radius:40px;padding:12px 20px;color:white;font-size:14px;cursor:pointer;margin-bottom:15px;display:flex;align-items:center;justify-content:center;gap:10px;transition:all 0.3s}
        .filter-btn.active{border-color:#ff0000;background:#ff000020}
        .filters-panel{background:#181818;padding:20px;border-radius:12px;margin-bottom:30px;display:none}
        .filters-panel.open{display:block;animation:slideDown 0.3s ease}
        @keyframes slideDown{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}
        .filters-form{display:flex;flex-wrap:wrap;gap:20px;align-items:flex-end}
        .filter-group{display:flex;flex-direction:column;gap:8px}
        .filter-group label{font-size:12px;text-transform:uppercase;color:#aaa}
        .filter-group select,.filter-group input{background:#111;border:1px solid #333;color:#fff;padding:8px 12px;border-radius:8px}
        .filter-actions{display:flex;gap:10px;margin-left:auto}
        .apply-filters{background:linear-gradient(45deg,#ff0000,#990000);color:#fff;border:none;padding:8px 20px;border-radius:30px;cursor:pointer}
        .reset-filters{background:#333;color:#fff;padding:8px 20px;border-radius:30px;text-decoration:none}
        .catalog-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:30px;margin-top:30px}
        .catalog-item{background:#1a1a1a;border-radius:12px;overflow:hidden;border:1px solid #333;cursor:pointer;transition:transform 0.2s,border-color 0.2s}
        .catalog-item:hover{transform:translateY(-5px);border-color:#ff0000}
        .image-container{position:relative;aspect-ratio:1}
        .catalog-album-cover{position:relative;z-index:2;width:100%;height:100%;object-fit:cover;transition:transform 0.3s ease}
        .vinyl-disc-small{position:absolute;top:0;left:0;z-index:1;width:100%;height:100%;object-fit:cover;opacity:0;animation:spin 4s linear infinite;animation-play-state:paused}
        .image-container:hover .catalog-album-cover{transform:translateX(50%)}
        .image-container:hover .vinyl-disc-small{opacity:1;animation-play-state:running}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        .catalog-item-info{padding:15px}
        .catalog-item-name{color:white;font-size:18px;font-weight:bold}
        .catalog-item-artist{color:#aaa;font-size:14px;margin-top:4px}
        .catalog-item-price{color:#ff0000;font-size:20px;font-weight:bold;margin:10px 0}
        .catalog-item-actions{display:flex;gap:10px}
        .catalog-cart-btn{flex:1;background:linear-gradient(45deg,#ff0000,#990000);border:none;color:#fff;padding:8px;border-radius:8px;cursor:pointer;transition:opacity 0.2s}
        .catalog-cart-btn:hover{opacity:0.9}
        .catalog-fav-btn{background:#333;border:none;color:#fff;width:36px;border-radius:8px;cursor:pointer;transition:background 0.2s}
        .catalog-fav-btn:hover{background:#ff0000}
        .empty-catalog{text-align:center;padding:60px;background:#1a1a1a;border-radius:12px}
        .empty-catalog i{font-size:60px;color:#333}
        .rating-stars{display:flex;align-items:center;gap:6px;margin:8px 0}
        .rating-stars .star{font-size:14px;color:#444}
        .rating-stars .star.filled{color:#ff7a2f}
        .rating-stars .rating-value{font-size:11px;color:#ff7a2f;margin-left:6px}
        .rating-stars .votes-count{font-size:10px;color:#666}
        
        .modal-overlay{display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);z-index:2000;justify-content:center;align-items:center;padding:20px}
        .modal-overlay.active{display:flex}
        .modal-content{background:linear-gradient(145deg,#2a2a2a,#1e1e1e);border-radius:20px;padding:30px;max-width:380px;width:90%;position:relative;border:1px solid #ff7a2f;box-shadow:0 20px 40px rgba(255,122,47,0.2);animation:modalAppear 0.3s ease;max-height:85vh;overflow-y:auto}
        .modal-content::-webkit-scrollbar { width: 6px; }
        .modal-content::-webkit-scrollbar-track { background: #1a1a1a; border-radius: 10px; }
        .modal-content::-webkit-scrollbar-thumb { background: #ff7a2f; border-radius: 10px; }
        .modal-content::-webkit-scrollbar-thumb:hover { background: #ff0000; }
        @keyframes modalAppear{from{opacity:0;transform:scale(0.95)}to{opacity:1;transform:scale(1)}}
        .modal-close{position:absolute;top:15px;right:15px;background:rgba(255,255,255,0.1);border:none;color:white;font-size:24px;cursor:pointer;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;transition:all 0.2s}
        .modal-close:hover{background:#ff0000;transform:rotate(90deg)}
        .modal-player-image{width:100%;aspect-ratio:1;object-fit:cover;border-radius:12px;margin-bottom:15px;border:2px solid #ff7a2f}
        .modal-title{color:white;font-size:24px;margin:0 0 5px 0}
        .modal-artist{color:#aaa;font-size:14px;margin:0 0 10px 0}
        .modal-tags{display:flex;gap:8px;margin-bottom:15px}
        .modal-tag{background:#ff7a2f20;color:#ff7a2f;padding:4px 12px;border-radius:20px;font-size:12px;border:1px solid #ff7a2f40}
        .rating-section{margin:15px 0}
        .rating-label{font-size:12px;color:#888;margin-bottom:8px}
        .rating-stars-large{display:flex;gap:8px;margin-bottom:5px}
        .rating-stars-large .star{font-size:20px;cursor:pointer;transition:transform 0.1s;color:#444}
        .rating-stars-large .star.filled{color:#ff7a2f}
        .rating-stars-large .star.hover{transform:scale(1.1);color:#ffaa66}
        .rating-votes{font-size:11px;color:#666}
        .comment-section{margin:15px 0}
        .comment-section textarea{width:100%;background:#111;border:1px solid #333;color:white;border-radius:8px;padding:10px;margin:10px 0;resize:vertical}
        .comments-list{background:#111;border-radius:12px;padding:12px;max-height:200px;overflow-y:auto;margin:15px 0}
        .comment-item{padding:10px 0;border-bottom:1px solid #333}
        .comment-item:last-child{border-bottom:none}
        .comment-header{display:flex;justify-content:space-between;margin-bottom:5px}
        .comment-user{color:#ff7a2f;font-weight:bold;font-size:12px}
        .comment-date{color:#666;font-size:10px}
        .comment-rating{margin:5px 0}
        .comment-text{color:#ccc;font-size:13px;line-height:1.4}
        .no-comments{text-align:center;color:#666;padding:20px}
        .modal-description{color:#aaa;font-size:14px;line-height:1.5;margin:15px 0}
        .modal-price{color:#ff7a2f;font-size:28px;font-weight:bold;margin:15px 0}
        .modal-actions{display:flex;gap:10px;margin:15px 0}
        .modal-add-to-cart{flex:1;background:linear-gradient(45deg,#ff7a2f,#ff0000);border:none;border-radius:40px;padding:12px;color:white;font-weight:bold;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:transform 0.2s}
        .modal-add-to-cart:hover{transform:scale(1.02)}
        .modal-fav-btn{width:48px;background:rgba(255,255,255,0.1);border:1px solid #ff0000;border-radius:40px;color:white;cursor:pointer;transition:all 0.2s;display:flex;align-items:center;justify-content:center}
        .modal-fav-btn.active{color:#ff0000;background:rgba(255,0,0,0.2)}
        .modal-fav-btn:hover{transform:scale(1.05)}
        .modal-play-btn{width:100%;background:rgba(255,122,47,0.2);border:1px solid #ff7a2f;border-radius:40px;padding:10px;color:#ff7a2f;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:all 0.2s}
        .modal-play-btn:hover{background:#ff7a2f;color:white}
        .submit-rating-btn{width:100%;background:linear-gradient(45deg,#ff7a2f,#ff0000);border:none;border-radius:8px;padding:10px;color:white;font-weight:bold;cursor:pointer;transition:transform 0.2s}
        .submit-rating-btn:hover{transform:scale(1.02)}
        
        .notification{position:fixed;bottom:20px;right:20px;background:linear-gradient(135deg,#4CAF50,#45a049);color:white;padding:12px 16px;border-radius:10px;z-index:9999;display:flex;align-items:center;gap:10px;animation:slideInRight 0.3s forwards,slideOutRight 0.3s 2.7s forwards;font-size:13px}
        @keyframes slideInRight{to{transform:translateX(0)}}
        @keyframes slideOutRight{to{transform:translateX(400px)}}
        
        header{position:sticky;top:0;z-index:1000;display:flex;justify-content:space-between;align-items:center;padding:15px 5%;background:#0a0a0a;box-shadow:0 2px 10px rgba(0,0,0,0.3);min-height:80px}
        .logo{flex-shrink:0;z-index:2}
        .logo img{height:50px;width:auto;display:block}
        .search-bar-desktop{position:absolute;left:40%;transform:translateX(-50%);width:100%;max-width:500px;min-width:250px;background:#1a1a1a;border-radius:40px;padding:10px 20px;display:flex;align-items:center;gap:10px;border:1px solid #333;transition:border-color 0.2s;z-index:1}
        .search-bar-desktop:hover,.search-bar-desktop:focus-within{border-color:#ff0000;background:#111}
        .search-bar-desktop i{color:#ff0000;font-size:18px}
        .search-bar-desktop input{flex:1;background:transparent;border:none;color:#fff;font-size:16px;outline:none}
        .search-bar-desktop input::placeholder{color:#888}
        .right-icons{display:flex;gap:20px;align-items:center;flex-shrink:0;margin-left:auto;z-index:2}
        .right-icons a{display:flex;align-items:center;transition:all 0.25s ease;line-height:0}
        .right-icons a:hover{transform:scale(1.1);filter:drop-shadow(0 0 8px rgba(255,0,0,0.5))}
        .right-icons img{height:40px;width:auto;display:block}
        @media(max-width:900px){.search-bar-desktop{max-width:350px}}
        @media(max-width:768px){header{position:relative;justify-content:flex-start;gap:15px;min-height:auto;flex-wrap:wrap}.search-bar-desktop{position:relative;left:auto;transform:none;max-width:none;flex:1 1 200px;order:1}.right-icons{order:2;gap:15px;margin-left:0}.right-icons img{height:40px}.logo img{height:45px}}
        @media(max-width:550px){header{flex-direction:column;align-items:stretch}.logo{text-align:center}.search-bar-desktop{width:100%;max-width:100%;order:1}.right-icons{justify-content:center;order:2;gap:25px;flex-wrap:wrap}.right-icons img{height:40px}}
        @media(max-width:480px){.logo img{height:40px}.right-icons img{height:35px}.right-icons{gap:20px}}
        footer{text-align:center;padding:40px;background:#0a0a0a;margin-top:60px}
        .footer-logo{height:40px}
    </style>
</head>
<body>
<header>
    <div class="logo"><a href="/"><img src="/photo/logo.svg"></a></div>
    <div class="search-bar-desktop"><i class="fas fa-search"></i><input type="text" id="desktop-search-input" placeholder="Поиск пластинок..."></div>
    <div class="right-icons"><a href="/catalog"><img src="/photo/icon-katalog.png" alt="Каталог"></a><a href="/profile"><img src="/photo/profile_icon.png" alt="Профиль"></a><a href="/cart"><img src="/photo/knopka-korzina.svg" alt="Корзина"></a></div>
</header>

<div class="catalog-container">
    <div class="catalog-header"><h1>Каталог пластинок</h1></div>
    <div class="big-search">
        <form method="GET" action="/catalog">
            <input type="text" name="search" placeholder="Найти пластинку по названию или исполнителю..." value="${escapeHtml(search || '')}" autocomplete="off">
            <button type="submit"><i class="fas fa-search"></i> Поиск</button>
        </form>
    </div>
    <button class="filter-btn" onclick="toggleFilters()"><i class="fas fa-sliders-h"></i> Фильтры и сортировка <i class="fas fa-chevron-down"></i></button>
    <div class="filters-panel" id="filtersPanel">
        <form method="GET" action="/catalog" class="filters-form">
            <input type="hidden" name="search" value="${escapeHtml(search || '')}">
            <div class="filter-group"><label>Жанр</label><select name="genre"><option value="all">Все</option>${genres.map(g => `<option value="${g}" ${genre === g ? 'selected' : ''}>${g}</option>`).join('')}</select></div>
            <div class="filter-group"><label>Цена от</label><input type="number" name="minPrice" placeholder="0" value="${minPrice || ''}"></div>
            <div class="filter-group"><label>Цена до</label><input type="number" name="maxPrice" placeholder="1000" value="${maxPrice || ''}"></div>
            <div class="filter-group"><label>Сортировка</label><select name="sort"><option value="">По умолчанию</option><option value="price_asc" ${sort === 'price_asc' ? 'selected' : ''}>Цена ↑</option><option value="price_desc" ${sort === 'price_desc' ? 'selected' : ''}>Цена ↓</option><option value="name_asc" ${sort === 'name_asc' ? 'selected' : ''}>Название А-Я</option><option value="name_desc" ${sort === 'name_desc' ? 'selected' : ''}>Название Я-А</option><option value="artist_asc" ${sort === 'artist_asc' ? 'selected' : ''}>Исполнитель А-Я</option><option value="artist_desc" ${sort === 'artist_desc' ? 'selected' : ''}>Исполнитель Я-А</option><option value="year_desc" ${sort === 'year_desc' ? 'selected' : ''}>Год (новые сначала)</option><option value="year_asc" ${sort === 'year_asc' ? 'selected' : ''}>Год (старые сначала)</option></select></div>
            <div class="filter-actions"><button type="submit" class="apply-filters"><i class="fas fa-check"></i> Применить</button><a href="/catalog" class="reset-filters"><i class="fas fa-times"></i> Сбросить</a></div>
        </form>
    </div>
    ${products.length === 0 ? `<div class="empty-catalog"><i class="fas fa-record-vinyl"></i><p>По вашему запросу ничего не найдено</p></div>` : `<div class="catalog-grid">${productsHTML}</div>`}
</div>

<!-- Модальное окно -->
<div id="productModal" class="modal-overlay">
    <div class="modal-content">
        <button class="modal-close" id="closeProductModalDesktop">×</button>
        <img src="" alt="Пластинка" class="modal-player-image" id="productModalImageDesktop">
        <h2 class="modal-title" id="productModalTitleDesktop"></h2>
        <p class="modal-artist" id="productModalArtistDesktop"></p>
        <div class="modal-tags" id="productModalTagsDesktop"></div>
        <div class="rating-section" id="modalRatingSectionDesktop">
            <div class="rating-label">Средняя оценка:</div>
            <div class="rating-stars-large" id="modalRatingStarsDesktop"></div>
            <div class="rating-votes" id="modalRatingVotesDesktop"></div>
        </div>
        <div class="comment-section" id="modalCommentSectionDesktop" style="display:none;">
            <textarea id="modalCommentDesktop" placeholder="Напишите свой отзыв..." rows="3"></textarea>
            <button onclick="submitRatingWithCommentDesktop()" class="submit-rating-btn">Отправить оценку</button>
        </div>
        <div class="comments-list" id="modalCommentsListDesktop"></div>
        <p class="modal-description" id="productModalDescriptionDesktop"></p>
        <div class="modal-price" id="productModalPriceDesktop"></div>
        <div class="modal-actions">
            <button onclick="addToCartFromModalDesktop()" class="modal-add-to-cart" id="productModalAddToCartDesktop"><i class="fas fa-shopping-cart"></i> В корзину</button>
            <button onclick="toggleFavoriteFromModalDesktop()" class="modal-fav-btn" id="productModalFavBtnDesktop"><i class="fas fa-heart"></i></button>
        </div>
        <div id="productModalAudioDesktop" style="display:none;"></div>
        <button onclick="playModalPreviewDesktop()" class="modal-play-btn" id="productModalPlayBtnDesktop" style="display:none;"><i class="fas fa-play"></i> Прослушать</button>
    </div>
</div>

<footer><img src="/photo/logo-2.svg" class="footer-logo"></footer>

<script>
function toggleFilters() {
    const panel = document.getElementById('filtersPanel');
    const btn = document.querySelector('.filter-btn');
    if (panel) panel.classList.toggle('open');
    if (btn) btn.classList.toggle('active');
}

function toggleFavorite(id) {
    fetch('/api/favorites/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: id })
    }).then(() => showToast('Избранное обновлено', false));
}

function showToast(message, isError) {
    const toast = document.createElement('div');
    toast.className = 'notification';
    toast.innerHTML = '<div style="display:flex;align-items:center;gap:8px">' +
        '<span>' + (isError ? '❌' : '✅') + '</span>' +
        '<span>' + message + '</span>' +
        '</div>';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

document.querySelectorAll('.image-container').forEach(c => {
    const a = c.querySelector('.album-audio');
    if (a) {
        c.addEventListener('mouseenter', () => {
            a.currentTime = 0;
            a.play().catch(e => console.log('Audio error:', e));
        });
        c.addEventListener('mouseleave', () => {
            a.pause();
            a.currentTime = 0;
        });
    }
});

document.querySelectorAll('.rating-stars').forEach(container => {
    const productId = container.dataset.productId;
    fetch('/api/rating/' + productId).then(response => response.json()).then(data => {
        if (data.avg_rating) updateCardRating(container, parseFloat(data.avg_rating), data.votes_count);
    });
});

function updateCardRating(container, rating, votesCount) {
    let starsHtml = '';
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    for (let i = 1; i <= 5; i++) {
        if (i <= fullStars) starsHtml += '<i class="fas fa-star star filled"></i>';
        else if (i === fullStars + 1 && hasHalfStar) starsHtml += '<i class="fas fa-star-half-alt star filled"></i>';
        else starsHtml += '<i class="far fa-star star"></i>';
    }
    starsHtml += '<span class="rating-value">' + rating + '</span>';
    starsHtml += '<span class="votes-count">(' + votesCount + ')</span>';
    container.innerHTML = starsHtml;
    container.dataset.rating = rating;
}

// Модальное окно
let currentModalProductId = null;
let currentModalProductRealId = null;
let currentModalSelectedRating = null;

function showProductModalDesktop(id, name, artist, price, image, description, genre, year, audio) {
    currentModalProductId = 'product_' + id;
    currentModalProductRealId = id;
    document.getElementById('productModalImageDesktop').src = image;
    document.getElementById('productModalTitleDesktop').textContent = name;
    document.getElementById('productModalArtistDesktop').textContent = artist;
    document.getElementById('productModalTagsDesktop').innerHTML = '<span class="modal-tag">' + genre + '</span><span class="modal-tag">' + year + '</span>';
    document.getElementById('productModalDescriptionDesktop').textContent = description;
    document.getElementById('productModalPriceDesktop').innerHTML = price + ' <span>$</span>';
    
    if (audio && audio !== '') {
        document.getElementById('productModalAudioDesktop').innerHTML = audio;
        document.getElementById('productModalPlayBtnDesktop').style.display = 'flex';
    } else {
        document.getElementById('productModalPlayBtnDesktop').style.display = 'none';
    }
    
    fetch('/api/rating/' + id).then(r => r.json()).then(data => {
        renderStarsInModalDesktop('modalRatingStarsDesktop', parseFloat(data.avg_rating), id);
        const votesSpan = document.getElementById('modalRatingVotesDesktop');
        if (votesSpan) votesSpan.textContent = '(' + data.votes_count + ' оценок)';
        renderCommentsDesktop(data.comments, 'modalCommentsListDesktop');
    });
    
    fetch('/api/favorites/check/' + currentModalProductId).then(r => r.json()).then(data => {
        const favBtn = document.getElementById('productModalFavBtnDesktop');
        if (data.isFavorite) {
            favBtn.classList.add('active');
        } else {
            favBtn.classList.remove('active');
        }
    }).catch(() => {});
    
    document.getElementById('productModal').classList.add('active');
}

function closeProductModalDesktop() {
    document.getElementById('productModal').classList.remove('active');
    document.getElementById('modalCommentSectionDesktop').style.display = 'none';
    document.getElementById('modalCommentDesktop').value = '';
    currentModalSelectedRating = null;
    if (window.currentAudioPlayer) {
        window.currentAudioPlayer.pause();
        window.currentAudioPlayer = null;
    }
}

function renderStarsInModalDesktop(containerId, rating, productId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    let starsHtml = '';
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    
    for (let i = 1; i <= 5; i++) {
        if (i <= fullStars) starsHtml += '<i class="fas fa-star star filled" data-value="' + i + '"></i>';
        else if (i === fullStars + 1 && hasHalfStar) starsHtml += '<i class="fas fa-star-half-alt star filled" data-value="' + i + '"></i>';
        else starsHtml += '<i class="far fa-star star" data-value="' + i + '"></i>';
    }
    
    container.innerHTML = starsHtml;
    
    const isLoggedIn = ${!!req.session.user};
    if (isLoggedIn) {
        const stars = container.querySelectorAll('.star');
        stars.forEach(star => {
            star.style.cursor = 'pointer';
            star.addEventListener('mouseenter', function() {
                const value = parseInt(this.dataset.value);
                stars.forEach((s, idx) => {
                    if (idx < value) s.classList.add('hover');
                    else s.classList.remove('hover');
                });
            });
            star.addEventListener('mouseleave', () => stars.forEach(s => s.classList.remove('hover')));
            star.addEventListener('click', function() {
                const value = parseInt(this.dataset.value);
                currentModalSelectedRating = value;
                const commentSection = document.getElementById('modalCommentSectionDesktop');
                if (commentSection) commentSection.style.display = 'block';
                stars.forEach((s, idx) => {
                    if (idx < value) s.classList.add('filled');
                    else s.classList.remove('filled');
                });
            });
        });
    }
}

function renderCommentsDesktop(comments, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    if (!comments || comments.length === 0) {
        container.innerHTML = '<div class="no-comments">📝 Пока нет комментариев. Будьте первым!</div>';
        return;
    }
    
    let html = '';
    comments.forEach(c => {
        let stars = '';
        for (let s = 1; s <= 5; s++) {
            if (s <= c.rating) stars += '<i class="fas fa-star" style="color:#ff7a2f; font-size:10px;"></i>';
            else stars += '<i class="far fa-star" style="color:#555; font-size:10px;"></i>';
        }
        html += '<div class="comment-item"><div class="comment-header"><span class="comment-user">' + escapeHtml(c.username) + '</span><span class="comment-date">' + new Date(c.created_at).toLocaleDateString() + '</span></div><div class="comment-rating">' + stars + '</div><div class="comment-text">' + escapeHtml(c.comment || '') + '</div></div>';
    });
    container.innerHTML = html;
}

function submitRatingWithCommentDesktop() {
    const isLoggedIn = ${!!req.session.user};
    if (!isLoggedIn) {
        showToast('🔒 Войдите в аккаунт, чтобы оставить отзыв', true);
        return;
    }
    
    const rating = currentModalSelectedRating;
    const comment = document.getElementById('modalCommentDesktop').value;
    const productId = currentModalProductRealId;
    
    if (!rating) {
        showToast('⭐ Сначала выберите оценку!', true);
        return;
    }
    
    fetch('/api/rating/' + productId, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: rating, comment: comment || '' })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showToast('⭐ Спасибо за оценку и отзыв!', false);
            renderStarsInModalDesktop('modalRatingStarsDesktop', parseFloat(data.avg_rating), productId);
            const votesSpan = document.getElementById('modalRatingVotesDesktop');
            if (votesSpan) votesSpan.textContent = '(' + data.votes_count + ' оценок)';
            renderCommentsDesktop(data.comments, 'modalCommentsListDesktop');
            document.getElementById('modalCommentSectionDesktop').style.display = 'none';
            document.getElementById('modalCommentDesktop').value = '';
            currentModalSelectedRating = null;
            
            const productCardStars = document.querySelector('.rating-stars[data-product-id="' + productId + '"]');
            if (productCardStars) updateCardRating(productCardStars, parseFloat(data.avg_rating), data.votes_count);
        }
    })
    .catch(error => {
        console.error('Ошибка:', error);
        showToast('Ошибка при сохранении оценки', true);
    });
}

function addToCartFromModalDesktop() {
    if (currentModalProductId) {
        fetch('/api/cart/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: currentModalProductId })
        }).then(() => {
            showToast('Товар добавлен в корзину', false);
            closeProductModalDesktop();
        });
    }
}

function toggleFavoriteFromModalDesktop() {
    if (currentModalProductId) {
        fetch('/api/favorites/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: currentModalProductId })
        }).then(() => {
            const favBtn = document.getElementById('productModalFavBtnDesktop');
            if (favBtn.classList.contains('active')) {
                favBtn.classList.remove('active');
                showToast('Удалено из избранного', false);
            } else {
                favBtn.classList.add('active');
                showToast('Добавлено в избранное', false);
            }
        });
    }
}

function playModalPreviewDesktop() {
    const audioFile = document.getElementById('productModalAudioDesktop').innerText;
    if (audioFile) {
        if (window.currentAudioPlayer) window.currentAudioPlayer.pause();
        window.currentAudioPlayer = new Audio('/audio/' + audioFile);
        window.currentAudioPlayer.play();
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

document.getElementById('closeProductModalDesktop')?.addEventListener('click', closeProductModalDesktop);
document.getElementById('productModal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('productModal')) closeProductModalDesktop();
});

document.querySelectorAll('.catalog-item').forEach(item => {
    item.addEventListener('click', (e) => {
        if (e.target.closest('.catalog-cart-btn') || e.target.closest('.catalog-fav-btn')) return;
        showProductModalDesktop(
            item.dataset.id,
            item.dataset.name,
            item.dataset.artist,
            item.dataset.price,
            item.dataset.image,
            item.dataset.description,
            item.dataset.genre,
            item.dataset.year,
            item.dataset.audio || ''
        );
    });
});

const searchInput = document.getElementById('desktop-search-input');
if (searchInput) {
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            const q = encodeURIComponent(this.value);
            if (q) window.location.href = '/catalog?search=' + q;
        }
    });
}
</script>
</body>
</html>
                    `);
                });
            });
        });
    });
    
    router.get("/search-page", (req, res) => {
        const query = req.query.q || '';
        res.redirect(`/catalog?search=${encodeURIComponent(query)}`);
    });
    
    return router;
};