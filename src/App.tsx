import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import ResultsPage from './pages/ResultsPage';
import SavedSearchesPage from './pages/SavedSearchesPage';
import SavedItemsPage from './pages/SavedItemsPage';
import PricingPage from './pages/PricingPage';
import SuccessPage from './pages/SuccessPage';
import SignUpPage from './pages/SignUpPage';
import SignInPage from './pages/SignInPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import NotFoundPage from './pages/NotFoundPage';
import ErrorBoundary from './components/ui/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          {/* Authentication routes without layout */}
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/signin" element={<SignInPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          
          {/* Main app routes with layout */}
          <Route path="/*" element={
            <Layout>
              <Routes>
                <Route path="/\" element={<HomePage />} />
                <Route path="/results" element={<ResultsPage />} />
                <Route path="/saved-searches" element={<SavedSearchesPage />} />
                <Route path="/saved-items" element={<SavedItemsPage />} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/success" element={<SuccessPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Layout>
          } />
        </Routes>
        
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#333',
              color: '#fff',
            },
          }}
        />
      </Router>
    </ErrorBoundary>
  );
}

export default App;