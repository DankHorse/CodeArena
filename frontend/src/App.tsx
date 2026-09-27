import { SessionProvider } from './auth/SessionProvider';
import { ProtectedRoute } from './auth/ProtectedRoute';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';

import { paths } from './routes';
import { LandingPage } from './pages/public/LandingPage';
import { EventsPage } from './pages/public/EventsPage';
import { EventDetailsPage } from './pages/public/EventDetailsPage';
import { ProjectDetailsPage } from './pages/public/ProjectDetailsPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { GalleryPage } from './pages/public/GalleryPage';
import { ParticipantDashboard } from './pages/participant/ParticipantDashboard';
import { ParticipantLayout } from './pages/participant/ParticipantLayout';
import { TeamPage } from './pages/participant/TeamPage';
import { SubmissionPage } from './pages/participant/SubmissionPage';
import { JudgeDashboard } from './pages/judge/JudgeDashboard';
import { JudgeAssignmentsPage } from './pages/judge/JudgeAssignmentsPage';
import { JudgeReviewPage } from './pages/judge/JudgeReviewPage';
import { JudgeScoringGuidePage } from './pages/judge/JudgeScoringGuidePage';
import { JudgeLayout } from './pages/judge/JudgeLayout';

import { OrganizerDashboard } from './pages/organizer/OrganizerDashboard';
import { OrganizerLayout } from './pages/organizer/OrganizerLayout';
import { EventSettingsPage } from './pages/organizer/EventSettingsPage';
import { OrganizerTeamsPage } from './pages/organizer/OrganizerTeamsPage';
import { OrganizerProjectsPage } from './pages/organizer/OrganizerProjectsPage';
import { OrganizerRubricPage } from './pages/organizer/OrganizerRubricPage';
import { OrganizerJudgeAssignmentsPage } from './pages/organizer/OrganizerJudgeAssignmentsPage';
import { OrganizerResultsPage } from './pages/organizer/OrganizerResultsPage';
import { OrganizerActivityPage } from './pages/organizer/OrganizerActivityPage';

export default function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
      <Routes>

        {/* PUBLIC */}
        <Route path={paths.home} element={<LandingPage />} />
        <Route path={paths.events} element={<EventsPage />} />
        <Route path={paths.eventPattern} element={<EventDetailsPage />} />
        <Route path={paths.gallery()} element={<GalleryPage />} />
        <Route path={paths.projectPattern} element={<ProjectDetailsPage />} />

        {/* AUTH */}

        <Route path={paths.login} element={<LoginPage />} />

        <Route path={paths.register} element={<RegisterPage />} />


        {/* PARTICIPANT */}

        <Route
          path={paths.participant.home}
          element={<ProtectedRoute role="participant"><ParticipantLayout /></ProtectedRoute>}
        >
          <Route
            index
            element={<ParticipantDashboard />}
          />

          <Route path={paths.participant.team} element={<TeamPage />} />

          <Route path={paths.participant.submission} element={<SubmissionPage />} />
        </Route>


        {/* JUDGE */}

        <Route
          path={paths.judge.home}
          element={<ProtectedRoute role="judge"><JudgeLayout /></ProtectedRoute>}
        >
          <Route
            index
            element={<JudgeDashboard />}
          />

          <Route path={paths.judge.assignments} element={<JudgeAssignmentsPage />} />

          <Route
            path={paths.judge.reviewPattern}
            element={<JudgeReviewPage />}
          />


          <Route path={paths.judge.rubric} element={<JudgeScoringGuidePage />} />
        </Route>




        {/* ORGANIZER */}

        <Route
          path={paths.organizer.home}
          element={<ProtectedRoute role="organizer"><OrganizerLayout /></ProtectedRoute>}
        >
          <Route
            index
            element={<OrganizerDashboard />}
          />

          <Route path={paths.organizer.events} element={<EventSettingsPage />} />

          <Route path={paths.organizer.teams} element={<OrganizerTeamsPage />} />

          <Route path={paths.organizer.projects} element={<OrganizerProjectsPage />} />

          <Route path={paths.organizer.rubric} element={<OrganizerRubricPage />} />

          <Route
            path={paths.organizer.judges}
            element={<OrganizerJudgeAssignmentsPage />}
          />

          <Route path={paths.organizer.results} element={<OrganizerResultsPage />} />

          <Route path={paths.organizer.activity} element={<OrganizerActivityPage />} />
        </Route>


        {/* FALLBACK */}

        <Route
          path="*"
          element={<Navigate to={paths.home} replace />}
        />

      </Routes>
      </SessionProvider>
    </BrowserRouter>
  );
}
