'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiRefreshCw, FiLogOut, FiCheckCircle, FiAlertCircle, FiPackage, FiTruck, FiClock } from 'react-icons/fi';
import { MenuData } from '@/types';

// Status configuration - German only
const statusMap = {
  received: { 
    label: 'Empfangen', 
    color: 'bg-blue-500', 
    icon: FiPackage,
    hint: '🔔 Neue Bestellung! Zutaten prüfen.' 
  },
  preparing: { 
    label: 'In Zubereitung', 
    color: 'bg-orange-500', 
    icon: FiClock,
    hint: '🔥 Pizza im Ofen. Kunde wurde benachrichtigt.' 
  },
  delivering: { 
    label: 'Unterwegs', 
    color: 'bg-indigo-500', 
    icon: FiTruck,
    hint: '🏍 Fahrer unterwegs. Lieferzeit ~15 Min.' 
  },
  done: { 
    label: 'Geliefert', 
    color: 'bg-green-500', 
    icon: FiCheckCircle,
    hint: '✅ Bestellung abgeschlossen.' 
  },
  cancelled: { 
    label: 'Storniert', 
    color: 'bg-red-500', 
    icon: FiAlertCircle,
    hint: '❌ Bestellung storniert.' 
  },
};

type OrderStatus = keyof typeof statusMap;

interface Order {
  id: string;
  customer: {
    name: string;
    phone: string;
    address: string;
    email?: string;
    note?: string;
  };
  items: Array<{
    id: string;
    name: { de: string; ru: string };
    quantity: number;
    price: number;
    size?: string;
    toppings?: Array<{ id: string; name: { de: string; ru: string }; price: number }>;
    image?: string;
  }>;
  total: number;
  subtotal: number;
  deliveryFee: number;
  status: OrderStatus;
  createdAt: number;
  updatedAt?: number;
  paymentMethod?: string;
  deliveryTime?: string;
  promoCode?: string;
  promoDiscount?: number;
}

