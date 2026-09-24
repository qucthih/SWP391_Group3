-- Migration: add_student_lecturer_admin_fields
-- Date: 2026-09-23
-- Description: Add new fields to students, lecturers, admins tables per SRS Data Dictionary

-- ============================================================
-- TABLE: students — add intake_year column
-- ============================================================
ALTER TABLE [dbo].[students]
  ADD [intake_year] INT NULL;

-- ============================================================
-- TABLE: lecturers — add lecturer_code column (nullable, unique)
-- ============================================================
ALTER TABLE [dbo].[lecturers]
  ADD [lecturer_code] NVARCHAR(1000) NULL;

ALTER TABLE [dbo].[lecturers]
  ADD CONSTRAINT [lecturers_lecturer_code_key] UNIQUE ([lecturer_code]);

-- ============================================================
-- TABLE: admins — add staff_code (nullable, unique) + managed_scope columns
-- ============================================================
ALTER TABLE [dbo].[admins]
  ADD [staff_code] NVARCHAR(1000) NULL;

ALTER TABLE [dbo].[admins]
  ADD [managed_scope] NVARCHAR(1000) NULL;

ALTER TABLE [dbo].[admins]
  ADD CONSTRAINT [admins_staff_code_key] UNIQUE ([staff_code]);
