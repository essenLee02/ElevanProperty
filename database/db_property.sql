-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Jun 25, 2026 at 09:57 AM
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
(1, 'nigel', 'nigel', '082233556796', '6282233556796', 'website_chatbot', '2026-06-04 04:36:40', '2026-05-11 06:25:50', '2026-06-04 04:36:40', 'suarabaya', 'suarabaya'),
(2, 'clarence', 'clarence', '+62821-3311-936', '628213311936', 'website_chatbot', '2026-05-12 04:37:46', '2026-05-12 04:37:46', '2026-05-12 04:37:46', 'surabaya', 'surabaya'),
(3, 'clarrence', 'clarrence', '0821-3311-936', '628213311936', 'website_chatbot', '2026-05-12 04:58:43', '2026-05-12 04:58:17', '2026-05-12 04:58:43', 'surabaya', 'surabaya'),
(4, 'clarance', 'clarance', '0821-3311-936', '628213311936', 'website_chatbot', '2026-05-12 05:21:30', '2026-05-12 05:21:30', '2026-05-12 05:21:30', 'surabaya', 'surabaya'),
(5, 'nigel', 'nigel', '082233556796', '6282233556796', 'website_chatbot', '2026-06-25 07:48:36', '2026-05-18 06:50:28', '2026-06-25 07:48:36', 'surabaya', 'surabaya'),
(6, 'LEO FELIX', 'leo felix', '628233556796', '628233556796', 'fonnte_leo_felix', NULL, '2026-05-28 09:47:37', '2026-05-28 09:47:37', NULL, NULL),
(7, 'Test Customer', 'test customer', '628999888777', '628999888777', 'fonnte_nigel_kuncoro', NULL, '2026-05-29 07:02:20', '2026-05-29 07:02:20', NULL, NULL),
(8, 'Customer External Test', 'customer external test', '628555444333', '628555444333', 'fonnte_leo_felix', NULL, '2026-05-29 07:02:59', '2026-05-29 07:02:59', NULL, NULL),
(9, 'LEA UISETIAWAN', 'lea uisetiawan', '0881036588874', '62881036588874', 'fonnte_leo_felix', NULL, '2026-05-29 07:56:24', '2026-05-29 07:56:24', NULL, NULL),
(10, 'LEA UISETIAWAN', 'lea uisetiawan', '628881036588874', '628881036588874', 'fonnte_nigel_kuncoro', NULL, '2026-05-29 10:24:30', '2026-05-29 10:24:30', NULL, NULL),
(11, 'LEA UISETIAWAN', 'lea uisetiawan', '628881036588874', '628881036588874', 'fonnte_leo_felix', NULL, '2026-05-29 10:27:15', '2026-05-29 10:27:15', NULL, NULL),
(12, 'Mikhael Jefferson', 'mikhael jefferson', '6285748094855', '6285748094855', 'fonnte_leo_felix', NULL, '2026-06-03 02:23:53', '2026-06-03 02:23:53', NULL, NULL),
(13, 'Nigel 期凡努', 'nigel 期凡努', '6282233556796', '6282233556796', 'fonnte_leo_felix', NULL, '2026-06-03 02:24:01', '2026-06-03 02:24:01', NULL, NULL),
(14, '🌻', '🌻', '6288805301123', '6288805301123', 'fonnte_leo_felix', NULL, '2026-06-03 02:53:41', '2026-06-03 02:53:41', NULL, NULL),
(15, 'Devyana Herman', 'devyana herman', '6282233564039', '6282233564039', 'fonnte_leo_felix', NULL, '2026-06-04 07:45:10', '2026-06-04 07:45:10', NULL, NULL),
(16, 'L', 'l', '6281334708691', '6281334708691', 'fonnte_leo_felix', NULL, '2026-06-05 03:55:21', '2026-06-05 03:55:21', NULL, NULL),
(17, 'Tivani 🍀', 'tivani 🍀', '6282245926252', '6282245926252', 'fonnte_leo_felix', NULL, '2026-06-08 01:41:00', '2026-06-08 01:41:00', NULL, NULL),
(18, 'Yohana Advennia', 'yohana advennia', '6282257360240', '6282257360240', 'fonnte_leo_felix', NULL, '2026-06-11 05:39:41', '2026-06-11 05:39:41', NULL, NULL),
(19, 'Clarence Eldy', 'clarence eldy', '6282111367154', '6282111367154', 'fonnte_leo_felix', NULL, '2026-06-12 01:20:00', '2026-06-12 01:20:00', NULL, NULL),
(20, 'Nigel 期凡努', 'nigel 期凡努', '6282233556796', '6282233556796', 'chakrahq_leo_felix', NULL, '2026-06-18 02:55:00', '2026-06-18 02:55:00', NULL, NULL),
(21, 'Mikhael Jefferson', 'mikhael jefferson', '6285748094855', '6285748094855', 'chakrahq_leo_felix', NULL, '2026-06-18 03:01:42', '2026-06-18 03:01:42', NULL, NULL),
(22, 'Test Diag', 'test diag', '628111222333', '628111222333', 'fonnte_leo_felix', NULL, '2026-06-18 08:24:16', '2026-06-18 08:24:16', NULL, NULL),
(23, 'Diag Public', 'diag public', '628111222444', '628111222444', 'fonnte_leo_felix', NULL, '2026-06-18 08:24:45', '2026-06-18 08:24:45', NULL, NULL),
(24, 'Diag Root', 'diag root', '628111222555', '628111222555', 'fonnte_leo_felix', NULL, '2026-06-18 08:24:45', '2026-06-18 08:24:45', NULL, NULL),
(25, '+62∙∙∙∙∙∙∙∙∙96', '+62∙∙∙∙∙∙∙∙∙96', '+6282233556796', '6282233556796', 'timelinesai_leo_felix', NULL, '2026-06-23 02:33:39', '2026-06-23 02:33:39', NULL, NULL),
(26, '🌻', '🌻', '+6288805301123', '6288805301123', 'timelinesai_leo_felix', NULL, '2026-06-23 03:22:31', '2026-06-23 03:22:31', NULL, NULL),
(27, 'Sharmila Putri', 'sharmila putri', '+6288905942718', '6288905942718', 'timelinesai_leo_felix', NULL, '2026-06-23 03:47:55', '2026-06-23 03:47:55', NULL, NULL),
(28, 'Lidya Kandau', 'lidya kandau', '+6285852386867', '6285852386867', 'timelinesai_leo_felix', NULL, '2026-06-23 04:25:04', '2026-06-23 04:25:04', NULL, NULL),
(29, 'WANGSITERS', 'wangsiters', '+120363377896115466', '+120363377896115466', 'timelinesai_leo_felix', NULL, '2026-06-23 05:01:09', '2026-06-23 05:01:09', NULL, NULL);

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
-- Table structure for table `facilities`
--

