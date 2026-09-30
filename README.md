# CodeArena

**CodeArena** is an open-source, self-hostable hackathon management and judging platform built for **DOGFOOD 2026**.

It manages the complete hackathon lifecycle — from participant registration and team formation to project submissions, judge assignments, scoring, normalization, results, and audit-ready event management.

The platform is designed to run locally using Docker without requiring external cloud services.

---

## What CodeArena Does

CodeArena brings organizers, participants, and judges into one unified platform.

### Participants
- Create and manage teams
- Join teams using invite codes
- Browse hackathon events
- Create project submissions
- Save submission drafts
- Submit projects before deadlines
- Access public project galleries

### Organizers
- Manage hackathon events
- View registered teams
- Monitor submitted projects
- Create and manage scoring rubrics
- Add judges to the judging pool
- Assign projects to judges
- Track judging progress
- Recalculate judging results
- Export result snapshots
- Inspect event activity

### Judges
- View assigned projects
- Access the active scoring rubric
- Score projects criterion-by-criterion
- Save evaluation drafts
- Submit final evaluations
- Lock completed reviews
- Track judging progress independently

---

## Fair & Normalized Judging

CodeArena goes beyond simple score averaging.

Judges evaluate projects using weighted rubric criteria, while the backend handles result calculation and **judge-score normalization**.

This helps reduce scoring bias caused by judges who consistently score higher or lower than others.

The frontend never calculates official scores — result generation remains backend-authoritative for consistency and integrity.

---

## Key Features

- Role-based access and authorization
- Event management
- Team formation
- Project submissions
- Submission deadline enforcement
- Public project gallery
- Versioned scoring rubrics
- Judge assignment workflow
- Judge workload tracking
- Independent judging
- Draft and locked evaluations
- Weighted criterion scoring
- Judge score normalization
- Result snapshots
- CSV result export
- Organizer activity monitoring
- Docker-based local deployment
- PostgreSQL persistence
- Offline-friendly architecture

---
