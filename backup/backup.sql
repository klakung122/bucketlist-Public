/*M!999999\- enable the sandbox mode */ 
-- MariaDB dump 10.19-11.7.2-MariaDB, for Win64 (AMD64)
--
-- Host: localhost    Database: bucket
-- ------------------------------------------------------
-- Server version	8.0.43

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*M!100616 SET @OLD_NOTE_VERBOSITY=@@NOTE_VERBOSITY, NOTE_VERBOSITY=0 */;

--
-- Table structure for table `lists`
--

DROP TABLE IF EXISTS `lists`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `lists` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `topic_id` bigint unsigned NOT NULL,
  `title` varchar(200) NOT NULL,
  `description` text,
  `status` enum('active','archived') NOT NULL DEFAULT 'active',
  `position` int unsigned NOT NULL DEFAULT '0',
  `created_by` bigint unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_lists_topic_title` (`topic_id`,`title`),
  KEY `fk_lists_creator` (`created_by`),
  KEY `idx_lists_topic` (`topic_id`),
  KEY `idx_lists_topic_position` (`topic_id`,`position`),
  KEY `idx_lists_status` (`status`),
  CONSTRAINT `fk_lists_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_lists_topic` FOREIGN KEY (`topic_id`) REFERENCES `topics` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=29 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lists`
--