CREATE TABLE `facilities` (
  `id` int(11) NOT NULL,
  `facility_id` varchar(30) NOT NULL COMMENT 'Generated ID: prefix nama + random alphanumeric + count padded 3 digit',
  `name` varchar(100) NOT NULL COMMENT 'Nama fasilitas, mis. AC, Kolam Renang, CCTV',
  `description` varchar(255) DEFAULT NULL COMMENT 'Deskripsi singkat fasilitas',
  `icon` varchar(50) DEFAULT NULL COMMENT 'Icon identifier, mis. emoji atau CSS class (fa-wifi, ?, dll.)',
  `category` varchar(50) DEFAULT NULL COMMENT 'Kategori fasilitas, mis. Keamanan, Kenyamanan, Aksesibilitas, Rekreasi',
  `sort_order` int(11) NOT NULL DEFAULT 0 COMMENT 'Urutan tampil fasilitas (ascending). 0 = default',
  `status` int(1) NOT NULL DEFAULT 1 COMMENT '1 = aktif, 2 = disabled/blocked, 3 = deleted (soft delete)',
  `created_date` date NOT NULL COMMENT 'Tanggal pembuatan data',
  `created_by` varchar(50) NOT NULL COMMENT 'FK ke users.user_id — siapa yang membuat',
  `updated_date` date DEFAULT NULL COMMENT 'Tanggal update terakhir',
  `updated_by` varchar(50) DEFAULT NULL COMMENT 'FK ke users.user_id — siapa yang terakhir mengubah'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `facilities`
--

INSERT INTO `facilities` (`id`, `facility_id`, `name`, `description`, `icon`, `category`, `sort_order`, `status`, `created_date`, `created_by`, `updated_date`, `updated_by`) VALUES
(1, 'ACZKE0T001', 'AC', NULL, '❄️', NULL, 0, 1, '2026-06-19', 'LFGKT49002', '2026-06-25', 'CEMPL3Z003'),
(2, 'SERZTB4002', 'SECURITY', NULL, NULL, NULL, 0, 1, '2026-06-19', 'LFGKT49002', NULL, NULL),
(3, 'PMWJO48003', 'PARKIR SEPEDA MOTOR', NULL, NULL, NULL, 0, 1, '2026-06-19', 'LFGKT49002', '2026-06-25', 'LFGKT49002'),
(4, 'KSH6GIX004', 'KITCHEN SET', NULL, '🍽️', NULL, 0, 1, '2026-06-25', 'SA6EDRU001', NULL, NULL),
(5, 'KRQNLSG005', 'KOLAM RENANG', NULL, '🏊', NULL, 0, 1, '2026-06-25', 'SA6EDRU001', NULL, NULL),
(6, 'CJ2POEZ006', 'CCTV 24 JAM', NULL, NULL, NULL, 0, 1, '2026-06-25', 'SA6EDRU001', NULL, NULL),
(7, 'KZVVS0X007', 'KIDS ZONE', NULL, NULL, NULL, 0, 1, '2026-06-25', 'SA6EDRU001', NULL, NULL),
(8, 'GYFW2BB008', 'GYM', NULL, '🏋️', NULL, 0, 1, '2026-06-25', 'SA6EDRU001', NULL, NULL),
(9, 'YOFYIK4009', 'YOGA', NULL, NULL, NULL, 0, 1, '2026-06-25', 'SA6EDRU001', NULL, NULL),
(10, 'SB0KAIO010', 'SPRING BED', NULL, NULL, NULL, 0, 1, '2026-06-25', 'CEMPL3Z003', NULL, NULL),
(11, 'LA29XXD011', 'LAUNDRY', NULL, '🧺', NULL, 0, 1, '2026-06-25', 'CEMPL3Z003', NULL, NULL),
(12, 'WIMLCYO012', 'WI-FI', NULL, NULL, NULL, 0, 1, '2026-06-25', 'CEMPL3Z003', NULL, NULL),
(13, 'BRN2QOZ013', 'BREAKFAST', NULL, NULL, NULL, 0, 1, '2026-06-25', 'CEMPL3Z003', NULL, NULL),
(14, 'LUO5SSN014', 'LUNCH', NULL, '🍽️', NULL, 0, 1, '2026-06-25', 'CEMPL3Z003', NULL, NULL),
(15, 'DIF4AJQ015', 'DINNER', NULL, '🍽️', NULL, 0, 1, '2026-06-25', 'CEMPL3Z003', NULL, NULL),
(16, 'SHTZIRG016', 'SMART HOME', NULL, NULL, NULL, 0, 1, '2026-06-25', 'CEMPL3Z003', NULL, NULL),
(17, 'WHXZCX1017', 'WATER HEATER', NULL, '🚿', NULL, 0, 1, '2026-06-25', 'CEMPL3Z003', NULL, NULL),
(18, 'SNV7EXP018', 'STADIUN NONTON', NULL, NULL, NULL, 0, 1, '2026-06-25', 'CEMPL3Z003', NULL, NULL),
(19, 'SD1NUPW019', 'SMART DOOR', NULL, NULL, NULL, 0, 1, '2026-06-25', 'CEMPL3Z003', NULL, NULL),
(20, 'BAPHJKO020', 'BAR', NULL, NULL, NULL, 0, 1, '2026-06-25', 'CEMPL3Z003', NULL, NULL),
(21, 'IPZVQAW021', 'INFINITY POOL', NULL, '🏊', NULL, 0, 1, '2026-06-25', 'CEMPL3Z003', NULL, NULL);

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
(100, 'PAGE_VIEW', 'Navigated from / to /contact', '2026-05-18 10:38:47', '2026-05-18 10:38:47', 'info'),
(101, 'PAGE_VIEW', 'Navigated from / to /', '2026-05-20 09:55:05', '2026-05-20 09:55:05', 'info'),
(102, 'PAGE_VIEW', 'Navigated from / to /about', '2026-05-20 09:55:13', '2026-05-20 09:55:13', 'info'),
(103, 'PAGE_VIEW', 'Navigated from / to /about', '2026-05-20 09:56:34', '2026-05-20 09:56:34', 'info'),
(104, 'PAGE_VIEW', 'Navigated from / to /rumah123', '2026-05-21 06:40:34', '2026-05-21 06:40:34', 'info'),
(105, 'PAGE_VIEW', 'Navigated from / to /rumah123', '2026-05-21 06:54:28', '2026-05-21 06:54:28', 'info'),
(106, 'PAGE_VIEW', 'Navigated from / to /rumah123', '2026-05-21 07:11:37', '2026-05-21 07:11:37', 'info'),
(107, 'PAGE_VIEW', 'Navigated from / to /rumah123', '2026-05-21 07:11:48', '2026-05-21 07:11:48', 'info'),
(108, 'PAGE_VIEW', 'Navigated from / to /rumah123', '2026-05-21 07:19:08', '2026-05-21 07:19:08', 'info'),
(109, 'PAGE_VIEW', 'Navigated from / to /rumah123', '2026-05-21 07:48:20', '2026-05-21 07:48:20', 'info'),
(110, 'PAGE_VIEW', 'Navigated from / to /rumah123', '2026-05-21 08:06:53', '2026-05-21 08:06:53', 'info'),
(111, 'PAGE_VIEW', 'Navigated from / to /rumah123', '2026-05-21 09:44:22', '2026-05-21 09:44:22', 'info'),
(112, 'PAGE_VIEW', 'Navigated from /rumah123 to /contact', '2026-05-21 10:22:37', '2026-05-21 10:22:37', 'info'),
(113, 'PAGE_VIEW', 'Navigated from / to /rumah123', '2026-05-22 03:08:20', '2026-05-22 03:08:20', 'info'),
(114, 'PAGE_VIEW', 'Navigated from / to /register', '2026-05-22 03:08:20', '2026-05-22 03:08:20', 'info'),
(115, 'PAGE_VIEW', 'Navigated from / to /rumah123', '2026-05-22 03:09:35', '2026-05-22 03:09:35', 'info'),
(116, 'PAGE_VIEW', 'Navigated from / to /register', '2026-05-22 03:09:35', '2026-05-22 03:09:35', 'info'),
(117, 'PAGE_VIEW', 'Navigated from / to /rumah123', '2026-05-22 03:10:40', '2026-05-22 03:10:40', 'info'),
(118, 'PAGE_VIEW', 'Navigated from / to /register', '2026-05-22 03:10:40', '2026-05-22 03:10:40', 'info'),
(119, 'PAGE_VIEW', 'Navigated from / to /register', '2026-05-22 03:11:08', '2026-05-22 03:11:08', 'info'),
(120, 'PAGE_VIEW', 'Navigated from / to /rumah123', '2026-05-22 03:11:08', '2026-05-22 03:11:08', 'info'),
(121, 'PAGE_VIEW', 'Navigated from / to /rumah123', '2026-05-22 03:25:14', '2026-05-22 03:25:14', 'info'),
(122, 'PAGE_VIEW', 'Navigated from / to /register', '2026-05-22 03:26:06', '2026-05-22 03:26:06', 'info'),
(123, 'PAGE_VIEW', 'Navigated from / to /rumah123', '2026-05-22 03:26:20', '2026-05-22 03:26:20', 'info'),
(124, 'PAGE_VIEW', 'Navigated from / to /register', '2026-05-22 03:26:20', '2026-05-22 03:26:20', 'info'),
(125, 'PAGE_VIEW', 'Navigated from /register to /login', '2026-05-22 03:26:57', '2026-05-22 03:26:57', 'info'),
(126, 'PAGE_VIEW', 'Navigated from /login to /', '2026-05-22 03:27:06', '2026-05-22 03:27:06', 'info'),
(127, 'PAGE_VIEW', 'Navigated from / to /profile', '2026-05-22 05:31:14', '2026-05-22 05:31:14', 'info'),
(128, 'PAGE_VIEW', 'Navigated from /profile to /login', '2026-05-22 05:31:16', '2026-05-22 05:31:16', 'info'),
(129, 'PAGE_VIEW', 'Navigated from /login to /login', '2026-05-22 05:31:16', '2026-05-22 05:31:16', 'info'),
(130, 'PAGE_VIEW', 'Navigated from / to /profile', '2026-05-22 05:31:38', '2026-05-22 05:31:38', 'info'),
(131, 'PAGE_VIEW', 'Navigated from / to /profile', '2026-05-22 05:35:18', '2026-05-22 05:35:18', 'info'),
(132, 'PAGE_VIEW', 'Navigated from /profile to /rumah123', '2026-05-22 05:35:19', '2026-05-22 05:35:19', 'info'),
(133, 'PAGE_VIEW', 'Navigated from /rumah123 to /profile', '2026-05-22 05:35:21', '2026-05-22 05:35:21', 'info'),
(134, 'PAGE_VIEW', 'Navigated from / to /profile', '2026-05-22 05:37:29', '2026-05-22 05:37:29', 'info'),
(135, 'PAGE_VIEW', 'Navigated from / to /profile', '2026-05-22 05:41:45', '2026-05-22 05:41:45', 'info'),
(136, 'PAGE_VIEW', 'Navigated from /profile to /rumah123', '2026-05-22 05:43:42', '2026-05-22 05:43:42', 'info'),
(137, 'PAGE_VIEW', 'Navigated from /rumah123 to /rumah123', '2026-05-22 05:46:43', '2026-05-22 05:46:43', 'info'),
(138, 'PAGE_VIEW', 'Navigated from /rumah123 to /rumah123', '2026-05-22 05:46:44', '2026-05-22 05:46:44', 'info'),
(139, 'PAGE_VIEW', 'Navigated from / to /rumah123', '2026-05-22 05:46:50', '2026-05-22 05:46:50', 'info'),
(140, 'PAGE_VIEW', 'Navigated from /rumah123 to /profile', '2026-05-22 05:46:54', '2026-05-22 05:46:54', 'info'),
(141, 'PAGE_VIEW', 'Navigated from / to /profile', '2026-05-22 05:56:51', '2026-05-22 05:56:51', 'info'),
(142, 'PAGE_VIEW', 'Navigated from / to /profile', '2026-05-22 06:03:14', '2026-05-22 06:03:14', 'info'),
(143, 'PAGE_VIEW', 'Navigated from /profile to /login', '2026-05-22 06:06:03', '2026-05-22 06:06:03', 'info'),
(144, 'PAGE_VIEW', 'Navigated from / to /login', '2026-05-22 06:06:16', '2026-05-22 06:06:16', 'info'),
(145, 'PAGE_VIEW', 'Navigated from / to /about', '2026-05-22 06:36:14', '2026-05-22 06:36:14', 'info'),
(146, 'FILTER_DATA', '{\"buildingType\":\"\",\"transactionType\":\"rent\",\"location\":\"\"}', '2026-05-22 06:36:23', '2026-05-22 06:36:23', 'info'),
(147, 'FILTER_DATA', '{\"buildingType\":\"store\",\"transactionType\":\"rent\",\"location\":\"\"}', '2026-05-22 06:36:25', '2026-05-22 06:36:25', 'info'),
(148, 'FILTER_DATA', '{\"buildingType\":\"warehouse\",\"transactionType\":\"rent\",\"location\":\"\"}', '2026-05-22 06:36:32', '2026-05-22 06:36:32', 'info'),
(149, 'FILTER_DATA', '{\"buildingType\":\"warehouse\",\"transactionType\":\"sale\",\"location\":\"\"}', '2026-05-22 06:36:35', '2026-05-22 06:36:35', 'info'),
(150, 'FILTER_DATA', '{\"buildingType\":\"warehouse\",\"transactionType\":\"rent\",\"location\":\"\"}', '2026-05-22 06:36:36', '2026-05-22 06:36:36', 'info'),
(151, 'FILTER_DATA', '{\"buildingType\":\"warehouse\",\"transactionType\":\"purchase\",\"location\":\"\"}', '2026-05-22 06:36:38', '2026-05-22 06:36:38', 'info'),
(152, 'FILTER_DATA', '{\"buildingType\":\"warehouse\",\"transactionType\":\"sale\",\"location\":\"\"}', '2026-05-22 06:36:39', '2026-05-22 06:36:39', 'info'),
(153, 'FILTER_DATA', '{\"buildingType\":\"warehouse\",\"transactionType\":\"rent\",\"location\":\"\"}', '2026-05-22 06:36:41', '2026-05-22 06:36:41', 'info'),
(154, 'FILTER_DATA', '{\"buildingType\":\"office\",\"transactionType\":\"rent\",\"location\":\"\"}', '2026-05-22 06:36:43', '2026-05-22 06:36:43', 'info'),
(155, 'FILTER_DATA', '{\"buildingType\":\"office\",\"transactionType\":\"sale\",\"location\":\"\"}', '2026-05-22 06:36:45', '2026-05-22 06:36:45', 'info'),
(156, 'FILTER_DATA', '{\"buildingType\":\"office\",\"transactionType\":\"purchase\",\"location\":\"\"}', '2026-05-22 06:36:46', '2026-05-22 06:36:46', 'info'),
(157, 'FILTER_DATA', '{\"buildingType\":\"office\",\"transactionType\":\"sale\",\"location\":\"\"}', '2026-05-22 06:36:48', '2026-05-22 06:36:48', 'info'),
(158, 'FILTER_DATA', '{\"buildingType\":\"office\",\"transactionType\":\"\",\"location\":\"\"}', '2026-05-22 06:36:49', '2026-05-22 06:36:49', 'info'),
(159, 'PAGE_VIEW', 'Navigated from /about to /rumah123', '2026-05-22 08:08:08', '2026-05-22 08:08:08', 'info'),
(160, 'PAGE_VIEW', 'Navigated from / to /', '2026-05-25 03:09:27', '2026-05-25 03:09:27', 'info'),
(161, 'PAGE_VIEW', 'Navigated from / to /', '2026-05-25 03:13:55', '2026-05-25 03:13:55', 'info'),
(162, 'PAGE_VIEW', 'Navigated from / to /', '2026-05-25 03:14:14', '2026-05-25 03:14:14', 'info'),
(163, 'PAGE_VIEW', 'Navigated from / to /', '2026-05-25 03:15:22', '2026-05-25 03:15:22', 'info'),
(164, 'PAGE_VIEW', 'Navigated from / to /rumah123', '2026-05-25 03:15:41', '2026-05-25 03:15:41', 'info'),
(165, 'PAGE_VIEW', 'Navigated from /rumah123 to /login', '2026-05-25 03:15:52', '2026-05-25 03:15:52', 'info'),
(166, 'PAGE_VIEW', 'Navigated from /login to /login', '2026-05-25 03:16:50', '2026-05-25 03:16:50', 'info'),
(167, 'PAGE_VIEW', 'Navigated from /login to /rumah123', '2026-05-25 03:16:53', '2026-05-25 03:16:53', 'info'),
(168, 'PAGE_VIEW', 'Navigated from /rumah123 to /profile', '2026-05-25 03:16:58', '2026-05-25 03:16:58', 'info'),
(169, 'PAGE_VIEW', 'Navigated from / to /', '2026-05-25 10:04:29', '2026-05-25 10:04:29', 'info'),
(170, 'PAGE_VIEW', 'Navigated from / to /', '2026-05-25 10:04:39', '2026-05-25 10:04:39', 'info'),
(171, 'PAGE_VIEW', 'Navigated from / to /login', '2026-05-25 10:04:42', '2026-05-25 10:04:42', 'info'),
(172, 'PAGE_VIEW', 'Navigated from /login to /register', '2026-05-25 10:04:46', '2026-05-25 10:04:46', 'info'),
(173, 'PAGE_VIEW', 'Navigated from /register to /login', '2026-05-25 10:05:36', '2026-05-25 10:05:36', 'info'),
(174, 'PAGE_VIEW', 'Navigated from /login to /login', '2026-05-25 10:05:39', '2026-05-25 10:05:39', 'info'),
(175, 'PAGE_VIEW', 'Navigated from /login to /', '2026-05-25 10:05:46', '2026-05-25 10:05:46', 'info'),
(176, 'PAGE_VIEW', 'Navigated from / to /rumah123', '2026-05-25 10:06:11', '2026-05-25 10:06:11', 'info'),
(177, 'PAGE_VIEW', 'Navigated from /rumah123 to /profile', '2026-05-25 10:09:23', '2026-05-25 10:09:23', 'info'),
(178, 'PAGE_VIEW', 'Navigated from /profile to /login', '2026-05-25 10:09:50', '2026-05-25 10:09:50', 'info'),
(179, 'PAGE_VIEW', 'Navigated from /login to /', '2026-05-25 10:10:17', '2026-05-25 10:10:17', 'info'),
(180, 'PAGE_VIEW', 'Navigated from / to /rumah123', '2026-05-25 10:10:19', '2026-05-25 10:10:19', 'info'),
(181, 'PAGE_VIEW', 'Navigated from / to /', '2026-05-26 01:55:34', '2026-05-26 01:55:34', 'info'),
(182, 'PAGE_VIEW', 'Navigated from / to /login', '2026-05-26 01:55:39', '2026-05-26 01:55:39', 'info'),
(183, 'PAGE_VIEW', 'Navigated from /login to /login', '2026-05-26 01:55:42', '2026-05-26 01:55:42', 'info'),
(184, 'PAGE_VIEW', 'Navigated from /login to /register', '2026-05-26 01:55:43', '2026-05-26 01:55:43', 'info'),
(185, 'PAGE_VIEW', 'Navigated from /register to /login', '2026-05-26 01:56:31', '2026-05-26 01:56:31', 'info'),
(186, 'PAGE_VIEW', 'Navigated from /login to /register', '2026-05-26 01:56:33', '2026-05-26 01:56:33', 'info'),
(187, 'PAGE_VIEW', 'Navigated from /register to /login', '2026-05-26 01:57:23', '2026-05-26 01:57:23', 'info'),
(188, 'PAGE_VIEW', 'Navigated from /login to /register', '2026-05-26 01:57:55', '2026-05-26 01:57:55', 'info'),
(189, 'PAGE_VIEW', 'Navigated from /register to /login', '2026-05-26 01:58:50', '2026-05-26 01:58:50', 'info'),
(190, 'PAGE_VIEW', 'Navigated from /login to /', '2026-05-26 01:58:55', '2026-05-26 01:58:55', 'info'),
(191, 'PAGE_VIEW', 'Navigated from / to /login', '2026-05-26 03:17:07', '2026-05-26 03:17:07', 'info'),
(192, 'PAGE_VIEW', 'Navigated from /login to /register', '2026-05-26 03:17:13', '2026-05-26 03:17:13', 'info'),
(193, 'PAGE_VIEW', 'Navigated from /register to /login', '2026-05-26 03:18:18', '2026-05-26 03:18:18', 'info'),
(194, 'PAGE_VIEW', 'Navigated from / to /', '2026-05-29 06:58:12', '2026-05-29 06:58:12', 'info'),
(195, 'PAGE_VIEW', 'Navigated from / to /login', '2026-05-29 06:58:18', '2026-05-29 06:58:18', 'info'),
(196, 'PAGE_VIEW', 'Navigated from /login to /', '2026-05-29 06:58:24', '2026-05-29 06:58:24', 'info'),
(197, 'PAGE_VIEW', 'Navigated from / to /profile', '2026-05-29 06:58:28', '2026-05-29 06:58:28', 'info'),
(198, 'PAGE_VIEW', 'Navigated from / to /profile', '2026-05-29 07:12:05', '2026-05-29 07:12:05', 'info'),
(199, 'PAGE_VIEW', 'Navigated from / to /', '2026-06-03 02:54:57', '2026-06-03 02:54:57', 'info'),
(200, 'PAGE_VIEW', 'Navigated from / to /', '2026-06-03 02:55:13', '2026-06-03 02:55:13', 'info'),
(201, 'PAGE_VIEW', 'Navigated from / to /', '2026-06-03 03:04:24', '2026-06-03 03:04:24', 'info'),
(202, 'PAGE_VIEW', 'Navigated from / to /', '2026-06-03 03:04:26', '2026-06-03 03:04:26', 'info'),
(203, 'PAGE_VIEW', 'Navigated from / to /', '2026-06-03 03:07:37', '2026-06-03 03:07:37', 'info'),
(204, 'PAGE_VIEW', 'Navigated from / to /', '2026-06-04 03:10:49', '2026-06-04 03:10:49', 'info'),
(205, 'PAGE_VIEW', 'Navigated from / to /login', '2026-06-04 03:10:59', '2026-06-04 03:10:59', 'info'),
(206, 'PAGE_VIEW', 'Navigated from /login to /login', '2026-06-04 06:34:54', '2026-06-04 06:34:54', 'info'),
(207, 'PAGE_VIEW', 'Navigated from / to /login', '2026-06-04 06:35:19', '2026-06-04 06:35:19', 'info'),
(208, 'PAGE_VIEW', 'Navigated from /login to /', '2026-06-04 06:35:32', '2026-06-04 06:35:32', 'info'),
(209, 'PAGE_VIEW', 'Navigated from / to /profile', '2026-06-04 06:35:35', '2026-06-04 06:35:35', 'info'),
(210, 'PAGE_VIEW', 'Navigated from / to /', '2026-06-05 02:37:53', '2026-06-05 02:37:53', 'info'),
(211, 'PAGE_VIEW', 'Navigated from / to /', '2026-06-05 02:38:05', '2026-06-05 02:38:05', 'info'),
(212, 'PAGE_VIEW', 'Navigated from / to /login', '2026-06-05 02:45:16', '2026-06-05 02:45:16', 'info'),
(213, 'PAGE_VIEW', 'Navigated from /login to /', '2026-06-05 02:45:29', '2026-06-05 02:45:29', 'info'),
(214, 'PAGE_VIEW', 'Navigated from / to /profile', '2026-06-05 02:45:41', '2026-06-05 02:45:41', 'info'),
(215, 'PAGE_VIEW', 'Navigated from /profile to /rumah123', '2026-06-05 02:46:13', '2026-06-05 02:46:13', 'info'),
(216, 'PAGE_VIEW', 'Navigated from /rumah123 to /login', '2026-06-05 02:46:19', '2026-06-05 02:46:19', 'info'),
(217, 'PAGE_VIEW', 'Navigated from /login to /rumah123', '2026-06-05 02:46:20', '2026-06-05 02:46:20', 'info'),
(218, 'PAGE_VIEW', 'Navigated from /rumah123 to /contact', '2026-06-05 02:46:27', '2026-06-05 02:46:27', 'info'),
(219, 'PAGE_VIEW', 'Navigated from / to /contact', '2026-06-05 07:09:25', '2026-06-05 07:09:25', 'info'),
(220, 'PAGE_VIEW', 'Navigated from / to /contact', '2026-06-05 07:41:58', '2026-06-05 07:41:58', 'info'),
(221, 'PAGE_VIEW', 'Navigated from /contact to /login', '2026-06-05 07:50:03', '2026-06-05 07:50:03', 'info'),
(222, 'PAGE_VIEW', 'Navigated from /login to /', '2026-06-05 07:50:11', '2026-06-05 07:50:11', 'info'),
(223, 'PAGE_VIEW', 'Navigated from / to /facility', '2026-06-05 07:50:11', '2026-06-05 07:50:11', 'info'),
(224, 'PAGE_VIEW', 'Navigated from / to /facility', '2026-06-05 07:50:23', '2026-06-05 07:50:23', 'info'),
(225, 'PAGE_VIEW', 'Navigated from /facility to /facility/add', '2026-06-05 07:50:56', '2026-06-05 07:50:56', 'info'),
(226, 'PAGE_VIEW', 'Navigated from /facility/add to /facility', '2026-06-05 07:50:58', '2026-06-05 07:50:58', 'info'),
(227, 'PAGE_VIEW', 'Navigated from / to /facility', '2026-06-05 07:52:46', '2026-06-05 07:52:46', 'info'),
(228, 'PAGE_VIEW', 'Navigated from / to /facility', '2026-06-05 07:52:58', '2026-06-05 07:52:58', 'info'),
(229, 'PAGE_VIEW', 'Navigated from /facility to /rumah123', '2026-06-05 07:53:13', '2026-06-05 07:53:13', 'info'),
(230, 'PAGE_VIEW', 'Navigated from /rumah123 to /facility', '2026-06-05 07:53:14', '2026-06-05 07:53:14', 'info'),
(231, 'PAGE_VIEW', 'Navigated from / to /facility', '2026-06-05 07:53:19', '2026-06-05 07:53:19', 'info'),
(232, 'PAGE_VIEW', 'Navigated from /facility to /facility/add', '2026-06-05 07:55:44', '2026-06-05 07:55:44', 'info'),
(233, 'PAGE_VIEW', 'Navigated from / to /login', '2026-06-05 07:55:47', '2026-06-05 07:55:47', 'info'),
(234, 'PAGE_VIEW', 'Navigated from /login to /', '2026-06-05 07:55:56', '2026-06-05 07:55:56', 'info'),
(235, 'PAGE_VIEW', 'Navigated from / to /facility', '2026-06-05 07:55:57', '2026-06-05 07:55:57', 'info'),
(236, 'PAGE_VIEW', 'Navigated from /facility to /facility/add', '2026-06-05 07:55:58', '2026-06-05 07:55:58', 'info'),
(237, 'PAGE_VIEW', 'Navigated from /facility/add to /facility', '2026-06-05 07:56:58', '2026-06-05 07:56:58', 'info'),
(238, 'PAGE_VIEW', 'Navigated from / to /facility', '2026-06-05 08:12:32', '2026-06-05 08:12:32', 'info'),
(239, 'PAGE_VIEW', 'Navigated from / to /login', '2026-06-05 08:12:35', '2026-06-05 08:12:35', 'info'),
(240, 'PAGE_VIEW', 'Navigated from /login to /', '2026-06-05 08:12:59', '2026-06-05 08:12:59', 'info'),
(241, 'PAGE_VIEW', 'Navigated from / to /facility', '2026-06-05 08:13:00', '2026-06-05 08:13:00', 'info'),
(242, 'PAGE_VIEW', 'Navigated from /facility to /facility/add', '2026-06-05 08:13:02', '2026-06-05 08:13:02', 'info'),
(243, 'PAGE_VIEW', 'Navigated from / to /', '2026-06-08 01:42:55', '2026-06-08 01:42:55', 'info'),
(244, 'PAGE_VIEW', 'Navigated from / to /', '2026-06-08 01:43:07', '2026-06-08 01:43:07', 'info'),
(245, 'PAGE_VIEW', 'Navigated from / to /facility', '2026-06-08 01:43:18', '2026-06-08 01:43:18', 'info'),
(246, 'PAGE_VIEW', 'Navigated from / to /login', '2026-06-08 01:43:20', '2026-06-08 01:43:20', 'info'),
(247, 'PAGE_VIEW', 'Navigated from /login to /', '2026-06-08 01:43:25', '2026-06-08 01:43:25', 'info'),
(248, 'PAGE_VIEW', 'Navigated from / to /about', '2026-06-08 01:43:32', '2026-06-08 01:43:32', 'info'),
(249, 'PAGE_VIEW', 'Navigated from /about to /contact', '2026-06-08 01:43:38', '2026-06-08 01:43:38', 'info'),
(250, 'PAGE_VIEW', 'Navigated from /contact to /rumah123', '2026-06-08 01:43:47', '2026-06-08 01:43:47', 'info'),
(251, 'PAGE_VIEW', 'Navigated from /rumah123 to /contact', '2026-06-08 01:43:50', '2026-06-08 01:43:50', 'info'),
(252, 'PAGE_VIEW', 'Navigated from /contact to /rumah123', '2026-06-08 01:43:51', '2026-06-08 01:43:51', 'info'),
(253, 'PAGE_VIEW', 'Navigated from /rumah123 to /register', '2026-06-08 01:43:55', '2026-06-08 01:43:55', 'info'),
(254, 'PAGE_VIEW', 'Navigated from /register to /login', '2026-06-08 01:44:05', '2026-06-08 01:44:05', 'info'),
(255, 'PAGE_VIEW', 'Navigated from /login to /', '2026-06-08 01:44:15', '2026-06-08 01:44:15', 'info'),
(256, 'PAGE_VIEW', 'Navigated from / to /rumah123', '2026-06-08 01:44:18', '2026-06-08 01:44:18', 'info'),
(257, 'PAGE_VIEW', 'Navigated from /rumah123 to /', '2026-06-08 01:44:20', '2026-06-08 01:44:20', 'info'),
(258, 'PAGE_VIEW', 'Navigated from / to /contact', '2026-06-08 01:44:21', '2026-06-08 01:44:21', 'info'),
(259, 'PAGE_VIEW', 'Navigated from /contact to /', '2026-06-08 01:44:26', '2026-06-08 01:44:26', 'info'),
(260, 'PAGE_VIEW', 'Navigated from / to /contact', '2026-06-08 01:44:33', '2026-06-08 01:44:33', 'info'),
(261, 'PAGE_VIEW', 'Navigated from /contact to /', '2026-06-08 01:44:35', '2026-06-08 01:44:35', 'info'),
(262, 'PAGE_VIEW', 'Navigated from / to /', '2026-06-08 01:53:22', '2026-06-08 01:53:22', 'info'),
(263, 'PAGE_VIEW', 'Navigated from / to /profile', '2026-06-08 01:53:37', '2026-06-08 01:53:37', 'info'),
(264, 'PAGE_VIEW', 'Navigated from /profile to /facility', '2026-06-08 01:53:54', '2026-06-08 01:53:54', 'info'),
(265, 'PAGE_VIEW', 'Navigated from / to /login', '2026-06-08 01:53:57', '2026-06-08 01:53:57', 'info'),
(266, 'PAGE_VIEW', 'Navigated from /login to /login', '2026-06-08 01:53:59', '2026-06-08 01:53:59', 'info'),
(267, 'PAGE_VIEW', 'Navigated from /login to /login', '2026-06-08 01:54:01', '2026-06-08 01:54:01', 'info'),
(268, 'PAGE_VIEW', 'Navigated from /login to /', '2026-06-08 01:54:09', '2026-06-08 01:54:09', 'info'),
(269, 'PAGE_VIEW', 'Navigated from / to /rumah123', '2026-06-08 01:54:32', '2026-06-08 01:54:32', 'info'),
(270, 'PAGE_VIEW', 'Navigated from /rumah123 to /facility', '2026-06-08 01:54:33', '2026-06-08 01:54:33', 'info'),
(271, 'PAGE_VIEW', 'Navigated from / to /', '2026-06-08 02:08:00', '2026-06-08 02:08:00', 'info'),
(272, 'PAGE_VIEW', 'Navigated from / to /facility', '2026-06-08 02:08:09', '2026-06-08 02:08:09', 'info'),
(273, 'PAGE_VIEW', 'Navigated from / to /login', '2026-06-08 02:08:11', '2026-06-08 02:08:11', 'info'),
(274, 'PAGE_VIEW', 'Navigated from /login to /register', '2026-06-08 02:08:14', '2026-06-08 02:08:14', 'info'),
(275, 'PAGE_VIEW', 'Navigated from /register to /login', '2026-06-08 02:08:25', '2026-06-08 02:08:25', 'info'),
(276, 'PAGE_VIEW', 'Navigated from /login to /', '2026-06-08 02:08:45', '2026-06-08 02:08:45', 'info'),
(277, 'PAGE_VIEW', 'Navigated from / to /profile', '2026-06-08 02:08:49', '2026-06-08 02:08:49', 'info'),
(278, 'PAGE_VIEW', 'Navigated from / to /', '2026-06-08 02:59:16', '2026-06-08 02:59:16', 'info'),
(279, 'PAGE_VIEW', 'Navigated from / to /', '2026-06-08 02:59:30', '2026-06-08 02:59:30', 'info'),
(280, 'PAGE_VIEW', 'Navigated from / to /', '2026-06-17 06:53:36', '2026-06-17 06:53:36', 'info'),
(281, 'PAGE_VIEW', 'Navigated from / to /rumah123', '2026-06-17 06:53:43', '2026-06-17 06:53:43', 'info'),
(282, 'PAGE_VIEW', 'Navigated from /rumah123 to /facility', '2026-06-17 06:53:47', '2026-06-17 06:53:47', 'info'),
(283, 'PAGE_VIEW', 'Navigated from / to /login', '2026-06-17 06:53:50', '2026-06-17 06:53:50', 'info'),
(284, 'PAGE_VIEW', 'Navigated from /login to /login', '2026-06-17 06:53:52', '2026-06-17 06:53:52', 'info'),
(285, 'PAGE_VIEW', 'Navigated from /login to /', '2026-06-17 07:00:56', '2026-06-17 07:00:56', 'info'),
(286, 'PAGE_VIEW', 'Navigated from / to /profile', '2026-06-17 07:00:59', '2026-06-17 07:00:59', 'info'),
(287, 'PAGE_VIEW', 'Navigated from / to /', '2026-06-19 04:32:43', '2026-06-19 04:32:43', 'info'),
(288, 'PAGE_VIEW', 'Navigated from / to /profile', '2026-06-19 04:32:53', '2026-06-19 04:32:53', 'info'),
(289, 'PAGE_VIEW', 'Navigated from /profile to /', '2026-06-19 04:32:55', '2026-06-19 04:32:55', 'info'),
(290, 'PAGE_VIEW', 'Navigated from / to /login', '2026-06-19 04:33:00', '2026-06-19 04:33:00', 'info'),
(291, 'PAGE_VIEW', 'Navigated from /login to /login', '2026-06-19 04:33:03', '2026-06-19 04:33:03', 'info'),
(292, 'PAGE_VIEW', 'Navigated from /login to /', '2026-06-19 04:33:10', '2026-06-19 04:33:10', 'info'),
(293, 'PAGE_VIEW', 'Navigated from / to /facility', '2026-06-19 04:33:12', '2026-06-19 04:33:12', 'info'),
(294, 'PAGE_VIEW', 'Navigated from /facility to /facility/add', '2026-06-19 04:33:19', '2026-06-19 04:33:19', 'info'),
(295, 'PAGE_VIEW', 'Navigated from / to /facility/add', '2026-06-19 06:02:22', '2026-06-19 06:02:22', 'info'),
(296, 'PAGE_VIEW', 'Navigated from / to /login', '2026-06-19 06:05:58', '2026-06-19 06:05:58', 'info'),
(297, 'PAGE_VIEW', 'Navigated from /login to /login', '2026-06-19 06:05:59', '2026-06-19 06:05:59', 'info'),
(298, 'PAGE_VIEW', 'Navigated from /login to /', '2026-06-19 06:06:05', '2026-06-19 06:06:05', 'info'),
(299, 'PAGE_VIEW', 'Navigated from / to /facility', '2026-06-19 06:06:06', '2026-06-19 06:06:06', 'info'),
(300, 'PAGE_VIEW', 'Navigated from /facility to /facility/add', '2026-06-19 06:06:07', '2026-06-19 06:06:07', 'info'),
(301, 'PAGE_VIEW', 'Navigated from /facility/add to /facility', '2026-06-19 06:06:12', '2026-06-19 06:06:12', 'info'),
(302, 'PAGE_VIEW', 'Navigated from /facility to /facility/add', '2026-06-19 06:06:27', '2026-06-19 06:06:27', 'info'),
(303, 'PAGE_VIEW', 'Navigated from /facility/add to /facility', '2026-06-19 06:06:43', '2026-06-19 06:06:43', 'info'),
(304, 'PAGE_VIEW', 'Navigated from /facility to /facility/add', '2026-06-19 06:06:45', '2026-06-19 06:06:45', 'info'),
(305, 'PAGE_VIEW', 'Navigated from /facility/add to /facility', '2026-06-19 06:06:55', '2026-06-19 06:06:55', 'info'),
(306, 'PAGE_VIEW', 'Navigated from /facility to /facility/edit/PMWJO48003', '2026-06-19 06:08:27', '2026-06-19 06:08:27', 'info'),
(307, 'PAGE_VIEW', 'Navigated from /facility/edit/PMWJO48003 to /facility', '2026-06-19 06:09:13', '2026-06-19 06:09:13', 'info'),
(308, 'PAGE_VIEW', 'Navigated from /facility to /rumah123', '2026-06-19 06:13:41', '2026-06-19 06:13:41', 'info'),
(309, 'PAGE_VIEW', 'Navigated from /rumah123 to /facility', '2026-06-19 06:13:43', '2026-06-19 06:13:43', 'info'),
(310, 'PAGE_VIEW', 'Navigated from / to /login', '2026-06-19 06:13:45', '2026-06-19 06:13:45', 'info'),
(311, 'PAGE_VIEW', 'Navigated from /login to /', '2026-06-19 06:13:50', '2026-06-19 06:13:50', 'info'),
(312, 'PAGE_VIEW', 'Navigated from / to /facility', '2026-06-19 06:13:51', '2026-06-19 06:13:51', 'info'),
(313, 'PAGE_VIEW', 'Navigated from / to /facility', '2026-06-19 06:35:19', '2026-06-19 06:35:19', 'info'),
(314, 'PAGE_VIEW', 'Navigated from / to /login', '2026-06-19 06:35:21', '2026-06-19 06:35:21', 'info'),
(315, 'PAGE_VIEW', 'Navigated from /login to /', '2026-06-19 06:35:25', '2026-06-19 06:35:25', 'info'),
(316, 'PAGE_VIEW', 'Navigated from / to /facility', '2026-06-19 06:35:27', '2026-06-19 06:35:27', 'info'),
(317, 'PAGE_VIEW', 'Navigated from / to /facility', '2026-06-19 06:36:42', '2026-06-19 06:36:42', 'info'),
(318, 'PAGE_VIEW', 'Navigated from / to /facility', '2026-06-19 06:36:56', '2026-06-19 06:36:56', 'info'),
(319, 'PAGE_VIEW', 'Navigated from / to /facility', '2026-06-19 06:38:01', '2026-06-19 06:38:01', 'info'),
(320, 'PAGE_VIEW', 'Navigated from / to /facility', '2026-06-19 06:39:06', '2026-06-19 06:39:06', 'info'),
(321, 'PAGE_VIEW', 'Navigated from / to /facility', '2026-06-19 06:39:24', '2026-06-19 06:39:24', 'info'),
(322, 'PAGE_VIEW', 'Navigated from / to /login', '2026-06-19 06:54:06', '2026-06-19 06:54:06', 'info'),
(323, 'PAGE_VIEW', 'Navigated from /login to /', '2026-06-19 06:58:24', '2026-06-19 06:58:24', 'info'),
(324, 'PAGE_VIEW', 'Navigated from / to /facility', '2026-06-19 06:58:24', '2026-06-19 06:58:24', 'info'),
(325, 'PAGE_VIEW', 'Navigated from / to /', '2026-06-25 04:56:27', '2026-06-25 04:56:27', 'info'),
(326, 'PAGE_VIEW', 'Navigated from / to /', '2026-06-25 04:56:34', '2026-06-25 04:56:34', 'info'),
(327, 'PAGE_VIEW', 'Navigated from / to /profile', '2026-06-25 04:56:36', '2026-06-25 04:56:36', 'info'),
(328, 'PAGE_VIEW', 'Navigated from /profile to /', '2026-06-25 04:56:38', '2026-06-25 04:56:38', 'info'),
(329, 'PAGE_VIEW', 'Navigated from / to /profile', '2026-06-25 04:56:44', '2026-06-25 04:56:44', 'info'),
(330, 'PAGE_VIEW', 'Navigated from /profile to /', '2026-06-25 04:56:46', '2026-06-25 04:56:46', 'info'),
(331, 'PAGE_VIEW', 'Navigated from / to /facility', '2026-06-25 04:56:51', '2026-06-25 04:56:51', 'info'),
(332, 'PAGE_VIEW', 'Navigated from / to /login', '2026-06-25 04:56:53', '2026-06-25 04:56:53', 'info'),
(333, 'PAGE_VIEW', 'Navigated from /login to /', '2026-06-25 04:56:58', '2026-06-25 04:56:58', 'info'),
(334, 'PAGE_VIEW', 'Navigated from / to /profile', '2026-06-25 04:57:56', '2026-06-25 04:57:56', 'info'),
(335, 'PAGE_VIEW', 'Navigated from /profile to /facility', '2026-06-25 04:58:54', '2026-06-25 04:58:54', 'info'),
(336, 'PAGE_VIEW', 'Navigated from /facility to /facility/edit/ACZKE0T001', '2026-06-25 04:59:08', '2026-06-25 04:59:08', 'info'),
(337, 'PAGE_VIEW', 'Navigated from /facility/edit/ACZKE0T001 to /facility', '2026-06-25 05:06:10', '2026-06-25 05:06:10', 'info'),
(338, 'PAGE_VIEW', 'Navigated from /facility to /facility', '2026-06-25 05:06:11', '2026-06-25 05:06:11', 'info'),
(339, 'PAGE_VIEW', 'Navigated from / to /facility', '2026-06-25 05:06:15', '2026-06-25 05:06:15', 'info'),
(340, 'PAGE_VIEW', 'Navigated from / to /login', '2026-06-25 05:06:17', '2026-06-25 05:06:17', 'info'),
(341, 'PAGE_VIEW', 'Navigated from /login to /login', '2026-06-25 05:06:18', '2026-06-25 05:06:18', 'info'),
(342, 'PAGE_VIEW', 'Navigated from /login to /', '2026-06-25 05:06:22', '2026-06-25 05:06:22', 'info'),
(343, 'PAGE_VIEW', 'Navigated from / to /facility', '2026-06-25 05:06:23', '2026-06-25 05:06:23', 'info'),
(344, 'PAGE_VIEW', 'Navigated from / to /facility', '2026-06-25 06:14:21', '2026-06-25 06:14:21', 'info'),
(345, 'PAGE_VIEW', 'Navigated from / to /login', '2026-06-25 06:14:23', '2026-06-25 06:14:23', 'info'),
(346, 'PAGE_VIEW', 'Navigated from /login to /', '2026-06-25 06:14:31', '2026-06-25 06:14:31', 'info'),
(347, 'PAGE_VIEW', 'Navigated from / to /facility', '2026-06-25 06:14:32', '2026-06-25 06:14:32', 'info'),
(348, 'PAGE_VIEW', 'Navigated from / to /facility', '2026-06-25 06:33:54', '2026-06-25 06:33:54', 'info'),
(349, 'PAGE_VIEW', 'Navigated from / to /login', '2026-06-25 06:33:56', '2026-06-25 06:33:56', 'info'),
(350, 'PAGE_VIEW', 'Navigated from /login to /', '2026-06-25 06:33:59', '2026-06-25 06:33:59', 'info'),
(351, 'PAGE_VIEW', 'Navigated from / to /facility', '2026-06-25 06:34:00', '2026-06-25 06:34:00', 'info'),
(352, 'PAGE_VIEW', 'Navigated from /facility to /facility/add', '2026-06-25 06:35:06', '2026-06-25 06:35:06', 'info'),
(353, 'PAGE_VIEW', 'Navigated from /facility/add to /facility', '2026-06-25 06:35:09', '2026-06-25 06:35:09', 'info'),
(354, 'PAGE_VIEW', 'Navigated from /facility to /facility/edit/ACZKE0T001', '2026-06-25 06:35:11', '2026-06-25 06:35:11', 'info'),
(355, 'PAGE_VIEW', 'Navigated from / to /facility/edit/ACZKE0T001', '2026-06-25 06:36:13', '2026-06-25 06:36:13', 'info'),
(356, 'PAGE_VIEW', 'Navigated from /facility/edit/ACZKE0T001 to /facility', '2026-06-25 06:36:15', '2026-06-25 06:36:15', 'info'),
(357, 'PAGE_VIEW', 'Navigated from / to /facility', '2026-06-25 06:38:05', '2026-06-25 06:38:05', 'info'),
(358, 'PAGE_VIEW', 'Navigated from / to /facility', '2026-06-25 06:38:57', '2026-06-25 06:38:57', 'info'),
(359, 'PAGE_VIEW', 'Navigated from / to /facility', '2026-06-25 06:40:26', '2026-06-25 06:40:26', 'info'),
(360, 'PAGE_VIEW', 'Navigated from / to /login', '2026-06-25 06:40:28', '2026-06-25 06:40:28', 'info'),
(361, 'PAGE_VIEW', 'Navigated from /login to /', '2026-06-25 06:40:46', '2026-06-25 06:40:46', 'info'),
(362, 'PAGE_VIEW', 'Navigated from / to /facility', '2026-06-25 06:40:47', '2026-06-25 06:40:47', 'info'),
(363, 'PAGE_VIEW', 'Navigated from / to /facility', '2026-06-25 06:41:42', '2026-06-25 06:41:42', 'info'),
(364, 'PAGE_VIEW', 'Navigated from / to /facility', '2026-06-25 06:49:04', '2026-06-25 06:49:04', 'info'),
(365, 'PAGE_VIEW', 'Navigated from / to /login', '2026-06-25 06:49:06', '2026-06-25 06:49:06', 'info'),
(366, 'PAGE_VIEW', 'Navigated from /login to /', '2026-06-25 06:49:17', '2026-06-25 06:49:17', 'info'),
(367, 'PAGE_VIEW', 'Navigated from / to /facility', '2026-06-25 06:49:17', '2026-06-25 06:49:17', 'info'),
(368, 'PAGE_VIEW', 'Navigated from / to /facility', '2026-06-25 06:50:32', '2026-06-25 06:50:32', 'info'),
(369, 'PAGE_VIEW', 'Navigated from /facility to /facility/edit/ACZKE0T001', '2026-06-25 06:50:35', '2026-06-25 06:50:35', 'info'),
(370, 'PAGE_VIEW', 'Navigated from /facility/edit/ACZKE0T001 to /facility', '2026-06-25 06:50:37', '2026-06-25 06:50:37', 'info'),
(371, 'PAGE_VIEW', 'Navigated from / to /facility', '2026-06-25 06:51:15', '2026-06-25 06:51:15', 'info'),
(372, 'PAGE_VIEW', 'Navigated from / to /facility', '2026-06-25 06:51:32', '2026-06-25 06:51:32', 'info'),
(373, 'PAGE_VIEW', 'Navigated from / to /login', '2026-06-25 06:58:34', '2026-06-25 06:58:34', 'info'),
(374, 'PAGE_VIEW', 'Navigated from /login to /', '2026-06-25 06:58:39', '2026-06-25 06:58:39', 'info'),
(375, 'PAGE_VIEW', 'Navigated from / to /facility', '2026-06-25 06:58:40', '2026-06-25 06:58:40', 'info'),
(376, 'PAGE_VIEW', 'Navigated from /facility to /facility/add', '2026-06-25 07:04:17', '2026-06-25 07:04:17', 'info'),
(377, 'PAGE_VIEW', 'Navigated from / to /login', '2026-06-25 07:04:38', '2026-06-25 07:04:38', 'info'),
(378, 'PAGE_VIEW', 'Navigated from /login to /', '2026-06-25 07:04:49', '2026-06-25 07:04:49', 'info'),
(379, 'PAGE_VIEW', 'Navigated from / to /facility', '2026-06-25 07:04:51', '2026-06-25 07:04:51', 'info'),
(380, 'PAGE_VIEW', 'Navigated from /facility to /facility/add', '2026-06-25 07:04:53', '2026-06-25 07:04:53', 'info'),
(381, 'PAGE_VIEW', 'Navigated from /facility/add to /facility', '2026-06-25 07:05:02', '2026-06-25 07:05:02', 'info'),
(382, 'PAGE_VIEW', 'Navigated from /facility to /facility/add', '2026-06-25 07:05:04', '2026-06-25 07:05:04', 'info'),
(383, 'PAGE_VIEW', 'Navigated from / to /facility/add', '2026-06-25 07:06:01', '2026-06-25 07:06:01', 'info'),
(384, 'PAGE_VIEW', 'Navigated from / to /login', '2026-06-25 07:10:22', '2026-06-25 07:10:22', 'info'),
(385, 'PAGE_VIEW', 'Navigated from /login to /', '2026-06-25 07:10:29', '2026-06-25 07:10:29', 'info'),
(386, 'PAGE_VIEW', 'Navigated from / to /facility', '2026-06-25 07:10:30', '2026-06-25 07:10:30', 'info'),
(387, 'PAGE_VIEW', 'Navigated from /facility to /facility/add', '2026-06-25 07:10:33', '2026-06-25 07:10:33', 'info'),
(388, 'PAGE_VIEW', 'Navigated from /facility/add to /facility', '2026-06-25 07:10:40', '2026-06-25 07:10:40', 'info'),
(389, 'PAGE_VIEW', 'Navigated from / to /facility', '2026-06-25 07:12:32', '2026-06-25 07:12:32', 'info'),
(390, 'PAGE_VIEW', 'Navigated from /facility to /facility/add', '2026-06-25 07:12:55', '2026-06-25 07:12:55', 'info'),
(391, 'PAGE_VIEW', 'Navigated from /facility/add to /facility', '2026-06-25 07:13:14', '2026-06-25 07:13:14', 'info'),
(392, 'PAGE_VIEW', 'Navigated from /facility to /facility/add', '2026-06-25 07:13:20', '2026-06-25 07:13:20', 'info'),
(393, 'PAGE_VIEW', 'Navigated from /facility/add to /facility', '2026-06-25 07:16:30', '2026-06-25 07:16:30', 'info'),
(394, 'PAGE_VIEW', 'Navigated from / to /login', '2026-06-25 07:16:32', '2026-06-25 07:16:32', 'info'),
(395, 'PAGE_VIEW', 'Navigated from /login to /', '2026-06-25 07:16:36', '2026-06-25 07:16:36', 'info'),
(396, 'PAGE_VIEW', 'Navigated from / to /facility', '2026-06-25 07:16:37', '2026-06-25 07:16:37', 'info'),
(397, 'PAGE_VIEW', 'Navigated from /facility to /facility/add', '2026-06-25 07:16:47', '2026-06-25 07:16:47', 'info'),
(398, 'PAGE_VIEW', 'Navigated from /facility/add to /facility', '2026-06-25 07:17:04', '2026-06-25 07:17:04', 'info'),
(399, 'PAGE_VIEW', 'Navigated from /facility to /facility/add', '2026-06-25 07:17:06', '2026-06-25 07:17:06', 'info'),
(400, 'PAGE_VIEW', 'Navigated from /facility/add to /facility', '2026-06-25 07:17:13', '2026-06-25 07:17:13', 'info'),
(401, 'PAGE_VIEW', 'Navigated from /facility to /facility/add', '2026-06-25 07:17:16', '2026-06-25 07:17:16', 'info'),
(402, 'PAGE_VIEW', 'Navigated from /facility/add to /facility', '2026-06-25 07:17:26', '2026-06-25 07:17:26', 'info'),
(403, 'PAGE_VIEW', 'Navigated from /facility to /login', '2026-06-25 07:17:43', '2026-06-25 07:17:43', 'info'),
(404, 'PAGE_VIEW', 'Navigated from /login to /', '2026-06-25 07:17:48', '2026-06-25 07:17:48', 'info'),
(405, 'PAGE_VIEW', 'Navigated from / to /facility', '2026-06-25 07:25:43', '2026-06-25 07:25:43', 'info'),
(406, 'PAGE_VIEW', 'Navigated from / to /login', '2026-06-25 07:25:46', '2026-06-25 07:25:46', 'info'),
(407, 'PAGE_VIEW', 'Navigated from /login to /', '2026-06-25 07:25:52', '2026-06-25 07:25:52', 'info'),
(408, 'PAGE_VIEW', 'Navigated from / to /facility', '2026-06-25 07:25:53', '2026-06-25 07:25:53', 'info'),
(409, 'PAGE_VIEW', 'Navigated from /facility to /facility/add', '2026-06-25 07:26:19', '2026-06-25 07:26:19', 'info'),
(410, 'PAGE_VIEW', 'Navigated from /facility/add to /facility', '2026-06-25 07:26:25', '2026-06-25 07:26:25', 'info'),
(411, 'PAGE_VIEW', 'Navigated from /facility to /facility/add', '2026-06-25 07:26:27', '2026-06-25 07:26:27', 'info'),
(412, 'PAGE_VIEW', 'Navigated from /facility/add to /facility', '2026-06-25 07:26:37', '2026-06-25 07:26:37', 'info'),
(413, 'PAGE_VIEW', 'Navigated from /facility to /facility/add', '2026-06-25 07:27:20', '2026-06-25 07:27:20', 'info'),
(414, 'PAGE_VIEW', 'Navigated from /facility/add to /facility', '2026-06-25 07:27:31', '2026-06-25 07:27:31', 'info'),
(415, 'PAGE_VIEW', 'Navigated from /facility to /facility/add', '2026-06-25 07:27:39', '2026-06-25 07:27:39', 'info'),
(416, 'PAGE_VIEW', 'Navigated from /facility/add to /facility', '2026-06-25 07:27:58', '2026-06-25 07:27:58', 'info'),
(417, 'PAGE_VIEW', 'Navigated from /facility to /facility/add', '2026-06-25 07:27:59', '2026-06-25 07:27:59', 'info'),
(418, 'PAGE_VIEW', 'Navigated from /facility/add to /facility', '2026-06-25 07:28:08', '2026-06-25 07:28:08', 'info'),
(419, 'PAGE_VIEW', 'Navigated from /facility to /facility/add', '2026-06-25 07:28:18', '2026-06-25 07:28:18', 'info'),
(420, 'PAGE_VIEW', 'Navigated from /facility/add to /facility', '2026-06-25 07:28:26', '2026-06-25 07:28:26', 'info'),
(421, 'PAGE_VIEW', 'Navigated from /facility to /facility/add', '2026-06-25 07:28:48', '2026-06-25 07:28:48', 'info'),
(422, 'PAGE_VIEW', 'Navigated from /facility/add to /facility', '2026-06-25 07:30:00', '2026-06-25 07:30:00', 'info'),
(423, 'PAGE_VIEW', 'Navigated from /facility to /facility/add', '2026-06-25 07:30:01', '2026-06-25 07:30:01', 'info'),
(424, 'PAGE_VIEW', 'Navigated from /facility/add to /facility', '2026-06-25 07:30:15', '2026-06-25 07:30:15', 'info'),
(425, 'PAGE_VIEW', 'Navigated from /facility to /facility/add', '2026-06-25 07:30:31', '2026-06-25 07:30:31', 'info'),
(426, 'PAGE_VIEW', 'Navigated from / to /login', '2026-06-25 07:31:01', '2026-06-25 07:31:01', 'info'),
(427, 'PAGE_VIEW', 'Navigated from /login to /', '2026-06-25 07:31:07', '2026-06-25 07:31:07', 'info'),
(428, 'PAGE_VIEW', 'Navigated from / to /facility', '2026-06-25 07:31:08', '2026-06-25 07:31:08', 'info'),
(429, 'PAGE_VIEW', 'Navigated from /facility to /facility/add', '2026-06-25 07:31:10', '2026-06-25 07:31:10', 'info'),
(430, 'PAGE_VIEW', 'Navigated from /facility/add to /facility', '2026-06-25 07:31:20', '2026-06-25 07:31:20', 'info'),
(431, 'PAGE_VIEW', 'Navigated from /facility to /facility/edit/ACZKE0T001', '2026-06-25 07:31:23', '2026-06-25 07:31:23', 'info'),
(432, 'PAGE_VIEW', 'Navigated from /facility/edit/ACZKE0T001 to /facility', '2026-06-25 07:31:49', '2026-06-25 07:31:49', 'info'),
(433, 'PAGE_VIEW', 'Navigated from / to /facility', '2026-06-25 07:43:43', '2026-06-25 07:43:43', 'info'),
(434, 'PAGE_VIEW', 'Navigated from / to /login', '2026-06-25 07:43:45', '2026-06-25 07:43:45', 'info'),
(435, 'PAGE_VIEW', 'Navigated from /login to /', '2026-06-25 07:43:52', '2026-06-25 07:43:52', 'info'),
(436, 'PAGE_VIEW', 'Navigated from / to /facility', '2026-06-25 07:43:52', '2026-06-25 07:43:52', 'info'),
(437, 'PAGE_VIEW', 'Navigated from /facility to /facility/add', '2026-06-25 07:44:02', '2026-06-25 07:44:02', 'info'),
(438, 'PAGE_VIEW', 'Navigated from /facility/add to /facility', '2026-06-25 07:44:11', '2026-06-25 07:44:11', 'info');
INSERT INTO `logs` (`id`, `action`, `details`, `createdAt`, `updatedAt`, `level`) VALUES
(439, 'PAGE_VIEW', 'Navigated from /facility to /facility/add', '2026-06-25 07:44:13', '2026-06-25 07:44:13', 'info'),
(440, 'PAGE_VIEW', 'Navigated from /facility/add to /facility', '2026-06-25 07:44:35', '2026-06-25 07:44:35', 'info'),
(441, 'PAGE_VIEW', 'Navigated from /facility to /facility/add', '2026-06-25 07:44:51', '2026-06-25 07:44:51', 'info'),
(442, 'PAGE_VIEW', 'Navigated from /facility/add to /facility', '2026-06-25 07:45:04', '2026-06-25 07:45:04', 'info'),
(443, 'PAGE_VIEW', 'Navigated from /facility to /facility/add', '2026-06-25 07:45:08', '2026-06-25 07:45:08', 'info'),
(444, 'PAGE_VIEW', 'Navigated from /facility/add to /facility', '2026-06-25 07:45:41', '2026-06-25 07:45:41', 'info'),
(445, 'PAGE_VIEW', 'Navigated from /facility to /rumah123', '2026-06-25 07:49:21', '2026-06-25 07:49:21', 'info'),
(446, 'PAGE_VIEW', 'Navigated from /rumah123 to /facility', '2026-06-25 07:49:22', '2026-06-25 07:49:22', 'info'),
(447, 'PAGE_VIEW', 'Navigated from / to /login', '2026-06-25 07:49:24', '2026-06-25 07:49:24', 'info');

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
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `user_id` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `birthdate` date DEFAULT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `username` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `refresh_token` text DEFAULT NULL,
  `updated_date` datetime DEFAULT NULL,
  `update_by` varchar(255) DEFAULT NULL,
  `created_date` datetime DEFAULT NULL,
  `created_by` varchar(255) DEFAULT NULL,
  `status` int(1) NOT NULL DEFAULT 1,
  `privilege` varchar(50) DEFAULT NULL,
  `fonnte_token` varchar(100) DEFAULT NULL COMMENT 'Fonnte token milik agent (untuk kirim WA via Fonnte)',
  `dialog360_token` varchar(200) DEFAULT NULL,
  `chakra_hq_token` varchar(2000) DEFAULT NULL COMMENT 'ChakraHQ Access Token milik agent (Bearer token untuk API ChakraHQ)'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `user_id`, `name`, `birthdate`, `phone`, `username`, `password`, `refresh_token`, `updated_date`, `update_by`, `created_date`, `created_by`, `status`, `privilege`, `fonnte_token`, `dialog360_token`, `chakra_hq_token`) VALUES
