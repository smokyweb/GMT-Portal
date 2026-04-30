import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
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
import AuditLogPage from './pages/AuditLogPage';
import BrowseNofos from './pages/BrowseNofos';
import NewApplication from './pages/NewApplication';
import MyApplications from './pages/MyApplications';
import MyFundingRequests from './pages/MyFundingRequests';
import MyReports from './pages/MyReports';
import MyOrganization from './pages/MyOrganization';
import Analytics from './pages/Analytics';
import GrantTimeline from './pages/GrantTimeline';
import DocumentVault from './pages/DocumentVault';
import BudgetTracker from './pages/BudgetTracker';
import ReportsModule from './pages/ReportsModule';
import ReportBuilder from './pages/ReportBuilder';
import Messages from './pages/Messages';
import MilestoneTracker from './pages/MilestoneTracker';
import WorkflowRules from './pages/WorkflowRules';
import FinancialOverview from './pages/FinancialOverview';
import DocumentTemplates from './pages/DocumentTemplates';
import DocumentsInbox from './pages/DocumentsInbox';
import AdminPanel from './pages/AdminPanel';
import ISCDashboard from './pages/ISCDashboard';
import UserProfile from './pages/UserProfile';
import SubrecipientPortal from './pages/SubrecipientPortal';
import Login from './pages/Login';

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
        <Route path="/nofos" element={<NofoManagement />} />
        <Route path="/applications" element={<ApplicationReviewQueue />} />
        <Route path="/funding-requests" element={<FundingRequestReview />} />
        <Route path="/reports" element={<ReportsCompliance />} />
        <Route path="/compliance" element={<ComplianceFlags />} />
        <Route path="/programs" element={<GrantPrograms />} />
        <Route path="/organizations" element={<Organizations />} />
        <Route path="/audit-log" element={<AuditLogPage />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/documents" element={<DocumentVault />} />
        <Route path="/grant-timeline" element={<GrantTimeline />} />
        <Route path="/budget-tracker" element={<BudgetTracker />} />
        <Route path="/reports-module" element={<ReportsModule />} />
        <Route path="/report-builder" element={<ReportBuilder />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/milestones" element={<MilestoneTracker />} />
        <Route path="/workflow" element={<WorkflowRules />} />
        <Route path="/financials" element={<FinancialOverview />} />
        <Route path="/document-templates" element={<DocumentTemplates />} />
        <Route path="/documents-inbox" element={<DocumentsInbox />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/isc" element={<ISCDashboard />} />
        <Route path="/profile" element={<UserProfile />} />
        <Route path="/browse-nofos" element={<BrowseNofos />} />
        <Route path="/new-application" element={<NewApplication />} />
        <Route path="/my-applications" element={<MyApplications />} />
        <Route path="/my-funding-requests" element={<MyFundingRequests />} />
        <Route path="/my-reports" element={<MyReports />} />
        <Route path="/my-organization" element={<MyOrganization />} />
        <Route path="/subrecipient-portal" element={<SubrecipientPortal />} />
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