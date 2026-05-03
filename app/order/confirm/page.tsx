import { Suspense } from 'react';
import ConfirmContent from './confirm-content';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export default function OrderConfirmPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-roma-dark text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-roma-gold"></div>
      </div>
    }>
      <ConfirmContent />
    </Suspense>
  );
}