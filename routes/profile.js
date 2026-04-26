const express = require("express");
const router = express.Router();

module.exports = (db, requireAuth, escapeHtml) => {
    
    router.get("/profile", requireAuth, (req, res) => {
        const user = req.session.user;
        db.get("SELECT avatar FROM users WHERE id = ?", [user.id], (err, userData) => {
            const avatar = userData ? userData.avatar : 'default-avatar.png';
            
            db.get("SELECT COUNT(*) as favs FROM favorites WHERE user_id = ?", [user.id], (err, favs) => {
                const favCount = favs ? favs.favs : 0;
                
                // Профиль пользователя (упрощенная версия для демонстрации)
                res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Мой профиль · Plastinka</title>
    <link rel="stylesheet" href="/style.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <style>
        .profile-wrapper{max-width:1000px;margin:40px auto;padding:0 20px}
        .profile-card{background:rgba(24,24,24,0.95);backdrop-filter:blur(10px);border-radius:32px;border:1px solid rgba(255,0,0,0.3);overflow:hidden}
        .profile-cover{height:160px;background:linear-gradient(135deg,#ff0000,#990000);position:relative}
        .profile-avatar-wrapper{position:relative;text-align:center;margin-top:-70px;z-index:2}
        .profile-avatar{width:130px;height:130px;border-radius:50%;border:5px solid #1a1a1a;object-fit:cover;cursor:pointer;transition:0.3s}
        .profile-avatar:hover{opacity:0.8;transform:scale(1.02)}
        .profile-name{text-align:center;font-size:32px;font-weight:700;margin-top:15px}
        .profile-role{text-align:center;color:#ff4444;font-size:16px;margin-top:5px}
        .profile-stats{display:flex;justify-content:center;gap:60px;padding:25px;background:rgba(0,0,0,0.3);margin:25px 30px;border-radius:24px}
        .stat{text-align:center;padding:10px 20px;background:rgba(255,255,255,0.05);border-radius:20px;min-width:120px}
        .stat-value{font-size:32px;font-weight:bold;color:#ff4444}
        .stat-label{color:#aaa;font-size:13px;margin-top:5px}
        .profile-menu{margin:20px 30px 30px;display:flex;flex-direction:column;gap:12px}
        .menu-item{display:flex;align-items:center;gap:18px;padding:16px 20px;background:rgba(10,10,10,0.6);border-radius:20px;color:white;transition:all 0.2s;border:1px solid #333;cursor:pointer}
        .menu-item:hover{background:rgba(255,0,0,0.1);border-color:#ff0000;transform:translateX(8px)}
        .menu-item i:first-child{width:30px;font-size:20px;color:#ff4444}
        .menu-item span{flex:1;font-size:16px}
        .logout-btn{display:block;margin:15px 30px;padding:16px;text-align:center;border-radius:20px;font-weight:bold;font-size:16px;background:transparent;color:#ff4444;border:1px solid #ff4444;text-decoration:none;transition:0.2s}
        .logout-btn:hover{background:rgba(255,68,68,0.1);transform:translateY(-2px)}
        footer{text-align:center;padding:40px;background:#0a0a0a;margin-top:60px}
        .footer-logo{height:40px}
        @media(max-width:600px){.profile-stats{gap:20px;margin:15px;padding:15px}.stat{min-width:80px;padding:8px 12px}.stat-value{font-size:24px}.profile-name{font-size:24px}.profile-avatar{width:100px;height:100px;margin-top:-50px}.profile-cover{height:120px}}
        
        header{position:sticky;top:0;z-index:1000;display:flex;justify-content:space-between;align-items:center;padding:15px 5%;background:#0a0a0a;min-height:80px}
        .logo img{height:50px}
        .search-bar-desktop{position:absolute;left:40%;transform:translateX(-50%);max-width:500px;background:#1a1a1a;border-radius:40px;padding:10px 20px;display:flex;align-items:center;gap:10px;border:1px solid #333}
        .search-bar-desktop i{color:#ff0000}
        .search-bar-desktop input{flex:1;background:transparent;border:none;color:#fff;outline:none}
        .right-icons{display:flex;gap:20px;margin-left:auto}
        .right-icons a{transition:0.25s}
        .right-icons a:hover{transform:scale(1.1)}
        .right-icons img{height:40px}
        @media(max-width:768px){header{position:relative;flex-wrap:wrap}.search-bar-desktop{position:relative;left:auto;transform:none;order:1}.right-icons{order:2;margin-left:0}}
    </style>
</head>
<body>
<header>
    <div class="logo"><a href="/"><img src="/photo/logo.svg"></a></div>
    <div class="search-bar-desktop"><i class="fas fa-search"></i><input type="text" id="desktop-search-input" placeholder="Поиск пластинок..."></div>
    <div class="right-icons"><a href="/catalog"><img src="/photo/icon-katalog.png"></a><a href="/profile"><img src="/photo/profile_icon.png"></a><a href="/cart"><img src="/photo/knopka-korzina.svg"></a></div>
</header>

<div class="profile-wrapper">
    <div class="profile-card">
        <div class="profile-cover"></div>
        <div class="profile-avatar-wrapper">
            <img src="/avatars/${avatar}" class="profile-avatar" id="profileAvatar">
            <h2 class="profile-name">${escapeHtml(user.username)}</h2>
            <div class="profile-role">${user.role === 'admin' ? 'Администратор' : '🎧 Меломан'}</div>
        </div>
        <div class="profile-stats">
            <div class="stat"><div class="stat-value">0</div><div class="stat-label">Заказов</div></div>
            <div class="stat"><div class="stat-value">${favCount}</div><div class="stat-label">Избранное</div></div>
            <div class="stat"><div class="stat-value">—</div><div class="stat-label">На сайте</div></div>
        </div>
        <div class="profile-menu">
            <div class="menu-item" onclick="alert('Настройки аккаунта в разработке')">
                <i class="fas fa-user-edit"></i>
                <span>Настройки аккаунта</span>
                <i class="fas fa-chevron-right arrow"></i>
            </div>
            <div class="menu-item" onclick="window.location.href='/favorites'">
                <i class="fas fa-heart"></i>
                <span>Избранные пластинки</span>
                <i class="fas fa-chevron-right arrow"></i>
            </div>
        </div>
        ${user.role === 'admin' ? '<a href="/admin" class="logout-btn" style="background:linear-gradient(45deg,#ff0000,#990000);color:white;border:none;margin-bottom:10px;"><i class="fas fa-crown"></i> Админ панель</a>' : ''}
        <a href="/logout" class="logout-btn"><i class="fas fa-sign-out-alt"></i> Выйти из аккаунта</a>
    </div>
</div>

<footer><img src="/photo/logo-2.svg" class="footer-logo"></footer>

<script>
const searchInput = document.getElementById('desktop-search-input');
if(searchInput) {
    searchInput.addEventListener('keypress', function(e) {
        if(e.key === 'Enter') {
            const q = encodeURIComponent(this.value);
            if(q) window.location.href = '/catalog?search=' + q;
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
    
    return router;
};