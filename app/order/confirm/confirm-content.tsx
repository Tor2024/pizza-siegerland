'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

export default function ConfirmContent() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'already-confirmed'>('loading');
  const [message, setMessage] = useState('');
  const [orderId, setOrderId] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Read token from URL on client side
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token');
    setToken(t);
  }, []);

  useEffect(() => {
    if (token === null) return; // Still loading token from URL
    if (!token) {
      setStatus('error');
      setMessage('Token fehlt!');
      return;
    }

    // Call API to confirm order
    fetch(`/api/order/confirm?token=${token}`)
      .then(res => res.text())
      .then(html => {
        // The API returns HTML, so we need to extract the status
        if (html.includes('bestätigt')) {
          if (html.includes('bereits')) {
            setStatus('already-confirmed');
          } else {
            setStatus('success');
            // Extract order ID from HTML
            const match = html.match(/#(\w+)/);
            if (match) setOrderId(match[1]);
          }
        } else {
          setStatus('error');
          setMessage('Ungültiger oder abgelaufener Token!');
        }
      })
      .catch(err => {
        setStatus('error');
        setMessage('Ein Fehler ist aufgetreten.');
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-roma-dark text-white flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full"
      >
        <div className="bg-white/5 backdrop-blur-md rounded-2xl p-8 text-center border border-white/10">
          {status === 'loading' && (
            <div>
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-roma-gold mx-auto mb-4"></div>
              <h2 className="text-xl font-bold mb-2">Bestellung wird bestätigt...</h2>
              <p className="text-white/60">Bitte warten Sie einen Moment.</p>
            </div>
          )}

          {status === 'success' && (
            <div>
              <div className="text-6xl mb-4">✅</div>
              <h2 className="text-2xl font-bold text-green-400 mb-4">Bestellung bestätigt!</h2>
              <div className="bg-white/10 rounded-xl p-4 mb-4 text-left">
                <p className="mb-2"><strong>Bestellung:</strong> #{orderId}</p>
                <p className="text-sm text-white/60">Vielen Dank! Ihre Bestellung wurde erfolgreich bestätigt.</p>
              </div>
              <p className="text-sm text-white/60 mb-6">
                Wir bereiten Ihre Bestellung jetzt zu. Die voraussichtliche Lieferzeit beträgt 25-35 Minuten.
              </p>
              <button 
                onClick={() => router.push('/')}
                className="w-full bg-roma-red hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-colors"
              >
                🍕 Zurück zur Website
              </button>
            </div>
          )}

          {status === 'already-confirmed' && (
            <div>
              <div className="text-6xl mb-4">ℹ️</div>
              <h2 className="text-2xl font-bold text-blue-400 mb-4">Bereits bestätigt</h2>
              <p className="text-white/60 mb-6">Diese Bestellung wurde bereits bestätigt!</p>
              <button 
                onClick={() => router.push('/')}
                className="w-full bg-roma-red hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-colors"
              >
                🍕 Zurück zur Website
              </button>
            </div>
          )}

          {status === 'error' && (
            <div>
              <div className="text-6xl mb-4">❌</div>
              <h2 className="text-2xl font-bold text-red-400 mb-4">Fehler</h2>
              <p className="text-white/60 mb-6">{message || 'Ein Fehler ist aufgetreten.'}</p>
              <button 
                onClick={() => router.push('/')}
                className="w-full bg-roma-red hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-colors"
              >
                🍕 Zurück zur Website
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}