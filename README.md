# Redroom - Modern 18+ Video Streaming Platform

**Redroom** යනු HTML5, Tailwind CSS, JavaScript සහ Firebase Database (Firestore) භාවිතයෙන් නිර්මාණය කරන ලද modern 18+ Video Streaming Web Application එකකි. 

---

## 🌟 Key Features (ප්‍රධාන පහසුකම්)

### 🚀 Frontend (User View)
- **Firebase Realtime Sync**: Videos, Playlists සහ View Counts (100% real-time update).
- **Advanced Video Player (Streamtape)**: Mobile-friendly Full-screen Video Player Modal.
- **Playlists System**: Playlists නිර්මාණය කිරීම, ඒවාට වීඩියෝස් ඇතුලත් කිරීම සහ අදාළ Playlist එක නැරඹීමේ පහසුකම.
- **Dynamic Age Gate (18+)**: වෙබ් අඩවියට පිවිසීමේදී අනිවාර්යයෙන්ම අවුරුදු 18 ට වැඩි බව තහවුරු කළ යුතු වීම.
- **Smart Search (Desktop & Mobile)**: Videos, Categories, සහ Playlists යන සියල්ලම එකවර search කිරීමේ පහසුකම.
- **History API Routing**: Video එකක් හෝ Playlist එකක් නැරඹීමේදී system back button එක භාවිතා කර ආපසු යා හැකි වීම (PushState & PopState).
- **Direct Link Monetization**: User ගේ පළමු click එකේදීම background (pop-under) විදියට direct ad link එකක් විවෘත වන අතර, එය සෑම විනාඩියකට වරක්ම ක්‍රියාත්මක වේ.
- **Ad-blocker Warning Marquee**: පාරිභෝගිකයින්ට Ad-blocker ඉවත් කිරීමට මතක් කිරීමේ scrolling animation එක.
- **Dynamic Badges**: අලුතෙන් upload කරන වීඩියෝ වලට පැය 48 ක් යනතුරු "NEW" badge එකක් සහ category badge එකක් දිස්වීම.
- **Time Ago Format**: වීඩියෝවක් upload කර විනාඩි 5ක් යනතුරු "Just now" ලෙසත්, ඉන්පසු දිනය හා වේලාවත් (Date & Time) පෙන්වීම.
- **Theme Toggle**: Light / Dark mode අතින් වෙනස් කිරීමේ හැකියාව.

### 🛡️ Admin Panel (`admin.html`)
- **Secure Access**: Admin dashboard එකට පිවිසීම සඳහා රහස් පදයක් (Password) අවශ්‍ය වේ.
- **Manage Videos**: Streamtape links හරහා අලුත් videos එකතු කිරීම, edit කිරීම, සහ delete කිරීම.
- **Manage Playlists**: Playlist එකතු කිරීම, Cover image url එකක් ලබාදීම (නැතිනම් පළමු වීඩියෝවේ thumbnail එක auto ගැනීම), සහ ඒවාට videos ඇතුලත් කිරීම.
- **Live Previews**: Video හෝ Playlist thumbnail link එකක් ලබා දුන් සැනින් එය නිවැරදිව වැඩ කරන්නේදැයි පෙන්වන Live Image Preview පහසුකම.
- **Auto-Formatting**: Imgur links (e.g. `https://imgur.com/...`) ලබා දුන් විට එය ස්වයංක්‍රීයව `i.imgur.com/...png` ලෙස format වීම.
- **Real-time Stats**: Admin dashboard එකෙහි මුළු views ගණන සහ වීඩියෝ ගණන පෙන්වීම.

---

## 📂 ගොනු ව්‍යුහය (File Structure)

- `index.html` - Home Page & Video/Playlist Viewers
- `admin.html` - Admin Dashboard 
- `styles.css` - Tailwind Custom CSS & Animations
- `app.js` - Frontend logic, History API, Video Player, Search & Ad Network Integration
- `admin.js` - Admin portal logic, Video/Playlist CRUD operations 
- `firebase-config.js` - Firebase initialization & Firestore database setup
- `assets/Thumbnail.png` - Default Fallback Thumbnail Image

---

## 🚀 Setup & Run (ක්‍රියාත්මක කරන ආකාරය)

මෙය Serverless (Firebase) Application එකක් බැවින් විශේෂයෙන් Backend Node.js Server එකක් අවශ්‍ය නොවේ. 

1. **Live Server** හරහා හෝ යම්කිසි Web Hosting එකක් හරහා `index.html` ගොනුව විවෘත කරන්න.
2. Firebase Database එකට සෘජුවම සම්බන්ධ වී ඇති බැවින් දත්ත සියල්ල ස්වයංක්‍රීයව load වනු ඇත.
