# Training Program

A web application for tracking and following structured training programs with progression tracking. Built with Next.js 14, TypeScript, and PostgreSQL.

## Features

- **Training Program Browser**: Explore categorized training plans (strength, cardio, flexibility, etc.)
- **Progress Dashboard**: Visualize current status, completed sessions, and next milestones
- **Personal Records Tracking**: History charts and achievement notifications
- **Strava Integration**: Automatic activity synchronization
- **Performance Analytics**: Visual performance curves and fitness progression tracking
- **Goal Setting**: Define and track personal goals with deadlines

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript 5.4+ (Strict Mode)
- **Styling**: Tailwind CSS 3.4+
- **UI Components**: shadcn/ui
- **Database**: PostgreSQL 15+
- **ORM**: Prisma 7.6+
- **Authentication**: NextAuth.js with Strava OAuth
- **Testing**: Jest 29+ with React Testing Library
- **Linting**: ESLint 8+ with @typescript-eslint
- **Formatting**: Prettier 3+
- **Git Hooks**: Husky 9+ with lint-staged
- **CI/CD**: GitHub Actions

## Prerequisites

- Node.js 20 LTS
- PostgreSQL 15+
- npm or yarn

## Setup Local Development

1. **Clone the repository**

   ```bash
   git clone https://github.com/robbyasistant-del/training-program.git
   cd training-program
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your database and Strava API credentials.

4. **Set up the database**

   ```bash
   # Ensure PostgreSQL is running locally
   # Create the database
   createdb training_program

   # Run migrations
   npm run db:migrate

   # Generate Prisma client
   npm run db:generate
   ```

5. **Start the development server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:4004](http://localhost:4004) in your browser.

## Project Structure

```
my-app/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React components
│   └── ui/               # shadcn/ui components
├── hooks/                # Custom React hooks
├── lib/                  # Utility functions
│   └── utils.ts         # Utility helpers
├── services/             # Business logic services
├── __tests__/            # Test files
│   └── lib/             # Tests for lib utilities
├── prisma/              # Database schema and migrations
│   ├── migrations/      # Migration files
│   └── schema.prisma    # Prisma schema
├── types/               # TypeScript type definitions
├── .github/workflows/   # CI/CD configurations
├── .env.example         # Environment variables template
├── .eslintrc.json       # ESLint configuration
├── .prettierrc          # Prettier configuration
├── jest.config.js       # Jest configuration
├── next.config.mjs      # Next.js configuration
├── package.json         # Dependencies and scripts
├── tailwind.config.ts   # Tailwind CSS configuration
└── tsconfig.json        # TypeScript configuration
```

## Available Scripts

### Development

- `npm run dev` - Start development server on port 4004
- `npm run build` - Build for production
- `npm run start` - Start production server on port 4004

### Code Quality

- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run type-check` - Run TypeScript type checking

### Testing

- `npm run test` - Run tests once
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report (min 70%)

### Database

- `npm run db:migrate` - Run database migrations
- `npm run db:generate` - Generate Prisma client
- `npm run db:studio` - Open Prisma Studio
- `npm run db:seed` - Seed database with sample data

## Database Schema

### Entity Relationship Diagram

```
┌─────────────────┐       ┌──────────────────┐
│     Athlete     │       │     Activity     │
├─────────────────┤       ├──────────────────┤
│ id (PK)         │──────<│ id (PK)          │
│ stravaId (UQ)   │   1:N │ stravaActivityId │
│ email (UQ)      │       │ athleteId (FK)   │
│ firstname       │       │ type (Enum)      │
│ lastname        │       │ name             │
│ profileImage    │       │ distance         │
│ createdAt       │       │ movingTime       │
│ updatedAt       │       │ elapsedTime      │
└─────────────────┘       │ totalElevationGain
                          │ startDate        │
                          │ averageSpeed     │
                          │ maxSpeed         │
                          │ averageHeartrate │
                          │ maxHeartrate     │
                          │ createdAt        │
                          │ updatedAt        │
                          └──────────────────┘
```

### Athlete

Stores athlete information synchronized from Strava.

| Field          | Type     | Constraints        | Description                |
| -------------- | -------- | ------------------ | -------------------------- |
| `id`           | UUID     | PK, auto-generated | Internal unique identifier |
| `stravaId`     | BigInt   | Unique, indexed    | Strava athlete ID          |
| `email`        | String   | Unique, indexed    | Athlete email address      |
| `firstname`    | String   | Required           | First name                 |
| `lastname`     | String   | Required           | Last name                  |
| `profileImage` | String   | Optional           | Profile image URL          |
| `createdAt`    | DateTime | Default: now       | Record creation timestamp  |
| `updatedAt`    | DateTime | Auto-update        | Last update timestamp      |

