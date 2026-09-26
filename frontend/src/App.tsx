import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';

import { PlaceholderPage } from './components/common/PlaceholderPage';
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
import { JudgePlaceholderPage } from './pages/judge/JudgePlaceholderPage';
import { ParticipantPlaceholderPage } from './pages/participant/ParticipantPlaceholderPage';

import { OrganizerDashboard } from './pages/organizer/OrganizerDashboard';
import { OrganizerLayout } from './pages/organizer/OrganizerLayout';
import { OrganizerPlaceholderPage } from './pages/organizer/OrganizerPlaceholderPage';
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
      <Routes>

        {/* PUBLIC */}

        <Route
          path="/"
          element={
            <PlaceholderPage
              eyebrow="[ CODEARENA / PUBLIC ]"
              title="ENTER THE ARENA."
              description="CodeArena public landing page."
            />
          }
        />

        <Route
          path="/events"
          element={
            <PlaceholderPage
              eyebrow="[ PUBLIC / EVENTS ]"
              title="EVENTS"
              description="Browse hackathons and event information."
            />
          }
        />

        <Route path="/gallery" element={<GalleryPage />} />

        <Route
          path="/projects/:projectId"
          element={
            <PlaceholderPage
              eyebrow="[ PUBLIC / PROJECT ]"
              title="PROJECT DETAILS"
              description="Project information will appear here."
            />
          }
        />


        {/* AUTH */}

        <Route path="/login" element={<LoginPage />} />

        <Route path="/register" element={<RegisterPage />} />


        {/* PARTICIPANT */}

        <Route
          path="/participant"
          element={<ParticipantLayout />}
        >
          <Route
            index
            element={<ParticipantDashboard />}
          />

          <Route path="team" element={<TeamPage />} />

          <Route path="submission" element={<SubmissionPage />} />
        </Route>


        {/* JUDGE */}

        <Route
          path="/judge"
          element={<JudgeLayout />}
        >
          <Route
            index
            element={<JudgeDashboard />}
          />

          <Route path="assignments" element={<JudgeAssignmentsPage />} />

          <Route
            path="review/:projectId"
            element={<JudgeReviewPage />}
          />


          <Route path="rubric" element={<JudgeScoringGuidePage />} />
        </Route>




        {/* ORGANIZER */}

        <Route
          path="/organizer"
          element={<OrganizerLayout />}
        >
          <Route
            index
            element={<OrganizerDashboard />}
          />

          <Route path="events" element={<EventSettingsPage />} />

          <Route path="teams" element={<OrganizerTeamsPage />} />

          <Route path="projects" element={<OrganizerProjectsPage />} />

          <Route path="rubric" element={<OrganizerRubricPage />} />

          <Route
            path="judges"
            element={<OrganizerJudgeAssignmentsPage />}
          />

          <Route path="results" element={<OrganizerResultsPage />} />

          <Route path="activity" element={<OrganizerActivityPage />} />
        </Route>


        {/* FALLBACK */}

        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />

      </Routes>
    </BrowserRouter>
  );
}