LOCK TABLES `lists` WRITE;
/*!40000 ALTER TABLE `lists` DISABLE KEYS */;
INSERT INTO `lists` VALUES
(16,10,'4',NULL,'archived',6,1,'2025-10-01 16:29:36','2025-10-01 16:31:40'),
(18,10,'6',NULL,'archived',8,1,'2025-10-01 16:30:20','2025-10-01 16:31:41'),
(23,10,'78',NULL,'archived',10,1,'2025-10-01 16:34:52','2025-10-03 17:31:06'),
(24,10,'8',NULL,'archived',11,1,'2025-10-01 16:36:05','2025-10-03 17:31:10'),
(25,35,'sdasd',NULL,'archived',0,1,'2025-10-06 09:29:16','2025-10-06 09:40:30'),
(26,35,'1',NULL,'archived',0,4,'2025-10-06 09:29:45','2025-10-06 09:29:47'),
(27,35,'dasdasdasd',NULL,'active',0,1,'2025-10-06 09:40:38','2025-10-06 09:40:38'),
(28,36,'asdasdasd',NULL,'active',0,1,'2025-10-07 11:02:47','2025-10-07 11:02:47');
/*!40000 ALTER TABLE `lists` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `topic_members`
--

DROP TABLE IF EXISTS `topic_members`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `topic_members` (
  `topic_id` bigint unsigned NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `joined_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`topic_id`,`user_id`),
  KEY `idx_topic_members_user` (`user_id`),
  CONSTRAINT `topic_members_ibfk_1` FOREIGN KEY (`topic_id`) REFERENCES `topics` (`id`) ON DELETE CASCADE,
  CONSTRAINT `topic_members_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `topic_members`
--

LOCK TABLES `topic_members` WRITE;
/*!40000 ALTER TABLE `topic_members` DISABLE KEYS */;
INSERT INTO `topic_members` VALUES
(9,1,'2025-10-01 11:58:21'),
(9,4,'2025-10-01 11:58:15'),
(10,1,'2025-10-01 11:58:51'),
(10,4,'2025-10-01 11:58:45'),
(27,1,'2025-10-01 16:58:00'),
(28,1,'2025-10-01 17:01:28'),
(29,1,'2025-10-01 17:12:59'),
(32,4,'2025-10-03 16:58:24'),
(33,1,'2025-10-03 17:05:11'),
(34,1,'2025-10-03 17:55:40'),
(34,4,'2025-10-03 17:55:46'),
(35,1,'2025-10-03 18:03:54'),
(35,4,'2025-10-03 18:04:03'),
(36,1,'2025-10-06 11:10:11'),
(37,4,'2025-10-06 18:09:32'),
(38,8,'2025-10-07 15:47:37'),
(38,9,'2025-10-07 15:40:55'),
(38,10,'2025-10-07 15:40:43'),
(39,8,'2025-10-07 15:48:30'),
(39,10,'2025-10-07 15:48:36');
/*!40000 ALTER TABLE `topic_members` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `topic_tokens`
--

DROP TABLE IF EXISTS `topic_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `topic_tokens` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `topic_id` bigint unsigned NOT NULL,
  `token_hash` char(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `token_type` enum('invite') CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'invite',
  `max_uses` int unsigned DEFAULT NULL,
  `used_count` int unsigned NOT NULL DEFAULT '0',
  `expires_at` datetime DEFAULT NULL,
  `created_by` bigint unsigned DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_topic_tokens_token_hash` (`token_hash`),
  KEY `created_by` (`created_by`),
  KEY `idx_topic_tokens_topic` (`topic_id`),
  KEY `idx_topic_tokens_valid` (`expires_at`),
  CONSTRAINT `topic_tokens_ibfk_1` FOREIGN KEY (`topic_id`) REFERENCES `topics` (`id`) ON DELETE CASCADE,
  CONSTRAINT `topic_tokens_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=63 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `topic_tokens`
--

LOCK TABLES `topic_tokens` WRITE;
/*!40000 ALTER TABLE `topic_tokens` DISABLE KEYS */;
INSERT INTO `topic_tokens` VALUES
(53,36,'03f74476497686367921120f26441744a1cbbf3c7fab3ae0749403d6687c7379','invite',1,0,'2025-10-08 10:42:20',1,'2025-10-07 10:42:19'),
(54,36,'1396ea00d79b478ecf85381968e8093edc5d783f0efc73aa6106e76922e4ba90','invite',1,0,'2025-10-08 10:46:57',1,'2025-10-07 10:46:56'),
(55,36,'510e15be78bdf75c88fecbd28a43fd143b202cc12615dd52acd24ba136a8578d','invite',1,0,'2025-10-08 10:57:37',1,'2025-10-07 10:57:36'),
(56,36,'3339f69f932c11e17b2d9f23e010d04906051b76e00fc34da04bc2ad00c08109','invite',1,0,'2025-10-08 10:57:54',1,'2025-10-07 10:57:53'),
(57,36,'2b8b331ee81b69814e5bc0219cc0838ad9f1da2270e0d70163fc097c30dd81f4','invite',1,0,'2025-10-08 10:58:42',1,'2025-10-07 10:58:42'),
(58,36,'c728e1a9e0504746a8d1ab4852efacc5906e4abc89c8c4d1713d41d0651b68c5','invite',1,0,'2025-10-08 11:02:41',1,'2025-10-07 11:02:41'),
(59,36,'da3a5955218402414c23075f5cde070d4f2102b8ebd52a311286b5ca2017b929','invite',1,0,'2025-10-08 11:03:15',1,'2025-10-07 11:03:14');
/*!40000 ALTER TABLE `topic_tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `topics`
--

DROP TABLE IF EXISTS `topics`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `topics` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `title` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `owner_id` bigint unsigned NOT NULL,
  `slug` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_topics_slug` (`slug`),
  KEY `idx_topics_owner` (`owner_id`),
  CONSTRAINT `topics_ibfk_1` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=40 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `topics`
--

LOCK TABLES `topics` WRITE;
/*!40000 ALTER TABLE `topics` DISABLE KEYS */;
INSERT INTO `topics` VALUES
(9,'กฟหกฟหก',NULL,4,'nbea-bzl0e7qq','2025-10-01 11:58:15','2025-10-01 11:58:15'),
(10,'กฟหกฟหก6',NULL,4,'anbe-aigzemfh','2025-10-01 11:58:45','2025-10-01 16:35:59'),
(27,'3',NULL,1,'aidmn-5gt3mcg1','2025-10-01 16:58:00','2025-10-01 16:58:00'),
(28,'4',NULL,1,'dnaim-fwqeuft8','2025-10-01 17:01:28','2025-10-01 17:01:28'),
(29,'5',NULL,1,'daimn-eihhnjx4','2025-10-01 17:12:59','2025-10-01 17:12:59'),
(32,'1',NULL,4,'baen-juxhdral','2025-10-03 16:58:24','2025-10-03 16:58:24'),
(33,'2',NULL,1,'mdnai-ekstsug6','2025-10-03 17:05:11','2025-10-03 17:05:11'),
(34,'1',NULL,1,'idanm-zsgruq0j','2025-10-03 17:55:40','2025-10-03 17:55:40'),
(35,'123456',NULL,1,'mdnai-3thzv4st','2025-10-03 18:03:54','2025-10-03 18:03:54'),
(36,'dasdasd','dasdasd',1,'mnida-luul88s1','2025-10-06 11:10:11','2025-10-06 11:10:11'),
(37,'dasdasd',NULL,4,'aneb-ovfwxxqt','2025-10-06 18:09:32','2025-10-06 18:09:32'),
(38,'dsadasd',NULL,10,'nakuhn-w-dlqxhz7g','2025-10-07 15:40:43','2025-10-07 15:40:43'),
(39,'กฟหกฟก',NULL,8,'tawcahra-1b5nfn2w','2025-10-07 15:48:30','2025-10-07 15:48:30');
/*!40000 ALTER TABLE `topics` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `username` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `password` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `provider` enum('local','google') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'local',
  `provider_sub` varchar(128) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `profile_image` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `last_login` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_username` (`username`),
  UNIQUE KEY `uq_users_email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES
(1,'admin','admin@admin.com','$2b$12$CgWQyFFqbgwFnYam82V.Wumj4P.75CS8l3xVPa/udpNw2bP.hYjpS','local',NULL,'/uploads/avatars/u1_1759773580764.jpg','2025-09-25 15:50:40','2025-10-06 17:59:40',NULL),
(4,'bean','bean@bean.com','$2b$12$qk.2mQmKf.ewBon0KNTKD.PLtXg0D5A7mz3dwt5Y4IarQ5E7IgGQO','local',NULL,NULL,'2025-09-26 15:24:17','2025-09-26 15:24:17',NULL),
(5,'kuy','kuy@kuy.com','$2b$12$eLq2y.IDeaO8KegRu2lUNOsPl1xY8HzClul4uAmSAIp0WTDyJR9mq','local',NULL,NULL,'2025-09-30 09:55:12','2025-09-30 09:55:12',NULL),
(6,'kuy1','kuy1@kuy.com','$2b$12$dSPqi2kJdWxAnDmjvqYP9OidRLC4l6ghOzvJm8GqwT0v8WSTPOyFm','local',NULL,NULL,'2025-09-30 09:56:16','2025-09-30 09:56:16',NULL),
(8,'Watcharakon','klakung122@gmail.com',NULL,'google','103956654064758905493','/uploads/avatars/u8_google_1759854813225.webp','2025-10-07 14:38:20','2025-10-07 16:33:33','2025-10-07 16:33:33'),
(9,'วัชรากร ฉวีวงศ์ประทีป','65202040032@phuketvc.ac.th',NULL,'google','103800572354080186816','/uploads/avatars/u9_google_1759855172186.webp','2025-10-07 15:16:03','2025-10-07 16:39:32','2025-10-07 16:39:32'),
(10,'KHUN WANG','klakung1230@gmail.com',NULL,'google','107393493079562519220','https://lh3.googleusercontent.com/a/ACg8ocIifOAXTnwuLRGcNHxZXhkU4EvyoRZbB2bFgi3FPz_rdVlzkO8=s96-c','2025-10-07 15:39:05','2025-10-07 15:39:05','2025-10-07 15:39:05');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'bucket'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*M!100616 SET NOTE_VERBOSITY=@OLD_NOTE_VERBOSITY */;

-- Dump completed on 2025-10-08  0:01:34