**Indexes:** `stravaId`, `email`

### Activity

Stores activity data synchronized from Strava with detailed metrics.

| Field                | Type         | Constraints           | Description                     |
| -------------------- | ------------ | --------------------- | ------------------------------- |
| `id`                 | UUID         | PK, auto-generated    | Internal unique identifier      |
| `stravaActivityId`   | BigInt       | Unique, indexed       | Strava activity ID              |
| `athleteId`          | UUID         | FK → Athlete, indexed | Reference to athlete            |
| `type`               | ActivityType | Enum, indexed         | Activity type (RUN, RIDE, etc.) |
| `name`               | String       | Required              | Activity name                   |
| `distance`           | Float        | Optional, meters      | Distance covered                |
| `movingTime`         | Int          | Optional, seconds     | Moving time                     |
| `elapsedTime`        | Int          | Optional, seconds     | Total elapsed time              |
| `totalElevationGain` | Float        | Optional, meters      | Elevation gain                  |
| `startDate`          | DateTime     | Indexed               | Activity start date             |
| `averageSpeed`       | Float        | Optional              | Average speed (m/s)             |
| `maxSpeed`           | Float        | Optional              | Maximum speed (m/s)             |
| `averageHeartrate`   | Float        | Optional              | Average heart rate (bpm)        |
| `maxHeartrate`       | Float        | Optional              | Maximum heart rate (bpm)        |
| `createdAt`          | DateTime     | Default: now          | Record creation timestamp       |
| `updatedAt`          | DateTime     | Auto-update           | Last update timestamp           |

**Indexes:** `athleteId`, `startDate`, `type`
**Relation:** Cascade delete on athlete deletion

### ActivityType Enum

Supported activity types from Strava:

```
RUN, RIDE, SWIM, HIKE, WALK, ALPINE_SKI, BACKCOUNTRY_SKI, CANOEING,
CROSSFIT, E_BIKE_RIDE, ELLIPTICAL, GOLF, HANDCYCLE, ICE_SKATE,
INLINE_SKATE, KAYAKING, KITESURF, NORDIC_SKI, ROCK_CLIMBING,
ROLLER_SKI, ROWING, SAIL, SKATEBOARD, SNOWBOARD, SNOWSHOE, SOCCER,
STAIRSTEPPER, STAND_UP_PADDLING, SURFING, VELOMOBILE, VIRTUAL_RIDE,
VIRTUAL_RUN, WEIGHT_TRAINING, WHEELCHAIR, WINDSURF, WORKOUT, YOGA
```

### TrainingProgram

- `id`: CUID (Primary Key)
- `athleteId`: String (Foreign Key)
- `name`: String
- `description`: String (Optional)
- `category`: String (strength, cardio, flexibility, etc.)
- `startDate`: DateTime (Optional)
- `endDate`: DateTime (Optional)
- `isActive`: Boolean (default: true)
- `createdAt`: DateTime
- `updatedAt`: DateTime

### Session

- `id`: CUID (Primary Key)
- `athleteId`: String (Foreign Key)
- `trainingProgramId`: String (Foreign Key, Optional)
- `name`: String
- `description`: String (Optional)
- `scheduledDate`: DateTime
- `completedDate`: DateTime (Optional)
- `status`: String (default: "pending")
- `notes`: String (Optional)
- `createdAt`: DateTime
- `updatedAt`: DateTime

### Goal

- `id`: CUID (Primary Key)
- `athleteId`: String (Foreign Key)
- `title`: String
- `description`: String (Optional)
- `targetValue`: Float (Optional)
- `currentValue`: Float (Optional)
- `unit`: String (km, kg, minutes, etc.)
- `deadline`: DateTime (Optional)
- `isAchieved`: Boolean (default: false)
- `createdAt`: DateTime
- `updatedAt`: DateTime

## Contributing

1. Create a new branch from `main`
2. Make your changes
3. Run tests and ensure code quality:
   ```bash
   npm run lint
   npm run type-check
   npm run format:check
   npm run test:coverage
   ```
4. Commit your changes (pre-commit hooks will run automatically)
5. Push to your fork and create a Pull Request

## CI/CD Pipeline

The GitHub Actions workflow runs on every push and PR:

- **Lint**: ESLint checks
- **Type Check**: TypeScript validation
- **Format**: Prettier formatting checks
- **Build**: Next.js build verification
- **Test**: Jest test suite with coverage (min 70%)

## Testing

Tests are located in the `__tests__/` directory and use Jest with React Testing Library.

```bash
# Run all tests
npm run test

# Run tests in watch mode during development
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

### Coverage Requirements

- Minimum 70% coverage for all files in `lib/`
- Coverage report generated in `coverage/` directory

## License

[MIT](LICENSE)
