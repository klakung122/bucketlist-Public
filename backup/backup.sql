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
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
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
(24,10,'8',NULL,'archived',11,1,'2025-10-01 16:36:05','2025-10-03 17:31:10');
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
(35,4,'2025-10-03 18:04:03');
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
  `token_hash` char(64) COLLATE utf8mb4_general_ci NOT NULL,
  `token_type` enum('invite') COLLATE utf8mb4_general_ci NOT NULL DEFAULT 'invite',
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
) ENGINE=InnoDB AUTO_INCREMENT=52 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `topic_tokens`
--

LOCK TABLES `topic_tokens` WRITE;
/*!40000 ALTER TABLE `topic_tokens` DISABLE KEYS */;
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
  `title` varchar(200) COLLATE utf8mb4_general_ci NOT NULL,
  `description` text COLLATE utf8mb4_general_ci,
  `owner_id` bigint unsigned NOT NULL,
  `slug` varchar(120) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_topics_slug` (`slug`),
  KEY `idx_topics_owner` (`owner_id`),
  CONSTRAINT `topics_ibfk_1` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=36 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
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
(35,'123456',NULL,1,'mdnai-3thzv4st','2025-10-03 18:03:54','2025-10-03 18:03:54');
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
  `username` varchar(50) COLLATE utf8mb4_general_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `password` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `profile_image` varchar(500) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_username` (`username`),
  UNIQUE KEY `uq_users_email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES
(1,'admin','admin@admin.com','$2b$12$CgWQyFFqbgwFnYam82V.Wumj4P.75CS8l3xVPa/udpNw2bP.hYjpS','/uploads/avatars/u1_1759147982317.jpg','2025-09-25 15:50:40','2025-09-30 18:13:37'),
(4,'bean','bean@bean.com','$2b$12$qk.2mQmKf.ewBon0KNTKD.PLtXg0D5A7mz3dwt5Y4IarQ5E7IgGQO',NULL,'2025-09-26 15:24:17','2025-09-26 15:24:17'),
(5,'kuy','kuy@kuy.com','$2b$12$eLq2y.IDeaO8KegRu2lUNOsPl1xY8HzClul4uAmSAIp0WTDyJR9mq',NULL,'2025-09-30 09:55:12','2025-09-30 09:55:12'),
(6,'kuy1','kuy1@kuy.com','$2b$12$dSPqi2kJdWxAnDmjvqYP9OidRLC4l6ghOzvJm8GqwT0v8WSTPOyFm',NULL,'2025-09-30 09:56:16','2025-09-30 09:56:16');
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

-- Dump completed on 2025-10-04  1:10:31
