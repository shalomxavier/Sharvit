import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import LivePriceBanner from './components/LivePriceBanner';
import LowestOf24 from './components/LowestOf24';

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={
          <div className="min-h-screen">
            <LivePriceBanner />
            <Dashboard />
          </div>
        } />
        <Route path="/lowest-of-24" element={<LowestOf24 />} />
      </Routes>
    </Router>
  );
};

export default App;
