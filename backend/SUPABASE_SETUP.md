# Supabase Integration Setup Guide

This guide will help you integrate your Poisoned Candy Duel backend with Supabase for persistent data storage.

## 🚀 Quick Start

1. **Create Supabase Project**
   - Go to [supabase.com](https://supabase.com)
   - Create a new project
   - Wait for setup to complete

2. **Get Your Credentials**
   - Go to Settings > API
   - Copy your Project URL and anon public key

3. **Configure Environment**
   ```bash
   cd backend
   cp .env.example .env  # Create your .env file
   ```
   
   Edit `.env` with your Supabase credentials:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_KEY=your-anon-key
   ```

4. **Set Up Database Schema**
   - Go to SQL Editor in your Supabase dashboard
   - Copy and paste the contents of `schema.sql`
   - Run the query

5. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

6. **Test Setup**
   ```bash
   python setup_supabase.py
   ```

7. **Start Server**
   ```bash
   python -m uvicorn api:app --reload
   ```

## 📊 Database Schema

### Tables Created

- **`games`** - Main game sessions
- **`game_moves`** - Individual moves (optional, for analytics)
- **`players`** - Player profiles (optional)

### Key Features

- **UUID Primary Keys** - Secure, unique identifiers
- **JSONB Game State** - Flexible game data storage
- **Automatic Timestamps** - Created/updated tracking
- **Row Level Security** - Built-in access control
- **Indexes** - Optimized for common queries

## 🔧 API Changes

### New Features Added

- **Persistent Storage** - Games saved to Supabase
- **Hybrid Architecture** - Memory + Database for performance
- **Enhanced Health Check** - Database connectivity monitoring
- **Game Statistics** - `/stats` endpoint for analytics
- **Player History** - Persistent game history

### Endpoints Enhanced

- `POST /games` - Now saves to database
- `GET /games/{id}` - Loads from database if not in memory
- `POST /games/{id}/poison` - Updates database
- `POST /games/{id}/move` - Updates database
- `GET /players/{name}/games` - Reads from database
- `DELETE /games/{id}` - Removes from database
- `GET /health` - Tests database connection
- `GET /stats` - New statistics endpoint

## 🏗️ Architecture

### Hybrid Storage Model

```
┌─────────────────┐    ┌─────────────────┐
│   FastAPI       │    │   Supabase      │
│   (Memory)      │◄──►│   (Database)    │
│                 │    │                 │
│ • Active Games  │    │ • All Games     │
│ • Fast Access   │    │ • Persistence   │
│ • WebSockets    │    │ • Analytics     │
└─────────────────┘    └─────────────────┘
```

### Benefits

- **Performance** - Active games in memory for speed
- **Persistence** - All games saved to database
- **Scalability** - Database handles large datasets
- **Reliability** - No data loss on server restart

## 🔒 Security Features

### Row Level Security (RLS)

- **Games** - Players can only update their own games
- **Moves** - Tracked for audit purposes
- **Players** - Users can only update their own profiles

### Environment Variables

- **Credentials** - Stored securely in `.env`
- **CORS** - Configurable allowed origins
- **Rate Limiting** - Built-in protection

## 📈 Monitoring & Analytics

### Health Monitoring

```bash
curl http://localhost:8000/health
```

Response includes:
- Server status
- Active games count
- Database connectivity
- Game statistics

### Game Statistics

```bash
curl http://localhost:8000/stats
```

Provides:
- Total games played
- Active games
- Completion rates
- Average game duration

## 🛠️ Troubleshooting

### Common Issues

1. **Connection Failed**
   - Check SUPABASE_URL and SUPABASE_KEY
   - Verify project is active in Supabase dashboard

2. **Schema Errors**
   - Ensure schema.sql was run completely
   - Check for any SQL errors in Supabase logs

3. **Permission Denied**
   - Verify RLS policies are set correctly
   - Check API key has proper permissions

4. **Import Errors**
   - Run `pip install -r requirements.txt`
   - Ensure all dependencies are installed

### Debug Commands

```bash
# Test environment setup
python setup_supabase.py

# Check server health
curl http://localhost:8000/health

# View server logs
python -m uvicorn api:app --reload --log-level debug
```

## 🔄 Migration from Memory-Only

If you have existing games in memory:

1. **Backup Current Games** (if needed)
2. **Install New Dependencies**
3. **Set Up Supabase**
4. **Restart Server**

The system will automatically:
- Save new games to database
- Load games from database when needed
- Maintain backward compatibility

## 📝 Environment Variables Reference

```env
# Required
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key

# Optional
SUPABASE_SERVICE_KEY=your-service-role-key
DATABASE_URL=postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres
API_HOST=0.0.0.0
API_PORT=8000
DEBUG=True
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:19006
MAX_GAMES_PER_USER=10
GAME_CLEANUP_INTERVAL=3600
GAME_EXPIRY_TIME=86400
```

## 🎯 Next Steps

After successful setup:

1. **Test the API** - Create and play games
2. **Monitor Performance** - Check `/health` and `/stats`
3. **Configure Production** - Set proper CORS origins
4. **Set Up Backups** - Configure Supabase backups
5. **Add Authentication** - Implement user auth if needed

## 📞 Support

If you encounter issues:

1. Check the troubleshooting section
2. Run `python setup_supabase.py` for diagnostics
3. Review Supabase dashboard logs
4. Verify all environment variables are set

Your PCD backend is now ready for production with persistent storage! 🎮 