export default function AdminDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState<'orders' | 'menu' | 'offers' | 'legal' | 'users'>('orders');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [menuData, setMenuData] = useState<MenuData | null>(null);
  const [menuLoading, setMenuLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [orderFilter, setOrderFilter] = useState<OrderStatus | 'all'>('all');  
  // Users state
  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  // Theme state
  const [isDarkMode, setIsDarkMode] = useState(true);  
  // Toggle theme
  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  // Get admin token from cookie
  const getAdminToken = () => {
    return document.cookie
      .split('; ')
      .find(row => row.startsWith('admin_token='))
      ?.split('=')[1];
  };

  // Load orders
  const fetchOrders = useCallback(async () => {
    const token = getAdminToken();
    if (!token) {
      setError('Not authenticated');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/orders', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
        setError('');
      } else {
        const err = await res.json();
        setError(err.error || 'Failed to fetch orders');
      }
    } catch (err) {
      setError('Network error');
    }
    setLoading(false);
  }, []);

  // Load menu with cache busting
  const fetchMenu = useCallback(async () => {
    setMenuLoading(true);
    try {
      const res = await fetch(`/api/admin/menu?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (res.ok) {
        const data: MenuData = await res.json();
        setMenuData(data);
      }
    } catch (err) {
      console.error('Failed to load menu:', err);
    }
    setMenuLoading(false);
  }, []);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    const token = getAdminToken();
    if (!token) {
      setError('Not authenticated');
      return;
    }
    setUsersLoading(true);
    try {
      const res = await fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      } else {
        const err = await res.json();
        setError(err.error || 'Failed to fetch users');
      }
    } catch (err) {
      setError('Network error');
    }
    setUsersLoading(false);
  }, []);

  // Poll every 10 seconds
  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  // Load data when switching tabs
  useEffect(() => {
    if (tab === 'menu' || tab === 'offers' || tab === 'legal') {
      fetchMenu();
    }
    if (tab === 'users') {
      fetchUsers();
    }
  }, [tab, fetchMenu, fetchUsers]);

  // Change order status
  const changeStatus = async (orderId: string, newStatus: OrderStatus) => {
    const token = getAdminToken();
    if (!token) return;

    try {
      const res = await fetch('/api/admin/orders', {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id: orderId, newStatus })
      });

      if (res.ok) {
        setOrders(prev => prev.map(o => 
          o.id === orderId ? { ...o, status: newStatus } : o
        ));
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  // Save menu to GitHub
  const saveMenu = async () => {
    const token = getAdminToken();
    if (!token || !menuData) return;

    setMenuLoading(true);
    setSaveMessage('');

    try {
      const res = await fetch('/api/admin/menu', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(menuData)
      });

      const result = await res.json();
      if (res.ok) {
        const githubStatus = result.message?.includes('GitHub') ? ' (GitHub OK)' : ' (GitHub fehlgeschlagen - nur lokal)';
        setSaveMessage(`✅ Menü gespeichert!${githubStatus} Vercel aktualisiert die Site in 1 Minute.`);
        setTimeout(() => fetchMenu(), 1000);
      } else {
        setSaveMessage(`❌ Fehler: ${result.error || result.details || 'Unknown error'}`);
      }
    } catch (err) {
      setSaveMessage(`❌ Netzwerkfehler: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    setMenuLoading(false);
  };

  // Save offers
  const saveOffers = async () => {
    setMenuLoading(true);
    const token = getAdminToken();
    if (!token) return;
    try {
      const res = await fetch('/api/admin/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(menuData)
      });
      const data = await res.json();
      if (data.success) {
        const githubStatus = data.message?.includes('GitHub') ? ' (GitHub OK)' : ' (GitHub fehlgeschlagen)';
        setSaveMessage(`✅ Angebote gespeichert!${githubStatus}`);
        setTimeout(() => fetchMenu(), 1000);
      } else {
        setSaveMessage(`❌ Fehler: ${data.error || data.details || 'Unbekannt'}`);
      }
      setTimeout(() => setSaveMessage(''), 5000);
    } catch (err) {
      setSaveMessage(`❌ Speichern fehlgeschlagen: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    setMenuLoading(false);
  };

  // Update legal field
  const updateLegal = (section: 'impressum' | 'datenschutz' | 'agb', field: string, value: string) => {
    if (!menuData) return;
    const newMenuData: MenuData = JSON.parse(JSON.stringify(menuData));
    if (!newMenuData.legal) newMenuData.legal = {};
    if (!newMenuData.legal[section]) newMenuData.legal[section] = {};
    (newMenuData.legal[section] as Record<string, unknown>)[field] = value;
    setMenuData(newMenuData);
  };

  // Save legal
  const saveLegal = async () => {
    setMenuLoading(true);
    const token = getAdminToken();
    if (!token) return;
    try {
      const res = await fetch('/api/admin/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(menuData)
      });
      const data = await res.json();
      if (data.success) {
        const githubStatus = data.message?.includes('GitHub') ? ' (GitHub OK)' : ' (GitHub fehlgeschlagen)';
        setSaveMessage(`✅ Rechtliche Texte gespeichert!${githubStatus}`);
        setTimeout(() => fetchMenu(), 1000);
      } else {
        setSaveMessage(`❌ Fehler: ${data.error || data.details || 'Unbekannt'}`);
      }
      setTimeout(() => setSaveMessage(''), 5000);
    } catch (err) {
      setSaveMessage(`❌ Speichern fehlgeschlagen: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    setMenuLoading(false);
  };

  // Logout
  const logout = () => {
    document.cookie = 'admin_token=; Max-Age=0; path=/';
    window.location.href = '/admin/login';
  };

  // Format time
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Calculate elapsed time for orders
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  const getElapsedMinutes = (createdAt: number) => {
    return Math.floor((currentTime - createdAt) / 60000);
  };

    // Update menu item
  const updateItem = (categoryKey: string, itemIndex: number, field: string, value: string | number | { [size: string]: number }) => {
    if (!menuData) return;
    const newMenuData: MenuData = JSON.parse(JSON.stringify(menuData));
    if (!newMenuData.categories) return;
    const category = newMenuData.categories[categoryKey];
    if (!category) return;
    const item = category.items[itemIndex];
    if (!item) return;
    
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      if (parent === 'name' && item.name) {
        (item.name as Record<string, unknown>)[child] = value;
      } else if (parent === 'description' && item.description) {
        (item.description as Record<string, unknown>)[child] = value;
      } else if (parent === 'prices' && item.prices) {
        // Add or update price for a specific size
        item.prices[child] = value as number;
      }
    } else {
      if (field === 'image') item.image = value as string;
      else if (field === 'price') item.price = value as number;
      else if (field === 'prices') item.prices = value as { [size: string]: number };
    }
    
    setMenuData(newMenuData);
  };

  // Add a new size to item prices
  const addSizeToItem = (categoryKey: string, itemIndex: number) => {
    const newSize = prompt('Neue Größe/Gewicht eingeben (z.B. 30, 0.33L, 500g):');
    if (!newSize) return;
    
    if (!menuData) {
      alert('Menüdaten noch nicht geladen!');
      return;
    }
    
    // Create a deep copy of menuData
    const newMenuData: MenuData = JSON.parse(JSON.stringify(menuData));
    
    if (!newMenuData.categories) {
      alert('Kategorien nicht gefunden!');
      return;
    }
    
    const category = newMenuData.categories[categoryKey];
    if (!category) {
      alert('Kategorie nicht gefunden!');
      return;
    }
    
    const item = category.items[itemIndex];
    if (!item) {
      alert('Artikel nicht gefunden!');
      return;
    }
    
    if (!item.prices) item.prices = {};
    
    if (item.prices[newSize]) {
      alert('Diese Größe existiert bereits!');
      return;
    }
    
    item.prices[newSize] = 0;
    setMenuData(newMenuData);
    alert(`Größe "${newSize}" wurde hinzugefügt!`);
  };

  // Update topping
  const updateTopping = (categoryKey: string, itemIndex: number, toppingIndex: number, field: 'de' | 'price', value: string | number) => {
    if (!menuData) return;
    const newMenuData: MenuData = JSON.parse(JSON.stringify(menuData));
    if (!newMenuData.categories) return;
    const category = newMenuData.categories[categoryKey];
    if (!category) return;
    const item = category.items[itemIndex];
    if (!item) return;
    if (!item.toppings) item.toppings = [];
    
    if (field === 'price') {
      item.toppings[toppingIndex].price = typeof value === 'string' ? parseFloat(value) : value;
    } else {
      item.toppings[toppingIndex].name[field] = value as string;
    }
    
    setMenuData(newMenuData);
  };

  // Add new item
  const addItem = (categoryKey: string) => {
    if (!menuData) return;
    const newMenuData: MenuData = JSON.parse(JSON.stringify(menuData));
    if (!newMenuData.categories) return;
    const category = newMenuData.categories[categoryKey];
    if (!category) return;
    category.items.push({
      id: `new_${Date.now()}`,
      name: { de: 'Neues Item', ru: 'Neues Item' },
      desc: { de: '', ru: '' },
      description: { de: '', ru: '' },
      price: 0,
      image: '/images/placeholder.webp',
      toppings: []
    });
    setMenuData(newMenuData);
  };

  // Delete item
  const deleteItem = (categoryKey: string, itemIndex: number) => {
    if (!menuData) return;
    if (!confirm('Diesen Artikel löschen?')) return;
    const newMenuData: MenuData = JSON.parse(JSON.stringify(menuData));
    if (!newMenuData.categories) return;
    const category = newMenuData.categories[categoryKey];
    if (!category) return;
    category.items.splice(itemIndex, 1);
    setMenuData(newMenuData);
  };

  // Add topping
  const addTopping = (categoryKey: string, itemIndex: number) => {
    if (!menuData) return;
    const newMenuData: MenuData = JSON.parse(JSON.stringify(menuData));
    if (!newMenuData.categories) return;
    const category = newMenuData.categories[categoryKey];
    if (!category) return;
    const item = category.items[itemIndex];
    if (!item) return;
    if (!item.toppings) item.toppings = [];
    item.toppings.push({ id: `t_${Date.now()}`, name: { de: 'Extra', ru: '' }, price: 1 });
    setMenuData(newMenuData);
  };

  // Remove topping
  const removeTopping = (categoryKey: string, itemIndex: number, toppingIndex: number) => {
    if (!menuData) return;
    const newMenuData: MenuData = JSON.parse(JSON.stringify(menuData));
    if (!newMenuData.categories) return;
    const category = newMenuData.categories[categoryKey];
    if (!category) return;
    const item = category.items[itemIndex];
    if (!item) return;
    item.toppings.splice(toppingIndex, 1);
    setMenuData(newMenuData);
  };

  // Add new category
  const addCategory = () => {
    if (!menuData) return;
    const catId = prompt('Kategorie ID eingeben (z.B. snacks, drinks):');
    if (!catId) return;
    
    const name = prompt('Kategoriename:') || 'Neue Kategorie';
    
    const newMenuData: MenuData = JSON.parse(JSON.stringify(menuData));
    if (!newMenuData.categories) newMenuData.categories = {};
    newMenuData.categories[catId] = {
      id: catId,
      name: { de: name, ru: name },
      items: []
    };
    setMenuData(newMenuData);
  };

  // Delete category
  const deleteCategory = (catKey: string) => {
    if (!menuData) return;
    if (!confirm(`Kategorie "${menuData.categories?.[catKey]?.name.de}" und alle Artikel löschen?`)) return;
    const newMenuData: MenuData = JSON.parse(JSON.stringify(menuData));
    if (!newMenuData.categories) return;
    delete newMenuData.categories[catKey];
    setMenuData(newMenuData);
  };

  // Update category name
  const updateCategoryName = (catKey: string, value: string) => {
    if (!menuData) return;
    const newMenuData: MenuData = JSON.parse(JSON.stringify(menuData));
    if (!newMenuData.categories) return;
    if (!newMenuData.categories[catKey]) return;
    newMenuData.categories[catKey].name.de = value;
    setMenuData(newMenuData);
  };

  // Update offer
  const updateOffer = (offerIndex: number, field: string, value: string | number) => {
    if (!menuData) return;
    const newMenuData: MenuData = JSON.parse(JSON.stringify(menuData));
    if (!newMenuData.offers) return;
    const offer = newMenuData.offers[offerIndex];
    if (!offer) return;
    
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      if (parent === 'title' && offer.title) {
        (offer.title as Record<string, unknown>)[child] = value;
      } else if (parent === 'desc' && offer.desc) {
        (offer.desc as Record<string, unknown>)[child] = value;
      }
    } else {
      if (field === 'title') offer.title = value as any;
      else if (field === 'desc') offer.desc = value as any;
      else if (field === 'price') offer.price = value as string;
      else if (field === 'img') offer.img = value as string;
      else if (field === 'badge') offer.badge = value as string;
    }
    
    setMenuData(newMenuData);
  };

  // Add new offer
  const addOffer = () => {
    if (!menuData) return;
    const newMenuData: MenuData = JSON.parse(JSON.stringify(menuData));
    if (!newMenuData.offers) newMenuData.offers = [];
    newMenuData.offers.push({
      id: `o_${Date.now()}`,
      img: '/images/offer-placeholder.webp',
      title: { de: 'Neues Angebot', ru: 'Новое предложение' },
      desc: { de: '', ru: '' },
      price: '0.00 €',
      badge: ''
    });
    setMenuData(newMenuData);
  };

  // Delete offer
  const deleteOffer = (offerIndex: number) => {
    if (!menuData) return;
    if (!confirm('Dieses Angebot löschen?')) return;
    const newMenuData: MenuData = JSON.parse(JSON.stringify(menuData));
    if (!newMenuData.offers) return;
    newMenuData.offers.splice(offerIndex, 1);
    setMenuData(newMenuData);
  };

  return (
    <div className={`min-h-screen pt-0 transition-colors duration-300 ${isDarkMode ? 'bg-roma-dark text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* Fixed Header */}
      <header className={`fixed top-0 left-0 right-0 z-50 backdrop-blur-md border-b px-6 py-3 transition-colors duration-300 ${isDarkMode ? 'bg-black/80 border-white/10' : 'bg-white/80 border-gray-200'}`}>
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="text-roma-red text-2xl">♛</span>
            <h1 className="text-xl font-poppins font-bold">Pizza Roma Admin</h1>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Theme Toggle */}
            <button 
              onClick={toggleTheme}
              className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-200 hover:bg-gray-300'}`}
              title={isDarkMode ? 'Helles Design' : 'Dunkles Design'}
            >
              {isDarkMode ? '☀️' : '🌙'}
            </button>
            <button 
              onClick={fetchOrders}
              className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-200 hover:bg-gray-300'}`}
              title="Aktualisieren"
            >
              <FiRefreshCw className={loading ? 'animate-spin' : ''} size={18} />
            </button>
            <button 
              onClick={logout}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-roma-red hover:bg-red-700 transition-colors text-sm"
            >
              <FiLogOut size={16} /> Abmelden
            </button>
          </div>
        </div>
      </header>

      {/* Spacer for fixed header */}
      <div className="h-14"></div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-6 mt-6">
        <div className={`flex gap-2 border-b ${isDarkMode ? 'border-white/10' : 'border-gray-300'}`}>
          <button 
            onClick={() => setTab('orders')} 
            className={`px-6 py-3 rounded-t-lg font-semibold transition-colors ${
              tab === 'orders' 
                ? 'bg-roma-red text-white' 
                : isDarkMode ? 'text-white/50 hover:text-white' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Bestellungen ({orders.filter(o => o.status === 'received').length}/{orders.length})
          </button>
          <button 
            onClick={() => setTab('menu')} 
            className={`px-6 py-3 rounded-t-lg font-semibold transition-colors ${
              tab === 'menu' 
                ? 'bg-roma-red text-white' 
                : isDarkMode ? 'text-white/50 hover:text-white' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Menü & Einstellungen
          </button>
          <button 
            onClick={() => setTab('offers')} 
            className={`px-6 py-3 rounded-t-lg font-semibold transition-colors ${
              tab === 'offers' 
                ? 'bg-roma-red text-white' 
                : isDarkMode ? 'text-white/50 hover:text-white' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Angebote
          </button>
          <button 
            onClick={() => setTab('legal')} 
            className={`px-6 py-3 rounded-t-lg font-semibold transition-colors ${
              tab === 'legal' 
                ? 'bg-roma-red text-white' 
                : isDarkMode ? 'text-white/50 hover:text-white' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Rechtliches
          </button>
          <button 
            onClick={() => setTab('users')} 
            className={`px-6 py-3 rounded-t-lg font-semibold transition-colors ${
              tab === 'users' 
                ? 'bg-roma-red text-white' 
                : isDarkMode ? 'text-white/50 hover:text-white' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Kunden ({users.length})
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <AnimatePresence mode="wait">
          {tab === 'orders' ? (
            <motion.div
              key="orders"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              {error && (
                <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-xl text-red-400">
                  {error}
                </div>
              )}

              {orders.length === 0 && !loading && (
                <div className={`text-center py-20 ${isDarkMode ? 'text-white/40' : 'text-gray-500'}`}>
                  <FiPackage size={48} className="mx-auto mb-4" />
                  <p className="text-xl">Noch keine Bestellungen...</p>
                  <p className="text-sm mt-2">Neue Bestellungen erscheinen hier automatisch</p>
                </div>
              )}

              {/* Order filter */}
              {orders.length > 0 && (
                <div className="flex gap-2 flex-wrap mb-4">
                  <button
                    onClick={() => setOrderFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${orderFilter === 'all' ? 'bg-roma-red text-white' : isDarkMode ? 'bg-white/5 text-white/50 hover:bg-white/10' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    Alle ({orders.length})
                  </button>
                  {Object.entries(statusMap).map(([status, config]) => {
                    const count = orders.filter(o => o.status === status).length;
                    if (count === 0) return null;
                    return (
                      <button
                        key={status}
                        onClick={() => setOrderFilter(status as OrderStatus)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${orderFilter === status ? `${config.color} text-white` : isDarkMode ? 'bg-white/5 text-white/50 hover:bg-white/10' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                      >
                        <config.icon size={12} />
                        {config.label} ({count})
                      </button>
                    );
                  })}
                </div>
              )}

              {orders
                .filter(o => orderFilter === 'all' || o.status === orderFilter)
                .map((order) => {
                const cfg = statusMap[order.status];
                const StatusIcon = cfg.icon;
                const elapsed = getElapsedMinutes(order.createdAt);
                const isUrgent = order.status === 'received' && elapsed > 10;
                
                return (
                  <motion.div
                    key={order.id}
                    layout
                    className={`rounded-2xl p-6 border ${isUrgent ? 'border-red-500/50 animate-pulse' : isDarkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white shadow-sm'}`}
                  >
                    <div className="flex flex-col lg:flex-row gap-6">
                      {/* Order information */}
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className={`text-xl font-bold ${isDarkMode ? '' : 'text-gray-900'}`}>📍 {order.customer.address}</h3>
                              {isUrgent && <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse">⚠ {elapsed} Min</span>}
                            </div>
                            <p className={`text-sm ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>#{order.id.slice(-8)} • {formatTime(order.createdAt)} • Vor {elapsed} Min.</p>
                          </div>
                          <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${cfg.color} text-white text-sm font-semibold`}>
                            <StatusIcon size={14} />
                            {cfg.label}
                          </div>
                        </div>

                        <div className="space-y-1 mb-4">
                          <p className={isDarkMode ? 'text-white/80' : 'text-gray-700'}>📞 {order.customer.phone}</p>
                          {order.customer.email && <p className={`text-sm ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>✉️ {order.customer.email}</p>}
                          {order.customer.note && <p className={`text-sm ${isDarkMode ? 'text-yellow-400/80' : 'text-yellow-600'}`}>📝 {order.customer.note}</p>}
                          {order.paymentMethod && (
                            <p className={`text-sm ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>
                              💰 {order.paymentMethod === 'cash' ? 'Barzahlung' : order.paymentMethod === 'card' ? 'Karte' : order.paymentMethod === 'paypal' ? 'PayPal' : order.paymentMethod}
                            </p>
                          )}
                          {order.deliveryTime && (
                            <p className={`text-sm ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>🕐 {order.deliveryTime === 'asap' ? 'Schnellstmöglich' : order.deliveryTime}</p>
                          )}
                        </div>

                        <div className={`rounded-xl p-4 ${isDarkMode ? 'bg-black/20' : 'bg-gray-100'}`}>
                          <p className={`text-sm mb-2 ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>Bestellinhalt:</p>
                          {order.items.map((item, idx) => (
                            <div key={idx} className="py-1">
                              <div className={`flex justify-between text-sm ${isDarkMode ? '' : 'text-gray-700'}`}>
                                <span>{item.quantity}x {item.name.de} {item.size && `(${item.size})`}</span>
                                <span className={isDarkMode ? 'text-white/60' : 'text-gray-500'}>{(item.price * item.quantity).toFixed(2)} €</span>
                              </div>
                              {item.toppings && item.toppings.length > 0 && (
                                <div className={`ml-4 text-xs ${isDarkMode ? 'text-white/40' : 'text-gray-400'}`}>
                                  + {item.toppings.map(t => t.name.de).join(', ')}
                                </div>
                              )}
                            </div>
                          ))}
                          {order.promoCode && (
                            <div className="flex justify-between text-sm py-1 text-green-400">
                              <span>Gutschein {order.promoCode}</span>
                              <span>-{order.promoDiscount?.toFixed(2)} €</span>
                            </div>
                          )}
                          <div className={`border-t mt-2 pt-2 space-y-1 ${isDarkMode ? 'border-white/10' : 'border-gray-300'}`}>
                            <div className={`flex justify-between text-sm ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>
                              <span>Zwischensumme</span>
                              <span>{order.subtotal.toFixed(2)} €</span>
                            </div>
                            <div className={`flex justify-between text-sm ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>
                              <span>Lieferkosten</span>
                              <span>{order.deliveryFee.toFixed(2)} €</span>
                            </div>
                            <div className={`flex justify-between font-bold ${isDarkMode ? '' : 'text-gray-900'}`}>
                              <span>Gesamt</span>
                              <span className="text-roma-red">{order.total.toFixed(2)} €</span>
                            </div>
                          </div>
                        </div>

                        <p className={`text-sm mt-3 ${isDarkMode ? 'text-roma-gold' : 'text-orange-600'}`}>{cfg.hint}</p>
                      </div>

                      {/* Status management */}
                      <div className="lg:w-64 space-y-2">
                        <p className={`text-sm mb-2 ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>Status ändern:</p>
                        {Object.entries(statusMap).map(([status, config]) => (
                          <button
                            key={status}
                            onClick={() => changeStatus(order.id, status as OrderStatus)}
                            disabled={order.status === status}
                            className={`w-full flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                              order.status === status
                                ? `${config.color} text-white cursor-default`
                                : isDarkMode ? 'bg-white/5 hover:bg-white/10 text-white/80' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                            }`}
                          >
                            <config.icon size={14} />
                            {config.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          ) : tab === 'menu' ? (
            <motion.div
              key="menu"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className={`rounded-2xl p-6 border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-sm'}`}>
                <h2 className="text-2xl font-bold mb-4">Menüverwaltung</h2>
                <p className="text-white/60 mb-6">
                  Änderungen werden an GitHub gesendet. Vercel aktualisiert die Site automatisch innerhalb von 1 Minute.
                </p>

                {saveMessage && (
                  <div className={`p-4 rounded-xl mb-4 ${saveMessage.includes('✅') ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {saveMessage}
                  </div>
                )}

                {menuLoading ? (
                  <div className="text-center py-10">
                    <FiRefreshCw className="animate-spin mx-auto mb-2" size={24} />
                    <p className={isDarkMode ? 'text-white/60' : 'text-gray-500'}>Wird geladen...</p>
                  </div>
                ) : menuData ? (
                  <div className="space-y-4">
                     {/* Delivery settings */}
                     <div className={`rounded-xl p-4 ${isDarkMode ? 'bg-black/20' : 'bg-gray-100'}`}>
                       <h3 className={`font-semibold mb-3 ${isDarkMode ? '' : 'text-gray-900'}`}>Lieferungseinstellungen</h3>
                       
                       {/* Google Maps API Key */}
                       <div className="md:col-span-4 mb-4">
                         <label className={`text-sm ${isDarkMode ? 'text-white/60' : 'text-gray-600'}`}>Google Maps API Key</label>
                         <input 
                           type="text" 
                           value={menuData?.settings?.googleMapsApiKey || ''} 
                           onChange={(e) => {
                             if (!menuData) return;
                             const newMenuData: MenuData = JSON.parse(JSON.stringify(menuData));
                             if (!newMenuData.settings) newMenuData.settings = { delivery: { minOrder: 15, freeDeliveryThreshold: 25, deliveryFee: 3.5, estimatedTime: '25-35 Min' } };
                             newMenuData.settings.googleMapsApiKey = e.target.value;
                             setMenuData(newMenuData);
                           }} 
                           className={`w-full rounded-lg px-3 py-2 mt-1 text-sm ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-gray-900 border border-gray-300'}`} 
                           placeholder="Enter Google Maps API Key"
                           title="Google Maps API Key for address validation"
                         />
                         <p className={`text-xs mt-1 ${isDarkMode ? 'text-white/40' : 'text-gray-500'}`}>
                           <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener" className="text-roma-gold hover:underline">
                             Get API key here ↗
                           </a>
                         </p>
                       </div>
                       
                       <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <label className={`text-sm ${isDarkMode ? 'text-white/60' : 'text-gray-600'}`}>Min. Bestellung (€)</label>
                          <input type="number" step="0.1" value={menuData?.settings?.delivery?.minOrder || 15} onChange={(e) => {
                            if (!menuData) return;
                            const newMenuData: MenuData = JSON.parse(JSON.stringify(menuData));
                            if (!newMenuData.settings) newMenuData.settings = { delivery: { minOrder: 15, freeDeliveryThreshold: 25, deliveryFee: 3.5, estimatedTime: '25-35 Min' } };
                            if (!newMenuData.settings.delivery) newMenuData.settings.delivery = { minOrder: 15, freeDeliveryThreshold: 25, deliveryFee: 3.5, estimatedTime: '25-35 Min' };
                            newMenuData.settings.delivery.minOrder = parseFloat(e.target.value) || 15;
                            setMenuData(newMenuData);
                          }} className={`w-full rounded-lg px-3 py-2 mt-1 ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-gray-900 border border-gray-300'}`} 
                          title="Mindestbestellwert in Euro" placeholder="15.00" />
                        </div>
                        <div>
                          <label className={`text-sm ${isDarkMode ? 'text-white/60' : 'text-gray-600'}`}>Gratis ab (€)</label>
                          <input type="number" step="0.1" value={menuData?.settings?.delivery?.freeDeliveryThreshold || 25} onChange={(e) => {
                            if (!menuData) return;
                            const newMenuData: MenuData = JSON.parse(JSON.stringify(menuData));
                            if (!newMenuData.settings) newMenuData.settings = { delivery: { minOrder: 15, freeDeliveryThreshold: 25, deliveryFee: 3.5, estimatedTime: '25-35 Min' } };
                            if (!newMenuData.settings.delivery) newMenuData.settings.delivery = { minOrder: 15, freeDeliveryThreshold: 25, deliveryFee: 3.5, estimatedTime: '25-35 Min' };
                            newMenuData.settings.delivery.freeDeliveryThreshold = parseFloat(e.target.value) || 25;
                            setMenuData(newMenuData);
                          }} className={`w-full rounded-lg px-3 py-2 mt-1 ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-gray-900 border border-gray-300'}`} 
                          title="Kostenlose Lieferung ab Betrag" placeholder="25.00" />
                        </div>
                        <div>
                          <label className={`text-sm ${isDarkMode ? 'text-white/60' : 'text-gray-600'}`}>Lieferkosten (€)</label>
                          <input type="number" step="0.1" value={menuData?.settings?.delivery?.deliveryFee || 3.5} onChange={(e) => {
                            if (!menuData) return;
                            const newMenuData: MenuData = JSON.parse(JSON.stringify(menuData));
                            if (!newMenuData.settings) newMenuData.settings = { delivery: { minOrder: 15, freeDeliveryThreshold: 25, deliveryFee: 3.5, estimatedTime: '25-35 Min' } };
                            if (!newMenuData.settings.delivery) newMenuData.settings.delivery = { minOrder: 15, freeDeliveryThreshold: 25, deliveryFee: 3.5, estimatedTime: '25-35 Min' };
                            newMenuData.settings.delivery.deliveryFee = parseFloat(e.target.value) || 3.5;
                            setMenuData(newMenuData);
                          }} className={`w-full rounded-lg px-3 py-2 mt-1 ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-gray-900 border border-gray-300'}`} 
                          title="Lieferkosten in Euro" placeholder="3.50" />
                        </div>
                        <div>
                          <label className={`text-sm ${isDarkMode ? 'text-white/60' : 'text-gray-600'}`}>Lieferzeit</label>
                          <input type="text" value={menuData?.settings?.delivery?.estimatedTime || '25-35 Min'} onChange={(e) => {
                            if (!menuData) return;
                            const newMenuData: MenuData = JSON.parse(JSON.stringify(menuData));
                            if (!newMenuData.settings) newMenuData.settings = { delivery: { minOrder: 15, freeDeliveryThreshold: 25, deliveryFee: 3.5, estimatedTime: '25-35 Min' } };
                            if (!newMenuData.settings.delivery) newMenuData.settings.delivery = { minOrder: 15, freeDeliveryThreshold: 25, deliveryFee: 3.5, estimatedTime: '25-35 Min' };
                            newMenuData.settings.delivery.estimatedTime = e.target.value;
                            setMenuData(newMenuData);
                          }} className={`w-full rounded-lg px-3 py-2 mt-1 ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-gray-900 border border-gray-300'}`} 
                          title="Geschätzte Lieferzeit" placeholder="25-35 Min" />
                        </div>
                      </div>
                    </div>

                    {/* Add category button */}
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold text-lg">Menükategorien</h3>
                      <button onClick={addCategory} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold transition-colors">
                        + Kategorie hinzufügen
                      </button>
                    </div>

                    {/* Category editor */}
                    <div className="space-y-4">
                      {Object.entries(menuData.categories || {}).map(([catKey, category]: [string, any]) => (
                        <div key={catKey} className={`rounded-xl p-4 ${isDarkMode ? 'bg-black/20' : 'bg-gray-100'}`}>
                          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                            {/* Editable category names */}
                            <div className="flex-1">
                              <label className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>Kategoriename</label>
                              <input 
                                type="text" 
                                value={category.name?.de || catKey} 
                                onChange={(e) => updateCategoryName(catKey, e.target.value)}
                                className={`w-full rounded px-3 py-2 mt-1 font-semibold ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-gray-900 border border-gray-300'}`}
                                title="Name der Kategorie"
                              />
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => addItem(catKey)} className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-semibold transition-colors">
                                + Gericht hinzufügen
                              </button>
                              <button onClick={() => deleteCategory(catKey)} className="px-4 py-2 bg-red-600/50 hover:bg-red-600 rounded-lg text-sm font-semibold transition-colors" title="Kategorie löschen">
                                🗑️
                              </button>
                            </div>
                          </div>

                          {/* Item list */}
                          <div className="space-y-3">
                            {category.items?.map((item: any, idx: number) => (
                              <div key={item.id || idx} className={`rounded-lg p-4 border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200'}`}>
                                <div className="flex flex-col md:flex-row gap-4 mb-3">
                                  {/* Image preview - LEFT SIDE */}
                                   {item.image && (
                                     <div className="flex-shrink-0">
                                       <img 
                                         src={item.image} 
                                         alt={item.name?.de} 
                                         width={96}
                                         height={96}
                                         className={`w-24 h-24 rounded object-cover border ${isDarkMode ? 'border-white/20' : 'border-gray-300'}`}
                                         onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                       />
                                     </div>
                                   )}
                                  {/* Name and Bild fields - RIGHT SIDE */}
                                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Name field */}
                                    <div>
                                      <label className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>Name</label>
                                      <input 
                                        type="text" 
                                        value={item.name?.de || ''} 
                                        onChange={(e) => updateItem(catKey, idx, 'name.de', e.target.value)} 
                                        className={`w-full rounded px-3 py-2 mt-1 text-sm ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-gray-900 border border-gray-300'}`} 
                                        title="Name des Gerichts"
                                      />
                                    </div>
                                    {/* Bild field */}
                                    <div>
                                      <label className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>Bild</label>
                                      <div className="flex gap-2">
                                        <input 
                                          type="text" 
                                          value={item.image || ''} 
                                          onChange={(e) => updateItem(catKey, idx, 'image', e.target.value)} 
                                          className={`flex-1 rounded px-3 py-2 mt-1 text-sm ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-gray-900 border border-gray-300'}`} 
                                          placeholder="/images/pizza.webp"
                                          title="Bild-URL" 
                                        />
                                        <label className={`px-3 py-2 mt-1 rounded cursor-pointer text-sm flex items-center ${isDarkMode ? 'bg-white/20 hover:bg-white/30' : 'bg-gray-200 hover:bg-gray-300'}`}>
                                          📁
                                          <input 
                                            type="file" 
                                            accept="image/*" 
                                            className="hidden"
                                            onChange={async (e) => {
                                              const file = e.target.files?.[0];
                                              if (!file) return;
                                              
                                              const token = getAdminToken();
                                              const formData = new FormData();
                                              const filename = `${item.id}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
                                              formData.append('file', file);
                                              formData.append('filename', filename);
                                              
                                              try {
                                                const res = await fetch('/api/admin/upload', {
                                                  method: 'POST',
                                                  headers: { 'Authorization': `Bearer ${token}` },
                                                  body: formData
                                                });
                                                const data = await res.json();
                                                if (data.success) {
                                                  updateItem(catKey, idx, 'image', data.path);
                                                  setSaveMessage('✅ Bild hochgeladen!');
                                                  setTimeout(() => setSaveMessage(''), 2000);
                                                } else {
                                                  setSaveMessage(`❌ Fehler: ${data.error}`);
                                                }
                                              } catch (err) {
                                                setSaveMessage('❌ Upload fehlgeschlagen');
                                              }
                                            }}
                                          />
                                        </label>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Single Price (for non-pizza items) */}
                                {item.price && !item.prices && (
                                  <div className="mb-3">
                                    <label className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>Preis (€)</label>
                                    <input type="number" step="0.01" value={item.price || 0} onChange={(e) => updateItem(catKey, idx, 'price', parseFloat(e.target.value))} className={`w-full rounded px-2 py-1 mt-1 text-sm ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-gray-900 border border-gray-300'}`} title="Preis in Euro" placeholder="0.00" />
                                  </div>
                                )}

                                {/* Pizza Sizes with Prices - Dynamic */}
                                {item.prices && (
                                  <div className="mb-3">
                                    <div className="flex justify-between items-center mb-2">
                                      <label className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>Größen & Preise</label>
                                      <button 
                                        onClick={() => addSizeToItem(catKey, idx)}
                                        className={`text-xs px-2 py-1 rounded transition-colors ${isDarkMode ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-200 hover:bg-gray-300'}`}
                                      >
                                        + Größe
                                      </button>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                      {Object.entries(item.prices).map(([size, price]: [string, any], sizeIdx: number) => (
                                        <div key={sizeIdx} className={`rounded-lg p-2 relative group ${isDarkMode ? 'bg-white/5' : 'bg-gray-100'}`}>
                                          <div className="flex items-center gap-1 mb-1">
                                            <span className={`flex-1 text-xs font-semibold ${isDarkMode ? 'text-white/70' : 'text-gray-700'}`}>{size}</span>
                                            <button 
                                              onClick={() => {
                                                const newSize = prompt('Neue Größe/Gewicht eingeben (z.B. 30, 0.33L, 500g):', size);
                                                if (newSize && newSize !== size && !item.prices[newSize]) {
                                                  const newPrices = { ...item.prices };
                                                  newPrices[newSize] = newPrices[size];
                                                  delete newPrices[size];
                                                  updateItem(catKey, idx, 'prices', newPrices);
                                                }
                                              }}
                                              className="text-xs px-1 py-0.5 rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-400"
                                            >Edit</button>
                                            <button 
                                              onClick={() => {
                                                const newPrices = { ...item.prices };
                                                delete newPrices[size];
                                                updateItem(catKey, idx, 'prices', newPrices);
                                              }}
                                              className="text-red-400 hover:text-red-300 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                            >×</button>
                                          </div>
                                          <input 
                                            type="number" 
                                            step="0.01" 
                                            value={price || 0} 
                                            onChange={(e) => {
                                              const newPrices = { ...item.prices };
                                              newPrices[size] = parseFloat(e.target.value) || 0;
                                              updateItem(catKey, idx, 'prices', newPrices);
                                            }} 
                                            className={`w-full rounded px-2 py-1 text-sm ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-gray-900 border border-gray-300'}`} 
                                            title="Preis in Euro"
                                            placeholder="0.00"
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                 {/* Description */}
                                 <div className="mb-3">
                                   <label className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>Beschreibung</label>
                                   <textarea value={item.description?.de || ''} onChange={(e) => updateItem(catKey, idx, 'description.de', e.target.value)} className={`w-full rounded px-2 py-1 mt-1 text-sm h-16 resize-none ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-gray-900 border border-gray-300'}`} title="Beschreibung des Gerichts" placeholder="Beschreibung eingeben..." />
                                 </div>

                                 {/* Allergens */}
                                 <div className="mb-3">
                                   <label className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>Allergene</label>
                                   <input 
                                     type="text" 
                                     value={(item.allergens || []).join(', ')} 
                                     onChange={(e) => {
                                       if (!menuData) return;
                                       const newMenuData = JSON.parse(JSON.stringify(menuData));
                                       const allergens = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                                       if (newMenuData.categories?.[catKey]?.items[idx]) {
                                         newMenuData.categories[catKey].items[idx].allergens = allergens;
                                         setMenuData(newMenuData);
                                       }
                                     }}
                                     className={`w-full rounded px-2 py-1 mt-1 text-sm ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-gray-900 border border-gray-300'}`} 
                                     title="Allergene (durch Komma getrennt)"
                                     placeholder="z.B. Gluten, Milch, Eier"
                                   />
                                   {item.allergensDesc?.de && (
                                     <input 
                                       type="text" 
                                       value={item.allergensDesc?.de || ''} 
                                       onChange={(e) => updateItem(catKey, idx, 'allergensDesc.de', e.target.value)} 
                                       className={`w-full rounded px-2 py-1 mt-1 text-xs ${isDarkMode ? 'bg-white/10 text-white/70' : 'bg-white text-gray-700 border border-gray-300'}`} 
                                       title="Beschreibung der Allergene"
                                       placeholder="Allergen Beschreibung (optional)"
                                     />
                                   )}
                                 </div>

                                 {/* Availability */}
                                 <div className="mb-3 flex items-center gap-2">
                                   <input 
                                     type="checkbox" 
                                     checked={item.available !== false} 
                                     onChange={(e) => {
                                       if (!menuData) return;
                                       const newMenuData = JSON.parse(JSON.stringify(menuData));
                                       if (newMenuData.categories?.[catKey]?.items[idx]) {
                                         newMenuData.categories[catKey].items[idx].available = e.target.checked;
                                         setMenuData(newMenuData);
                                       }
                                     }}
                                     className="rounded"
                                     id={`available-${catKey}-${idx}`}
                                   />
                                   <label htmlFor={`available-${catKey}-${idx}`} className={`text-xs ${isDarkMode ? 'text-white/70' : 'text-gray-700'}`}>
                                     🟢 Verfügbar (im Menü anzeigen)
                                   </label>
                                 </div>

                                {/* Extras / Toppings */}
                                <div className="mb-3">
                                  <div className="flex justify-between items-center mb-2">
                                    <label className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>Extras</label>
                                    <button onClick={() => addTopping(catKey, idx)} className={`text-xs px-2 py-1 rounded transition-colors ${isDarkMode ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-200 hover:bg-gray-300'}`}>+ Extra</button>
                                  </div>
                                  {item.toppings?.map((topping: any, tIdx: number) => (
                                    <div key={tIdx} className="flex gap-2 mb-1">
                                      <input type="text" value={topping.name?.de || ''} onChange={(e) => updateTopping(catKey, idx, tIdx, 'de', e.target.value)} className={`flex-1 rounded px-2 py-1 text-xs ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-gray-900 border border-gray-300'}`} placeholder="Extra Name" title="Name des Extras" />
                                      <input type="number" step="0.1" value={topping.price || 0} onChange={(e) => updateTopping(catKey, idx, tIdx, 'price', e.target.value)} className={`w-20 rounded px-2 py-1 text-xs ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-gray-900 border border-gray-300'}`} placeholder="€" title="Preis des Extras" />
                                      <button onClick={() => removeTopping(catKey, idx, tIdx)} className="px-2 py-1 text-red-400 hover:text-red-300 text-xs">×</button>
                                    </div>
                                  ))}
                                </div>

                                {/* Buttons */}
                                <div className="flex justify-end">
                                  <button onClick={() => deleteItem(catKey, idx)} className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded text-xs transition-colors">
                                    Gericht löschen
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <button onClick={saveMenu} disabled={menuLoading} className="w-full bg-roma-red hover:bg-red-700 disabled:bg-gray-600 py-4 rounded-xl font-bold transition-colors sticky bottom-4 shadow-lg">
                      {menuLoading ? 'Wird gespeichert...' : '💾 Alle Änderungen in GitHub speichern'}
                    </button>
                  </div>
                ) : (
                  <p className={isDarkMode ? 'text-white/40' : 'text-gray-400'}>Menü konnte nicht geladen werden</p>
                )}
              </div>
            </motion.div>
          ) : tab === 'offers' ? (
            <motion.div
              key="offers"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className={`rounded-2xl p-6 border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-sm'}`}>
                <h2 className="text-2xl font-bold mb-4">Angebote verwalten</h2>
                <p className="text-white/60 mb-6">
                  Änderungen werden an GitHub gesendet und sind in ca. 30 Sekunden auf der Website sichtbar.
                </p>

                {saveMessage && (
                  <div className={`p-4 rounded-xl mb-4 ${saveMessage.includes('✅') ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {saveMessage}
                  </div>
                )}

                {menuLoading ? (
                  <div className="text-center py-10">
                    <FiRefreshCw className="animate-spin mx-auto mb-2" size={24} />
                    <p className={isDarkMode ? 'text-white/60' : 'text-gray-500'}>Wird geladen...</p>
                  </div>
                ) : menuData ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className={`font-semibold text-lg ${isDarkMode ? '' : 'text-gray-900'}`}>Angebote ({menuData.offers?.length || 0})</h3>
                      <button onClick={addOffer} className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-semibold transition-colors">
                        + Angebot hinzufügen
                      </button>
                    </div>

                    <div className="space-y-4">
                      {(menuData.offers || []).map((offer: any, idx: number) => (
                        <div key={offer.id || idx} className={`rounded-lg p-4 border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200'}`}>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-3">
                            {/* Image Preview + Title DE */}
                            <div className="flex items-start gap-3">
                              {offer.img && (
                                <img 
                                  src={offer.img} 
                                  alt={offer.title?.de || 'Angebot'} 
                                  className={`w-24 h-24 rounded object-cover border flex-shrink-0 ${isDarkMode ? 'border-white/20' : 'border-gray-300'}`}
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                              )}
                              <div className="flex-1 space-y-2">
                                <div>
                                  <label className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>Titel</label>
                                  <input type="text" value={offer.title?.de || ''} onChange={(e) => updateOffer(idx, 'title.de', e.target.value)} className={`w-full rounded px-2 py-1 mt-1 text-sm ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-gray-900 border border-gray-300'}`} title="Titel des Angebots" placeholder="Angebotstitel" />
                                </div>
                              </div>
                            </div>
                            {/* Description + Image URL */}
                            <div className="space-y-2">
                              <div>
                                <label className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>Beschreibung</label>
                                <input type="text" value={offer.desc?.de || ''} onChange={(e) => updateOffer(idx, 'desc.de', e.target.value)} className={`w-full rounded px-2 py-1 mt-1 text-sm ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-gray-900 border border-gray-300'}`} placeholder="Beschreibung..." title="Beschreibung des Angebots" />
                              </div>
                              <div>
                                <label className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>Bild URL</label>
                                <div className="flex gap-2">
                                  <input 
                                    type="text" 
                                    value={offer.img || ''} 
                                    onChange={(e) => updateOffer(idx, 'img', e.target.value)} 
                                    className={`flex-1 rounded px-2 py-1 mt-1 text-sm ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-gray-900 border border-gray-300'}`} 
                                    placeholder="/images/offer.webp" 
                                    title="Bild-URL für das Angebot"
                                  />
                                  <label className={`px-3 py-1 mt-1 rounded cursor-pointer text-sm flex items-center ${isDarkMode ? 'bg-white/20 hover:bg-white/30' : 'bg-gray-200 hover:bg-gray-300'}`}>
                                    📁
                                    <input 
                                      type="file" 
                                      accept="image/*" 
                                      className="hidden"
                                      onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        const token = getAdminToken();
                                        const formData = new FormData();
                                        const filename = `offer_${offer.id}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
                                        formData.append('file', file);
                                        formData.append('filename', filename);
                                        try {
                                          const res = await fetch('/api/admin/upload', {
                                            method: 'POST',
                                            headers: { 'Authorization': `Bearer ${token}` },
                                            body: formData
                                          });
                                          const data = await res.json();
                                          if (data.success) {
                                            updateOffer(idx, 'img', data.path);
                                            setSaveMessage('✅ Bild hochgeladen!');
                                            setTimeout(() => setSaveMessage(''), 2000);
                                          } else {
                                            setSaveMessage(`❌ Fehler: ${data.error}`);
                                          }
                                        } catch (err) {
                                          setSaveMessage('❌ Upload fehlgeschlagen');
                                        }
                                      }}
                                    />
                                  </label>
                                </div>
                              </div>
                            </div>
                            {/* Price + Badge */}
                            <div className="space-y-2">
                              <div>
                                <label className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>Preis</label>
                                <input type="text" value={offer.price || ''} onChange={(e) => updateOffer(idx, 'price', e.target.value)} className={`w-full rounded px-2 py-1 mt-1 text-sm ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-gray-900 border border-gray-300'}`} placeholder="19.90 €" title="Preis des Angebots" />
                              </div>
                              <div>
                                <label className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>Badge / Etikett</label>
                                <input type="text" value={offer.badge || ''} onChange={(e) => updateOffer(idx, 'badge', e.target.value)} className={`w-full rounded px-2 py-1 mt-1 text-sm ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-gray-900 border border-gray-300'}`} placeholder="Spare 30%" title="Badge oder Etikett" />
                              </div>
                              <div className="flex justify-end pt-2">
                                <button onClick={() => deleteOffer(idx)} className={`px-3 py-1 rounded text-xs transition-colors ${isDarkMode ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400' : 'bg-red-100 hover:bg-red-200 text-red-600'}`}>
                                  Angebot löschen
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {(menuData.offers || []).length === 0 && (
                      <div className={`text-center py-10 ${isDarkMode ? 'text-white/40' : 'text-gray-400'}`}>
                        <p className="text-lg">Keine Angebote</p>
                        <p className="text-sm mt-2">Klicken Sie auf "+ Angebot hinzufügen" um ein neues Angebot zu erstellen</p>
                      </div>
                    )}

                    <button onClick={saveOffers} disabled={menuLoading} className="w-full bg-roma-red hover:bg-red-700 disabled:bg-gray-600 py-4 rounded-xl font-bold transition-colors sticky bottom-4 shadow-lg">
                      {menuLoading ? 'Wird gespeichert...' : '💾 Angebote in GitHub speichern'}
                    </button>
                  </div>
                ) : (
                  <p className={isDarkMode ? 'text-white/40' : 'text-gray-400'}>Angebote konnten nicht geladen werden</p>
                )}
              </div>
            </motion.div>
          ) : tab === 'legal' ? (
            <motion.div
              key="legal"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className={`rounded-2xl p-6 border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-sm'}`}>
                <h2 className="text-2xl font-bold mb-4">Rechtliche Texte verwalten</h2>
                <p className="text-white/60 mb-6">
                  Impressum, Datenschutzerklärung und AGB. Änderungen werden an GitHub gesendet und auf der Website aktualisiert.
                </p>

                {saveMessage && (
                  <div className={`p-4 rounded-xl mb-4 ${saveMessage.includes('✅') ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {saveMessage}
                  </div>
                )}

                {menuLoading ? (
                  <div className="text-center py-10">
                    <FiRefreshCw className="animate-spin mx-auto mb-2" size={24} />
                    <p className={isDarkMode ? 'text-white/60' : 'text-gray-500'}>Wird geladen...</p>
                  </div>
                ) : menuData ? (
                  <div className="space-y-8">
                    {/* IMPRESSUM */}
                    <div className={`rounded-xl p-6 ${isDarkMode ? 'bg-black/20' : 'bg-gray-100'}`}>
                      <h3 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-roma-gold' : 'text-orange-600'}`}>Impressum (§5 TMG)</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>Firmenname</label>
                          <input type="text" value={menuData.legal?.impressum?.companyName || ''} onChange={(e) => updateLegal('impressum', 'companyName', e.target.value)} className={`w-full rounded px-3 py-2 mt-1 text-sm ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-gray-900 border border-gray-300'}`} title="Firmenname des Unternehmens" placeholder="z.B. Pizza Roma Siegen" />
                        </div>
                        <div>
                          <label className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>Inhaber</label>
                          <input type="text" value={menuData.legal?.impressum?.owner || ''} onChange={(e) => updateLegal('impressum', 'owner', e.target.value)} className={`w-full rounded px-3 py-2 mt-1 text-sm ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-gray-900 border border-gray-300'}`} title="Name des Inhabers" placeholder="Vorname Nachname" />
                        </div>
                        <div>
                          <label className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>Adresse</label>
                          <input type="text" value={menuData.legal?.impressum?.address || ''} onChange={(e) => updateLegal('impressum', 'address', e.target.value)} className={`w-full rounded px-3 py-2 mt-1 text-sm ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-gray-900 border border-gray-300'}`} title="Geschäftsadresse" placeholder="Musterstraße 1, 57000 Siegen" />
                        </div>
                        <div>
                          <label className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>Telefon</label>
                          <input type="text" value={menuData.legal?.impressum?.phone || ''} onChange={(e) => updateLegal('impressum', 'phone', e.target.value)} className={`w-full rounded px-3 py-2 mt-1 text-sm ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-gray-900 border border-gray-300'}`} title="Telefonnummer" placeholder="+49 123 456789" />
                        </div>
                        <div>
                          <label className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>E-Mail</label>
                          <input type="email" value={menuData.legal?.impressum?.email || ''} onChange={(e) => updateLegal('impressum', 'email', e.target.value)} className={`w-full rounded px-3 py-2 mt-1 text-sm ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-gray-900 border border-gray-300'}`} title="E-Mail Adresse" placeholder="info@pizza-roma.de" />
                        </div>
                        <div>
                          <label className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>USt-IdNr.</label>
                          <input type="text" value={menuData.legal?.impressum?.ustId || ''} onChange={(e) => updateLegal('impressum', 'ustId', e.target.value)} className={`w-full rounded px-3 py-2 mt-1 text-sm ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-gray-900 border border-gray-300'}`} title="Umsatzsteuer-Identifikationsnummer" placeholder="DE123456789" />
                        </div>
                        <div>
                          <label className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>Steuernummer</label>
                          <input type="text" value={menuData.legal?.impressum?.steuernummer || ''} onChange={(e) => updateLegal('impressum', 'steuernummer', e.target.value)} className={`w-full rounded px-3 py-2 mt-1 text-sm ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-gray-900 border border-gray-300'}`} title="Steuernummer" placeholder="123/456/78901" />
                        </div>
                        <div>
                          <label className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>Registergericht (optional)</label>
                          <input type="text" value={menuData.legal?.impressum?.registerCourt || ''} onChange={(e) => updateLegal('impressum', 'registerCourt', e.target.value)} className={`w-full rounded px-3 py-2 mt-1 text-sm ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-gray-900 border border-gray-300'}`} title="Registergericht" placeholder="Amtsgericht Siegen" />
                        </div>
                        <div>
                          <label className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>Registernummer (optional)</label>
                          <input type="text" value={menuData.legal?.impressum?.registerNumber || ''} onChange={(e) => updateLegal('impressum', 'registerNumber', e.target.value)} className={`w-full rounded px-3 py-2 mt-1 text-sm ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-gray-900 border border-gray-300'}`} title="Registernummer" placeholder="HRA 12345" />
                        </div>
                        <div>
                          <label className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>Verantwortlich für Inhalt (§55 RStV)</label>
                          <input type="text" value={menuData.legal?.impressum?.responsibleForContent || ''} onChange={(e) => updateLegal('impressum', 'responsibleForContent', e.target.value)} className={`w-full rounded px-3 py-2 mt-1 text-sm ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-gray-900 border border-gray-300'}`} title="Verantwortliche Person" placeholder="Vorname Nachname" />
                        </div>
                        <div className="md:col-span-2">
                          <label className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>Verantwortlich Adresse</label>
                          <input type="text" value={menuData.legal?.impressum?.responsibleAddress || ''} onChange={(e) => updateLegal('impressum', 'responsibleAddress', e.target.value)} className={`w-full rounded px-3 py-2 mt-1 text-sm ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-gray-900 border border-gray-300'}`} title="Adresse der verantwortlichen Person" placeholder="Straße, PLZ Stadt" />
                        </div>
                        <div className="md:col-span-2">
                          <label className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>Zusätzliche Informationen</label>
                          <textarea value={menuData.legal?.impressum?.additionalInfo || ''} onChange={(e) => updateLegal('impressum', 'additionalInfo', e.target.value)} className={`w-full rounded px-3 py-2 mt-1 text-sm min-h-[80px] ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-gray-900 border border-gray-300'}`} title="Zusätzliche rechtliche Hinweise" placeholder="Weitere rechtliche Hinweise..." />
                        </div>
                      </div>
                    </div>

                    {/* DATENSCHUTZ */}
                    <div className={`rounded-xl p-6 ${isDarkMode ? 'bg-black/20' : 'bg-gray-100'}`}>
                      <h3 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-roma-gold' : 'text-orange-600'}`}>Datenschutzerklärung (DSGVO)</h3>
                      <div className="space-y-4">
                        <div>
                          <label className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>Einleitung</label>
                          <textarea value={menuData.legal?.datenschutz?.intro || ''} onChange={(e) => updateLegal('datenschutz', 'intro', e.target.value)} className={`w-full rounded px-3 py-2 mt-1 text-sm min-h-[80px] ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-gray-900 border border-gray-300'}`} title="Einleitung zur Datenschutzerklärung" placeholder="Informationen über die Erhebung personenbezogener Daten..." />
                        </div>
                        <div>
                          <label className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>Verantwortliche Stelle</label>
                          <input type="text" value={menuData.legal?.datenschutz?.controller || ''} onChange={(e) => updateLegal('datenschutz', 'controller', e.target.value)} className={`w-full rounded px-3 py-2 mt-1 text-sm ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-gray-900 border border-gray-300'}`} title="Name der verantwortlichen Stelle" placeholder="Pizza Roma Inhaber" />
                        </div>
                        <div>
                          <label className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>Erhobene Daten</label>
                          <textarea value={menuData.legal?.datenschutz?.dataCollected || ''} onChange={(e) => updateLegal('datenschutz', 'dataCollected', e.target.value)} className={`w-full rounded px-3 py-2 mt-1 text-sm min-h-[80px] ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-gray-900 border border-gray-300'}`} title="Art der erhobenen Daten" placeholder="IP-Adresse, Bestellungen, Kontaktdaten..." />
                        </div>
                        <div>
                          <label className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>Zweck der Verarbeitung</label>
                          <textarea value={menuData.legal?.datenschutz?.purpose || ''} onChange={(e) => updateLegal('datenschutz', 'purpose', e.target.value)} className={`w-full rounded px-3 py-2 mt-1 text-sm min-h-[80px] ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-gray-900 border border-gray-300'}`} title="Zweck der Datenverarbeitung" placeholder="Bestellabwicklung, Kundenservice..." />
                        </div>
                        <div>
                          <label className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>Hosting (Vercel)</label>
                          <textarea value={menuData.legal?.datenschutz?.hosting || ''} onChange={(e) => updateLegal('datenschutz', 'hosting', e.target.value)} className={`w-full rounded px-3 py-2 mt-1 text-sm min-h-[60px] ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-gray-900 border border-gray-300'}`} title="Informationen zum Hosting" placeholder="Gehostet bei Vercel Inc..." />
                        </div>
                        <div>
                          <label className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>Cookies</label>
                          <textarea value={menuData.legal?.datenschutz?.cookies || ''} onChange={(e) => updateLegal('datenschutz', 'cookies', e.target.value)} className={`w-full rounded px-3 py-2 mt-1 text-sm min-h-[60px] ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-gray-900 border border-gray-300'}`} title="Verwendung von Cookies" placeholder="Wir verwenden Cookies fur..." />
                        </div>
                        <div>
                          <label className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>Ihre Rechte (DSGVO Artikel)</label>
                          <textarea value={menuData.legal?.datenschutz?.rights || ''} onChange={(e) => updateLegal('datenschutz', 'rights', e.target.value)} className={`w-full rounded px-3 py-2 mt-1 text-sm min-h-[80px] ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-gray-900 border border-gray-300'}`} title="Rechte der betroffenen Personen" placeholder="Auskunftsrecht, Löschung, Berichtigung..." />
                        </div>
                        <div>
                          <label className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>Zusätzliche Informationen</label>
                          <textarea value={menuData.legal?.datenschutz?.additionalInfo || ''} onChange={(e) => updateLegal('datenschutz', 'additionalInfo', e.target.value)} className={`w-full rounded px-3 py-2 mt-1 text-sm min-h-[80px] ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-gray-900 border border-gray-300'}`} title="Zusätzliche Informationen zum Datenschutz" placeholder="Weitere Hinweise..." />
                        </div>
                      </div>
                    </div>

                    {/* AGB */}
                    <div className={`rounded-xl p-6 ${isDarkMode ? 'bg-black/20' : 'bg-gray-100'}`}>
                      <h3 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-roma-gold' : 'text-orange-600'}`}>Allgemeine Geschäftsbedingungen (AGB)</h3>
                      <div className="space-y-4">
                        <div>
                          <label className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>Firmenname</label>
                          <input type="text" value={menuData.legal?.agb?.companyName || ''} onChange={(e) => updateLegal('agb', 'companyName', e.target.value)} className={`w-full rounded px-3 py-2 mt-1 text-sm ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-gray-900 border border-gray-300'}`} title="Firmenname fur AGB" placeholder="Pizza Roma Siegen" />
                        </div>
                        <div>
                          <label className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>Einleitung</label>
                          <textarea value={menuData.legal?.agb?.intro || ''} onChange={(e) => updateLegal('agb', 'intro', e.target.value)} className={`w-full rounded px-3 py-2 mt-1 text-sm min-h-[60px] ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-gray-900 border border-gray-300'}`} title="Einleitung zu den AGB" placeholder="Geltungsbereich und Allgemeines..." />
                        </div>
                        <div>
                          <label className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>§ 1 Geltungsbereich</label>
                          <textarea value={menuData.legal?.agb?.scope || ''} onChange={(e) => updateLegal('agb', 'scope', e.target.value)} className={`w-full rounded px-3 py-2 mt-1 text-sm min-h-[60px] ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-gray-900 border border-gray-300'}`} title="Geltungsbereich der AGB" placeholder="Diese Bedingungen gelten fur..." />
                        </div>
                        <div>
                          <label className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>§ 2 Vertragsschluss</label>
                          <textarea value={menuData.legal?.agb?.contractFormation || ''} onChange={(e) => updateLegal('agb', 'contractFormation', e.target.value)} className={`w-full rounded px-3 py-2 mt-1 text-sm min-h-[80px] ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-gray-900 border border-gray-300'}`} title="Zustandekommen des Vertrags" placeholder="Der Vertrag kommt zustande durch..." />
                        </div>
                        <div>
                          <label className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>§ 3 Preise</label>
                          <textarea value={menuData.legal?.agb?.prices || ''} onChange={(e) => updateLegal('agb', 'prices', e.target.value)} className={`w-full rounded px-3 py-2 mt-1 text-sm min-h-[60px] ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-gray-900 border border-gray-300'}`} title="Preise und Versandkosten" placeholder="Alle Preise inkl. MwSt..." />
                        </div>
                        <div>
                          <label className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>§ 4 Lieferung</label>
                          <textarea value={menuData.legal?.agb?.delivery || ''} onChange={(e) => updateLegal('agb', 'delivery', e.target.value)} className={`w-full rounded px-3 py-2 mt-1 text-sm min-h-[80px] ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-gray-900 border border-gray-300'}`} title="Lieferbedingungen" placeholder="Lieferzeit, Versandart..." />
                        </div>
                        <div>
                          <label className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>§ 5 Zahlung</label>
                          <textarea value={menuData.legal?.agb?.payment || ''} onChange={(e) => updateLegal('agb', 'payment', e.target.value)} className={`w-full rounded px-3 py-2 mt-1 text-sm min-h-[60px] ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-gray-900 border border-gray-300'}`} title="Zahlungsbedingungen" placeholder="Bar, PayPal, Kreditkarte..." />
                        </div>
                        <div>
                          <label className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>§ 6 Eigentumsvorbehalt</label>
                          <textarea value={menuData.legal?.agb?.retentionOfTitle || ''} onChange={(e) => updateLegal('agb', 'retentionOfTitle', e.target.value)} className={`w-full rounded px-3 py-2 mt-1 text-sm min-h-[40px] ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-gray-900 border border-gray-300'}`} title="Eigentumsvorbehalt" placeholder="Bis zur vollstandigen Bezahlung..." />
                        </div>
                        <div>
                          <label className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>§ 7 Gewährleistung</label>
                          <textarea value={menuData.legal?.agb?.warranty || ''} onChange={(e) => updateLegal('agb', 'warranty', e.target.value)} className={`w-full rounded px-3 py-2 mt-1 text-sm min-h-[60px] ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-gray-900 border border-gray-300'}`} title="Gewährleistung und Haftung" placeholder="Haftung fur Sachmangel..." />
                        </div>
                        <div>
                          <label className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>§ 8 Haftung</label>
                          <textarea value={menuData.legal?.agb?.liability || ''} onChange={(e) => updateLegal('agb', 'liability', e.target.value)} className={`w-full rounded px-3 py-2 mt-1 text-sm min-h-[60px] ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-gray-900 border border-gray-300'}`} title="Haftungsausschluss" placeholder="Keine Haftung fur..." />
                        </div>
                        <div>
                          <label className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>§ 9 Widerrufsrecht</label>
                          <textarea value={menuData.legal?.agb?.rightOfWithdrawal || ''} onChange={(e) => updateLegal('agb', 'rightOfWithdrawal', e.target.value)} className={`w-full rounded px-3 py-2 mt-1 text-sm min-h-[60px] ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-gray-900 border border-gray-300'}`} title="Widerrufsbelehrung" placeholder="Widerrufsfrist, Musterformular..." />
                        </div>
                        <div>
                          <label className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>§ 10 Datenschutz</label>
                          <textarea value={menuData.legal?.agb?.dataProtection || ''} onChange={(e) => updateLegal('agb', 'dataProtection', e.target.value)} className={`w-full rounded px-3 py-2 mt-1 text-sm min-h-[40px] ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-gray-900 border border-gray-300'}`} title="Datenschutzbestimmungen" placeholder="Hinweis auf Datenschutzerklarung..." />
                        </div>
                        <div>
                          <label className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>§ 11 Schlussbestimmungen</label>
                          <textarea value={menuData.legal?.agb?.finalProvisions || ''} onChange={(e) => updateLegal('agb', 'finalProvisions', e.target.value)} className={`w-full rounded px-3 py-2 mt-1 text-sm min-h-[60px] ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-gray-900 border border-gray-300'}`} title="Schlussbestimmungen" placeholder="Gerichtsstand, anwendbares Recht..." />
                        </div>
                        <div>
                          <label className={`text-xs ${isDarkMode ? 'text-white/50' : 'text-gray-500'}`}>§ 12 Zusätzliche Bestimmungen</label>
                          <textarea value={menuData.legal?.agb?.additionalInfo || ''} onChange={(e) => updateLegal('agb', 'additionalInfo', e.target.value)} className={`w-full rounded px-3 py-2 mt-1 text-sm min-h-[80px] ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-gray-900 border border-gray-300'}`} title="Zusätzliche Bestimmungen zu den AGB" placeholder="Weitere rechtliche Hinweise..." />
                        </div>
                      </div>
                    </div>

                    <button onClick={saveLegal} disabled={menuLoading} className="w-full bg-roma-red hover:bg-red-700 disabled:bg-gray-600 py-4 rounded-xl font-bold transition-colors sticky bottom-4 shadow-lg">
                      {menuLoading ? 'Wird gespeichert...' : '💾 Rechtliche Texte in GitHub speichern'}
                    </button>
                  </div>
                ) : (
                  <p className={isDarkMode ? 'text-white/40' : 'text-gray-400'}>Daten konnten nicht geladen werden</p>
                )}
              </div>
            </motion.div>
          ) : tab === 'users' ? (
            <motion.div
              key="users"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className={`rounded-2xl p-6 border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-sm'}`}>
                <h2 className="text-2xl font-bold mb-4">Kunden verwalten</h2>
                <p className="text-white/60 mb-6">
                  Liste aller registrierten Kunden und deren Bestellungen.
                </p>

                {usersLoading ? (
                  <div className="text-center py-10">
                    <FiRefreshCw className="animate-spin mx-auto mb-2" size={24} />
                    <p className={isDarkMode ? 'text-white/60' : 'text-gray-500'}>Wird geladen...</p>
                  </div>
                ) : users.length === 0 ? (
                  <div className={`text-center py-10 ${isDarkMode ? 'text-white/40' : 'text-gray-400'}`}>
                    <p className="text-lg">Keine Kunden</p>
                    <p className="text-sm mt-2">Kunden erscheinen hier automatisch nach Bestellungen.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {users.map((user: any) => (
                      <div key={user.id} className={`rounded-xl p-4 border ${isDarkMode ? 'border-white/10 bg-white/5' : 'border-gray-200 bg-white'}`}>
                        <div className="flex flex-col md:flex-row justify-between gap-4">
                          <div>
                            <h3 className={`font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{user.name || 'Unbekannt'}</h3>
                            <p className={`text-sm ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>✉️ {user.email}</p>
                            <p className={`text-sm ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>📞 {user.phone}</p>
                            {user.address && <p className={`text-sm ${isDarkMode ? 'text-white/60' : 'text-gray-500'}`}>📍 {user.address}</p>}
                            <p className={`text-xs ${isDarkMode ? 'text-white/40' : 'text-gray-400'}`}>Registriert: {new Date(user.createdAt).toLocaleDateString('de-DE')}</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Bestellungen: {user.orders?.length || 0}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}