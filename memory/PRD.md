# IronLog — Product Requirements Document

## Overview
IronLog is a mobile-first fitness tracking app (React Native / Expo) focused on progressive overload and workout planning, inspired by Strong/Hevy but simpler.

## Tech Stack
- Frontend: Expo SDK 54 (expo-router), React Native, react-native-chart-kit
- Backend: FastAPI + MongoDB (motor)
- Auth: JWT email/password + Emergent Google Auth

## Core Features (MVP)
1. Authentication (email/password JWT + Google via Emergent Auth)
2. Workout Splits: create splits (PPL / Upper-Lower / Bro / Full Body / Custom), name days, assign exercises
3. Exercise Library: 55 preloaded exercises + custom user exercises
4. Active Workout Logging: sets (weight x reps), add/remove sets, rest timer (90s), progression suggestion based on last session
5. Analytics Dashboard: weekly volume bar chart (8 weeks), strength line chart per exercise, Personal Records list
6. Home Dashboard: stats (workouts, streak, total volume, weekly volume), recent workouts, CTA to start workout
7. Streak tracking (consecutive training days)

## API Endpoints (/api)
- POST /auth/register, /auth/login, /auth/google-session; GET /auth/me
- GET/POST /exercises
- GET/POST/PUT/DELETE /splits, GET /splits/{id}
- POST/GET /workouts, GET /workouts/last/{exercise_id}
- GET /analytics/summary, /analytics/volume, /analytics/strength/{exercise_id}, /analytics/prs

## Design
Dark theme ("Performance Pro" archetype): #0A0A0A background, #141414 surface, #FF3B30 (Electric Blaze) accent, #32D74B success. Bebas Neue for headings, DM Sans for body.