(1, 'SA6EDRU001', 'NIGEL KUNCORO', '1998-05-04', '082233556796', 'nigel123', '$2b$10$Rld5zga/CswkKyQPgPi6GO./sa5.OuVwgApiGxbZmCRudUD9TNHD2', NULL, '2026-06-25 07:17:43', 'nigel123', '2026-05-22 03:26:55', 'Self-Register', 1, 'agent', 'm5HDmV4hAYRFBgTdkfDR', NULL, ''),
(2, 'LFGKT49002', 'LEO FELIX', '2000-05-25', '0881036588874', 'leon123', '$2b$10$cFCdDf7g5ZxzPWpLG0WQrOPWbdNGNVfAiWrtfts.f98cg2Ju3bRum', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJMRkdLVDQ5MDAyIiwidXNlck5hbWUiOiJMRU8gRkVMSVgiLCJ1c2VybmFtZSI6Imxlb24xMjMiLCJwcml2aWxlZ2UiOiJhZ2VudCIsImlhdCI6MTc4MjM3MDcxOCwiZXhwIjoxNzgyNDU3MTE4fQ.mKeAdMJtw-wNO7gE-OSEgApDWekJymDZkzuR26hCtKQ', '2026-06-25 06:58:38', 'leon123', '2026-05-25 10:05:33', 'Self-Register', 1, 'agent', 'PiBSZQXu6HKWhKkEDu9e', NULL, 'XGQdHjy2qSr0VFL1k0sDXwULNYt1FNW4RhBsuYcirQJx4a9K4e135lQGaDsyRjyQQTfKRz5BPQfP0kgGK3pJA1CgB8XRd3NFe0masDDYAdQ5WZuEXZcY5A0LxVfRatkAPaVuRa8TEVN3R1PNyv29KgOI3rnHGqnvlhuHnwsjuXOQxPUhZ4dTcgHdohsrMQkzA8RPLr0lR3XmmLk6z7uv6rgv46BLts88YGNE4EOGsmWBw0i3BfEPfXLHNSW9w2J'),
(3, 'CEMPL3Z003', 'CLARENCE MARIO', '1993-03-24', '0821-1136-7154', 'clarence123', '$2b$10$jvnn536K239gxQRcOqNIauJxZxTq9iBcJYLWDstvTItZGkAIsA07e', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJDRU1QTDNaMDAzIiwidXNlck5hbWUiOiJDTEFSRU5DRSBNQVJJTyIsInVzZXJuYW1lIjoiY2xhcmVuY2UxMjMiLCJwcml2aWxlZ2UiOiJhZ2VudCIsImlhdCI6MTc4MjM3MzQzMSwiZXhwIjoxNzgyNDU5ODMxfQ.QZug5EBUMonbUj8xQA6EP7P01j5_8EWr9ZK99KKiGiE', '2026-06-25 07:43:51', 'clarence123', '2026-05-26 01:56:29', 'Self-Register', 1, 'agent', NULL, NULL, NULL),
(4, 'DTDE8RX004', 'DESY TALIM', '1995-08-27', '0821-1331-8191', 'desy54321', '$2b$10$ZCZK0Lzlenn2y1ni3gtITOdJs9GISQcG1eatRxh0PEBKk0BXwyhNq', NULL, NULL, NULL, '2026-05-26 01:57:21', 'Self-Register', 1, 'agent', NULL, NULL, NULL),
(5, 'ITJMESP005', 'IFAN TJANDRA', '2000-05-12', '+62881036588874', 'ifansiapa', '$2b$10$XK.IYefPk7hTE8hXNPJriOpueghFfkUH0.9m413E/PMBg2rESDmge', NULL, '2026-05-26 03:17:07', 'ifansiapa', '2026-05-26 01:58:48', 'Self-Register', 1, 'agent', NULL, NULL, NULL),
(6, 'IE1BGVY006', 'IFAN ELDY', '1998-04-16', '0881-0365-88874', 'ifaneldy', '$2b$10$FDHol/1mitgKFZwNmTZjIu1WgsRmRr28BTspMm5jlKxPlkbifhwFu', NULL, NULL, NULL, '2026-05-26 03:18:16', 'Self-Register', 1, 'agent', NULL, NULL, NULL);

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
-- Indexes for table `contacts`
--
ALTER TABLE `contacts`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `facilities`
--
ALTER TABLE `facilities`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `facility_id` (`facility_id`),
  ADD KEY `facilities_facility_id` (`facility_id`),
  ADD KEY `facilities_status` (`status`),
  ADD KEY `facilities_category` (`category`),
  ADD KEY `facilities_sort_order` (`sort_order`),
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
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=921;

--
-- AUTO_INCREMENT for table `chat_sessions`
--
ALTER TABLE `chat_sessions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=30;

--
-- AUTO_INCREMENT for table `contacts`
--
ALTER TABLE `contacts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=65;

--
-- AUTO_INCREMENT for table `facilities`
--
ALTER TABLE `facilities`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=22;

--
-- AUTO_INCREMENT for table `logs`
--
ALTER TABLE `logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=448;

--
-- AUTO_INCREMENT for table `properties`
--
ALTER TABLE `properties`
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
