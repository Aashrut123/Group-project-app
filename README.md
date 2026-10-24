# Syncro

Syncro is an Expo and React Native app for student teams to share calendars, coordinate project tasks, and manage group membership. It uses TypeScript, Expo Router, Supabase Auth, PostgreSQL Row Level Security, and Supabase Realtime.

## What is included

- Email and password sign-up, login, persistent sessions, password reset, profile display name, and logout.
- Multiple groups, descriptions and colors, single-use invitation codes, member directory, roles, promotion to admin, leaving, and member removal.
- A combined calendar with month, week, and agenda views, group filters, event types, event location, and descriptions.
- Group task lists, priorities, due dates, single-member assignments, status changes, requirements, and task comments.
- Home dashboard with near-term calendar items and work, plus a personal task view.
- PostgreSQL schema with indexes, constraints, membership-aware RLS, invitation RPCs, activity records, and realtime publication for events, tasks, and membership.

## Requirements

- Node.js **22.13 or later** for the current Expo SDK 57 baseline.
- npm.
- An iPhone with the Expo Go app for device preview, or the iOS Simulator on a Mac with Xcode.
- A Supabase project.

The current Expo SDK 57 line targets React Native 0.86 and iOS 16.4 or later. Expo Go compatibility follows the SDK available in the Expo Go app; if your installed Expo Go does not support this SDK, update Expo Go or use an EAS development build. iOS Simulator builds require macOS and Xcode.

## 1. Open and install

Open the `GroupSync` folder in Visual Studio Code. In the integrated terminal:

```sh
npm install
npx expo install --fix
```

`expo install --fix` aligns Expo-managed package versions with the installed Expo SDK. It may update `package.json` and the lockfile.

## 2. Create and configure Supabase

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. In **Project Settings → API**, copy the Project URL and the **publishable key** (`sb_publishable_…`). A legacy anon key is also accepted. Never use or place the service-role/secret key in this mobile app.
3. Copy `.env.example` to `.env` in the `GroupSync` folder and set:

   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
   ```

   Expo exposes `EXPO_PUBLIC_` values in the client bundle. They are public client values; database security is enforced by RLS, not by hiding these values.

4. In the Supabase Dashboard, open **SQL Editor**, paste and run [`GroupSync/supabase/migrations/202610100001_initial_schema.sql`](GroupSync/supabase/migrations/202610100001_initial_schema.sql), then [`GroupSync/supabase/migrations/202610190002_project_platform.sql`](GroupSync/supabase/migrations/202610190002_project_platform.sql). The first migration creates profiles, groups, events, tasks, meetings, RLS, and invitations. The second adds project goals, milestones, task dependencies, progress logs, availability, planning sessions, in-app notifications, and the `blocked` task status. Apply the second file to a database that already ran the first one. It does not delete existing rows.
5. Optional AI plans: deploy `supabase/functions/plan` and set the Edge Function secret `OPENAI_API_KEY`. The mobile app never contains that key. If the function is missing, the app uses the built-in planner and labels the result as such. Suggested meetings and reschedule proposals are not written until someone accepts them.
6. Create a public Storage bucket named `avatars` if profile photos should upload. The second migration attempts to create it.
7. In **Authentication → URL Configuration**, add the app callback URL to the allowed redirect URLs. For installed builds use `groupsync://callback`. Expo Go generates a temporary development URL; add that URL (or an appropriately scoped `exp://**` pattern for local development) while testing password resets. Confirm the project email settings allow the sign-up flow you want.
8. Restart Expo after changing `.env` so Metro reloads the variables.

The migration's invitation code is random, stored only as a SHA-256 digest, expires, and can be redeemed once. The join function checks and consumes it inside a database transaction. Group membership and group content access are controlled by RLS and database functions.

## 3. Run the app

Start the development server from the project folder:

```sh
npm start
```

For an iPhone using Expo Go, install Expo Go from the App Store, ensure the phone and computer are on the same network, then scan the QR code shown by Expo. If local network discovery is blocked, run:

```sh
npm start -- --tunnel
```

On macOS with Xcode and an iOS Simulator installed:

```sh
npm run ios
```

To run the web preview:

```sh
npm run web
```

## Quality checks

```sh
npm run typecheck
npm run lint
npm test
npx expo install --check
```

`npm test` runs the planner, conflict, permission, and reschedule checks. It does not sign in to Supabase.

The app's database-backed screens require the migration and valid `.env` keys. If the app opens without those values, the authentication screen explains how to configure the connection.

## Project structure

```text
GroupSync/
├── app/                    Expo Router screens and tab navigation
├── components/             Shared interface components
├── features/               Authentication and Supabase data access
├── hooks/                  Workspace state and realtime refresh
├── lib/                    Supabase client, formatting, design tokens
├── types/                  Shared database-facing TypeScript types
└── supabase/migrations/    PostgreSQL schema, policies, and functions
```

## Data and permissions

- Profiles are visible to the account owner and people who share a group with them.
- Only authenticated users can create groups; the creator is added as owner by a database trigger.
- Group content is visible only to current group members. Admin/owner-only group settings, member role changes, and invitations use database-side checks.
- Members can contribute events and tasks. Creators and group admins can edit/remove events; members can update shared task status. Task assignments must point to a current group member.
- The client uses only the Supabase publishable/anon key. The service-role key is never needed in the app.
- Realtime updates are subscribed for events, tasks, and membership; the master calendar queries the same shared event rows rather than copying them.

## Current scope notes

- Calendar month and week views show dots for dates with events and an agenda for the selected day. The agenda view lists upcoming events. Event creators and group admins can edit or delete calendar items.
- Task details support editing by the task creator, status changes, checklist requirements, comments, and deletion. Assignments currently select one group member per task in the create flow; the schema supports multiple assignees.
- Meeting items can be added to calendars using the `meeting` type. The database also includes dedicated meeting and attendee tables; a full meeting-notes/attendee editor and a standalone notifications screen are not yet surfaced in this first app version.
- This project has not been connected to a real Supabase instance in this workspace. Configure credentials and apply the migration before testing account flows or database access.

## Troubleshooting

- **Missing Supabase config:** Confirm `.env` is in the project root and uses the exact `EXPO_PUBLIC_` variable names. Stop and restart Expo after changing it.
- **Invalid invitation:** Invitation codes are single-use and expire after 14 days by default. Ask an owner/admin to create another code.
- **RLS error:** Check that the migration ran successfully and that the signed-in user is an active member of the selected group.
- **Expo dependency warning:** Run `npx expo install --fix`, then restart Metro with `npx expo start --clear`.
