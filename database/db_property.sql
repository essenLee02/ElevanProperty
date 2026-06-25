-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Jun 25, 2026 at 12:11 PM
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
  `user_id` varchar(50) DEFAULT NULL,
  `role` varchar(50) NOT NULL,
  `message` text NOT NULL,
  `channel` varchar(50) NOT NULL DEFAULT 'website_chatbot',
  `metadata` text DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `chat_messages`
--

INSERT INTO `chat_messages` (`id`, `chatSessionId`, `user_id`, `role`, `message`, `channel`, `metadata`, `createdAt`, `updatedAt`) VALUES
(1, 25, 'LFGKT49002', 'customer', 'Hi... Saya mau cari rumah di Surabaya, saya butuh sewa rumah selama 3 tahun.', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"22ea6d03-c876-46f0-9715-720bf5d78e11\",\"platform\":\"timelinesai\"}', '2026-06-25 10:06:37', '2026-06-25 10:06:37'),
(2, 25, 'LFGKT49002', 'ai', 'Boleh tahu, apa yang membuat Kak mulai cari rumah sekarang? Misalnya mau pindah, keluarga nambah, pindah kerja, atau untuk investasi?', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-25 10:06:37', '2026-06-25 10:06:37'),
(3, 25, 'LFGKT49002', 'customer', 'Saya ada pindahan kerja', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"54776d94-a1ae-4134-844c-10cbad86f8dc\",\"platform\":\"timelinesai\"}', '2026-06-25 10:07:16', '2026-06-25 10:07:16'),
(4, 25, 'LFGKT49002', 'ai', 'Sebelumnya sudah sempat lihat beberapa rumah, Kak? Kalau sudah, biasanya apa yang bikin belum cocok?', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-25 10:07:16', '2026-06-25 10:07:16'),
(5, 25, 'LFGKT49002', 'customer', 'Saya belum pernah lihat-lihat rumah yang disewakan, namun saya cari rumah yang asri, dingin dan tidak banjir.', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"75fc837f-9498-4dc4-83f9-63ff97af81d8\",\"platform\":\"timelinesai\"}', '2026-06-25 10:08:12', '2026-06-25 10:08:12'),
(6, 25, 'LFGKT49002', 'ai', 'Di *Surabaya* ada yang di kisaran *2–5 juta/bln* dan ada yang lebih di *10–25 juta/bln*. Kira-kira yang mana lebih mendekati rencana Kak? 💰', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-25 10:08:12', '2026-06-25 10:08:12'),
(7, 25, 'LFGKT49002', 'customer', 'Saya Bakan pindah tahun depan, Kak', 'whatsapp', '{\"agentName\":\"LEO FELIX\",\"messageId\":\"87950c3b-9bea-4654-a8ed-3eb9967956e7\",\"platform\":\"timelinesai\"}', '2026-06-25 10:08:27', '2026-06-25 10:08:27'),
(8, 25, 'LFGKT49002', 'ai', 'Kalau nanti ada yang cocok, langsung bisa jadwalkan survey, atau perlu koordinasi dulu dengan keluarga, Kak?', 'whatsapp', '{\"aiProvider\":\"private_agent\",\"contextSource\":\"flat_json\"}', '2026-06-25 10:08:27', '2026-06-25 10:08:27');

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
  `location` varchar(255) DEFAULT NULL,
  `normalizedLocation` varchar(255) DEFAULT NULL,
  `source` varchar(255) NOT NULL DEFAULT 'website_chatbot',
  `lastMessageAt` datetime DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `chat_sessions`
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
(29, 'WANGSITERS', 'wangsiters', '+120363377896115466', '+120363377896115466', NULL, NULL, 'timelinesai_leo_felix', NULL, '2026-06-23 05:01:09', '2026-06-23 05:01:09');

-- --------------------------------------------------------

--
-- Table structure for table `cities`
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
(61, 'rahma', 'cek@gmail.com', '082233556796', 'Villa', 'sewa hotel di malang ada apa saja', '2026-05-18 06:29:48', '2026-05-18 06:29:48'),
(62, 'nigel', 'dokumen.nigel2@gmail.com', '082233556796', 'hotel', 'tolong berikan list hotel di surabaya', '2026-05-21 10:23:27', '2026-05-21 10:23:27'),
(63, 'nigel', 'dokumen.nigel2@gmail.com', '082233556796', 'hotel', 'tolong berikan list hotel di surabaya', '2026-05-21 10:24:04', '2026-05-21 10:24:04'),
(64, 'nigel', 'dokumen.nigel2@gmail.com', '082233556796', 'hotel', 'tolong berikan list hotel di surabaya', '2026-05-21 10:35:26', '2026-05-21 10:35:26');

-- --------------------------------------------------------

--
-- Table structure for table `countries`
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

-- --------------------------------------------------------

--
-- Table structure for table `facilities`
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
-- Dumping data for table `facilities`
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
-- Table structure for table `logs`
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
-- Dumping data for table `logs`
--

INSERT INTO `logs` (`id`, `action`, `details`, `level`, `createdAt`, `updatedAt`) VALUES
(1, 'PAGE_VIEW', 'Navigated from / to /', 'info', '2026-06-25 09:58:19', '2026-06-25 09:58:19'),
(2, 'PAGE_VIEW', 'Navigated from / to /login', 'info', '2026-06-25 09:58:23', '2026-06-25 09:58:23'),
(3, 'PAGE_VIEW', 'Navigated from /login to /', 'info', '2026-06-25 09:58:29', '2026-06-25 09:58:29'),
(4, 'PAGE_VIEW', 'Navigated from / to /facility', 'info', '2026-06-25 09:58:31', '2026-06-25 09:58:31');

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

-- --------------------------------------------------------

--
-- Table structure for table `provinces`
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

-- --------------------------------------------------------

--
-- Table structure for table `users`
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
  `chakra_hq_token` varchar(2000) DEFAULT NULL COMMENT 'ChakraHQ Access Token milik agent (Bearer token untuk API ChakraHQ)'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `user_id`, `name`, `birthdate`, `phone`, `username`, `password`, `refresh_token`, `updated_date`, `update_by`, `created_date`, `created_by`, `status`, `privilege`, `fonnte_token`, `chakra_hq_token`) VALUES
(1, 'SA6EDRU001', 'NIGEL KUNCORO', '1998-05-04', '082233556796', 'nigel123', '$2b$10$Rld5zga/CswkKyQPgPi6GO./sa5.OuVwgApiGxbZmCRudUD9TNHD2', NULL, '2026-06-25 07:17:43', 'nigel123', '2026-05-22 03:26:55', 'Self-Register', 1, 'agent', 'm5HDmV4hAYRFBgTdkfDR', ''),
(2, 'LFGKT49002', 'LEO FELIX', '2000-05-25', '0881036588874', 'leon123', '$2b$10$cFCdDf7g5ZxzPWpLG0WQrOPWbdNGNVfAiWrtfts.f98cg2Ju3bRum', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJMRkdLVDQ5MDAyIiwidXNlck5hbWUiOiJMRU8gRkVMSVgiLCJ1c2VybmFtZSI6Imxlb24xMjMiLCJwcml2aWxlZ2UiOiJhZ2VudCIsImlhdCI6MTc4MjM3MDcxOCwiZXhwIjoxNzgyNDU3MTE4fQ.mKeAdMJtw-wNO7gE-OSEgApDWekJymDZkzuR26hCtKQ', '2026-06-25 06:58:38', 'leon123', '2026-05-25 10:05:33', 'Self-Register', 1, 'agent', 'PiBSZQXu6HKWhKkEDu9e', 'XGQdHjy2qSr0VFL1k0sDXwULNYt1FNW4RhBsuYcirQJx4a9K4e135lQGaDsyRjyQQTfKRz5BPQfP0kgGK3pJA1CgB8XRd3NFe0masDDYAdQ5WZuEXZcY5A0LxVfRatkAPaVuRa8TEVN3R1PNyv29KgOI3rnHGqnvlhuHnwsjuXOQxPUhZ4dTcgHdohsrMQkzA8RPLr0lR3XmmLk6z7uv6rgv46BLts88YGNE4EOGsmWBw0i3BfEPfXLHNSW9w2J'),
(3, 'CEMPL3Z003', 'CLARENCE MARIO', '1993-03-24', '0821-1136-7154', 'clarence123', '$2b$10$jvnn536K239gxQRcOqNIauJxZxTq9iBcJYLWDstvTItZGkAIsA07e', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJDRU1QTDNaMDAzIiwidXNlck5hbWUiOiJDTEFSRU5DRSBNQVJJTyIsInVzZXJuYW1lIjoiY2xhcmVuY2UxMjMiLCJwcml2aWxlZ2UiOiJhZ2VudCIsImlhdCI6MTc4MjM4MTUwOCwiZXhwIjoxNzgyNDY3OTA4fQ.duZ6DXEoDjStPjHzmx1nxyLlIkxJ5UbDeutqnPqdZKo', '2026-06-25 09:58:28', 'clarence123', '2026-05-26 01:56:29', 'Self-Register', 1, 'agent', NULL, NULL),
(4, 'DTDE8RX004', 'DESY TALIM', '1995-08-27', '0821-1331-8191', 'desy54321', '$2b$10$ZCZK0Lzlenn2y1ni3gtITOdJs9GISQcG1eatRxh0PEBKk0BXwyhNq', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJEVERFOFJYMDA0IiwidXNlck5hbWUiOiJERVNZIFRBTElNIiwidXNlcm5hbWUiOiJkZXN5NTQzMjEiLCJwcml2aWxlZ2UiOiJhZ2VudCIsImlhdCI6MTc4MjM3NTU2NiwiZXhwIjoxNzgyNDYxOTY2fQ.aXGlLj0-fuL8cPWKNk4z5wSIt3yXzE3zpjk6wzDPQNU', '2026-06-25 08:19:26', 'desy54321', '2026-05-26 01:57:21', 'Self-Register', 1, 'agent', NULL, NULL),
(5, 'ITJMESP005', 'IFAN TJANDRA', '2000-05-12', '+62881036588874', 'ifansiapa', '$2b$10$XK.IYefPk7hTE8hXNPJriOpueghFfkUH0.9m413E/PMBg2rESDmge', NULL, '2026-05-26 03:17:07', 'ifansiapa', '2026-05-26 01:58:48', 'Self-Register', 1, 'agent', NULL, NULL),
(6, 'IE1BGVY006', 'IFAN ELDY', '1998-04-16', '0881-0365-88874', 'ifaneldy', '$2b$10$FDHol/1mitgKFZwNmTZjIu1WgsRmRr28BTspMm5jlKxPlkbifhwFu', NULL, NULL, NULL, '2026-05-26 03:18:16', 'Self-Register', 1, 'agent', NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `whatsapp_inbound_messages`
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
-- Indexes for table `cities`
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
-- Indexes for table `contacts`
--
ALTER TABLE `contacts`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `countries`
--
ALTER TABLE `countries`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `country_id` (`country_id`),
  ADD UNIQUE KEY `country_id_2` (`country_id`),
  ADD KEY `countries_country_id` (`country_id`),
  ADD KEY `countries_status` (`status`),
  ADD KEY `countries_name` (`name`);

--
-- Indexes for table `facilities`
--
ALTER TABLE `facilities`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `facility_id` (`facility_id`),
  ADD UNIQUE KEY `facility_id_2` (`facility_id`),
  ADD KEY `facilities_facility_id` (`facility_id`),
  ADD KEY `facilities_status` (`status`),
  ADD KEY `facilities_name` (`name`);

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
-- Indexes for table `provinces`
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
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `user_id` (`user_id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD UNIQUE KEY `user_id_2` (`user_id`),
  ADD UNIQUE KEY `username_2` (`username`),
  ADD KEY `users_user_id` (`user_id`),
  ADD KEY `users_username` (`username`),
  ADD KEY `users_status` (`status`),
  ADD KEY `users_privilege_status` (`privilege`,`status`),
  ADD KEY `users_phone` (`phone`);

--
-- Indexes for table `whatsapp_inbound_messages`
--
ALTER TABLE `whatsapp_inbound_messages`
  ADD PRIMARY KEY (`id`),
  ADD KEY `whatsapp_inbound_messages_agent_name` (`agentName`),
  ADD KEY `whatsapp_inbound_messages_sender_phone_normalized` (`senderPhoneNormalized`),
  ADD KEY `whatsapp_inbound_messages_status` (`status`),
  ADD KEY `whatsapp_inbound_messages_created_at` (`createdAt`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `chat_messages`
--
ALTER TABLE `chat_messages`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `chat_sessions`
--
ALTER TABLE `chat_sessions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=30;

--
-- AUTO_INCREMENT for table `cities`
--
ALTER TABLE `cities`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `contacts`
--
ALTER TABLE `contacts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=65;

--
-- AUTO_INCREMENT for table `countries`
--
ALTER TABLE `countries`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `facilities`
--
ALTER TABLE `facilities`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=22;

--
-- AUTO_INCREMENT for table `logs`
--
ALTER TABLE `logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `properties`
--
ALTER TABLE `properties`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `provinces`
--
ALTER TABLE `provinces`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `whatsapp_inbound_messages`
--
ALTER TABLE `whatsapp_inbound_messages`
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
