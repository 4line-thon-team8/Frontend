import { BrowserRouter } from 'react-router';
import AppRouter from './router';
import GradeAnalysisProvider from './GradeAnalysisProvider';

export default function App() {
  return <BrowserRouter><GradeAnalysisProvider><AppRouter /></GradeAnalysisProvider></BrowserRouter>;
}
