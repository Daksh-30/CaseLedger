import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { Dashboard }    from './pages/Dashboard';
import { CaseList }     from './pages/CaseList';
import { CaseDetail }   from './pages/CaseDetail';
import { FileCase }     from './pages/FileCase';
import { VerifyRecord } from './pages/VerifyRecord';
import { CaseUpdates }  from './pages/CaseUpdates';
import { AuditTrail }   from './pages/AuditTrail';
import { AdminPanel }   from './pages/AdminPanel';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/"         element={<Dashboard />}    />
        <Route path="/cases"    element={<CaseList />}     />
        <Route path="/cases/:id" element={<CaseDetail />}  />
        <Route path="/file"     element={<FileCase />}     />
        <Route path="/verify"   element={<VerifyRecord />} />
        <Route path="/updates"  element={<CaseUpdates />}  />
        <Route path="/audit"    element={<AuditTrail />}   />
        <Route path="/admin"    element={<AdminPanel />}   />
        <Route path="*"         element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
