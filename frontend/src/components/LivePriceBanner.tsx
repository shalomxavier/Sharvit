import React, { useState } from 'react';
import { useLivePrice } from '../hooks/useLivePrice';
import ContactsModal from './ContactsModal';

const LivePriceBanner: React.FC = () => {
  const { data, loading, error } = useLivePrice(5000);
  const [contactsModalOpen, setContactsModalOpen] = useState(false);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(price);
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).toUpperCase();
  };

  const [smsSending, setSmsSending] = useState(false);
  const [smsMessage, setSmsMessage] = useState<string | null>(null);
  const [callSending, setCallSending] = useState(false);
  const [callMessage, setCallMessage] = useState<string | null>(null);

  const handleTestSms = async () => {
    try {
      setSmsSending(true);
      setSmsMessage(null);

      const response = await fetch('https://sendtestsms-dyvshblfzq-as.a.run.app', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok) {
        setSmsMessage(`SMS sent to ${data.successCount} contacts`);
      } else {
        setSmsMessage(data.message || 'Failed to send SMS');
      }
    } catch (error) {
      console.error('Error testing SMS:', error);
      setSmsMessage('Error sending SMS');
    } finally {
      setSmsSending(false);
    }
  };

  const handleTestCall = async () => {
    try {
      setCallSending(true);
      setCallMessage(null);

      const response = await fetch('https://sendtestcall-dyvshblfzq-as.a.run.app', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok) {
        setCallMessage(`Calls initiated to ${data.successCount} contacts`);
      } else {
        setCallMessage(data.message || 'Failed to initiate calls');
      }
    } catch (error) {
      console.error('Error testing call:', error);
      setCallMessage('Error initiating calls');
    } finally {
      setCallSending(false);
    }
  };

  const handleContacts = async () => {
    try {
      setContactsModalOpen(true);
    } catch (error) {
      console.error('Error handling contacts:', error);
    }
  };

  if (loading) {
    return (
      <div className="p-4 mb-6">
        <div className="container mx-auto flex items-center justify-center">
          <div className="animate-pulse flex items-center space-x-4">
            <div className="h-4 rounded w-24 border"></div>
            <div className="h-6 rounded w-32 border"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 mb-6">
        <div className="container mx-auto flex items-center justify-center">
          <span className="text-sm">⚠️ Failed to load live price: {error}</span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="p-4 mb-6">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <div>
            <span className="text-sm font-semibold text-blue-500">Live Price (BTC/USDT)</span>
            <div className="text-2xl font-bold text-blue-600">{formatPrice(data.lastPrice)}</div>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          {smsMessage && (
            <span className={`text-sm ${smsMessage.includes('sent') ? 'text-green-600' : 'text-red-500'}`}>
              {smsMessage}
            </span>
          )}
          {callMessage && (
            <span className={`text-sm ${callMessage.includes('initiated') ? 'text-green-600' : 'text-red-500'}`}>
              {callMessage}
            </span>
          )}
          <button
            onClick={handleTestSms}
            disabled={smsSending}
            className="px-4 py-2 bg-blue-500 text-white text-sm font-semibold rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {smsSending ? 'Sending...' : 'Test SMS'}
          </button>
          <button
            onClick={handleTestCall}
            disabled={callSending}
            className="px-4 py-2 bg-green-500 text-white text-sm font-semibold rounded hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {callSending ? 'Calling...' : 'Test Call'}
          </button>
          <button
            onClick={handleContacts}
            className="px-4 py-2 bg-purple-500 text-white text-sm font-semibold rounded hover:bg-purple-600 transition-colors"
          >
            Contacts
          </button>
          <span className="text-sm text-blue-400">{formatTimestamp(data.timestamp)}</span>
        </div>
      </div>
      <ContactsModal isOpen={contactsModalOpen} onClose={() => setContactsModalOpen(false)} />
    </div>
  );
};

export default LivePriceBanner;
