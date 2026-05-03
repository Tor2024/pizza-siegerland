'use client';
import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/context/LanguageContext';
import { useCartStore } from '@/store/useCartStore';
import { FiX, FiCheck, FiCreditCard, FiTruck, FiClock } from 'react-icons/fi';

// Validation utilities
const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePhone = (phone: string): boolean => {
  // German phone format: +49 or 0 followed by digits, spaces, dashes allowed
  const phoneRegex = /^(\+49|0)[\d\s\-]{6,20}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
};

const validateZip = (zip: string): boolean => {
  // German ZIP: 5 digits
  const zipRegex = /^\d{5}$/;
  return zipRegex.test(zip);
};

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CheckoutModal({ isOpen, onClose }: CheckoutModalProps) {
  const { t } = useLanguage();
  const { items, subtotal, deliveryFee, total, removeItem, clearCart } = useCartStore();
  const [step, setStep] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [deliveryTime, setDeliveryTime] = useState('asap');
  const [address, setAddress] = useState({
    street: '',
    number: '',
    zip: '57072',
    city: 'Siegen',
    phone: '',
    email: '',
    note: ''
  });

  const paymentMethods = [
    { id: 'cash', name: 'Barzahlung bei Lieferung', icon: '💵' },
  ];
  const [selectedPayment, setSelectedPayment] = useState('cash');

  const applyPromoCode = () => {
    if (promoCode.toLowerCase() === 'roma10') {
      setPromoDiscount(subtotal() * 0.1);
    } else if (promoCode.toLowerCase() === 'roma20') {
      setPromoDiscount(subtotal() * 0.2);
    }
  };

  const finalTotal = total() - promoDiscount;

  const [hasPaid, setHasPaid] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [addressError, setAddressError] = useState('');
  const [agbAccepted, setAgbAccepted] = useState(false);
  const [trackId, setTrackId] = useState('');

  // New states for confirmation step
  const [createdOrderId, setCreatedOrderId] = useState('');
  const [enteredCode, setEnteredCode] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState('');

  const handleAddressChange = (field: string, value: string) => {
    setAddress(prev => ({...prev, [field]: value}));
    setAddressError('');
  };

  const handlePayment = async () => {
    if (hasPaid || isProcessing) return; // Prevent double submission
    setIsProcessing(true);
    setHasPaid(true);
    setOrderError('');
    
    try {
      // Generate track ID once when order is placed
      const newTrackId = `PR${Date.now().toString().slice(-6)}`;
      
      // Send order to server
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(item => ({
            id: item.id,
            name: item.name,
            size: item.size,
            price: item.price + item.toppings.reduce((a: number, t: any) => a + t.price, 0),
            quantity: item.quantity,
            toppings: item.toppings,
            image: item.image
          })),
          customer: {
            name: `${address.street} ${address.number}`,
            phone: address.phone,
            email: address.email || undefined,
            address: `${address.street} ${address.number}, ${address.zip} ${address.city}`,
            note: address.note || undefined
          },
          subtotal: subtotal(),
          deliveryFee: deliveryFee(),
          total: finalTotal,
          paymentMethod: selectedPayment,
          deliveryTime: deliveryTime,
          promoCode: promoCode || undefined,
          promoDiscount: promoDiscount > 0 ? promoDiscount : undefined
        })
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        setTrackId(newTrackId);
        setCreatedOrderId(result.orderId);
        setStep(3); // Move to confirmation step
        setIsProcessing(false);
        setHasPaid(false);
      } else {
        setOrderError(result.error || 'Bestellung fehlgeschlagen. Bitte versuchen Sie es erneut.');
        setIsProcessing(false);
        setHasPaid(false);
      }
    } catch (error) {
      setOrderError('Netzwerkfehler. Bitte überprüfen Sie Ihre Verbindung.');
      setIsProcessing(false);
      setHasPaid(false);
    }
  };

  const handleConfirmation = async () => {
    if (!enteredCode || enteredCode.length !== 6) {
      setConfirmError('Bitte geben Sie den 6-stelligen Code ein.');
      return;
    }
    setIsConfirming(true);
    setConfirmError('');
    try {
      const response = await fetch('/api/order/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: createdOrderId,
          confirmationCode: enteredCode
        })
      });
      const result = await response.json();
      if (response.ok && result.success) {
        // Confirmation successful
        clearCart();
        setIsSuccess(true);
        setStep(1); // reset step for next order
        setCreatedOrderId('');
        setEnteredCode('');
      } else {
        setConfirmError(result.error || 'Ungültiger Code. Bitte versuchen Sie es erneut.');
      }
    } catch (error) {
      setConfirmError('Netzwerkfehler. Bitte überprüfen Sie Ihre Verbindung.');
    } finally {
      setIsConfirming(false);
    }
  };

  // Validation state
  const emailError = address.email && !validateEmail(address.email);
  const phoneError = address.phone && !validatePhone(address.phone);
  const zipError = address.zip && !validateZip(address.zip);
  
  const isAddressValid = useMemo(() => {
    return address.street && 
           address.number && 
           address.phone && 
           validatePhone(address.phone) &&
           validateZip(address.zip) &&
           (!address.email || validateEmail(address.email));
  }, [address]);

  const deliveryOptions = [
    { id: 'asap', label: t('asap'), time: '25-35 min' },
    { id: 'scheduled', label: t('scheduled'), time: '' },
  ];

  const handleNewOrder = () => {
    setIsSuccess(false);
    setStep(1);
    setPromoCode('');
    setPromoDiscount(0);
    setAddress({
      street: '',
      number: '',
      zip: '57072',
      city: 'Siegen',
      phone: '',
      email: '',
      note: ''
    });
    setCreatedOrderId('');
    setEnteredCode('');
    setConfirmError('');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-roma-dark rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl border border-white/10"
            role="dialog"
            aria-modal="true"
            aria-labelledby="checkout-title"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h2 id="checkout-title" className="text-2xl font-poppins font-bold text-white">
                {isSuccess ? t('order_success') : 
                 step === 1 ? t('delivery_details') : 
                 step === 2 ? t('payment') :
                 'Bestellung bestätigen'}
              </h2>
              <button 
                onClick={onClose} 
                className="text-white/70 hover:text-white"
                aria-label="Schließen"
              ><FiX size={24} /></button>
            </div>

            {/* Success State */}
            {isSuccess ? (
              <div className="p-8 text-center">
                <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <FiCheck size={40} className="text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">
                  {t('thank_you')}
                </h3>
                <p className="text-white/60 mb-6">
                  {t('preparing')}
                </p>
                <div className="bg-white/5 rounded-2xl p-4 mb-6 text-left">
                  <div className="flex items-center gap-3 text-white/80 mb-2">
                    <FiClock className="text-roma-gold" />
                    <span>{t('delivery_time')}: 25-35 {t('minutes')}</span>
                  </div>
                  <div className="flex items-center gap-3 text-white/80">
                    <FiTruck className="text-roma-gold" />
                    <span>{t('track_id')}: #{trackId}</span>
                  </div>
                  {address.email && (
                    <div className="flex items-center gap-3 text-white/80 mt-2">
                      <span>📧</span>
                      <span>Bestätigungs-E-Mail gesendet an {address.email}</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={handleNewOrder}
                    className="flex-1 bg-roma-red text-white py-3 rounded-xl font-semibold hover:bg-red-700 transition-colors"
                  >
                    {t('new_order')}
                  </button>
                  <button 
                    onClick={onClose}
                    className="flex-1 bg-white/10 text-white py-3 rounded-xl font-semibold hover:bg-white/20 transition-colors"
                  >
                    {t('close')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 overflow-y-auto max-h-[70vh]">
                {/* Progress */}
                <div className="flex gap-2 mb-6">
                  <div className={`flex-1 h-2 rounded-full ${step >= 1 ? 'bg-roma-red' : 'bg-white/10'}`} />
                  <div className={`flex-1 h-2 rounded-full ${step >= 2 ? 'bg-roma-red' : 'bg-white/10'}`} />
                  {step === 3 && <div className={`flex-1 h-2 rounded-full bg-roma-red`} />}
                </div>

                {step === 1 ? (
                  <div className="space-y-4">
                    {/* Address Form */}
                    <div className="grid grid-cols-2 gap-3">
                      <input 
                        type="text" 
                        placeholder={t('street')}
                        value={address.street}
                        maxLength={100}
                        onChange={(e) => handleAddressChange('street', e.target.value)}
                        className="bg-white/10 text-white p-3 rounded-xl border border-white/10 focus:border-roma-gold outline-none placeholder:text-white/40"
                      />
                      <input 
                        type="text" 
                        placeholder={t('number')}
                        value={address.number}
                        maxLength={10}
                        onChange={(e) => handleAddressChange('number', e.target.value)}
                        className="bg-white/10 text-white p-3 rounded-xl border border-white/10 focus:border-roma-gold outline-none placeholder:text-white/40"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <input 
                          type="text" 
                          placeholder="PLZ (5 Stellen)" 
                          value={address.zip}
                          maxLength={5}
                          onChange={(e) => handleAddressChange('zip', e.target.value.replace(/\D/g, ''))}
                          className={`w-full bg-white/10 text-white p-3 rounded-xl border outline-none placeholder:text-white/40 ${zipError ? 'border-red-500 focus:border-red-500' : 'border-white/10 focus:border-roma-gold'}`}
                        />
                        {zipError && <p className="text-red-400 text-xs mt-1">5-stelliger ZIP erforderlich</p>}
                      </div>
                      <input 
                        type="text" 
                        placeholder={t('city')}
                        value={address.city}
                        maxLength={50}
                        onChange={(e) => handleAddressChange('city', e.target.value)}
                        className="bg-white/10 text-white p-3 rounded-xl border border-white/10 focus:border-roma-gold outline-none placeholder:text-white/40"
                      />
                    </div>
                    <div>
                      <input 
                        type="tel" 
                        placeholder={t('phone') + ' (z.B. 0271 12345678)'}
                        value={address.phone}
                        maxLength={20}
                        onChange={(e) => handleAddressChange('phone', e.target.value)}
                        className={`w-full bg-white/10 text-white p-3 rounded-xl border outline-none placeholder:text-white/40 ${phoneError ? 'border-red-500 focus:border-red-500' : 'border-white/10 focus:border-roma-gold'}`}
                      />
                      {phoneError && <p className="text-red-400 text-xs mt-1">Ungültige Telefonnummer</p>}
                    </div>
                    <div>
                      <input 
                        type="email" 
                        placeholder="E-Mail (für Bestätigungscode)"
                        value={address.email}
                        maxLength={100}
                        onChange={(e) => handleAddressChange('email', e.target.value)}
                        className={`w-full bg-white/10 text-white p-3 rounded-xl border outline-none placeholder:text-white/40 ${emailError ? 'border-red-500 focus:border-red-500' : 'border-white/10 focus:border-roma-gold'}`}
                      />
                      {emailError && <p className="text-red-400 text-xs mt-1">Ungültige E-Mail-Adresse</p>}
                    </div>
                    
                    {/* Delivery Time */}
                    <div className="pt-4">
                      <p className="text-white/60 text-sm mb-3">{t('delivery_time')}</p>
                      <div className="grid grid-cols-2 gap-3">
                        {deliveryOptions.map(opt => (
                          <button
                            key={opt.id}
                            onClick={() => setDeliveryTime(opt.id)}
                            className={`p-3 rounded-xl border text-left transition-all ${deliveryTime === opt.id ? 'border-roma-gold bg-roma-gold/10 text-white' : 'border-white/10 text-white/60'}`}
                          >
                            <p className="font-semibold">{opt.label}</p>
                            {opt.time && <p className="text-sm text-roma-gold">{opt.time}</p>}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <textarea 
                        placeholder={t('comment')}
                        value={address.note}
                        maxLength={500}
                        onChange={(e) => handleAddressChange('note', e.target.value)}
                        className="w-full bg-white/10 text-white p-3 rounded-xl border border-white/10 focus:border-roma-gold outline-none h-20 resize-none placeholder:text-white/40"
                      />
                      <p className="text-white/40 text-xs mt-1 text-right">{address.note.length}/500</p>
                    </div>

                    {addressError && (
                      <div className="w-full mb-2 p-3 bg-red-500/20 border border-red-500/50 rounded-xl text-red-400 text-sm">
                        {addressError}
                      </div>
                    )}
                    <button 
                      onClick={() => {
                        if (!isAddressValid) {
                          setAddressError('Bitte füllen Sie alle Pflichtfelder korrekt aus.');
                          return;
                        }
                        setAddressError('');
                        setStep(2);
                      }}
                      disabled={!isAddressValid}
                      className="w-full bg-roma-gold text-roma-dark py-4 rounded-xl font-bold hover:bg-yellow-500 transition-all disabled:bg-gray-600 disabled:cursor-not-allowed"
                      aria-label="Weiter zur Zahlung"
                    >
                      {t('continue_payment')}
                    </button>
                  </div>
                ) : step === 2 ? (
                  <div className="space-y-4">
                    {/* Order Summary */}
                    <div className="bg-white/5 rounded-2xl p-4">
                      <h3 className="text-white font-semibold mb-3">{t('order_summary')}</h3>
                      {items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-white/80 text-sm mb-2">
                          <span>{item.quantity}x {item.name.de} ({item.size})</span>
                          <span>{((item.price + item.toppings.reduce((a,t) => a+t.price, 0)) * item.quantity).toFixed(2)} €</span>
                        </div>
                      ))}
                      <div className="border-t border-white/10 pt-2 mt-2 space-y-1">
                        <div className="flex justify-between text-white/60 text-sm">
                          <span>{t('subtotal')}</span>
                          <span>{subtotal().toFixed(2)} €</span>
                        </div>
                        {promoDiscount > 0 && (
                          <div className="flex justify-between text-green-400 text-sm">
                            <span>{t('discount')}</span>
                            <span>-{promoDiscount.toFixed(2)} €</span>
                          </div>
                        )}
                        <div className="flex justify-between text-white/60 text-sm">
                          <span>{t('delivery_fee')}</span>
                          <span className={deliveryFee() === 0 ? 'text-green-400' : ''}>{deliveryFee() === 0 ? t('free') : deliveryFee().toFixed(2) + ' €'}</span>
                        </div>
                        <div className="flex justify-between text-white font-bold text-lg pt-2 border-t border-white/10">
                          <span>{t('total')}</span>
                          <span>{finalTotal.toFixed(2)} €</span>
                        </div>
                        <p className="text-xs text-white/50 mt-1">Alle Preise inkl. 7% MwSt. (Lebensmittel) / 19% MwSt. (Getränke).</p>
                      </div>
                    </div>

                    {/* Promo Code */}
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder={t('promo_code')}
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value)}
                        className="flex-1 bg-white/10 text-white p-3 rounded-xl border border-white/10 focus:border-roma-gold outline-none placeholder:text-white/40 uppercase"
                      />
                      <button 
                        onClick={applyPromoCode}
                        className="bg-white/20 text-white px-4 py-3 rounded-xl hover:bg-white/30 transition-colors"
                      >
                        {t('apply')}
                      </button>
                    </div>
                    {promoDiscount > 0 && <p className="text-green-400 text-sm">✓ {t('promo_applied')}</p>}

                    {/* Payment Methods */}
                    <div>
                      <p className="text-white/60 text-sm mb-3">{t('payment_method')}</p>
                      <div className="grid grid-cols-2 gap-3">
                        {paymentMethods.map(method => (
                          <button
                            key={method.id}
                            onClick={() => setSelectedPayment(method.id)}
                            className={`p-4 rounded-xl border flex items-center gap-3 transition-all ${selectedPayment === method.id ? 'border-roma-gold bg-roma-gold/10 text-white' : 'border-white/10 text-white/60'}`}
                          >
                            <span className="text-xl">{method.icon}</span>
                            <span className="font-medium">{method.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Legal compliance: Widerrufsrecht for perishable goods */}
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-4">
                      <p className="text-yellow-400/90 text-sm">
                        <strong>Widerrufsrecht:</strong> Da es sich bei Lebensmitteln um leicht verderbliche Waren handelt, besteht kein Widerrufsrecht gemäß § 312g Abs. 2 Nr. 1 BGB. 
                        Die Ware wird nach Ihrer Bestellung frisch zubereitet.
                      </p>
                    </div>

                    {/* AGB Checkbox */}
                    <div className="flex items-start gap-3 mb-4">
                      <input 
                        type="checkbox" 
                        id="agb" 
                        checked={agbAccepted}
                        onChange={(e) => setAgbAccepted(e.target.checked)}
                        className="mt-1 w-4 h-4 accent-roma-red cursor-pointer"
                      />
                      <label htmlFor="agb" className="text-sm text-white/70 cursor-pointer">
                        Ich habe die <a href="/agb" target="_blank" className="text-roma-gold hover:underline">AGB</a> gelesen und stimme ihnen zu. 
                        Ich bestätige, dass ich über das fehlende Widerrufsrecht informiert wurde.
                      </label>
                    </div>

                    <div className="flex gap-3 pt-4">
                      {orderError && (
                        <div className="w-full mb-2 p-3 bg-red-500/20 border border-red-500/50 rounded-xl text-red-400 text-sm">
                          {orderError}
                        </div>
                      )}
                      <button 
                        onClick={() => setStep(1)}
                        className="flex-1 bg-white/10 text-white py-4 rounded-xl font-bold hover:bg-white/20 transition-all"
                      >
                        ← {t('back')}
                      </button>
                      <button 
                        onClick={handlePayment}
                        disabled={isProcessing || hasPaid || !agbAccepted}
                        className="flex-[2] bg-roma-red text-white py-4 rounded-xl font-bold hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        aria-label={isProcessing ? 'Wird verarbeitet' : `Zahlungspflichtig bestellen ${finalTotal.toFixed(2)} Euro`}
                      >
                        {isProcessing ? (
                          <>
                            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                            {t('processing')}...
                          </>
                        ) : (
                          <>
                            <FiCheck /> Kostenpflichtig bestellen {finalTotal.toFixed(2)} €
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : step === 3 ? (
                  <div className="space-y-6 text-center">
                    <div>
                      <h3 className="text-xl font-bold text-white mb-2">Bestellung bestätigen</h3>
                      <p className="text-white/60 text-sm">
                        Wir haben einen 6-stelligen Bestätigungscode an <strong>{address.email}</strong> gesendet. 
                        Bitte geben Sie den Code unten ein, um Ihre Bestellung zu bestätigen.
                      </p>
                    </div>
                    <div className="max-w-xs mx-auto">
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        placeholder="000000"
                        value={enteredCode}
                        onChange={(e) => setEnteredCode(e.target.value.replace(/\D/g, ''))}
                        className="w-full bg-white/10 text-white text-center text-3xl font-bold p-4 rounded-xl border border-white/10 focus:border-roma-gold outline-none tracking-[0.5em]"
                      />
                      {confirmError && <p className="text-red-400 text-sm mt-2">{confirmError}</p>}
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setStep(2);
                          setCreatedOrderId('');
                          setEnteredCode('');
                        }}
                        className="flex-1 bg-white/10 text-white py-3 rounded-xl font-semibold hover:bg-white/20 transition-colors"
                      >
                        ← Zurück
                      </button>
                      <button
                        onClick={handleConfirmation}
                        disabled={isConfirming || enteredCode.length !== 6}
                        className="flex-[2] bg-roma-red text-white py-3 rounded-xl font-bold hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isConfirming ? (
                          <>
                            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                            Wird bestätigt...
                          </>
                        ) : (
                          <>
                            <FiCheck /> Code bestätigen
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}