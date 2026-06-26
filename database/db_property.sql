-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Waktu pembuatan: 26 Jun 2026 pada 16.36
-- Versi server: 10.4.32-MariaDB
-- Versi PHP: 8.1.25

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `db_property`
--

-- --------------------------------------------------------

--
-- Struktur dari tabel `chat_messages`
--

CREATE TABLE `chat_messages` (
  `id` int(11) NOT NULL,
  `chatSessionId` int(11) NOT NULL,
  `user_id` varchar(50) DEFAULT NULL,
  `role` varchar(50) NOT NULL,
  `message` text NOT NULL,
  `channel` varchar(50) NOT NULL DEFAULT 'website_chatbot',
  `metadata` text DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data untuk tabel `chat_messages`
--

INSERT INTO `chat_messages` (`id`, `chatSessionId`, `user_id`, `role`, `message`, `channel`, `metadata`, `createdAt`, `updatedAt`) VALUES
(1, 25, 'LFGKT49002', 'customer', 'Hi... Saya mau cari rumah di Surabaya, saya butuh sewa rumah selama 3 tahun.', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"22ea6d03-c876-46f0-9715-720bf5d78e11\",\"platform\":\"timelinesai\"}', '2026-06-25 10:06:37', '2026-06-25 10:06:37'),
(2, 25, 'LFGKT49002', 'ai', 'Boleh tahu, apa yang membuat Kak mulai cari rumah sekarang? Misalnya mau pindah, keluarga nambah, pindah kerja, atau untuk investasi?', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-25 10:06:37', '2026-06-25 10:06:37'),
(3, 25, 'LFGKT49002', 'customer', 'Saya ada pindahan kerja', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"54776d94-a1ae-4134-844c-10cbad86f8dc\",\"platform\":\"timelinesai\"}', '2026-06-25 10:07:16', '2026-06-25 10:07:16'),
(4, 25, 'LFGKT49002', 'ai', 'Sebelumnya sudah sempat lihat beberapa rumah, Kak? Kalau sudah, biasanya apa yang bikin belum cocok?', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-25 10:07:16', '2026-06-25 10:07:16'),
(5, 25, 'LFGKT49002', 'customer', 'Saya belum pernah lihat-lihat rumah yang disewakan, namun saya cari rumah yang asri, dingin dan tidak banjir.', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"75fc837f-9498-4dc4-83f9-63ff97af81d8\",\"platform\":\"timelinesai\"}', '2026-06-25 10:08:12', '2026-06-25 10:08:12'),
(6, 25, 'LFGKT49002', 'ai', 'Di *Surabaya* ada yang di kisaran *2–5 juta/bln* dan ada yang lebih di *10–25 juta/bln*. Kira-kira yang mana lebih mendekati rencana Kak? 💰', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-25 10:08:12', '2026-06-25 10:08:12'),
(7, 25, 'LFGKT49002', 'customer', 'Saya Bakan pindah tahun depan, Kak', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"87950c3b-9bea-4654-a8ed-3eb9967956e7\",\"platform\":\"timelinesai\"}', '2026-06-25 10:08:27', '2026-06-25 10:08:27'),
(8, 25, 'LFGKT49002', 'ai', 'Kalau nanti ada yang cocok, langsung bisa jadwalkan survey, atau perlu koordinasi dulu dengan keluarga, Kak?', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-25 10:08:27', '2026-06-25 10:08:27'),
(9, 25, 'LFGKT49002', 'customer', 'Boleh.. kapan saya bisa viewing?', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"24417d24-8605-4231-833e-3dd40e7445f2\",\"platform\":\"timelinesai\"}', '2026-06-25 10:17:43', '2026-06-25 10:17:43'),
(10, 25, 'LFGKT49002', 'ai', 'Selain *Surabaya*, ada area lain yang masih oke buat Kak pertimbangkan? 🗺️', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-25 10:17:43', '2026-06-25 10:17:43'),
(11, 25, 'LFGKT49002', 'customer', 'Cukup di surabaya saja', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"44580b9f-b0c4-4cc4-b1e1-d350fbe0bff8\",\"platform\":\"timelinesai\"}', '2026-06-25 10:18:11', '2026-06-25 10:18:11'),
(12, 25, 'LFGKT49002', 'ai', 'Furniturnya prefer *Full Furnished*, *Semi*, atau *Kosongan*, Kak? 🛋️', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-25 10:18:12', '2026-06-25 10:18:12'),
(13, 25, 'LFGKT49002', 'customer', 'semi furnished, ada ac, cctv, satpam, one gate sistem dan ada kolam renang.', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"7f03c611-988b-4279-a29d-024ffa884424\",\"platform\":\"timelinesai\"}', '2026-06-25 10:18:57', '2026-06-25 10:18:57'),
(14, 25, 'LFGKT49002', 'ai', 'Baik, semua sudah saya catat! 📝 📋 Prioritas Tinggi\n\n✓ Rencana: *Sewa*\n✓ Tipe: *Rumah*\n✓ Lokasi: *Surabaya*\n✓ Masuk: *25 Juni 2027*\n✓ Keputusan bersama: *Disebutkan di Q4*\n✓ Furnitur: *Semi furnished*\n✓ Fasilitas: *Kolam renang, Keamanan 24 jam, AC*\n✗ Budget: *(Belum ditanyakan)*\n✗ Patokan lokasi: *(Belum ditanyakan)*\n✓ Preferensi: *Lingkungan sejuk & asri*\n✓ Hindari: *Tidak mau banjir*\n\nSaya akan segera menghubungi Anda dengan rekomendasi properti yang paling sesuai! 🏠\n\nTerima kasih sudah menghubungi saya. 🙏\n\nSalam hangat,\n*LEO FELIX*\n*Elevan Property*', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-25 10:18:57', '2026-06-25 10:18:57'),
(15, 31, 'LFGKT49002', 'customer', 'Hi.. Mau cari apartemen di surabaya', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782439578078\",\"platform\":\"kirimi\"}', '2026-06-26 02:06:18', '2026-06-26 02:06:18'),
(16, 31, 'LFGKT49002', 'ai', 'Untuk *Apartemen* yang Anda cari — rencananya untuk *sewa* atau *beli*? 🏠', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 02:06:18', '2026-06-26 02:06:18'),
(17, 31, 'LFGKT49002', 'customer', 'Hi.. Mau cari apartemen di surabaya', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782439940098\",\"platform\":\"kirimi\"}', '2026-06-26 02:12:20', '2026-06-26 02:12:20'),
(18, 31, 'LFGKT49002', 'ai', 'Untuk *Apartemen* yang Anda cari — rencananya untuk *sewa* atau *beli*? 🏠', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 02:12:20', '2026-06-26 02:12:20'),
(19, 32, 'LFGKT49002', 'customer', 'Untuk *Apartemen* yang Anda cari — rencananya untuk *sewa* atau *beli*? 🏠\n\n> _Sent via propmatches.netlify.app_', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782439943902\",\"platform\":\"kirimi\"}', '2026-06-26 02:12:23', '2026-06-26 02:12:23'),
(20, 32, 'LFGKT49002', 'ai', 'Oke, mau *sewa Apartemen*. 📍\n\nDi kota atau area mana yang Anda pertimbangkan?', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 02:12:24', '2026-06-26 02:12:24'),
(21, 32, 'LFGKT49002', 'customer', 'Oke, mau *sewa Apartemen*. 📍\n\nDi kota atau area mana yang Anda pertimbangkan?\n\n> _Sent via propmatches.netlify.app_', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782439946007\",\"platform\":\"kirimi\"}', '2026-06-26 02:12:26', '2026-06-26 02:12:26'),
(22, 32, 'LFGKT49002', 'ai', 'Sudah lihat berapa Apartemen di *kota atau area mana*? Apa yang membuat belum cocok dari yang sudah dilihat?', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 02:12:26', '2026-06-26 02:12:26'),
(23, 32, 'LFGKT49002', 'customer', 'Sudah lihat berapa Apartemen di *kota atau area mana*? Apa yang membuat belum cocok dari yang sudah dilihat?\n\n> _Sent via propmatches.netlify.app_', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782439948463\",\"platform\":\"kirimi\"}', '2026-06-26 02:12:28', '2026-06-26 02:12:28'),
(24, 32, 'LFGKT49002', 'ai', 'Di *kota atau area mana* ada *Apartemen* yang di kisaran *2–5 juta/bln* dan ada juga yang *8–20 juta/bln*. Kira-kira yang mana lebih sesuai dengan rencana Anda? 💰', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 02:12:28', '2026-06-26 02:12:28'),
(25, 32, 'LFGKT49002', 'customer', 'Di *kota atau area mana* ada *Apartemen* yang di kisaran *2–5 juta/bln* dan ada juga yang *8–20 juta/bln*. Kira-kira yang mana lebih sesuai dengan rencana Anda? 💰\n\n> _Sent via propmatches.netlify.app_', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782439951136\",\"platform\":\"kirimi\"}', '2026-06-26 02:12:31', '2026-06-26 02:12:31'),
(26, 32, 'LFGKT49002', 'ai', 'Rencananya masuk atau pindah bulan apa? 📅', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 02:12:31', '2026-06-26 02:12:31'),
(27, 32, 'LFGKT49002', 'customer', 'Rencananya masuk atau pindah bulan apa? 📅\n\n> _Sent via propmatches.netlify.app_', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782439953707\",\"platform\":\"kirimi\"}', '2026-06-26 02:12:33', '2026-06-26 02:12:33'),
(28, 32, 'LFGKT49002', 'ai', 'Untuk furnitur, lebih prefer yang sudah *furnished*, *semi-furnished*, atau *kosongan* saja? 🛋️', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 02:12:33', '2026-06-26 02:12:33'),
(29, 32, 'LFGKT49002', 'customer', 'Untuk furnitur, lebih prefer yang sudah *furnished*, *semi-furnished*, atau *kosongan* saja? 🛋️\n\n> _Sent via propmatches.netlify.app_', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782439956402\",\"platform\":\"kirimi\"}', '2026-06-26 02:12:36', '2026-06-26 02:12:36'),
(30, 32, 'LFGKT49002', 'ai', 'Ada fasilitas tertentu yang Anda inginkan? Misalnya AC, kolam renang, gym, keamanan 24 jam, atau yang lainnya? 🏊', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 02:12:36', '2026-06-26 02:12:36'),
(31, 32, 'LFGKT49002', 'customer', 'Ada fasilitas tertentu yang Anda inginkan? Misalnya AC, kolam renang, gym, keamanan 24 jam, atau yang lainnya? 🏊\n\n> _Sent via propmatches.netlify.app_', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782439958642\",\"platform\":\"kirimi\"}', '2026-06-26 02:12:38', '2026-06-26 02:12:38'),
(32, 32, 'LFGKT49002', 'ai', 'Ada yang pasti tidak cocok? Misalnya yang hadap barat, dekat jalan ramai, gang sempit, atau rumah tua? 🚫', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 02:12:38', '2026-06-26 02:12:38'),
(33, 32, 'LFGKT49002', 'customer', 'Ada yang pasti tidak cocok? Misalnya yang hadap barat, dekat jalan ramai, gang sempit, atau rumah tua? 🚫\n\n> _Sent via propmatches.netlify.app_', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782439960829\",\"platform\":\"kirimi\"}', '2026-06-26 02:12:40', '2026-06-26 02:12:40'),
(34, 32, 'LFGKT49002', 'ai', 'Halo Kak, saya asisten dari *LEO FELIX* (*Elevan Property*). Saya bantu catat kebutuhannya dulu ya. Untuk rumahnya, rencananya mau *beli* atau *sewa*, Kak? 🏠', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 02:12:41', '2026-06-26 02:12:41'),
(35, 32, 'LFGKT49002', 'customer', 'Halo Kak, saya asisten dari *LEO FELIX* (*Elevan Property*). Saya bantu catat kebutuhannya dulu ya. Untuk rumahnya, rencananya mau *beli* atau *sewa*, Kak? 🏠\n\n> _Sent via propmatches.netlify.app_', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782439963112\",\"platform\":\"kirimi\"}', '2026-06-26 02:12:43', '2026-06-26 02:12:43'),
(36, 32, 'LFGKT49002', 'ai', 'Rumahnya di kota atau area mana yang Kak incar? 📍', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 02:12:43', '2026-06-26 02:12:43'),
(37, 31, 'LFGKT49002', 'customer', 'Saya mau sewa apartemen, saya rencana masuk 16 sep ini. Saya butuh sewa 2 minggu', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782439986214\",\"platform\":\"kirimi\"}', '2026-06-26 02:13:06', '2026-06-26 02:13:06'),
(38, 31, 'LFGKT49002', 'ai', 'Sudah lihat berapa Apartemen di *Surabaya*? Apa yang membuat belum cocok dari yang sudah dilihat?', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 02:13:06', '2026-06-26 02:13:06'),
(39, 32, 'LFGKT49002', 'customer', 'Sudah lihat berapa Apartemen di *Surabaya*? Apa yang membuat belum cocok dari yang sudah dilihat?\n\n> _Sent via propmatches.netlify.app_', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782439988536\",\"platform\":\"kirimi\"}', '2026-06-26 02:13:08', '2026-06-26 02:13:08'),
(40, 32, 'LFGKT49002', 'ai', 'Untuk *Apartemen* yang Anda cari — rencananya untuk *sewa* atau *beli*? 🏠', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 02:13:08', '2026-06-26 02:13:08'),
(41, 31, 'LFGKT49002', 'customer', 'Belum pernah lihat, saya cuma tau anderson di surabaya', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782440015637\",\"platform\":\"kirimi\"}', '2026-06-26 02:13:35', '2026-06-26 02:13:35'),
(42, 31, 'LFGKT49002', 'ai', 'Di *Surabaya* ada *Apartemen* yang di kisaran *Rp 5.500.000 / month* dan ada juga yang *Rp 13.750.000 / month*. Kira-kira yang mana lebih sesuai dengan rencana Anda? 💰', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 02:13:35', '2026-06-26 02:13:35'),
(43, 32, 'LFGKT49002', 'customer', 'Di *Surabaya* ada *Apartemen* yang di kisaran *Rp 5.500.000 / month* dan ada juga yang *Rp 13.750.000 / month*. Kira-kira yang mana lebih sesuai dengan rencana Anda? 💰\n\n> _Sent via propmatches.netlify.app_', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782440018704\",\"platform\":\"kirimi\"}', '2026-06-26 02:13:38', '2026-06-26 02:13:38'),
(44, 32, 'LFGKT49002', 'ai', 'Untuk *Apartemen* yang Anda cari — rencananya untuk *sewa* atau *beli*? 🏠', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 02:13:38', '2026-06-26 02:13:38'),
(45, 31, 'LFGKT49002', 'customer', 'Saya butuh 2 minggu sewa, cari yang 1-1.6juta/minggu', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782440058220\",\"platform\":\"kirimi\"}', '2026-06-26 02:14:18', '2026-06-26 02:14:18'),
(46, 31, 'LFGKT49002', 'ai', 'Nanti akan tinggal bersama siapa saja? Biar saya bisa carikan yang pas jumlah kamarnya 🛏️', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 02:14:18', '2026-06-26 02:14:18'),
(47, 31, 'LFGKT49002', 'customer', 'Saya sendiri aja', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782440068035\",\"platform\":\"kirimi\"}', '2026-06-26 02:14:28', '2026-06-26 02:14:28'),
(48, 31, 'LFGKT49002', 'ai', 'Untuk furnitur, lebih prefer yang sudah *furnished*, *semi-furnished*, atau *kosongan* saja? 🛋️', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 02:14:28', '2026-06-26 02:14:28'),
(49, 32, 'LFGKT49002', 'customer', 'Untuk furnitur, lebih prefer yang sudah *furnished*, *semi-furnished*, atau *kosongan* saja? 🛋️\n\n> _Sent via propmatches.netlify.app_', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782440070834\",\"platform\":\"kirimi\"}', '2026-06-26 02:14:30', '2026-06-26 02:14:30'),
(50, 32, 'LFGKT49002', 'ai', 'Untuk *Apartemen* yang Anda cari — rencananya untuk *sewa* atau *beli*? 🏠', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 02:14:31', '2026-06-26 02:14:31'),
(51, 31, 'LFGKT49002', 'customer', 'semi fusnish aja, Kak. Tapi saya mau ada peralatan dapur, gym, kolam renang. Lokasi dekat cafe dan depot makan.', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782440133600\",\"platform\":\"kirimi\"}', '2026-06-26 02:15:33', '2026-06-26 02:15:33'),
(52, 31, 'LFGKT49002', 'ai', 'Ada yang pasti tidak cocok? Misalnya yang hadap barat, dekat jalan ramai, gang sempit, atau rumah tua? 🚫', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 02:15:33', '2026-06-26 02:15:33'),
(53, 32, 'LFGKT49002', 'customer', 'Ada yang pasti tidak cocok? Misalnya yang hadap barat, dekat jalan ramai, gang sempit, atau rumah tua? 🚫\n\n> _Sent via propmatches.netlify.app_', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782440136648\",\"platform\":\"kirimi\"}', '2026-06-26 02:15:36', '2026-06-26 02:15:36'),
(54, 32, 'LFGKT49002', 'ai', 'Halo Kak, saya asisten dari *LEO FELIX* (*Elevan Property*). Saya bantu catat kebutuhannya dulu ya. Untuk rumahnya, rencananya mau *beli* atau *sewa*, Kak? 🏠', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 02:15:36', '2026-06-26 02:15:36'),
(55, 31, 'LFGKT49002', 'customer', 'Terserah, Kak', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782440145912\",\"platform\":\"kirimi\"}', '2026-06-26 02:15:45', '2026-06-26 02:15:45'),
(56, 31, 'LFGKT49002', 'ai', 'Selain lokasi *Surabaya*, apakah Anda mau pilihan lokasi lainnya? 🗺️', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 02:15:46', '2026-06-26 02:15:46'),
(57, 31, 'LFGKT49002', 'customer', 'Boleh..', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782441261973\",\"platform\":\"kirimi\"}', '2026-06-26 02:34:21', '2026-06-26 02:34:21'),
(58, 31, 'LFGKT49002', 'ai', 'Kalau nanti ada yang cocok, langsung bisa jadwalkan viewing atau perlu koordinasi dulu sama keluarga lain? 📅', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 02:34:22', '2026-06-26 02:34:22'),
(59, 32, 'LFGKT49002', 'customer', 'Kalau nanti ada yang cocok, langsung bisa jadwalkan viewing atau perlu koordinasi dulu sama keluarga lain? 📅\n\n> _Sent via propmatches.netlify.app_', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782441265054\",\"platform\":\"kirimi\"}', '2026-06-26 02:34:25', '2026-06-26 02:34:25'),
(60, 32, 'LFGKT49002', 'ai', 'Halo Kak, saya asisten dari *LEO FELIX* (*Elevan Property*). Saya bantu catat kebutuhannya dulu ya. Untuk rumahnya, rencananya mau *beli* atau *sewa*, Kak? 🏠', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 02:34:25', '2026-06-26 02:34:25'),
(61, 31, 'LFGKT49002', 'customer', 'Mau lihat katalognya aja kak. Saya enggak ada waktu untuk survei', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782441346261\",\"platform\":\"kirimi\"}', '2026-06-26 02:35:46', '2026-06-26 02:35:46'),
(62, 31, 'LFGKT49002', 'ai', 'Untuk apartemen, ada preferensi tower atau lantai tertentu? Misalnya hadap timur, lantai rendah/tengah/tinggi? 🏢', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 02:35:46', '2026-06-26 02:35:46'),
(63, 32, 'LFGKT49002', 'customer', 'Untuk apartemen, ada preferensi tower atau lantai tertentu? Misalnya hadap timur, lantai rendah/tengah/tinggi? 🏢\n\n> _Sent via propmatches.netlify.app_', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782441348879\",\"platform\":\"kirimi\"}', '2026-06-26 02:35:48', '2026-06-26 02:35:48'),
(64, 32, 'LFGKT49002', 'ai', 'Untuk *Apartemen* yang Anda cari — rencananya untuk *sewa* atau *beli*? 🏠', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 02:35:49', '2026-06-26 02:35:49'),
(65, 31, 'LFGKT49002', 'customer', 'Antara lantai 15-20 aja, Kak. Pokok tempatnya adem.', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782441390645\",\"platform\":\"kirimi\"}', '2026-06-26 02:36:30', '2026-06-26 02:36:30'),
(66, 31, 'LFGKT49002', 'ai', 'Baik, semua sudah saya catat! 📝 🔥 Prioritas Tinggi\n\n✓ Rencana: *Sewa*\n✓ Tipe: *Apartemen*\n✓ Lokasi: *Surabaya*\n✓ Budget: *15-20/minggu*\n✓ Masuk: *16 September 2026*\n✓ Keputusan bersama: *Sendirian*\n✓ Furnitur: *Semi furnished*\n✓ Fasilitas: *Gym, Kolam renang, Dapur*\n✓ Patokan lokasi: *Dekat cafe dan depot makan.*\n\nSaya akan segera menghubungi Anda dengan rekomendasi properti yang paling sesuai! 🏠\nTerima kasih sudah menghubungi saya. 🙏\n\nSalam hangat,\n*LEO FELIX*\n*Elevan Property*', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 02:36:30', '2026-06-26 02:36:30'),
(67, 32, 'LFGKT49002', 'customer', 'Baik, semua sudah saya catat! 📝 🔥 Prioritas Tinggi\n\n✓ Rencana: *Sewa*\n✓ Tipe: *Apartemen*\n✓ Lokasi: *Surabaya*\n✓ Budget: *15-20/minggu*\n✓ Masuk: *16 September 2026*\n✓ Keputusan bersama: *Sendirian*\n✓ Furnitur: *Semi furnished*\n✓ Fasilitas: *Gym, Kolam renang, Dapur*\n✓ Patokan lokasi: *Dekat cafe dan depot makan.*\n\nSaya akan segera menghubungi Anda dengan rekomendasi properti yang paling sesuai! 🏠\nTerima kasih sudah menghubungi saya. 🙏\n\nSalam hangat,\n*LEO FELIX*\n*Elevan Property*\n\n> _Sent via propmatches.netlify.app_', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782441393897\",\"platform\":\"kirimi\"}', '2026-06-26 02:36:33', '2026-06-26 02:36:33'),
(68, 32, 'LFGKT49002', 'ai', 'Sudah lihat berapa Apartemen di *Surabaya*? Apa yang membuat belum cocok dari yang sudah dilihat?', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 02:36:34', '2026-06-26 02:36:34'),
(69, 31, 'LFGKT49002', 'customer', 'Baik, semua sudah saya catat! 📝 🔥 Prioritas Tinggi\n\n✓ Rencana: *Sewa*\n✓ Tipe: *Apartemen*\n✓ Lokasi: *Surabaya*\n✓ Budget: *Rp 1.000.0000-Rp 1.600.000/minggu*\n✓ Durasi: *2 minggu*\n✓ Masuk: *16 September 2026*\n✓ Keputusan bersama: *Sendirian*\n✓ Furnitur: *Semi furnished*\n✓ Fasilitas: *Gym, Kolam renang, Dapur*\n✓ Patokan lokasi: *Dekat cafe dan depot makan.*\n✓ Viewing: *Butuh lihat katalog saja*\n\nSaya akan segera menghubungi Anda dengan rekomendasi properti yang paling sesuai! 🏠\nTerima kasih sudah menghubungi saya. 🙏\n\nSalam hangat,\n*LEO FELIX*\n*Elevan Property*', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782441659008\",\"platform\":\"kirimi\"}', '2026-06-26 02:40:59', '2026-06-26 02:40:59'),
(70, 31, 'LFGKT49002', 'ai', 'Sudah lihat berapa Apartemen di *Surabaya*? Apa yang membuat belum cocok dari yang sudah dilihat?', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 02:40:59', '2026-06-26 02:40:59'),
(71, 32, 'LFGKT49002', 'customer', 'Siap, Mei', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782442000789\",\"platform\":\"kirimi\"}', '2026-06-26 02:46:40', '2026-06-26 02:46:40'),
(72, 32, 'LFGKT49002', 'ai', 'Untuk harga *15-20* — maksudnya dalam *ribu*, *juta*, *miliar*, atau *triliun*? 💰\n(Contoh: \"15-20 juta\")', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 02:46:41', '2026-06-26 02:46:41'),
(73, 32, 'LFGKT49002', 'customer', 'Untuk harga *15-20* — maksudnya dalam *ribu*, *juta*, *miliar*, atau *triliun*? 💰\n(Contoh: \"15-20 juta\")\n\n> _Sent via propmatches.netlify.app_', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782442002957\",\"platform\":\"kirimi\"}', '2026-06-26 02:46:42', '2026-06-26 02:46:42'),
(74, 32, 'LFGKT49002', 'ai', 'Ada yang pasti tidak cocok? Misalnya yang hadap barat, dekat jalan ramai, gang sempit, atau rumah tua? 🚫', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 02:46:43', '2026-06-26 02:46:43'),
(75, 32, 'LFGKT49002', 'customer', 'Ya chat cari rumah, apartemen, villa, dsb', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782442302939\",\"platform\":\"kirimi\"}', '2026-06-26 02:51:42', '2026-06-26 02:51:42'),
(76, 32, 'LFGKT49002', 'ai', 'Untuk *Villa* yang Anda cari — rencananya untuk *sewa* atau *beli*? 🏠', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 02:51:43', '2026-06-26 02:51:43'),
(77, 32, 'LFGKT49002', 'customer', 'Untuk *Villa* yang Anda cari — rencananya untuk *sewa* atau *beli*? 🏠\n\n> _Sent via propmatches.netlify.app_', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782442307192\",\"platform\":\"kirimi\"}', '2026-06-26 02:51:47', '2026-06-26 02:51:47'),
(78, 32, 'LFGKT49002', 'ai', 'Oke, mau *sewa Villa*. 📍\n\nDi kota atau area mana yang Anda pertimbangkan?', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 02:51:47', '2026-06-26 02:51:47'),
(79, 32, 'LFGKT49002', 'customer', 'Oke, mau *sewa Villa*. 📍\n\nDi kota atau area mana yang Anda pertimbangkan?\n\n> _Sent via propmatches.netlify.app_', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782442309167\",\"platform\":\"kirimi\"}', '2026-06-26 02:51:49', '2026-06-26 02:51:49'),
(80, 32, 'LFGKT49002', 'ai', 'Sudah lihat berapa Villa di *kota atau area mana*? Apa yang membuat belum cocok dari yang sudah dilihat?', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 02:51:49', '2026-06-26 02:51:49'),
(81, 32, 'LFGKT49002', 'customer', 'Sudah lihat berapa Villa di *kota atau area mana*? Apa yang membuat belum cocok dari yang sudah dilihat?\n\n> _Sent via propmatches.netlify.app_', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782442311052\",\"platform\":\"kirimi\"}', '2026-06-26 02:51:51', '2026-06-26 02:51:51'),
(82, 32, 'LFGKT49002', 'ai', 'Di *kota atau area mana* ada *Villa* yang di kisaran *1–3 juta/malam* dan ada juga yang *5–15 juta/malam*. Kira-kira yang mana lebih sesuai dengan rencana Anda? 💰', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 02:51:51', '2026-06-26 02:51:51'),
(83, 32, 'LFGKT49002', 'customer', 'Di *kota atau area mana* ada *Villa* yang di kisaran *1–3 juta/malam* dan ada juga yang *5–15 juta/malam*. Kira-kira yang mana lebih sesuai dengan rencana Anda? 💰\n\n> _Sent via propmatches.netlify.app_', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782442312904\",\"platform\":\"kirimi\"}', '2026-06-26 02:51:52', '2026-06-26 02:51:52'),
(84, 32, 'LFGKT49002', 'ai', 'Rencananya masuk atau pindah bulan apa? 📅', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 02:51:53', '2026-06-26 02:51:53'),
(85, 37, 'LFGKT49002', 'customer', 'Halo mau tanya tentang rumah di surabaya selatan', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782442364886\",\"platform\":\"kirimi\"}', '2026-06-26 02:52:44', '2026-06-26 02:52:44'),
(86, 37, 'LFGKT49002', 'ai', 'Halo Kak, saya asisten dari *LEO FELIX* (*Elevan Property*). Saya bantu catat kebutuhannya dulu ya. Untuk rumahnya, rencananya mau *beli* atau *sewa*, Kak? 🏠', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 02:52:44', '2026-06-26 02:52:44'),
(87, 32, 'LFGKT49002', 'customer', 'Halo Kak, saya asisten dari *LEO FELIX* (*Elevan Property*). Saya bantu catat kebutuhannya dulu ya. Untuk rumahnya, rencananya mau *beli* atau *sewa*, Kak? 🏠\n\n> _Sent via propmatches.netlify.app_', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782442367581\",\"platform\":\"kirimi\"}', '2026-06-26 02:52:47', '2026-06-26 02:52:47'),
(88, 32, 'LFGKT49002', 'ai', 'Untuk furnitur, lebih prefer yang sudah *furnished*, *semi-furnished*, atau *kosongan* saja? 🛋️', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 02:52:47', '2026-06-26 02:52:47'),
(89, 37, 'LFGKT49002', 'customer', 'Mau beli', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782442383202\",\"platform\":\"kirimi\"}', '2026-06-26 02:53:03', '2026-06-26 02:53:03'),
(90, 37, 'LFGKT49002', 'ai', 'Boleh tahu, apa yang membuat Kak mulai cari rumah sekarang? Misalnya mau pindah, keluarga nambah, pindah kerja, atau untuk investasi?', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 02:53:03', '2026-06-26 02:53:03'),
(91, 32, 'LFGKT49002', 'customer', 'Boleh tahu, apa yang membuat Kak mulai cari rumah sekarang? Misalnya mau pindah, keluarga nambah, pindah kerja, atau untuk investasi?\n\n> _Sent via propmatches.netlify.app_', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782442386260\",\"platform\":\"kirimi\"}', '2026-06-26 02:53:06', '2026-06-26 02:53:06'),
(92, 32, 'LFGKT49002', 'ai', 'Halo Kak, saya asisten dari *LEO FELIX* (*Elevan Property*). Saya bantu catat kebutuhannya dulu ya. Untuk rumahnya, rencananya mau *beli* atau *sewa*, Kak? 🏠', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 02:53:06', '2026-06-26 02:53:06'),
(93, 37, 'LFGKT49002', 'customer', 'Mau pindah', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782442406113\",\"platform\":\"kirimi\"}', '2026-06-26 02:53:26', '2026-06-26 02:53:26'),
(94, 37, 'LFGKT49002', 'ai', 'Sebelumnya sudah sempat lihat beberapa rumah, Kak? Kalau sudah, biasanya apa yang bikin belum cocok?', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 02:53:26', '2026-06-26 02:53:26'),
(95, 32, 'LFGKT49002', 'customer', 'Sebelumnya sudah sempat lihat beberapa rumah, Kak? Kalau sudah, biasanya apa yang bikin belum cocok?\n\n> _Sent via propmatches.netlify.app_', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782442408524\",\"platform\":\"kirimi\"}', '2026-06-26 02:53:28', '2026-06-26 02:53:28'),
(96, 32, 'LFGKT49002', 'ai', 'Halo Kak, saya asisten dari *LEO FELIX* (*Elevan Property*). Saya bantu catat kebutuhannya dulu ya. Untuk rumahnya, rencananya mau *beli* atau *sewa*, Kak? 🏠', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 02:53:28', '2026-06-26 02:53:28'),
(97, 37, 'LFGKT49002', 'customer', 'Saya mau rumah yang minimalis dan warna nya soft tapi elegant', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782442471400\",\"platform\":\"kirimi\"}', '2026-06-26 02:54:31', '2026-06-26 02:54:31'),
(98, 37, 'LFGKT49002', 'ai', 'Di *Surabaya* ada yang di kisaran *Rp 40.750.000.000* dan ada yang lebih di *Rp 67.700.000.000*. Kira-kira yang mana lebih mendekati rencana Kak? 💰', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 02:54:31', '2026-06-26 02:54:31'),
(99, 32, 'LFGKT49002', 'customer', 'Di *Surabaya* ada yang di kisaran *Rp 40.750.000.000* dan ada yang lebih di *Rp 67.700.000.000*. Kira-kira yang mana lebih mendekati rencana Kak? 💰\n\n> _Sent via propmatches.netlify.app_', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782442473200\",\"platform\":\"kirimi\"}', '2026-06-26 02:54:33', '2026-06-26 02:54:33'),
(100, 32, 'LFGKT49002', 'ai', 'Untuk rumahnya, rencananya mau *beli* atau *sewa*, Kak? 🏠', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 02:54:33', '2026-06-26 02:54:33'),
(101, 32, 'LFGKT49002', 'customer', 'Untuk rumahnya, rencananya mau *beli* atau *sewa*, Kak? 🏠\n\n> _Sent via propmatches.netlify.app_', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782442475062\",\"platform\":\"kirimi\"}', '2026-06-26 02:54:35', '2026-06-26 02:54:35'),
(102, 32, 'LFGKT49002', 'ai', 'Di *Surabaya* ada yang di kisaran *2–5 juta/bln* dan ada yang lebih di *10–25 juta/bln*. Kira-kira yang mana lebih mendekati rencana Kak? 💰', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 02:54:35', '2026-06-26 02:54:35'),
(103, 32, 'LFGKT49002', 'customer', 'Di *Surabaya* ada yang di kisaran *2–5 juta/bln* dan ada yang lebih di *10–25 juta/bln*. Kira-kira yang mana lebih mendekati rencana Kak? 💰\n\n> _Sent via propmatches.netlify.app_', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782442477054\",\"platform\":\"kirimi\"}', '2026-06-26 02:54:37', '2026-06-26 02:54:37'),
(104, 32, 'LFGKT49002', 'ai', 'Rencananya masuk bulan apa, Kak? 📅', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 02:54:37', '2026-06-26 02:54:37'),
(105, 32, 'LFGKT49002', 'customer', '[26/6, 09.52] Agnes Maria Christiani: Halo mau tanya tentang rumah di surabaya selatan\n[26/6, 09.52] Ifan 斯凡努: Halo Kak, saya asisten dari *LEO FELIX* (*Elevan Property*). Saya bantu catat kebutuhannya dulu ya. Untuk rumahnya, rencananya mau *beli* atau *sewa*, Kak? 🏠\n\n> _Sent via propmatches.netlify.app_\n[26/6, 09.53] Agnes Maria Christiani: Mau beli\n[26/6, 09.53] Ifan 斯凡努: Boleh tahu, apa yang membuat Kak mulai cari rumah sekarang? Misalnya mau pindah, keluarga nambah, pindah kerja, atau untuk investasi?\n\n> _Sent via propmatches.netlify.app_\n[26/6, 09.53] Agnes Maria Christiani: Mau pindah\n[26/6, 09.53] Ifan 斯凡努: Sebelumnya sudah sempat lihat beberapa rumah, Kak? Kalau sudah, biasanya apa yang bikin belum cocok?\n\n> _Sent via propmatches.netlify.app_\n[26/6, 09.54] Agnes Maria Christiani: Saya mau rumah yang minimalis dan warna nya soft tapi elegant\n[26/6, 09.54] Ifan 斯凡努: Di *Surabaya* ada yang di kisaran *Rp 40.750.000.000* dan ada yang lebih di *Rp 67.700.000.000*. Kira-kira yang mana lebih mendekati rencana Kak? 💰\n\n> _Sent via propmatches.netlify.app_\n[26/6, 09.55] Agnes Maria Christiani: Coba yang 40.750.000.000', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782442923159\",\"platform\":\"kirimi\"}', '2026-06-26 03:02:03', '2026-06-26 03:02:03'),
(106, 32, 'LFGKT49002', 'ai', 'Kalau nanti ada yang cocok, langsung bisa jadwalkan survey, atau perlu koordinasi dulu dengan keluarga, Kak?', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 03:02:03', '2026-06-26 03:02:03'),
(107, 32, 'LFGKT49002', 'customer', 'Kalau nanti ada yang cocok, langsung bisa jadwalkan survey, atau perlu koordinasi dulu dengan keluarga, Kak?\n\n> _Sent via propmatches.netlify.app_', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782442928101\",\"platform\":\"kirimi\"}', '2026-06-26 03:02:08', '2026-06-26 03:02:08'),
(108, 32, 'LFGKT49002', 'ai', 'Selain *Surabaya*, ada area lain yang masih oke buat Kak pertimbangkan? 🗺️', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 03:02:08', '2026-06-26 03:02:08'),
(109, 32, 'LFGKT49002', 'customer', 'Selain *Surabaya*, ada area lain yang masih oke buat Kak pertimbangkan? 🗺️\n\n> _Sent via propmatches.netlify.app_', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782442931633\",\"platform\":\"kirimi\"}', '2026-06-26 03:02:11', '2026-06-26 03:02:11'),
(110, 32, 'LFGKT49002', 'ai', 'Sewa rencananya berapa lama, Kak? ⏱️', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 03:02:11', '2026-06-26 03:02:11'),
(111, 31, 'LFGKT49002', 'customer', 'Hi.. mau sewa apartemen di malang', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782456887730\",\"platform\":\"kirimi\"}', '2026-06-26 06:54:47', '2026-06-26 06:54:47'),
(112, 31, 'LFGKT49002', 'ai', 'Untuk harga *0-1600000* — maksudnya dalam *ribu*, *juta*, *miliar*, atau *triliun*? 💰\n(Contoh: \"0-1600000 juta\")', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 06:54:48', '2026-06-26 06:54:48'),
(113, 32, 'LFGKT49002', 'customer', 'Untuk harga *0-1600000* — maksudnya dalam *ribu*, *juta*, *miliar*, atau *triliun*? 💰\n(Contoh: \"0-1600000 juta\")\n\n> _Sent via propmatches.netlify.app_', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782456890845\",\"platform\":\"kirimi\"}', '2026-06-26 06:54:50', '2026-06-26 06:54:50'),
(114, 32, 'LFGKT49002', 'ai', 'Furniturnya prefer *Full Furnished*, *Semi*, atau *Kosongan*, Kak? 🛋️', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 06:54:51', '2026-06-26 06:54:51'),
(115, 32, 'LFGKT49002', 'customer', 'Furniturnya prefer *Full Furnished*, *Semi*, atau *Kosongan*, Kak? 🛋️\n\n> _Sent via propmatches.netlify.app_', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782456892668\",\"platform\":\"kirimi\"}', '2026-06-26 06:54:52', '2026-06-26 06:54:52'),
(116, 32, 'LFGKT49002', 'ai', 'Ada fasilitas tertentu yang Kak inginkan? Misalnya AC, kolam renang, gym, keamanan 24 jam, atau lainnya? 🏊', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 06:54:52', '2026-06-26 06:54:52'),
(117, 32, 'LFGKT49002', 'customer', 'Ada fasilitas tertentu yang Kak inginkan? Misalnya AC, kolam renang, gym, keamanan 24 jam, atau lainnya? 🏊\n\n> _Sent via propmatches.netlify.app_', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782456894494\",\"platform\":\"kirimi\"}', '2026-06-26 06:54:54', '2026-06-26 06:54:54'),
(118, 32, 'LFGKT49002', 'ai', 'Baik, semua sudah saya catat! 📝 📋 Prioritas Tinggi\n\n✓ Rencana: *Sewa*\n✓ Tipe: *Rumah*\n✓ Lokasi: *Surabaya*\n✓ Masuk: *26 Juni 2026*\n✓ Keputusan bersama: *[26/6, 09.52] Agnes Maria Christiani: Halo mau tanya tentang rumah di surabaya selatan\n[26/6, 09.52] Ifan 斯凡努: Halo Kak, saya asisten dari *LEO FELIX* (*Elevan Property*). Saya bantu catat kebutuhannya dulu ya. Untuk rumahnya, rencananya mau *beli* atau *sewa*, Kak? 🏠\n\n> _Sent via propmatches.netlify.app_\n[26/6, 09.53] Agnes Maria Christiani: Mau beli\n[26/6, 09.53] Ifan 斯凡努: Boleh tahu, apa yang membuat Kak mulai cari rumah sekarang? Misalnya mau pindah, keluarga nambah, pindah kerja, atau untuk investasi?\n\n> _Sent via propmatches.netlify.app_\n[26/6, 09.53] Agnes Maria Christiani: Mau pindah\n[26/6, 09.53] Ifan 斯凡努: Sebelumnya sudah sempat lihat beberapa rumah, Kak? Kalau sudah, biasanya apa yang bikin belum cocok?\n\n> _Sent via propmatches.netlify.app_\n[26/6, 09.54] Agnes Maria Christiani: Saya mau rumah yang minimalis dan warna nya soft tapi elegant\n[26/6, 09.54] Ifan 斯凡努: Di *Surabaya* ada yang di kisaran *Rp 40.750.000.000* dan ada yang lebih di *Rp 67.700.000.000*. Kira-kira yang mana lebih mendekati rencana Kak? 💰\n\n> _Sent via propmatches.netlify.app_\n[26/6, 09.55] Agnes Maria Christiani: Coba yang 40.750.000.000*\n✓ Furnitur: *Full furnished*\n✓ Fasilitas: *Gym, Kolam renang, Keamanan 24 jam, AC*\n✗ Budget: *(Belum ditanyakan)*\n✗ Patokan lokasi: *(Belum ditanyakan)*\n\nSaya akan segera menghubungi Anda dengan rekomendasi properti yang paling sesuai! 🏠\n\nTerima kasih sudah menghubungi saya. 🙏\n\nSalam hangat,\n*LEO FELIX*\n*Elevan Property*', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 06:54:54', '2026-06-26 06:54:54'),
(119, 32, 'LFGKT49002', 'customer', 'Baik, semua sudah saya catat! 📝 📋 Prioritas Tinggi\n\n✓ Rencana: *Sewa*\n✓ Tipe: *Rumah*\n✓ Lokasi: *Surabaya*\n✓ Masuk: *26 Juni 2026*\n✓ Keputusan bersama: *[26/6, 09.52] Agnes Maria Christiani: Halo mau tanya tentang rumah di surabaya selatan\n[26/6, 09.52] Ifan 斯凡努: Halo Kak, saya asisten dari *LEO FELIX* (*Elevan Property*). Saya bantu catat kebutuhannya dulu ya. Untuk rumahnya, rencananya mau *beli* atau *sewa*, Kak? 🏠\n\n> _Sent via propmatches.netlify.app_\n[26/6, 09.53] Agnes Maria Christiani: Mau beli\n[26/6, 09.53] Ifan 斯凡努: Boleh tahu, apa yang membuat Kak mulai cari rumah sekarang? Misalnya mau pindah, keluarga nambah, pindah kerja, atau untuk investasi?\n\n> _Sent via propmatches.netlify.app_\n[26/6, 09.53] Agnes Maria Christiani: Mau pindah\n[26/6, 09.53] Ifan 斯凡努: Sebelumnya sudah sempat lihat beberapa rumah, Kak? Kalau sudah, biasanya apa yang bikin belum cocok?\n\n> _Sent via propmatches.netlify.app_\n[26/6, 09.54] Agnes Maria Christiani: Saya mau rumah yang minimalis dan warna nya soft tapi elegant\n[26/6, 09.54] Ifan 斯凡努: Di *Surabaya* ada yang di kisaran *Rp 40.750.000.000* dan ada yang lebih di *Rp 67.700.000.000*. Kira-kira yang mana lebih mendekati rencana Kak? 💰\n\n> _Sent via propmatches.netlify.app_\n[26/6, 09.55] Agnes Maria Christiani: Coba yang 40.750.000.000*\n✓ Furnitur: *Full furnished*\n✓ Fasilitas: *Gym, Kolam renang, Keamanan 24 jam, AC*\n✗ Budget: *(Belum ditanyakan)*\n✗ Patokan lokasi: *(Belum ditanyakan)*\n\nSaya akan segera menghubungi Anda dengan rekomendasi properti yang paling sesuai! 🏠\n\nTerima kasih sudah menghubungi saya. 🙏\n\nSalam hangat,\n*LEO FELIX*\n*Elevan Property*', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782456897457\",\"platform\":\"kirimi\"}', '2026-06-26 06:54:57', '2026-06-26 06:54:57'),
(120, 32, 'LFGKT49002', 'ai', 'Selain *Surabaya*, ada area lain yang masih oke buat Kak pertimbangkan? 🗺️', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 06:54:57', '2026-06-26 06:54:57'),
(121, 32, 'LFGKT49002', 'customer', 'Selain *Surabaya*, ada area lain yang masih oke buat Kak pertimbangkan? 🗺️\n\n> _Sent via propmatches.netlify.app_', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782456899435\",\"platform\":\"kirimi\"}', '2026-06-26 06:54:59', '2026-06-26 06:54:59'),
(122, 32, 'LFGKT49002', 'ai', 'Sewa rencananya berapa lama, Kak? ⏱️', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 06:54:59', '2026-06-26 06:54:59'),
(123, 31, 'LFGKT49002', 'customer', 'Hi.. mau sewa apartemen di malang', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782458033696\",\"platform\":\"kirimi\"}', '2026-06-26 07:13:53', '2026-06-26 07:13:53'),
(124, 31, 'LFGKT49002', 'ai', 'Sudah lihat berapa Apartemen di *Malang*? Apa yang membuat belum cocok dari yang sudah dilihat?', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 07:13:53', '2026-06-26 07:13:53'),
(125, 31, 'LFGKT49002', 'customer', 'Saya belum pernah lihat.. Cm saya cari apartemen yang pusat kota. Sekitaran apartemen ada cafe, depot/restoran. Usahakan access jalan anti banjir. Saya butuh sewa 2 bulan saja', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782458136770\",\"platform\":\"kirimi\"}', '2026-06-26 07:15:36', '2026-06-26 07:15:36'),
(126, 31, 'LFGKT49002', 'ai', 'Untuk harga *0-1600000* — maksudnya dalam *ribu*, *juta*, *miliar*, atau *triliun*? 💰\n(Contoh: \"0-1600000 juta\")', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 07:15:36', '2026-06-26 07:15:36'),
(127, 31, 'LFGKT49002', 'customer', 'Saya belum pernah lihat.. Cm saya cari apartemen yang pusat kota. Sekitaran apartemen ada cafe, depot/restoran. Usahakan access jalan anti banjir. Saya butuh sewa 2 bulan saja', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782458560193\",\"platform\":\"kirimi\"}', '2026-06-26 07:22:40', '2026-06-26 07:22:40'),
(128, 31, 'LFGKT49002', 'ai', 'Kak, boleh tau kira-kira tanggalnya? Mohon segera info tanggalnya ya 📅', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 07:22:40', '2026-06-26 07:22:40'),
(129, 31, 'LFGKT49002', 'customer', 'Hi.. mau sewa villa di surabaya', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782459331709\",\"platform\":\"kirimi\"}', '2026-06-26 07:35:31', '2026-06-26 07:35:31'),
(130, 31, 'LFGKT49002', 'ai', 'Sudah lihat berapa Villa di *Surabaya*? Apa yang membuat belum cocok dari yang sudah dilihat?', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 07:35:31', '2026-06-26 07:35:31'),
(131, 31, 'LFGKT49002', 'customer', 'Belum pernah lihat, cuma saya mau villa yang anti banjir, hawanya sejuk dan jalan lebar.', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782459380352\",\"platform\":\"kirimi\"}', '2026-06-26 07:36:20', '2026-06-26 07:36:20'),
(132, 31, 'LFGKT49002', 'ai', 'Untuk *Villa* sewa di *Surabaya*, Kak lebih prefer yang *terjangkau*, *menengah*, atau *eksklusif*? 💰', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 07:36:20', '2026-06-26 07:36:20'),
(133, 31, 'LFGKT49002', 'customer', 'Saya mau yang terjangkau, kisaran 900K-1.2juta/hari. Saya rencana sewa 4 hari', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782459435264\",\"platform\":\"kirimi\"}', '2026-06-26 07:37:15', '2026-06-26 07:37:15'),
(134, 31, 'LFGKT49002', 'ai', 'Rencananya masuk atau pindah bulan apa? 📅', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 07:37:15', '2026-06-26 07:37:15'),
(135, 31, 'LFGKT49002', 'customer', 'Bulan agustus ini, Kak', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782459449541\",\"platform\":\"kirimi\"}', '2026-06-26 07:37:29', '2026-06-26 07:37:29'),
(136, 31, 'LFGKT49002', 'ai', 'Nanti akan tinggal bersama siapa saja? Biar saya bisa carikan yang pas jumlah kamarnya 🛏️', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 07:37:29', '2026-06-26 07:37:29'),
(137, 31, 'LFGKT49002', 'customer', 'Bersama teman-teman, ada 15 orang', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782459473223\",\"platform\":\"kirimi\"}', '2026-06-26 07:37:53', '2026-06-26 07:37:53'),
(138, 31, 'LFGKT49002', 'ai', 'Untuk furnitur, lebih prefer yang sudah *furnished*, *semi-furnished*, atau *kosongan* saja? 🛋️', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 07:37:53', '2026-06-26 07:37:53'),
(139, 31, 'LFGKT49002', 'customer', 'semi furnished, ac, kolam renang, gym, lapangan basket, lapangan badminton', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782459506940\",\"platform\":\"kirimi\"}', '2026-06-26 07:38:26', '2026-06-26 07:38:26'),
(140, 31, 'LFGKT49002', 'ai', 'Ada lokasi tertentu yang jadi patokan? Misalnya dekat sekolah anak, kantor, atau mall tertentu? 📍', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 07:38:27', '2026-06-26 07:38:27'),
(141, 31, 'LFGKT49002', 'customer', 'Lokasi strategis aja, kak. dekat indomaret, pasar, cafe dan depot', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782459535979\",\"platform\":\"kirimi\"}', '2026-06-26 07:38:55', '2026-06-26 07:38:55'),
(142, 31, 'LFGKT49002', 'ai', 'Selain lokasi *Kisaran*, apakah Anda mau pilihan lokasi lainnya? 🗺️', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 07:38:56', '2026-06-26 07:38:56'),
(143, 31, 'LFGKT49002', 'customer', 'enggak mau', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782459579304\",\"platform\":\"kirimi\"}', '2026-06-26 07:39:39', '2026-06-26 07:39:39'),
(144, 31, 'LFGKT49002', 'ai', 'Kalau nanti ada yang cocok, langsung bisa jadwalkan viewing atau perlu koordinasi dulu sama keluarga lain? 📅', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 07:39:39', '2026-06-26 07:39:39'),
(145, 31, 'LFGKT49002', 'customer', 'saya koordinasikan sama teman saya. Cuma saya boleh viewing kapan dengan anda?', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782459611498\",\"platform\":\"kirimi\"}', '2026-06-26 07:40:11', '2026-06-26 07:40:11'),
(146, 31, 'LFGKT49002', 'ai', 'Perlu villa dengan *private pool*? Atau shared pool juga oke? 🏊', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 07:40:11', '2026-06-26 07:40:11'),
(147, 31, 'LFGKT49002', 'customer', 'shared aja, Kak', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782459651772\",\"platform\":\"kirimi\"}', '2026-06-26 07:40:51', '2026-06-26 07:40:51'),
(148, 31, 'LFGKT49002', 'ai', 'Tanggal check-in? 📅', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 07:40:51', '2026-06-26 07:40:51'),
(149, 31, 'LFGKT49002', 'customer', 'agustus ini, kak', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782459664288\",\"platform\":\"kirimi\"}', '2026-06-26 07:41:04', '2026-06-26 07:41:04'),
(150, 31, 'LFGKT49002', 'ai', 'Baik, semua sudah saya catat! 📝 🔥 Prioritas Tinggi\n\n✓ Rencana: *Sewa*\n✓ Tipe: *Villa*\n✓ Lokasi: *Kisaran*\n✓ Budget: *Rp 900.000 - Rp 1.200.000/hari*\n✓ Masuk: *01 Agustus 2026*\n✓ Durasi sewa: *2 bulan*\n✓ Keputusan bersama: *Disebutkan di Q4*\n✓ Furnitur: *Semi furnished*\n✓ Fasilitas: *Gym, Kolam renang, AC*\n✓ Hindari: *Tidak mau banjir*\n✓ Patokan lokasi: *Dekat indomaret, pasar, cafe dan depot*\n\nSaya akan segera menghubungi Anda dengan rekomendasi properti yang paling sesuai! 🏠\nTerima kasih sudah menghubungi saya. 🙏\n\nSalam hangat,\n*LEO FELIX*\n*Elevan Property*', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 07:41:04', '2026-06-26 07:41:04'),
(151, 31, 'LFGKT49002', 'customer', 'Saya mau beli rumah di surabaya', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782463083411\",\"platform\":\"kirimi\"}', '2026-06-26 08:38:03', '2026-06-26 08:38:03'),
(152, 31, 'LFGKT49002', 'ai', 'Boleh tahu, apa yang membuat Kak mulai cari rumah sekarang? Misalnya mau pindah, keluarga nambah, pindah kerja, atau untuk investasi?', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 08:38:03', '2026-06-26 08:38:03'),
(153, 31, 'LFGKT49002', 'customer', 'Saya mau beli rumah untuk pemakaian pribadi, saya mau tinggal bersama keluarga', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782463119917\",\"platform\":\"kirimi\"}', '2026-06-26 08:38:39', '2026-06-26 08:38:39'),
(154, 31, 'LFGKT49002', 'ai', 'Boleh tahu, apa yang membuat Kak mulai cari rumah sekarang? Misalnya mau pindah, keluarga nambah, pindah kerja, atau untuk investasi?', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 08:38:40', '2026-06-26 08:38:40'),
(155, 31, 'LFGKT49002', 'customer', 'Saya mau beli rumah untuk pemakaian pribadi, saya mau tinggal bersama keluarga', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782463262490\",\"platform\":\"kirimi\"}', '2026-06-26 08:41:02', '2026-06-26 08:41:02'),
(156, 31, 'LFGKT49002', 'ai', 'Sebelumnya sudah sempat lihat beberapa rumah, Kak? Kalau sudah, biasanya apa yang bikin belum cocok?', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 08:41:02', '2026-06-26 08:41:02'),
(157, 31, 'LFGKT49002', 'customer', 'Belum pernah lihat', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782463278622\",\"platform\":\"kirimi\"}', '2026-06-26 08:41:18', '2026-06-26 08:41:18'),
(158, 31, 'LFGKT49002', 'ai', 'Untuk rumah beli di *Surabaya*, Kak lebih prefer yang *terjangkau*, *menengah*, atau *eksklusif*? 💰', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 08:41:18', '2026-06-26 08:41:18'),
(159, 31, 'LFGKT49002', 'customer', 'Mau yang terjangkau, Kak. Kisaran 400-500 juta', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782463307692\",\"platform\":\"kirimi\"}', '2026-06-26 08:41:47', '2026-06-26 08:41:47'),
(160, 31, 'LFGKT49002', 'ai', 'Untuk pembeliannya, rencana pakai *KPR* atau *cash*, Kak?', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 08:41:47', '2026-06-26 08:41:47');
INSERT INTO `chat_messages` (`id`, `chatSessionId`, `user_id`, `role`, `message`, `channel`, `metadata`, `createdAt`, `updatedAt`) VALUES
(161, 31, 'LFGKT49002', 'customer', 'Mau yang terjangkau, Kak. Kisaran 400-500 juta', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782463434552\",\"platform\":\"kirimi\"}', '2026-06-26 08:43:54', '2026-06-26 08:43:54'),
(162, 31, 'LFGKT49002', 'ai', 'Untuk pembeliannya, rencana pakai *KPR* atau *cash*, Kak?', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 08:43:54', '2026-06-26 08:43:54'),
(163, 31, 'LFGKT49002', 'customer', 'Saya mau KPR 15 TAHUN, kAK', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782463454552\",\"platform\":\"kirimi\"}', '2026-06-26 08:44:14', '2026-06-26 08:44:14'),
(164, 31, 'LFGKT49002', 'ai', 'Untuk KPR-nya, sudah sempat cek atau ajukan ke bank, atau masih rencana, Kak? Biar *LEO FELIX* bisa bantu siapkan dari awal. (Sekalian, DP-nya kira-kira berapa persen?)', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 08:44:14', '2026-06-26 08:44:14'),
(165, 31, 'LFGKT49002', 'customer', 'Belum pernah, namun saya mau pakai KPR BCA. Apakah bisa dibantu?', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782463482806\",\"platform\":\"kirimi\"}', '2026-06-26 08:44:42', '2026-06-26 08:44:42'),
(166, 31, 'LFGKT49002', 'ai', 'Ada yang pasti Kak hindari? Misalnya rawan banjir, hadap barat, gang sempit, atau dekat jalan terlalu ramai? 🚫', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 08:44:43', '2026-06-26 08:44:43'),
(167, 31, 'LFGKT49002', 'customer', 'Belum pernah, namun saya mau pakai KPR BCA. Apakah bisa dibantu?', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782464123208\",\"platform\":\"kirimi\"}', '2026-06-26 08:55:23', '2026-06-26 08:55:23'),
(168, 31, 'LFGKT49002', 'ai', 'Selain *Surabaya*, ada area lain yang masih oke buat Kak pertimbangkan? 🗺️', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 08:55:23', '2026-06-26 08:55:23'),
(169, 31, 'LFGKT49002', 'customer', 'Boleh lokasi lainnya yang di surabaya', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782464147269\",\"platform\":\"kirimi\"}', '2026-06-26 08:55:47', '2026-06-26 08:55:47'),
(170, 31, 'LFGKT49002', 'ai', 'Kondisinya Kak prefer yang *baru*, *second* yang terawat, atau *inden* tidak masalah?', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 08:55:47', '2026-06-26 08:55:47'),
(171, 31, 'LFGKT49002', 'customer', 'Saya beli yang baru', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782464169630\",\"platform\":\"kirimi\"}', '2026-06-26 08:56:09', '2026-06-26 08:56:09'),
(172, 31, 'LFGKT49002', 'ai', 'Baik, semua sudah saya catat! 📝 📋 Prioritas Tinggi\n\n✓ Rencana: *Beli*\n✓ Tipe: *Rumah*\n✓ Lokasi: *Surabaya*\n✓ Masuk: *01 Agustus 2026*\n✓ Keputusan bersama: *Bersama keluarga*\n✗ Furnitur: *(Belum ditanyakan)*\n✗ Fasilitas: *(Belum ditanyakan)*\n✓ Budget: *Rp 400.000.000 - Rp 500.000.000*\n✗ Patokan lokasi: *(Belum ditanyakan)*\n\nSaya akan segera menghubungi Anda dengan rekomendasi properti yang paling sesuai! 🏠\n\nTerima kasih sudah menghubungi saya. 🙏\n\nSalam hangat,\n*LEO FELIX*\n*Elevan Property*', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 08:56:09', '2026-06-26 08:56:09'),
(173, 32, 'LFGKT49002', 'customer', 'Km sdh di rmh?', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782464285457\",\"platform\":\"kirimi\"}', '2026-06-26 08:58:05', '2026-06-26 08:58:05'),
(174, 32, 'LFGKT49002', 'ai', 'Baik, semua sudah saya catat! 📝 📋 Prioritas Tinggi\n\n✓ Rencana: *Sewa*\n✓ Tipe: *Rumah*\n✓ Lokasi: *rmh*\n✓ Masuk: *26 Juni 2026*\n✓ Keputusan bersama: *Disebutkan di Q4*\n✓ Furnitur: *Full furnished*\n✓ Fasilitas: *Gym, Kolam renang, Keamanan 24 jam, AC*\n✓ Budget: *Rp 34.637.500.000 - Rp 46.862.500.000*\n✗ Patokan lokasi: *(Belum ditanyakan)*\n\nSaya akan segera menghubungi Anda dengan rekomendasi properti yang paling sesuai! 🏠\n\nTerima kasih sudah menghubungi saya. 🙏\n\nSalam hangat,\n*LEO FELIX*\n*Elevan Property*', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 08:58:05', '2026-06-26 08:58:05'),
(175, 32, 'LFGKT49002', 'customer', '16:03, Mei', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782464608913\",\"platform\":\"kirimi\"}', '2026-06-26 09:03:28', '2026-06-26 09:03:28'),
(176, 32, 'LFGKT49002', 'ai', 'Boleh tahu, apa yang membuat Kak mulai cari rumah sekarang? Misalnya mau pindah, keluarga nambah, pindah kerja, atau untuk investasi?', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 09:03:29', '2026-06-26 09:03:29'),
(177, 37, 'LFGKT49002', 'customer', 'Mau ke gulun bntar ko', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782464636090\",\"platform\":\"kirimi\"}', '2026-06-26 09:03:56', '2026-06-26 09:03:56'),
(178, 37, 'LFGKT49002', 'ai', 'Nanti akan ditinggali bersama siapa saja, Kak? Biar saya catat jumlah kamar yang pas 🛏️', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 09:03:56', '2026-06-26 09:03:56'),
(179, 37, 'LFGKT49002', 'customer', 'Pengen ngemil tpi ga ada yg menarik :-(', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782465856190\",\"platform\":\"kirimi\"}', '2026-06-26 09:24:16', '2026-06-26 09:24:16'),
(180, 37, 'LFGKT49002', 'ai', 'Nanti akan ditinggali bersama siapa saja, Kak? Biar saya catat jumlah kamar yang pas 🛏️', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 09:24:16', '2026-06-26 09:24:16'),
(181, 37, 'LFGKT49002', 'customer', 'Endak besar rumahku', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"kirimi_1782467476028\",\"platform\":\"kirimi\"}', '2026-06-26 09:51:16', '2026-06-26 09:51:16'),
(182, 37, 'LFGKT49002', 'ai', 'Nanti akan ditinggali bersama siapa saja, Kak? Biar saya catat jumlah kamar yang pas 🛏️', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-26 09:51:16', '2026-06-26 09:51:16');

-- --------------------------------------------------------

--
-- Struktur dari tabel `chat_sessions`
--

CREATE TABLE `chat_sessions` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `normalizedName` varchar(255) NOT NULL,
  `phone` varchar(255) NOT NULL,
  `normalizedPhone` varchar(255) NOT NULL,
  `location` varchar(255) DEFAULT NULL,
  `normalizedLocation` varchar(255) DEFAULT NULL,
  `source` varchar(255) NOT NULL DEFAULT 'website_chatbot',
  `lastMessageAt` datetime DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data untuk tabel `chat_sessions`
--

INSERT INTO `chat_sessions` (`id`, `name`, `normalizedName`, `phone`, `normalizedPhone`, `location`, `normalizedLocation`, `source`, `lastMessageAt`, `createdAt`, `updatedAt`) VALUES
(1, 'nigel', 'nigel', '082233556796', '6282233556796', 'suarabaya', 'suarabaya', 'website_chatbot', '2026-06-04 04:36:40', '2026-05-11 06:25:50', '2026-06-04 04:36:40'),
(2, 'clarence', 'clarence', '+62821-3311-936', '628213311936', 'surabaya', 'surabaya', 'website_chatbot', '2026-05-12 04:37:46', '2026-05-12 04:37:46', '2026-05-12 04:37:46'),
(3, 'clarrence', 'clarrence', '0821-3311-936', '628213311936', 'surabaya', 'surabaya', 'website_chatbot', '2026-05-12 04:58:43', '2026-05-12 04:58:17', '2026-05-12 04:58:43'),
(4, 'clarance', 'clarance', '0821-3311-936', '628213311936', 'surabaya', 'surabaya', 'website_chatbot', '2026-05-12 05:21:30', '2026-05-12 05:21:30', '2026-05-12 05:21:30'),
(5, 'nigel', 'nigel', '082233556796', '6282233556796', 'surabaya', 'surabaya', 'website_chatbot', '2026-06-25 07:48:36', '2026-05-18 06:50:28', '2026-06-25 07:48:36'),
(6, 'LEO FELIX', 'leo felix', '628233556796', '628233556796', NULL, NULL, 'fonnte_leo_felix', NULL, '2026-05-28 09:47:37', '2026-05-28 09:47:37'),
(7, 'Test Customer', 'test customer', '628999888777', '628999888777', NULL, NULL, 'fonnte_nigel_kuncoro', NULL, '2026-05-29 07:02:20', '2026-05-29 07:02:20'),
(8, 'Customer External Test', 'customer external test', '628555444333', '628555444333', NULL, NULL, 'fonnte_leo_felix', NULL, '2026-05-29 07:02:59', '2026-05-29 07:02:59'),
(9, 'LEA UISETIAWAN', 'lea uisetiawan', '0881036588874', '62881036588874', NULL, NULL, 'fonnte_leo_felix', NULL, '2026-05-29 07:56:24', '2026-05-29 07:56:24'),
(10, 'LEA UISETIAWAN', 'lea uisetiawan', '628881036588874', '628881036588874', NULL, NULL, 'fonnte_nigel_kuncoro', NULL, '2026-05-29 10:24:30', '2026-05-29 10:24:30'),
(11, 'LEA UISETIAWAN', 'lea uisetiawan', '628881036588874', '628881036588874', NULL, NULL, 'fonnte_leo_felix', NULL, '2026-05-29 10:27:15', '2026-05-29 10:27:15'),
(12, 'Mikhael Jefferson', 'mikhael jefferson', '6285748094855', '6285748094855', NULL, NULL, 'fonnte_leo_felix', NULL, '2026-06-03 02:23:53', '2026-06-03 02:23:53'),
(13, 'Nigel 期凡努', 'nigel 期凡努', '6282233556796', '6282233556796', NULL, NULL, 'fonnte_leo_felix', NULL, '2026-06-03 02:24:01', '2026-06-03 02:24:01'),
(14, '🌻', '🌻', '6288805301123', '6288805301123', NULL, NULL, 'fonnte_leo_felix', NULL, '2026-06-03 02:53:41', '2026-06-03 02:53:41'),
(15, 'Devyana Herman', 'devyana herman', '6282233564039', '6282233564039', NULL, NULL, 'fonnte_leo_felix', NULL, '2026-06-04 07:45:10', '2026-06-04 07:45:10'),
(16, 'L', 'l', '6281334708691', '6281334708691', NULL, NULL, 'fonnte_leo_felix', NULL, '2026-06-05 03:55:21', '2026-06-05 03:55:21'),
(17, 'Tivani 🍀', 'tivani 🍀', '6282245926252', '6282245926252', NULL, NULL, 'fonnte_leo_felix', NULL, '2026-06-08 01:41:00', '2026-06-08 01:41:00'),
(18, 'Yohana Advennia', 'yohana advennia', '6282257360240', '6282257360240', NULL, NULL, 'fonnte_leo_felix', NULL, '2026-06-11 05:39:41', '2026-06-11 05:39:41'),
(19, 'Clarence Eldy', 'clarence eldy', '6282111367154', '6282111367154', NULL, NULL, 'fonnte_leo_felix', NULL, '2026-06-12 01:20:00', '2026-06-12 01:20:00'),
(20, 'Nigel 期凡努', 'nigel 期凡努', '6282233556796', '6282233556796', NULL, NULL, 'chakrahq_leo_felix', NULL, '2026-06-18 02:55:00', '2026-06-18 02:55:00'),
(21, 'Mikhael Jefferson', 'mikhael jefferson', '6285748094855', '6285748094855', NULL, NULL, 'chakrahq_leo_felix', NULL, '2026-06-18 03:01:42', '2026-06-18 03:01:42'),
(22, 'Test Diag', 'test diag', '628111222333', '628111222333', NULL, NULL, 'fonnte_leo_felix', NULL, '2026-06-18 08:24:16', '2026-06-18 08:24:16'),
(23, 'Diag Public', 'diag public', '628111222444', '628111222444', NULL, NULL, 'fonnte_leo_felix', NULL, '2026-06-18 08:24:45', '2026-06-18 08:24:45'),
(24, 'Diag Root', 'diag root', '628111222555', '628111222555', NULL, NULL, 'fonnte_leo_felix', NULL, '2026-06-18 08:24:45', '2026-06-18 08:24:45'),
(25, '+62∙∙∙∙∙∙∙∙∙96', '+62∙∙∙∙∙∙∙∙∙96', '+6282233556796', '6282233556796', NULL, NULL, 'timelinesai_leo_felix', NULL, '2026-06-23 02:33:39', '2026-06-23 02:33:39'),
(26, '🌻', '🌻', '+6288805301123', '6288805301123', NULL, NULL, 'timelinesai_leo_felix', NULL, '2026-06-23 03:22:31', '2026-06-23 03:22:31'),
(27, 'Sharmila Putri', 'sharmila putri', '+6288905942718', '6288905942718', NULL, NULL, 'timelinesai_leo_felix', NULL, '2026-06-23 03:47:55', '2026-06-23 03:47:55'),
(28, 'Lidya Kandau', 'lidya kandau', '+6285852386867', '6285852386867', NULL, NULL, 'timelinesai_leo_felix', NULL, '2026-06-23 04:25:04', '2026-06-23 04:25:04'),
(29, 'WANGSITERS', 'wangsiters', '+120363377896115466', '+120363377896115466', NULL, NULL, 'timelinesai_leo_felix', NULL, '2026-06-23 05:01:09', '2026-06-23 05:01:09'),
(30, 'Erwin Kirono', 'erwin kirono', '+6282140881845', '6282140881845', NULL, NULL, 'timelinesai_leo_felix', NULL, '2026-06-25 10:13:03', '2026-06-25 10:13:03'),
(31, 'Nigel 期凡努', 'nigel 期凡努', '6282233556796', '6282233556796', NULL, NULL, 'kirimi_leo_felix', NULL, '2026-06-26 02:06:18', '2026-06-26 02:06:18'),
(32, 'Ifan 斯凡努', 'ifan 斯凡努', '62881036588874', '62881036588874', NULL, NULL, 'kirimi_leo_felix', NULL, '2026-06-26 02:12:23', '2026-06-26 02:12:23'),
(33, 'Customer', 'customer', '120363377896115466', '120363377896115466', NULL, NULL, 'kirimi_leo_felix', NULL, '2026-06-26 02:27:47', '2026-06-26 02:27:47'),
(34, 'Gilang Ramadhani', 'gilang ramadhani', '120363229933612052', '120363229933612052', NULL, NULL, 'kirimi_leo_felix', NULL, '2026-06-26 02:29:03', '2026-06-26 02:29:03'),
(35, 'Nigel 期凡努', 'nigel 期凡努', '120363405121196993', '120363405121196993', NULL, NULL, 'kirimi_leo_felix', NULL, '2026-06-26 02:31:11', '2026-06-26 02:31:11'),
(36, 'Uyysamm', 'uyysamm', '120363027554132995', '120363027554132995', NULL, NULL, 'kirimi_leo_felix', NULL, '2026-06-26 02:44:21', '2026-06-26 02:44:21'),
(37, '🌻', '🌻', '6288805301123', '6288805301123', NULL, NULL, 'kirimi_leo_felix', NULL, '2026-06-26 02:51:28', '2026-06-26 02:51:28'),
(38, 'Sansan', 'sansan', '120363400349282657', '120363400349282657', NULL, NULL, 'kirimi_leo_felix', NULL, '2026-06-26 02:52:39', '2026-06-26 02:52:39'),
(39, 'Nanda', 'nanda', '120363423774886923', '120363423774886923', NULL, NULL, 'kirimi_leo_felix', NULL, '2026-06-26 03:03:52', '2026-06-26 03:03:52');

-- --------------------------------------------------------

--
-- Struktur dari tabel `cities`
--

CREATE TABLE `cities` (
  `id` int(11) NOT NULL,
  `city_id` varchar(30) NOT NULL COMMENT 'Generated ID: prefix nama + random alphanumeric + count padded 3 digit',
  `province_id` varchar(30) NOT NULL COMMENT 'FK ke provinces.province_id — provinsi induk',
  `country_id` varchar(30) NOT NULL COMMENT 'FK ke countries.country_id — negara induk',
  `name` varchar(100) NOT NULL COMMENT 'Nama kota, mis. Surabaya, Malang, Denpasar',
  `status` int(1) NOT NULL DEFAULT 1 COMMENT '1 = aktif, 2 = disabled/blocked, 3 = deleted (soft delete)',
  `created_date` date NOT NULL COMMENT 'Tanggal pembuatan data',
  `created_by` varchar(50) NOT NULL COMMENT 'FK ke users.user_id — siapa yang membuat',
  `updated_date` date DEFAULT NULL COMMENT 'Tanggal update terakhir',
  `updated_by` varchar(50) DEFAULT NULL COMMENT 'FK ke users.user_id — siapa yang terakhir mengubah'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data untuk tabel `cities`
--

INSERT INTO `cities` (`id`, `city_id`, `province_id`, `country_id`, `name`, `status`, `created_date`, `created_by`, `updated_date`, `updated_by`) VALUES
(1, 'SURW2M6001', 'JTMRXK9001', 'INDZSF4001', 'SURABAYA', 1, '2026-06-26', 'ITJMESP005', NULL, NULL),
(2, 'MAL8YXO002', 'JTMRXK9001', 'INDZSF4001', 'MALANG', 1, '2026-06-26', 'ITJMESP005', NULL, NULL),
(3, 'SIDL6W8003', 'JTMRXK9001', 'INDZSF4001', 'SIDOARJO', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(4, 'GRE46MM004', 'JTMRXK9001', 'INDZSF4001', 'GRESIK', 1, '2026-06-26', 'ITJMESP005', NULL, NULL),
(5, 'MOJZGX5005', 'JTMRXK9001', 'INDZSF4001', 'MOJOKERTO', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(6, 'PASW4HX006', 'JTMRXK9001', 'INDZSF4001', 'PASURUAN', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(7, 'PROGFW8007', 'JTMRXK9001', 'INDZSF4001', 'PROBOLINGGO', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(8, 'BATJAIV008', 'JTMRXK9001', 'INDZSF4001', 'BATU', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(9, 'KEDTTX0009', 'JTMRXK9001', 'INDZSF4001', 'KEDIRI', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(10, 'BLIGOGG010', 'JTMRXK9001', 'INDZSF4001', 'BLITAR', 1, '2026-06-26', 'LFGKT49002', NULL, NULL),
(11, 'MADYJHS011', 'JTMRXK9001', 'INDZSF4001', 'MADIUN', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(12, 'JEMSXAT012', 'JTMRXK9001', 'INDZSF4001', 'JEMBER', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(13, 'BANV1UO013', 'JTMRXK9001', 'INDZSF4001', 'BANYUWANGI', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(14, 'LUM5RRV014', 'JTMRXK9001', 'INDZSF4001', 'LUMAJANG', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(15, 'BONP0LK015', 'JTMRXK9001', 'INDZSF4001', 'BONDOWOSO', 1, '2026-06-26', 'LFGKT49002', NULL, NULL),
(16, 'SITEQXX016', 'JTMRXK9001', 'INDZSF4001', 'SITUBONDO', 1, '2026-06-26', 'LFGKT49002', NULL, NULL),
(17, 'TUB2RLP017', 'JTMRXK9001', 'INDZSF4001', 'TUBAN', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(18, 'LAML85G018', 'JTMRXK9001', 'INDZSF4001', 'LAMONGAN', 1, '2026-06-26', 'ITJMESP005', NULL, NULL),
(19, 'BOJLYKI019', 'JTMRXK9001', 'INDZSF4001', 'BOJONEGORO', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(20, 'PONQBS4020', 'JTMRXK9001', 'INDZSF4001', 'PONOROGO', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(21, 'SEM12W1021', 'JTGPLN4002', 'INDZSF4001', 'SEMARANG', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(22, 'SURWCN8022', 'JTGPLN4002', 'INDZSF4001', 'SURAKARTA', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(23, 'SALTCU7023', 'JTGPLN4002', 'INDZSF4001', 'SALATIGA', 1, '2026-06-26', 'LFGKT49002', NULL, NULL),
(24, 'MAG92WY024', 'JTGPLN4002', 'INDZSF4001', 'MAGELANG', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(25, 'PEK8KBO025', 'JTGPLN4002', 'INDZSF4001', 'PEKALONGAN', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(26, 'TEGZT8O026', 'JTGPLN4002', 'INDZSF4001', 'TEGAL', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(27, 'KUDHBZU027', 'JTGPLN4002', 'INDZSF4001', 'KUDUS', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(28, 'JEPO4AB028', 'JTGPLN4002', 'INDZSF4001', 'JEPARA', 1, '2026-06-26', 'LFGKT49002', NULL, NULL),
(29, 'DEMW92J029', 'JTGPLN4002', 'INDZSF4001', 'DEMAK', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(30, 'KENOV8W030', 'JTGPLN4002', 'INDZSF4001', 'KENDAL', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(31, 'PATVMPV031', 'JTGPLN4002', 'INDZSF4001', 'PATI', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(32, 'REMMO5H032', 'JTGPLN4002', 'INDZSF4001', 'REMBANG', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(33, 'PUROBDZ033', 'JTGPLN4002', 'INDZSF4001', 'PURWOKERTO', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(34, 'CILBQNA034', 'JTGPLN4002', 'INDZSF4001', 'CILACAP', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(35, 'KLABN0B035', 'JTGPLN4002', 'INDZSF4001', 'KLATEN', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(36, 'BOYPBZ6036', 'JTGPLN4002', 'INDZSF4001', 'BOYOLALI', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(37, 'SUK2N9O037', 'JTGPLN4002', 'INDZSF4001', 'SUKOHARJO', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(38, 'WONT9UQ038', 'JTGPLN4002', 'INDZSF4001', 'WONOGIRI', 1, '2026-06-26', 'LFGKT49002', NULL, NULL),
(39, 'BANVWV7039', 'JWBRTPN2030', 'INDZSF4001', 'BANDUNG', 1, '2026-06-26', 'ITJMESP005', NULL, NULL),
(40, 'BEKZ2T1040', 'JWBRTPN2030', 'INDZSF4001', 'BEKASI', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(41, 'BOGTFTD041', 'JWBRTPN2030', 'INDZSF4001', 'BOGOR', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(42, 'DEP4598042', 'JWBRTPN2030', 'INDZSF4001', 'DEPOK', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(43, 'CIMVSZ0043', 'JWBRTPN2030', 'INDZSF4001', 'CIMAHI', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(44, 'SUK0W3P044', 'JWBRTPN2030', 'INDZSF4001', 'SUKABUMI', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(45, 'CIRWESB045', 'JWBRTPN2030', 'INDZSF4001', 'CIREBON', 1, '2026-06-26', 'LFGKT49002', NULL, NULL),
(46, 'TASOD3M046', 'JWBRTPN2030', 'INDZSF4001', 'TASIKMALAYA', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(47, 'BANU5KW047', 'JWBRTPN2030', 'INDZSF4001', 'BANJAR', 1, '2026-06-26', 'LFGKT49002', NULL, NULL),
(48, 'GARP3L5048', 'JWBRTPN2030', 'INDZSF4001', 'GARUT', 1, '2026-06-26', 'ITJMESP005', NULL, NULL),
(49, 'KUNLLXI049', 'JWBRTPN2030', 'INDZSF4001', 'KUNINGAN', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(50, 'INDDOHW050', 'JWBRTPN2030', 'INDZSF4001', 'INDRAMAYU', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(51, 'KARDDVF051', 'JWBRTPN2030', 'INDZSF4001', 'KARAWANG', 1, '2026-06-26', 'LFGKT49002', NULL, NULL),
(52, 'PUR10LO052', 'JWBRTPN2030', 'INDZSF4001', 'PURWAKARTA', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(53, 'SUBBGL1053', 'JWBRTPN2030', 'INDZSF4001', 'SUBANG', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(54, 'SUMB0QN054', 'JWBRTPN2030', 'INDZSF4001', 'SUMEDANG', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(55, 'MAJSLBI055', 'JWBRTPN2030', 'INDZSF4001', 'MAJALENGKA', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(56, 'JAK1Y2Z056', 'DKIJKTM7029', 'INDZSF4001', 'JAKARTA PUSAT', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(57, 'JAK3CJJ057', 'DKIJKTM7029', 'INDZSF4001', 'JAKARTA UTARA', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(58, 'JAKR5RU058', 'DKIJKTM7029', 'INDZSF4001', 'JAKARTA BARAT', 1, '2026-06-26', 'ITJMESP005', NULL, NULL),
(59, 'JAKD8IB059', 'DKIJKTM7029', 'INDZSF4001', 'JAKARTA SELATAN', 1, '2026-06-26', 'ITJMESP005', NULL, NULL),
(60, 'JAKN11S060', 'DKIJKTM7029', 'INDZSF4001', 'JAKARTA TIMUR', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(61, 'KEP1VKI061', 'DKIJKTM7029', 'INDZSF4001', 'KEPULAUAN SERIBU', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(62, 'SER1401062', 'BNTNSQK5031', 'INDZSF4001', 'SERANG', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(63, 'CILLJ0Y063', 'BNTNSQK5031', 'INDZSF4001', 'CILEGON', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(64, 'TANRDAS064', 'BNTNSQK5031', 'INDZSF4001', 'TANGERANG', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(65, 'TAN2BW6065', 'BNTNSQK5031', 'INDZSF4001', 'TANGERANG SELATAN', 1, '2026-06-26', 'LFGKT49002', NULL, NULL),
(66, 'PANVMMQ066', 'BNTNSQK5031', 'INDZSF4001', 'PANDEGLANG', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(67, 'LEB88WH067', 'BNTNSQK5031', 'INDZSF4001', 'LEBAK', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(68, 'YOGCJ6B068', 'DIYPLR7014', 'INDZSF4001', 'YOGYAKARTA', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(69, 'SLEMOVL069', 'DIYPLR7014', 'INDZSF4001', 'SLEMAN', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(70, 'BANNOAP070', 'DIYPLR7014', 'INDZSF4001', 'BANTUL', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(71, 'KULVEGB071', 'DIYPLR7014', 'INDZSF4001', 'KULON PROGO', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(72, 'GUNF1KB072', 'DIYPLR7014', 'INDZSF4001', 'GUNUNGKIDUL', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(73, 'DEN27TQ073', 'BALHWZ7003', 'INDZSF4001', 'DENPASAR', 1, '2026-06-26', 'LFGKT49002', NULL, NULL),
(74, 'BAD8RGW074', 'BALHWZ7003', 'INDZSF4001', 'BADUNG', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(75, 'GIA4GWN075', 'BALHWZ7003', 'INDZSF4001', 'GIANYAR', 1, '2026-06-26', 'ITJMESP005', NULL, NULL),
(76, 'TABFLYR076', 'BALHWZ7003', 'INDZSF4001', 'TABANAN', 1, '2026-06-26', 'ITJMESP005', NULL, NULL),
(77, 'KLU4H9A077', 'BALHWZ7003', 'INDZSF4001', 'KLUNGKUNG', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(78, 'BANF5F0078', 'BALHWZ7003', 'INDZSF4001', 'BANGLI', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(79, 'KARLXNU079', 'BALHWZ7003', 'INDZSF4001', 'KARANGASEM', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(80, 'BULIIMU080', 'BALHWZ7003', 'INDZSF4001', 'BULELENG', 1, '2026-06-26', 'ITJMESP005', NULL, NULL),
(81, 'JEMNIV8081', 'BALHWZ7003', 'INDZSF4001', 'JEMBRANA', 1, '2026-06-26', 'ITJMESP005', NULL, NULL),
(82, 'BANB91B082', 'ACEHRPZ2019', 'INDZSF4001', 'BANDA ACEH', 1, '2026-06-26', 'DTDE8RX004', '2026-06-26', 'LFGKT49002'),
(83, 'LANVBBB083', 'ACEHRPZ2019', 'INDZSF4001', 'LANGSA', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(84, 'LHOICQQ084', 'ACEHRPZ2019', 'INDZSF4001', 'LHOKSEUMAWE', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(85, 'SABP9EH085', 'ACEHRPZ2019', 'INDZSF4001', 'SABANG', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(86, 'SUBQJ4D086', 'ACEHRPZ2019', 'INDZSF4001', 'SUBULUSSALAM', 1, '2026-06-26', 'ITJMESP005', NULL, NULL),
(87, 'BIRUA81087', 'ACEHRPZ2019', 'INDZSF4001', 'BIREUEN', 1, '2026-06-26', 'ITJMESP005', NULL, NULL),
(88, 'MEUMI6Y088', 'ACEHRPZ2019', 'INDZSF4001', 'MEULABOH', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(89, 'SIGF9J6089', 'ACEHRPZ2019', 'INDZSF4001', 'SIGLI', 1, '2026-06-26', 'ITJMESP005', NULL, NULL),
(90, 'TAKOW4W090', 'ACEHRPZ2019', 'INDZSF4001', 'TAKENGON', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(91, 'BENB2G0091', 'ACEHRPZ2019', 'INDZSF4001', 'BENER MERIAH', 1, '2026-06-26', 'LFGKT49002', NULL, NULL),
(92, 'BLACULE092', 'ACEHRPZ2019', 'INDZSF4001', 'BLANGPIDIE', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(93, 'CALG433093', 'ACEHRPZ2019', 'INDZSF4001', 'CALANG', 1, '2026-06-26', 'LFGKT49002', NULL, NULL),
(94, 'TAPMA4N094', 'ACEHRPZ2019', 'INDZSF4001', 'TAPAKTUAN', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(95, 'SIN9DVY095', 'ACEHRPZ2019', 'INDZSF4001', 'SINGKIL', 1, '2026-06-26', 'ITJMESP005', NULL, NULL),
(96, 'MED2WCK096', 'SUTARVN4020', 'INDZSF4001', 'MEDAN', 1, '2026-06-26', 'LFGKT49002', NULL, NULL),
(97, 'BINNN04097', 'SUTARVN4020', 'INDZSF4001', 'BINJAI', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(98, 'PEMENJ1098', 'SUTARVN4020', 'INDZSF4001', 'PEMATANGSIANTAR', 1, '2026-06-26', 'LFGKT49002', NULL, NULL),
(99, 'TEBT3YW099', 'SUTARVN4020', 'INDZSF4001', 'TEBING TINGGI', 1, '2026-06-26', 'LFGKT49002', NULL, NULL),
(100, 'TAN1294100', 'SUTARVN4020', 'INDZSF4001', 'TANJUNGBALAI', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(101, 'SIBX31Q101', 'SUTARVN4020', 'INDZSF4001', 'SIBOLGA', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(102, 'PADUN1N102', 'SUTARVN4020', 'INDZSF4001', 'PADANGSIDEMPUAN', 1, '2026-06-26', 'ITJMESP005', NULL, NULL),
(103, 'GUN97FK103', 'SUTARVN4020', 'INDZSF4001', 'GUNUNGSITOLI', 1, '2026-06-26', 'ITJMESP005', NULL, NULL),
(104, 'LUBH5FX104', 'SUTARVN4020', 'INDZSF4001', 'LUBUK PAKAM', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(105, 'KISHACB105', 'SUTARVN4020', 'INDZSF4001', 'KISARAN', 1, '2026-06-26', 'LFGKT49002', NULL, NULL),
(106, 'RANZA2T106', 'SUTARVN4020', 'INDZSF4001', 'RANTAU PRAPAT', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(107, 'STA4T4W107', 'SUTARVN4020', 'INDZSF4001', 'STABAT', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(108, 'BALHS3G108', 'SUTARVN4020', 'INDZSF4001', 'BALIGE', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(109, 'KABIB31109', 'SUTARVN4020', 'INDZSF4001', 'KABANJAHE', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(110, 'BERRCRE110', 'SUTARVN4020', 'INDZSF4001', 'BERASTAGI', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(111, 'SIDXT5O111', 'SUTARVN4020', 'INDZSF4001', 'SIDIKALANG', 1, '2026-06-26', 'LFGKT49002', NULL, NULL),
(112, 'PADXBPZ112', 'SUBWQK7021', 'INDZSF4001', 'PADANG', 1, '2026-06-26', 'LFGKT49002', NULL, NULL),
(113, 'BUKQSW6113', 'SUBWQK7021', 'INDZSF4001', 'BUKITTINGGI', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(114, 'PAD7WJV114', 'SUBWQK7021', 'INDZSF4001', 'PADANG PANJANG', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(115, 'PAYRYFM115', 'SUBWQK7021', 'INDZSF4001', 'PAYAKUMBUH', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(116, 'SAWIPQK116', 'SUBWQK7021', 'INDZSF4001', 'SAWAHLUNTO', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(117, 'SOL4ZWN117', 'SUBWQK7021', 'INDZSF4001', 'SOLOK', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(118, 'PAR41ZM118', 'SUBWQK7021', 'INDZSF4001', 'PARIAMAN', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(119, 'BATLRHT119', 'SUBWQK7021', 'INDZSF4001', 'BATUSANGKAR', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(120, 'LUBMIPL120', 'SUBWQK7021', 'INDZSF4001', 'LUBUK SIKAPING', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(121, 'PAIHFKF121', 'SUBWQK7021', 'INDZSF4001', 'PAINAN', 1, '2026-06-26', 'ITJMESP005', NULL, NULL),
(122, 'PEK1ZR0122', 'RIAUFXJ3022', 'INDZSF4001', 'PEKANBARU', 1, '2026-06-26', 'ITJMESP005', NULL, NULL),
(123, 'DUMHWGG123', 'RIAUFXJ3022', 'INDZSF4001', 'DUMAI', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(124, 'BANYKOG124', 'RIAUFXJ3022', 'INDZSF4001', 'BANGKINANG', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(125, 'BEN3PG3125', 'RIAUFXJ3022', 'INDZSF4001', 'BENGKALIS', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(126, 'BAGQOFB126', 'RIAUFXJ3022', 'INDZSF4001', 'BAGANSIAPIAPI', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(127, 'TEMLGIS127', 'RIAUFXJ3022', 'INDZSF4001', 'TEMBILAHAN', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(128, 'REN5H2N128', 'RIAUFXJ3022', 'INDZSF4001', 'RENGAT', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(129, 'SIA76D5129', 'RIAUFXJ3022', 'INDZSF4001', 'SIAK SRI INDRAPURA', 1, '2026-06-26', 'ITJMESP005', NULL, NULL),
(130, 'PANT9RA130', 'RIAUFXJ3022', 'INDZSF4001', 'PANGKALAN KERINCI', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(131, 'TANCDJS131', 'KEPRIVB5023', 'INDZSF4001', 'TANJUNG PINANG', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(132, 'BAT2D53132', 'KEPRIVB5023', 'INDZSF4001', 'BATAM', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(133, 'BINWPHJ133', 'KEPRIVB5023', 'INDZSF4001', 'BINTAN', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(134, 'KAR2ONU134', 'KEPRIVB5023', 'INDZSF4001', 'KARIMUN', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(135, 'TARKSKE135', 'KEPRIVB5023', 'INDZSF4001', 'TAREMPA', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(136, 'DAI4JU9136', 'KEPRIVB5023', 'INDZSF4001', 'DAIK LINGGA', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(137, 'JAMTXB3137', 'JMBWHY8024', 'INDZSF4001', 'JAMBI', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(138, 'SUNLZVB138', 'JMBWHY8024', 'INDZSF4001', 'SUNGAI PENUH', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(139, 'MUAWQNC139', 'JMBWHY8024', 'INDZSF4001', 'MUARA BULIAN', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(140, 'MUAIFE0140', 'JMBWHY8024', 'INDZSF4001', 'MUARA BUNGO', 1, '2026-06-26', 'ITJMESP005', NULL, NULL),
(141, 'BANCR3Z141', 'JMBWHY8024', 'INDZSF4001', 'BANGKO', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(142, 'SARQ1U2142', 'JMBWHY8024', 'INDZSF4001', 'SAROLANGUN', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(143, 'KUA2WIY143', 'JMBWHY8024', 'INDZSF4001', 'KUALA TUNGKAL', 1, '2026-06-26', 'ITJMESP005', NULL, NULL),
(144, 'SENVP9M144', 'JMBWHY8024', 'INDZSF4001', 'SENGETI', 1, '2026-06-26', 'ITJMESP005', NULL, NULL),
(145, 'PALGG95145', 'SUSLJMP6025', 'INDZSF4001', 'PALEMBANG', 1, '2026-06-26', 'LFGKT49002', NULL, NULL),
(146, 'PRARVIJ146', 'SUSLJMP6025', 'INDZSF4001', 'PRABUMULIH', 1, '2026-06-26', 'ITJMESP005', NULL, NULL),
(147, 'LUB5GLM147', 'SUSLJMP6025', 'INDZSF4001', 'LUBUKLINGGAU', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(148, 'PAG12QR148', 'SUSLJMP6025', 'INDZSF4001', 'PAGAR ALAM', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(149, 'KAY8R8X149', 'SUSLJMP6025', 'INDZSF4001', 'KAYU AGUNG', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(150, 'BAT6I1X150', 'SUSLJMP6025', 'INDZSF4001', 'BATURAJA', 1, '2026-06-26', 'LFGKT49002', NULL, NULL),
(151, 'LAH0JHR151', 'SUSLJMP6025', 'INDZSF4001', 'LAHAT', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(152, 'MUA1UNE152', 'SUSLJMP6025', 'INDZSF4001', 'MUARA ENIM', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(153, 'SEK4HKK153', 'SUSLJMP6025', 'INDZSF4001', 'SEKAYU', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(154, 'INDEUQE154', 'SUSLJMP6025', 'INDZSF4001', 'INDRALAYA', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(155, 'PANN4UR155', 'KBBLTVC9026', 'INDZSF4001', 'PANGKAL PINANG', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(156, 'SUNCZO5156', 'KBBLTVC9026', 'INDZSF4001', 'SUNGAILIAT', 1, '2026-06-26', 'LFGKT49002', NULL, NULL),
(157, 'TANHGS0157', 'KBBLTVC9026', 'INDZSF4001', 'TANJUNG PANDAN', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(158, 'MAN7974158', 'KBBLTVC9026', 'INDZSF4001', 'MANGGAR', 1, '2026-06-26', 'LFGKT49002', NULL, NULL),
(159, 'MEN564B159', 'KBBLTVC9026', 'INDZSF4001', 'MENTOK', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(160, 'KOB7XDH160', 'KBBLTVC9026', 'INDZSF4001', 'KOBA', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(161, 'BEN3QHB161', 'BNGKCWZ1027', 'INDZSF4001', 'BENGKULU', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(162, 'CURWFVH162', 'BNGKCWZ1027', 'INDZSF4001', 'CURUP', 1, '2026-06-26', 'ITJMESP005', NULL, NULL),
(163, 'ARGYU30163', 'BNGKCWZ1027', 'INDZSF4001', 'ARGA MAKMUR', 1, '2026-06-26', 'LFGKT49002', '2026-06-26', 'LFGKT49002'),
(164, 'MANZ94T164', 'BNGKCWZ1027', 'INDZSF4001', 'MANNA', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(165, 'KEPTUFV165', 'BNGKCWZ1027', 'INDZSF4001', 'KEPAHIANG', 1, '2026-06-26', 'ITJMESP005', NULL, NULL),
(166, 'MUKBYNZ166', 'BNGKCWZ1027', 'INDZSF4001', 'MUKOMUKO', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(167, 'TAI4ZF8167', 'BNGKCWZ1027', 'INDZSF4001', 'TAIS', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(168, 'BANQ9C3168', 'LMPQNRX4028', 'INDZSF4001', 'BANDAR LAMPUNG', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(169, 'METLK3Q169', 'LMPQNRX4028', 'INDZSF4001', 'METRO', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(170, 'KAL038J170', 'LMPQNRX4028', 'INDZSF4001', 'KALIANDA', 1, '2026-06-26', 'LFGKT49002', NULL, NULL),
(171, 'KOT74F0171', 'LMPQNRX4028', 'INDZSF4001', 'KOTABUMI', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(172, 'GUNIIP5172', 'LMPQNRX4028', 'INDZSF4001', 'GUNUNG SUGIH', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(173, 'PRISBVT173', 'LMPQNRX4028', 'INDZSF4001', 'PRINGSEWU', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(174, 'LIWVG79174', 'LMPQNRX4028', 'INDZSF4001', 'LIWA', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(175, 'KRU2KD9175', 'LMPQNRX4028', 'INDZSF4001', 'KRUI', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(176, 'MENBXDQ176', 'LMPQNRX4028', 'INDZSF4001', 'MENGGALA', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(177, 'BLAQ6NO177', 'LMPQNRX4028', 'INDZSF4001', 'BLAMBANGAN UMPU', 1, '2026-06-26', 'LFGKT49002', NULL, NULL),
(178, 'SUKKQUV178', 'LMPQNRX4028', 'INDZSF4001', 'SUKADANA', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(179, 'GED79S6179', 'LMPQNRX4028', 'INDZSF4001', 'GEDONG TATAAN', 1, '2026-06-26', 'LFGKT49002', NULL, NULL),
(180, 'MATNKRL180', 'NTBZPWN8032', 'INDZSF4001', 'MATARAM', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(181, 'BIMVCXW181', 'NTBZPWN8032', 'INDZSF4001', 'BIMA', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(182, 'PRAQQ2U182', 'NTBZPWN8032', 'INDZSF4001', 'PRAYA', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(183, 'SEL4DRK183', 'NTBZPWN8032', 'INDZSF4001', 'SELONG', 1, '2026-06-26', 'LFGKT49002', NULL, NULL),
(184, 'SUMKA78184', 'NTBZPWN8032', 'INDZSF4001', 'SUMBAWA BESAR', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(185, 'DOMMZ9S185', 'NTBZPWN8032', 'INDZSF4001', 'DOMPU', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(186, 'TALU0XM186', 'NTBZPWN8032', 'INDZSF4001', 'TALIWANG', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(187, 'TANLWRX187', 'NTBZPWN8032', 'INDZSF4001', 'TANJUNG', 1, '2026-06-26', 'LFGKT49002', NULL, NULL),
(188, 'GERJ623188', 'NTBZPWN8032', 'INDZSF4001', 'GERUNG', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(189, 'KUPNCAT189', 'NTTQMJV3033', 'INDZSF4001', 'KUPANG', 1, '2026-06-26', 'LFGKT49002', NULL, NULL),
(190, 'ENDXCSQ190', 'NTTQMJV3033', 'INDZSF4001', 'ENDE', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(191, 'MAU23OH191', 'NTTQMJV3033', 'INDZSF4001', 'MAUMERE', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(192, 'RUTMDTI192', 'NTTQMJV3033', 'INDZSF4001', 'RUTENG', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(193, 'BAJ8B7S193', 'NTTQMJV3033', 'INDZSF4001', 'BAJAWA', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(194, 'LAROHRQ194', 'NTTQMJV3033', 'INDZSF4001', 'LARANTUKA', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(195, 'WAI25N2195', 'NTTQMJV3033', 'INDZSF4001', 'WAINGAPU', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(196, 'WAIEHGT196', 'NTTQMJV3033', 'INDZSF4001', 'WAIKABUBAK', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(197, 'ATAJF9I197', 'NTTQMJV3033', 'INDZSF4001', 'ATAMBUA', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(198, 'KEFQJMZ198', 'NTTQMJV3033', 'INDZSF4001', 'KEFAMENANU', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(199, 'SOEYA2W199', 'NTTQMJV3033', 'INDZSF4001', 'SOE', 1, '2026-06-26', 'LFGKT49002', NULL, NULL),
(200, 'LAB5QT0200', 'NTTQMJV3033', 'INDZSF4001', 'LABUAN BAJO', 1, '2026-06-26', 'ITJMESP005', NULL, NULL),
(201, 'KALC22C201', 'NTTQMJV3033', 'INDZSF4001', 'KALABAHI', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(202, 'LEWBHY0202', 'NTTQMJV3033', 'INDZSF4001', 'LEWOLEBA', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(203, 'BORLUAK203', 'NTTQMJV3033', 'INDZSF4001', 'BORONG', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(204, 'PON3010204', 'KALBRTF6034', 'INDZSF4001', 'PONTIANAK', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(205, 'SINF7VT205', 'KALBRTF6034', 'INDZSF4001', 'SINGKAWANG', 1, '2026-06-26', 'LFGKT49002', NULL, NULL),
(206, 'SAMBKY3206', 'KALBRTF6034', 'INDZSF4001', 'SAMBAS', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(207, 'MEMIMXP207', 'KALBRTF6034', 'INDZSF4001', 'MEMPAWAH', 1, '2026-06-26', 'ITJMESP005', NULL, NULL),
(208, 'SAN0YOX208', 'KALBRTF6034', 'INDZSF4001', 'SANGGAU', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(209, 'SINM109209', 'KALBRTF6034', 'INDZSF4001', 'SINTANG', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(210, 'KETZX3M210', 'KALBRTF6034', 'INDZSF4001', 'KETAPANG', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(211, 'PUT8GKP211', 'KALBRTF6034', 'INDZSF4001', 'PUTUSSIBAU', 1, '2026-06-26', 'LFGKT49002', NULL, NULL),
(212, 'NGAIVSV212', 'KALBRTF6034', 'INDZSF4001', 'NGABANG', 1, '2026-06-26', 'LFGKT49002', NULL, NULL),
(213, 'SUK6WIV213', 'KALBRTF6034', 'INDZSF4001', 'SUKADANA KAYONG', 1, '2026-06-26', 'LFGKT49002', NULL, NULL),
(214, 'PAL060X214', 'KALTGHN9035', 'INDZSF4001', 'PALANGKA RAYA', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(215, 'SAM8IE8215', 'KALTGHN9035', 'INDZSF4001', 'SAMPIT', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(216, 'PANYECO216', 'KALTGHN9035', 'INDZSF4001', 'PANGKALAN BUN', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(217, 'KUA7YC0217', 'KALTGHN9035', 'INDZSF4001', 'KUALA KAPUAS', 1, '2026-06-26', 'LFGKT49002', NULL, NULL),
(218, 'BUN8D65218', 'KALTGHN9035', 'INDZSF4001', 'BUNTOK', 1, '2026-06-26', 'ITJMESP005', NULL, NULL),
(219, 'MUAS8P2219', 'KALTGHN9035', 'INDZSF4001', 'MUARA TEWEH', 1, '2026-06-26', 'ITJMESP005', NULL, NULL),
(220, 'KASSZKS220', 'KALTGHN9035', 'INDZSF4001', 'KASONGAN', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(221, 'SUK9AXW221', 'KALTGHN9035', 'INDZSF4001', 'SUKAMARA', 1, '2026-06-26', 'LFGKT49002', NULL, NULL),
(222, 'NAN8725222', 'KALTGHN9035', 'INDZSF4001', 'NANGA BULIK', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(223, 'KUAD38Q223', 'KALTGHN9035', 'INDZSF4001', 'KUALA PEMBUANG', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(224, 'BANB8QA224', 'KALSLRV4036', 'INDZSF4001', 'BANJARMASIN', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(225, 'BANBIXO225', 'KALSLRV4036', 'INDZSF4001', 'BANJARBARU', 1, '2026-06-26', 'ITJMESP005', NULL, NULL),
(226, 'MAR0J5G226', 'KALSLRV4036', 'INDZSF4001', 'MARTAPURA', 1, '2026-06-26', 'ITJMESP005', NULL, NULL),
(227, 'MARIZYK227', 'KALSLRV4036', 'INDZSF4001', 'MARABAHAN', 1, '2026-06-26', 'LFGKT49002', NULL, NULL),
(228, 'RANCBCD228', 'KALSLRV4036', 'INDZSF4001', 'RANTAU', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(229, 'KANBW4I229', 'KALSLRV4036', 'INDZSF4001', 'KANDANGAN', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(230, 'BARCXU0230', 'KALSLRV4036', 'INDZSF4001', 'BARABAI', 1, '2026-06-26', 'LFGKT49002', NULL, NULL),
(231, 'AMUEP9K231', 'KALSLRV4036', 'INDZSF4001', 'AMUNTAI', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(232, 'TANZXKP232', 'KALSLRV4036', 'INDZSF4001', 'TANJUNG TABALONG', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(233, 'SAMGU8O233', 'KALTMLQ7037', 'INDZSF4001', 'SAMARINDA', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(234, 'BALD27M234', 'KALTMLQ7037', 'INDZSF4001', 'BALIKPAPAN', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(235, 'BONG37Y235', 'KALTMLQ7037', 'INDZSF4001', 'BONTANG', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(236, 'TEN845K236', 'KALTMLQ7037', 'INDZSF4001', 'TENGGARONG', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(237, 'SANDXFS237', 'KALTMLQ7037', 'INDZSF4001', 'SANGATTA', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(238, 'PENZES0238', 'KALTMLQ7037', 'INDZSF4001', 'PENAJAM', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(239, 'TANLUYL239', 'KALTMLQ7037', 'INDZSF4001', 'TANAH GROGOT', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(240, 'SENPO78240', 'KALTMLQ7037', 'INDZSF4001', 'SENDAWAR', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(241, 'TAR0STE241', 'KALUTPZ2038', 'INDZSF4001', 'TARAKAN', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(242, 'TANOHKS242', 'KALUTPZ2038', 'INDZSF4001', 'TANJUNG SELOR', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(243, 'NUNZDTT243', 'KALUTPZ2038', 'INDZSF4001', 'NUNUKAN', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(244, 'MALE0GG244', 'KALUTPZ2038', 'INDZSF4001', 'MALINAU', 1, '2026-06-26', 'ITJMESP005', NULL, NULL),
(245, 'TIDZOLP245', 'KALUTPZ2038', 'INDZSF4001', 'TIDENG PALE', 1, '2026-06-26', 'LFGKT49002', NULL, NULL),
(246, 'MANNFP1246', 'SULUTXN5039', 'INDZSF4001', 'MANADO', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(247, 'BITBZEH247', 'SULUTXN5039', 'INDZSF4001', 'BITUNG', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(248, 'TOMX65C248', 'SULUTXN5039', 'INDZSF4001', 'TOMOHON', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(249, 'KOTLWVJ249', 'SULUTXN5039', 'INDZSF4001', 'KOTAMOBAGU', 1, '2026-06-26', 'ITJMESP005', NULL, NULL),
(250, 'TON67OD250', 'SULUTXN5039', 'INDZSF4001', 'TONDANO', 1, '2026-06-26', 'LFGKT49002', NULL, NULL),
(251, 'AIRODKY251', 'SULUTXN5039', 'INDZSF4001', 'AIRMADIDI', 1, '2026-06-26', 'CEMPL3Z003', '2026-06-26', 'DTDE8RX004'),
(252, 'AMUUMZN252', 'SULUTXN5039', 'INDZSF4001', 'AMURANG', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(253, 'RATW5KB253', 'SULUTXN5039', 'INDZSF4001', 'RATAHAN', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(254, 'BOR2EQ7254', 'SULUTXN5039', 'INDZSF4001', 'BOROKO', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(255, 'GORSALL255', 'GRNTLQM8040', 'INDZSF4001', 'GORONTALO', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(256, 'LIMVFPT256', 'GRNTLQM8040', 'INDZSF4001', 'LIMBOTO', 1, '2026-06-26', 'ITJMESP005', NULL, NULL),
(257, 'MARBHWZ257', 'GRNTLQM8040', 'INDZSF4001', 'MARISA', 1, '2026-06-26', 'ITJMESP005', NULL, NULL),
(258, 'TILVL81258', 'GRNTLQM8040', 'INDZSF4001', 'TILAMUTA', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(259, 'KWAD4IO259', 'GRNTLQM8040', 'INDZSF4001', 'KWANDANG', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(260, 'PAL76NG260', 'SULTGHW3041', 'INDZSF4001', 'PALU', 1, '2026-06-26', 'ITJMESP005', NULL, NULL),
(261, 'POSP5M2261', 'SULTGHW3041', 'INDZSF4001', 'POSO', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(262, 'LUW1R8D262', 'SULTGHW3041', 'INDZSF4001', 'LUWUK', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(263, 'DONSV2O263', 'SULTGHW3041', 'INDZSF4001', 'DONGGALA', 1, '2026-06-26', 'ITJMESP005', NULL, NULL),
(264, 'TOLVZL6264', 'SULTGHW3041', 'INDZSF4001', 'TOLITOLI', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(265, 'BUOA8DY265', 'SULTGHW3041', 'INDZSF4001', 'BUOL', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(266, 'PAR1AMO266', 'SULTGHW3041', 'INDZSF4001', 'PARIGI', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(267, 'AMPWPT0267', 'SULTGHW3041', 'INDZSF4001', 'AMPANA', 1, '2026-06-26', 'IE1BGVY006', '2026-06-26', 'LFGKT49002'),
(268, 'BANDFKP268', 'SULTGHW3041', 'INDZSF4001', 'BANAWA', 1, '2026-06-26', 'LFGKT49002', NULL, NULL),
(269, 'MAMNWPH269', 'SULBRVK6042', 'INDZSF4001', 'MAMUJU', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(270, 'MAJH25F270', 'SULBRVK6042', 'INDZSF4001', 'MAJENE', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(271, 'POLWS5W271', 'SULBRVK6042', 'INDZSF4001', 'POLEWALI', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(272, 'PAS25E1272', 'SULBRVK6042', 'INDZSF4001', 'PASANGKAYU', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(273, 'MAM2ORC273', 'SULBRVK6042', 'INDZSF4001', 'MAMASA', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(274, 'MAKCFSP274', 'SULSLHP9043', 'INDZSF4001', 'MAKASSAR', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(275, 'PARL9R0275', 'SULSLHP9043', 'INDZSF4001', 'PAREPARE', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(276, 'PALQ5I6276', 'SULSLHP9043', 'INDZSF4001', 'PALOPO', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(277, 'MARNI0O277', 'SULSLHP9043', 'INDZSF4001', 'MAROS', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(278, 'SUND965278', 'SULSLHP9043', 'INDZSF4001', 'SUNGGUMINASA', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(279, 'TAKKPGK279', 'SULSLHP9043', 'INDZSF4001', 'TAKALAR', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(280, 'JENL5DH280', 'SULSLHP9043', 'INDZSF4001', 'JENEPONTO', 1, '2026-06-26', 'ITJMESP005', NULL, NULL),
(281, 'BAN7LVR281', 'SULSLHP9043', 'INDZSF4001', 'BANTAENG', 1, '2026-06-26', 'ITJMESP005', NULL, NULL),
(282, 'BULRH88282', 'SULSLHP9043', 'INDZSF4001', 'BULUKUMBA', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(283, 'SINC5N4283', 'SULSLHP9043', 'INDZSF4001', 'SINJAI', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(284, 'WATD1ZS284', 'SULSLHP9043', 'INDZSF4001', 'WATAMPONE', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(285, 'SENZ7DY285', 'SULSLHP9043', 'INDZSF4001', 'SENGKANG', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(286, 'SIDSFWZ286', 'SULSLHP9043', 'INDZSF4001', 'SIDRAP', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(287, 'PINQVWL287', 'SULSLHP9043', 'INDZSF4001', 'PINRANG', 1, '2026-06-26', 'ITJMESP005', NULL, NULL),
(288, 'BARHIIO288', 'SULSLHP9043', 'INDZSF4001', 'BARRU', 1, '2026-06-26', 'ITJMESP005', NULL, NULL),
(289, 'PANVK51289', 'SULSLHP9043', 'INDZSF4001', 'PANGKAJENE', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(290, 'ENRD330290', 'SULSLHP9043', 'INDZSF4001', 'ENREKANG', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(291, 'KENEZ6V291', 'SULTGQW4044', 'INDZSF4001', 'KENDARI', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(292, 'BAU1NWE292', 'SULTGQW4044', 'INDZSF4001', 'BAUBAU', 1, '2026-06-26', 'LFGKT49002', NULL, NULL),
(293, 'UNA6871293', 'SULTGQW4044', 'INDZSF4001', 'UNAAHA', 1, '2026-06-26', 'LFGKT49002', NULL, NULL),
(294, 'KOLVZJT294', 'SULTGQW4044', 'INDZSF4001', 'KOLAKA', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(295, 'RAHWSYX295', 'SULTGQW4044', 'INDZSF4001', 'RAHA', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(296, 'WANCX8T296', 'SULTGQW4044', 'INDZSF4001', 'WANGI-WANGI', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(297, 'PASE3PW297', 'SULTGQW4044', 'INDZSF4001', 'PASARWAJO', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(298, 'AND9X7U298', 'SULTGQW4044', 'INDZSF4001', 'ANDOOLO', 1, '2026-06-26', 'ITJMESP005', '2026-06-26', 'LFGKT49002'),
(299, 'LASOJ14299', 'SULTGQW4044', 'INDZSF4001', 'LASUSUA', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(300, 'RUML58L300', 'SULTGQW4044', 'INDZSF4001', 'RUMBIA', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(301, 'AMBOHE4301', 'MLKURPN7045', 'INDZSF4001', 'AMBON', 1, '2026-06-26', 'IE1BGVY006', '2026-06-26', 'LFGKT49002'),
(302, 'TUAG9LB302', 'MLKURPN7045', 'INDZSF4001', 'TUAL', 1, '2026-06-26', 'CEMPL3Z003', '2026-06-26', 'LFGKT49002'),
(303, 'MAS016M303', 'MLKURPN7045', 'INDZSF4001', 'MASOHI', 1, '2026-06-26', 'LFGKT49002', NULL, NULL),
(304, 'NAM9ZBD304', 'MLKURPN7045', 'INDZSF4001', 'NAMLEA', 1, '2026-06-26', 'ITJMESP005', NULL, NULL),
(305, 'SAUQP4Z305', 'MLKURPN7045', 'INDZSF4001', 'SAUMLAKI', 1, '2026-06-26', 'ITJMESP005', NULL, NULL),
(306, 'TIA9FR3306', 'MLKURPN7045', 'INDZSF4001', 'TIAKUR', 1, '2026-06-26', 'LFGKT49002', NULL, NULL),
(307, 'DOB6CF5307', 'MLKURPN7045', 'INDZSF4001', 'DOBO', 1, '2026-06-26', 'ITJMESP005', NULL, NULL),
(308, 'PIRK0N3308', 'MLKURPN7045', 'INDZSF4001', 'PIRU', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(309, 'TERB4A0309', 'MLKUTNZ2046', 'INDZSF4001', 'TERNATE', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(310, 'TIDNMBG310', 'MLKUTNZ2046', 'INDZSF4001', 'TIDORE', 1, '2026-06-26', 'ITJMESP005', NULL, NULL),
(311, 'SOFK1LZ311', 'MLKUTNZ2046', 'INDZSF4001', 'SOFIFI', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(312, 'TOB436W312', 'MLKUTNZ2046', 'INDZSF4001', 'TOBELO', 1, '2026-06-26', 'LFGKT49002', NULL, NULL),
(313, 'JAI1K0V313', 'MLKUTNZ2046', 'INDZSF4001', 'JAILOLO', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(314, 'LABDP7D314', 'MLKUTNZ2046', 'INDZSF4001', 'LABUHA', 1, '2026-06-26', 'ITJMESP005', NULL, NULL),
(315, 'SANXGN9315', 'MLKUTNZ2046', 'INDZSF4001', 'SANANA', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(316, 'JAYWB4J316', 'PAPUAQKV5047', 'INDZSF4001', 'JAYAPURA', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(317, 'SENV8S2317', 'PAPUAQKV5047', 'INDZSF4001', 'SENTANI', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(318, 'ARSBQ9X318', 'PAPUAQKV5047', 'INDZSF4001', 'ARSO', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(319, 'SAR4BKA319', 'PAPUAQKV5047', 'INDZSF4001', 'SARMI', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(320, 'SER5LFJ320', 'PAPUAQKV5047', 'INDZSF4001', 'SERUI', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(321, 'BIAT5NA321', 'PAPUAQKV5047', 'INDZSF4001', 'BIAK', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(322, 'BOTIQO2322', 'PAPUAQKV5047', 'INDZSF4001', 'BOTAWA', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(323, 'SORV650323', 'PAPUAQKV5047', 'INDZSF4001', 'SORENDIWERI', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(324, 'MANJYR6324', 'PAPUABWM8048', 'INDZSF4001', 'MANOKWARI', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(325, 'BINHQ4Y325', 'PAPUABWM8048', 'INDZSF4001', 'BINTUNI', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(326, 'RASTRF4326', 'PAPUABWM8048', 'INDZSF4001', 'RASIEI', 1, '2026-06-26', 'ITJMESP005', NULL, NULL),
(327, 'FAK2BUV327', 'PAPUABWM8048', 'INDZSF4001', 'FAKFAK', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(328, 'KAI9YJA328', 'PAPUABWM8048', 'INDZSF4001', 'KAIMANA', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(329, 'ANGBIUD329', 'PAPUABWM8048', 'INDZSF4001', 'ANGGI', 1, '2026-06-26', 'ITJMESP005', '2026-06-26', 'LFGKT49002'),
(330, 'RANZCIP330', 'PAPUABWM8048', 'INDZSF4001', 'RANSIKI', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(331, 'MER0XIT331', 'PAPUASLX3049', 'INDZSF4001', 'MERAUKE', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(332, 'TANGVIP332', 'PAPUASLX3049', 'INDZSF4001', 'TANAH MERAH', 1, '2026-06-26', 'LFGKT49002', NULL, NULL),
(333, 'KEPFNWP333', 'PAPUASLX3049', 'INDZSF4001', 'KEPI', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(334, 'AGADXSR334', 'PAPUASLX3049', 'INDZSF4001', 'AGATS', 1, '2026-06-26', 'ITJMESP005', '2026-06-26', 'DTDE8RX004'),
(335, 'NAB92RE335', 'PAPUATGQ6050', 'INDZSF4001', 'NABIRE', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(336, 'TIM5U3G336', 'PAPUATGQ6050', 'INDZSF4001', 'TIMIKA', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(337, 'ENAVV42337', 'PAPUATGQ6050', 'INDZSF4001', 'ENAROTALI', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(338, 'SUGBFJ4338', 'PAPUATGQ6050', 'INDZSF4001', 'SUGAPA', 1, '2026-06-26', 'ITJMESP005', NULL, NULL),
(339, 'ILA51C4339', 'PAPUATGQ6050', 'INDZSF4001', 'ILAGA', 1, '2026-06-26', 'CEMPL3Z003', NULL, NULL),
(340, 'WAG0IBK340', 'PAPUATGQ6050', 'INDZSF4001', 'WAGHETE', 1, '2026-06-26', 'LFGKT49002', NULL, NULL),
(341, 'WAMU8XH341', 'PAPUAPGZ9051', 'INDZSF4001', 'WAMENA', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(342, 'TIO200C342', 'PAPUAPGZ9051', 'INDZSF4001', 'TIOM', 1, '2026-06-26', 'ITJMESP005', NULL, NULL),
(343, 'KOB2JH7343', 'PAPUAPGZ9051', 'INDZSF4001', 'KOBAKMA', 1, '2026-06-26', 'LFGKT49002', NULL, NULL),
(344, 'KARPQFE344', 'PAPUAPGZ9051', 'INDZSF4001', 'KARUBAGA', 1, '2026-06-26', 'LFGKT49002', NULL, NULL),
(345, 'DEKLOH7345', 'PAPUAPGZ9051', 'INDZSF4001', 'DEKAI', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(346, 'OKS6HT5346', 'PAPUAPGZ9051', 'INDZSF4001', 'OKSIBIL', 1, '2026-06-26', 'ITJMESP005', NULL, NULL),
(347, 'SORTGHF347', 'PAPUABDV4052', 'INDZSF4001', 'SORONG', 1, '2026-06-26', 'SA6EDRU001', NULL, NULL),
(348, 'AIMH17C348', 'PAPUABDV4052', 'INDZSF4001', 'AIMAS', 1, '2026-06-26', 'LFGKT49002', '2026-06-26', 'DTDE8RX004'),
(349, 'TEMPHT9349', 'PAPUABDV4052', 'INDZSF4001', 'TEMINABUAN', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(350, 'WAIR2KJ350', 'PAPUABDV4052', 'INDZSF4001', 'WAISAI', 1, '2026-06-26', 'DTDE8RX004', NULL, NULL),
(351, 'ISAE3XV351', 'JOHRQM5005', 'MALRP7G002', 'ISKANDAR', 1, '2026-06-26', 'LFGKT49002', NULL, NULL),
(352, 'IPUUFK1352', 'JOHRQM5005', 'MALRP7G002', 'KLUANG', 1, '2026-06-26', 'LFGKT49002', '2026-06-26', 'LFGKT49002'),
(353, 'SEG1R6B353', 'JOHRQM5005', 'MALRP7G002', 'SEGAMAT', 1, '2026-06-26', 'LFGKT49002', NULL, NULL),
(354, 'MEDU7YL354', 'JOHRQM5005', 'MALRP7G002', 'MERSING', 1, '2026-06-26', 'LFGKT49002', NULL, NULL);

-- --------------------------------------------------------

--
-- Struktur dari tabel `contacts`
--

CREATE TABLE `contacts` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(255) NOT NULL,
  `subject` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data untuk tabel `contacts`
--

INSERT INTO `contacts` (`id`, `name`, `email`, `phone`, `subject`, `message`, `createdAt`, `updatedAt`) VALUES
(1, 'nigel', 'dokumen@gmail.com', '08233556796', 'Tanya', 'Tolong bantu kirim', '2026-05-04 08:50:17', '2026-05-04 08:50:17'),
(2, 'clarence', 'eldy2@iil.co.id', '04723626343', 'sewa', 'pingin tau', '2026-05-04 08:53:54', '2026-05-04 08:53:54'),
(3, 'clarissa', 'clarissa@visiniaga.com', '0483827234', 'Sewa villa malang', 'Mau tanya harga', '2026-05-04 09:20:22', '2026-05-04 09:20:22'),
(4, 'clarissa', 'clarissa@visiniaga.com', '0483827234', 'Sewa villa malang', 'Mau tanya harga', '2026-05-04 09:20:24', '2026-05-04 09:20:24'),
(5, 'clarissa', 'clarissa@visiniaga.com', '0483827234', 'Sewa villa malang', 'Mau tanya harga', '2026-05-04 09:20:25', '2026-05-04 09:20:25'),
(6, 'clarissa', 'clarissa@visiniaga.com', '0483827234', 'Sewa villa malang', 'Mau tanya harga', '2026-05-04 09:20:26', '2026-05-04 09:20:26'),
(7, 'clarissa', 'clarissa@visiniaga.com', '0483827234', 'Sewa villa malang', 'Mau tanya harga', '2026-05-04 09:20:26', '2026-05-04 09:20:26'),
(8, 'clarissa', 'clarissa@visiniaga.com', '0483827234', 'Sewa villa malang', 'Mau tanya harga', '2026-05-04 09:20:26', '2026-05-04 09:20:26'),
(9, 'clarissa', 'clarissa@visiniaga.com', '0483827234', 'Sewa villa malang', 'Mau tanya harga', '2026-05-04 09:20:27', '2026-05-04 09:20:27'),
(10, 'clarissa', 'clarissa@visiniaga.com', '0483827234', 'Sewa villa malang', 'Mau tanya harga', '2026-05-04 09:21:41', '2026-05-04 09:21:41'),
(11, 'clarissa', 'clarissa@visiniaga.com', '0483827234', 'Sewa villa malang', 'Mau tanya harga', '2026-05-04 09:21:42', '2026-05-04 09:21:42'),
(12, 'clarissa', 'clarissa@visiniaga.com', '0483827234', 'Sewa villa malang', 'Mau tanya harga', '2026-05-04 09:21:42', '2026-05-04 09:21:42'),
(13, 'clarissa', 'clarissa@visiniaga.com', '0483827234', 'Sewa villa malang', 'Mau tanya harga', '2026-05-04 09:21:42', '2026-05-04 09:21:42'),
(14, 'nia', 'nia@gmail.com', '04666899', 'tanya', 'nbhnkljibn', '2026-05-04 09:39:14', '2026-05-04 09:39:14'),
(15, 'nia', 'nia@gmail.com', '04666899', 'tanya', 'nbhnkljibn', '2026-05-04 09:58:24', '2026-05-04 09:58:24'),
(16, 'nia', 'nia@gmail.com', '04666899', 'tanya', 'nbhnkljibn', '2026-05-04 09:58:26', '2026-05-04 09:58:26'),
(17, 'nia', 'nia@gmail.com', '04666899', 'tanya', 'nbhnkljibn', '2026-05-04 09:58:27', '2026-05-04 09:58:27'),
(18, 'nia', 'nia@gmail.com', '04666899', 'tanya', 'nbhnkljibn', '2026-05-04 10:00:10', '2026-05-04 10:00:10'),
(19, 'sqadq', 'nia@gmail.cpm', '0872655678', 'Tanya hotel', 'Hotel di malang ada apa saja?', '2026-05-04 10:00:36', '2026-05-04 10:00:36'),
(20, 'sqadq', 'nia@gmail.cpm', '0872655678', 'Tanya hotel', 'Hotel di malang ada apa saja?', '2026-05-04 10:00:37', '2026-05-04 10:00:37'),
(21, 'sqadq', 'nia@gmail.cpm', '0872655678', 'Tanya hotel', 'Hotel di malang ada apa saja?', '2026-05-04 10:00:37', '2026-05-04 10:00:37'),
(22, 'sqadq', 'nia@gmail.cpm', '0872655678', 'Tanya hotel', 'Hotel di malang ada apa saja?', '2026-05-04 10:00:38', '2026-05-04 10:00:38'),
(23, 'sqadq', 'nia@gmail.cpm', '0872655678', 'Tanya hotel', 'Hotel di malang ada apa saja?', '2026-05-04 10:00:38', '2026-05-04 10:00:38'),
(24, 'sqadq', 'nia@gmail.cpm', '0872655678', 'Tanya hotel', 'Hotel di malang ada apa saja?', '2026-05-04 10:00:38', '2026-05-04 10:00:38'),
(25, 'sqadq', 'nia@gmail.cpm', '0872655678', 'Tanya hotel', 'Hotel di malang ada apa saja?', '2026-05-04 10:00:38', '2026-05-04 10:00:38'),
(26, 'sqadq', 'nia@gmail.cpm', '0872655678', 'Tanya hotel', 'Hotel di malang ada apa saja?', '2026-05-04 10:00:38', '2026-05-04 10:00:38'),
(27, 'sqadq', 'nia@gmail.cpm', '0872655678', 'Tanya hotel', 'Hotel di malang ada apa saja?', '2026-05-04 10:00:39', '2026-05-04 10:00:39'),
(28, 'sqadq', 'nia@gmail.cpm', '0872655678', 'Tanya hotel', 'Hotel di malang ada apa saja?', '2026-05-04 10:00:39', '2026-05-04 10:00:39'),
(29, 'sqadq', 'nia@gmail.cpm', '0872655678', 'Tanya hotel', 'Hotel di malang ada apa saja?', '2026-05-04 10:00:39', '2026-05-04 10:00:39'),
(30, 'sqadq', 'nia@gmail.cpm', '0872655678', 'Tanya hotel', 'Hotel di malang ada apa saja?', '2026-05-04 10:00:39', '2026-05-04 10:00:39'),
(31, 'sqadq', 'nia@gmail.cpm', '0872655678', 'Tanya hotel', 'Hotel di malang ada apa saja?', '2026-05-04 10:00:40', '2026-05-04 10:00:40'),
(32, 'sqadq', 'nia@gmail.cpm', '0872655678', 'Tanya hotel', 'Hotel di malang ada apa saja?', '2026-05-04 10:00:41', '2026-05-04 10:00:41'),
(33, 'sqadq', 'nia@gmail.cpm', '0872655678', 'Tanya hotel', 'Hotel di malang ada apa saja?', '2026-05-04 10:00:41', '2026-05-04 10:00:41'),
(34, 'sqadq', 'nia@gmail.cpm', '0872655678', 'Tanya hotel', 'Hotel di malang ada apa saja?', '2026-05-04 10:05:15', '2026-05-04 10:05:15'),
(35, 'sqadq', 'nia@gmail.cpm', '0872655678', 'Tanya hotel', 'Hotel di malang ada apa saja?', '2026-05-04 10:05:16', '2026-05-04 10:05:16'),
(36, 'sqadq', 'nia@gmail.cpm', '0872655678', 'Tanya hotel', 'Hotel di malang ada apa saja?', '2026-05-04 10:05:16', '2026-05-04 10:05:16'),
(37, 'sqadq', 'nia@gmail.cpm', '0872655678', 'Tanya hotel', 'Hotel di malang ada apa saja?', '2026-05-04 10:05:17', '2026-05-04 10:05:17'),
(38, 'sqadq', 'nia@gmail.cpm', '0872655678', 'Tanya hotel', 'Hotel di malang ada apa saja?', '2026-05-04 10:05:17', '2026-05-04 10:05:17'),
(39, 'sqadq', 'nia@gmail.cpm', '0872655678', 'Tanya hotel', 'Hotel di malang ada apa saja?', '2026-05-04 10:05:17', '2026-05-04 10:05:17'),
(40, 'sqadq', 'nia@gmail.cpm', '0872655678', 'Tanya hotel', 'Hotel di malang ada apa saja?', '2026-05-04 10:05:17', '2026-05-04 10:05:17'),
(41, 'sqadq', 'nia@gmail.cpm', '0872655678', 'Tanya hotel', 'Hotel di malang ada apa saja?', '2026-05-04 10:05:17', '2026-05-04 10:05:17'),
(42, 'sqadq', 'nia@gmail.cpm', '0872655678', 'Tanya hotel', 'Hotel di malang ada apa saja?', '2026-05-04 10:05:17', '2026-05-04 10:05:17'),
(43, 'eqwe', 'daniel@gam.com', '45645654', '56456', '36tre', '2026-05-04 10:39:28', '2026-05-04 10:39:28'),
(44, 'clarence eldy', 'clarence@cet.com', '+62 821-1136-7154', 'sewa apartmen', 'apartemen surabaya ada dimana?', '2026-05-04 10:43:39', '2026-05-04 10:43:39'),
(45, 'lia hermanto', 'lia@gmail.com', '082-6273-7547-781', 'apartmen', 'tolong tanyain', '2026-05-04 11:11:45', '2026-05-04 11:11:45'),
(46, 'nigel', 'dokumen@gmail.com', '0881036588874', 'Test', 'Cek harga apartemen surabaya?', '2026-05-06 02:37:47', '2026-05-06 02:37:47'),
(47, 'nigel', 'dokumen.nigel@gmail.com', '0881036588874', 'test', 'saya mau tanya harga', '2026-05-06 02:39:12', '2026-05-06 02:39:12'),
(48, 'nigel', 'dokumen.nigel2@gmail.com', '0881036588874', 'test', 'Hi..', '2026-05-06 02:39:57', '2026-05-06 02:39:57'),
(49, 'nigel', 'nigel@gmail.com', '0881036588874', 'test', 'hi..', '2026-05-06 02:51:31', '2026-05-06 02:51:31'),
(50, 'nigel', 'dokumen.nigel2@gmail.com', '0881036588874', 'TEST', 'Mau tanya apartmen', '2026-05-06 03:26:43', '2026-05-06 03:26:43'),
(51, 'clarence', 'clarence@gmail.com', '082111367154', 'Test', 'Ada apartemen apa aja di surabaya?', '2026-05-06 04:30:04', '2026-05-06 04:30:04'),
(52, 'clarence', 'clarence@gmail.com', '082111367154', 'Test', 'Ada apartemen apa aja di surabaya?', '2026-05-06 04:45:18', '2026-05-06 04:45:18'),
(53, 'Nigel', 'dokumen@gmail.com', '082233556796', 'Testing', 'Hello, carikan rumah-rumah sewa yang ada di surabaya. Ada apa saja?', '2026-05-07 06:12:07', '2026-05-07 06:12:07'),
(54, 'David', 'nigel@gmail.com', '082233556796', 'Testing', 'Integral x ln x dx', '2026-05-07 06:21:22', '2026-05-07 06:21:22'),
(55, 'nigel', 'hxkjasbnkjxbn@gmail.com', '082233556796', 'Cek', 'Saya mau pergi ke jepang, ada destinasi apa saja?', '2026-05-07 06:25:38', '2026-05-07 06:25:38'),
(56, 'nigel', 'qeswbdhjb@gmail.com', '082233556796', 'Testing', '1 + 1 berapa? Saya tanta yentang penjumlahan..', '2026-05-07 06:26:34', '2026-05-07 06:26:34'),
(57, 'nigel', 'nitip@gmail.com', '082233556796', 'HOTEL', 'Mau tanya hotel surabaya', '2026-05-18 03:10:40', '2026-05-18 03:10:40'),
(58, 'nigel', 'nitip@gamil.com', '082233556796', 'hotel', 'hotel di sidoarjo', '2026-05-18 03:12:02', '2026-05-18 03:12:02'),
(59, 'nia agatha', 'nia@gmail.com', '082233556796', 'hotel', 'saya mau tanya sewa hotel', '2026-05-18 06:26:21', '2026-05-18 06:26:21'),
(60, 'rahma', 'cek@gmail.com', '082233556796', 'Villa', 'sewa hotel di malang ada apa saja', '2026-05-18 06:29:29', '2026-05-18 06:29:29'),
(61, 'rahma', 'cek@gmail.com', '082233556796', 'Villa', 'sewa hotel di malang ada apa saja', '2026-05-18 06:29:48', '2026-05-18 06:29:48'),
(62, 'nigel', 'dokumen.nigel2@gmail.com', '082233556796', 'hotel', 'tolong berikan list hotel di surabaya', '2026-05-21 10:23:27', '2026-05-21 10:23:27'),
(63, 'nigel', 'dokumen.nigel2@gmail.com', '082233556796', 'hotel', 'tolong berikan list hotel di surabaya', '2026-05-21 10:24:04', '2026-05-21 10:24:04'),
(64, 'nigel', 'dokumen.nigel2@gmail.com', '082233556796', 'hotel', 'tolong berikan list hotel di surabaya', '2026-05-21 10:35:26', '2026-05-21 10:35:26');

-- --------------------------------------------------------

--
-- Struktur dari tabel `countries`
--

CREATE TABLE `countries` (
  `id` int(11) NOT NULL,
  `country_id` varchar(30) NOT NULL COMMENT 'Generated ID: prefix nama + random alphanumeric + count padded 3 digit',
  `name` varchar(100) NOT NULL COMMENT 'Nama negara, mis. Indonesia, Malaysia',
  `status` int(1) NOT NULL DEFAULT 1 COMMENT '1 = aktif, 2 = disabled/blocked, 3 = deleted (soft delete)',
  `created_date` date NOT NULL COMMENT 'Tanggal pembuatan data',
  `created_by` varchar(50) NOT NULL COMMENT 'FK ke users.user_id — siapa yang membuat',
  `updated_date` date DEFAULT NULL COMMENT 'Tanggal update terakhir',
  `updated_by` varchar(50) DEFAULT NULL COMMENT 'FK ke users.user_id — siapa yang terakhir mengubah'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data untuk tabel `countries`
--

INSERT INTO `countries` (`id`, `country_id`, `name`, `status`, `created_date`, `created_by`, `updated_date`, `updated_by`) VALUES
(1, 'INDZSF4001', 'INDONESIA', 1, '2024-08-10', 'SA6EDRU001', NULL, NULL),
(2, 'MALRP7G002', 'MALAYSIA', 1, '2024-08-10', 'SA6EDRU001', NULL, NULL),
(3, 'FILPWX3003', 'FILIPINA', 1, '2024-08-10', 'SA6EDRU001', NULL, NULL),
(4, 'AMRXKL6004', 'AMERIKA', 1, '2024-08-10', 'SA6EDRU001', NULL, NULL),
(5, 'THAKBN8005', 'THAILAND', 1, '2024-08-10', 'SA6EDRU001', NULL, NULL),
(6, 'BRZPOW3006', 'BRAZIL', 1, '2024-08-10', 'SA6EDRU001', NULL, NULL),
(7, 'PRNCQF7007', 'PRANCIS', 1, '2024-08-10', 'SA6EDRU001', NULL, NULL),
(8, 'PAPNZX4008', 'PAPUA NUGINI', 1, '2024-08-10', 'SA6EDRU001', NULL, NULL),
(9, 'CANHMY5009', 'CANADA', 1, '2024-08-10', 'SA6EDRU001', NULL, NULL),
(10, 'ENGQBT8010', 'ENGLAND', 1, '2024-08-10', 'SA6EDRU001', NULL, NULL),
(11, 'NETHKS5011', 'NETHERLAND', 1, '2024-08-10', 'SA6EDRU001', NULL, NULL),
(12, 'ARBVDE9012', 'ARAB', 1, '2024-08-10', 'SA6EDRU001', NULL, NULL),
(13, 'AFGWRZ2013', 'AFGANISTAN', 1, '2024-08-10', 'SA6EDRU001', NULL, NULL),
(14, 'ARGJMV6014', 'ARGENTINA', 1, '2024-08-10', 'SA6EDRU001', NULL, NULL),
(15, 'INDQPN3015', 'INDIA', 1, '2024-08-10', 'SA6EDRU001', NULL, NULL),
(16, 'IRANFX7016', 'IRAN', 1, '2024-08-10', 'SA6EDRU001', NULL, NULL),
(17, 'IRAKTD9017', 'IRAK', 1, '2024-08-10', 'SA6EDRU001', NULL, NULL),
(18, 'JAMBNK4018', 'JAMAIKA', 1, '2024-08-10', 'SA6EDRU001', NULL, NULL),
(19, 'KORQTJ2019', 'SOUTH KOREA', 1, '2024-08-10', 'SA6EDRU001', NULL, NULL),
(20, 'LBNRZQ8020', 'LIBANON', 1, '2024-08-10', 'SA6EDRU001', NULL, NULL);

-- --------------------------------------------------------

--
-- Struktur dari tabel `facilities`
--

CREATE TABLE `facilities` (
  `id` int(11) NOT NULL,
  `facility_id` varchar(30) NOT NULL COMMENT 'Generated ID: prefix nama + random alphanumeric + count padded 3 digit',
  `name` varchar(100) NOT NULL COMMENT 'Nama fasilitas, mis. AC, Kolam Renang, CCTV',
  `description` varchar(255) DEFAULT NULL COMMENT 'Deskripsi singkat fasilitas',
  `icon` varchar(50) DEFAULT NULL COMMENT 'Icon identifier, mis. emoji atau CSS class (fa-wifi, ?, dll.)',
  `status` int(1) NOT NULL DEFAULT 1 COMMENT '1 = aktif, 2 = disabled/blocked, 3 = deleted (soft delete)',
  `created_date` date NOT NULL COMMENT 'Tanggal pembuatan data',
  `created_by` varchar(50) NOT NULL COMMENT 'FK ke users.user_id — siapa yang membuat',
  `updated_date` date DEFAULT NULL COMMENT 'Tanggal update terakhir',
  `updated_by` varchar(50) DEFAULT NULL COMMENT 'FK ke users.user_id — siapa yang terakhir mengubah'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data untuk tabel `facilities`
--

INSERT INTO `facilities` (`id`, `facility_id`, `name`, `description`, `icon`, `status`, `created_date`, `created_by`, `updated_date`, `updated_by`) VALUES
(1, 'ACZKE0T001', 'AC', NULL, '❄️', 1, '2026-06-19', 'LFGKT49002', '2026-06-25', 'CEMPL3Z003'),
(2, 'SERZTB4002', 'SECURITY', NULL, NULL, 1, '2026-06-19', 'LFGKT49002', NULL, NULL),
(3, 'PMWJO48003', 'PARKIR SEPEDA MOTOR', NULL, NULL, 1, '2026-06-19', 'LFGKT49002', '2026-06-25', 'LFGKT49002'),
(4, 'KSH6GIX004', 'KITCHEN SET', NULL, '🍽️', 1, '2026-06-25', 'SA6EDRU001', NULL, NULL),
(5, 'KRQNLSG005', 'KOLAM RENANG', NULL, '🏊', 1, '2026-06-25', 'SA6EDRU001', NULL, NULL),
(6, 'CJ2POEZ006', 'CCTV 24 JAM', NULL, NULL, 1, '2026-06-25', 'SA6EDRU001', NULL, NULL),
(7, 'KZVVS0X007', 'KIDS ZONE', NULL, NULL, 1, '2026-06-25', 'SA6EDRU001', NULL, NULL),
(8, 'GYFW2BB008', 'GYM', NULL, '🏋️', 1, '2026-06-25', 'SA6EDRU001', NULL, NULL),
(9, 'YOFYIK4009', 'YOGA', NULL, NULL, 1, '2026-06-25', 'SA6EDRU001', NULL, NULL),
(10, 'SB0KAIO010', 'SPRING BED', NULL, NULL, 1, '2026-06-25', 'CEMPL3Z003', NULL, NULL),
(11, 'LA29XXD011', 'LAUNDRY', NULL, '🧺', 1, '2026-06-25', 'CEMPL3Z003', NULL, NULL),
(12, 'WIMLCYO012', 'WI-FI', NULL, NULL, 1, '2026-06-25', 'CEMPL3Z003', NULL, NULL),
(13, 'BRN2QOZ013', 'BREAKFAST', NULL, NULL, 1, '2026-06-25', 'CEMPL3Z003', NULL, NULL),
(14, 'LUO5SSN014', 'LUNCH', NULL, '🍽️', 1, '2026-06-25', 'CEMPL3Z003', NULL, NULL),
(15, 'DIF4AJQ015', 'DINNER', NULL, '🍽️', 1, '2026-06-25', 'CEMPL3Z003', NULL, NULL),
(16, 'SHTZIRG016', 'SMART HOME', NULL, NULL, 1, '2026-06-25', 'CEMPL3Z003', NULL, NULL),
(17, 'WHXZCX1017', 'WATER HEATER', NULL, '🚿', 1, '2026-06-25', 'CEMPL3Z003', NULL, NULL),
(18, 'SNV7EXP018', 'STADIUN NONTON', NULL, NULL, 1, '2026-06-25', 'CEMPL3Z003', NULL, NULL),
(19, 'SD1NUPW019', 'SMART DOOR', NULL, NULL, 1, '2026-06-25', 'CEMPL3Z003', NULL, NULL),
(20, 'BAPHJKO020', 'BAR', NULL, NULL, 1, '2026-06-25', 'CEMPL3Z003', NULL, NULL),
(21, 'IPZVQAW021', 'INFINITY POOL', NULL, '🏊', 1, '2026-06-25', 'CEMPL3Z003', NULL, NULL);

-- --------------------------------------------------------

--
-- Struktur dari tabel `logs`
--

CREATE TABLE `logs` (
  `id` int(11) NOT NULL,
  `action` varchar(255) NOT NULL,
  `details` text DEFAULT NULL,
  `level` varchar(255) NOT NULL DEFAULT 'info',
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data untuk tabel `logs`
--

INSERT INTO `logs` (`id`, `action`, `details`, `level`, `createdAt`, `updatedAt`) VALUES
(1, 'PAGE_VIEW', 'Navigated from / to /', 'info', '2026-06-25 09:58:19', '2026-06-25 09:58:19'),
(2, 'PAGE_VIEW', 'Navigated from / to /login', 'info', '2026-06-25 09:58:23', '2026-06-25 09:58:23'),
(3, 'PAGE_VIEW', 'Navigated from /login to /', 'info', '2026-06-25 09:58:29', '2026-06-25 09:58:29'),
(4, 'PAGE_VIEW', 'Navigated from / to /facility', 'info', '2026-06-25 09:58:31', '2026-06-25 09:58:31'),
(5, 'PAGE_VIEW', 'Navigated from /facility to /facility', 'info', '2026-06-25 10:13:25', '2026-06-25 10:13:25'),
(6, 'PAGE_VIEW', 'Navigated from /facility to /rumah123', 'info', '2026-06-25 10:13:26', '2026-06-25 10:13:26'),
(7, 'PAGE_VIEW', 'Navigated from /rumah123 to /facility', 'info', '2026-06-25 10:13:27', '2026-06-25 10:13:27'),
(8, 'PAGE_VIEW', 'Navigated from / to /facility', 'info', '2026-06-25 10:16:36', '2026-06-25 10:16:36'),
(9, 'PAGE_VIEW', 'Navigated from / to /', 'info', '2026-06-26 09:59:29', '2026-06-26 09:59:29'),
(10, 'PAGE_VIEW', 'Navigated from / to /login', 'info', '2026-06-26 09:59:40', '2026-06-26 09:59:40'),
(11, 'PAGE_VIEW', 'Navigated from /login to /', 'info', '2026-06-26 09:59:45', '2026-06-26 09:59:45'),
(12, 'PAGE_VIEW', 'Navigated from / to /facility', 'info', '2026-06-26 09:59:46', '2026-06-26 09:59:46'),
(13, 'PAGE_VIEW', 'Navigated from / to /country', 'info', '2026-06-26 09:59:54', '2026-06-26 09:59:54'),
(14, 'PAGE_VIEW', 'Navigated from / to /about', 'info', '2026-06-26 13:36:08', '2026-06-26 13:36:08'),
(15, 'PAGE_VIEW', 'Navigated from /about to /country', 'info', '2026-06-26 13:36:21', '2026-06-26 13:36:21'),
(16, 'PAGE_VIEW', 'Navigated from / to /login', 'info', '2026-06-26 13:36:22', '2026-06-26 13:36:22'),
(17, 'PAGE_VIEW', 'Navigated from /login to /', 'info', '2026-06-26 13:36:29', '2026-06-26 13:36:29'),
(18, 'PAGE_VIEW', 'Navigated from / to /city', 'info', '2026-06-26 13:36:33', '2026-06-26 13:36:33'),
(19, 'PAGE_VIEW', 'Navigated from /city to /city/edit/AGADXSR334', 'info', '2026-06-26 13:37:55', '2026-06-26 13:37:55'),
(20, 'PAGE_VIEW', 'Navigated from /city/edit/AGADXSR334 to /city', 'info', '2026-06-26 13:38:28', '2026-06-26 13:38:28'),
(21, 'PAGE_VIEW', 'Navigated from /city to /city/edit/AGADXSR334', 'info', '2026-06-26 13:38:29', '2026-06-26 13:38:29'),
(22, 'PAGE_VIEW', 'Navigated from / to /city/edit/AGADXSR334', 'info', '2026-06-26 13:56:26', '2026-06-26 13:56:26'),
(23, 'PAGE_VIEW', 'Navigated from /city/edit/AGADXSR334 to /city', 'info', '2026-06-26 13:56:30', '2026-06-26 13:56:30'),
(24, 'PAGE_VIEW', 'Navigated from /city to /city/edit/AIMH17C348', 'info', '2026-06-26 13:56:35', '2026-06-26 13:56:35'),
(25, 'PAGE_VIEW', 'Navigated from /city/edit/AIMH17C348 to /city', 'info', '2026-06-26 13:56:48', '2026-06-26 13:56:48'),
(26, 'PAGE_VIEW', 'Navigated from /city to /city/edit/AIMH17C348', 'info', '2026-06-26 13:56:50', '2026-06-26 13:56:50'),
(27, 'PAGE_VIEW', 'Navigated from /city/edit/AIMH17C348 to /city', 'info', '2026-06-26 13:56:57', '2026-06-26 13:56:57'),
(28, 'PAGE_VIEW', 'Navigated from /city to /city/edit/AIRODKY251', 'info', '2026-06-26 13:57:04', '2026-06-26 13:57:04'),
(29, 'PAGE_VIEW', 'Navigated from /city/edit/AIRODKY251 to /city', 'info', '2026-06-26 13:57:15', '2026-06-26 13:57:15'),
(30, 'PAGE_VIEW', 'Navigated from /city to /login', 'info', '2026-06-26 13:57:22', '2026-06-26 13:57:22'),
(31, 'PAGE_VIEW', 'Navigated from /login to /', 'info', '2026-06-26 13:57:29', '2026-06-26 13:57:29'),
(32, 'PAGE_VIEW', 'Navigated from / to /city', 'info', '2026-06-26 13:57:32', '2026-06-26 13:57:32'),
(33, 'PAGE_VIEW', 'Navigated from /city to /city/edit/AMBOHE4301', 'info', '2026-06-26 13:57:37', '2026-06-26 13:57:37'),
(34, 'PAGE_VIEW', 'Navigated from /city/edit/AMBOHE4301 to /city', 'info', '2026-06-26 13:57:49', '2026-06-26 13:57:49'),
(35, 'PAGE_VIEW', 'Navigated from /city to /city/edit/ANGBIUD329', 'info', '2026-06-26 13:58:28', '2026-06-26 13:58:28'),
(36, 'PAGE_VIEW', 'Navigated from /city/edit/ANGBIUD329 to /city', 'info', '2026-06-26 13:58:39', '2026-06-26 13:58:39'),
(37, 'PAGE_VIEW', 'Navigated from /city to /city/edit/AMPWPT0267', 'info', '2026-06-26 13:58:47', '2026-06-26 13:58:47'),
(38, 'PAGE_VIEW', 'Navigated from /city/edit/AMPWPT0267 to /city', 'info', '2026-06-26 13:58:56', '2026-06-26 13:58:56'),
(39, 'PAGE_VIEW', 'Navigated from /city to /city/edit/AND9X7U298', 'info', '2026-06-26 13:59:09', '2026-06-26 13:59:09'),
(40, 'PAGE_VIEW', 'Navigated from /city/edit/AND9X7U298 to /city', 'info', '2026-06-26 13:59:19', '2026-06-26 13:59:19'),
(41, 'PAGE_VIEW', 'Navigated from /city to /city/edit/BANB91B082', 'info', '2026-06-26 13:59:32', '2026-06-26 13:59:32'),
(42, 'PAGE_VIEW', 'Navigated from /city/edit/BANB91B082 to /city', 'info', '2026-06-26 13:59:50', '2026-06-26 13:59:50'),
(43, 'PAGE_VIEW', 'Navigated from /city to /city/edit/ARGYU30163', 'info', '2026-06-26 13:59:58', '2026-06-26 13:59:58'),
(44, 'PAGE_VIEW', 'Navigated from /city/edit/ARGYU30163 to /city', 'info', '2026-06-26 14:02:03', '2026-06-26 14:02:03'),
(45, 'PAGE_VIEW', 'Navigated from /city to /city/add', 'info', '2026-06-26 14:03:33', '2026-06-26 14:03:33'),
(46, 'PAGE_VIEW', 'Navigated from /city/add to /city', 'info', '2026-06-26 14:05:05', '2026-06-26 14:05:05'),
(47, 'PAGE_VIEW', 'Navigated from /city to /city/add', 'info', '2026-06-26 14:05:18', '2026-06-26 14:05:18'),
(48, 'PAGE_VIEW', 'Navigated from /city/add to /city', 'info', '2026-06-26 14:11:03', '2026-06-26 14:11:03'),
(49, 'PAGE_VIEW', 'Navigated from /city to /city/edit/IPUUFK1352', 'info', '2026-06-26 14:11:16', '2026-06-26 14:11:16'),
(50, 'PAGE_VIEW', 'Navigated from /city/edit/IPUUFK1352 to /city', 'info', '2026-06-26 14:11:54', '2026-06-26 14:11:54'),
(51, 'PAGE_VIEW', 'Navigated from /city to /city/add', 'info', '2026-06-26 14:12:05', '2026-06-26 14:12:05'),
(52, 'PAGE_VIEW', 'Navigated from /city/add to /city', 'info', '2026-06-26 14:12:32', '2026-06-26 14:12:32'),
(53, 'PAGE_VIEW', 'Navigated from /city to /city/add', 'info', '2026-06-26 14:12:35', '2026-06-26 14:12:35'),
(54, 'PAGE_VIEW', 'Navigated from /city/add to /city', 'info', '2026-06-26 14:12:54', '2026-06-26 14:12:54'),
(55, 'PAGE_VIEW', 'Navigated from /city to /city/add', 'info', '2026-06-26 14:13:42', '2026-06-26 14:13:42'),
(56, 'PAGE_VIEW', 'Navigated from /city/add to /country', 'info', '2026-06-26 14:13:46', '2026-06-26 14:13:46'),
(57, 'PAGE_VIEW', 'Navigated from /country to /rumah123', 'info', '2026-06-26 14:13:47', '2026-06-26 14:13:47'),
(58, 'PAGE_VIEW', 'Navigated from /rumah123 to /facility', 'info', '2026-06-26 14:14:03', '2026-06-26 14:14:03'),
(59, 'PAGE_VIEW', 'Navigated from /facility to /city', 'info', '2026-06-26 14:14:09', '2026-06-26 14:14:09');

-- --------------------------------------------------------

--
-- Struktur dari tabel `properties`
--

CREATE TABLE `properties` (
  `id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `price` varchar(255) DEFAULT NULL,
  `location` varchar(255) DEFAULT NULL,
  `city` varchar(255) DEFAULT NULL,
  `district` varchar(255) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `buildingArea` varchar(255) DEFAULT NULL,
  `landArea` varchar(255) DEFAULT NULL,
  `bedrooms` int(11) DEFAULT NULL,
  `bathrooms` int(11) DEFAULT NULL,
  `floors` int(11) DEFAULT NULL,
  `parking` varchar(255) DEFAULT NULL,
  `garden` varchar(255) DEFAULT NULL,
  `buildingType` varchar(255) NOT NULL,
  `transactionType` varchar(255) NOT NULL,
  `facilities` text DEFAULT NULL,
  `furnishedStatus` varchar(255) DEFAULT NULL,
  `style` varchar(255) DEFAULT NULL,
  `imageUrl` varchar(255) DEFAULT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'available',
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Struktur dari tabel `provinces`
--

CREATE TABLE `provinces` (
  `id` int(11) NOT NULL,
  `province_id` varchar(30) NOT NULL COMMENT 'Generated ID: prefix nama + random alphanumeric + count padded 3 digit',
  `country_id` varchar(30) NOT NULL COMMENT 'FK ke countries.country_id — negara induk',
  `name` varchar(100) NOT NULL COMMENT 'Nama provinsi, mis. Jawa Timur, DKI Jakarta',
  `status` int(1) NOT NULL DEFAULT 1 COMMENT '1 = aktif, 2 = disabled/blocked, 3 = deleted (soft delete)',
  `created_date` date NOT NULL COMMENT 'Tanggal pembuatan data',
  `created_by` varchar(50) NOT NULL COMMENT 'FK ke users.user_id — siapa yang membuat',
  `updated_date` date DEFAULT NULL COMMENT 'Tanggal update terakhir',
  `updated_by` varchar(50) DEFAULT NULL COMMENT 'FK ke users.user_id — siapa yang terakhir mengubah'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data untuk tabel `provinces`
--

INSERT INTO `provinces` (`id`, `province_id`, `country_id`, `name`, `status`, `created_date`, `created_by`, `updated_date`, `updated_by`) VALUES
(1, 'JTMRXK9001', 'INDZSF4001', 'JAWA TIMUR', 1, '2024-08-12', 'SA6EDRU001', NULL, NULL),
(2, 'JTGPLN4002', 'INDZSF4001', 'JAWA TENGAH', 1, '2024-08-12', 'SA6EDRU001', NULL, NULL),
(3, 'BALHWZ7003', 'INDZSF4001', 'BALI', 1, '2024-08-12', 'SA6EDRU001', NULL, NULL),
(4, 'BKKHCV2004', 'THAKBN8005', 'BANGKOK', 1, '2024-08-12', 'SA6EDRU001', NULL, NULL),
(5, 'JOHRQM5005', 'MALRP7G002', 'JOHOR', 1, '2024-09-21', 'SA6EDRU001', NULL, NULL),
(6, 'PNGFBT3006', 'MALRP7G002', 'PENANG', 1, '2024-09-21', 'SA6EDRU001', NULL, NULL),
(7, 'CGNWDZ8007', 'THAKBN8005', 'CAGAYAN', 1, '2024-08-13', 'SA6EDRU001', NULL, NULL),
(8, 'ILCPND6008', 'FILPWX3003', 'ILOCOS NORTE', 2, '2024-08-13', 'SA6EDRU001', NULL, NULL),
(9, 'GYGNKV1009', 'KORQTJ2019', 'GYEONGGI', 1, '2024-08-13', 'SA6EDRU001', NULL, NULL),
(10, 'GGSTNR4010', 'KORQTJ2019', 'GYEONGSANG UTARA', 1, '2024-08-13', 'SA6EDRU001', NULL, NULL),
(11, 'JEJQWX9011', 'KORQTJ2019', 'JEJU', 1, '2024-08-13', 'SA6EDRU001', NULL, NULL),
(12, 'ONTBZY6012', 'CANHMY5009', 'ONTARIO', 1, '2024-08-13', 'SA6EDRU001', NULL, NULL),
(13, 'QBCHDM3013', 'CANHMY5009', 'QUEBEC', 3, '2024-08-13', 'SA6EDRU001', NULL, NULL),
(14, 'DIYPLR7014', 'INDZSF4001', 'DAERAH ISTIMEWA JOGJAKARTA', 1, '2025-03-21', 'SA6EDRU001', NULL, NULL),
(15, 'SRQHTV5015', 'ARBVDE9012', 'SYARQIYAH', 1, '2025-03-21', 'SA6EDRU001', NULL, NULL),
(16, 'MKKWNF2016', 'ARBVDE9012', 'MAKKAH', 1, '2025-03-21', 'SA6EDRU001', NULL, NULL),
(17, 'RYDVQM8017', 'ARBVDE9012', 'RIYADH', 1, '2025-03-21', 'SA6EDRU001', NULL, NULL),
(18, 'MDNXKZ4018', 'ARBVDE9012', 'MADINAH', 1, '2025-03-21', 'SA6EDRU001', NULL, NULL),
(19, 'ACEHRPZ2019', 'INDZSF4001', 'ACEH', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(20, 'SUTARVN4020', 'INDZSF4001', 'SUMATERA UTARA', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(21, 'SUBWQK7021', 'INDZSF4001', 'SUMATERA BARAT', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(22, 'RIAUFXJ3022', 'INDZSF4001', 'RIAU', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(23, 'KEPRIVB5023', 'INDZSF4001', 'KEPULAUAN RIAU', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(24, 'JMBWHY8024', 'INDZSF4001', 'JAMBI', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(25, 'SUSLJMP6025', 'INDZSF4001', 'SUMATERA SELATAN', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(26, 'KBBLTVC9026', 'INDZSF4001', 'KEPULAUAN BANGKA BELITUNG', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(27, 'BNGKCWZ1027', 'INDZSF4001', 'BENGKULU', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(28, 'LMPQNRX4028', 'INDZSF4001', 'LAMPUNG', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(29, 'DKIJKTM7029', 'INDZSF4001', 'DKI JAKARTA', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(30, 'JWBRTPN2030', 'INDZSF4001', 'JAWA BARAT', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(31, 'BNTNSQK5031', 'INDZSF4001', 'BANTEN', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(32, 'NTBZPWN8032', 'INDZSF4001', 'NUSA TENGGARA BARAT', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(33, 'NTTQMJV3033', 'INDZSF4001', 'NUSA TENGGARA TIMUR', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(34, 'KALBRTF6034', 'INDZSF4001', 'KALIMANTAN BARAT', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(35, 'KALTGHN9035', 'INDZSF4001', 'KALIMANTAN TENGAH', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(36, 'KALSLRV4036', 'INDZSF4001', 'KALIMANTAN SELATAN', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(37, 'KALTMLQ7037', 'INDZSF4001', 'KALIMANTAN TIMUR', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(38, 'KALUTPZ2038', 'INDZSF4001', 'KALIMANTAN UTARA', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(39, 'SULUTXN5039', 'INDZSF4001', 'SULAWESI UTARA', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(40, 'GRNTLQM8040', 'INDZSF4001', 'GORONTALO', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(41, 'SULTGHW3041', 'INDZSF4001', 'SULAWESI TENGAH', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(42, 'SULBRVK6042', 'INDZSF4001', 'SULAWESI BARAT', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(43, 'SULSLHP9043', 'INDZSF4001', 'SULAWESI SELATAN', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(44, 'SULTGQW4044', 'INDZSF4001', 'SULAWESI TENGGARA', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(45, 'MLKURPN7045', 'INDZSF4001', 'MALUKU', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(46, 'MLKUTNZ2046', 'INDZSF4001', 'MALUKU UTARA', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(47, 'PAPUAQKV5047', 'INDZSF4001', 'PAPUA', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(48, 'PAPUABWM8048', 'INDZSF4001', 'PAPUA BARAT', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(49, 'PAPUASLX3049', 'INDZSF4001', 'PAPUA SELATAN', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(50, 'PAPUATGQ6050', 'INDZSF4001', 'PAPUA TENGAH', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(51, 'PAPUAPGZ9051', 'INDZSF4001', 'PAPUA PEGUNUNGAN', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL),
(52, 'PAPUABDV4052', 'INDZSF4001', 'PAPUA BARAT DAYA', 1, '2026-06-26', 'IE1BGVY006', NULL, NULL);

-- --------------------------------------------------------

--
-- Struktur dari tabel `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `user_id` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `birthdate` date DEFAULT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `username` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `refresh_token` text DEFAULT NULL,
  `updated_date` datetime DEFAULT NULL,
  `update_by` varchar(50) DEFAULT NULL,
  `created_date` datetime DEFAULT NULL,
  `created_by` varchar(50) DEFAULT NULL,
  `status` int(1) NOT NULL DEFAULT 1,
  `privilege` varchar(50) DEFAULT NULL,
  `fonnte_token` varchar(100) DEFAULT NULL COMMENT 'Fonnte token milik agent (untuk kirim WA via Fonnte)',
  `kirimi_device_id` varchar(50) DEFAULT NULL COMMENT 'Device ID Kirimi milik agent (mis. D-3OCA6). user_code & secret akun di .env (KIRIMI_USER_CODE/KIRIMI_SECRET)'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data untuk tabel `users`
--

INSERT INTO `users` (`id`, `user_id`, `name`, `birthdate`, `phone`, `username`, `password`, `refresh_token`, `updated_date`, `update_by`, `created_date`, `created_by`, `status`, `privilege`, `fonnte_token`, `kirimi_device_id`) VALUES
(1, 'SA6EDRU001', 'NIGEL KUNCORO', '1998-05-04', '082233556796', 'nigel123', '$2b$10$Rld5zga/CswkKyQPgPi6GO./sa5.OuVwgApiGxbZmCRudUD9TNHD2', NULL, '2026-06-25 07:17:43', 'nigel123', '2026-05-22 03:26:55', 'Self-Register', 1, 'agent', 'm5HDmV4hAYRFBgTdkfDR', NULL),
(2, 'LFGKT49002', 'LEO FELIX', '2000-05-25', '0881036588874', 'leon123', '$2b$10$cFCdDf7g5ZxzPWpLG0WQrOPWbdNGNVfAiWrtfts.f98cg2Ju3bRum', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJMRkdLVDQ5MDAyIiwidXNlck5hbWUiOiJMRU8gRkVMSVgiLCJ1c2VybmFtZSI6Imxlb24xMjMiLCJwcml2aWxlZ2UiOiJhZ2VudCIsImlhdCI6MTc4MjQ4MzM3NSwiZXhwIjoxNzgyNTY5Nzc1fQ.3NmU5lMa2rUDuMCzkTWyPxafzsQEr2nBy8qisEYdSGs', '2026-06-26 14:16:15', 'leon123', '2026-05-25 10:05:33', 'Self-Register', 1, 'agent', 'PiBSZQXu6HKWhKkEDu9e', 'D-3OCA6'),
(3, 'CEMPL3Z003', 'CLARENCE MARIO', '1993-03-24', '0821-1136-7154', 'clarence123', '$2b$10$jvnn536K239gxQRcOqNIauJxZxTq9iBcJYLWDstvTItZGkAIsA07e', NULL, '2026-06-26 09:59:40', 'clarence123', '2026-05-26 01:56:29', 'Self-Register', 1, 'agent', NULL, NULL),
(4, 'DTDE8RX004', 'DESY TALIM', '1995-08-27', '0821-1331-8191', 'desy54321', '$2b$10$ZCZK0Lzlenn2y1ni3gtITOdJs9GISQcG1eatRxh0PEBKk0BXwyhNq', NULL, '2026-06-26 13:57:22', 'desy54321', '2026-05-26 01:57:21', 'Self-Register', 1, 'agent', NULL, NULL),
(5, 'ITJMESP005', 'IFAN TJANDRA', '2000-05-12', '+62881036588874', 'ifansiapa', '$2b$10$XK.IYefPk7hTE8hXNPJriOpueghFfkUH0.9m413E/PMBg2rESDmge', NULL, '2026-05-26 03:17:07', 'ifansiapa', '2026-05-26 01:58:48', 'Self-Register', 1, 'agent', NULL, NULL),
(6, 'IE1BGVY006', 'IFAN ELDY', '1998-04-16', '0881-0365-88874', 'ifaneldy', '$2b$10$FDHol/1mitgKFZwNmTZjIu1WgsRmRr28BTspMm5jlKxPlkbifhwFu', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJJRTFCR1ZZMDA2IiwidXNlck5hbWUiOiJJRkFOIEVMRFkiLCJ1c2VybmFtZSI6ImlmYW5lbGR5IiwicHJpdmlsZWdlIjoiYWdlbnQiLCJpYXQiOjE3ODI0Njc5ODQsImV4cCI6MTc4MjU1NDM4NH0.diC6rE9tCRgK7RLdO3exKuzSSLZtcP6VxxvGMjheHKI', '2026-06-26 09:59:44', 'ifaneldy', '2026-05-26 03:18:16', 'Self-Register', 1, 'agent', NULL, NULL);

-- --------------------------------------------------------

--
-- Struktur dari tabel `whatsapp_inbound_messages`
--

CREATE TABLE `whatsapp_inbound_messages` (
  `id` int(11) NOT NULL,
  `agentName` varchar(255) NOT NULL,
  `agentPhone` varchar(255) NOT NULL,
  `agentPhoneNormalized` varchar(255) NOT NULL,
  `senderName` varchar(255) DEFAULT NULL,
  `senderPhone` varchar(255) DEFAULT NULL,
  `senderPhoneNormalized` varchar(255) DEFAULT NULL,
  `message` text NOT NULL,
  `mediaType` varchar(255) DEFAULT NULL,
  `mediaUrl` text DEFAULT NULL,
  `deviceId` varchar(255) DEFAULT NULL,
  `timestamp` varchar(255) DEFAULT NULL,
  `rawPayload` text DEFAULT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'received',
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Indexes for dumped tables
--

--
-- Indeks untuk tabel `chat_messages`
--
ALTER TABLE `chat_messages`
  ADD PRIMARY KEY (`id`),
  ADD KEY `chatSessionId` (`chatSessionId`);

--
-- Indeks untuk tabel `chat_sessions`
--
ALTER TABLE `chat_sessions`
  ADD PRIMARY KEY (`id`);

--
-- Indeks untuk tabel `cities`
--
ALTER TABLE `cities`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `city_id` (`city_id`),
  ADD UNIQUE KEY `city_id_2` (`city_id`),
  ADD KEY `cities_city_id` (`city_id`),
  ADD KEY `cities_province_id` (`province_id`),
  ADD KEY `cities_country_id` (`country_id`),
  ADD KEY `cities_status` (`status`),
  ADD KEY `cities_name` (`name`);

--
-- Indeks untuk tabel `contacts`
--
ALTER TABLE `contacts`
  ADD PRIMARY KEY (`id`);

--
-- Indeks untuk tabel `countries`
--
ALTER TABLE `countries`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `country_id` (`country_id`),
  ADD UNIQUE KEY `country_id_2` (`country_id`),
  ADD KEY `countries_country_id` (`country_id`),
  ADD KEY `countries_status` (`status`),
  ADD KEY `countries_name` (`name`);

--
-- Indeks untuk tabel `facilities`
--
ALTER TABLE `facilities`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `facility_id` (`facility_id`),
  ADD UNIQUE KEY `facility_id_2` (`facility_id`),
  ADD KEY `facilities_facility_id` (`facility_id`),
  ADD KEY `facilities_status` (`status`),
  ADD KEY `facilities_name` (`name`);

--
-- Indeks untuk tabel `logs`
--
ALTER TABLE `logs`
  ADD PRIMARY KEY (`id`);

--
-- Indeks untuk tabel `properties`
--
ALTER TABLE `properties`
  ADD PRIMARY KEY (`id`);

--
-- Indeks untuk tabel `provinces`
--
ALTER TABLE `provinces`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `province_id` (`province_id`),
  ADD UNIQUE KEY `province_id_2` (`province_id`),
  ADD KEY `provinces_province_id` (`province_id`),
  ADD KEY `provinces_country_id` (`country_id`),
  ADD KEY `provinces_status` (`status`),
  ADD KEY `provinces_name` (`name`);

--
-- Indeks untuk tabel `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `user_id` (`user_id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD UNIQUE KEY `user_id_2` (`user_id`),
  ADD UNIQUE KEY `username_2` (`username`),
  ADD UNIQUE KEY `user_id_3` (`user_id`),
  ADD UNIQUE KEY `username_3` (`username`),
  ADD KEY `users_user_id` (`user_id`),
  ADD KEY `users_username` (`username`),
  ADD KEY `users_status` (`status`),
  ADD KEY `users_privilege_status` (`privilege`,`status`),
  ADD KEY `users_phone` (`phone`);

--
-- Indeks untuk tabel `whatsapp_inbound_messages`
--
ALTER TABLE `whatsapp_inbound_messages`
  ADD PRIMARY KEY (`id`),
  ADD KEY `whatsapp_inbound_messages_agent_name` (`agentName`),
  ADD KEY `whatsapp_inbound_messages_sender_phone_normalized` (`senderPhoneNormalized`),
  ADD KEY `whatsapp_inbound_messages_status` (`status`),
  ADD KEY `whatsapp_inbound_messages_created_at` (`createdAt`);

--
-- AUTO_INCREMENT untuk tabel yang dibuang
--

--
-- AUTO_INCREMENT untuk tabel `chat_messages`
--
ALTER TABLE `chat_messages`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=183;

--
-- AUTO_INCREMENT untuk tabel `chat_sessions`
--
ALTER TABLE `chat_sessions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=40;

--
-- AUTO_INCREMENT untuk tabel `cities`
--
ALTER TABLE `cities`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=355;

--
-- AUTO_INCREMENT untuk tabel `contacts`
--
ALTER TABLE `contacts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=65;

--
-- AUTO_INCREMENT untuk tabel `countries`
--
ALTER TABLE `countries`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=21;

--
-- AUTO_INCREMENT untuk tabel `facilities`
--
ALTER TABLE `facilities`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=22;

--
-- AUTO_INCREMENT untuk tabel `logs`
--
ALTER TABLE `logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=60;

--
-- AUTO_INCREMENT untuk tabel `properties`
--
ALTER TABLE `properties`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT untuk tabel `provinces`
--
ALTER TABLE `provinces`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=53;

--
-- AUTO_INCREMENT untuk tabel `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT untuk tabel `whatsapp_inbound_messages`
--
ALTER TABLE `whatsapp_inbound_messages`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- Ketidakleluasaan untuk tabel pelimpahan (Dumped Tables)
--

--
-- Ketidakleluasaan untuk tabel `chat_messages`
--
ALTER TABLE `chat_messages`
  ADD CONSTRAINT `chat_messages_ibfk_1` FOREIGN KEY (`chatSessionId`) REFERENCES `chat_sessions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
