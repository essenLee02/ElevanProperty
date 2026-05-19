-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: May 19, 2026 at 03:58 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.1.25

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
-- Table structure for table `chat_messages`
--

CREATE TABLE `chat_messages` (
  `id` int(11) NOT NULL,
  `chatSessionId` int(11) NOT NULL,
  `role` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `channel` varchar(255) NOT NULL DEFAULT 'website_chatbot',
  `metadata` text DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `chat_messages`
--

INSERT INTO `chat_messages` (`id`, `chatSessionId`, `role`, `message`, `channel`, `metadata`, `createdAt`, `updatedAt`) VALUES
(1, 1, 'user', 'Hello, saya mau tau harga rumah-rumah yang ada di malang?', 'website_chatbot', NULL, '2026-05-11 06:25:50', '2026-05-11 06:25:50'),
(2, 1, 'user', 'Hi', 'website_chatbot', NULL, '2026-05-11 06:38:12', '2026-05-11 06:38:12'),
(3, 1, 'user', 'Saya mau makan nasi bebek', 'website_chatbot', NULL, '2026-05-11 06:38:30', '2026-05-11 06:38:30'),
(4, 1, 'user', 'Hii', 'website_chatbot', NULL, '2026-05-11 07:01:34', '2026-05-11 07:01:34'),
(5, 1, 'assistant', 'Sorry, I specifically help with buying, selling, and renting properties such as houses, villas, hotels, apartments, and boarding houses. May I help you find a property based on your preferred location and budget?', 'website_chatbot', '{\"fallback\":true,\"reason\":\"out_of_scope\"}', '2026-05-11 07:01:34', '2026-05-11 07:01:34'),
(6, 1, 'user', 'Saya makan nasi bebek', 'website_chatbot', NULL, '2026-05-11 07:01:48', '2026-05-11 07:01:48'),
(7, 1, 'assistant', 'Maaf, saya khusus membantu kebutuhan jual, beli, dan sewa properti seperti rumah, villa, hotel, apartemen, dan boarding house. Boleh saya bantu carikan properti sesuai lokasi dan budget Anda?', 'website_chatbot', '{\"fallback\":true,\"reason\":\"out_of_scope\"}', '2026-05-11 07:01:48', '2026-05-11 07:01:48'),
(8, 1, 'user', 'saya mau cari rumah di malang, ada apa saja?', 'website_chatbot', NULL, '2026-05-11 07:02:11', '2026-05-11 07:02:11'),
(9, 1, 'assistant', 'Baik, saya bisa bantu kebutuhan properti Anda. Agar rekomendasinya lebih tepat, mohon informasikan: ingin beli, jual, atau sewa; tipe properti; lokasi; budget; jumlah kamar; dan fasilitas yang dibutuhkan.', 'website_chatbot', '{\"fallback\":true,\"reason\":\"openai_failed\",\"error\":\"OpenAI rejected the API key. Please replace OPENAI_API_KEY in backend/.env with a new active key, then restart the backend.\"}', '2026-05-11 07:02:12', '2026-05-11 07:02:12'),
(10, 1, 'user', 'Tolong berikan saran aja', 'website_chatbot', NULL, '2026-05-11 07:02:29', '2026-05-11 07:02:29'),
(11, 1, 'assistant', 'Sorry, I specifically help with buying, selling, and renting properties such as houses, villas, hotels, apartments, and boarding houses. May I help you find a property based on your preferred location and budget?', 'website_chatbot', '{\"fallback\":true,\"reason\":\"out_of_scope\"}', '2026-05-11 07:02:29', '2026-05-11 07:02:29'),
(12, 1, 'user', 'Saya bingung, tolong berikan saja saran rumah di malang', 'website_chatbot', NULL, '2026-05-11 07:02:49', '2026-05-11 07:02:49'),
(13, 1, 'assistant', 'Baik, saya bisa bantu kebutuhan properti Anda. Agar rekomendasinya lebih tepat, mohon informasikan: ingin beli, jual, atau sewa; tipe properti; lokasi; budget; jumlah kamar; dan fasilitas yang dibutuhkan.', 'website_chatbot', '{\"fallback\":true,\"reason\":\"openai_failed\",\"error\":\"OpenAI rejected the API key. Please replace OPENAI_API_KEY in backend/.env with a new active key, then restart the backend.\"}', '2026-05-11 07:02:50', '2026-05-11 07:02:50'),
(14, 1, 'user', 'Saya mau di malang, saya sewa hotel dengan fasiltas ac dan wifi.', 'website_chatbot', NULL, '2026-05-11 07:03:22', '2026-05-11 07:03:22'),
(15, 1, 'assistant', 'Baik, saya bisa bantu kebutuhan properti Anda. Agar rekomendasinya lebih tepat, mohon informasikan: ingin beli, jual, atau sewa; tipe properti; lokasi; budget; jumlah kamar; dan fasilitas yang dibutuhkan.', 'website_chatbot', '{\"fallback\":true,\"reason\":\"openai_failed\",\"error\":\"OpenAI rejected the API key. Please replace OPENAI_API_KEY in backend/.env with a new active key, then restart the backend.\"}', '2026-05-11 07:03:23', '2026-05-11 07:03:23'),
(16, 1, 'user', 'Langsung saran, stop tanya\\', 'website_chatbot', NULL, '2026-05-11 07:03:42', '2026-05-11 07:03:42'),
(17, 1, 'assistant', 'Sorry, I specifically help with buying, selling, and renting properties such as houses, villas, hotels, apartments, and boarding houses. May I help you find a property based on your preferred location and budget?', 'website_chatbot', '{\"fallback\":true,\"reason\":\"out_of_scope\"}', '2026-05-11 07:03:42', '2026-05-11 07:03:42'),
(18, 1, 'user', 'badget Rp 200.0000', 'website_chatbot', NULL, '2026-05-11 07:03:56', '2026-05-11 07:03:56'),
(19, 1, 'assistant', 'Sorry, I specifically help with buying, selling, and renting properties such as houses, villas, hotels, apartments, and boarding houses. May I help you find a property based on your preferred location and budget?', 'website_chatbot', '{\"fallback\":true,\"reason\":\"out_of_scope\"}', '2026-05-11 07:03:56', '2026-05-11 07:03:56'),
(20, 1, 'user', 'Saya mau sewa rumah di surabaya', 'website_chatbot', NULL, '2026-05-11 07:21:56', '2026-05-11 07:21:56'),
(21, 1, 'assistant', 'Baik, berikut pilihan hotel di Malang yang tersedia:\n\n1. Malang City Center Business Hotel\n   Lokasi: Malang, Klojen\n   Harga: Rp 450.000 / malam\n   Tipe: hotel - sewa\n   Luas: bangunan 1.250 m², tanah 1.600 m²\n   Alamat: Jl. Basuki Rahmat, Klojen, Malang\n   Fasilitas: AC, Wi-Fi, Parking, Security, Restaurant, Meeting room\n\n2. Malang Family Boutique Hotel\n   Lokasi: Malang, Lowokwaru\n   Harga: Rp 650.000 / malam\n   Tipe: hotel - sewa\n   Luas: bangunan 980 m², tanah 1.250 m²\n   Alamat: Jl. Soekarno Hatta, Lowokwaru, Malang\n   Fasilitas: AC, Wi-Fi, Parking, Security, Breakfast area\n\n3. Malang Syariah Budget Hotel\n   Lokasi: Malang, Blimbing\n   Harga: Rp 275.000 / malam\n   Tipe: hotel - sewa\n   Luas: bangunan 720 m², tanah 900 m²\n   Alamat: Jl. Borobudur, Blimbing, Malang\n   Fasilitas: AC, Wi-Fi, Parking, Security\n\n4. Malang hotel 39\n   Lokasi: Malang, District 4\n   Harga: Rp 16 juta / bulan\n   Tipe: hotel - sewa\n   Luas: bangunan 276 m², tanah 324 m²\n   Alamat: Jl. Property 39, Malang\n   Fasilitas: AC, Parking, Security, Wi-Fi\n\nCatatan: saya melihat Anda menyebut badget rp 200.0000. Jika budget ini adalah batas maksimal, saya bisa bantu pilihkan opsi yang paling mendekati.\n\nApakah Anda ingin saya bantu pilihkan yang paling cocok berdasarkan tanggal menginap, jumlah orang, dan budget?', 'website_chatbot', '{\"directRecommendation\":true,\"source\":\"property_catalog\"}', '2026-05-11 07:21:56', '2026-05-11 07:21:56'),
(22, 1, 'user', 'Kalau yang sewa rumah di jakarta, saya mau yang range 5 juta - 10 juta per tahun, fasilitas full furnish', 'website_chatbot', NULL, '2026-05-11 07:23:23', '2026-05-11 07:23:23'),
(23, 1, 'assistant', 'Baik, berikut pilihan hotel di Malang yang tersedia:\n\n1. Malang City Center Business Hotel\n   Lokasi: Malang, Klojen\n   Harga: Rp 450.000 / malam\n   Tipe: hotel - sewa\n   Luas: bangunan 1.250 m², tanah 1.600 m²\n   Alamat: Jl. Basuki Rahmat, Klojen, Malang\n   Fasilitas: AC, Wi-Fi, Parking, Security, Restaurant, Meeting room\n\n2. Malang Family Boutique Hotel\n   Lokasi: Malang, Lowokwaru\n   Harga: Rp 650.000 / malam\n   Tipe: hotel - sewa\n   Luas: bangunan 980 m², tanah 1.250 m²\n   Alamat: Jl. Soekarno Hatta, Lowokwaru, Malang\n   Fasilitas: AC, Wi-Fi, Parking, Security, Breakfast area\n\n3. Malang Syariah Budget Hotel\n   Lokasi: Malang, Blimbing\n   Harga: Rp 275.000 / malam\n   Tipe: hotel - sewa\n   Luas: bangunan 720 m², tanah 900 m²\n   Alamat: Jl. Borobudur, Blimbing, Malang\n   Fasilitas: AC, Wi-Fi, Parking, Security\n\n4. Malang hotel 39\n   Lokasi: Malang, District 4\n   Harga: Rp 16 juta / bulan\n   Tipe: hotel - sewa\n   Luas: bangunan 276 m², tanah 324 m²\n   Alamat: Jl. Property 39, Malang\n   Fasilitas: AC, Parking, Security, Wi-Fi\n\nCatatan: saya melihat Anda menyebut badget rp 200.0000. Jika budget ini adalah batas maksimal, saya bisa bantu pilihkan opsi yang paling mendekati.\n\nApakah Anda ingin saya bantu pilihkan yang paling cocok berdasarkan tanggal menginap, jumlah orang, dan budget?', 'website_chatbot', '{\"directRecommendation\":true,\"source\":\"property_catalog\"}', '2026-05-11 07:23:23', '2026-05-11 07:23:23'),
(24, 1, 'user', 'saya mau sewa apartemen di madiun', 'website_chatbot', NULL, '2026-05-11 07:44:54', '2026-05-11 07:44:54'),
(25, 1, 'user', 'sAYA MAU sewa hotel', 'website_chatbot', NULL, '2026-05-11 07:50:54', '2026-05-11 07:50:54'),
(26, 1, 'assistant', 'Baik, untuk **sewa hotel** tersedia pilihan berikut:\n\n1. **Surabaya Business Hotel Darmo**  \n   Lokasi: Surabaya, Darmo  \n   Harga: Rp 600.000 / malam  \n   Tipe: hotel - sewa  \n   Luas: bangunan 1.500 m², tanah 1.900 m²  \n   Alamat: Jl. Darmo, Surabaya  \n   Fasilitas: AC, Wi-Fi, Parking, Security, Meeting room  \n\n2. **Malang City Center Business Hotel**  \n   Lokasi: Malang, Klojen  \n   Harga: Rp 450.000 / malam  \n   Tipe: hotel - sewa  \n   Luas: bangunan 1.250 m², tanah 1.600 m²  \n   Alamat: Jl. Basuki Rahmat, Klojen, Malang  \n   Fasilitas: AC, Wi-Fi, Parking, Security, Restaurant, Meeting room  \n\n3. **Malang Family Boutique Hotel**  \n   Lokasi: Malang, Lowokwaru  \n   Harga: Rp 650.000 / malam  \n   Tipe: hotel - sewa  \n   Luas: bangunan 980 m², tanah 1.250 m²  \n   Alamat: Jl. Soekarno Hatta, Lowokwaru, Malang  \n   Fasilitas: AC, Wi-Fi, Parking, Security, Breakfast area  \n\n4. **Malang Syariah Budget Hotel**  \n   Lokasi: Malang, Blimbing  \n   Harga: Rp 275.000 / malam  \n   Tipe: hotel - sewa  \n   Luas: bangunan 720 m², tanah 900 m²  \n   Alamat: Jl. Borobudur, Blimbing, Malang  \n   Fasilitas: AC, Wi-Fi, Parking, Security  \n\nApakah Anda ingin hotel di **Surabaya** atau **Malang**?', 'website_chatbot', '{\"source\":\"openai\",\"exactMatches\":0,\"alternatives\":8,\"filters\":{\"buildingType\":\"hotel\",\"transactionType\":\"rent\",\"location\":\"Surabaya\",\"budget\":{\"text\":\"5 juta - 10 juta\",\"min\":5000000,\"max\":10000000,\"period\":\"year\"},\"facilities\":[\"full furnish\"]}}', '2026-05-11 07:51:00', '2026-05-11 07:51:00'),
(27, 1, 'user', 'Saya mau sewa yang di madiun saja', 'website_chatbot', NULL, '2026-05-11 07:51:23', '2026-05-11 07:51:23'),
(28, 1, 'assistant', 'Baik, untuk **sewa di Madiun** saya cek, **tidak ada exact match** yang sesuai dengan budget **Rp 5 juta–10 juta per tahun** dan fasilitas **full furnish**.\n\nAlternatif yang tersedia di Madiun:\n1. **Madiun hotel 33**  \n   - Lokasi: Madiun, District 4  \n   - Harga: **Rp 25 juta / bulan**  \n   - Tipe: hotel - sewa  \n   - Luas: bangunan 171 m², tanah 204 m²  \n   - Alamat: Jl. Property 33, Madiun  \n   - Fasilitas: AC, Parking, Security, Kitchen set  \n\n2. **Madiun boarding house 24**  \n   - Lokasi: Madiun, District 5  \n   - Harga: **Rp 16 juta / bulan**  \n   - Tipe: kos / boarding house - sewa  \n   - Luas: bangunan 108 m², tanah 132 m²  \n   - Alamat: Jl. Property 24, Madiun  \n   - Fasilitas: AC, Parking, Security, Wi-Fi  \n\nKeduanya **di luar budget** yang Anda sebutkan dan **tidak full furnish**.\n\nMau saya bantu pilih yang paling mendekati?', 'website_chatbot', '{\"source\":\"openai\",\"exactMatches\":0,\"alternatives\":8,\"filters\":{\"buildingType\":\"hotel\",\"transactionType\":\"rent\",\"location\":\"Madiun\",\"budget\":{\"text\":\"5 juta - 10 juta\",\"min\":5000000,\"max\":10000000,\"period\":\"year\"},\"facilities\":[\"full furnish\"]}}', '2026-05-11 07:51:26', '2026-05-11 07:51:26'),
(29, 1, 'user', 'Saya mau cek harga kos-kosan yang ada di semarang', 'website_chatbot', NULL, '2026-05-11 08:06:53', '2026-05-11 08:06:53'),
(30, 1, 'assistant', 'Maaf, **tidak ada exact match kos-kosan di Semarang** pada katalog yang tersedia saat ini.\n\nAlternatif yang tersedia:\n1. **Malang Lowokwaru Student Boarding House**  \n   - Lokasi: Malang, Lowokwaru  \n   - Harga: **Rp 1.500.000 / bulan**  \n   - Tipe: kos / boarding house - sewa  \n   - Luas: bangunan 420 m², tanah 520 m²  \n   - Alamat: Jl. Sigura-gura, Lowokwaru, Malang  \n   - Fasilitas: Wi-Fi, Bed, Wardrobe, Shared kitchen, Parking  \n\n2. **Madiun boarding house 24**  \n   - Lokasi: Madiun, District 5  \n   - Harga: **Rp 16 juta / bulan**  \n   - Tipe: kos / boarding house - sewa  \n   - Luas: bangunan 108 m², tanah 132 m²  \n   - Alamat: Jl. Property 24, Madiun  \n   - Fasilitas: AC, Parking, Security, Wi-Fi  \n\n3. **Malang boarding house 39**  \n   - Lokasi: Malang, District 5  \n   - Harga: **Rp 31 juta / bulan**  \n   - Tipe: kos / boarding house - sewa  \n   - Luas: bangunan 213 m², tanah 252 m²  \n   - Alamat: Jl. Property 39, Malang  \n   - Fasilitas: AC, Parking, Security, Kitchen set  \n\nKalau Anda mau, saya bisa bantu cari **kos-kosan di kota Jawa lain yang lebih dekat dengan Semarang**.', 'website_chatbot', '{\"source\":\"openai\",\"exactMatches\":0,\"alternatives\":3,\"filters\":{\"buildingType\":\"boarding_house\",\"transactionType\":\"rent\",\"location\":\"Semarang\",\"budget\":null,\"facilities\":[]}}', '2026-05-11 08:06:57', '2026-05-11 08:06:57'),
(31, 1, 'user', 'Saya mau beli villa di kota batu', 'website_chatbot', NULL, '2026-05-11 08:25:02', '2026-05-11 08:25:02'),
(32, 1, 'user', 'Saya mau beli villa di kota batu', 'website_chatbot', NULL, '2026-05-11 08:26:14', '2026-05-11 08:26:14'),
(33, 1, 'assistant', 'Maaf, **tidak ada exact match villa di Kota Batu** pada katalog yang tersedia saat ini.\n\nAlternatif terdekat dari katalog:\n1. **Semarang villa 25**  \n   - Lokasi: Semarang, District 1  \n   - Harga: **Rp 1.075 juta**  \n   - Tipe: villa - beli  \n   - Luas: bangunan 115 m², tanah 140 m²  \n   - Alamat: Jl. Property 25, Semarang  \n   - Fasilitas: AC, Parking, Security, Kitchen set  \n\n2. **Sidoarjo villa 40**  \n   - Lokasi: Sidoarjo, District 1  \n   - Harga: **Rp 2.350 juta**  \n   - Tipe: villa - beli  \n   - Luas: bangunan 220 m², tanah 260 m²  \n   - Alamat: Jl. Property 40, Sidoarjo  \n   - Fasilitas: AC, Parking, Security, Wi-Fi  \n\nMau saya bantu pilih yang paling dekat dengan kebutuhan Anda?', 'website_chatbot', '{\"source\":\"openai\",\"exactMatches\":0,\"alternatives\":2,\"filters\":{\"buildingType\":\"villa\",\"transactionType\":\"purchase\",\"location\":\"Batu\",\"budget\":null,\"facilities\":[]}}', '2026-05-11 08:26:17', '2026-05-11 08:26:17'),
(34, 1, 'user', 'kalau villa di sidoarjo, ada dimana saja?', 'website_chatbot', NULL, '2026-05-11 08:27:03', '2026-05-11 08:27:03'),
(35, 1, 'assistant', 'Ada, untuk **villa di Sidoarjo** yang tersedia di katalog saat ini ada:\n\n1. **Sidoarjo villa 40**  \n   - Lokasi: **Sidoarjo, District 1**  \n   - Harga: **Rp 2.350 juta**  \n   - Tipe: **villa - beli**  \n   - Luas: bangunan **220 m²**, tanah **260 m²**  \n   - Alamat: **Jl. Property 40, Sidoarjo**  \n   - Fasilitas: **AC, Parking, Security, Wi-Fi**\n\nMau saya bantu cek detail lainnya?', 'website_chatbot', '{\"source\":\"openai\",\"exactMatches\":1,\"alternatives\":0,\"filters\":{\"buildingType\":\"villa\",\"transactionType\":\"purchase\",\"location\":\"Sidoarjo\",\"budget\":null,\"facilities\":[]}}', '2026-05-11 08:27:05', '2026-05-11 08:27:05'),
(36, 1, 'user', 'tolong berikan list penjualan apartemen', 'website_chatbot', NULL, '2026-05-11 08:28:40', '2026-05-11 08:28:40'),
(37, 1, 'assistant', 'Tentu, berikut **list penjualan apartemen** yang tersedia:\n\n1. **Batu apartment 32**  \n   - Lokasi: **Batu, District 3**  \n   - Harga: **Rp 1.670 juta**  \n   - Tipe: **apartemen - jual**  \n   - Luas: **bangunan 164 m², tanah 196 m²**  \n   - Alamat: **Jl. Property 32, Batu**  \n   - Fasilitas: **AC, Parking, Security, Wi-Fi**\n\nMau saya bantu cek detail apartemen ini?', 'website_chatbot', '{\"source\":\"openai\",\"exactMatches\":1,\"alternatives\":0,\"filters\":{\"buildingType\":\"apartment\",\"transactionType\":\"sale\",\"location\":\"Batu\",\"budget\":null,\"facilities\":[]}}', '2026-05-11 08:28:43', '2026-05-11 08:28:43'),
(38, 1, 'user', 'Kalau kuliner bebek sidoarjo, ada dimana?', 'website_chatbot', NULL, '2026-05-11 08:35:52', '2026-05-11 08:35:52'),
(39, 1, 'assistant', 'Maaf, **tidak ada exact match** untuk **kuliner bebek di Sidoarjo** karena katalog ini khusus properti.\n\nKalau yang Anda maksud **villa di Sidoarjo**, yang tersedia saat ini hanya:\n1. **Sidoarjo villa 40**  \n   - Lokasi: **Sidoarjo, District 1**  \n   - Harga: **Rp 2.350 juta**  \n   - Tipe: **villa - beli**  \n   - Luas: **bangunan 220 m², tanah 260 m²**  \n   - Alamat: **Jl. Property 40, Sidoarjo**  \n   - Fasilitas: **AC, Parking, Security, Wi-Fi**\n\nMau saya bantu cek properti lain di Sidoarjo?', 'website_chatbot', '{\"source\":\"openai\",\"exactMatches\":0,\"alternatives\":2,\"filters\":{\"buildingType\":\"villa\",\"transactionType\":\"sale\",\"location\":\"Sidoarjo\",\"budget\":null,\"facilities\":[]}}', '2026-05-11 08:35:55', '2026-05-11 08:35:55'),
(40, 1, 'user', 'kalau wisata yang bagus, ada dimana di swiss?', 'website_chatbot', NULL, '2026-05-11 08:40:26', '2026-05-11 08:40:26'),
(41, 1, 'assistant', 'Maaf, **tidak ada exact match** untuk permintaan tersebut di katalog properti yang tersedia saat ini, dan kami fokus pada properti, bukan wisata.\n\nAlternatif yang tersedia:\n1. **Surabaya villa 20**  \n   - Lokasi: **Surabaya, District 1**  \n   - Harga: **Rp 650 juta**  \n   - Tipe: **villa - jual**  \n   - Luas: **bangunan 80 m², tanah 100 m²**  \n   - Alamat: **Jl. Property 20, Surabaya**  \n   - Fasilitas: **AC, Parking, Security, Wi-Fi**\n\n2. **Yogyakarta villa 35**  \n   - Lokasi: **Yogyakarta, District 1**  \n   - Harga: **Rp 1.925 juta**  \n   - Tipe: **villa - jual**  \n   - Luas: **bangunan 185 m², tanah 220 m²**  \n   - Alamat: **Jl. Property 35, Yogyakarta**  \n   - Fasilitas: **AC, Parking, Security, Kitchen set**\n\nMau saya bantu cari **villa lain**?', 'website_chatbot', '{\"source\":\"openai\",\"exactMatches\":0,\"alternatives\":2,\"filters\":{\"buildingType\":\"villa\",\"transactionType\":\"sale\",\"location\":\"swiss\",\"budget\":null,\"facilities\":[]}}', '2026-05-11 08:40:28', '2026-05-11 08:40:28'),
(42, 1, 'user', 'saya mau nasi bebek surabaya', 'website_chatbot', NULL, '2026-05-11 08:50:31', '2026-05-11 08:50:31'),
(43, 1, 'assistant', 'Maaf, saya hanya dapat membantu pertanyaan seputar jual, beli, atau sewa properti. Silakan tanyakan kebutuhan properti seperti rumah, villa, hotel, apartemen, atau kos-kosan yang ingin Anda cari.', 'website_chatbot', '{\"source\":\"openai\",\"exactMatches\":1,\"alternatives\":0,\"filters\":{\"buildingType\":\"apartment\",\"transactionType\":\"sale\",\"location\":\"Surabaya\",\"budget\":null,\"facilities\":[]}}', '2026-05-11 08:50:33', '2026-05-11 08:50:33'),
(44, 1, 'user', 'kalau destinasi wisata yang bagus di jawa tengah, ada dimana?', 'website_chatbot', NULL, '2026-05-11 08:51:00', '2026-05-11 08:51:00'),
(45, 1, 'assistant', 'Maaf, saya hanya dapat membantu pertanyaan seputar jual, beli, atau sewa properti. Silakan tanyakan kebutuhan properti seperti rumah, villa, hotel, apartemen, atau kos-kosan yang ingin Anda cari.', 'website_chatbot', '{\"source\":\"openai\",\"exactMatches\":0,\"alternatives\":8,\"filters\":{\"buildingType\":\"\",\"transactionType\":\"\",\"location\":\"jawa tengah\",\"budget\":null,\"facilities\":[]}}', '2026-05-11 08:51:02', '2026-05-11 08:51:02'),
(46, 1, 'user', 'Berikan rekomendasi beli rumah sebagai investasi terbaik, serta berikan alasannya, mengapa rumah itu harus dibeli', 'website_chatbot', NULL, '2026-05-11 08:51:59', '2026-05-11 08:51:59'),
(47, 1, 'assistant', 'Tentu. **Tidak ada exact match untuk rumah beli di Surabaya** pada katalog saat ini, jadi saya berikan **alternatif terdekat** yang tersedia:\n\n1. **Sidoarjo house 31**  \n   - Lokasi: **Sidoarjo, District 2**  \n   - Harga: **Rp 1.585 juta**  \n   - Tipe: **rumah - beli**  \n   - Luas: **bangunan 157 m², tanah 188 m²**  \n   - Alamat: **Jl. Property 31, Sidoarjo**  \n   - Fasilitas: **AC, Parking, Security, Kitchen set**  \n   - Alasan: cocok untuk investasi karena tipe rumah lebih fleksibel untuk disewakan kembali atau dijual lagi, dan lokasinya masih dekat area Jawa Timur yang berkembang.\n\n2. **Papua house 46**  \n   - Lokasi: **Papua, District 2**  \n   - Harga: **Rp 2.860 juta**  \n   - Tipe: **rumah - beli**  \n   - Luas: **bangunan 262 m², tanah 308 m²**  \n   - Alamat: **Jl. Property 46, Papua**  \n   - Fasilitas: **AC, Parking, Security, Wi-Fi**  \n   - Alasan: ukuran lebih besar dan fasilitas lebih lengkap, sehingga berpotensi menarik untuk kebutuhan hunian premium atau investasi jangka panjang.\n\nKalau Anda mau, saya bisa bantu pilih **yang paling cocok untuk investasi**.', 'website_chatbot', '{\"source\":\"openai\",\"exactMatches\":0,\"alternatives\":2,\"filters\":{\"buildingType\":\"house\",\"transactionType\":\"purchase\",\"location\":\"Surabaya\",\"budget\":null,\"facilities\":[]}}', '2026-05-11 08:52:02', '2026-05-11 08:52:02'),
(48, 1, 'user', 'Tolong carikan villa di malang', 'website_chatbot', NULL, '2026-05-11 11:33:42', '2026-05-11 11:33:42'),
(49, 1, 'assistant', 'Maaf, **tidak ada exact match** untuk **villa di Malang** pada katalog saat ini.\n\nAlternatif terdekat yang tersedia:\n1. **Semarang villa 25**  \n   - Lokasi: **Semarang, District 1**  \n   - Harga: **Rp 1.075 juta**  \n   - Tipe: **villa - beli**  \n   - Luas: **bangunan 115 m², tanah 140 m²**  \n   - Alamat: **Jl. Property 25, Semarang**  \n   - Fasilitas: **AC, Parking, Security, Kitchen set**\n\n2. **Sidoarjo villa 40**  \n   - Lokasi: **Sidoarjo, District 1**  \n   - Harga: **Rp 2.350 juta**  \n   - Tipe: **villa - beli**  \n   - Luas: **bangunan 220 m², tanah 260 m²**  \n   - Alamat: **Jl. Property 40, Sidoarjo**  \n   - Fasilitas: **AC, Parking, Security, Wi-Fi**\n\nMau saya bantu cari yang sesuai budget Anda?', 'website_chatbot', '{\"source\":\"openai\",\"exactMatches\":0,\"alternatives\":2,\"filters\":{\"buildingType\":\"villa\",\"transactionType\":\"purchase\",\"location\":\"Malang\",\"budget\":null,\"facilities\":[]}}', '2026-05-11 11:33:46', '2026-05-11 11:33:46'),
(50, 1, 'user', 'kalau propoerti di siadoarjo, ada apa saja yang bisa saya beli?', 'website_chatbot', NULL, '2026-05-11 11:34:32', '2026-05-11 11:34:32'),
(51, 1, 'assistant', 'Maaf, **tidak ada exact match** untuk properti di **Sidoarjo** pada katalog saat ini. Berikut alternatif terdekat yang bisa Anda beli:\n\n1. **Sidoarjo villa 40**  \n   - Lokasi: **Sidoarjo, District 1**  \n   - Harga: **Rp 2.350 juta**  \n   - Tipe: **villa - beli**  \n   - Luas: **bangunan 220 m², tanah 260 m²**  \n   - Alamat: **Jl. Property 40, Sidoarjo**  \n   - Fasilitas: **AC, Parking, Security, Wi-Fi**\n\n2. **Semarang villa 25**  \n   - Lokasi: **Semarang, District 1**  \n   - Harga: **Rp 1.075 juta**  \n   - Tipe: **villa - beli**  \n   - Luas: **bangunan 115 m², tanah 140 m²**  \n   - Alamat: **Jl. Property 25, Semarang**  \n   - Fasilitas: **AC, Parking, Security, Kitchen set**\n\nMau saya bantu pilih yang paling sesuai budget Anda?', 'website_chatbot', '{\"source\":\"openai\",\"exactMatches\":0,\"alternatives\":2,\"filters\":{\"buildingType\":\"villa\",\"transactionType\":\"purchase\",\"location\":\"siadoarjo\",\"budget\":null,\"facilities\":[]}}', '2026-05-11 11:34:35', '2026-05-11 11:34:35'),
(52, 1, 'user', 'kalau penyewaan apartemen di surabaya, apakah ada?', 'website_chatbot', NULL, '2026-05-11 11:35:37', '2026-05-11 11:35:37'),
(53, 1, 'assistant', 'Maaf, **tidak ada exact match** untuk **apartemen sewa di Surabaya** pada katalog saat ini.\n\nAlternatif terdekat yang tersedia:\n1. **Sidoarjo apartment 22**  \n   - Lokasi: **Sidoarjo, District 3**  \n   - Harga: **Rp 820 juta**  \n   - Tipe: **apartemen - beli**  \n   - Luas: **bangunan 94 m², tanah 116 m²**  \n   - Alamat: **Jl. Property 22, Sidoarjo**  \n   - Fasilitas: **AC, Parking, Security, Wi-Fi**\n\n2. **Papua apartment 37**  \n   - Lokasi: **Papua, District 3**  \n   - Harga: **Rp 2.095 juta**  \n   - Tipe: **apartemen - beli**  \n   - Luas: **bangunan 199 m², tanah 236 m²**  \n   - Alamat: **Jl. Property 37, Papua**  \n   - Fasilitas: **AC, Parking, Security, Kitchen set**\n\nMau saya bantu cari **apartemen lain** sesuai budget Anda?', 'website_chatbot', '{\"source\":\"openai\",\"exactMatches\":0,\"alternatives\":2,\"filters\":{\"buildingType\":\"apartment\",\"transactionType\":\"purchase\",\"location\":\"Surabaya\",\"budget\":null,\"facilities\":[]}}', '2026-05-11 11:35:41', '2026-05-11 11:35:41'),
(54, 1, 'user', 'Hi... saya mau tanya harga rumah di surabaya, kisaran berapa ya?', 'website_chatbot', NULL, '2026-05-12 03:21:54', '2026-05-12 03:21:54'),
(55, 2, 'user', 'Hi.. saya mau rumah di malang..', 'website_chatbot', '{\"location\":\"surabaya\"}', '2026-05-12 04:37:46', '2026-05-12 04:37:46'),
(56, 2, 'assistant', 'Tentu, berikut pilihan rumah di **Malang** yang cocok:\n\n1. **Malang Suburban Area House Sale**  \n   Harga: **Rp 53.200.000.000**  \n   Area: building 265 m2, land 560 m2  \n   Alamat: Jl. Suburban Area No. 232, Malang, Jawa Timur  \n   Fasilitas: Carport, Storage Room, Water Heater, AC, Garden\n\n2. **Malang Main Road House Sale**  \n   Harga: **Rp 64.100.000.000**  \n   Area: building 220 m2, land 215 m2  \n   Alamat: Jl. Main Road No. 179, Malang, Jawa Timur  \n   Fasilitas: Security, Kitchen, AC, Garden, Furnished\n\n3. **Malang Suburban Area House Sale**  \n   Harga: **Rp 14.400.000.000**  \n   Area: building 70 m2, land 380 m2  \n   Alamat: Jl. Suburban Area No. 239, Malang, Jawa Timur  \n   Fasilitas: Storage Room, AC, Water Heater, Garden, Furnished\n\n4. **Malang Main Road House Sale**  \n   Harga: **Rp 13.000.000.000**  \n   Area: building 190 m2, land 375 m2  \n   Alamat: Jl. Main Road No. 138, Malang, Jawa Timur  \n   Fasilitas: Security, Storage Room, Water Heater, Carport, Garden\n\n5. **Malang Suburban Area House Sale**  \n   Harga: **Rp 43.000.000.000**  \n   Area: building 70 m2, land 500 m2  \n   Alamat: Jl. Suburban Area No. 170, Malang, Jawa Timur  \n   Fasilitas: Carport, Furnished, Security, Water Heater, Garden\n\nMau saya carikan yang **sesuai budget** Anda?', 'website_chatbot', '{\"source\":\"openai\",\"exactMatches\":5,\"alternatives\":0,\"filters\":{\"buildingType\":\"house\",\"transactionType\":\"\",\"location\":\"Malang\",\"budget\":null,\"facilities\":[]},\"frontendContextReceived\":true}', '2026-05-12 04:37:50', '2026-05-12 04:37:50'),
(57, 3, 'user', 'saya mau beli gudang di jawa timur, ada apa saja?', 'website_chatbot', '{\"location\":\"surabaya\"}', '2026-05-12 04:58:17', '2026-05-12 04:58:17'),
(58, 3, 'user', 'saya mau beli gudang di jawa timur', 'website_chatbot', '{\"location\":\"surabaya\"}', '2026-05-12 04:58:43', '2026-05-12 04:58:43'),
(59, 4, 'user', 'Berikan saya rekomendasi rumah terdekat dengan surabaya, namun harus di luar kota surabaya', 'website_chatbot', '{\"location\":\"surabaya\"}', '2026-05-12 05:21:30', '2026-05-12 05:21:30'),
(60, 1, 'user', 'berikan saya 5 list hotel termurah', 'website_chatbot', '{\"location\":\"surabaya\"}', '2026-05-13 09:28:58', '2026-05-13 09:28:58'),
(61, 1, 'user', 'saya mau rumah di surabaya', 'website_chatbot', '{\"location\":\"surabaya\"}', '2026-05-13 10:15:38', '2026-05-13 10:15:38'),
(62, 1, 'user', 'Hi.. saya mau rumah di sidoarjo', 'website_chatbot', '{\"location\":\"surabya\"}', '2026-05-18 02:28:37', '2026-05-18 02:28:37'),
(63, 1, 'assistant', 'Maaf, **tidak ada exact match** untuk **rumah di Sidoarjo** pada katalog saat ini.\n\nPilihan terdekat yang tersedia:\n\n1. **Sidoarjo Near Campus House Sale**  \n   - Lokasi: **Sidoarjo, Jawa Timur (Near Campus)**  \n   - Harga: **Rp 39.950.000.000**  \n   - Tipe: **rumah - jual**  \n   - Luas: **bangunan 375 m², tanah 465 m²**  \n   - Fasilitas: **Carport, Furnished, Water Heater**\n\n2. **Sidoarjo Near Station House Sale**  \n   - Lokasi: **Sidoarjo, Jawa Timur (Near Station)**  \n   - Harga: **Rp 67.050.000.000**  \n   - Tipe: **rumah - jual**  \n   - Luas: **bangunan 335 m², tanah 565 m²**  \n   - Fasilitas: **AC, Kitchen, Carport**\n\n3. **Sidoarjo Near Campus House Sale**  \n   - Lokasi: **Sidoarjo, Jawa Timur (Near Campus)**  \n   - Harga: **Rp 45.000.000.000**  \n   - Tipe: **rumah - jual**  \n   - Luas: **bangunan 75 m², tanah 185 m²**  \n   - Fasilitas: **Security, Garden, Kitchen**\n\n4. **Sidoarjo Near Station House Sale**  \n   - Lokasi: **Sidoarjo, Jawa Timur (Near Station)**  \n   - Harga: **Rp 33.850.000.000**  \n   - Tipe: **rumah - jual**  \n   - Luas: **bangunan 100 m², tanah 370 m²**  \n   - Fasilitas: **Garden, Kitchen, Furnished**\n\n5. **Sidoarjo Near Campus House Sale**  \n   - Lokasi: **Sidoarjo, Jawa Timur (Near Campus)**  \n   - Harga: **Rp 73.250.000.000**  \n   - Tipe: **rumah - jual**  \n   - Luas: **bangunan 265 m², tanah 575 m²**  \n   - Fasilitas: **Furnished, AC, Water Heater**\n\nMau saya bantu pilih yang paling sesuai budget Anda?', 'website_chatbot', '{\"source\":\"chatgpt\",\"primaryProvider\":\"chatgpt\",\"fallbackUsed\":false,\"fallbackProvider\":null,\"primaryError\":null,\"exactMatches\":0,\"alternatives\":8,\"filters\":{\"buildingType\":\"house\",\"transactionType\":\"\",\"location\":\"Sidoarjo\",\"budget\":{\"text\":\"5\",\"min\":null,\"max\":5,\"period\":\"\"},\"facilities\":[]},\"frontendContextReceived\":true}', '2026-05-18 02:28:42', '2026-05-18 02:28:42'),
(64, 1, 'user', 'HOTEL\nMau tanya hotel surabaya', 'contact_form', '{\"email\":\"nitip@gmail.com\"}', '2026-05-18 03:10:44', '2026-05-18 03:10:44'),
(65, 1, 'assistant', 'Halo Nigel, terima kasih sudah menghubungi kami. Kami siap bantu info hotel di Surabaya.\n\nBoleh diinformasikan, Anda mencari hotel untuk sewa harian atau kebutuhan lainnya? Kalau ada budget atau area yang diinginkan, kami bisa carikan yang paling sesuai.\n\nSilakan lanjut chat lewat WhatsApp ini ya, tim kami siap bantu.', 'whatsapp', '{\"whatsappTarget\":\"6282233556796\",\"source\":\"chatgpt\",\"primaryProvider\":\"chatgpt\",\"fallbackUsed\":false,\"fallbackProvider\":null,\"primaryError\":null}', '2026-05-18 03:10:44', '2026-05-18 03:10:44'),
(66, 1, 'user', 'hotel\nhotel di sidoarjo', 'contact_form', '{\"email\":\"nitip@gamil.com\"}', '2026-05-18 03:12:05', '2026-05-18 03:12:05'),
(67, 1, 'assistant', 'Halo Nigel, terima kasih sudah menghubungi kami. Kami menerima inquiry Anda untuk hotel di Sidoarjo.\n\nTim kami siap bantu lanjut via WhatsApp. Boleh info budget per malam dan area Sidoarjo yang Anda inginkan?', 'whatsapp', '{\"whatsappTarget\":\"6282233556796\",\"source\":\"chatgpt\",\"primaryProvider\":\"chatgpt\",\"fallbackUsed\":false,\"fallbackProvider\":null,\"primaryError\":null}', '2026-05-18 03:12:05', '2026-05-18 03:12:05'),
(68, 1, 'user', 'hotel\nsaya mau tanya sewa hotel', 'contact_form', '{\"email\":\"nia@gmail.com\"}', '2026-05-18 06:26:26', '2026-05-18 06:26:26'),
(69, 1, 'assistant', 'Halo Nia Agatha, terima kasih sudah menghubungi kami lewat WhatsApp. Kami sudah terima pertanyaan Anda tentang sewa hotel.\n\nBoleh diinformasikan hotel yang dicari di kota mana, dan untuk kapan rencananya?\n\nTim kami siap bantu lanjutkan pencarian Anda melalui WhatsApp.', 'whatsapp', '{\"whatsappTarget\":\"6282233556796\",\"source\":\"chatgpt\",\"primaryProvider\":\"chatgpt\",\"fallbackUsed\":false,\"fallbackProvider\":null,\"primaryError\":null}', '2026-05-18 06:26:26', '2026-05-18 06:26:26'),
(70, 1, 'user', 'hi.. Saya mau tanya hotel surabaya', 'website_chatbot', '{\"location\":\"malang\"}', '2026-05-18 06:30:06', '2026-05-18 06:30:06'),
(71, 1, 'assistant', 'Baik, berikut pilihan yang sesuai dengan **hotel - Surabaya** dari katalog properti kami:\n\n1. **Surabaya Industrial Area Hotel Purchase**\n   Lokasi: Surabaya, Industrial Area, Jawa Timur\n   Harga: **Target budget Rp 30.400.000.000**\n   Tipe: hotel - beli\n   Area: bangunan 3410 m2, tanah 4035 m2\n   Alamat: Jl. Industrial Area No. 60, Surabaya, Jawa Timur\n   Fasilitas: Restaurant, Laundry, Wi-Fi, Parking, AC\n\n2. **Surabaya Residential Area Hotel Purchase**\n   Lokasi: Surabaya, Residential Area, Jawa Timur\n   Harga: **Target budget Rp 19.800.000.000**\n   Tipe: hotel - beli\n   Area: bangunan 1610 m2, tanah 4680 m2\n   Alamat: Jl. Residential Area No. 244, Surabaya, Jawa Timur\n   Fasilitas: Restaurant, Laundry, Parking, Wi-Fi, Security\n\n3. **Surabaya Industrial Area Hotel Purchase**\n   Lokasi: Surabaya, Industrial Area, Jawa Timur\n   Harga: **Target budget Rp 18.150.000.000**\n   Tipe: hotel - beli\n   Area: bangunan 2315 m2, tanah 6045 m2\n   Alamat: Jl. Industrial Area No. 200, Surabaya, Jawa Timur\n   Fasilitas: Security, Laundry, AC, Parking, Meeting Room\n\n4. **Surabaya Residential Area Hotel Purchase**\n   Lokasi: Surabaya, Residential Area, Jawa Timur\n   Harga: **Target budget Rp 1.300.000.000**\n   Tipe: hotel - beli\n   Area: bangunan 2880 m2, tanah 2395 m2\n   Alamat: Jl. Residential Area No. 168, Surabaya, Jawa Timur\n   Fasilitas: Restaurant, Meeting Room, Breakfast Area, Parking, Laundry\n\n5. **Surabaya Industrial Area Hotel Purchase**\n   Lokasi: Surabaya, Industrial Area, Jawa Timur\n   Harga: **Target budget Rp 2.350.000.000**\n   Tipe: hotel - beli\n   Area: bangunan 3170 m2, tanah 2110 m2\n   Alamat: Jl. Industrial Area No. 27, Surabaya, Jawa Timur\n   Fasilitas: Restaurant, Parking, Wi-Fi, Breakfast Area, Laundry\n\nApakah Anda ingin saya bantu pilihkan opsi yang paling sesuai?', 'website_chatbot_private', '{\"source\":\"private_agent\",\"controller\":\"chatbotPrivateController\",\"fallbackUsed\":true,\"fallbackReason\":\"ChatGPT failed and Claude fallback also failed. ChatGPT: ChatGPT API quota/billing/rate limit issue: Request too large for gpt-5.4-mini in organization org-CoZYmRTCRkHW2RnyuSy2Nttq on tokens per min (TPM): Limit 10000, Requested 14221. The input or output tokens must be reduced in order to run successfully. Visit https://platform.openai.com/account/rate-limits to learn more. You can increase your rate limit by adding a payment method to your account at https://platform.openai.com/account/billing.. Claude: Claude API error (401): invalid x-api-key\",\"externalProviderErrors\":[{\"provider\":\"chatgpt\",\"message\":\"ChatGPT API quota/billing/rate limit issue: Request too large for gpt-5.4-mini in organization org-CoZYmRTCRkHW2RnyuSy2Nttq on tokens per min (TPM): Limit 10000, Requested 14221. The input or output tokens must be reduced in order to run successfully. Visit https://platform.openai.com/account/rate-limits to learn more. You can increase your rate limit by adding a payment method to your account at https://platform.openai.com/account/billing.\",\"status\":429},{\"provider\":\"claude\",\"message\":\"Claude API error (401): invalid x-api-key\",\"status\":401}],\"exactMatches\":5,\"alternatives\":0,\"filters\":{\"buildingType\":\"hotel\",\"transactionType\":\"\",\"location\":\"Surabaya\",\"budget\":null,\"facilities\":[]},\"frontendContextReceived\":true}', '2026-05-18 06:30:08', '2026-05-18 06:30:08'),
(72, 1, 'user', 'saya mau rumah di aceh, apakah ada? kalau tidak ada, berikan rekomendasi apartemen di aceh yang bisa disewakan\\', 'website_chatbot', '{\"location\":\"malang\"}', '2026-05-18 06:48:08', '2026-05-18 06:48:08'),
(73, 1, 'assistant', 'Maaf, saat ini belum ada exact match untuk **sewa - rumah - Aceh** di katalog kami.\n\nBerikut alternatif terdekat yang masih berasal dari katalog properti kami:\n\n1. **Langsa Near Campus Boarding House Rent**\n   Lokasi: Langsa, Near Campus, Aceh\n   Harga: **Rp 4.250.000 / month**\n   Tipe: kos / boarding house - sewa\n   Area: bangunan 825 m2, tanah 155 m2\n   Alamat: Jl. Near Campus No. 11, Langsa, Aceh\n   Fasilitas: Bed, Security, Wardrobe, Wi-Fi, Shared Kitchen\n\n2. **Banda Aceh Industrial Area Warehouse Rent**\n   Lokasi: Banda Aceh, Industrial Area, Aceh\n   Harga: **Rp 315.000.000 / year**\n   Tipe: gudang / warehouse - sewa\n   Area: bangunan 4340 m2, tanah 3160 m2\n   Alamat: Jl. Industrial Area No. 191, Banda Aceh, Aceh\n   Fasilitas: Security, Office Room, High Ceiling, Wide Gate, Truck Access\n\n3. **Sabang City Center Apartment Rent**\n   Lokasi: Sabang, City Center, Aceh\n   Harga: **Rp 3.750.000 / month**\n   Tipe: apartemen - sewa\n   Area: bangunan 158 m2, tanah N/A\n   Alamat: Jl. City Center No. 40, Sabang, Aceh\n   Fasilitas: Lift, Furnished, Wi-Fi, Security, Parking\n\n4. **Lhokseumawe Main Road Boarding House Rent**\n   Lokasi: Lhokseumawe, Main Road, Aceh\n   Harga: **Rp 4.500.000 / month**\n   Tipe: kos / boarding house - sewa\n   Area: bangunan 605 m2, tanah 1460 m2\n   Alamat: Jl. Main Road No. 70, Lhokseumawe, Aceh\n   Fasilitas: Bed, Security, Parking, Laundry Area, AC\n\n5. **Meulaboh Tourism Area Warehouse Rent**\n   Lokasi: Meulaboh, Tourism Area, Aceh\n   Harga: **Rp 105.000.000 / year**\n   Tipe: gudang / warehouse - sewa\n   Area: bangunan 1055 m2, tanah 3060 m2\n   Alamat: Jl. Tourism Area No. 118, Meulaboh, Aceh\n   Fasilitas: Loading Dock, Truck Access, Office Room, Parking, Security\n\n6. **Langsa Near Station Apartment Rent**\n   Lokasi: Langsa, Near Station, Aceh\n   Harga: **Rp 2.250.000 / month**\n   Tipe: apartemen - sewa\n   Area: bangunan 73 m2, tanah N/A\n   Alamat: Jl. Near Station No. 72, Langsa, Aceh\n   Fasilitas: Gym, Security, Furnished, Swimming Pool, AC\n\nApakah Anda ingin saya carikan alternatif lokasi atau range harga lain?', 'website_chatbot_private', '{\"source\":\"private_agent\",\"controller\":\"chatbotPrivateController\",\"fallbackUsed\":true,\"fallbackReason\":\"ChatGPT failed and Claude fallback also failed. ChatGPT: ChatGPT API quota/billing/rate limit issue: You exceeded your current quota, please check your plan and billing details. For more information on this error, read the docs: https://platform.openai.com/docs/guides/error-codes/api-errors.. Claude: Claude API error (401): invalid x-api-key\",\"externalProviderErrors\":[{\"provider\":\"chatgpt\",\"message\":\"ChatGPT API quota/billing/rate limit issue: You exceeded your current quota, please check your plan and billing details. For more information on this error, read the docs: https://platform.openai.com/docs/guides/error-codes/api-errors.\",\"status\":429},{\"provider\":\"claude\",\"message\":\"Claude API error (401): invalid x-api-key\",\"status\":401}],\"exactMatches\":0,\"alternatives\":8,\"filters\":{\"buildingType\":\"house\",\"transactionType\":\"rent\",\"location\":\"Aceh\",\"budget\":null,\"facilities\":[\"ac\"]},\"frontendContextReceived\":true}', '2026-05-18 06:48:16', '2026-05-18 06:48:16'),
(74, 5, 'user', 'tolong berikan rokomendasi rumah yang dekat dengan banten', 'website_chatbot', '{\"location\":\"banten\"}', '2026-05-18 06:50:28', '2026-05-18 06:50:28'),
(75, 5, 'assistant', 'Baik, berikut pilihan yang sesuai dengan **rumah - Banten** dari katalog properti kami:\n\n1. **Tangerang Suburban Area House Sale**\n   Lokasi: Tangerang, Suburban Area, Banten\n   Harga: **Rp 73.700.000.000**\n   Tipe: rumah - jual\n   Area: bangunan 150 m2, tanah 270 m2\n   Alamat: Jl. Suburban Area No. 153, Tangerang, Banten\n   Fasilitas: Storage Room, Kitchen, AC, Carport, Furnished\n\n2. **Pandeglang Industrial Area House Sale**\n   Lokasi: Pandeglang, Industrial Area, Banten\n   Harga: **Rp 31.100.000.000**\n   Tipe: rumah - jual\n   Area: bangunan 290 m2, tanah 80 m2\n   Alamat: Jl. Industrial Area No. 204, Pandeglang, Banten\n   Fasilitas: Carport, Garden, Kitchen, Storage Room, Furnished\n\n3. **Cilegon Tourism Area House Sale**\n   Lokasi: Cilegon, Tourism Area, Banten\n   Harga: **Rp 14.300.000.000**\n   Tipe: rumah - jual\n   Area: bangunan 240 m2, tanah 505 m2\n   Alamat: Jl. Tourism Area No. 219, Cilegon, Banten\n   Fasilitas: Storage Room, Kitchen, Carport, Furnished, AC\n\n4. **Serang Near Mall House Sale**\n   Lokasi: Serang, Near Mall, Banten\n   Harga: **Rp 23.950.000.000**\n   Tipe: rumah - jual\n   Area: bangunan 210 m2, tanah 155 m2\n   Alamat: Jl. Near Mall No. 243, Serang, Banten\n   Fasilitas: Storage Room, Carport, Kitchen, AC, Garden\n\n5. **Tangerang Selatan Near Campus House Sale**\n   Lokasi: Tangerang Selatan, Near Campus, Banten\n   Harga: **Rp 55.950.000.000**\n   Tipe: rumah - jual\n   Area: bangunan 100 m2, tanah 180 m2\n   Alamat: Jl. Near Campus No. 196, Tangerang Selatan, Banten\n   Fasilitas: Carport, Kitchen, Water Heater, Garden, Storage Room\n\n6. **Tangerang Main Road House Sale**\n   Lokasi: Tangerang, Main Road, Banten\n   Harga: **Rp 38.950.000.000**\n   Tipe: rumah - jual\n   Area: bangunan 410 m2, tanah 280 m2\n   Alamat: Jl. Main Road No. 15, Tangerang, Banten\n   Fasilitas: Garden, Water Heater, Security, Furnished, AC\n\nApakah Anda ingin saya bantu pilihkan opsi yang paling sesuai?', 'website_chatbot_private', '{\"source\":\"private_agent\",\"controller\":\"chatbotPrivateController\",\"fallbackUsed\":true,\"fallbackReason\":\"ChatGPT failed and Claude fallback also failed. ChatGPT: ChatGPT API quota/billing/rate limit issue: You exceeded your current quota, please check your plan and billing details. For more information on this error, read the docs: https://platform.openai.com/docs/guides/error-codes/api-errors.. Claude: Claude API error (401): invalid x-api-key\",\"externalProviderErrors\":[{\"provider\":\"chatgpt\",\"message\":\"ChatGPT API quota/billing/rate limit issue: You exceeded your current quota, please check your plan and billing details. For more information on this error, read the docs: https://platform.openai.com/docs/guides/error-codes/api-errors.\",\"status\":429},{\"provider\":\"claude\",\"message\":\"Claude API error (401): invalid x-api-key\",\"status\":401}],\"exactMatches\":24,\"alternatives\":0,\"filters\":{\"buildingType\":\"house\",\"transactionType\":\"\",\"location\":\"Banten\",\"budget\":null,\"facilities\":[]},\"frontendContextReceived\":true}', '2026-05-18 06:50:34', '2026-05-18 06:50:34'),
(76, 5, 'user', 'haw can i get those informations?', 'website_chatbot', '{\"location\":\"banten\"}', '2026-05-18 06:52:25', '2026-05-18 06:52:25'),
(77, 5, 'assistant', 'Sure, here are matching options for **house - Banten** from our property catalog:\n\n1. **Tangerang Suburban Area House Sale**\n   Location: Tangerang, Suburban Area, Banten\n   Price: **Rp 73.700.000.000**\n   Type: house - sale\n   Area: building 150 m2, land 270 m2\n   Address: Jl. Suburban Area No. 153, Tangerang, Banten\n   Facilities: Storage Room, Kitchen, AC, Carport, Furnished\n\n2. **Pandeglang Industrial Area House Sale**\n   Location: Pandeglang, Industrial Area, Banten\n   Price: **Rp 31.100.000.000**\n   Type: house - sale\n   Area: building 290 m2, land 80 m2\n   Address: Jl. Industrial Area No. 204, Pandeglang, Banten\n   Facilities: Carport, Garden, Kitchen, Storage Room, Furnished\n\n3. **Cilegon Tourism Area House Sale**\n   Location: Cilegon, Tourism Area, Banten\n   Price: **Rp 14.300.000.000**\n   Type: house - sale\n   Area: building 240 m2, land 505 m2\n   Address: Jl. Tourism Area No. 219, Cilegon, Banten\n   Facilities: Storage Room, Kitchen, Carport, Furnished, AC\n\n4. **Serang Near Mall House Sale**\n   Location: Serang, Near Mall, Banten\n   Price: **Rp 23.950.000.000**\n   Type: house - sale\n   Area: building 210 m2, land 155 m2\n   Address: Jl. Near Mall No. 243, Serang, Banten\n   Facilities: Storage Room, Carport, Kitchen, AC, Garden\n\n5. **Tangerang Selatan Near Campus House Sale**\n   Location: Tangerang Selatan, Near Campus, Banten\n   Price: **Rp 55.950.000.000**\n   Type: house - sale\n   Area: building 100 m2, land 180 m2\n   Address: Jl. Near Campus No. 196, Tangerang Selatan, Banten\n   Facilities: Carport, Kitchen, Water Heater, Garden, Storage Room\n\n6. **Tangerang Main Road House Sale**\n   Location: Tangerang, Main Road, Banten\n   Price: **Rp 38.950.000.000**\n   Type: house - sale\n   Area: building 410 m2, land 280 m2\n   Address: Jl. Main Road No. 15, Tangerang, Banten\n   Facilities: Garden, Water Heater, Security, Furnished, AC\n\nWould you like me to help choose the most suitable option?', 'website_chatbot_private', '{\"source\":\"private_agent\",\"controller\":\"chatbotPrivateController\",\"fallbackUsed\":true,\"fallbackReason\":\"ChatGPT failed and Claude fallback also failed. ChatGPT: ChatGPT API quota/billing/rate limit issue: You exceeded your current quota, please check your plan and billing details. For more information on this error, read the docs: https://platform.openai.com/docs/guides/error-codes/api-errors.. Claude: Claude API error (401): invalid x-api-key\",\"externalProviderErrors\":[{\"provider\":\"chatgpt\",\"message\":\"ChatGPT API quota/billing/rate limit issue: You exceeded your current quota, please check your plan and billing details. For more information on this error, read the docs: https://platform.openai.com/docs/guides/error-codes/api-errors.\",\"status\":429},{\"provider\":\"claude\",\"message\":\"Claude API error (401): invalid x-api-key\",\"status\":401}],\"exactMatches\":24,\"alternatives\":0,\"filters\":{\"buildingType\":\"house\",\"transactionType\":\"\",\"location\":\"Banten\",\"budget\":null,\"facilities\":[]},\"frontendContextReceived\":false}', '2026-05-18 06:52:32', '2026-05-18 06:52:32'),
(78, 5, 'user', 'aku mau hotel di surabaya', 'website_chatbot', '{\"location\":\"surabaya\"}', '2026-05-18 10:39:21', '2026-05-18 10:39:21'),
(79, 5, 'assistant', 'Baik, berikut pilihan yang sesuai dengan **hotel - Surabaya** dari katalog properti kami:\n\n1. **Surabaya Industrial Area Hotel Purchase**\n   Lokasi: Surabaya, Industrial Area, Jawa Timur\n   Harga: **Target budget Rp 30.400.000.000**\n   Tipe: hotel - beli\n   Area: bangunan 3410 m2, tanah 4035 m2\n   Alamat: Jl. Industrial Area No. 60, Surabaya, Jawa Timur\n   Fasilitas: Restaurant, Laundry, Wi-Fi, Parking, AC\n\n2. **Surabaya Residential Area Hotel Purchase**\n   Lokasi: Surabaya, Residential Area, Jawa Timur\n   Harga: **Target budget Rp 19.800.000.000**\n   Tipe: hotel - beli\n   Area: bangunan 1610 m2, tanah 4680 m2\n   Alamat: Jl. Residential Area No. 244, Surabaya, Jawa Timur\n   Fasilitas: Restaurant, Laundry, Parking, Wi-Fi, Security\n\n3. **Surabaya Industrial Area Hotel Purchase**\n   Lokasi: Surabaya, Industrial Area, Jawa Timur\n   Harga: **Target budget Rp 18.150.000.000**\n   Tipe: hotel - beli\n   Area: bangunan 2315 m2, tanah 6045 m2\n   Alamat: Jl. Industrial Area No. 200, Surabaya, Jawa Timur\n   Fasilitas: Security, Laundry, AC, Parking, Meeting Room\n\n4. **Surabaya Residential Area Hotel Purchase**\n   Lokasi: Surabaya, Residential Area, Jawa Timur\n   Harga: **Target budget Rp 1.300.000.000**\n   Tipe: hotel - beli\n   Area: bangunan 2880 m2, tanah 2395 m2\n   Alamat: Jl. Residential Area No. 168, Surabaya, Jawa Timur\n   Fasilitas: Restaurant, Meeting Room, Breakfast Area, Parking, Laundry\n\n5. **Surabaya Industrial Area Hotel Purchase**\n   Lokasi: Surabaya, Industrial Area, Jawa Timur\n   Harga: **Target budget Rp 2.350.000.000**\n   Tipe: hotel - beli\n   Area: bangunan 3170 m2, tanah 2110 m2\n   Alamat: Jl. Industrial Area No. 27, Surabaya, Jawa Timur\n   Fasilitas: Restaurant, Parking, Wi-Fi, Breakfast Area, Laundry\n\nApakah Anda ingin saya bantu pilihkan opsi yang paling sesuai?', 'website_chatbot_private', '{\"source\":\"private_agent\",\"controller\":\"chatbotPrivateController\",\"fallbackUsed\":true,\"fallbackReason\":\"ChatGPT failed and Claude fallback also failed. ChatGPT: ChatGPT API quota/billing/rate limit issue: You exceeded your current quota, please check your plan and billing details. For more information on this error, read the docs: https://platform.openai.com/docs/guides/error-codes/api-errors.. Claude: Claude API error (401): invalid x-api-key\",\"externalProviderErrors\":[{\"provider\":\"chatgpt\",\"message\":\"ChatGPT API quota/billing/rate limit issue: You exceeded your current quota, please check your plan and billing details. For more information on this error, read the docs: https://platform.openai.com/docs/guides/error-codes/api-errors.\",\"status\":429},{\"provider\":\"claude\",\"message\":\"Claude API error (401): invalid x-api-key\",\"status\":401}],\"exactMatches\":5,\"alternatives\":0,\"filters\":{\"buildingType\":\"hotel\",\"transactionType\":\"\",\"location\":\"Surabaya\",\"budget\":null,\"facilities\":[]},\"frontendContextReceived\":true}', '2026-05-18 10:39:29', '2026-05-18 10:39:29');

-- --------------------------------------------------------

--
-- Table structure for table `chat_sessions`
--

CREATE TABLE `chat_sessions` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `normalizedName` varchar(255) NOT NULL,
  `phone` varchar(255) NOT NULL,
  `normalizedPhone` varchar(255) NOT NULL,
  `source` varchar(255) NOT NULL DEFAULT 'website_chatbot',
  `lastMessageAt` datetime DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `location` varchar(255) DEFAULT NULL,
  `normalizedLocation` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `chat_sessions`
--

INSERT INTO `chat_sessions` (`id`, `name`, `normalizedName`, `phone`, `normalizedPhone`, `source`, `lastMessageAt`, `createdAt`, `updatedAt`, `location`, `normalizedLocation`) VALUES
(1, 'nia agatha', 'nia agatha', '082233556796', '6282233556796', 'website_chatbot', '2026-05-18 06:48:08', '2026-05-11 06:25:50', '2026-05-18 06:48:08', 'malang', 'malang'),
(2, 'clarence', 'clarence', '+62821-3311-936', '628213311936', 'website_chatbot', '2026-05-12 04:37:46', '2026-05-12 04:37:46', '2026-05-12 04:37:46', 'surabaya', 'surabaya'),
(3, 'clarrence', 'clarrence', '0821-3311-936', '628213311936', 'website_chatbot', '2026-05-12 04:58:43', '2026-05-12 04:58:17', '2026-05-12 04:58:43', 'surabaya', 'surabaya'),
(4, 'clarance', 'clarance', '0821-3311-936', '628213311936', 'website_chatbot', '2026-05-12 05:21:30', '2026-05-12 05:21:30', '2026-05-12 05:21:30', 'surabaya', 'surabaya'),
(5, 'nigel', 'nigel', '082233556796', '6282233556796', 'website_chatbot', '2026-05-18 10:39:21', '2026-05-18 06:50:28', '2026-05-18 10:39:21', 'surabaya', 'surabaya');

-- --------------------------------------------------------

--
-- Table structure for table `contacts`
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
-- Dumping data for table `contacts`
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
(61, 'rahma', 'cek@gmail.com', '082233556796', 'Villa', 'sewa hotel di malang ada apa saja', '2026-05-18 06:29:48', '2026-05-18 06:29:48');

-- --------------------------------------------------------

--
-- Table structure for table `logs`
--

CREATE TABLE `logs` (
  `id` int(11) NOT NULL,
  `action` varchar(255) NOT NULL,
  `details` text DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `level` varchar(255) NOT NULL DEFAULT 'info'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `logs`
--

INSERT INTO `logs` (`id`, `action`, `details`, `createdAt`, `updatedAt`, `level`) VALUES
(3, 'PAGE_VIEW', 'Navigated from / to /contact', '2026-05-11 06:37:51', '2026-05-11 06:37:51', 'info'),
(4, 'PAGE_VIEW', 'Navigated from / to /contact', '2026-05-11 06:38:20', '2026-05-11 06:38:20', 'info'),
(5, 'PAGE_VIEW', 'Navigated from / to /contact', '2026-05-11 07:01:17', '2026-05-11 07:01:17', 'info'),
(6, 'PAGE_VIEW', 'Navigated from / to /contact', '2026-05-11 07:21:45', '2026-05-11 07:21:45', 'info'),
(7, 'PAGE_VIEW', 'Navigated from / to /contact', '2026-05-11 08:24:32', '2026-05-11 08:24:32', 'info'),
(8, 'PAGE_VIEW', 'Navigated from / to /contact', '2026-05-11 08:24:48', '2026-05-11 08:24:48', 'info'),
(9, 'PAGE_VIEW', 'Navigated from / to /contact', '2026-05-11 08:50:23', '2026-05-11 08:50:23', 'info'),
(10, 'PAGE_VIEW', 'Navigated from / to /', '2026-05-11 11:32:54', '2026-05-11 11:32:54', 'info'),
(11, 'PAGE_VIEW', 'Navigated from / to /about', '2026-05-11 11:33:20', '2026-05-11 11:33:20', 'info'),
(12, 'PAGE_VIEW', 'Navigated from / to /', '2026-05-12 03:11:34', '2026-05-12 03:11:34', 'info'),
(13, 'PAGE_VIEW', 'Navigated from / to /contact', '2026-05-12 03:11:36', '2026-05-12 03:11:36', 'info'),
(14, 'PAGE_VIEW', 'Navigated from /contact to /about', '2026-05-12 03:11:57', '2026-05-12 03:11:57', 'info'),
(15, 'FILTER_DATA', '{\"buildingType\":\"apartment\",\"transactionType\":\"\",\"location\":\"\"}', '2026-05-12 03:12:04', '2026-05-12 03:12:04', 'info'),
(16, 'FILTER_DATA', '{\"buildingType\":\"house\",\"transactionType\":\"\",\"location\":\"\"}', '2026-05-12 03:12:27', '2026-05-12 03:12:27', 'info'),
(17, 'FILTER_DATA', '{\"buildingType\":\"house\",\"transactionType\":\"sale\",\"location\":\"\"}', '2026-05-12 03:12:37', '2026-05-12 03:12:37', 'info'),
(18, 'FILTER_DATA', '{\"buildingType\":\"house\",\"transactionType\":\"rent\",\"location\":\"\"}', '2026-05-12 03:12:39', '2026-05-12 03:12:39', 'info'),
(19, 'FILTER_DATA', '{\"buildingType\":\"\",\"transactionType\":\"rent\",\"location\":\"\"}', '2026-05-12 03:12:49', '2026-05-12 03:12:49', 'info'),
(20, 'FILTER_DATA', '{\"buildingType\":\"\",\"transactionType\":\"\",\"location\":\"\"}', '2026-05-12 03:12:51', '2026-05-12 03:12:51', 'info'),
(21, 'PAGE_VIEW', 'Navigated from / to /about', '2026-05-12 03:18:23', '2026-05-12 03:18:23', 'info'),
(22, 'PAGE_VIEW', 'Navigated from / to /about', '2026-05-12 03:19:45', '2026-05-12 03:19:45', 'info'),
(23, 'FILTER_DATA', '{\"buildingType\":\"\",\"transactionType\":\"sale\",\"location\":\"\"}', '2026-05-12 03:19:58', '2026-05-12 03:19:58', 'info'),
(24, 'FILTER_DATA', '{\"buildingType\":\"others\",\"transactionType\":\"sale\",\"location\":\"\"}', '2026-05-12 03:20:00', '2026-05-12 03:20:00', 'info'),
(25, 'FILTER_DATA', '{\"buildingType\":\"villa\",\"transactionType\":\"sale\",\"location\":\"\"}', '2026-05-12 03:20:13', '2026-05-12 03:20:13', 'info'),
(26, 'FILTER_DATA', '{\"buildingType\":\"\",\"transactionType\":\"sale\",\"location\":\"\"}', '2026-05-12 03:20:20', '2026-05-12 03:20:20', 'info'),
(27, 'FILTER_DATA', '{\"buildingType\":\"\",\"transactionType\":\"\",\"location\":\"\"}', '2026-05-12 03:20:22', '2026-05-12 03:20:22', 'info'),
(28, 'FILTER_DATA', '{\"buildingType\":\"\",\"transactionType\":\"purchase\",\"location\":\"\"}', '2026-05-12 03:27:30', '2026-05-12 03:27:30', 'info'),
(29, 'FILTER_DATA', '{\"buildingType\":\"villa\",\"transactionType\":\"purchase\",\"location\":\"\"}', '2026-05-12 03:27:33', '2026-05-12 03:27:33', 'info'),
(30, 'FILTER_DATA', '{\"buildingType\":\"villa\",\"transactionType\":\"\",\"location\":\"\"}', '2026-05-12 03:28:03', '2026-05-12 03:28:03', 'info'),
(31, 'FILTER_DATA', '{\"buildingType\":\"\",\"transactionType\":\"\",\"location\":\"\"}', '2026-05-12 03:28:05', '2026-05-12 03:28:05', 'info'),
(32, 'PAGE_VIEW', 'Navigated from / to /about', '2026-05-12 03:30:45', '2026-05-12 03:30:45', 'info'),
(33, 'PAGE_VIEW', 'Navigated from / to /about', '2026-05-12 03:30:56', '2026-05-12 03:30:56', 'info'),
(34, 'FILTER_DATA', '{\"buildingType\":\"office\",\"transactionType\":\"\",\"location\":\"\"}', '2026-05-12 03:31:01', '2026-05-12 03:31:01', 'info'),
(35, 'FILTER_DATA', '{\"buildingType\":\"office\",\"transactionType\":\"sale\",\"location\":\"\"}', '2026-05-12 03:31:11', '2026-05-12 03:31:11', 'info'),
(36, 'FILTER_DATA', '{\"buildingType\":\"office\",\"transactionType\":\"rent\",\"location\":\"\"}', '2026-05-12 03:31:15', '2026-05-12 03:31:15', 'info'),
(37, 'FILTER_DATA', '{\"buildingType\":\"office\",\"transactionType\":\"purchase\",\"location\":\"\"}', '2026-05-12 03:31:21', '2026-05-12 03:31:21', 'info'),
(38, 'FILTER_DATA', '{\"buildingType\":\"office\",\"transactionType\":\"sale\",\"location\":\"\"}', '2026-05-12 03:31:22', '2026-05-12 03:31:22', 'info'),
(39, 'PAGE_VIEW', 'Navigated from / to /about', '2026-05-12 03:40:56', '2026-05-12 03:40:56', 'info'),
(40, 'FILTER_DATA', '{\"buildingType\":\"apartment\",\"transactionType\":\"\",\"location\":\"\"}', '2026-05-12 03:41:14', '2026-05-12 03:41:14', 'info'),
(41, 'FILTER_DATA', '{\"buildingType\":\"others\",\"transactionType\":\"\",\"location\":\"\"}', '2026-05-12 03:41:21', '2026-05-12 03:41:21', 'info'),
(42, 'FILTER_DATA', '{\"buildingType\":\"warehouse\",\"transactionType\":\"\",\"location\":\"\"}', '2026-05-12 03:41:33', '2026-05-12 03:41:33', 'info'),
(43, 'FILTER_DATA', '{\"buildingType\":\"office\",\"transactionType\":\"\",\"location\":\"\"}', '2026-05-12 03:41:47', '2026-05-12 03:41:47', 'info'),
(44, 'FILTER_DATA', '{\"buildingType\":\"boarding_house\",\"transactionType\":\"\",\"location\":\"\"}', '2026-05-12 03:41:55', '2026-05-12 03:41:55', 'info'),
(45, 'FILTER_DATA', '{\"buildingType\":\"boarding_house\",\"transactionType\":\"\",\"location\":\"s\"}', '2026-05-12 03:42:02', '2026-05-12 03:42:02', 'info'),
(46, 'FILTER_DATA', '{\"buildingType\":\"boarding_house\",\"transactionType\":\"\",\"location\":\"su\"}', '2026-05-12 03:42:02', '2026-05-12 03:42:02', 'info'),
(47, 'FILTER_DATA', '{\"buildingType\":\"boarding_house\",\"transactionType\":\"\",\"location\":\"sur\"}', '2026-05-12 03:42:03', '2026-05-12 03:42:03', 'info'),
(48, 'FILTER_DATA', '{\"buildingType\":\"boarding_house\",\"transactionType\":\"\",\"location\":\"sura\"}', '2026-05-12 03:42:03', '2026-05-12 03:42:03', 'info'),
(49, 'FILTER_DATA', '{\"buildingType\":\"boarding_house\",\"transactionType\":\"\",\"location\":\"sur\"}', '2026-05-12 03:42:04', '2026-05-12 03:42:04', 'info'),
(50, 'FILTER_DATA', '{\"buildingType\":\"boarding_house\",\"transactionType\":\"\",\"location\":\"su\"}', '2026-05-12 03:42:04', '2026-05-12 03:42:04', 'info'),
(51, 'FILTER_DATA', '{\"buildingType\":\"boarding_house\",\"transactionType\":\"\",\"location\":\"s\"}', '2026-05-12 03:42:04', '2026-05-12 03:42:04', 'info'),
(52, 'FILTER_DATA', '{\"buildingType\":\"boarding_house\",\"transactionType\":\"\",\"location\":\"si\"}', '2026-05-12 03:42:05', '2026-05-12 03:42:05', 'info'),
(53, 'FILTER_DATA', '{\"buildingType\":\"boarding_house\",\"transactionType\":\"\",\"location\":\"sid\"}', '2026-05-12 03:42:05', '2026-05-12 03:42:05', 'info'),
(54, 'FILTER_DATA', '{\"buildingType\":\"boarding_house\",\"transactionType\":\"\",\"location\":\"sido\"}', '2026-05-12 03:42:05', '2026-05-12 03:42:05', 'info'),
(55, 'FILTER_DATA', '{\"buildingType\":\"boarding_house\",\"transactionType\":\"\",\"location\":\"sid\"}', '2026-05-12 03:42:06', '2026-05-12 03:42:06', 'info'),
(56, 'FILTER_DATA', '{\"buildingType\":\"boarding_house\",\"transactionType\":\"\",\"location\":\"si\"}', '2026-05-12 03:42:06', '2026-05-12 03:42:06', 'info'),
(57, 'FILTER_DATA', '{\"buildingType\":\"boarding_house\",\"transactionType\":\"\",\"location\":\"s\"}', '2026-05-12 03:42:07', '2026-05-12 03:42:07', 'info'),
(58, 'FILTER_DATA', '{\"buildingType\":\"boarding_house\",\"transactionType\":\"\",\"location\":\"\"}', '2026-05-12 03:42:07', '2026-05-12 03:42:07', 'info'),
(59, 'PAGE_VIEW', 'Navigated from / to /about', '2026-05-12 03:43:02', '2026-05-12 03:43:02', 'info'),
(60, 'FILTER_DATA', '{\"buildingType\":\"\",\"transactionType\":\"rent\",\"location\":\"\"}', '2026-05-12 03:43:09', '2026-05-12 03:43:09', 'info'),
(61, 'FILTER_DATA', '{\"buildingType\":\"\",\"transactionType\":\"purchase\",\"location\":\"\"}', '2026-05-12 03:43:15', '2026-05-12 03:43:15', 'info'),
(62, 'FILTER_DATA', '{\"buildingType\":\"apartment\",\"transactionType\":\"purchase\",\"location\":\"\"}', '2026-05-12 03:43:20', '2026-05-12 03:43:20', 'info'),
(63, 'FILTER_DATA', '{\"buildingType\":\"warehouse\",\"transactionType\":\"purchase\",\"location\":\"\"}', '2026-05-12 03:43:22', '2026-05-12 03:43:22', 'info'),
(64, 'FILTER_DATA', '{\"buildingType\":\"shophouse\",\"transactionType\":\"purchase\",\"location\":\"\"}', '2026-05-12 03:43:24', '2026-05-12 03:43:24', 'info'),
(65, 'PAGE_VIEW', 'Navigated from / to /about', '2026-05-12 04:36:37', '2026-05-12 04:36:37', 'info'),
(66, 'PAGE_VIEW', 'Navigated from / to /', '2026-05-12 04:56:51', '2026-05-12 04:56:51', 'info'),
(67, 'PAGE_VIEW', 'Navigated from / to /about', '2026-05-12 04:56:52', '2026-05-12 04:56:52', 'info'),
(68, 'FILTER_DATA', '{\"buildingType\":\"boarding_house\",\"transactionType\":\"\",\"location\":\"\"}', '2026-05-12 04:56:57', '2026-05-12 04:56:57', 'info'),
(69, 'FILTER_DATA', '{\"buildingType\":\"boarding_house\",\"transactionType\":\"sale\",\"location\":\"\"}', '2026-05-12 04:56:58', '2026-05-12 04:56:58', 'info'),
(70, 'FILTER_DATA', '{\"buildingType\":\"hotel\",\"transactionType\":\"sale\",\"location\":\"\"}', '2026-05-12 04:57:02', '2026-05-12 04:57:02', 'info'),
(71, 'FILTER_DATA', '{\"buildingType\":\"house\",\"transactionType\":\"sale\",\"location\":\"\"}', '2026-05-12 04:57:04', '2026-05-12 04:57:04', 'info'),
(72, 'FILTER_DATA', '{\"buildingType\":\"\",\"transactionType\":\"sale\",\"location\":\"\"}', '2026-05-12 04:57:07', '2026-05-12 04:57:07', 'info'),
(73, 'FILTER_DATA', '{\"buildingType\":\"\",\"transactionType\":\"purchase\",\"location\":\"\"}', '2026-05-12 04:57:09', '2026-05-12 04:57:09', 'info'),
(74, 'FILTER_DATA', '{\"buildingType\":\"others\",\"transactionType\":\"purchase\",\"location\":\"\"}', '2026-05-12 04:57:16', '2026-05-12 04:57:16', 'info'),
(75, 'FILTER_DATA', '{\"buildingType\":\"others\",\"transactionType\":\"sale\",\"location\":\"\"}', '2026-05-12 04:58:50', '2026-05-12 04:58:50', 'info'),
(76, 'PAGE_VIEW', 'Navigated from / to /about', '2026-05-12 04:59:43', '2026-05-12 04:59:43', 'info'),
(77, 'PAGE_VIEW', 'Navigated from / to /about', '2026-05-12 05:00:09', '2026-05-12 05:00:09', 'info'),
(78, 'FILTER_DATA', '{\"buildingType\":\"warehouse\",\"transactionType\":\"\",\"location\":\"\"}', '2026-05-12 05:00:17', '2026-05-12 05:00:17', 'info'),
(79, 'FILTER_DATA', '{\"buildingType\":\"warehouse\",\"transactionType\":\"rent\",\"location\":\"\"}', '2026-05-12 05:00:19', '2026-05-12 05:00:19', 'info'),
(80, 'FILTER_DATA', '{\"buildingType\":\"warehouse\",\"transactionType\":\"purchase\",\"location\":\"\"}', '2026-05-12 05:00:21', '2026-05-12 05:00:21', 'info'),
(81, 'FILTER_DATA', '{\"buildingType\":\"warehouse\",\"transactionType\":\"sale\",\"location\":\"\"}', '2026-05-12 05:00:23', '2026-05-12 05:00:23', 'info'),
(82, 'FILTER_DATA', '{\"buildingType\":\"warehouse\",\"transactionType\":\"rent\",\"location\":\"\"}', '2026-05-12 05:00:24', '2026-05-12 05:00:24', 'info'),
(83, 'FILTER_DATA', '{\"buildingType\":\"apartment\",\"transactionType\":\"rent\",\"location\":\"\"}', '2026-05-12 05:00:30', '2026-05-12 05:00:30', 'info'),
(84, 'PAGE_VIEW', 'Navigated from / to /about', '2026-05-12 05:20:17', '2026-05-12 05:20:17', 'info'),
(85, 'PAGE_VIEW', 'Navigated from /about to /about', '2026-05-12 05:20:22', '2026-05-12 05:20:22', 'info'),
(86, 'PAGE_VIEW', 'Navigated from / to /', '2026-05-13 09:28:07', '2026-05-13 09:28:07', 'info'),
(87, 'PAGE_VIEW', 'Navigated from / to /', '2026-05-13 09:28:25', '2026-05-13 09:28:25', 'info'),
(88, 'PAGE_VIEW', 'Navigated from / to /', '2026-05-13 10:15:09', '2026-05-13 10:15:09', 'info'),
(89, 'PAGE_VIEW', 'Navigated from / to /contact', '2026-05-13 10:15:10', '2026-05-13 10:15:10', 'info'),
(90, 'PAGE_VIEW', 'Navigated from / to /', '2026-05-18 02:28:02', '2026-05-18 02:28:02', 'info'),
(91, 'PAGE_VIEW', 'Navigated from / to /about', '2026-05-18 02:28:03', '2026-05-18 02:28:03', 'info'),
(92, 'PAGE_VIEW', 'Navigated from /about to /contact', '2026-05-18 02:38:34', '2026-05-18 02:38:34', 'info'),
(93, 'PAGE_VIEW', 'Navigated from / to /contact', '2026-05-18 03:08:32', '2026-05-18 03:08:32', 'info'),
(94, 'PAGE_VIEW', 'Navigated from / to /contact', '2026-05-18 03:09:57', '2026-05-18 03:09:57', 'info'),
(95, 'PAGE_VIEW', 'Navigated from / to /contact', '2026-05-18 03:42:37', '2026-05-18 03:42:37', 'info'),
(96, 'PAGE_VIEW', 'Navigated from / to /contact', '2026-05-18 06:25:52', '2026-05-18 06:25:52', 'info'),
(97, 'PAGE_VIEW', 'Navigated from / to /contact', '2026-05-18 06:47:24', '2026-05-18 06:47:24', 'info'),
(98, 'PAGE_VIEW', 'Navigated from / to /contact', '2026-05-18 06:47:27', '2026-05-18 06:47:27', 'info'),
(99, 'PAGE_VIEW', 'Navigated from / to /', '2026-05-18 10:38:46', '2026-05-18 10:38:46', 'info'),
(100, 'PAGE_VIEW', 'Navigated from / to /contact', '2026-05-18 10:38:47', '2026-05-18 10:38:47', 'info');

-- --------------------------------------------------------

--
-- Table structure for table `properties`
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

--
-- Indexes for dumped tables
--

--
-- Indexes for table `chat_messages`
--
ALTER TABLE `chat_messages`
  ADD PRIMARY KEY (`id`),
  ADD KEY `chatSessionId` (`chatSessionId`);

--
-- Indexes for table `chat_sessions`
--
ALTER TABLE `chat_sessions`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `contacts`
--
ALTER TABLE `contacts`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `logs`
--
ALTER TABLE `logs`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `properties`
--
ALTER TABLE `properties`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `chat_messages`
--
ALTER TABLE `chat_messages`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=80;

--
-- AUTO_INCREMENT for table `chat_sessions`
--
ALTER TABLE `chat_sessions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `contacts`
--
ALTER TABLE `contacts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=62;

--
-- AUTO_INCREMENT for table `logs`
--
ALTER TABLE `logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=101;

--
-- AUTO_INCREMENT for table `properties`
--
ALTER TABLE `properties`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `chat_messages`
--
ALTER TABLE `chat_messages`
  ADD CONSTRAINT `chat_messages_ibfk_1` FOREIGN KEY (`chatSessionId`) REFERENCES `chat_sessions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
