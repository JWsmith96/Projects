-- Budget Expense Tracker - Database Schema
-- Run this script to create the betracker database from scratch.

CREATE DATABASE IF NOT EXISTS betracker;
USE betracker;

-- Auth Levels
CREATE TABLE IF NOT EXISTS `authlevels` (
  `AuthLevelID` int NOT NULL AUTO_INCREMENT,
  `LevelName` varchar(255) DEFAULT NULL,
  `Description` text,
  PRIMARY KEY (`AuthLevelID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Users
CREATE TABLE IF NOT EXISTS `users` (
  `UserID` int NOT NULL AUTO_INCREMENT,
  `Username` varchar(255) DEFAULT NULL,
  `Password` varchar(255) DEFAULT NULL,
  `AuthLevel` int DEFAULT NULL,
  `OtherDetails` text,
  PRIMARY KEY (`UserID`),
  KEY `AuthLevel` (`AuthLevel`),
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`AuthLevel`) REFERENCES `authlevels` (`AuthLevelID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Asset Types
CREATE TABLE IF NOT EXISTS `assettypes` (
  `AssetTypeID` int NOT NULL AUTO_INCREMENT,
  `Name` varchar(255) DEFAULT NULL,
  `Description` text,
  PRIMARY KEY (`AssetTypeID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Assets
CREATE TABLE IF NOT EXISTS `assets` (
  `AssetID` int NOT NULL AUTO_INCREMENT,
  `Name` varchar(255) DEFAULT NULL,
  `Description` text,
  `AssetTypeID` int DEFAULT NULL,
  `InitialBalance` decimal(12,2) DEFAULT NULL,
  `CurrentBalance` decimal(12,2) DEFAULT NULL,
  `StartDate` date DEFAULT NULL,
  `EndDate` date DEFAULT NULL,
  `TargetBalance` decimal(12,2) DEFAULT NULL,
  `TargetDate` date DEFAULT NULL,
  PRIMARY KEY (`AssetID`),
  KEY `AssetTypeID` (`AssetTypeID`),
  CONSTRAINT `assets_ibfk_1` FOREIGN KEY (`AssetTypeID`) REFERENCES `assettypes` (`AssetTypeID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Liability Types
CREATE TABLE IF NOT EXISTS `liabilitytypes` (
  `LiabilityTypeID` int NOT NULL AUTO_INCREMENT,
  `Name` varchar(255) DEFAULT NULL,
  `Description` text,
  PRIMARY KEY (`LiabilityTypeID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Liabilities
CREATE TABLE IF NOT EXISTS `liabilities` (
  `LiabilityID` int NOT NULL AUTO_INCREMENT,
  `Name` varchar(255) DEFAULT NULL,
  `Description` text,
  `LiabilityTypeID` int DEFAULT NULL,
  `InitialBalance` decimal(12,2) DEFAULT NULL,
  `CurrentBalance` decimal(12,2) DEFAULT NULL,
  `StartDate` date DEFAULT NULL,
  `EndDate` date DEFAULT NULL,
  `TargetBalance` decimal(12,2) DEFAULT NULL,
  `TargetDate` date DEFAULT NULL,
  PRIMARY KEY (`LiabilityID`),
  KEY `LiabilityTypeID` (`LiabilityTypeID`),
  CONSTRAINT `liabilities_ibfk_1` FOREIGN KEY (`LiabilityTypeID`) REFERENCES `liabilitytypes` (`LiabilityTypeID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Income Types
CREATE TABLE IF NOT EXISTS `incometypes` (
  `IncomeTypeID` int NOT NULL AUTO_INCREMENT,
  `Name` varchar(255) DEFAULT NULL,
  `Description` text,
  PRIMARY KEY (`IncomeTypeID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Incomes
CREATE TABLE IF NOT EXISTS `incomes` (
  `IncomeID` int NOT NULL AUTO_INCREMENT,
  `Name` varchar(255) DEFAULT NULL,
  `Description` text,
  `IncomeTypeID` int DEFAULT NULL,
  `AssetID` int DEFAULT NULL,
  `LiabilityID` int DEFAULT NULL,
  `StartDate` date DEFAULT NULL,
  `EndDate` date DEFAULT NULL,
  `Amount` decimal(12,2) DEFAULT NULL,
  `RecurringPeriodID` int DEFAULT NULL,
  `LastReceivedDate` date DEFAULT NULL,
  `Applied` tinyint DEFAULT '0',
  PRIMARY KEY (`IncomeID`),
  KEY `IncomeTypeID` (`IncomeTypeID`),
  KEY `AssetID` (`AssetID`),
  KEY `LiabilityID` (`LiabilityID`),
  CONSTRAINT `incomes_ibfk_1` FOREIGN KEY (`IncomeTypeID`) REFERENCES `incometypes` (`IncomeTypeID`),
  CONSTRAINT `incomes_ibfk_2` FOREIGN KEY (`AssetID`) REFERENCES `assets` (`AssetID`),
  CONSTRAINT `incomes_ibfk_3` FOREIGN KEY (`LiabilityID`) REFERENCES `liabilities` (`LiabilityID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Expense Types
CREATE TABLE IF NOT EXISTS `expensetypes` (
  `ExpenseTypeID` int NOT NULL AUTO_INCREMENT,
  `Name` varchar(255) DEFAULT NULL,
  `Description` text,
  PRIMARY KEY (`ExpenseTypeID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Expenses
CREATE TABLE IF NOT EXISTS `expenses` (
  `ExpenseID` int NOT NULL AUTO_INCREMENT,
  `Name` varchar(255) DEFAULT NULL,
  `Description` text,
  `ExpenseTypeID` int DEFAULT NULL,
  `AssetID` int DEFAULT NULL,
  `LiabilityID` int DEFAULT NULL,
  `StartDate` date DEFAULT NULL,
  `EndDate` date DEFAULT NULL,
  `Amount` decimal(12,2) DEFAULT NULL,
  `RecurringPeriodID` int DEFAULT NULL,
  `LastPaidDate` date DEFAULT NULL,
  `AutoPaid` tinyint(1) DEFAULT NULL,
  `Applied` tinyint DEFAULT '0',
  PRIMARY KEY (`ExpenseID`),
  KEY `ExpenseTypeID` (`ExpenseTypeID`),
  KEY `AssetID` (`AssetID`),
  KEY `LiabilityID` (`LiabilityID`),
  CONSTRAINT `expenses_ibfk_1` FOREIGN KEY (`ExpenseTypeID`) REFERENCES `expensetypes` (`ExpenseTypeID`),
  CONSTRAINT `expenses_ibfk_2` FOREIGN KEY (`AssetID`) REFERENCES `assets` (`AssetID`),
  CONSTRAINT `expenses_ibfk_3` FOREIGN KEY (`LiabilityID`) REFERENCES `liabilities` (`LiabilityID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Finance Breakdowns
CREATE TABLE IF NOT EXISTS `finbreakdowns` (
  `FinBreakdownID` int NOT NULL AUTO_INCREMENT,
  `IncomeID` int DEFAULT NULL,
  `ExpenseID` int DEFAULT NULL,
  `ItemDate` date DEFAULT NULL,
  `ItemName` varchar(255) DEFAULT NULL,
  `ItemAmount` decimal(12,2) DEFAULT NULL,
  `ItemIteration` int DEFAULT NULL,
  PRIMARY KEY (`FinBreakdownID`),
  KEY `finbreakdowns_ibfk_1` (`IncomeID`),
  KEY `finbreakdowns_ibfk_2` (`ExpenseID`),
  CONSTRAINT `finbreakdowns_ibfk_1` FOREIGN KEY (`IncomeID`) REFERENCES `incomes` (`IncomeID`),
  CONSTRAINT `finbreakdowns_ibfk_2` FOREIGN KEY (`ExpenseID`) REFERENCES `expenses` (`ExpenseID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Finance Columns
CREATE TABLE IF NOT EXISTS `fincols` (
  `FinColID` int NOT NULL AUTO_INCREMENT,
  `UserID` int NOT NULL DEFAULT '0',
  `SequenceID` int NOT NULL DEFAULT '0',
  `AssetID` int DEFAULT NULL,
  `LiabilityID` int DEFAULT NULL,
  `Name` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`FinColID`),
  KEY `fincols_ibfk_1` (`AssetID`),
  KEY `fincols_ibfk_2` (`LiabilityID`),
  CONSTRAINT `fincols_ibfk_1` FOREIGN KEY (`AssetID`) REFERENCES `assets` (`AssetID`),
  CONSTRAINT `fincols_ibfk_2` FOREIGN KEY (`LiabilityID`) REFERENCES `liabilities` (`LiabilityID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Finance Lines
CREATE TABLE IF NOT EXISTS `finlines` (
  `FinLineID` int NOT NULL AUTO_INCREMENT,
  `UserID` int NOT NULL DEFAULT '0',
  `SequenceID` int NOT NULL DEFAULT '0',
  `AssetID` int DEFAULT NULL,
  `LiabilityID` int DEFAULT NULL,
  `LineDate` date DEFAULT NULL,
  `LineBalance` decimal(12,2) DEFAULT NULL,
  PRIMARY KEY (`FinLineID`),
  KEY `finlines_ibfk_1` (`AssetID`),
  KEY `finlines_ibfk_2` (`LiabilityID`),
  CONSTRAINT `finlines_ibfk_1` FOREIGN KEY (`AssetID`) REFERENCES `assets` (`AssetID`),
  CONSTRAINT `finlines_ibfk_2` FOREIGN KEY (`LiabilityID`) REFERENCES `liabilities` (`LiabilityID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Budget Items
CREATE TABLE IF NOT EXISTS `budgetitems` (
  `BudgetItemID` int NOT NULL AUTO_INCREMENT,
  `BudgetID` int DEFAULT NULL,
  `Name` varchar(255) DEFAULT NULL,
  `Description` text,
  `ExpenseID` int DEFAULT NULL,
  `IncomeID` int DEFAULT NULL,
  `AssetID` int DEFAULT NULL,
  `LiabilityID` int DEFAULT NULL,
  PRIMARY KEY (`BudgetItemID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
