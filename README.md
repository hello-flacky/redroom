# Redroom - 18+ Adult Video Streaming Platform (Node.js Express Backend REST API)

**Redroom** යනු HTML5, CSS3, JavaScript (Frontend) සහ Node.js / Express.js (Backend REST API) භාවිතයෙන් නිර්මාණය කරන ලද modern 18+ Video Streaming Web Application එකකි.

---

## 🌟 Admin-Only Video Publishing System (No Example Videos)

- **Clean Initial State**: Template එකෙහි තිබූ සියලුම Example Demo Videos ඉවත් කර ඇත (`videos: []`).
- **Dynamic Display**: Admin Panel එකෙන් (`admin.html`, Password: **`911`**) Admin වීඩියෝවක් එකතු කළ විට (Streamtape link, Title, Category, Thumbnail) **පමණක්** එම වීඩියෝව වෙබ් අඩවියේ ප්‍රදර්ශනය වේ.

---

## 🚀 Backend Server එක Run කරන්නේ කෙසේද (Express Backend)

```bash
npm install
node server.js
```

- **Main Server URL**: `http://localhost:5000`
- **Page Views Counter API**: `http://localhost:5000/api/v1/views`
- **Admin Password**: **`911`**

---

## 📡 REST API Endpoints

- `GET /api/v1/views` - Total Site Page Views Count
- `POST /api/v1/views/increment` - Increment Page Views Count
- `GET /api/v1/health` - Backend Status Check
- `POST /api/v1/auth/register` - User Registration
- `POST /api/v1/auth/login` - User Login
- `POST /api/v1/auth/admin-login` - Admin Login (PW: `911`)
- `GET /api/v1/videos` - Get Videos (supports `?search=` & `?category=`)
- `GET /api/v1/videos/:id` - Get Single Video
- `POST /api/v1/videos` - Add Video (Admin)
- `PUT /api/v1/videos/:id` - Edit Video (Admin)
- `DELETE /api/v1/videos/:id` - Delete Video (Admin)
- `GET /api/v1/categories` - Get All Categories
- `POST /api/v1/categories` - Add Category (Admin)
- `DELETE /api/v1/categories/:name` - Delete Category (Admin)
- `GET /api/v1/stats` - Platform Analytics Overview

---

## 📂 ගොනු ව්‍යුහය (File Structure)

- `index.html` - Home Page (Real-time Page Views Counter Badge)
- `login.html` - Member Login Page
- `register.html` - User Registration Page
- `admin.html` - Admin Dashboard (Password: 911)
- `server.js` - Express Backend REST API Entrypoint with Page Views Counter
- `config/db.js` - JSON Database persistence module
- `routes/views.js` - Page Views Counter API controller
- `routes/` - Auth, Videos, Categories, Stats API controllers
- `app.js` - Frontend app engine (JavaScript)
- `admin.js` - Admin portal controller (JavaScript)
- `styles.css` - Custom styles & animations
