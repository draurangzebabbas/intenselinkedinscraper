/*
  # Step 1: Create Extensions

  This migration enables necessary PostgreSQL extensions for the LinkedIn Scraper application.

  ## What this does:
  - Enables uuid-ossp extension for UUID generation
  - Enables necessary extensions for the application to function properly
*/

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";