import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useEffect } from 'react';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import ResultsPage from './pages/ResultsPage';
import SavedItemsPage from './pages/SavedSearchesPage';
import PricingPage from './pages/PricingPage';
import SuccessPage from './pages/SuccessPage';
import SignUpPage from './pages/SignUpPage';
import SignInPage from './pages/SignInPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import NotFoundPage from './pages/NotFoundPage';
import ErrorBoundary from './components/ui/ErrorBoundary';
import { loadCategories } from './lib/ebayCategories';

function App() {
  // Initialize category system when app starts
  useEffect(() => {
    const initCategories = async () => {
      try {
        console.log('🚀 Initializing eBay category system...');
        await loadCategories();
        console.log('✅ Category system ready');
      } catch (error) {
        console.warn('⚠️ Category system initialization failed:', error);
        // Non-blocking - app continues to work without categories
      }
    };

    initCategories();
  }, []);

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
                <Route path="/" element={<HomePage />} />
                <Route path="/results" element={<ResultsPage />} />
                <Route path="/saved-items" element={<SavedItemsPage />} />
                <Route path="/saved-searches" element={<SavedItemsPage />} />
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
            duration: 500,
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