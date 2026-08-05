import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { ThemeProvider } from '@/lib/ThemeContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Layout from './components/Layout';
import Home from './pages/Home';
import NofoManagement from './pages/NofoManagement';
import ApplicationReviewQueue from './pages/ApplicationReviewQueue';
import FundingRequestReview from './pages/FundingRequestReview';
import ReportsCompliance from './pages/ReportsCompliance';
import ComplianceFlags from './pages/ComplianceFlags';
import GrantPrograms from './pages/GrantPrograms';
import Organizations from './pages/Organizations';
import OrganizationProfile from './pages/OrganizationProfile';
import EmailSettings from './pages/EmailSettings';
import AuditLogPage from './pages/AuditLogPage';
import BrowseNofos from './pages/BrowseNofos';
import NewApplication from './pages/NewApplication';
import MyApplications from './pages/MyApplications';
import MyFundingRequests from './pages/MyFundingRequests';
import MyReports from './pages/MyReports';
import MyOrganization from './pages/MyOrganization';
import Analytics from './pages/Analytics';
import GrantTimeline from './pages/GrantTimeline';
import Documents from './pages/Documents';
import BudgetTracker from './pages/BudgetTracker';
import ReportsModule from './pages/ReportsModule';
import ReportBuilder from './pages/ReportBuilder';
import Messages from './pages/Messages';
import MilestoneTracker from './pages/MilestoneTracker';
import WorkflowRules from './pages/WorkflowRules';
import FinancialOverview from './pages/FinancialOverview';

import DocumentTemplates from './pages/DocumentTemplates';
import AdminPanel from './pages/AdminPanel';
import AdminApplicationsDocReview from './pages/AdminApplicationsDocReview';
import ISCDashboard from './pages/ISCDashboard';
import UserProfile from './pages/UserProfile';
import SubrecipientHome from './pages/SubrecipientHome';
import SubrecipientDocumentsInbox from './pages/SubrecipientDocumentsInbox';
import AdminHub from './pages/AdminHub';
import FederalDashboard from './pages/FederalDashboard';
import BudgetAmendmentsDashboard from './pages/BudgetAmendmentsDashboard';
import Credits from './pages/Credits';
import SystemHealthDashboard from './pages/SystemHealthDashboard';

import NotificationRules from './pages/NotificationRules';
import OrgDeepDive from './pages/OrgDeepDive';
import TemplateManager from './pages/TemplateManager';
import PortfolioSummary from './pages/PortfolioSummary';
import CloseoutChecklist from './pages/CloseoutChecklist';

// Role guard — redirects non-admins to home
const RequireAdmin = ({ children }) => {
  const { user } = useAuth();
  const ADMIN_ROLES = ['admin', 'reviewer', 'isc_admin', 'federal_admin', 'federal_officer'];
  if (!user) return null;
  if (!ADMIN_ROLES.includes(user.role)) return <Navigate to="/" replace />;
  return children;
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/nofos" element={<RequireAdmin><NofoManagement /></RequireAdmin>} />
        <Route path="/applications" element={<RequireAdmin><ApplicationReviewQueue /></RequireAdmin>} />
        <Route path="/funding-requests" element={<RequireAdmin><FundingRequestReview /></RequireAdmin>} />
        <Route path="/reports-compliance" element={<RequireAdmin><ReportsCompliance /></RequireAdmin>} />
        <Route path="/compliance-flags" element={<RequireAdmin><ComplianceFlags /></RequireAdmin>} />
        <Route path="/grant-programs" element={<RequireAdmin><GrantPrograms /></RequireAdmin>} />
        <Route path="/organizations" element={<RequireAdmin><Organizations /></RequireAdmin>} />
        <Route path="/organizations/:id" element={<RequireAdmin><OrganizationProfile /></RequireAdmin>} />
        <Route path="/email-settings" element={<RequireAdmin><EmailSettings /></RequireAdmin>} />
        <Route path="/audit-log" element={<RequireAdmin><AuditLogPage /></RequireAdmin>} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/grant-timeline" element={<GrantTimeline />} />
        <Route path="/budget-tracker" element={<BudgetTracker />} />
        <Route path="/reports-module" element={<ReportsModule />} />
        <Route path="/report-builder" element={<ReportBuilder />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/milestones" element={<MilestoneTracker />} />
        <Route path="/workflow" element={<RequireAdmin><WorkflowRules /></RequireAdmin>} />
        <Route path="/financials" element={<FinancialOverview />} />
          <Route path="/financial-reporting" element={<Navigate to="/financials" replace />} />
        <Route path="/document-templates" element={<RequireAdmin><DocumentTemplates /></RequireAdmin>} />
        <Route path="/admin" element={<RequireAdmin><AdminPanel /></RequireAdmin>} />
        <Route path="/admin-applications" element={<RequireAdmin><AdminApplicationsDocReview /></RequireAdmin>} />
        <Route path="/isc" element={<RequireAdmin><ISCDashboard /></RequireAdmin>} />
        <Route path="/profile" element={<UserProfile />} />
        <Route path="/browse-nofos" element={<BrowseNofos />} />
        <Route path="/new-application" element={<NewApplication />} />
        <Route path="/my-applications" element={<MyApplications />} />
        <Route path="/my-funding-requests" element={<MyFundingRequests />} />
        <Route path="/my-reports" element={<MyReports />} />
        <Route path="/my-organization" element={<MyOrganization />} />
        <Route path="/subrecipient-portal" element={<SubrecipientHome />} />
        <Route path="/subrecipient-dashboard" element={<SubrecipientHome />} />
        <Route path="/documents-inbox" element={<SubrecipientDocumentsInbox />} />
        <Route path="/admin-hub" element={<RequireAdmin><AdminHub /></RequireAdmin>} />
        <Route path="/budget-amendments" element={<BudgetAmendmentsDashboard />} />
        <Route path="/credits" element={<Credits />} />
        <Route path="/admin-health" element={<RequireAdmin><SystemHealthDashboard /></RequireAdmin>} />

        <Route path="/notification-rules" element={<NotificationRules />} />
        <Route path="/org-deep-dive" element={<OrgDeepDive />} />
        <Route path="/template-manager" element={<TemplateManager />} />
        <Route path="/portfolio-summary" element={<PortfolioSummary />} />
        {/* Closeout Checklist removed - not fully built */}
        <Route path="*" element={<PageNotFound />} />
      </Route>
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/*" element={<AuthenticatedApp />} />
            </Routes>
          </Router>
          <Toaster />
        </QueryClientProvider>
      </ThemeProvider>
    </AuthProvider>
  )
}

export default App