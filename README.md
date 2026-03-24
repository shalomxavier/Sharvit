# Crypto Market Data App

A serverless cryptocurrency market data application using Firebase and Binance API.

## Project Structure

```
windsurf-project/
├── functions/        # Firebase Functions (serverless backend)
├── frontend/         # React TypeScript dashboard
├── firebase.json     # Firebase configuration
├── firestore.rules   # Firestore security rules
└── start.bat         # Development launcher
```

## Features

### Firebase Functions (Serverless Backend)
- HTTP Functions for market data, OHLCV, live prices, and open interest
- Binance API integration with rate limiting protection
- Firestore caching with configurable TTL (5s default)
- Health check endpoint
- Environment-based configuration
- Exponential backoff for rate limit handling
- Technical indicators: RSI, EMA, ATR, ADX

### Frontend (React + TypeScript + Tailwind)
- Real-time market dashboard with OHLCV cards
- Live price banner with bid/ask spread
- Trend indicators and loading states
- Dark theme with modern UI
- Automatic data refresh every 5 seconds
- Error handling with retry logic
- Firebase SDK integration

## Quick Start

### Prerequisites
- Node.js 18+
- Firebase CLI: `npm install -g firebase-tools`
- Firebase project (create at https://console.firebase.google.com)

### Firebase Functions Setup
```bash
cd functions
npm install
cp .env.example .env
# Edit .env with your Binance API configuration
npm run build
```

### Frontend Setup
```bash
cd frontend
npm install
cp .env.example .env
# Edit .env with your Firebase project configuration
npm start
```

### One-click Development Launcher (Windows)

Run `start.bat` from the project root to start Firebase Functions emulator and frontend development server.

## Firebase Functions

### Available Functions
- `healthCheck` - Health check
- `getMarketData` - Latest candle + history + technical indicators
- `getOHLCV` - Latest OHLCV candle only
- `getLivePrice` - Current price + mark price + bid/ask
- `getOpenInterest` - Futures open interest data with indicators

### Local Development
```bash
cd functions
npm run serve  # Starts Firebase emulator
```

## Configuration

### Firebase Functions Environment Variables
- `SYMBOL` - Trading pair (default: BTCUSDT)
- `INTERVAL` - Candle interval (default: 15m)
- `CACHE_TTL_*` - Cache durations in seconds
- `MAX_CANDLES` - History limit (default: 100)
- `RATE_LIMIT_DELAY` - Retry delay in ms
- `BINANCE_BASE_URL` - Binance API URL
- `BINANCE_FUTURES_BASE_URL` - Binance Futures API URL

### Frontend Environment Variables
- `REACT_APP_FIREBASE_*` - Firebase project configuration
- `REACT_APP_USE_FIREBASE_EMULATOR` - Use local emulator (development)

## Technology Stack

### Backend (Firebase Functions)
- Firebase Functions - Serverless compute
- Firebase Admin SDK - Server-side Firebase integration
- Firestore - NoSQL database for caching
- Axios - HTTP client for Binance API
- TypeScript - Type safety

### Frontend
- React 18 - UI framework
- TypeScript - Type safety
- Tailwind CSS - Styling framework
- Firebase SDK - Client-side Firebase integration
- Create React App - Build tooling

## Development

Development scripts:
- Functions: `npm run serve` (Firebase emulator)
- Frontend: `npm start` (CRA dev server)
- Build Functions: `npm run build`
- Build Frontend: `npm run build`

## Deployment

### Firebase Functions
```bash
cd functions
npm run deploy
```

### Firebase Hosting
```bash
cd frontend
npm run build
firebase deploy --only hosting
```

### Complete Deployment
```bash
firebase deploy
```

## Migration from Express.js

This project has been migrated from a Node.js Express backend to Firebase Functions:

### Changes Made
- ✅ Replaced Express.js server with Firebase Functions
- ✅ Migrated in-memory cache to Firestore
- ✅ Updated frontend to use Firebase SDK
- ✅ Configured Firebase Hosting for frontend
- ✅ Maintained all existing API functionality
- ✅ Preserved technical indicators and calculations

### Benefits
- **Scalability**: Automatic scaling with Firebase Functions
- **Cost**: Pay-per-use pricing model
- **Reliability**: Managed infrastructure with high availability
- **Security**: Built-in security features
- **Maintenance**: Reduced DevOps overhead

## Rate Limiting

The Firebase Functions implement intelligent rate limiting:
- Automatic retry with exponential backoff
- Firestore caching to reduce API calls
- Configurable retry attempts and delays
- Handles Binance 429/418 responses gracefully
