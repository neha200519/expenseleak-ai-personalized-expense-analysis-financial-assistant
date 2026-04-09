import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import AccessDeniedScreen from "./components/AccessDeniedScreen";
import Footer from "./components/Footer";
import Header from "./components/Header";
import ProfileSetupModal from "./components/ProfileSetupModal";
import SplashScreen from "./components/SplashScreen";
import { ThemeProvider } from "./context/ThemeContext";
import { useInternetIdentity } from "./hooks/useInternetIdentity";
import {
  useNotificationPermission,
  useRiskAlertNotifications,
} from "./hooks/useNotifications";
import { useGetCallerUserProfile } from "./hooks/useQueries";
import AddExpensePage from "./pages/AddExpensePage";
import AnalyticsPage from "./pages/AnalyticsPage";
import CalculatorPage from "./pages/CalculatorPage";
import ChatAssistantPage from "./pages/ChatAssistantPage";
import DocumentsPage from "./pages/DocumentsPage";
import ExpenseHistoryPage from "./pages/ExpenseHistoryPage";
import HomePage from "./pages/HomePage";
import InsightsPage from "./pages/InsightsPage";
import MapsPage from "./pages/MapsPage";

const queryClient = new QueryClient();

function Layout() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

const rootRoute = createRootRoute({
  component: Layout,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});

const addExpenseRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/add-expense",
  component: AddExpensePage,
});

const insightsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/insights",
  component: InsightsPage,
});

const analyticsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/analytics",
  component: AnalyticsPage,
});

const historyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/history",
  component: ExpenseHistoryPage,
});

const chatRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/chat",
  component: ChatAssistantPage,
});

const calculatorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/calculator",
  component: CalculatorPage,
});

const documentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/documents",
  component: DocumentsPage,
});

const mapsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/maps",
  component: MapsPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  addExpenseRoute,
  insightsRoute,
  analyticsRoute,
  historyRoute,
  chatRoute,
  calculatorRoute,
  documentsRoute,
  mapsRoute,
]);

const router = createRouter({ routeTree });

function AppContent() {
  const { identity, isInitializing } = useInternetIdentity();
  const {
    data: userProfile,
    isLoading: profileLoading,
    isFetched,
  } = useGetCallerUserProfile();
  const [showProfileModal, setShowProfileModal] = useState(false);

  const { permission } = useNotificationPermission();
  useRiskAlertNotifications(permission === "granted" && !!identity);

  const isAuthenticated = !!identity;

  useEffect(() => {
    if (
      isAuthenticated &&
      !profileLoading &&
      isFetched &&
      userProfile === null
    ) {
      setShowProfileModal(true);
    } else {
      setShowProfileModal(false);
    }
  }, [isAuthenticated, profileLoading, isFetched, userProfile]);

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full animate-pulse-slow" />
            <img
              src="/assets/expense leak ai logo.jpeg"
              alt="ExpenseLeak AI"
              className="relative h-24 w-24 rounded-full ring-4 ring-primary/30 object-cover mx-auto"
            />
          </div>
          <p className="mt-4 text-lg text-muted-foreground">
            Loading ExpenseLeak AI...
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AccessDeniedScreen />;
  }

  return (
    <>
      <RouterProvider router={router} />
      <ProfileSetupModal
        open={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />
    </>
  );
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
        <AppContent />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
