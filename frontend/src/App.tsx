import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AppShell } from './components/layout/AppShell';

// Pages
import { DashboardPage } from './pages/DashboardPage';
import { MyAssessmentsPage } from './pages/MyAssessmentsPage';
import { PreAssessmentPage } from './pages/PreAssessmentPage';
import { AssessmentBankPage } from './pages/AssessmentBankPage';
import { CreateAssessmentWizard } from './pages/CreateAssessmentWizard';
import { QuestionBankPage } from './pages/QuestionBankPage';
import { QuestionEditorPage } from './pages/QuestionEditorPage';
import { ImportQuestionsPage } from './pages/ImportQuestionsPage';
import { ImportReviewPage } from './pages/ImportReviewPage';
import { AIGenerationPage } from './pages/AIGenerationPage';
import { AssessmentBuilderPage } from './pages/AssessmentBuilderPage';
import { ActiveAssessmentPage } from './pages/ActiveAssessmentPage';
import { ResultsDashboardPage } from './pages/ResultsDashboardPage';
import { DetailedReviewPage } from './pages/DetailedReviewPage';
import { RevisionCenterPage } from './pages/RevisionCenterPage';
import { PerformanceAnalyticsPage } from './pages/PerformanceAnalyticsPage';
import { AttemptHistoryPage } from './pages/AttemptHistoryPage';
import { AISettingsPage } from './pages/AISettingsPage';
import { AppearanceSettingsPage } from './pages/AppearanceSettingsPage';
import { DataManagementPage } from './pages/DataManagementPage';
import { ApplicationPreferencesPage } from './pages/ApplicationPreferencesPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { UserDirectoryPage } from './pages/admin/UserDirectoryPage';
import { AuthGuard } from './components/auth/AuthGuard';

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          {/* Authentication Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Main App with Shell (Protected by AuthGuard) */}
          <Route element={
            <AuthGuard>
              <AppShell />
            </AuthGuard>
          }>
            <Route path="/" element={<DashboardPage />} />
            
            {/* Workspace */}
            <Route path="/assessments" element={<MyAssessmentsPage />} />
            <Route path="/assessments/:id/instructions" element={<PreAssessmentPage />} />
            <Route path="/assessments/:id/pre" element={<PreAssessmentPage />} />
            <Route path="/assessments/:id/bank" element={<AssessmentBankPage />} />
            <Route path="/create-assessment" element={<CreateAssessmentWizard />} />
            <Route path="/create-wizard" element={<CreateAssessmentWizard />} />
            <Route path="/questions" element={<QuestionBankPage />} />
            <Route path="/questions/new" element={<QuestionEditorPage />} />
            <Route path="/questions/:id/edit" element={<QuestionEditorPage />} />
            <Route path="/imports" element={<ImportQuestionsPage />} />
            <Route path="/import" element={<ImportQuestionsPage />} />
            <Route path="/imports/:jobId" element={<ImportReviewPage />} />
            <Route path="/review-generated" element={<AIGenerationPage />} />
            <Route path="/builder" element={<AssessmentBuilderPage />} />
            <Route path="/assessments/:id/edit" element={<AssessmentBuilderPage />} />

            {/* Assessment Session (distraction-free rendering inside AppShell) */}
            <Route path="/session/:token" element={<ActiveAssessmentPage />} />

            {/* Results & Review */}
            <Route path="/results/:resultId" element={<ResultsDashboardPage />} />
            <Route path="/results/:resultId/review" element={<DetailedReviewPage />} />

            {/* Learning */}
            <Route path="/revision" element={<RevisionCenterPage />} />
            <Route path="/analytics" element={<PerformanceAnalyticsPage />} />
            <Route path="/history" element={<AttemptHistoryPage />} />

            {/* Settings */}
            <Route path="/settings/ai" element={<AISettingsPage />} />
            <Route path="/settings/appearance" element={<AppearanceSettingsPage />} />
            <Route path="/settings/data" element={<DataManagementPage />} />
            <Route path="/settings/preferences" element={<ApplicationPreferencesPage />} />

            {/* Administration (Admin only) */}
            <Route path="/admin/users" element={<AuthGuard requireAdmin><UserDirectoryPage /></AuthGuard>} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
};

export default App;
