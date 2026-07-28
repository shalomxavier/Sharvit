import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import LivePriceBanner from './components/LivePriceBanner';
import LowestOf24 from './components/LowestOf24';
import PureLowestOf24 from './components/PureLowestOf24';
import LowestOf24_3and6 from './components/LowestOf24_3and6';

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
        <Route path="/pure-lowest-of-24" element={<PureLowestOf24 />} />
        <Route
          path="/pure-lowest-of-24-09"
          element={<PureLowestOf24 collectionName="pure_lowest_of_24_09_collections" title="Pure Lowest of 24 - 0.9% Loss" />}
        />
        <Route path="/lowest-of-24-3-and-6" element={<LowestOf24_3and6 />} />
      </Routes>
    </Router>
  );
};

export default App;
