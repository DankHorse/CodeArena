import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';

import { PlaceholderPage } from './components/common/PlaceholderPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ParticipantDashboard } from './pages/participant/ParticipantDashboard';
import { ParticipantLayout } from './pages/participant/ParticipantLayout';
import { ParticipantPlaceholderPage } from './pages/participant/ParticipantPlaceholderPage';

import { OrganizerDashboard } from './pages/organizer/OrganizerDashboard';
import { OrganizerLayout } from './pages/organizer/OrganizerLayout';
import { OrganizerPlaceholderPage } from './pages/organizer/OrganizerPlaceholderPage';

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

        <Route
          path="/gallery"
          element={
            <PlaceholderPage
              eyebrow="[ PUBLIC / PROJECT ARENA ]"
              title="PROJECT GALLERY"
              description="Browse submitted hackathon projects."
            />
          }
        />

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

          <Route
            path="team"
            element={
              <ParticipantPlaceholderPage
                eyebrow="[ PARTICIPANT / TEAM ]"
                title="TEAM CONTROL"
                description="Create, join and manage your hackathon team."
              />
            }
          />

          <Route
            path="submission"
            element={
              <ParticipantPlaceholderPage
                eyebrow="[ PARTICIPANT / SUBMISSION ]"
                title="PROJECT SUBMISSION"
                description="Build and manage your project submission."
              />
            }
          />
        </Route>


        {/* JUDGE */}

        <Route
          path="/judge"
          element={
            <PlaceholderPage
              eyebrow="[ JUDGE WORKSPACE ]"
              title="ASSIGNMENT QUEUE"
              description="Judge assignments will appear here."
            />
          }
        />

        <Route
          path="/judge/assignments/:assignmentId"
          element={
            <PlaceholderPage
              eyebrow="[ JUDGE / EVALUATION ]"
              title="EVALUATION TERMINAL"
              description="Project scoring will appear here."
            />
          }
        />


        {/* ORGANIZER */}

        <Route
          path="/organizer"
          element={<OrganizerLayout />}
        >
          <Route
            index
            element={<OrganizerDashboard />}
          />

          <Route
            path="events"
            element={
              <OrganizerPlaceholderPage
                eyebrow="[ ORGANIZER / EVENT ]"
                title="EVENT SETTINGS"
                description="Configure the current event, tracks and deadlines."
              />
            }
          />

          <Route
            path="teams"
            element={
              <OrganizerPlaceholderPage
                eyebrow="[ ORGANIZER / TEAMS ]"
                title="TEAMS"
                description="Manage participating teams and memberships."
              />
            }
          />

          <Route
            path="projects"
            element={
              <OrganizerPlaceholderPage
                eyebrow="[ ORGANIZER / PROJECTS ]"
                title="PROJECTS"
                description="Review submitted projects across the event."
              />
            }
          />

          <Route
            path="rubric"
            element={
              <OrganizerPlaceholderPage
                eyebrow="[ ORGANIZER / RUBRIC ]"
                title="SCORING RUBRIC"
                description="Configure judging criteria and weights."
              />
            }
          />

          <Route
            path="judges"
            element={
              <OrganizerPlaceholderPage
                eyebrow="[ ORGANIZER / JUDGES ]"
                title="JUDGE ASSIGNMENTS"
                description="Assign judges and monitor judging coverage."
              />
            }
          />

          <Route
            path="results"
            element={
              <OrganizerPlaceholderPage
                eyebrow="[ ORGANIZER / RESULTS ]"
                title="RESULTS & EXPORTS"
                description="Review results and export judging data."
              />
            }
          />

          <Route
            path="activity"
            element={
              <OrganizerPlaceholderPage
                eyebrow="[ ORGANIZER / ACTIVITY ]"
                title="ACTIVITY LOG"
                description="Review important platform activity."
              />
            }
          />
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
