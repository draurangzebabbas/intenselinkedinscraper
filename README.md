# LinkedIn Scraper Application

A comprehensive LinkedIn data scraping and management platform built with React, TypeScript, Supabase, and Apify.

## Features

- **LinkedIn Data Scraping**: Extract comments from LinkedIn posts and detailed profile information
- **Profile Management**: Store, organize, and manage LinkedIn profiles with advanced filtering
- **User Authentication**: Secure user registration and login with email confirmation
- **Data Analytics**: Profile completeness scoring and engagement metrics
- **Export Capabilities**: Export data in multiple formats (CSV, JSON, Excel)
- **Search & Filtering**: Full-text search with advanced filtering options
- **Tag Management**: Organize profiles with custom tags and categories
- **Contact Tracking**: Track outreach attempts and responses

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide React
- **Backend**: Supabase (PostgreSQL, Auth, Real-time)
- **Scraping**: Apify platform for LinkedIn data extraction
- **Build Tool**: Vite
- **Deployment**: Netlify (recommended)

## Prerequisites

Before setting up the project, you'll need:

1. **Supabase Account**: Create a free account at [supabase.com](https://supabase.com)
2. **Apify Account**: Create an account at [apify.com](https://apify.com) for LinkedIn scraping
3. **Node.js**: Version 18 or higher

## Setup Instructions

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd linkedin-scraper-app
npm install
```

### 2. Supabase Setup

1. **Create a new Supabase project**:
   - Go to [supabase.com/dashboard](https://supabase.com/dashboard)
   - Click "New Project"
   - Choose your organization and enter project details
   - Wait for the project to be created

2. **Get your Supabase credentials**:
   - Go to Settings > API
   - Copy the "Project URL" and "anon public" key

3. **Configure authentication**:
   - Go to Authentication > Settings
   - Configure your site URL (for local development: `http://localhost:5173`)
   - Disable email confirmations for easier testing (optional)
   - Configure email templates if needed

4. **Run database migrations**:
   - The project includes comprehensive database migrations
   - These will be automatically applied when you first connect

### 3. Apify Setup

1. **Create an Apify account** at [apify.com](https://apify.com)
2. **Get your API key**:
   - Go to Settings > Integrations
   - Copy your API token

### 4. Environment Configuration

1. **Create environment file**:
   ```bash
   cp .env.example .env
   ```

2. **Update the `.env` file**:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key-here
   VITE_APIFY_API_KEY=your-apify-api-key-here
   ```

### 5. Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## Database Schema

The application uses a comprehensive database schema with the following main tables:

- **linkedin_profiles**: Store scraped profile data with search and analytics
- **scraping_jobs**: Track scraping operations and their status
- **profile_tags**: Manage custom tags for profile organization
- **search_queries**: Track user search patterns
- **export_history**: Log data export operations
- **contact_attempts**: Track outreach efforts and responses
- **profile_analytics**: Store computed metrics and scores

## Key Features Explained

### Profile Data Quality Scoring
Profiles are automatically scored based on completeness:
- Basic info (name, headline, about, photo): 40 points
- Contact info (email, phone): 20 points
- Professional info (job, company, experience): 30 points
- Additional info (skills): 10 points

### Full-Text Search
Profiles are indexed for fast searching across:
- Names and headlines
- Company and job titles
- Locations and tags
- Custom notes

### User Authentication
- Secure email/password authentication
- Email confirmation (configurable)
- User profile management
- Row-level security for data isolation

## Usage

### 1. User Registration
- Create an account with email and password
- Confirm email if email confirmation is enabled
- Access the main dashboard

### 2. Scraping LinkedIn Data
- **Post Comments**: Extract all commenters from a LinkedIn post
- **Profile Details**: Get detailed information from LinkedIn profiles
- **Mixed Mode**: Extract post commenters and their full profiles

### 3. Managing Profiles
- View all scraped profiles in a comprehensive table
- Filter and search profiles
- Add custom tags and notes
- Export data in multiple formats
- Track profile updates and changes

### 4. Analytics and Reporting
- View profile completeness scores
- Track scraping job history
- Monitor data quality metrics
- Export reports and statistics

## Deployment

### Deploy to Netlify

1. **Build the project**:
   ```bash
   npm run build
   ```

2. **Deploy to Netlify**:
   - Connect your GitHub repository to Netlify
   - Set build command: `npm run build`
   - Set publish directory: `dist`
   - Add environment variables in Netlify dashboard

3. **Configure Supabase for production**:
   - Update site URL in Supabase Auth settings
   - Add production domain to allowed origins

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_SUPABASE_URL` | Your Supabase project URL | Yes |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anonymous key | Yes |
| `VITE_APIFY_API_KEY` | Your Apify API token | Yes |

## Troubleshooting

### Common Issues

1. **Connection Errors**:
   - Verify Supabase URL and API key
   - Check internet connection
   - Ensure Supabase project is active

2. **Authentication Issues**:
   - Check email confirmation settings
   - Verify redirect URLs in Supabase
   - Clear browser cache and cookies

3. **Scraping Failures**:
   - Verify Apify API key
   - Check LinkedIn URL format
   - Monitor Apify usage limits

### Getting Help

- Check the browser console for error messages
- Review Supabase logs in the dashboard
- Monitor Apify run logs for scraping issues

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Security Notes

- Never commit API keys or sensitive data
- Use environment variables for all configuration
- Regularly rotate API keys
- Monitor usage and access logs
- Follow LinkedIn's terms of service for data scraping