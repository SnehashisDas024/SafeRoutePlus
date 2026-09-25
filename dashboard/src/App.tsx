import { BrowserRouter, Routes, Route } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage";
import LiveSharePage from "./pages/LiveSharePage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/share/:token" element={<LiveSharePage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
